import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import Swal from "sweetalert2";
import { Stage } from "react-konva";
import Modal from "react-modal";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Import icons
import { 
  FaFilter, 
  FaDownload, 
  FaCog, 
  FaArrowLeft, 
  FaSearch,
  FaImage
} from 'react-icons/fa';

import {
  renderOneSidePitchShots,
  translateShotToOneSide,
  getShotCategory
} from "./GAAPitchComponents";

// Import our new CSS
import './PlayerShotDataGAA.css';

/* ───────────────────────── Modal root */
Modal.setAppElement("#root");

/* ─────────────────────────── Const */
const canvas = { w: 930, h: 530 };
const pitchW = 145;
const pitchH = 88;

const defaultColors = {
  goal: "var(--goal-color)",
  point: "var(--point-color)",
  miss: "var(--danger)",
  setPlayScore: { fill: "var(--point-color)", stroke: "white" },
  setPlayMiss: { fill: "var(--danger)", stroke: "white" }
};

/* map of verbose shots that should fall into canonical buckets */
const verboseToCanonical = {
  free: "free",
  "free miss": "miss",
  "free wide": "miss",
  "free short": "miss",
  fortyfive: "45",
  "fortyfive wide": "miss",
  "fortyfive short": "miss",
  blocked: "miss",
  post: "miss"
};

/* Canonical categories we care about for filtering/legend */
const canonicalOrder = [
  "goal",
  "point",
  "miss",
  "free",
  "45",
  "offensive mark",
  "penalty goal"
];

/* ─────────────────────────── Helpers */
function canonicalAction(actionRaw = "") {
  const x = actionRaw.toLowerCase().trim();
  if (verboseToCanonical[x]) return verboseToCanonical[x];
  if (/^point/.test(x)) return "point";
  if (/^(goal|penalty goal)/.test(x))
    return x.startsWith("penalty") ? "penalty goal" : "goal";
  if (/free/.test(x)) return "free";
  if (/45|fortyfive/.test(x)) return "45";
  if (/offensive mark/.test(x)) return "offensive mark";
  if (/wide|short|miss|post|blocked/.test(x)) return "miss";
  return x;
}

function renderType(actionRaw = "") {
  const cat = canonicalAction(actionRaw);
  switch (cat) {
    case "free":
    case "45":
      return "setPlayScore";
    case "miss":
      return "miss";
    default:
      return cat; // goal, point, offensive mark, etc.
  }
}

/* PDF export */
async function savePdf(setDownloading, name) {
  setDownloading(true);
  try {
    const el = document.getElementById("pdf-content");
    if (!el) throw new Error("Nothing to export");
    const cnv = await html2canvas(el, { scale: 2 });
    const img = cnv.toDataURL("image/png");
    const pdf = new jsPDF("l", "mm", "a4");
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    pdf.setFillColor(15, 10, 27); // Using dark variable
    pdf.rect(0, 0, W, H, "F");
    const props = pdf.getImageProperties(img);
    pdf.addImage(
      img,
      "PNG",
      0,
      (H - (props.height * W) / props.width) / 2,
      W,
      (props.height * W) / props.width
    );
    pdf.setFontSize(12);
    pdf.setTextColor(230, 230, 250); // Using light variable
    pdf.text("scorelect.com", W - 40, H - 10);
    pdf.save(`${name}_shot_map.pdf`);
  } catch (e) {
    Swal.fire({
      title: "Error",
      text: e.message,
      icon: "error",
      background: "var(--dark-card)",
      confirmButtonColor: "var(--primary)",
    });
  }
  setDownloading(false);
}

