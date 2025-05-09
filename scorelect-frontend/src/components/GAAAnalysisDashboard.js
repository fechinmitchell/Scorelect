import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
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

// Import icons
import { 
  FaFilter, 
  FaDownload, 
  FaCog, 
  FaChartLine, 
  FaSearch,
  FaHistory,
  FaCalculator
} from 'react-icons/fa';

// Import our new CSS
import './GAAAnalysisDashboard.css';

// Environment-based API URL
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Pitch constants
const defaultPitchColor = '#0F0A1B'; // Dark background to match theme
const pitchWidth = 145;
const pitchHeight = 88;

// Default action-to-render mapping
const defaultMapping = {
  'free': 'setplayscore',
  'offensive mark': 'setplayscore',
  'offensive mark wide': 'setplaymiss',  // Added this line for offensive mark wide
  'offensive mark miss': 'setplaymiss',  // Also adding this variant
  'free miss': 'setplaymiss',
  'free wide': 'setplaymiss',
  'free short': 'setplaymiss',
  'fortyfive': 'setplayscore',
  'fortyfive wide': 'setplaymiss',
  'fortyfive short': 'setplaymiss',
  'wide': 'miss',
  'miss': 'miss',
  'shot wide': 'miss',
  'goal miss': 'miss',
  'short': 'miss',
  'fortyfive post': 'miss',
  'blocked': 'miss',
  'post': 'miss',
  'sideline wide': 'miss',
  'offensive mark short': 'miss',
  'pen miss': 'miss'

};

// Fallback colors for markers
const fallbackColors = {
  goal: 'var(--goal-color)',
  point: 'var(--point-color)',
  miss: 'var(--danger)',
  setplayscore: { fill: 'var(--point-color)', stroke: 'white' },
  setplaymiss: { fill: 'var(--danger)', stroke: 'white' },
  'penalty goal': 'var(--penalty-color)',
  blocked: 'var(--blocked-color)'
};

