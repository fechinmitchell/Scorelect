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
  const action = (shot.action || '').toLowerCase().trim();
  
  // Goals are worth 3 points
  if (action === 'goal' || action === 'penalty goal') {
    return 3;
  }
  
  // Must be a scoring shot (point) for 1-2 point logic
  const isScoringShot = action === 'point' || action === 'free';
  if (!isScoringShot) return 1; // Not a scoring shot, default to 1
  
  // Check if it's a 45 - always 1 point
  const isFrom45 = action.includes('45') || action.includes('fortyfive') || 
                   (shot.action || '').toLowerCase().includes('45');
  if (isFrom45) return 1;
  
  // Use the already calculated distMeters if available (from translateShotToOneSide)
  // Otherwise calculate it using the translated coordinates
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
  
  // Check if touched in flight (new property we'll add)
  const touchedInFlight = shot.touchedInFlight || false;
  
  // Check if it's from play, mark, or free (excluding 45s)
  const isKickedFromPlayMarkOrFree = true; // Most shots qualify unless specifically excluded
  
  // Apply two-pointer logic for points and frees
  if (isKickedFromPlayMarkOrFree && isAtOrOutsideArc && !touchedInFlight && !isFrom45) {
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
  const [matchesData, setMatchesData] = useState([]); // Store full match data for display

  // data
  const [games, setGames] = useState([]);
  const [summary, setSummary] = useState({
    totalShots:0, totalGoals:0, totalPoints:0, totalMisses:0, totalTwoPointers:0, totalOnePointers:0
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
          // More precise matching using multiple properties
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
    const matchMap = new Map(); // Store match data for display
    
    filled.forEach(g => {
      // Use gameId or gameName as the match identifier, just like in AnalysisGAA.js
      const matchId = g.gameId || g.gameName;
      if (matchId) {
        m.add(matchId);
        // Store match data for better display
        matchMap.set(matchId, {
          id: matchId,
          name: g.gameName || matchId,
          date: g.matchDate
        });
      } else {
        console.warn('Game missing gameId/gameName:', g);
      }
      
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
    setMatchesData(Array.from(matchMap.values()));
    
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
    
    // Debug: Log initial games and match filter
    console.log('Initial games:', filtered.length);
    console.log('Match filter:', appliedFilters.match);
    console.log('Available matches:', filterOptions.matches);
    
    if (appliedFilters.match) {
      filtered = filtered.filter(g => {
        // Use the same logic as AnalysisGAA.js
        const matchId = g.gameId || g.gameName;
        return matchId === appliedFilters.match;
      });
      console.log('After match filter:', filtered.length);
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
    const s = { totalShots:0, totalGoals:0, totalPoints:0, totalMisses:0, totalTwoPointers:0, totalOnePointers:0 };
    shots.forEach(sh => {
      s.totalShots++;
      const act = (sh.action||'').toLowerCase().trim();
      if (act==='goal'||act==='penalty goal') s.totalGoals++;
      else if (act==='point') {
        const pointValue = sh.pointValue || calculateTwoPointerValue(sh);
        s.totalPoints += pointValue;
        if (pointValue === 2) {
          s.totalTwoPointers++;
        } else {
          s.totalOnePointers++;
        }
      }
      else if (/miss|wide|short|blocked|post/.test(act)) s.totalMisses++;
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
          twoPointerAttempts:0, twoPointerScored:0,
          totalTwoPointers:0, totalOnePointers:0,
          totalXP: 0, totalXG: 0  // Add xP and xG totals
        };
        distAcc[team] = 0;
        scorerMap[team] = {};
      }
      agg[team].totalShots++;
      const tShot = translateShotToOneSide(sh, halfLineX, goalX, goalY);
      distAcc[team] += tShot.distMeters;
      
      // Add xP and xG to team totals
      if (typeof sh.xPoints === 'number') {
        agg[team].totalXP += sh.xPoints;
      }
      if (typeof sh.xGoals === 'number') {
        agg[team].totalXG += sh.xGoals;
      }
  
      const act = (sh.action||'').toLowerCase().trim();
      const name = sh.playerName||'NoName';
      const pointValue = sh.pointValue || calculateTwoPointerValue(sh);
  
      if (act==='goal'||act==='penalty goal') {
        agg[team].goals++;
        agg[team].successfulShots++;
        // Add successful goal to scorer (worth 3 points)
        if (name) {
          scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0, twoPointers:0, xP:0, xG:0};
          scorerMap[team][name].goals++;
          scorerMap[team][name].xP += sh.xPoints || 0;
          scorerMap[team][name].xG += sh.xGoals || 0;
        }
      } else if (act==='point') {
        agg[team].points += pointValue;
        agg[team].successfulShots++;
        
        if (pointValue === 2) {
          agg[team].totalTwoPointers++;
        } else {
          agg[team].totalOnePointers++;
        }
        
        // Add successful point to scorer
        if (name) {
          scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0, twoPointers:0, xP:0, xG:0};
          scorerMap[team][name].points += pointValue;
          scorerMap[team][name].xP += sh.xPoints || 0;
          scorerMap[team][name].xG += sh.xGoals || 0;
          if (pointValue === 2) {
            scorerMap[team][name].twoPointers = (scorerMap[team][name].twoPointers || 0) + 1;
          }
        }
      } else if (act==='free') {
        // Handle frees - they can be worth 1 or 2 points
        agg[team].freeAttempts++;
        agg[team].freeScored++;
        agg[team].successfulShots++;
        agg[team].points += pointValue;
        
        if (pointValue === 2) {
          agg[team].totalTwoPointers++;
        } else {
          agg[team].totalOnePointers++;
        }
        
        // Add successful free to scorer
        if (name) {
          scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0, twoPointers:0, xP:0, xG:0};
          scorerMap[team][name].points += pointValue;
          scorerMap[team][name].xP += sh.xPoints || 0;
          scorerMap[team][name].xG += sh.xGoals || 0;
          if (pointValue === 2) {
            scorerMap[team][name].twoPointers = (scorerMap[team][name].twoPointers || 0) + 1;
          }
        }
      } else if (act==='offensive mark') {
        agg[team].offensiveMarkAttempts++;
        agg[team].offensiveMarkScored++;
        agg[team].successfulShots++;
        // Add successful offensive mark as a point for the scorer
        if (name) {
          scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0, twoPointers:0, xP:0, xG:0};
          scorerMap[team][name].points++;
          scorerMap[team][name].xP += sh.xPoints || 0;
          scorerMap[team][name].xG += sh.xGoals || 0;
        }
      } else {
        // For all other shots (including misses), still track xP and xG
        if (name) {
          scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0, twoPointers:0, xP:0, xG:0};
          scorerMap[team][name].xP += sh.xPoints || 0;
          scorerMap[team][name].xG += sh.xGoals || 0;
        }
      }
      
      if (act.startsWith('free')) {
        // Only count non-successful frees here (misses)
        if (act !== 'free') {
          agg[team].freeAttempts++;
        }
      }
      
      if (act.startsWith('45')||act.startsWith('forty')) {
        agg[team].fortyFiveAttempts++;
        if (act==='45'||act==='fortyfive') {
          agg[team].fortyFiveScored++;
          agg[team].successfulShots++;
          // Add successful 45/fortyfive as a point for the scorer
          if (name) {
            scorerMap[team][name] = scorerMap[team][name] || {goals:0, points:0, twoPointers:0, xP:0, xG:0};
            scorerMap[team][name].points++;
            scorerMap[team][name].xP += sh.xPoints || 0;
            scorerMap[team][name].xG += sh.xGoals || 0;
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

  // SHOT CLICK HANDLER - Just show details, don't toggle
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
    
    // Use the already translated shot coordinates for distance calculation
    const pointValue = selectedShot.pointValue || calculateTwoPointerValue(selectedShot);
    const distanceFromGoal = selectedShot.distMeters || calculateDistanceFromGoalLine(
      selectedShot.x || 0, 
      selectedShot.y || 0, 
      145, 
      88
    );
    const isScoring = ['point', 'goal', 'free'].includes((selectedShot.action || '').toLowerCase());
    
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
            <span className="gaa-stat-value">{typeof selectedShot.xPoints === 'number' ? selectedShot.xPoints.toFixed(2) : 'N/A'}</span>
          </div>
          <div className="gaa-stat-row">
            <span className="gaa-stat-label">xP_ADV:</span>
            <span className="gaa-stat-value">{typeof selectedShot.xP_adv === 'number' ? selectedShot.xP_adv.toFixed(2) : 'N/A'}</span>
          </div>
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
              onChange={e => setAppliedFilters(prev => ({ ...prev, match: e.target.value }))}
            >
              <option value="">All Matches</option>
              {matchesData.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.name}
                  {match.date && ` (${new Date(match.date).toLocaleDateString()})`}
                </option>
              ))}
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
              <h5 className="gaa-tile-title">Two-Pointers</h5>
              <p className="gaa-tile-value" style={{ color: '#FFFF33' }}>{summary.totalTwoPointers}</p>
            </div>
            <div className="gaa-tile">
              <h5 className="gaa-tile-title">One-Pointers</h5>
              <p className="gaa-tile-value">{summary.totalOnePointers}</p>
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
                      <span className="gaa-stat-label">Expected Points (xP):</span>
                      <span className="gaa-stat-value">
                        {(stats.totalXP || 0).toFixed(2)}
                        {stats.points > 0 && stats.totalXP > 0 && (
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
                      <span className="gaa-stat-label">Goals:</span>
                      <span className="gaa-stat-value">{stats.goals}</span>
                    </div>
                    <div className="gaa-stat-row">
                      <span className="gaa-stat-label">Expected Goals (xG):</span>
                      <span className="gaa-stat-value">
                        {(stats.totalXG || 0).toFixed(2)}
                        {stats.goals > 0 && stats.totalXG > 0 && (
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
                                {((v.goals + v.points) > 0 || v.xP > 0) && (
                                  <span className="scorer-performance" style={{ 
                                    color: (v.goals + v.points) > (v.xP + v.xG) ? 'var(--success)' : 'var(--danger)'
                                  }}>
                                    ({(v.goals + v.points) > (v.xP + v.xG) ? '+' : ''}{((v.goals + v.points) - (v.xP + v.xG)).toFixed(1)})
                                  </span>
                                )}
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