/* Settings modal */
function SettingsModal({ isOpen, onRequestClose, markerColors, setMarkerColors }) {
  const colorKeys = Object.keys(markerColors);
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="player-shot-modal-content"
      overlayClassName="player-shot-modal-overlay"
      contentLabel="Settings"
    >
      <h2 className="player-shot-modal-title">Marker Color Settings</h2>
      <div className="player-shot-modal-body">
        {colorKeys.map((key) => (
          <div key={key} className="player-shot-modal-row">
            <span className="player-shot-modal-label" style={{ textTransform: 'capitalize' }}>
              {key}
            </span>
            <input
              type="color"
              value={
                markerColors[key] && markerColors[key].fill
                  ? markerColors[key].fill
                  : markerColors[key]
              }
              onChange={(e) => {
                const val = e.target.value;
                setMarkerColors((prev) => ({
                  ...prev,
                  [key]:
                    typeof prev[key] === "object"
                      ? { ...prev[key], fill: val }
                      : val
                }));
              }}
            />
          </div>
        ))}
      </div>
      <div className="player-shot-modal-actions">
        <button
          className="player-shot-button primary"
          onClick={() => {
            localStorage.setItem("playerShotMarkerColors", JSON.stringify(markerColors));
            Swal.fire({
              title: "Settings Saved",
              text: "Your color settings have been saved.",
              icon: "success",
              background: "var(--dark-card)",
              confirmButtonColor: "var(--primary)",
            });
            onRequestClose();
          }}
        >
          Save
        </button>
        <button
          className="player-shot-button secondary"
          onClick={onRequestClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── Format helpers for modal */
const fmt = (v, d = 2) => (typeof v === "number" ? v.toFixed(d) : v);
const yesNo = (v) => (v === undefined || v === null ? "" : v ? "Yes" : "No");

/* Fields to show inside the Shot Details modal, in order */
const DETAIL_FIELDS = [
  { key: "action", label: "Action", format: (v) => v },
  { key: "renderType", label: "Category", format: (v) => v },
  { key: "distMeters", label: "Distance (m)", format: (v) => fmt(v, 1) },
  { key: "foot", label: "Foot", format: (v) => v },
  { key: "pressure", label: "Pressure", format: yesNo },
  { key: "position", label: "Position", format: (v) => v },
  { key: "xPoints", label: "xP", format: fmt },
  { key: "xpAdv", label: "xP_ADV", format: fmt }
];

/* ─────────────────────────── Main component */
export default function PlayerShotDataGAA() {
  const { playerName } = useParams();
  const navigate = useNavigate();
  const stageRef = useRef(null);

  const [colors, setColors] = useState(
    JSON.parse(localStorage.getItem("playerShotMarkerColors") || "null") ||
      defaultColors
  );
  const [playerShots, setPlayerShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    team: "N/A",
    totalShots: 0,
    successfulShots: 0,
    points: 0,
    goals: 0,
    misses: 0,
    offensiveMarks: 0,
    totalFrees: 0,
    successfulFrees: 0,
    total45s: 0,
    successful45s: 0,
    totalXP: 0,
    totalXG: 0,
    avgDist: 0
  });
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const xScale = canvas.w / pitchW;
  const yScale = canvas.h / pitchH;
  const half = pitchW / 2;
  const goalX = pitchW;
  const goalY = pitchH / 2;

  /* ───── Fetch player shots */
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(
          doc(
            firestore,
            "savedGames/w9ZkqaYVM3dKSqqjWHLDVyh5sVg2/games",
            "All Shots GAA"
          )
        );
        if (!snap.exists()) throw new Error("Dataset missing");
        const list = snap.data().gameData || [];
        const mine = list.filter(
          (s) => (s.playerName || "").toLowerCase() === playerName.toLowerCase()
        );
        if (!mine.length) {
          Swal.fire({
            title: "No Data",
            text: `No shots for ${playerName}`,
            icon: "info",
            background: "var(--dark-card)",
            confirmButtonColor: "var(--primary)",
          }).then(() =>
            navigate(-1)
          );
          return;
        }
        const fixed = mine.map((s) => ({
          ...translateShotToOneSide(s, half, goalX, goalY),
          renderType: renderType(s.action),
          canonical: canonicalAction(s.action)
        }));
        setPlayerShots(fixed);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [playerName, navigate, half, goalX, goalY]);

  /* ───── build dropdown options */
  const availableActions = useMemo(() => {
    const set = new Set();
    playerShots.forEach(({ canonical }) => set.add(canonical));
    const arr = Array.from(set).sort((a, b) => {
      const ia = canonicalOrder.indexOf(a);
      const ib = canonicalOrder.indexOf(b);
      return ia === -1 || ib === -1 ? a.localeCompare(b) : ia - ib;
    });
    return arr;
  }, [playerShots]);

  /* ───── aggregate stats */
  useEffect(() => {
    if (!playerShots.length) return;
    const agg = {
      team: "N/A",
      totalShots: 0,
      successfulShots: 0,
      points: 0,
      goals: 0,
      misses: 0,
      offensiveMarks: 0,
      totalFrees: 0,
      successfulFrees: 0,
      total45s: 0,
      successful45s: 0,
      totalXP: 0,
      totalXG: 0,
      totalDist: 0
    };
    playerShots.forEach((s) => {
      if (s.team && agg.team === "N/A") agg.team = s.team;
      agg.totalShots++;
      agg.totalXP += s.xPoints || 0;
      agg.totalXG += s.xGoals || 0;
      agg.totalDist += typeof s.distMeters === "number" ? s.distMeters : 0;

      const cat = canonicalAction(s.action);
      switch (cat) {
        case "goal":
        case "penalty goal":
          agg.goals++;
          agg.successfulShots++;
          break;
        case "point":
          agg.points++;
          agg.successfulShots++;
          break;
        case "miss":
          agg.misses++;
          break;
        default:
          break;
      }
      const a = s.action.toLowerCase();
      if (a.includes("offensive mark") && !/(wide|short|miss)/.test(a)) {
        agg.offensiveMarks++;
        agg.successfulShots++;
      }
      if (a.includes("free")) {
        agg.totalFrees++;
        if (canonicalAction(a) === "free") {
          agg.successfulFrees++;
          agg.successfulShots++;
        }
      }
      if (/45|fortyfive/.test(a)) {
        agg.total45s++;
        if (canonicalAction(a) === "45") {
          agg.successful45s++;
          agg.successfulShots++;
        }
      }
    });
    agg.avgDist = agg.totalShots ? agg.totalDist / agg.totalShots : 0;
    setStats(agg);
  }, [playerShots]);

  const shown = useMemo(
    () => playerShots.filter((s) => !filter || s.canonical === filter),
    [playerShots, filter]
  );

  const dynamic = {
    goal: colors.goal,
    point: colors.point,
    miss: colors.miss,
    setPlayScore:
      typeof colors.setPlayScore === "object"
        ? colors.setPlayScore
        : { fill: colors.setPlayScore, stroke: "white" },
    setPlayMiss:
      typeof colors.setPlayMiss === "object"
        ? colors.setPlayMiss
        : { fill: colors.setPlayMiss, stroke: "white" }
  };

  /* ───── Loading / error UI */
  if (loading) {
    return (
      <div className="player-shot-container">
        <div className="player-shot-loading">
          <div className="player-shot-spinner"></div>
          <p>Loading player shot data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="player-shot-container">
        <div className="player-shot-error">
          <h3>Error</h3>
          <p>{error}</p>
          <button 
            className="player-shot-button primary"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft style={{ marginRight: '0.5rem' }} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  /* Legend labels */
  const legendItems = [
    { label: "Goal", key: "goal" },
    { label: "Point", key: "point" },
    { label: "Miss", key: "miss" },
    { label: "Set‑Play Score", key: "setPlayScore" },
    { label: "Set‑Play Miss", key: "setPlayMiss" }
  ];

  /* ───── JSX */
  return (
    <div className="player-shot-container">
      <div className="player-shot-header">
        <h2>{playerName}'s Shot Data</h2>
      </div>

      {/* ───────── FILTER + CONTROLS */}
      <div className="player-shot-filters">
        {/* dropdown */}
        <div className="player-shot-filter-group">
          <label className="player-shot-filter-label" htmlFor="shotType">Shot Type:</label>
          <select
            id="shotType"
            className="player-shot-filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All</option>
            {availableActions.map((act) => (
              <option key={act} value={act}>
                {act.charAt(0).toUpperCase() + act.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {filter && (
          <button 
            className="player-shot-button secondary" 
            onClick={() => setFilter("")}
          >
            <FaFilter style={{ marginRight: '0.5rem' }} /> Clear Filter
          </button>
        )}

        {/* download / export */}
        <button 
          className="player-shot-button primary"
          onClick={() => savePdf(setDownloading, playerName)}
        >
          {downloading ? 'Downloading...' : (
            <><FaDownload style={{ marginRight: '0.5rem' }} /> Download PDF</>
          )}
        </button>
        
        <button
          className="player-shot-button primary"
          onClick={() =>
            stageRef.current?.toDataURL({
              pixelRatio: 2,
              callback: (url) => {
                const a = document.createElement("a");
                a.href = url;
                a.download = `${playerName}_pitch.png`;
                a.click();
              }
            })
          }
        >
          <FaImage style={{ marginRight: '0.5rem' }} /> Export PNG
        </button>

        {/* settings gear */}
        <div className="player-shot-gear-box">
          <button 
            className="player-shot-gear-button" 
            title="Settings" 
            onClick={() => setShowSettings(true)}
          >
            <FaCog />
          </button>
        </div>
      </div>

      {/* ───────── MAIN CANVAS + STATS */}
      <div className="player-shot-section" id="pdf-content">
        <div className="player-shot-content">
          {/* pitch */}
          <div className="player-shot-pitch-wrapper">
            <Stage
              ref={stageRef}
              width={xScale * (pitchW / 2)}
              height={yScale * pitchH}
              style={{
                background: "var(--dark)",
                border: "1px solid var(--primary)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-md)"
              }}
            >
              {renderOneSidePitchShots({
                shots: shown,
                colors: dynamic,
                xScale,
                yScale,
                onShotClick: setSelected,
                halfLineX: half,
                goalX,
                goalY
              })}
            </Stage>

            {/* legend */}
            <div className="player-shot-legend">
              {legendItems.map(({ label, key }) => {
                const col = dynamic[key];
                const fill = typeof col === "string" ? col : col.fill;
                const needsBorder = key === "setPlayScore" || key === "setPlayMiss";
                return (
                  <div className="player-shot-legend-item" key={key}>
                    <span 
                      className={`player-shot-legend-marker ${needsBorder ? 'border' : ''}`}
                      style={{ backgroundColor: fill }}
                    ></span>
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* stats card */}
          <div className="player-shot-stats-card">
            <h3 className="player-shot-stats-heading">{playerName} Stats</h3>
            <p className="player-shot-stat">
              <strong>Team:</strong> {stats.team}
            </p>
            <p className="player-shot-stat">
              <strong>Shots:</strong> {stats.successfulShots}/{stats.totalShots}
            </p>
            <p className="player-shot-stat">
              <strong>Points:</strong> {stats.points}
            </p>
            <p className="player-shot-stat">
              <strong>Goals:</strong> {stats.goals}
            </p>
            <p className="player-shot-stat">
              <strong>Misses:</strong> {stats.misses}
            </p>
            <p className="player-shot-stat">
              <strong>Off. Marks:</strong> {stats.offensiveMarks}
            </p>
            <p className="player-shot-stat">
              <strong>Frees:</strong> {stats.successfulFrees}/{stats.totalFrees}
            </p>
            <p className="player-shot-stat">
              <strong>45s:</strong> {stats.successful45s}/{stats.total45s}
            </p>
            <p className="player-shot-stat">
              <strong>Total xP:</strong> {stats.totalXP.toFixed(2)}
            </p>
            <p className="player-shot-stat">
              <strong>Total xG:</strong> {stats.totalXG.toFixed(2)}
            </p>
            <p className="player-shot-stat">
              <strong>Avg Dist:</strong> {stats.avgDist.toFixed(2)} m
            </p>
          </div>
        </div>
      </div>

      {/* ───────── Shot‑details modal */}
      {selected && (
        <Modal
          isOpen={true}
          onRequestClose={() => setSelected(null)}
          className="player-shot-modal-content"
          overlayClassName="player-shot-modal-overlay"
          contentLabel="Shot Details"
        >
          <h2 className="player-shot-modal-title">Shot Details</h2>
          <div className="player-shot-modal-body">
            {DETAIL_FIELDS.map(({ key, label, format }) => {
              const valRaw = selected[key];
              if (valRaw === undefined || valRaw === null || valRaw === "") return null;
              return (
                <div className="player-shot-modal-row" key={key}>
                  <span className="player-shot-modal-label">{label}:</span>
                  <span className="player-shot-modal-value">{format(valRaw)}</span>
                </div>
              );
            })}
          </div>

          <div className="player-shot-modal-actions">
            <button
              className="player-shot-button secondary"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* ───────── Settings modal */}
      <SettingsModal
        isOpen={showSettings}
        onRequestClose={() => setShowSettings(false)}
        markerColors={colors}
        setMarkerColors={setColors}
      />
    </div>
  );
}