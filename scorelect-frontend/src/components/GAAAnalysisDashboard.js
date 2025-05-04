// src/components/GAAAnalysisDashboard.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import styled from 'styled-components';
import { Stage } from 'react-konva';
import Modal from 'react-modal';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Import pitch rendering & translation functions
import {
  renderLegendOneSideShots,
  renderOneSidePitchShots,
  translateShotToOneSide
} from './GAAPitchComponents';

// Environment-based API URL
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Pitch constants
const defaultPitchColor = '#000000';
const pitchWidth = 145;
const pitchHeight = 88;

// Default action-to-render mapping
const defaultMapping = {
  free: 'setplayscore',
  'free miss': 'setplaymiss',
  'free wide': 'setplaymiss',
  'free short': 'setplaymiss',
  fortyfive: 'setplayscore',
  'fortyfive wide': 'setplaymiss',
  'fortyfive short': 'setplaymiss'
};

// Fallback colors for markers
const fallbackColors = {
  goal: '#FFFF33',
  point: '#39FF14',
  miss: 'red',
  setplayscore: { fill: '#39FF14', stroke: 'white' },
  setplaymiss: { fill: 'red', stroke: 'white' },
  'penalty goal': '#FF8C00',
  blocked: 'orange'
};
const fallbackLegendColors = {
  goal: '#FFFF33',
  point: '#39FF14',
  miss: 'red',
  setplayscore: { fill: '#39FF14', stroke: 'white' },
  setplaymiss: { fill: 'red', stroke: 'white' },
  'penalty goal': '#FF8C00',
  blocked: 'orange'
};

// Styled components
const PageContainer = styled.div`
  background: #1c1a1a;
  min-height: 100vh;
  color: #ffc107;
  padding: 2rem;
  font-family: 'Roboto', sans-serif;
`;
const Header = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
  font-weight: 600;
  font-size: 2rem;
  letter-spacing: 1px;
