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
  'offensive mark wide': 'setplaymiss',
  'offensive mark miss': 'setplaymiss',
  'free miss': 'setplaymiss',
  'free wide': 'setplaymiss',
  'free short': 'setplaymiss',
  'fortyfive': 'setplayscore',
  '45': 'setplayscore',
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

// Two-pointer logic functions
const calculateDistanceFromGoalLine = (x, y, pitchWidth = 145, pitchHeight = 88) => {
  // Goal line is at x = pitchWidth (145m)
  // Goal center is at y = pitchHeight/2 (44m)
  const goalLineX = pitchWidth;
  const goalCenterY = pitchHeight / 2;
  
  // Calculate distance from the shot position to goal line center
  const deltaX = goalLineX - x;
  const deltaY = Math.abs(goalCenterY - y);
  
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};

const calculateTwoPointerValue = (shot, pitchWidth = 145, pitchHeight = 88) => {
  const action = (shot.action || '').toString().toLowerCase().trim();
  
  // Goals are worth 3 points
  if (action === 'goal' || action === 'penalty goal') {
    return 3;
  }
  
  // Check if it's a scoring shot
  const scoringActions = ['point', 'free', 'offensive mark', '45', 'fortyfive'];
  const isScoringShot = scoringActions.some(act => action.includes(act));
  if (!isScoringShot) return 1; // Not a scoring shot, default to 1
  
  // Check if it's a 45 - always 1 point
  const isFrom45 = action.includes('45') || action.includes('fortyfive');
  if (isFrom45) return 1;
  
  // Use the already calculated distMeters if available
  let distanceFromGoal;
  if (shot.distMeters) {
    distanceFromGoal = shot.distMeters;
  } else {
    // If no distMeters, we need to translate first then calculate
    const translatedShot = translateShotToOneSide(shot, pitchWidth/2, pitchWidth, pitchHeight/2);
    distanceFromGoal = translatedShot.distMeters;
  }
  
  // Must be at or outside 40m arc
  const isAtOrOutsideArc = distanceFromGoal >= 40;
  
  // Check if touched in flight
  const touchedInFlight = shot.touchedInFlight || false;
  
  // Apply two-pointer logic for points and frees (excluding 45s)
  if (isAtOrOutsideArc && !touchedInFlight && !isFrom45) {
    return 2; // Two-pointer
  }
  
  return 1; // Standard point
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
  
  // Safely extract action
  let actionStr = '';
  if (typeof shot.action === 'string') {
    actionStr = shot.action;
  } else if (shot.action && typeof shot.action === 'object') {
    actionStr = shot.action.name || shot.action.type || shot.action.value || '';
  }
  
  const act = actionStr.toLowerCase().trim();
  let type = 'point';
  if (act === 'goal' || act === 'penalty goal') type = 'goal';
  else if (act.includes('free')) type = 'free';
  else if (act.includes('offensive mark')) type = 'offensive_mark';
  else if (act.includes('45') || act.includes('fortyfive')) type = 'fortyfive';

  const d = shot.distMeters || 30;
  const distFactor = d < 20 ? 1 : d < 30 ? 0.9 : d < 40 ? 0.7 : d < 50 ? 0.5 : 0.3;
  const pres = (shot.pressure || 'none').toString().toLowerCase();
  const presFactor = pres === 'none' ? 1 : pres === 'low' ? 0.9 : pres === 'medium' ? 0.75 : 0.6;
  
  // Safe position handling
  let posStr = '';
  if (typeof shot.position === 'string') {
    posStr = shot.position;
  } else if (shot.position && typeof shot.position === 'object') {
    posStr = shot.position.type || 'forward';
  } else {
    posStr = 'forward';
  }
  
  const pos = posStr.toLowerCase();
  const posFactor = pos.includes('central') ? 1.1 : pos.includes('wide') ? 0.85 : 1;

  let xp = (baseRates[type] || 0.5) * distFactor * presFactor * posFactor;
  return Math.min(1, Math.max(0, xp));
};

