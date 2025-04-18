/***********************************************************************
 *  PlayerShotDataGAA.jsx
 *  Full component – copy/paste directly into your project
 *  (React 18, styled‑components, react‑konva, Konva Stage)
 **********************************************************************/
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import Swal from "sweetalert2";
import { Stage } from "react-konva";
import Modal from "react-modal";
import styled from "styled-components";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import {
  renderOneSidePitchShots,
  translateShotToOneSide,
  getShotCategory
} from "./GAAPitchComponents";

/* ───────────────────────── Modal root */
Modal.setAppElement("#root");

/* ─────────────────────────── Styled */
const PageContainer = styled.div`
  min-height: 100vh;
  background: #1c1c1c;
  color: #f0f0f0;
  padding: 2rem;
`;
const Section = styled.div`
  background: #2a2e2a;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;
const Title = styled.h2`
  text-align: center;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #ffc107;
`;
const FiltersContainer = styled.div`
  background: #3a3a3a;
  padding: 1rem;
  border-radius: 8px;
  max-width: 900px;
  margin: 0 auto 2rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
`;
const FilterLabel = styled.label`
  margin-right: 0.5rem;
  font-weight: 600;
`;
const FilterSelect = styled.select`
  padding: 0.5rem;
  border-radius: 5px;
  border: 1px solid #777;
  background: #fff;
  color: #000;
  min-width: 150px;
  font-size: 0.9rem;
`;
const PitchAndStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start;
`;
const StatsCard = styled.div`
  background: #333;
  padding: 1rem;
  border-radius: 8px;
  min-width: 250px;
  max-width: 350px;
`;
const StatsHeading = styled.h3`
  margin: 0 0 1rem;
  font-weight: 600;
  color: #ffc107;
`;
const Stat = styled.p`
  margin: 0.25rem 0;
`;
const Button = styled.button`
  background: #4f8ef7;
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 5px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2);
  transition: background 0.3s;

  &:hover {
    background: #357ad2;
  }
`;

/* Legend */
const PitchWrapper = styled.div`
  position: relative;
`;
const LegendContainer = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.65);
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
  backdrop-filter: blur(4px);
`;
const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;
const LegendMarker = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: ${({ $border }) => ($border ? "1px solid #fff" : "none")};
  background: ${({ color }) => color};
  display: inline-block;
`;

/* Gear icon */
const GearButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #ffc107;
  cursor: pointer;
`;
const GearBox = styled.div`
  border: 1px solid #444;
  border-radius: 8px;
  padding: 0.25rem;
  display: inline-flex;
  align-items: center;
