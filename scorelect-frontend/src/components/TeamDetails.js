/***********************************************************************
 *  TeamDetails.jsx
 *  -----------------------------------------------------------
 *  Shows **one‑sided** team shot map with distances measured only to
 *  the left‑hand goal. Uses the same translate helpers as the player
 *  file, but keeps the x/y *un‑mirrored* so the Konva renderer can
 *  mirror each dot only once.
 *
 *  Dependencies: React 18, styled‑components, react‑konva, Konva 9,
 *  jspdf, html2canvas, SweetAlert2, Firebase v9 modular SDK.
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
  renderGAAPitch,
  renderOneSidePitchShots,
  renderLegendOneSideShots,
  translateShotToOneSide,
  translateShotToLeftSide,   // ★ newly imported
  getShotCategory
} from "./GAAPitchComponents";

/* ───────────────────────── Modal root */
Modal.setAppElement("#root");

/* ─── Styled UI helpers ─────────────────────────────────────────────── */
const PageContainer = styled.div`
  position: relative;
  color: #f0f0f0;
  background: #1c1c1c;
  min-height: 100vh;
  padding: 2rem;
`;
const Section = styled.section`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;
const Title = styled.h2`
  text-align: center;
  margin-bottom: 1rem;
  font-weight: 600;
  color: #ffc107;
`;
const FiltersContainer = styled.div`
  background: #3a3a3a;
  padding: 1rem;
  border-radius: 8px;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
`;
const FilterLabel = styled.label`
  color: #fff;
  font-weight: bold;
  margin-right: 0.5rem;
`;
const Select = styled.select`
  padding: 0.5rem;
  border-radius: 5px;
  border: 1px solid #777;
  background: #fff;
  color: #000;
  min-width: 150px;
  font-size: 0.9rem;
`;
const PitchAndStatsContainer = styled.div`
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
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
const StatItem = styled.p`
  margin: 0.25rem 0;
`;
const StyledButton = styled.button`
  background-color: #4f8ef7;
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 5px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  transition: background 0.3s;
  margin: 0 0.5rem;

  &:hover { background-color: #357ad2; }
`;
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
const PdfContentWrapper = styled.div`
  position: relative;
  background-color: #333;
  padding: 1rem;
`;

/* ─── Pitch metrics ─────────────────────────────────────────────────── */
const pitchW = 145;
const pitchH = 88;
const halfX  = pitchW / 2;   // 72.5 m
const goalX  = 0;            // always measure to left goal
const goalY  = pitchH / 2;   // 44 m
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