`;
const ControlsBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #333;
  border-radius: 8px;
`;
const FilterSelect = styled.select`
  padding: 0.5rem;
  border-radius: 5px;
  border: 1px solid #777;
  background: #fff;
  color: #000;
  font-size: 1rem;
`;
const DownloadButton = styled.button`
  background-color: #4caf50;
  border: none;
  border-radius: 5px;
  color: #fff;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: background-color 0.3s ease;
  &:hover { background-color: #45a049; }
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
const RecalcButton = styled.button`
  background-color: #0069d9;
  border: none;
  border-radius: 5px;
  color: #fff;
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  transition: background-color 0.3s ease;
  &:hover { background-color: #005bb5; }
`;
const TilesContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
`;
const Tile = styled.div`
  background: #333;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  h5 { margin-bottom: 0.5rem; font-weight: 600; color: #fff; font-size: 1rem; }
  p  { font-size: 1rem; font-weight: bold; margin: 0; color: #ffc107; }
`;
const Section = styled.section`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
`;
const PitchSection = styled.section`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
`;
const StatsScrollContainer = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  flex: 1;
`;
const TeamStatsCard = styled.div`
  background: #333;
  border-radius: 8px;
  padding: 1rem;
  min-width: 220px;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  align-self: flex-start;
`;
const PdfContentWrapper = styled.div`
  position: relative;
  background-color: #333;
  padding: 1rem;
`;
const customModalStyles = {
  content: {
    top:'50%', left:'50%', right:'auto', bottom:'auto',
    transform:'translate(-50%,-50%)',
    width:'600px', maxHeight:'80vh',
    padding:'30px', borderRadius:'10px',
    backgroundColor:'#2e2a2a', color:'#fff', overflow:'auto'
  },
  overlay:{ backgroundColor:'rgba(0,0,0,0.75)', zIndex:9999 }
};

// Predictive "models" for xP and xG
const predictXP = shot => {
  const baseRates = {
    goal: 0.92,
    point: 0.72,
    free: 0.82,
    offensive_mark: 0.78,
    fortyfive: 0.55,
  };
  
  // Safely extract action - handle both string and object forms
  let actionStr = '';
  if (typeof shot.action === 'string') {
    actionStr = shot.action;
  } else if (shot.action && typeof shot.action === 'object') {
    // Try to get action string from object properties
    actionStr = shot.action.name || shot.action.type || shot.action.value || '';
  }
  
  const act = actionStr.toLowerCase().trim();
  let type = 'point';
  if (act==='goal' || act==='penalty goal') type = 'goal';
  else if (act.includes('free')) type = 'free';
  else if (act.includes('offensive mark')) type = 'offensive_mark';
  else if (act.includes('45') || act.includes('fortyfive')) type = 'fortyfive';

  const d = shot.distMeters||30;
  const distFactor = d<20?1:d<30?0.9:d<40?0.7:d<50?0.5:0.3;
  const pres = (shot.pressure||'none').toLowerCase();
  const presFactor = pres==='none'?1:pres==='low'?0.9:pres==='medium'?0.75:0.6;
  
  // Safe position handling - ensure position is a string before toLowerCase
  let posStr = '';
  if (typeof shot.position === 'string') {
    posStr = shot.position;
  } else if (shot.position && typeof shot.position === 'object') {
    // If position is an object with a type field, use that
    posStr = shot.position.type || 'forward';
  } else {
    // Default fallback
    posStr = 'forward';
  }
  
  const pos = posStr.toLowerCase();
  const posFactor = pos.includes('central')?1.1:pos.includes('wide')?0.85:1;

  let xp = (baseRates[type]||0.5) * distFactor * presFactor * posFactor;
  return Math.min(1, Math.max(0, xp));
};

const predictXG = shot => {
  const baseGoalProb = 0.3;
  const d = shot.distMeters||15;
  const distF = d<10?0.9:d<15?0.7:d<20?0.5:d<25?0.3:0.2;
  
  // Safely extract pressure
  const pres = (shot.pressure||'none').toLowerCase();
  const presF = pres==='none'?0.95:pres==='low'?0.8:pres==='medium'?0.6:0.4;
  
  // Safe position handling - ensure position is a string before toLowerCase
  let posStr = '';
  if (typeof shot.position === 'string') {
    posStr = shot.position;
  } else if (shot.position && typeof shot.position === 'object') {
    // If position is an object with a type field, use that
    posStr = shot.position.type || 'forward';
  } else {
    // Default fallback
    posStr = 'forward';
  }
  
  const pos = posStr.toLowerCase();
  const posF = pos.includes('central')?0.9:pos.includes('wide')?0.7:0.8;

  let xg = baseGoalProb * distF * presF * posF;
  return Math.min(1, Math.max(0, xg));
};

// Fill in any missing xP / xG on load or recalc
const calculateMissingMetrics = games =>
  games.map(g => ({
    ...g,
    gameData: (g.gameData||[]).map(s => {
      if (typeof s.xPoints !== 'number') {
        const t = translateShotToOneSide(s, pitchWidth/2, pitchWidth, pitchHeight/2);
        s.distMeters = t.distMeters;
        s.xPoints = predictXP(t);
        const act = (s.action||'').toLowerCase().trim();
        if (act==='goal' || act==='penalty goal') {
          s.xGoals = predictXG(t);
        }
        s.xP_adv = s.xPoints * 0.7 + (s.xGoals||0) * 0.3;
      }
      return s;
    })
  }));

// Flatten helper
function flattenShots(games = []) {
  return games.flatMap(g => g.gameData || []);
}
const getRenderType = (raw, map) =>
  map[raw?.toLowerCase().trim()] || raw?.toLowerCase().trim();


// Pitch view component
function PitchView({ allShots, xScale, yScale, halfLineX, goalX, goalY, onShotClick, colors, legendColors }) {
  return (
    <PitchSection>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Stage
          width={xScale * (pitchWidth / 2)}
          height={yScale * pitchHeight}
          style={{
            background: defaultPitchColor,
            border: '1px solid #444',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          {renderOneSidePitchShots({ shots: allShots, colors, xScale, yScale, onShotClick, halfLineX, goalX, goalY })}
          {renderLegendOneSideShots(legendColors, xScale * (pitchWidth / 2), yScale * pitchHeight)}
        </Stage>
      </div>
    </PitchSection>
  );
}

// PDF export handler
const downloadPDFHandler = async setIsDownloading => {
  setIsDownloading(true);
  const input = document.getElementById('pdf-content');
  if (!input) {
    Swal.fire('Error','Could not find content to export.','error');
    setIsDownloading(false);
    return;
  }
  try {
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l','mm','a4');
    const { width: w, height: h } = pdf.internal.pageSize;
    pdf.setFillColor(50,50,50);
    pdf.rect(0,0,w,h,'F');
    const props = pdf.getImageProperties(imgData);
    const imgW = w;
    const imgH = (props.height * imgW) / props.width;
    pdf.addImage(imgData, 'PNG', 0, (h - imgH) / 2, imgW, imgH);
    pdf.setFontSize(12);
    pdf.setTextColor(255,255,255);
    pdf.text('scorelect.com', w - 40, h - 10);
    pdf.save('dashboard.pdf');
  } catch {
    Swal.fire('Error','Failed to generate PDF.','error');
  }
  setIsDownloading(false);
};

// Error boundary
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={ hasError:false }; }
  static getDerivedStateFromError(){ return { hasError:true }; }
  componentDidCatch(e,i){ console.error('ErrorBoundary', e, i); }
  render(){ 
    return this.state.hasError
      ? <h2 style={{ color:'red', textAlign:'center' }}>Something went wrong.</h2>
      : this.props.children;
  }
}

// Settings modal for marker colors
function SettingsModal({ isOpen, onRequestClose, markerColors, setMarkerColors }) {
  const colorKeys = Object.keys(markerColors);
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      style={customModalStyles}
      contentLabel="Marker Color Settings"
    >
      <h2 style={{ marginTop: 0 }}>Marker Color Settings</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {colorKeys.map(key => (
          <div
            key={key}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ textTransform: 'capitalize' }}>{key}</span>
            <input
              type="color"
              value={
                typeof markerColors[key] === 'object'
                  ? markerColors[key].fill
                  : markerColors[key]
              }
              onChange={e => {
                const val = e.target.value;
                setMarkerColors(prev => ({
                  ...prev,
                  [key]:
                    typeof prev[key] === 'object'
                      ? { ...prev[key], fill: val }
                      : val
                }));
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'right', marginTop: '1rem' }}>
        <DownloadButton onClick={() => {
          localStorage.setItem('markerColors', JSON.stringify(markerColors));
          Swal.fire('Settings Saved', 'Your color settings have been saved.', 'success');
          onRequestClose();
        }}>
          Save
        </DownloadButton>
        <DownloadButton
          style={{ background: '#607d8b', marginLeft: '1rem' }}
          onClick={onRequestClose}
        >
          Close
        </DownloadButton>
      </div>
    </Modal>
  );
}

// Main dashboard component
export default function GAAAnalysisDashboard() {
  const { state } = useLocation();
  const { file, sport, filters } = state || {};
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // persistent user settings
  const [actionMapping, setActionMapping] = useState(
    () => JSON.parse(localStorage.getItem('actionMapping')) || defaultMapping
  );
   const [markerColors, setMarkerColors] = useState(() => {
       const stored = JSON.parse(localStorage.getItem('markerColors') || '{}');
       return {
         ...fallbackColors,
         ...stored
       };
     });

  // UI state
  const [isGearModalOpen, setIsGearModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    match: filters?.match || '',
    team: filters?.team || '',
    player: filters?.player || '',
    action: filters?.action || ''
  });
  const [filterOptions, setFilterOptions] = useState({
    matches: [], teams: [], players: [], actions: []
  });

  // data
  const [games, setGames] = useState([]);
  const [summary, setSummary] = useState({
    totalShots:0, totalGoals:0, totalPoints:0, totalMisses:0
  });
  const [teamAggregatedData, setTeamAggregatedData] = useState({});
  const [teamScorers, setTeamScorers] = useState({});
  const [selectedShot, setSelectedShot] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // pitch scaling
  const xScale = 6, yScale = 6;
  const halfLineX = pitchWidth / 2;
  const goalX = pitchWidth, goalY = pitchHeight / 2;

  // dynamic colors memo
  const dynamicColors = useMemo(() => ({
    goal: fallbackColors.goal,
    point: markerColors.point,
    miss: fallbackColors.miss,
    setplayscore: { fill: markerColors.setplayscore, stroke: 'white' },
    setplaymiss: fallbackColors.setplaymiss,
    'penalty goal': fallbackColors['penalty goal'],
    blocked: fallbackColors.blocked
  }), [markerColors]);

  const dynamicLegendColors = useMemo(() => ({
    goal: fallbackLegendColors.goal,
    point: markerColors.point,
    miss: fallbackLegendColors.miss,
    setplayscore: markerColors.setplayscore,
    setplaymiss: fallbackLegendColors['setplaymiss'],
    'penalty goal': fallbackLegendColors['penalty goal'],
    blocked: fallbackLegendColors.blocked
  }), [markerColors]);

  // INITIAL LOAD & BACK‑FILL xP/xG
  useEffect(() => {
    if (!file || sport !== 'GAA') {
      Swal.fire('No Data','Invalid or no GAA dataset found.','error')
        .then(() => navigate('/analysis'));
      return;
    }
    const filled = calculateMissingMetrics(file.games || []);
    setGames(filled);

    const m = new Set(), t = new Set(), p = new Set(), a = new Set();
    filled.forEach(g => {
      g.match && m.add(g.match);
      (g.gameData||[]).forEach(sh => {
        sh.team       && t.add(sh.team);
        sh.playerName && p.add(sh.playerName);
        sh.action     && a.add(sh.action);
      });
    });
    setFilterOptions({
      matches: Array.from(m),
      teams:   Array.from(t),
      players: Array.from(p),
      actions: Array.from(a)
    });
  }, [file, sport, navigate]);

  // APPLY FILTERS & SUMMARY
  useEffect(() => {
    let filtered = file.games || [];
    if (appliedFilters.match) {
      filtered = filtered.filter(g => g.match === appliedFilters.match);
    }
    ['team','player','action'].forEach(f => {
      if (appliedFilters[f]) {
        filtered = filtered.map(g => ({
          ...g,
          gameData: (g.gameData||[]).filter(sh => sh[f] === appliedFilters[f])
        }));
      }
    });
    filtered = filtered.filter(g => (g.gameData||[]).length);
    setGames(filtered);

    const shots = flattenShots(filtered);
    const s = { totalShots:0, totalGoals:0, totalPoints:0, totalMisses:0 };
    shots.forEach(sh => {
      s.totalShots++;
      const act = (sh.action||'').toLowerCase().trim();
      if (act==='goal'||act==='penalty goal') s.totalGoals++;
      else if (act==='point') s.totalPoints++;
      else if (/miss|wide|short|blocked|post/.test(act)) s.totalMisses++;
    });
    setSummary(s);
  }, [file, appliedFilters]);

  // MAP SHOTS TO RENDER TYPES
  const shotsWithRenderType = useMemo(
    () => flattenShots(games).map(sh => ({
      ...sh,
      renderType: getRenderType(sh.action, actionMapping)
    })),
    [games, actionMapping]
  );

  // AGGREGATED TEAM DATA
  const aggregatedData = useMemo(() => {
    const agg = {}, scorerMap = {}, distAcc = {};
    flattenShots(games).forEach(sh => {
      const team = sh.team || 'Unknown';
      if (!agg[team]) {
        agg[team] = {
          totalShots:0, successfulShots:0, points:0, goals:0, misses:0,
          freeAttempts:0, freeScored:0,
          offensiveMarkAttempts:0, offensiveMarkScored:0,
          fortyFiveAttempts:0, fortyFiveScored:0,
          twoPointerAttempts:0, twoPointerScored:0
        };
        distAcc[team] = 0;
        scorerMap[team] = {};
      }
      agg[team].totalShots++;
      const tShot = translateShotToOneSide(sh, halfLineX, goalX, goalY);
      distAcc[team] += tShot.distMeters;

      const act = (sh.action||'').toLowerCase().trim();
      if (act==='goal'||act==='penalty goal') {
        agg[team].goals++;
        agg[team].successfulShots++;
        const name = sh.playerName||'NoName';
        scorerMap[team][name] = scorerMap[team][name] || {goals:0,points:0};
        scorerMap[team][name].goals++;
      } else if (act==='point') {
        agg[team].points++;
        agg[team].successfulShots++;
        const name = sh.playerName||'NoName';
        scorerMap[team][name] = scorerMap[team][name] || {goals:0,points:0};
        scorerMap[team][name].points++;
      } else if (act==='offensive mark') {
        agg[team].offensiveMarkAttempts++;
        agg[team].offensiveMarkScored++;
        agg[team].successfulShots++;
      }
      if (act.startsWith('free')) {
        agg[team].freeAttempts++;
        if (act==='free') {
          agg[team].freeScored++;
          agg[team].successfulShots++;
        }
      }
      if (act.startsWith('45')||act.startsWith('forty')) {
        agg[team].fortyFiveAttempts++;
        if (act==='45'||act==='fortyfive') {
          agg[team].fortyFiveScored++;
          agg[team].successfulShots++;
        }
      }
      if (/miss|wide|short|blocked|post/.test(act)) {
        agg[team].misses++;
      }
      const eligible = ['point','free','offensive mark','45','fortyfive'];
      if (eligible.includes(act) && tShot.distMeters >= 40) {
        agg[team].twoPointerAttempts++;
        if (/point|free|offensive mark|45|fortyfive/.test(act)) {
          agg[team].twoPointerScored++;
        }
      }
    });
    Object.keys(agg).forEach(team => {
      agg[team].avgDistance = agg[team].totalShots > 0
        ? (distAcc[team] / agg[team].totalShots).toFixed(2)
        : '0.00';
    });
    return { aggregator: agg, scorersMap: scorerMap };
  }, [games, halfLineX, goalX, goalY]);

  useEffect(() => {
    setTeamAggregatedData(aggregatedData.aggregator);
    setTeamScorers(aggregatedData.scorersMap);
  }, [aggregatedData]);

  // RECALC xP/xG
  const handleRecalculate = async () => {
    try {
      const uid = currentUser?.uid;
      if (!uid) throw new Error('Not logged in');

      try {
        const payload = {
          user_id: uid,
          training_dataset: 'GAA All Shots',
          target_dataset: file.datasetName || 'DefaultDataset'
        };
        const res = await axios.post(`${BASE_API_URL}/recalculate-target-xpoints`, payload);
        if (res.data.success) {
          Swal.fire('Recalculation Complete','xP/xG updated via server.','success');
          const load = await axios.post(`${BASE_API_URL}/load-games`, { uid });
          const updated = load.data.filter(g => g.datasetName === file.datasetName);
          setGames(updated);
          return;
        }
      } catch (_) {
        console.warn('Server recalc failed; falling back to client-side');
      }

      const locally = calculateMissingMetrics(games);
      setGames(locally);
      const shots = flattenShots(locally);
      setSummary({
        totalShots: shots.length,
        totalGoals: shots.filter(s => /goal/.test((s.action||'').toLowerCase())).length,
        totalPoints: shots.filter(s => (s.action||'').toLowerCase()==='point').length,
        totalMisses: shots.filter(s => /miss|wide|short|blocked|post/.test((s.action||'').toLowerCase())).length
      });
      Swal.fire('Recalculation Complete','xP/xG updated','success');

    } catch (e) {
      console.error(e);
      Swal.fire('Error','Recalculation failed.','error');
    }
  };

  // SHOT CLICK HANDLER
  const handleShotClick = shot => {
    setSelectedShot(translateShotToOneSide(shot, halfLineX, goalX, goalY));
  };

  // RENDER SELECTED SHOT DETAILS
  function renderSelectedShotDetails() {
    if (!selectedShot) return null;
    return (
      <div style={{ lineHeight:'1.6' }}>
        <h2 style={{ color:'#ffc107', marginBottom:'1rem' }}>Shot Details</h2>
        <p><strong>Team:</strong> {selectedShot.team || 'N/A'}</p>
        <p><strong>Player:</strong> {selectedShot.playerName || 'N/A'}</p>
        <p><strong>Minute:</strong> {selectedShot.minute || 'N/A'}</p>
        <p><strong>Action:</strong> {selectedShot.action || 'N/A'}</p>
        <p><strong>Distance:</strong> {selectedShot.distMeters?.toFixed(1) || 'N/A'} m</p>
        <p><strong>Foot:</strong> {selectedShot.foot || 'N/A'}</p>
        <p><strong>Pressure:</strong> {selectedShot.pressure || 'N/A'}</p>
        <p><strong>Position:</strong> {selectedShot.position || 'N/A'}</p>
        <p><strong>xP:</strong> {typeof selectedShot.xPoints === 'number' ? selectedShot.xPoints.toFixed(2) : 'N/A'}</p>
        <p><strong>xP_ADV:</strong> {typeof selectedShot.xP_adv === 'number' ? selectedShot.xP_adv.toFixed(2) : 'N/A'}</p>
      </div>
    );
  }

  const formatCategory = (a,s) => `${a} (${s} Scored)`;

  return (
    <ErrorBoundary>
      <PageContainer>
        <Header>GAA Analysis Dashboard</Header>

        <ControlsBar>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <FilterSelect
              value={appliedFilters.match}
              onChange={e => setAppliedFilters(prev => ({ ...prev, match: e.target.value }))}
            >
              <option value="">All Matches</option>
              {filterOptions.matches.map(m => <option key={m} value={m}>{m}</option>)}
            </FilterSelect>
            <FilterSelect
              value={appliedFilters.team}
              onChange={e => setAppliedFilters(prev => ({ ...prev, team: e.target.value }))}
            >
              <option value="">All Teams</option>
              {filterOptions.teams.map(t => <option key={t} value={t}>{t}</option>)}
            </FilterSelect>
            <FilterSelect
              value={appliedFilters.player}
              onChange={e => setAppliedFilters(prev => ({ ...prev, player: e.target.value }))}
            >
              <option value="">All Players</option>
              {filterOptions.players.map(p => <option key={p} value={p}>{p}</option>)}
            </FilterSelect>
            <FilterSelect
              value={appliedFilters.action}
              onChange={e => setAppliedFilters(prev => ({ ...prev, action: e.target.value }))}
            >
              <option value="">All Actions</option>
              {filterOptions.actions.map(a => <option key={a} value={a}>{a}</option>)}
            </FilterSelect>
          </div>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <DownloadButton onClick={() => downloadPDFHandler(setIsDownloading)}>
              {isDownloading ? 'Downloading PDF…' : 'Download PDF'}
            </DownloadButton>
            <GearBox>
              <GearButton onClick={() => setIsGearModalOpen(true)} title="Settings">⚙️</GearButton>
            </GearBox>
          </div>
        </ControlsBar>

        <Section>
          <TilesContainer>
            <Tile><h5>Total Shots</h5><p>{summary.totalShots}</p></Tile>
            <Tile><h5>Total Goals</h5><p>{summary.totalGoals}</p></Tile>
            <Tile><h5>Total Points</h5><p>{summary.totalPoints}</p></Tile>
            <Tile><h5>Total Misses</h5><p>{summary.totalMisses}</p></Tile>
          </TilesContainer>
        </Section>

        <Section id="pdf-content">
          <PdfContentWrapper>
            <div style={{ display:'flex', gap:'2rem' }}>
              <div style={{ flexShrink:0 }}>
                <PitchView
                  allShots={shotsWithRenderType}
                  xScale={xScale}
                  yScale={yScale}
                  halfLineX={halfLineX}
                  goalX={goalX}
                  goalY={goalY}
                  onShotClick={handleShotClick}
                  colors={dynamicColors}
                  legendColors={dynamicLegendColors}
                />
              </div>
              <StatsScrollContainer>
                {Object.entries(teamAggregatedData).map(([team, stats]) => (
                  <TeamStatsCard key={team}>
                    <h3 style={{ color:'#fff' }}>{team} Stats</h3>
                    <p>Total Shots: {stats.totalShots}</p>
                    <p>Successful Shots: {stats.successfulShots}</p>
                    <p>Points: {stats.points}</p>
                    <p>Goals: {stats.goals}</p>
                    <p>Misses: {stats.misses}</p>
                    <p>Offensive Marks: {formatCategory(stats.offensiveMarkAttempts, stats.offensiveMarkScored)}</p>
                    <p>Frees: {formatCategory(stats.freeAttempts, stats.freeScored)}</p>
                    <p>45s: {formatCategory(stats.fortyFiveAttempts, stats.fortyFiveScored)}</p>
                    <p>2‑Pointers: {formatCategory(stats.twoPointerAttempts, stats.twoPointerScored)}</p>
                    <p>Avg Distance (m): {stats.avgDistance}</p>
                    <h4 style={{ color:'#fff', marginTop:'1rem' }}>Scorers</h4>
                    {Object.entries(teamScorers[team]||{}).length === 0
                      ? <p>No scorers found</p>
                      : Object.entries(teamScorers[team]).map(([p, v]) => (
                          <p key={p} style={{ margin:0 }}>{p}: {v.goals}g, {v.points}p</p>
                        ))
                    }
                  </TeamStatsCard>
                ))}
              </StatsScrollContainer>
            </div>
          </PdfContentWrapper>
        </Section>

        <div style={{ textAlign:'center', margin:'1rem 0' }}>
          <RecalcButton onClick={handleRecalculate}>Recalculate xP/xG</RecalcButton>
        </div>

        <Modal
          isOpen={!!selectedShot}
          onRequestClose={() => setSelectedShot(null)}
          style={customModalStyles}
          contentLabel="Shot Details"
        >
          {renderSelectedShotDetails()}
          <div style={{ textAlign:'right', marginTop:'1rem' }}>
            <RecalcButton style={{ backgroundColor:'#444' }} onClick={() => setSelectedShot(null)}>
              Close
            </RecalcButton>
          </div>
        </Modal>

        {/* Settings modal invocation */}
        <SettingsModal
          isOpen={isGearModalOpen}
          onRequestClose={() => setIsGearModalOpen(false)}
          markerColors={markerColors}
          setMarkerColors={setMarkerColors}
        />
      </PageContainer>
    </ErrorBoundary>
  );
}