`;

/* ─────────────────────────── Const */
const canvas = { w: 930, h: 530 };
const pitchW = 145;
const pitchH = 88;

const defaultColors = {
  goal: "#FFFF33",
  point: "#39FF14",
  miss: "red",
  setPlayScore: { fill: "#39FF14", stroke: "white" },
  setPlayMiss: { fill: "red", stroke: "white" }
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
    pdf.setFillColor(50, 50, 50);
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
    pdf.setTextColor(255, 255, 255);
    pdf.text("scorelect.com", W - 40, H - 10);
    pdf.save(`${name}_shot_map.pdf`);
  } catch (e) {
    Swal.fire("Error", e.message, "error");
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
      style={{
        content: {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "420px",
          maxHeight: "80vh",
          padding: "30px",
          borderRadius: "10px",
          backgroundColor: "#2e2a2a",
          color: "#fff",
          overflow: "auto"
        },
        overlay: { backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999 }
      }}
      contentLabel="Settings"
    >
      <h2 style={{ marginTop: 0 }}>Marker Color Settings</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {colorKeys.map((key) => (
          <div
            key={key}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>{key}</span>
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
      <div style={{ textAlign: "right", marginTop: "1rem" }}>
        <Button
          onClick={() => {
            localStorage.setItem("playerShotMarkerColors", JSON.stringify(markerColors));
            Swal.fire("Settings Saved", "Your color settings have been saved.", "success");
            onRequestClose();
          }}
        >
          Save
        </Button>
        <Button
          style={{ background: "#607d8b", marginLeft: "1rem" }}
          onClick={onRequestClose}
        >
          Close
        </Button>
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
          Swal.fire("No Data", `No shots for ${playerName}`, "info").then(() =>
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
  if (loading)
    return <div style={{ textAlign: "center", marginTop: "3rem" }}>Loading…</div>;
  if (error)
    return (
      <div style={{ color: "red", textAlign: "center", marginTop: "3rem" }}>
        {error}
      </div>
    );

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
    <PageContainer>
      <Title>{playerName}'s Shot Data</Title>

      {/* ───────── FILTER + CONTROLS */}
      <FiltersContainer>
        {/* dropdown */}
        <div>
          <FilterLabel htmlFor="shotType">Shot Type:</FilterLabel>
          <FilterSelect
            id="shotType"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All</option>
            {availableActions.map((act) => (
              <option key={act} value={act}>
                {act.charAt(0).toUpperCase() + act.slice(1)}
              </option>
            ))}
          </FilterSelect>
        </div>

        {filter && (
          <Button style={{ background: "#6c757d" }} onClick={() => setFilter("")}>
            Clear
          </Button>
        )}

        {/* download / export */}
        <Button onClick={() => savePdf(setDownloading, playerName)}>
          {downloading ? "Downloading…" : "Download PDF"}
        </Button>
        <Button
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
          Export PNG
        </Button>

        {/* settings gear */}
        <GearBox>
          <GearButton title="Settings" onClick={() => setShowSettings(true)}>
            ⚙️
          </GearButton>
        </GearBox>
      </FiltersContainer>

      {/* ───────── MAIN CANVAS + STATS */}
      <Section id="pdf-content">
        <PitchAndStats>
          {/* pitch */}
          <PitchWrapper>
            <Stage
              ref={stageRef}
              width={xScale * (pitchW / 2)}
              height={yScale * pitchH}
              style={{
                background: "#111",
                border: "2px solid #444",
                borderRadius: "8px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
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
            <LegendContainer>
              {legendItems.map(({ label, key }) => {
                const col  = dynamic[key];
                const fill = typeof col === "string" ? col : col.fill;
                const needsBorder = key === "setPlayScore" || key === "setPlayMiss";
                return (
                  <LegendItem key={key}>
                  <LegendMarker color={fill} $border={needsBorder} />
                    {label}
                  </LegendItem>
                );
              })}
            </LegendContainer>

          </PitchWrapper>

          {/* stats card */}
          <StatsCard>
            <StatsHeading>{playerName} Stats</StatsHeading>
            <Stat>
              <strong>Team:</strong> {stats.team}
            </Stat>
            <Stat>
              <strong>Shots:</strong> {stats.successfulShots}/{stats.totalShots}
            </Stat>
            <Stat>
              <strong>Points:</strong> {stats.points}
            </Stat>
            <Stat>
              <strong>Goals:</strong> {stats.goals}
            </Stat>
            <Stat>
              <strong>Misses:</strong> {stats.misses}
            </Stat>
            <Stat>
              <strong>Off. Marks:</strong> {stats.offensiveMarks}
            </Stat>
            <Stat>
              <strong>Frees:</strong> {stats.successfulFrees}/{stats.totalFrees}
            </Stat>
            <Stat>
              <strong>45s:</strong> {stats.successful45s}/{stats.total45s}
            </Stat>
            <Stat>
              <strong>Total xP:</strong> {stats.totalXP.toFixed(2)}
            </Stat>
            <Stat>
              <strong>Total xG:</strong> {stats.totalXG.toFixed(2)}
            </Stat>
            <Stat>
              <strong>Avg Dist:</strong> {stats.avgDist.toFixed(2)} m
            </Stat>
          </StatsCard>
        </PitchAndStats>
      </Section>

      {/* ───────── Shot‑details modal */}
      {selected && (
        <Modal
          isOpen
          onRequestClose={() => setSelected(null)}
          style={{
            content: {
              maxWidth: "500px",
              margin: "auto",
              padding: "20px",
              borderRadius: "8px",
              background: "#2e2e2e",
              color: "#fff"
            }
          }}
        >
          <h2 style={{ marginTop: 0 }}>Shot Details</h2>
          {DETAIL_FIELDS.map(({ key, label, format }) => {
            const valRaw = selected[key];
            if (valRaw === undefined || valRaw === null || valRaw === "") return null;
            return (
              <p key={key}>
                <strong>{label}:</strong> {format(valRaw)}
              </p>
            );
          })}

          <div style={{ textAlign: "right", marginTop: "1rem" }}>
            <Button
              style={{ background: "#607d8b" }}
              onClick={() => setSelected(null)}
            >
              Close
            </Button>
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
    </PageContainer>
  );
}