const predictXG = shot => {
  const baseGoalProb = 0.3;
  const d = shot.distMeters || 15;
  const distF = d < 10 ? 0.9 : d < 15 ? 0.7 : d < 20 ? 0.5 : d < 25 ? 0.3 : 0.2;
  
  const pres = (shot.pressure || 'none').toString().toLowerCase();
  const presF = pres === 'none' ? 0.95 : pres === 'low' ? 0.8 : pres === 'medium' ? 0.6 : 0.4;
  
  // Safe position handling
  let posStr = '';
  if (typeof shot.position === 'string') {
    posStr = shot.position;
  } else if (shot.position && typeof shot.position === 'object') {
    posStr = shot.position.type || 'forward';
  } else {
    posStr = 'forward';
  }
  
  const pos = posStr.toLowerCase();
  const posF = pos.includes('central') ? 0.9 : pos.includes('wide') ? 0.7 : 0.8;

  let xg = baseGoalProb * distF * presF * posF;
  return Math.min(1, Math.max(0, xg));
};

// Fill in any missing xP / xG on load or recalc
const calculateMissingMetrics = games =>
  games.map(g => ({
    ...g,
    gameData: (g.gameData || []).map(s => {
      // Check if this shot already has CMC model values
      if ((s.model_type === 'cmc_v2' || s.model_type === 'cmc_v3') && typeof s.xPoints === 'number') {
        // CMC model already calculated xPoints correctly
        const t = translateShotToOneSide(s, pitchWidth/2, pitchWidth, pitchHeight/2);
        s.distMeters = t.distMeters;
        s.xP_adv = s.xP;
        
        // Calculate point value for display
        if (typeof s.pointValue !== 'number') {
          s.pointValue = calculateTwoPointerValue(s);
        }
        
        return s;
      }
      
      // Only calculate if not from CMC model
      if (typeof s.xPoints !== 'number') {
        const t = translateShotToOneSide(s, pitchWidth/2, pitchWidth, pitchHeight/2);
        s.distMeters = t.distMeters;
        s.xPoints = predictXP(t);
        const act = (s.action || '').toString().toLowerCase().trim();
        if (act === 'goal' || act === 'penalty goal') {
          s.xGoals = predictXG(t);
        }
        s.xP_adv = s.xPoints * 0.7 + (s.xGoals || 0) * 0.3;
      }
      
      // Calculate point value for two-pointer logic
      if (typeof s.pointValue !== 'number') {
        s.pointValue = calculateTwoPointerValue(s);
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
      
      {/* Two-pointer legend */}
      <div className="two-pointer-legend">
        <div className="legend-item">
          <div className="legend-circle untouched"></div>
          <span>Untouched Shot</span>
        </div>
        <div className="legend-item">
          <div className="legend-circle touched"></div>
          <span>Touched in Flight</span>
        </div>
        <div className="legend-item">
          <div className="legend-circle two-pointer"></div>
          <span>Two-Pointer (≥40m, Untouched)</span>
        </div>
      </div>
      
      <div className="touch-instructions">
        <h4>Two-Pointer Rules:</h4>
        <ul>
          <li>Click any shot to view details and toggle touch status in the modal</li>
          <li>Shots ≥40m from goal and untouched = 2 points</li>
          <li>45-yard frees are always 1 point regardless of distance</li>
          <li>Touched shots are always 1 point</li>
        </ul>
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
    pdf.setFillColor(15, 10, 27);
    pdf.rect(0,0,w,h,'F');
    const props = pdf.getImageProperties(imgData);
    const imgW = w;
    const imgH = (props.height * imgW) / props.width;
    pdf.addImage(imgData, 'PNG', 0, (h - imgH) / 2, imgW, imgH);
    pdf.setFontSize(12);
    pdf.setTextColor(230, 230, 250);
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
  const [matchesData, setMatchesData] = useState([]);

  // data
  const [games, setGames] = useState([]);
  const [summary, setSummary] = useState({
    totalShots: 0,
    totalGoals: 0,
    totalPoints: 0,
    totalMisses: 0,
    totalTwoPointers: 0,
    totalOnePointers: 0,
    totalGoalPoints: 0,
    totalPointScores: 0
  });
  const [teamAggregatedData, setTeamAggregatedData] = useState({});
  const [teamScorers, setTeamScorers] = useState({});
  const [selectedShot, setSelectedShot] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // pitch scaling
  const xScale = 6, yScale = 6;
  const halfLineX = pitchWidth / 2;
  const goalX = pitchWidth, goalY = pitchHeight / 2;

  // Function to update a specific shot using unique identifier
  const updateShotInGames = (updatedShot) => {
    setGames(prevGames => 
      prevGames.map(game => ({
        ...game,
        gameData: game.gameData.map(shot => {
          const isMatch = shot.x === selectedShot.x && 
                         shot.y === selectedShot.y && 
                         shot.minute === selectedShot.minute && 
                         shot.playerName === selectedShot.playerName &&
                         shot.action === selectedShot.action;
          return isMatch ? updatedShot : shot;
        })
      }))
    );
  };

  // Dynamic filter options updater
  const updateFilterOptions = (gamesData, currentFilters) => {
    const m = new Set(), t = new Set(), p = new Set(), a = new Set();
    const matchMap = new Map();
    
    // Filter games based on selected match
    let filteredGames = gamesData;
    if (currentFilters.match) {
      filteredGames = gamesData.filter(g => {
        const matchId = g.gameId || g.gameName;
        return matchId === currentFilters.match;
      });
    }
    
    // Collect all matches (unfiltered)
    gamesData.forEach(g => {
      const matchId = g.gameId || g.gameName;
      if (matchId) {
        m.add(matchId);
        matchMap.set(matchId, {
          id: matchId,
          name: g.gameName || matchId,
          date: g.matchDate
        });
      }
    });
    
    // Now collect teams, players, and actions from filtered games
    filteredGames.forEach(g => {
      (g.gameData || []).forEach(sh => {
        if (currentFilters.team) {
          if (sh.team === currentFilters.team) {
            sh.playerName && p.add(sh.playerName);
          }
          sh.team && t.add(sh.team);
          sh.action && a.add(sh.action);
        } else {
          sh.team && t.add(sh.team);
          sh.playerName && p.add(sh.playerName);
          sh.action && a.add(sh.action);
        }
      });
    });
    
    // If a player is selected but no longer in the filtered list, keep it
    if (currentFilters.player && !p.has(currentFilters.player)) {
      p.add(currentFilters.player);
    }
    
    setFilterOptions({
      matches: Array.from(m),
      teams: Array.from(t).sort(),
      players: Array.from(p).sort(),
      actions: Array.from(a).sort()
    });
    setMatchesData(Array.from(matchMap.values()));
  };

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
    updateFilterOptions(filled, {});
  }, [file, sport, navigate]);

  // Update filter options when filters change
  useEffect(() => {
    if (!file?.games) return;
    updateFilterOptions(file.games, appliedFilters);
  }, [appliedFilters.match, appliedFilters.team, file?.games]);

  // APPLY FILTERS & SUMMARY - FIXED VERSION
  useEffect(() => {
    let filtered = file?.games || [];
    
    if (appliedFilters.match) {
      filtered = filtered.filter(g => {
        const matchId = g.gameId || g.gameName;
        return matchId === appliedFilters.match;
      });
    }
    
    ['team','player','action'].forEach(f => {
      if (appliedFilters[f]) {
        filtered = filtered.map(g => ({
          ...g,
          gameData: (g.gameData||[]).filter(sh =>
            f === 'player'
              ? sh.playerName === appliedFilters.player
              : sh[f] === appliedFilters[f]
          )
        }));
      }
    });
    
    filtered = filtered.filter(g => (g.gameData||[]).length);
    setGames(filtered);

    const shots = flattenShots(filtered);
    const s = { 
      totalShots: 0, 
      totalGoals: 0, 
      totalPoints: 0,  // Total scoring value
      totalMisses: 0, 
      totalTwoPointers: 0,  // Count of 2-point shots
      totalOnePointers: 0,  // Count of 1-point shots
      totalGoalPoints: 0,   // Points from goals
      totalPointScores: 0   // Just the pointed scores
    };
    
    shots.forEach(sh => {
      s.totalShots++;
      const act = (sh.action || '').toString().toLowerCase().trim();
      
      if (act === 'goal' || act === 'penalty goal') {
        s.totalGoals++;
        s.totalGoalPoints += 3;
        s.totalPoints += 3;
      }
      else if (act === 'point' || act === 'free' || act === 'offensive mark' || 
               act === '45' || act === 'fortyfive') {
        const pointValue = sh.pointValue || calculateTwoPointerValue(sh);
        s.totalPointScores += pointValue;
        s.totalPoints += pointValue;
        
        if (pointValue === 2) {
          s.totalTwoPointers++;
        } else {
          s.totalOnePointers++;
        }
      }
      else if (/miss|wide|short|blocked|post/.test(act)) {
        s.totalMisses++;
      }
    });
    
    setSummary(s);
  }, [file, appliedFilters, filterOptions.matches]);

  // MAP SHOTS TO RENDER TYPES
  const shotsWithRenderType = useMemo(
    () => flattenShots(games).map(sh => ({
      ...sh,
      renderType: getRenderType(sh.action, actionMapping)
    })),
    [games, actionMapping]
  );

  // AGGREGATED TEAM DATA - SEPARATED GOALS AND POINTS
  const aggregatedData = useMemo(() => {
    const agg = {}, scorerMap = {}, distAcc = {};
    
    flattenShots(games).forEach(sh => {
      const team = sh.team || 'Unknown';
      const act = (sh.action || '').toString().toLowerCase().trim();
      const name = sh.playerName || 'Unknown';
      
      // Initialize team if needed
      if (!agg[team]) {
        agg[team] = {
          totalShots: 0,
          successfulShots: 0,
          points: 0,  // Points only (no goals)
          goals: 0,
          misses: 0,
          freeAttempts: 0,
          freeScored: 0,
          offensiveMarkAttempts: 0,
          offensiveMarkScored: 0,
          fortyFiveAttempts: 0,
          fortyFiveScored: 0,
          twoPointerAttempts: 0,
          twoPointerScored: 0,
          totalTwoPointers: 0,
          totalOnePointers: 0,
          totalXP: 0,  // Expected POINTS only
          totalXG: 0   // Expected GOALS only
        };
        distAcc[team] = 0;
        scorerMap[team] = {};
      }
      
      // Initialize player if needed
      if (!scorerMap[team][name]) {
        scorerMap[team][name] = {
          goals: 0,
          points: 0,
          twoPointers: 0,
          xP: 0,  // Expected points only
          xG: 0   // Expected goals only
        };
      }
      
      // Update shot count and distance
      agg[team].totalShots++;
      const tShot = translateShotToOneSide(sh, halfLineX, goalX, goalY);
      distAcc[team] += tShot.distMeters || 0;
      
      // Determine if this is a scoring shot
      const scoringActions = ['point', 'free', 'offensive mark', '45', 'fortyfive', 'goal', 'penalty goal'];
      const isScoring = scoringActions.some(action => act.includes(action));
      const isMiss = /miss|wide|short|blocked|post/.test(act);
      
      // Handle GOALS separately
      if (act.includes('goal') && !isMiss) {
        agg[team].goals++;
        agg[team].successfulShots++;
        scorerMap[team][name].goals++;
        
        // Add expected goals
        if (typeof sh.xGoals === 'number') {
          agg[team].totalXG += sh.xGoals;
          scorerMap[team][name].xG += sh.xGoals;
        } else if (typeof sh.xP === 'number') {
          // Fallback: use xP as goal probability
          agg[team].totalXG += sh.xP;
          scorerMap[team][name].xG += sh.xP;
        }
      }
      // Handle POINTS separately (everything except goals)
      else if (isScoring && !isMiss && !act.includes('goal')) {
        // Calculate point value
        const pointValue = sh.pointValue || calculateTwoPointerValue(sh);
        
        agg[team].successfulShots++;
        agg[team].points += pointValue;  // Only points, no goals
        scorerMap[team][name].points += pointValue;
        
        // Add expected points
        if (typeof sh.xPoints === 'number') {
          agg[team].totalXP += sh.xPoints;
          scorerMap[team][name].xP += sh.xPoints;
        } else if (typeof sh.xP === 'number') {
          // Fallback: multiply probability by point value
          agg[team].totalXP += sh.xP * pointValue;
          scorerMap[team][name].xP += sh.xP * pointValue;
        }
        
        // Track point types
        if (pointValue === 2) {
          agg[team].totalTwoPointers++;
          scorerMap[team][name].twoPointers++;
        } else {
          agg[team].totalOnePointers++;
        }
        
        // Track specific shot types
        if (act === 'free') {
          agg[team].freeScored++;
        } else if (act === 'offensive mark') {
          agg[team].offensiveMarkScored++;
        } else if (act === '45' || act === 'fortyfive') {
          agg[team].fortyFiveScored++;
        }
      }
      else {
        // Misses - still calculate expected values
        if (isMiss) {
          agg[team].misses++;
          
          // Add expected values for missed shots
          if (act.includes('goal')) {
            if (typeof sh.xGoals === 'number') {
              agg[team].totalXG += sh.xGoals;
              scorerMap[team][name].xG += sh.xGoals;
            } else if (typeof sh.xP === 'number') {
              agg[team].totalXG += sh.xP;
              scorerMap[team][name].xG += sh.xP;
            }
          } else {
            const pointValue = sh.pointValue || calculateTwoPointerValue(sh);
            if (typeof sh.xPoints === 'number') {
              agg[team].totalXP += sh.xPoints;
              scorerMap[team][name].xP += sh.xPoints;
            } else if (typeof sh.xP === 'number') {
              agg[team].totalXP += sh.xP * pointValue;
              scorerMap[team][name].xP += sh.xP * pointValue;
            }
          }
        }
      }
      
      // Track attempts (including misses)
      if (act.includes('free')) agg[team].freeAttempts++;
      if (act.includes('offensive mark')) agg[team].offensiveMarkAttempts++;
      if (act.includes('45') || act.includes('fortyfive')) agg[team].fortyFiveAttempts++;
      
      // Track 2-point attempts (must be ≥40m and not a 45 and not a goal)
      if (tShot.distMeters >= 40 && !act.includes('45') && !act.includes('fortyfive') && !act.includes('goal')) {
        const eligibleActions = ['point', 'free', 'offensive mark'];
        if (eligibleActions.some(a => act.includes(a))) {
          agg[team].twoPointerAttempts++;
          if (!isMiss) {
            agg[team].twoPointerScored++;
          }
        }
      }
    });
    
    // Calculate averages
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
  const handleShotClick = (shot) => {
    setSelectedShot(translateShotToOneSide(shot, halfLineX, goalX, goalY));
  };

  // Toggle touch status for a specific shot
  const toggleShotTouchStatus = (shot) => {
    const updatedShot = {
      ...shot,
      touchedInFlight: !shot.touchedInFlight,
      pointValue: calculateTwoPointerValue({
        ...shot,
        touchedInFlight: !shot.touchedInFlight
      })
    };
    
    updateShotInGames(updatedShot);
    setSelectedShot(translateShotToOneSide(updatedShot, halfLineX, goalX, goalY));
    
    // Show notification
    const touchStatus = updatedShot.touchedInFlight ? 'touched' : 'untouched';
    const pointValue = updatedShot.pointValue;
    
    Swal.fire({
      title: `Shot marked as ${touchStatus}`,
      text: `This shot is now worth ${pointValue} point(s)`,
      icon: 'info',
      timer: 1500,
      showConfirmButton: false,
      background: 'var(--dark-card)',
      color: 'var(--light)'
    });
  };

  // RENDER SELECTED SHOT DETAILS
  function renderSelectedShotDetails() {
    if (!selectedShot) return null;
    
    const pointValue = selectedShot.pointValue || calculateTwoPointerValue(selectedShot);
    const distanceFromGoal = selectedShot.distMeters || calculateDistanceFromGoalLine(
      selectedShot.x || 0, 
      selectedShot.y || 0, 
      145, 
      88
    );
    const isScoring = ['point', 'goal', 'free', 'offensive mark', '45', 'fortyfive'].some(
      act => (selectedShot.action || '').toLowerCase().includes(act)
    );
    
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
            <span className="gaa-stat-label">Distance from Goal:</span>
            <span className="gaa-stat-value">{distanceFromGoal.toFixed(1)} m</span>
          </div>
          
          {isScoring && (
            <>
              <div className={`gaa-stat-row ${selectedShot.touchedInFlight ? 'highlight-touched' : ''}`}>
                <span className="gaa-stat-label">Touch Status:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="gaa-stat-value" style={{ 
                    color: selectedShot.touchedInFlight ? '#FF6B6B' : '#50FA7B',
                    fontWeight: 'bold'
                  }}>
                    {selectedShot.touchedInFlight ? 'TOUCHED' : 'UNTOUCHED'}
                  </span>
                  <button
                    className={`touch-toggle-btn ${selectedShot.touchedInFlight ? 'touched' : 'untouched'}`}
                    onClick={() => toggleShotTouchStatus(selectedShot)}
                  >
                    {selectedShot.touchedInFlight ? 'MARK UNTOUCHED' : 'MARK TOUCHED'}
                  </button>
                </div>
              </div>
              <div className={`gaa-stat-row ${pointValue === 2 ? 'highlight-two-pointer' : pointValue === 3 ? 'highlight-goal' : ''}`}>
                <span className="gaa-stat-label">Point Value:</span>
                <span className="gaa-stat-value" style={{ 
                  color: pointValue === 3 ? '#FFFF33' : pointValue === 2 ? '#FFFF33' : '#50FA7B',
                  fontWeight: 'bold',
                  fontSize: '1.2em'
                }}>
                  {pointValue} point{pointValue !== 1 ? 's' : ''}
                  {pointValue === 2 && <span className="two-pointer-badge">2PT</span>}
                  {pointValue === 3 && <span className="two-pointer-badge" style={{background: 'linear-gradient(45deg, #FFD700, #FFA500)'}}>GOAL</span>}
                </span>
              </div>
            </>
          )}
          
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
            <span className="gaa-stat-value">{typeof selectedShot.xP === 'number' ? selectedShot.xP.toFixed(2) : (typeof selectedShot.xPoints === 'number' ? selectedShot.xPoints.toFixed(2) : 'N/A')}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">xPoints:</span>
            <span className="gaa-stat-value">{typeof selectedShot.xPoints === 'number' ? selectedShot.xPoints.toFixed(2) : 'N/A'}</span>
          </div>
          {selectedShot.model_type && (
            <div className="gaa-stat-row">
              <span className="gaa-stat-label">Model:</span>
              <span className="gaa-stat-value">{selectedShot.model_type}</span>
            </div>
          )}
        </div>
        
        {isScoring && (
          <div style={{ 
            padding: '10px', 
            background: 'rgba(115, 63, 170, 0.1)', 
            borderRadius: '5px',
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            <small style={{ color: 'var(--gray-dark)' }}>
              Use the toggle button above to mark whether this shot was touched in flight
            </small>
          </div>
        )}
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
              onChange={e => {
                const newMatch = e.target.value;
                setAppliedFilters(prev => ({ 
                  ...prev, 
                  match: newMatch,
                  player: ''
                }));
              }}
            >
              <option value="">All Matches</option>
              {matchesData.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.name || match.id}
                  {match.date && ` (${new Date(match.date).toLocaleDateString()})`}
                </option>
              ))}
            </select>
            <select
              className="gaa-filter-select"
              value={appliedFilters.team}
              onChange={e => {
                const newTeam = e.target.value;
                setAppliedFilters(prev => ({ 
                  ...prev, 
                  team: newTeam,
                  player: ''
                }));
              }}
            >
              <option value="">All Teams</option>
              {filterOptions.teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="gaa-filter-select has-parent-filter"
              value={appliedFilters.player}
              onChange={e => setAppliedFilters(prev => ({ ...prev, player: e.target.value }))}
              disabled={filterOptions.players.length === 0}
            >
              <option value="">
                {filterOptions.players.length === 0 ? 'No Players Available' : 'All Players'}
              </option>
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

        {/* Show helper text when filters are active */}
        {(appliedFilters.match || appliedFilters.team) && (
          <div className="filter-helper-text">
            Player filter shows only players from selected {appliedFilters.team ? 'team' : 'match'}
          </div>
        )}

        {/* Updated summary section with clearer display */}
        <div className="gaa-summary-section">
          <div className="gaa-tiles-container">
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Total Shots</h5>
              <p className="gaa-tile-value">{summary.totalShots}</p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Goals</h5>
              <p className="gaa-tile-value">
                {summary.totalGoals}
                <span style={{ fontSize: '0.8em', color: 'var(--gray)' }}>
                  ({summary.totalGoalPoints}pts)
                </span>
              </p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Points</h5>
              <p className="gaa-tile-value">
                {summary.totalPointScores}
                <span style={{ fontSize: '0.8em', color: 'var(--gray)' }}>
                  ({summary.totalOnePointers + summary.totalTwoPointers} scores)
                </span>
              </p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Total Score</h5>
              <p className="gaa-tile-value" style={{ 
                fontSize: '1.5em', 
                color: 'var(--primary)',
                fontWeight: 'bold' 
              }}>
                {summary.totalPoints}
              </p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Two-Pointers</h5>
              <p className="gaa-tile-value" style={{ color: '#FFFF33' }}>
                {summary.totalTwoPointers}
                <span style={{ fontSize: '0.8em', color: 'var(--gray)' }}>
                  ({summary.totalTwoPointers * 2}pts)
                </span>
              </p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">One-Pointers</h5>
              <p className="gaa-tile-value">
                {summary.totalOnePointers}
                <span style={{ fontSize: '0.8em', color: 'var(--gray)' }}>
                  ({summary.totalOnePointers}pts)
                </span>
              </p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">Misses</h5>
              <p className="gaa-tile-value" style={{ color: 'var(--danger)' }}>
                {summary.totalMisses}
              </p>
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
                    
                    {/* Separated Goals Section */}
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Goals:</span>
                      <span className="gaa-stat-value">{stats.goals}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Expected Goals (xG):</span>
                      <span className="gaa-stat-value">
                        {(stats.totalXG || 0).toFixed(2)}
                        {stats.goals > 0 && (
                          <span style={{ 
                            marginLeft: '0.5rem', 
                            fontSize: '0.9em',
                            color: stats.goals > stats.totalXG ? 'var(--success)' : 'var(--danger)'
                          }}>
                            ({stats.goals > stats.totalXG ? '+' : ''}{(stats.goals - stats.totalXG).toFixed(1)})
                          </span>
                        )}
                      </span>
                    </div>
                    
                    {/* Separated Points Section */}
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Points:</span>
                      <span className="gaa-stat-value">{stats.points}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Expected Points (xP):</span>
                      <span className="gaa-stat-value">
                        {(stats.totalXP || 0).toFixed(2)}
                        {stats.points > 0 && (
                          <span style={{ 
                            marginLeft: '0.5rem', 
                            fontSize: '0.9em',
                            color: stats.points > stats.totalXP ? 'var(--success)' : 'var(--danger)'
                          }}>
                            ({stats.points > stats.totalXP ? '+' : ''}{(stats.points - stats.totalXP).toFixed(1)})
                          </span>
                        )}
                      </span>
                    </div>
                    
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Misses:</span>
                      <span className="gaa-stat-value">{stats.misses}</span>
                    </div>
                    
                    {/* Two-pointer summary */}
                    <div className="team-two-pointer-summary">
                      <h4>Points Breakdown</h4>
                      <div className="two-pointer-stats">
                        <div className="two-pointer-stat">
                          <div className="value">{stats.totalTwoPointers}</div>
                          <div className="label">Two-Pointers</div>
                        </div>
                        <div className="two-pointer-stat">
                          <div className="value">{stats.totalOnePointers}</div>
                          <div className="label">One-Pointers</div>
                        </div>
                      </div>
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
                      <span className="gaa-stat-label">2‑Point Attempts:</span>
                      <span className="gaa-stat-value">{formatCategory(stats.twoPointerAttempts, stats.twoPointerScored)}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Avg Distance (m):</span>
                      <span className="gaa-stat-value">{stats.avgDistance}</span>
                    </div>
                    
                    <h4 className="gaa-scorers-title">Scorers</h4>
                    {Object.entries(teamScorers[team]||{}).length === 0
                      ? <p>No scorers found</p>
                      : Object.entries(teamScorers[team])
                          .sort((a, b) => {
                            // Sort by total points scored (goals*3 + points), then by xP
                            const aTotal = (a[1].goals * 3) + a[1].points;
                            const bTotal = (b[1].goals * 3) + b[1].points;
                            if (aTotal !== bTotal) return bTotal - aTotal;
                            return (b[1].xP || 0) - (a[1].xP || 0);
                          })
                          .map(([p, v]) => (
                            <div key={p} className="gaa-scorer-item">
                              <div className="scorer-main-line">
                                {p}: {v.goals}g, {v.points}p
                                {v.twoPointers > 0 && <span className="two-pointer-badge">{v.twoPointers} x 2PT</span>}
                              </div>
                              <div className="scorer-stats-line">
                                xP: {(v.xP || 0).toFixed(2)}, xG: {(v.xG || 0).toFixed(2)}
                                <span className="scorer-performance" style={{ 
                                  marginLeft: '0.5rem',
                                  fontSize: '0.9em'
                                }}>
                                  (
                                  {v.points > 0 && (
                                    <span style={{ 
                                      color: v.points > v.xP ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                      P: {v.points > v.xP ? '+' : ''}{(v.points - v.xP).toFixed(1)}
                                    </span>
                                  )}
                                  {v.points > 0 && v.goals > 0 && ', '}
                                  {v.goals > 0 && (
                                    <span style={{ 
                                      color: v.goals > v.xG ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                      G: {v.goals > v.xG ? '+' : ''}{(v.goals - v.xG).toFixed(1)}
                                    </span>
                                  )}
                                  )
                                </span>
                              </div>
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