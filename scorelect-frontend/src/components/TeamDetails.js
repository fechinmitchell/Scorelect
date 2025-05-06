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
  FaDownload, 
  FaCog, 
  FaFilter, 
  FaChartBar, 
  FaUser
} from 'react-icons/fa';

import {
  renderGAAPitch,
  renderOneSidePitchShots,
  renderLegendOneSideShots,
  translateShotToOneSide,
  translateShotToLeftSide,
  getShotCategory
} from "./GAAPitchComponents";

// Import our new CSS
import './TeamDetails.css';

/* ───────────────────────── Modal root */
Modal.setAppElement("#root");

/* ─── Pitch metrics ─────────────────────────────────────────────────── */
const pitchW = 145;
const pitchH = 88;
const halfX  = pitchW / 2;   // 72.5 m
const goalX  = 0;            // always measure to left goal
const goalY  = pitchH / 2;   // 44 m
const canvas = { width: 930, height: 530 };

/* ─── Colour defaults ──────────────────────────────────────────────── */
const fallbackColors = {
  goal: "#FFFF33",
  point: "#39FF14",
  miss: "red",
  setplayscore: "#39FF14",
  setplaymiss: "red",
  "penalty goal": "#FF8C00",
  blocked: "red"
};

const defaultMapping = {
  free: "setplayscore",
  "free miss": "setplaymiss",
  "free wide": "setplaymiss",
  "free short": "setplaymiss",
  fortyfive: "setplayscore",
  "fortyfive wide": "setplaymiss",
  "fortyfive short": "setplaymiss"
};