const fallbackLegendColors = {
  goal: 'var(--goal-color)',
  point: 'var(--point-color)',
  miss: 'var(--danger)',
  setplayscore: { fill: 'var(--point-color)', stroke: 'white' },
  setplaymiss: { fill: 'var(--danger)', stroke: 'white' },
  'penalty goal': 'var(--penalty-color)',
  blocked: 'var(--blocked-color)'
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
    <div className="gaa-pitch-container">
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Stage
          width={xScale * (pitchWidth / 2)}
          height={yScale * pitchHeight}
          style={{
            background: defaultPitchColor,
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          {renderOneSidePitchShots({ shots: allShots, colors, xScale, yScale, onShotClick, halfLineX, goalX, goalY })}
          {renderLegendOneSideShots(legendColors, xScale * (pitchWidth / 2), yScale * pitchHeight)}
        </Stage>
      </div>
    </div>
  );
}

// PDF export handler
const downloadPDFHandler = async setIsDownloading => {
  setIsDownloading(true);
  const input = document.getElementById('pdf-content');
  if (!input) {
    Swal.fire({
      title: 'Error',
      text: 'Could not find content to export.',
      icon: 'error',
      background: 'var(--dark-card)',
      confirmButtonColor: 'var(--primary)',
    });
    setIsDownloading(false);
    return;
  }
  try {
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l','mm','a4');
    const { width: w, height: h } = pdf.internal.pageSize;
    pdf.setFillColor(15, 10, 27); // Using --dark variable color
    pdf.rect(0,0,w,h,'F');
    const props = pdf.getImageProperties(imgData);
    const imgW = w;
    const imgH = (props.height * imgW) / props.width;
    pdf.addImage(imgData, 'PNG', 0, (h - imgH) / 2, imgW, imgH);
    pdf.setFontSize(12);
    pdf.setTextColor(230, 230, 250); // Using --light variable color
    pdf.text('scorelect.com', w - 40, h - 10);
    pdf.save('dashboard.pdf');
  } catch (error) {
    console.error(error);
    Swal.fire({
      title: 'Error',
      text: 'Failed to generate PDF.',
      icon: 'error',
      background: 'var(--dark-card)',
      confirmButtonColor: 'var(--primary)',
    });
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
      ? <div className="gaa-error">
          <h2>Something went wrong loading the dashboard.</h2>
          <p>Please try refreshing the page.</p>
        </div>
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
      className="gaa-modal-content"
      overlayClassName="gaa-modal-overlay"
      contentLabel="Marker Color Settings"
    >
      <h2 className="gaa-modal-title">Marker Color Settings</h2>
      <div className="gaa-modal-body">
        {colorKeys.map(key => (
          <div
            key={key}
            className="gaa-stat-row"
          >
            <span className="gaa-stat-label" style={{ textTransform: 'capitalize' }}>{key}</span>
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
      <div className="gaa-modal-actions">
        <button 
          className="gaa-button primary"
          onClick={() => {
            localStorage.setItem('markerColors', JSON.stringify(markerColors));
            Swal.fire({
              title: 'Settings Saved',
              text: 'Your color settings have been saved.',
              icon: 'success',
              background: 'var(--dark-card)',
              confirmButtonColor: 'var(--primary)',
            });
            onRequestClose();
          }}
        >
          Save
        </button>
        <button
          className="gaa-button gaa-close-btn"
          onClick={onRequestClose}
        >
          Close
        </button>
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

  // Fix for dynamicColors to ensure consistent object structure
  const dynamicColors = useMemo(() => ({
    goal: markerColors.goal || fallbackColors.goal,
    point: markerColors.point || fallbackColors.point,
    miss: markerColors.miss || fallbackColors.miss,
    setplayscore: { 
      fill: markerColors.setplayscore?.fill || fallbackColors.setplayscore.fill, 
      stroke: 'white' 
    },
    setplaymiss: { 
      fill: typeof markerColors.setplaymiss === 'object' 
        ? markerColors.setplaymiss.fill 
        : markerColors.setplaymiss || fallbackColors.setplaymiss.fill,
      stroke: 'white'
    },
    'penalty goal': markerColors['penalty goal'] || fallbackColors['penalty goal'],
    blocked: markerColors.blocked || fallbackColors.blocked
  }), [markerColors]);

  const dynamicLegendColors = useMemo(() => ({
    goal: markerColors.goal || fallbackLegendColors.goal,
    point: markerColors.point || fallbackLegendColors.point,
    miss: markerColors.miss || fallbackLegendColors.miss,
    setplayscore: { 
      fill: markerColors.setplayscore?.fill || fallbackLegendColors.setplayscore.fill,
      stroke: 'white' 
    },
    setplaymiss: { 
      fill: typeof markerColors.setplaymiss === 'object' 
        ? markerColors.setplaymiss.fill 
        : markerColors.setplaymiss || fallbackLegendColors.setplaymiss.fill,
      stroke: 'white'
    },
    'penalty goal': markerColors['penalty goal'] || fallbackLegendColors['penalty goal'],
    blocked: markerColors.blocked || fallbackLegendColors.blocked
  }), [markerColors]);

  // INITIAL LOAD & BACK‑FILL xP/xG
  useEffect(() => {
    if (!file || sport !== 'GAA') {
      Swal.fire({
        title: 'No Data',
        text: 'Invalid or no GAA dataset found.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      }).then(() => navigate('/analysis'));
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
    let filtered = file?.games || [];
    if (appliedFilters.match) {
      filtered = filtered.filter(g => g.match === appliedFilters.match);
    }
    ['team','player','action'].forEach(f => {
      if (appliedFilters[f]) {
        filtered = filtered.map(g => ({
          ...g,
          gameData: (g.gameData||[]).filter(sh =>
            f === 'player'
              ? sh.playerName === appliedFilters.player    // compare to the real field
              : sh[f] === appliedFilters[f]
          )
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
      const name = sh.playerName||'NoName';
  
          if (act==='goal'||act==='penalty goal') {
        agg[team].goals++;
        agg[team].successfulShots++;
        // Add successful goal to scorer
        if (name) {
          scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0};
          scorerMap[team][name].goals++;
        }
      } else if (act==='point') {
        agg[team].points++;
        agg[team].successfulShots++;
        // Add successful point to scorer
        if (name) {
          scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0};
          scorerMap[team][name].points++;
        }
      } else if (act==='offensive mark') {
        agg[team].offensiveMarkAttempts++;
        agg[team].offensiveMarkScored++;
        agg[team].successfulShots++;
        // Add successful offensive mark as a point for the scorer
        if (name) {
          scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0};
          scorerMap[team][name].points++;
        }
      }
      
      if (act.startsWith('free')) {
        agg[team].freeAttempts++;
        if (act==='free') {
          agg[team].freeScored++;
          agg[team].successfulShots++;
          // Add successful free as a point for the scorer
          if (name) {
            scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0};
            scorerMap[team][name].points++;
          }
        }
      }
      
      if (act.startsWith('45')||act.startsWith('forty')) {
        agg[team].fortyFiveAttempts++;
        if (act==='45'||act==='fortyfive') {
          agg[team].fortyFiveScored++;
          agg[team].successfulShots++;
          // Add successful 45/fortyfive as a point for the scorer
          if (name) {
            scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0};
            scorerMap[team][name].points++;
          }
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
          // Two-pointers are already counted above, no need to double-count
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
          Swal.fire({
            title: 'Recalculation Complete',
            text: 'xP/xG updated via server.',
            icon: 'success',
            background: 'var(--dark-card)',
            confirmButtonColor: 'var(--primary)',
          });
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
      Swal.fire({
        title: 'Recalculation Complete',
        text: 'xP/xG updated',
        icon: 'success',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });

    } catch (e) {
      console.error(e);
      Swal.fire({
        title: 'Error',
        text: 'Recalculation failed.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
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
      <div>
        <h2 className="gaa-modal-title">Shot Details</h2>
        <div className="gaa-modal-body">
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">Team:</span>
            <span className="gaa-stat-value">{selectedShot.team || 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">Player:</span>
            <span className="gaa-stat-value">{selectedShot.playerName || 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">Minute:</span>
            <span className="gaa-stat-value">{selectedShot.minute || 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">Action:</span>
            <span className="gaa-stat-value">{selectedShot.action || 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">Distance:</span>
            <span className="gaa-stat-value">{selectedShot.distMeters?.toFixed(1) || 'N/A'} m</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">Foot:</span>
            <span className="gaa-stat-value">{selectedShot.foot || 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">Pressure:</span>
            <span className="gaa-stat-value">{selectedShot.pressure || 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">Position:</span>
            <span className="gaa-stat-value">{selectedShot.position || 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">xP:</span>
            <span className="gaa-stat-value">{typeof selectedShot.xPoints === 'number' ? selectedShot.xPoints.toFixed(2) : 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">xP_ADV:</span>
            <span className="gaa-stat-value">{typeof selectedShot.xP_adv === 'number' ? selectedShot.xP_adv.toFixed(2) : 'N/A'}</span>
          </div>
        </div>
      </div>
    );
  }

  const formatCategory = (a,s) => `${a} (${s} Scored)`;

  return (
    <ErrorBoundary>
      <div className="gaa-dashboard">
        <div className="gaa-dashboard-header">
          <h1>GAA Analysis Dashboard</h1>
        </div>

        <div className="gaa-controls-bar">
          <div className="gaa-controls-group">
            <select
              className="gaa-filter-select"
              value={appliedFilters.match}
              onChange={e => setAppliedFilters(prev => ({ ...prev, match: e.target.value }))}
            >
              <option value="">All Matches</option>
              {filterOptions.matches.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              className="gaa-filter-select"
              value={appliedFilters.team}
              onChange={e => setAppliedFilters(prev => ({ ...prev, team: e.target.value }))}
            >
              <option value="">All Teams</option>
              {filterOptions.teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="gaa-filter-select"
              value={appliedFilters.player}
              onChange={e => setAppliedFilters(prev => ({ ...prev, player: e.target.value }))}
            >
              <option value="">All Players</option>
              {filterOptions.players.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              className="gaa-filter-select"
              value={appliedFilters.action}
              onChange={e => setAppliedFilters(prev => ({ ...prev, action: e.target.value }))}
            >
              <option value="">All Actions</option>
              {filterOptions.actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="gaa-controls-group">
            <button 
              className="gaa-button primary"
              onClick={() => downloadPDFHandler(setIsDownloading)}
            >
              {isDownloading ? 'Downloading...' : <>
                <FaDownload style={{ marginRight: '0.5rem' }} /> Download PDF
              </>}
            </button>
            <div className="gaa-gear-box">
              <button 
                className="gaa-button icon" 
                onClick={() => setIsGearModalOpen(true)}
                title="Settings"
              >
                <FaCog />
              </button>
            </div>
          </div>
        </div>

        <div className="gaa-summary-section">
          <div className="gaa-tiles-container">
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Total Shots</h5>
              <p className="gaa-tile-value">{summary.totalShots}</p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Total Goals</h5>
              <p className="gaa-tile-value">{summary.totalGoals}</p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Total Points</h5>
              <p className="gaa-tile-value">{summary.totalPoints}</p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Total Misses</h5>
              <p className="gaa-tile-value">{summary.totalMisses}</p>
            </div>
          </div>
        </div>

        <div id="pdf-content">
          <div className="gaa-main-content">
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
            
            <div className="gaa-stats-container">
              <div className="gaa-stats-scroll">
                {Object.entries(teamAggregatedData).map(([team, stats]) => (
                  <div className="gaa-team-card" key={team}>
                    <h3 className="gaa-team-header">{team} Stats</h3>
                    
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Total Shots:</span>
                      <span className="gaa-stat-value">{stats.totalShots}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Successful Shots:</span>
                      <span className="gaa-stat-value">{stats.successfulShots}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Points:</span>
                      <span className="gaa-stat-value">{stats.points}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Goals:</span>
                      <span className="gaa-stat-value">{stats.goals}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Misses:</span>
                      <span className="gaa-stat-value">{stats.misses}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Offensive Marks:</span>
                      <span className="gaa-stat-value">{formatCategory(stats.offensiveMarkAttempts, stats.offensiveMarkScored)}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Frees:</span>
                      <span className="gaa-stat-value">{formatCategory(stats.freeAttempts, stats.freeScored)}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">45s:</span>
                      <span className="gaa-stat-value">{formatCategory(stats.fortyFiveAttempts, stats.fortyFiveScored)}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">2‑Pointers:</span>
                      <span className="gaa-stat-value">{formatCategory(stats.twoPointerAttempts, stats.twoPointerScored)}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Avg Distance (m):</span>
                      <span className="gaa-stat-value">{stats.avgDistance}</span>
                    </div>
                    
                    <h4 className="gaa-scorers-title">Scorers</h4>
                    {Object.entries(teamScorers[team]||{}).length === 0
                      ? <p>No scorers found</p>
                      : Object.entries(teamScorers[team]).map(([p, v]) => (
                          <div key={p} className="gaa-scorer-item">
                            {p}: {v.goals}g, {v.points}p
                          </div>
                        ))
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="gaa-recalc-container">
          <button 
            className="gaa-recalc-button"
            onClick={handleRecalculate}
          >
            <FaCalculator style={{ marginRight: '0.5rem' }} /> Recalculate xP/xG
          </button>
        </div>

        {/* Shot Details Modal */}
        <Modal
          isOpen={!!selectedShot}
          onRequestClose={() => setSelectedShot(null)}
          className="gaa-modal-content"
          overlayClassName="gaa-modal-overlay"
          contentLabel="Shot Details"
        >
          {renderSelectedShotDetails()}
          <div className="gaa-modal-actions">
            <button 
              className="gaa-button gaa-close-btn" 
              onClick={() => setSelectedShot(null)}
            >
              Close
            </button>
          </div>
        </Modal>

        {/* Settings modal invocation */}
        <SettingsModal
          isOpen={isGearModalOpen}
          onRequestClose={() => setIsGearModalOpen(false)}
          markerColors={markerColors}
          setMarkerColors={setMarkerColors}
        />
      </div>
    </ErrorBoundary>
  );
}