/* ─── Settings modal (unchanged) ────────────────────────────────────── */
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
    <Modal isOpen={isOpen} onRequestClose={onRequestClose}
           style={{
             content: {
               top:"50%",left:"50%",transform:"translate(-50%,-50%)",
               width:"600px",maxHeight:"80vh",padding:"30px",
               borderRadius:"10px",background:"#2e2a2a",color:"#fff",overflow:"auto"
             },
             overlay:{ backgroundColor:"rgba(0,0,0,0.5)",zIndex:9999 }
           }}
           contentLabel="Settings">
      <h2 style={{ marginTop: 0 }}>Settings</h2>

      {/* mapping */}
      <h3>Action Mapping</h3>
      {mappingKeys.map((k) => (
        <div key={k} style={{ display:"flex",justifyContent:"space-between",marginBottom:"0.5rem" }}>
          <span>{k}</span>
          <Select value={actionMapping[k]}
                  onChange={(e)=>setActionMapping({...actionMapping,[k]:e.target.value})}>
            <option value="setplayscore">Set‑Play Score</option>
            <option value="setplaymiss">Set‑Play Miss</option>
            <option value="goal">Goal</option>
            <option value="point">Point</option>
            <option value="miss">Miss</option>
            <option value="penalty goal">Penalty Goal</option>
            <option value="blocked">Blocked</option>
          </Select>
        </div>
      ))}

      {/* colours */}
      <h3 style={{ marginTop:"1.5rem" }}>Marker Colours</h3>
      {colorKeys.map((k)=>(
        <div key={k} style={{ display:"flex",justifyContent:"space-between",marginBottom:"0.5rem" }}>
          <span>{k}</span>
          <input type="color"
                 value={markerColors[k]?.fill ?? markerColors[k]}
                 onChange={(e)=>{
                   const v=e.target.value;
                   setMarkerColors(p=>({
                     ...p,
                     [k]: typeof p[k]==="object" ? {...p[k],fill:v} : v
                   }));
                 }}/>
        </div>
      ))}

      <div style={{ textAlign:"right", marginTop:"1rem" }}>
        <StyledButton
          onClick={()=>{
            localStorage.setItem("teamDetailsActionMapping",JSON.stringify(actionMapping));
            localStorage.setItem("teamDetailsMarkerColors",JSON.stringify(markerColors));
            Swal.fire("Saved","Settings saved.","success");
            onRequestClose();
          }}>Save</StyledButton>
        <StyledButton style={{ background:"#607d8b",marginLeft:"0.75rem" }}
                      onClick={onRequestClose}>Close</StyledButton>
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
    pdf.setFillColor(50,50,50); pdf.rect(0,0,W,H,"F");
    const p=pdf.getImageProperties(img);
    pdf.addImage(img,"PNG",0,(H-(p.height*W)/p.width)/2,W,(p.height*W)/p.width);
    pdf.setFontSize(12); pdf.setTextColor(255,255,255);
    pdf.text("scorelect.com",W-40,H-10);
    pdf.save(`${team}_shot_map.pdf`);
  }catch(e){ Swal.fire("Error",e.message,"error"); }
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
          Swal.fire("No Data",`No shots for ${teamName}`,"info").then(()=>navigate(-1));
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
      if(/miss|wide|short|post/.test(a)) rec.misses++;
      if(/offensive mark/.test(a)&&!/(wide|short|miss)/.test(a)){
        rec.offensiveMarks++; rec.successfulShots++;
      }
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
      <div style={{ lineHeight:"1.6" }}>
        <p><strong>Action:</strong> {selected.action}</p>
        <p><strong>Category:</strong> {cat}</p>
        <p><strong>Distance (m):</strong> {dist}</p>
        <p><strong>Foot:</strong> {selected.foot||"N/A"}</p>
        <p><strong>Pressure:</strong> {selected.pressure||"N/A"}</p>
        <p><strong>Position:</strong> {selected.position||"N/A"}</p>
        <p><strong>{isGoal?"xG":"xP"}:</strong>{" "}
          {typeof(isGoal?selected.xGoals:selected.xPoints)==="number"
            ? (isGoal?selected.xGoals:selected.xPoints).toFixed(2)
            : "N/A"}
        </p>
        <p><strong>xP_ADV:</strong> {typeof selected.xP_adv==="number"
          ? selected.xP_adv.toFixed(2):"N/A"}</p>
      </div>
    );
  }

  /* ─── conditional UI guards */
  if(loading) return <PageContainer><p style={{textAlign:"center"}}>Loading…</p></PageContainer>;
  if(error)   return <PageContainer><p style={{color:"red",textAlign:"center"}}>{error}</p></PageContainer>;
  if(!filtered.length) return <PageContainer><p style={{textAlign:"center"}}>No shots for this filter.</p></PageContainer>;

  /* ─── MAIN JSX ───────────────────────────────────────────────────── */
  return (
    <PageContainer>
      <Title>{teamName} Shot Analysis</Title>

      {/* filters & controls */}
      <Section>
        <FiltersContainer>
          {/* player */}
          <div>
            <FilterLabel htmlFor="ply">Player:</FilterLabel>
            <Select id="ply" value={applied.player}
                    onChange={e=>setApplied({...applied,player:e.target.value})}>
              <option value="">All Players</option>
              {filterOpt.players.map(p=>(
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
          {/* action */}
          <div>
            <FilterLabel htmlFor="act">Action:</FilterLabel>
            <Select id="act" value={applied.action}
                    onChange={e=>setApplied({...applied,action:e.target.value})}>
              <option value="">All Actions</option>
              {filterOpt.actions.map(a=>(
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </div>
          {/* export */}
          <StyledButton onClick={()=>downloadPDFHandler(setBusy,teamName)}>
            {busy?"Downloading…":"Download PDF"}
          </StyledButton>
          {/* gear */}
          <GearBox><GearButton title="Settings" onClick={()=>setShowSettings(true)}>⚙️</GearButton></GearBox>
        </FiltersContainer>
      </Section>

      {/* pitch & stats */}
      <Section id="pdf-content">
        <PdfContentWrapper>
          <PitchAndStatsContainer>
            {/* Konva half‑pitch */}
            <div style={{ textAlign:"center" }}>
              <Stage ref={stageRef}
                     width={xScale*(pitchW/2)}
                     height={yScale*pitchH}
                     style={{ border:"2px solid #444",borderRadius:"8px",background:"#111" }}>
                {renderGAAPitch({
                  canvasSizeMain:canvas,
                  pitchColorState:"#000",
                  lightStripeColorState:"#228B22",
                  darkStripeColorState:"#006400",
                  lineColorState:"#fff",
                  xScale,yScale
                })}
                {renderOneSidePitchShots({
                  shots:filtered,
                  colors:dynamic,
                  xScale,yScale,
                  onShotClick:setSelected,
                  halfLineX:halfX,
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
            <StatsCard>
              <StatsHeading>{teamName} Stats</StatsHeading>
              <StatItem><strong>Total Shots:</strong> {agg[teamName]?.totalShots||0}</StatItem>
              <StatItem><strong>Successful:</strong> {agg[teamName]?.successfulShots||0}</StatItem>
              <StatItem><strong>Points:</strong> {agg[teamName]?.points||0}</StatItem>
              <StatItem><strong>Goals:</strong> {agg[teamName]?.goals||0}</StatItem>
              <StatItem><strong>Misses:</strong> {agg[teamName]?.misses||0}</StatItem>
              <StatItem><strong>Off. Marks:</strong> {agg[teamName]?.offensiveMarks||0}</StatItem>
              <StatItem><strong>Frees:</strong> {agg[teamName]?.frees||0}</StatItem>
              <StatItem><strong>45s:</strong> {agg[teamName]?.fortyFives||0}</StatItem>
              <StatItem><strong>2‑Pointers (≥40 m):</strong> {agg[teamName]?.twoPointers||0}</StatItem>
              <StatItem>
                <strong>Avg Success:</strong>{" "}
                {(agg[teamName]?.totalShots
                  ? (agg[teamName].successfulShots/agg[teamName].totalShots).toFixed(2)
                  : "0.00")}
              </StatItem>
            </StatsCard>
          </PitchAndStatsContainer>
        </PdfContentWrapper>
      </Section>

      {/* shot details */}
      {selected&&(
        <Modal isOpen onRequestClose={()=>setSelected(null)}
               style={{
                 content:{
                   maxWidth:"500px",margin:"auto",padding:"20px",
                   borderRadius:"8px",background:"#2e2e2e",color:"#fff"
                 }
               }}>
          {shotDetails()}
          <div style={{ textAlign:"right",marginTop:"1rem" }}>
            <StyledButton style={{ background:"#607d8b" }}
                          onClick={()=>setSelected(null)}>Close</StyledButton>
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
        setMarkerColors={setMarkerColors}/>
    </PageContainer>
  );
}