/* ─── Settings modal (using className instead of styled-components) ─── */
function SettingsModal({
  isOpen,
  onRequestClose,
  actionMapping,
  setActionMapping,
  markerColors,
  setMarkerColors
}) {
  const mappingKeys = Object.keys(actionMapping);
  const colorKeys   = Object.keys(markerColors);

  return (
    <Modal 
      isOpen={isOpen} 
      onRequestClose={onRequestClose}
      className="team-details-modal-content"
      overlayClassName="team-details-modal-overlay"
      contentLabel="Settings"
    >
      <h2 className="team-details-modal-title">Settings</h2>

      {/* mapping */}
      <h3 className="color-modal-header">Action Mapping</h3>
      <div className="color-modal-grid">
        {mappingKeys.map((k) => (
          <div key={k} className="team-details-modal-row">
            <span className="team-details-modal-label">{k}</span>
            <select 
              className="Select"
              value={actionMapping[k]}
              onChange={(e)=>setActionMapping({...actionMapping,[k]:e.target.value})}
            >
              <option value="setplayscore">Set‑Play Score</option>
              <option value="setplaymiss">Set‑Play Miss</option>
              <option value="goal">Goal</option>
              <option value="point">Point</option>
              <option value="miss">Miss</option>
              <option value="penalty goal">Penalty Goal</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        ))}
      </div>

      {/* colours */}
      <h3 className="color-modal-header">Marker Colours</h3>
      <div className="color-modal-grid">
        {colorKeys.map((k)=>(
          <div key={k} className="team-details-modal-row">
            <span className="team-details-modal-label">{k}</span>
            <input 
              type="color"
              value={markerColors[k]?.fill ?? markerColors[k]}
              onChange={(e)=>{
                const v=e.target.value;
                setMarkerColors(p=>({
                  ...p,
                  [k]: typeof p[k]==="object" ? {...p[k],fill:v} : v
                }));
              }}
            />
          </div>
        ))}
      </div>

      <div className="team-details-modal-actions">
        <button
          className="StyledButton"
          onClick={()=>{
            localStorage.setItem("teamDetailsActionMapping",JSON.stringify(actionMapping));
            localStorage.setItem("teamDetailsMarkerColors",JSON.stringify(markerColors));
            Swal.fire({
              title: "Saved",
              text: "Settings saved.",
              icon: "success",
              background: 'var(--dark-card)',
              confirmButtonColor: 'var(--primary)',
            });
            onRequestClose();
          }}
        >
          Save
        </button>
        <button 
          className="StyledButton" 
          style={{ background: 'var(--gray-light)' }}
          onClick={onRequestClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

/* ─── Render‑type helper ───────────────────────────────────────────── */
function getRenderType(raw, map) {
  const a=(raw||"").toLowerCase().trim();
  if(a==="offensive mark"||a==="free")return"setplayscore";
  if(map[a])return map[a];
  if(/miss|wide|short|post/.test(a))return"miss";
  return a;
}

/* ─── PDF helper ───────────────────────────────────────────────────── */
async function downloadPDFHandler(setBusy, team) {
  setBusy(true);
  try{
    const el=document.getElementById("pdf-content");
    if(!el)throw new Error("Nothing to export");
    const cnv=await html2canvas(el,{scale:2});
    const img=cnv.toDataURL("image/png");
    const pdf=new jsPDF("l","mm","a4");
    const W=pdf.internal.pageSize.getWidth();
    const H=pdf.internal.pageSize.getHeight();
    pdf.setFillColor(15, 10, 27); // Dark background matching our theme
    pdf.rect(0,0,W,H,"F");
    const p=pdf.getImageProperties(img);
    pdf.addImage(img,"PNG",0,(H-(p.height*W)/p.width)/2,W,(p.height*W)/p.width);
    pdf.setFontSize(12); 
    pdf.setTextColor(230, 230, 250); // Light text
    pdf.text("scorelect.com",W-40,H-10);
    pdf.save(`${team}_shot_map.pdf`);
  }catch(e){ 
    Swal.fire({
      title: "Error",
      text: e.message,
      icon: "error",
      background: 'var(--dark-card)',
      confirmButtonColor: 'var(--primary)',
    }); 
  }
  setBusy(false);
}

/* ─── Main component ──────────────────────────────────────────────── */
export default function TeamDetails() {
  const { teamName } = useParams();
  const navigate      = useNavigate();
  const stageRef      = useRef(null);

  /* state */
  const [markerColors,setMarkerColors]=useState(
    JSON.parse(localStorage.getItem("teamDetailsMarkerColors")||"null")||fallbackColors
  );
  const [actionMapping,setActionMapping]=useState(
    JSON.parse(localStorage.getItem("teamDetailsActionMapping")||"null")||defaultMapping
  );
  const [allShots,setAllShots]=useState([]);
  const [shotsData,setShotsData]=useState([]);
  const [agg,setAgg]=useState({});
  const [filterOpt,setFilterOpt]=useState({players:[],actions:[]});
  const [applied,setApplied]=useState({player:"",action:""});
  const [selected,setSelected]=useState(null);
  const [showSettings,setShowSettings]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  /* scales */
  const xScale=canvas.width/pitchW;
  const yScale=canvas.height/pitchH;

  /* filtered list */
  const filtered=useMemo(()=>shotsData.filter(s=>{
    const pOK=applied.player ? (s.playerName||"").toLowerCase().includes(applied.player.toLowerCase()):true;
    const aOK=applied.action ? (s.action||"").toLowerCase().includes(applied.action.toLowerCase()):true;
    return pOK&&aOK;
  }),[shotsData,applied]);

  /* dynamic colours */
  const dynamic=useMemo(()=>({
    goal:markerColors.goal,
    point:markerColors.point,
    miss:markerColors.miss,
    setplayscore:{ fill:markerColors.setplayscore, stroke:"white" },
    setplaymiss:{ fill:markerColors.setplaymiss, stroke:"white" },
    "penalty goal":markerColors["penalty goal"],
    blocked:markerColors.blocked
  }),[markerColors]);

  const legendColors=useMemo(()=>({
    goal:dynamic.goal,
    point:dynamic.point,
    miss:dynamic.miss,
    setplayscore:dynamic.setplayscore.fill,
    setplaymiss:dynamic.setplaymiss.fill,
    "penalty goal":dynamic["penalty goal"],
    blocked:dynamic.blocked
  }),[dynamic]);

  /* ───── Fetch & prep shots */
  useEffect(()=>{
    (async()=>{
      try{
        setLoading(true);
        const snap=await getDoc(
          doc(firestore,"savedGames/w9ZkqaYVM3dKSqqjWHLDVyh5sVg2/games","All Shots GAA")
        );
        if(!snap.exists()) throw new Error("Dataset missing");
        const list=snap.data().gameData||[];
        setAllShots(list);
        const mine=list.filter(s=>(s.team||"").toLowerCase()===teamName.toLowerCase());
        if(!mine.length){
          Swal.fire({
            title: "No Data",
            text: `No shots for ${teamName}`,
            icon: "info",
            background: 'var(--dark-card)',
            confirmButtonColor: 'var(--primary)',
          }).then(()=>navigate(-1));
          return;
        }

        /* build display objects */
        const prepared=mine.map(s=>{
          const mirrored=translateShotToLeftSide(s,halfX);
          const { distMeters }=translateShotToOneSide(mirrored,halfX,goalX,goalY);
          return {
            ...s,
            distMeters,
            renderType:getRenderType(s.action,actionMapping)
          };
        });
        setShotsData(prepared);
      }catch(e){ setError(e.message); }
      finally{ setLoading(false); }
    })();
  },[teamName,navigate,actionMapping]);

  /* build dropdown opts */
  useEffect(()=>{
    const players=new Set(), actions=new Set();
    shotsData.forEach(s=>{
      if(s.playerName)players.add(s.playerName);
      if(s.action) actions.add(s.action);
    });
    setFilterOpt({players:Array.from(players),actions:Array.from(actions)});
  },[shotsData]);

  /* aggregate stats per team */
  useEffect(()=>{
    if(!allShots.length) return;
    const out={};
    allShots.forEach(s=>{
      const tm=s.team||"Unknown";
      if(!out[tm]) out[tm]={
        points:0,twoPointers:0,goals:0,offensiveMarks:0,
        frees:0,fortyFives:0,totalShots:0,successfulShots:0,
        totalFrees:0,successfulFrees:0,total45s:0,successful45s:0,misses:0
      };
      const a=(s.action||"").toLowerCase().trim();
      const rec=out[tm]; rec.totalShots++;

      const tr=translateShotToOneSide(
        translateShotToLeftSide(s,halfX),halfX,goalX,goalY
      );

      if(a==="point"){ rec.points++; rec.successfulShots++;
        if(tr.distMeters>=40) rec.twoPointers++;
      }
      if(a==="goal"||a==="penalty goal"){ rec.goals++; rec.successfulShots++; }
      if(/free/.test(a)){ rec.frees++; rec.totalFrees++; if(a==="free"){ rec.successfulShots++; rec.successfulFrees++; } }
      if(/45|fortyfive/.test(a)){ rec.fortyFives++; rec.total45s++; if(a==="45"||a==="fortyfive"){ rec.successfulShots++; rec.successful45s++; } }
    });
    setAgg(out);
  },[allShots]);

  /* shot‑details modal body */
  function shotDetails() {
    if(!selected) return null;
    const cat=getShotCategory(selected.action);
    const isGoal=cat==="goal";
    const dist=typeof selected.distMeters==="number"?selected.distMeters.toFixed(1):"N/A";
    return (
      <div className="team-details-modal-body">
        <div className="team-details-modal-row">
          <span className="team-details-modal-label">Action:</span>
          <span className="team-details-modal-value">{selected.action}</span>
        </div>
        <div className="team-details-modal-row">
          <span className="team-details-modal-label">Category:</span>
          <span className="team-details-modal-value">{cat}</span>
        </div>
        <div className="team-details-modal-row">
          <span className="team-details-modal-label">Distance (m):</span>
          <span className="team-details-modal-value">{dist}</span>
        </div>
        <div className="team-details-modal-row">
          <span className="team-details-modal-label">Foot:</span>
          <span className="team-details-modal-value">{selected.foot||"N/A"}</span>
        </div>
        <div className="team-details-modal-row">
          <span className="team-details-modal-label">Pressure:</span>
          <span className="team-details-modal-value">{selected.pressure||"N/A"}</span>
        </div>
        <div className="team-details-modal-row">
          <span className="team-details-modal-label">Position:</span>
          <span className="team-details-modal-value">{selected.position||"N/A"}</span>
        </div>
        <div className="team-details-modal-row">
          <span className="team-details-modal-label">{isGoal?"xG":"xP"}:</span>
          <span className="team-details-modal-value">
            {typeof(isGoal?selected.xGoals:selected.xPoints)==="number"
              ? (isGoal?selected.xGoals:selected.xPoints).toFixed(2)
              : "N/A"}
          </span>
        </div>
        <div className="team-details-modal-row">
          <span className="team-details-modal-label">xP_ADV:</span>
          <span className="team-details-modal-value">
            {typeof selected.xP_adv==="number"
              ? selected.xP_adv.toFixed(2):"N/A"}
          </span>
        </div>
      </div>
    );
  }

  /* ─── conditional UI guards */
  if(loading) return (
    <div className="PageContainer">
      <div className="team-details-loading">
        <div className="team-details-spinner"></div>
        <p>Loading team data...</p>
      </div>
    </div>
  );
  
  if(error) return (
    <div className="PageContainer">
      <div className="team-details-error">{error}</div>
    </div>
  );
  
  if(!filtered.length) return (
    <div className="PageContainer">
      <div className="team-details-error">No shots match the current filter criteria.</div>
    </div>
  );

  /* ─── MAIN JSX ───────────────────────────────────────────────────── */
  return (
    <div className="PageContainer">
      <h2 className="Title">{teamName} Shot Analysis</h2>

      {/* filters & controls */}
      <div className="Section">
        <div className="FiltersContainer">
          {/* player */}
          <div>
            <label className="FilterLabel" htmlFor="ply">
              <FaUser style={{ marginRight: '0.5rem' }} /> Player:
            </label>
            <select 
              id="ply" 
              className="Select"
              value={applied.player}
              onChange={e=>setApplied({...applied,player:e.target.value})}
            >
              <option value="">All Players</option>
              {filterOpt.players.map(p=>(
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          
          {/* action */}
          <div>
            <label className="FilterLabel" htmlFor="act">
              <FaFilter style={{ marginRight: '0.5rem' }} /> Action:
            </label>
            <select 
              id="act" 
              className="Select"
              value={applied.action}
              onChange={e=>setApplied({...applied,action:e.target.value})}
            >
              <option value="">All Actions</option>
              {filterOpt.actions.map(a=>(
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          
          {/* export */}
          <button 
            className="StyledButton"
            onClick={()=>downloadPDFHandler(setBusy,teamName)}
          >
            {busy ? "Downloading..." : (
              <><FaDownload style={{ marginRight: '0.5rem' }} /> Download PDF</>
            )}
          </button>
          
          {/* gear */}
          <div className="GearBox">
            <button 
              className="GearButton" 
              title="Settings" 
              onClick={()=>setShowSettings(true)}
            >
              <FaCog />
            </button>
          </div>
        </div>
      </div>

      {/* pitch & stats */}
      <div className="Section" id="pdf-content">
        <div className="PdfContentWrapper">
          <div className="PitchAndStatsContainer">
            {/* Konva half‑pitch */}
            <div className="stage-pitch-container">
              <Stage 
                ref={stageRef}
                width={xScale*(pitchW/2)}
                height={yScale*pitchH}
                style={{ 
                  border: "1px solid var(--primary)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--dark)"
                }}
              >
                {renderGAAPitch({
                  canvasSizeMain: canvas,
                  pitchColorState: "var(--dark)",
                  lightStripeColorState: "#228B22",
                  darkStripeColorState: "#006400",
                  lineColorState: "#fff",
                  xScale, yScale
                })}
                {renderOneSidePitchShots({
                  shots: filtered,
                  colors: dynamic,
                  xScale, yScale,
                  onShotClick: setSelected,
                  halfLineX: halfX,
                  goalX,
                  goalY,
                  actionMapping
                })}
                {renderLegendOneSideShots(
                  legendColors,
                  xScale*(pitchW/2),
                  yScale*pitchH
                )}
              </Stage>
            </div>

            {/* stats card */}
            <div className="StatsCard">
              <h3 className="StatsHeading">{teamName} Stats</h3>
              <p className="StatItem"><strong>Total Shots:</strong> {agg[teamName]?.totalShots||0}</p>
              <p className="StatItem"><strong>Successful:</strong> {agg[teamName]?.successfulShots||0}</p>
              <p className="StatItem"><strong>Points:</strong> {agg[teamName]?.points||0}</p>
              <p className="StatItem"><strong>Goals:</strong> {agg[teamName]?.goals||0}</p>
              <p className="StatItem"><strong>Misses:</strong> {agg[teamName]?.misses||0}</p>
              <p className="StatItem"><strong>Off. Marks:</strong> {agg[teamName]?.offensiveMarks||0}</p>
              <p className="StatItem"><strong>Frees:</strong> {agg[teamName]?.frees||0}</p>
              <p className="StatItem"><strong>45s:</strong> {agg[teamName]?.fortyFives||0}</p>
              <p className="StatItem"><strong>2‑Pointers (≥40 m):</strong> {agg[teamName]?.twoPointers||0}</p>
              <p className="StatItem">
                <strong>Avg Success:</strong>{" "}
                {(agg[teamName]?.totalShots
                  ? (agg[teamName].successfulShots/agg[teamName].totalShots).toFixed(2)
                  : "0.00")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* shot details */}
      {selected && (
        <Modal 
          isOpen={true} 
          onRequestClose={()=>setSelected(null)}
          className="team-details-modal-content"
          overlayClassName="team-details-modal-overlay"
          contentLabel="Shot Details"
        >
          <h2 className="team-details-modal-title">Shot Details</h2>
          {shotDetails()}
          <div className="team-details-modal-actions">
            <button 
              className="StyledButton" 
              style={{ background: 'var(--gray-light)' }}
              onClick={()=>setSelected(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* settings */}
      <SettingsModal
        isOpen={showSettings}
        onRequestClose={()=>setShowSettings(false)}
        actionMapping={actionMapping}
        setActionMapping={setActionMapping}
        markerColors={markerColors}
        setMarkerColors={setMarkerColors}
      />
    </div>
  );
}