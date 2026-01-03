import React, { useMemo, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { firestore } from './firebase';
import { getAuth } from 'firebase/auth';

import './PlayerDataGAA.css';

/*******************************************
 * CONSTANTS
 *******************************************/
const ADMIN_USERS = ['w9ZkqaYVM3dKSqqjWHLDVyh5sVg2'];
const PUBLIC_CONFIG_PATH = 'config/publicDataset';
const DEFAULT_USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
const DEFAULT_DATASET = 'AllIreland2025';
const CALIBRATION_DATASET = 'GAA All Shots Formatted';
const GOAL_X = 145;
const GOAL_Y = 44;
const MIDLINE_X = 72.5;

// GAA 2025 Scoring Rules:
// - Goal (under crossbar) = 3 points
// - Point from INSIDE 40m arc = 1 point
// - Point from OUTSIDE 40m arc = 2 points (cleanly kicked)
// - 45 (free from 45m line) = 1 point
// - Frees/Marks from outside 40m arc = 2 points

// The 40m arc is 40m from goal (distance from goal line center)
const ARC_DISTANCE_METERS = 40;

/*******************************************
 * CALIBRATION DATA HOOK
 * Builds probability model from historical data
 *******************************************/
function useCalibrationData() {
  const [calibrationModel, setCalibrationModel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function buildCalibrationModel() {
      try {
        const gamesCollectionRef = collection(firestore, `savedGames/${DEFAULT_USER_ID}/games`);
        const snapshot = await getDocs(gamesCollectionRef);
        
        let calibrationShots = [];
        
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.datasetName === CALIBRATION_DATASET) {
            const gameData = data.gameData || [];
            const gameDataArray = Array.isArray(gameData) ? gameData : Object.values(gameData);
            calibrationShots = calibrationShots.concat(gameDataArray);
          }
        });

        if (calibrationShots.length === 0) {
          console.log('No calibration data found, using defaults');
          setCalibrationModel(null);
          setLoading(false);
          return;
        }

        console.log(`Building calibration model from ${calibrationShots.length} shots`);

        // Build conversion rate model by distance bucket (5m intervals)
        // Track separate rates for: set plays, play from hand, and goals
        const buckets = {};
        
        calibrationShots.forEach(shot => {
          // Calculate distance to goal
          const x = parseFloat(shot.x) || 0;
          const y = parseFloat(shot.y) || 0;
          const targetGoal = x <= MIDLINE_X ? { x: 0, y: GOAL_Y } : { x: GOAL_X, y: GOAL_Y };
          const dx = x - targetGoal.x;
          const dy = y - targetGoal.y;
          const distanceMeters = Math.sqrt(dx * dx + dy * dy);
          
          const bucket = Math.floor(distanceMeters / 5) * 5;
          if (!buckets[bucket]) {
            buckets[bucket] = {
              setPlay: { attempts: 0, scores: 0 },
              play: { attempts: 0, scores: 0 },
              goal: { attempts: 0, scores: 0 }
            };
          }
          
          const actionLower = (shot.action || '').toLowerCase();
          const typeLower = (shot.type || '').toLowerCase();
          
          const isSetPlay = ['free', 'fortyfive', '45', 'mark', 'offensive mark', 'penalty'].includes(actionLower);
          const isGoalAttempt = actionLower === 'goal' || typeLower === 'goal' || typeLower === 'saved';
          const isPointScored = actionLower === 'point' || (isSetPlay && typeLower === 'score');
          const isGoalScored = actionLower === 'goal';
          
          if (isGoalAttempt) {
            buckets[bucket].goal.attempts += 1;
            if (isGoalScored) buckets[bucket].goal.scores += 1;
          } else if (isSetPlay) {
            buckets[bucket].setPlay.attempts += 1;
            if (isPointScored) buckets[bucket].setPlay.scores += 1;
          } else {
            buckets[bucket].play.attempts += 1;
            if (isPointScored) buckets[bucket].play.scores += 1;
          }
        });

        // Calculate rates
        const model = { buckets: {}, shotCount: calibrationShots.length };
        
        Object.keys(buckets).forEach(b => {
          const data = buckets[b];
          model.buckets[b] = {
            setPlayRate: data.setPlay.attempts > 0 ? data.setPlay.scores / data.setPlay.attempts : null,
            playRate: data.play.attempts > 0 ? data.play.scores / data.play.attempts : null,
            goalRate: data.goal.attempts > 0 ? data.goal.scores / data.goal.attempts : null
          };
        });

        console.log('Calibration model built:', model);
        setCalibrationModel(model);
      } catch (err) {
        console.error('Error building calibration model:', err);
        setCalibrationModel(null);
      } finally {
        setLoading(false);
      }
    }

    buildCalibrationModel();
  }, []);

  return { calibrationModel, loading };
}

/*******************************************
 * xP CALCULATION (Expected Points for point attempts)
 * Returns the probability of scoring a point (0-1)
 *******************************************/
function calculateXP(shot, distanceMeters, calibrationModel) {
  // First check if shot already has xPoints from backend
  if (shot.xPoints !== undefined && shot.xPoints !== null) {
    const existing = parseFloat(shot.xPoints);
    if (!isNaN(existing) && existing >= 0 && existing <= 1) {
      return existing;
    }
  }
  
  const bucket = Math.floor(distanceMeters / 5) * 5;
  const actionLower = (shot.action || '').toLowerCase();
  const isSetPlay = ['free', 'fortyfive', '45', 'mark', 'offensive mark', 'penalty'].includes(actionLower);
  
  // Try calibration model first
  if (calibrationModel && calibrationModel.buckets) {
    // Look for exact bucket
    if (calibrationModel.buckets[bucket]) {
      const rate = isSetPlay 
        ? calibrationModel.buckets[bucket].setPlayRate 
        : calibrationModel.buckets[bucket].playRate;
      if (rate !== null) return rate;
    }
    
    // Try nearest bucket
    const bucketKeys = Object.keys(calibrationModel.buckets).map(Number).sort((a, b) => a - b);
    if (bucketKeys.length > 0) {
      const nearest = bucketKeys.reduce((prev, curr) => 
        Math.abs(curr - bucket) < Math.abs(prev - bucket) ? curr : prev, bucketKeys[0]);
      const rate = isSetPlay 
        ? calibrationModel.buckets[nearest]?.setPlayRate 
        : calibrationModel.buckets[nearest]?.playRate;
      if (rate !== null && rate !== undefined) return rate;
    }
  }
  
  // Fallback: Conservative default rates based on GAA research
  // These are approximate conversion rates from various GAA studies
  if (isSetPlay) {
    // Set plays (frees, 45s, marks) - higher success rates
    if (distanceMeters <= 20) return 0.82;  // Close frees ~82%
    if (distanceMeters <= 30) return 0.68;  // Medium frees ~68%
    if (distanceMeters <= 40) return 0.52;  // Long frees ~52%
    if (distanceMeters <= 45) return 0.42;  // 45s ~42%
    return 0.30;  // Very long ~30%
  } else {
    // Play from hand - lower success rates
    if (distanceMeters <= 15) return 0.58;  // Close range ~58%
    if (distanceMeters <= 20) return 0.48;  // Medium close ~48%
    if (distanceMeters <= 25) return 0.40;  // Medium ~40%
    if (distanceMeters <= 30) return 0.32;  // Medium long ~32%
    if (distanceMeters <= 35) return 0.25;  // Long ~25%
    if (distanceMeters <= 40) return 0.18;  // Very long ~18%
    return 0.12;  // Beyond 40m ~12%
  }
}

/*******************************************
 * xG CALCULATION (Expected Goals for goal attempts)
 * Returns the probability of scoring a goal (0-1)
 *******************************************/
function calculateXG(shot, distanceMeters, calibrationModel) {
  // First check if shot already has xGoals from backend
  if (shot.xGoals !== undefined && shot.xGoals !== null) {
    const existing = parseFloat(shot.xGoals);
    if (!isNaN(existing) && existing >= 0 && existing <= 1) {
      return existing;
    }
  }
  
  const bucket = Math.floor(distanceMeters / 5) * 5;
  const actionLower = (shot.action || '').toLowerCase();
  
  // Penalties have high conversion rate
  if (actionLower === 'penalty') return 0.82;
  
  // Try calibration model
  if (calibrationModel && calibrationModel.buckets) {
    if (calibrationModel.buckets[bucket]?.goalRate !== null && 
        calibrationModel.buckets[bucket]?.goalRate !== undefined) {
      return calibrationModel.buckets[bucket].goalRate;
    }
    
    // Try nearest bucket
    const bucketKeys = Object.keys(calibrationModel.buckets).map(Number).sort((a, b) => a - b);
    if (bucketKeys.length > 0) {
      const nearest = bucketKeys.reduce((prev, curr) => 
        Math.abs(curr - bucket) < Math.abs(prev - bucket) ? curr : prev, bucketKeys[0]);
      const rate = calibrationModel.buckets[nearest]?.goalRate;
      if (rate !== null && rate !== undefined) return rate;
    }
  }
  
  // Fallback: Conservative goal conversion rates
  // Goals are much harder to score than points
  if (distanceMeters <= 6) return 0.45;   // Very close ~45%
  if (distanceMeters <= 10) return 0.32;  // Close ~32%
  if (distanceMeters <= 14) return 0.22;  // Medium ~22%
  if (distanceMeters <= 20) return 0.12;  // Long ~12%
  return 0.05;  // Very long ~5%
}

/*******************************************
 * HOOKS
 *******************************************/
function useFetchPublicConfig() {
  const [config, setConfig] = useState({ userId: null, datasetName: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const docRef = doc(firestore, PUBLIC_CONFIG_PATH);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setConfig(docSnap.data());
      } catch (err) {
        console.error('Error fetching public config:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  return { config, loading, setConfig };
}

function useFetchDatasetStructure(userId) {
  const [datasetStructure, setDatasetStructure] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStructure() {
      if (!userId) { setLoading(false); return; }
      try {
        const gamesCollectionRef = collection(firestore, `savedGames/${userId}/games`);
        const snapshot = await getDocs(gamesCollectionRef);
        const structure = [];
        
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const datasetName = data.datasetName || docSnap.id;
          const isGAA = data.sport === 'GAA' || !data.sport;
          if (!isGAA) return;
          
          let dataset = structure.find(d => d.datasetName === datasetName);
          if (!dataset) { dataset = { datasetName, games: [] }; structure.push(dataset); }
          
          const gameData = data.gameData || [];
          const gameDataArray = Array.isArray(gameData) ? gameData : Object.values(gameData);
          dataset.games.push({
            id: docSnap.id,
            gameName: data.gameName || docSnap.id,
            shotCount: gameDataArray.length,
          });
        });
        
        structure.sort((a, b) => a.datasetName.localeCompare(b.datasetName));
        setDatasetStructure(structure);
      } catch (err) {
        console.error('Error fetching dataset structure:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStructure();
  }, [userId]);

  return { datasetStructure, loading };
}

function useFetchMultipleGames(userId, selectedGameIds) {
  const [combinedData, setCombinedData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchGames() {
      if (!userId || !selectedGameIds || selectedGameIds.length === 0) {
        setCombinedData([]); setLoading(false); return;
      }
      setLoading(true);
      try {
        const allShots = [];
        for (const gameId of selectedGameIds) {
          const docRef = doc(firestore, `savedGames/${userId}/games`, gameId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const gameData = data.gameData || [];
            const gameDataArray = Array.isArray(gameData) ? gameData : Object.values(gameData);
            gameDataArray.forEach(shot => allShots.push({ ...shot, _gameId: gameId }));
          }
        }
        setCombinedData(allShots);
      } catch (err) {
        console.error('Error fetching games:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGames();
  }, [userId, selectedGameIds]);

  return { combinedData, loading };
}

function translateShotToOneSide(shot) {
  const x = parseFloat(shot.x) || 0;
  const y = parseFloat(shot.y) || 0;
  const targetGoal = x <= MIDLINE_X ? { x: 0, y: GOAL_Y } : { x: GOAL_X, y: GOAL_Y };
  const dx = x - targetGoal.x;
  const dy = y - targetGoal.y;
  return { ...shot, distMeters: Math.sqrt(dx * dx + dy * dy) };
}

/*******************************************
 * COMPONENTS
 *******************************************/
function LoadingSpinner({ message = 'Loading...' }) {
  return <div className="pdg-loading"><div className="pdg-spinner"></div><p>{message}</p></div>;
}

function EmptyState({ title, message }) {
  return <div className="pdg-empty"><h3>{title}</h3><p>{message}</p></div>;
}

function StatCard({ label, value }) {
  return (
    <div className="pdg-stat-card">
      <span className="pdg-stat-value">{value}</span>
      <span className="pdg-stat-label">{label}</span>
    </div>
  );
}

function GameSelector({ games, selectedGameIds, onToggleGame, onSelectAll, onDeselectAll }) {
  const [collapsed, setCollapsed] = useState(games.length > 12);
  const allSelected = games.every(g => selectedGameIds.includes(g.id));
  
  return (
    <div className="pdg-game-selector">
      <div className="pdg-game-header">
        <div className="pdg-game-title" onClick={() => setCollapsed(!collapsed)}>
          <h4>Games</h4>
          <span className="pdg-badge">{selectedGameIds.length} / {games.length}</span>
          <span className={`pdg-chevron ${collapsed ? '' : 'open'}`}>&#9660;</span>
        </div>
        <button className="pdg-btn-text" onClick={allSelected ? onDeselectAll : onSelectAll}>
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      {!collapsed && (
        <div className="pdg-game-grid">
          {games.map(game => (
            <label key={game.id} className={`pdg-game-item ${selectedGameIds.includes(game.id) ? 'selected' : ''}`}>
              <input type="checkbox" checked={selectedGameIds.includes(game.id)} onChange={() => onToggleGame(game.id)} />
              <span className="pdg-game-name">{game.gameName}</span>
              <span className="pdg-game-shots">{game.shotCount}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniLeaderboard({ title, data, sortKey, columns }) {
  const sortedData = useMemo(() => [...data].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0)).slice(0, 10), [data, sortKey]);

  return (
    <div className="pdg-mini-board">
      <div className="pdg-mini-header"><h4>{title}</h4></div>
      <div className="pdg-mini-table-wrap">
        <table className="pdg-mini-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              {columns.map(col => <th key={col.key}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, idx) => (
              <tr key={item.player}>
                <td className="pdg-rank">{idx + 1}</td>
                <td className="pdg-player-name"><Link to={`/player/${encodeURIComponent(item.player)}`}>{item.player}</Link></td>
                {columns.map(col => <td key={col.key}>{col.format ? col.format(item[col.key], item) : item[col.key]?.toFixed(2)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MainLeaderboard({ data }) {
  const [sortKey, setSortKey] = useState('Total_Points');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());

  const sorted = useMemo(() => {
    let filtered = data.filter(p => p.player.toLowerCase().includes(search.toLowerCase()));
    return filtered.sort((a, b) => sortDir === 'desc' ? (b[sortKey] || 0) - (a[sortKey] || 0) : (a[sortKey] || 0) - (b[sortKey] || 0));
  }, [data, sortKey, sortDir, search]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHeader = ({ k, children }) => (
    <th onClick={() => handleSort(k)} className="pdg-sortable">
      {children}{sortKey === k && <span className="pdg-sort-arrow">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>}
    </th>
  );

  return (
    <div className="pdg-main-board">
      <div className="pdg-board-header">
        <h3>Full Leaderboard</h3>
        <div className="pdg-search"><input type="text" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      <div className="pdg-table-wrap">
        <table className="pdg-table">
          <thead>
            <tr>
              <th></th><th>Player</th><th>Team</th>
              <SortHeader k="Total_Points">Pts</SortHeader>
              <SortHeader k="goals">Goals</SortHeader>
              <SortHeader k="xPoints">xP</SortHeader>
              <SortHeader k="xGoals">xG</SortHeader>
              <SortHeader k="shootingAttempts">Shots</SortHeader>
              <SortHeader k="accuracy">Acc%</SortHeader>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <React.Fragment key={p.player}>
                <tr onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(p.player) ? n.delete(p.player) : n.add(p.player); return n; })} className={expanded.has(p.player) ? 'pdg-row-expanded' : ''}>
                  <td className="pdg-expand-cell"><span className={`pdg-expand-icon ${expanded.has(p.player) ? 'open' : ''}`}>&#9654;</span></td>
                  <td><Link to={`/player/${encodeURIComponent(p.player)}`} onClick={e => e.stopPropagation()}>{p.player}</Link></td>
                  <td className="pdg-team">{p.team}</td>
                  <td className="pdg-highlight">{p.Total_Points}</td>
                  <td>{p.goals}</td>
                  <td className="pdg-dim">{p.xPoints?.toFixed(1)}</td>
                  <td className="pdg-dim">{p.xGoals?.toFixed(2)}</td>
                  <td>{p.shootingAttempts}</td>
                  <td><span className={`pdg-acc-badge ${p.accuracy >= 60 ? 'high' : p.accuracy >= 40 ? 'med' : 'low'}`}>{p.accuracy?.toFixed(0)}%</span></td>
                </tr>
                {expanded.has(p.player) && (
                  <tr className="pdg-detail-row">
                    <td colSpan="9">
                      <div className="pdg-position-grid">
                        {p.positionPerformance.map((pos, j) => (
                          <div key={j} className="pdg-position-card">
                            <strong>{pos.position}</strong>
                            <span>{pos.shots} shots | {pos.points} pts | {pos.goals} gls</span>
                            <span className="pdg-eff">{pos.efficiency?.toFixed(0)}% eff</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalibrationModal({ isOpen, onClose, stats, calibrationModel }) {
  if (!isOpen) return null;
  
  return (
    <div className="pdg-modal-overlay" onClick={onClose}>
      <div className="pdg-modal pdg-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="pdg-modal-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Model Calibration
          </h2>
          <button className="pdg-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="pdg-modal-body">
          {calibrationModel && (
            <div className="pdg-calibration-source">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>Using calibration data from <strong>{CALIBRATION_DATASET}</strong> ({calibrationModel.shotCount} shots)</span>
            </div>
          )}
          
          <p className="pdg-form-hint" style={{ marginBottom: '1.5rem' }}>
            Compare expected values (xP, xG) against actual results to assess model accuracy. 
            A calibration near 100% indicates well-calibrated predictions.
          </p>
          
          <div className="pdg-calibration-grid">
            <div className="pdg-calibration-card">
              <div className="pdg-calibration-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div className="pdg-calibration-header">
                <span>Expected Points (xP)</span>
                <span className={`pdg-calibration-badge ${Math.abs(stats.xpCalibration - 100) <= 10 ? 'good' : Math.abs(stats.xpCalibration - 100) <= 20 ? 'ok' : 'poor'}`}>
                  {stats.xpCalibration.toFixed(1)}%
                </span>
              </div>
              <div className="pdg-calibration-values">
                <div><span>Actual</span><strong>{stats.points}</strong></div>
                <div><span>Expected</span><strong>{stats.totalXP.toFixed(1)}</strong></div>
                <div><span>Difference</span><strong className={stats.xpDiff >= 0 ? 'positive' : 'negative'}>{stats.xpDiff >= 0 ? '+' : ''}{stats.xpDiff.toFixed(1)}</strong></div>
              </div>
              <div className={`pdg-calibration-status ${Math.abs(stats.xpCalibration - 100) <= 10 ? 'good' : Math.abs(stats.xpCalibration - 100) <= 20 ? 'ok' : 'poor'}`}>
                {Math.abs(stats.xpCalibration - 100) <= 10 ? '✓ Well calibrated' : 
                 stats.xpCalibration > 100 ? '↑ Players outperforming model' : 
                 '↓ Players underperforming model'}
              </div>
            </div>
            
            <div className="pdg-calibration-card">
              <div className="pdg-calibration-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M12 8v8M8 12h8"/>
                </svg>
              </div>
              <div className="pdg-calibration-header">
                <span>Expected Goals (xG)</span>
                <span className={`pdg-calibration-badge ${Math.abs(stats.xgCalibration - 100) <= 15 ? 'good' : Math.abs(stats.xgCalibration - 100) <= 30 ? 'ok' : 'poor'}`}>
                  {stats.xgCalibration.toFixed(1)}%
                </span>
              </div>
              <div className="pdg-calibration-values">
                <div><span>Actual</span><strong>{stats.goals}</strong></div>
                <div><span>Expected</span><strong>{stats.totalXG.toFixed(1)}</strong></div>
                <div><span>Difference</span><strong className={stats.xgDiff >= 0 ? 'positive' : 'negative'}>{stats.xgDiff >= 0 ? '+' : ''}{stats.xgDiff.toFixed(1)}</strong></div>
              </div>
              <div className={`pdg-calibration-status ${Math.abs(stats.xgCalibration - 100) <= 15 ? 'good' : Math.abs(stats.xgCalibration - 100) <= 30 ? 'ok' : 'poor'}`}>
                {Math.abs(stats.xgCalibration - 100) <= 15 ? '✓ Well calibrated' : 
                 stats.xgCalibration > 100 ? '↑ Players outperforming model' : 
                 '↓ Players underperforming model'}
              </div>
            </div>
          </div>
          
          <div className="pdg-calibration-legend">
            <h4>Understanding Calibration</h4>
            <div className="pdg-legend-items">
              <div className="pdg-legend-item">
                <span className="pdg-calibration-badge good">90-110%</span>
                <span>Excellent - Model predictions closely match reality</span>
              </div>
              <div className="pdg-legend-item">
                <span className="pdg-calibration-badge ok">80-120%</span>
                <span>Good - Minor deviations, acceptable for analysis</span>
              </div>
              <div className="pdg-legend-item">
                <span className="pdg-calibration-badge poor">&lt;80% or &gt;120%</span>
                <span>Needs Review - Consider retraining the model</span>
              </div>
            </div>
          </div>
        </div>
        <div className="pdg-modal-footer">
          <button className="pdg-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ isOpen, onClose, datasets, currentConfig, onSave, userId, activeUserId }) {
  const ADMIN_EMAIL = 'fetzmitchell@gmail.com';
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState(currentConfig?.userId || DEFAULT_USER_ID);
  const [selectedDataset, setSelectedDataset] = useState(currentConfig?.datasetName || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { 
    if (currentConfig) { 
      setSelectedUser(currentConfig.userId || DEFAULT_USER_ID); 
      setSelectedDataset(currentConfig.datasetName || ''); 
    } 
  }, [currentConfig]);

  // Reset auth state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsAuthenticated(false);
      setEmail('');
      setPassword('');
      setAuthError('');
    }
  }, [isOpen]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    // Check if email is the admin email
    if (email !== ADMIN_EMAIL) {
      setAuthError('Access denied. Admin privileges required.');
      return;
    }
    
    setAuthLoading(true);
    
    try {
      // Use Firebase to verify the credentials
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Auth error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError('Invalid password');
      } else if (err.code === 'auth/user-not-found') {
        setAuthError('User not found');
      } else if (err.code === 'auth/too-many-requests') {
        setAuthError('Too many attempts. Please try again later.');
      } else {
        setAuthError(err.message || 'Authentication failed');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUser || !selectedDataset) { 
      Swal.fire('Error', 'Please fill in both fields', 'error'); 
      return; 
    }
    setSaving(true);
    try {
      await setDoc(doc(firestore, PUBLIC_CONFIG_PATH), { 
        userId: selectedUser, 
        datasetName: selectedDataset, 
        updatedAt: new Date().toISOString(), 
        updatedBy: userId 
      });
      onSave({ userId: selectedUser, datasetName: selectedDataset });
      Swal.fire('Success!', 'Public dataset configuration saved.', 'success');
      onClose();
    } catch (err) { 
      Swal.fire('Error', err.message, 'error'); 
    } finally { 
      setSaving(false); 
    }
  };

  if (!isOpen) return null;
  
  return (
    <div className="pdg-modal-overlay" onClick={onClose}>
      <div className="pdg-modal" onClick={e => e.stopPropagation()}>
        <div className="pdg-modal-header">
          <h2>Admin Panel</h2>
          <button className="pdg-modal-close" onClick={onClose}>×</button>
        </div>
        
        {!isAuthenticated ? (
          // Login Form
          <div className="pdg-modal-body">
            <div className="pdg-form-section">
              <h3>Admin Login</h3>
              <p className="pdg-form-hint">Please enter your admin credentials to continue.</p>
              
              <form onSubmit={handleLogin}>
                <div className="pdg-form-group">
                  <label>Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="Enter admin email..."
                    autoComplete="email"
                  />
                </div>
                <div className="pdg-form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Enter password..."
                    autoComplete="current-password"
                  />
                </div>
                
                {authError && (
                  <div className="pdg-auth-error">{authError}</div>
                )}
                
                <div className="pdg-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none', background: 'transparent' }}>
                  <button type="button" className="pdg-btn-secondary" onClick={onClose}>Cancel</button>
                  <button type="submit" className="pdg-btn-primary" disabled={authLoading}>
                    {authLoading ? 'Verifying...' : 'Login'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          // Settings Form (after authentication)
          <>
            <div className="pdg-modal-body">
              <div className="pdg-form-section">
                <h3>Public Dataset Settings</h3>
                <p className="pdg-form-hint">Choose which dataset visitors see by default on the Player Analytics page.</p>
                
                <div className="pdg-form-group">
                  <label>Default Dataset</label>
                  <select value={selectedDataset} onChange={e => setSelectedDataset(e.target.value)}>
                    <option value="">-- Select Dataset --</option>
                    {datasets.map(ds => (
                      <option key={ds.datasetName} value={ds.datasetName}>
                        {ds.datasetName} ({ds.games.length} games)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="pdg-current-config">
                  <h4>Current Configuration</h4>
                  <p><strong>User ID:</strong> {currentConfig?.userId || DEFAULT_USER_ID}</p>
                  <p><strong>Dataset:</strong> {currentConfig?.datasetName || 'Not set'}</p>
                </div>
              </div>
            </div>
            <div className="pdg-modal-footer">
              <button className="pdg-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="pdg-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/*******************************************
 * MAIN COMPONENT
 *******************************************/
export default function PlayerDataGAA() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const isAdmin = currentUser && ADMIN_USERS.includes(currentUser.uid);
  
  const { config: publicConfig, loading: configLoading, setConfig: setPublicConfig } = useFetchPublicConfig();
  const { calibrationModel, loading: calibrationLoading } = useCalibrationData();
  const [dataSource, setDataSource] = useState('public');
  const [selectedDatasetName, setSelectedDatasetName] = useState('');
  const [selectedGameIds, setSelectedGameIds] = useState([]);
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState('All');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  
  // Determine active user ID based on data source
  const activeUserId = useMemo(() => {
    if (dataSource === 'own' && currentUser) return currentUser.uid;
    return publicConfig?.userId || DEFAULT_USER_ID;
  }, [dataSource, currentUser, publicConfig]);

  const { datasetStructure, loading: structureLoading } = useFetchDatasetStructure(activeUserId);
  const currentDataset = useMemo(() => datasetStructure.find(d => d.datasetName === selectedDatasetName), [datasetStructure, selectedDatasetName]);
  const gamesInDataset = currentDataset?.games || [];
  const { combinedData, loading: dataLoading } = useFetchMultipleGames(activeUserId, selectedGameIds);

  // Auto-select default dataset: AllIreland2025 or public config or first available
  useEffect(() => {
    if (datasetStructure.length > 0 && !selectedDatasetName) {
      // Priority 1: Try AllIreland2025
      const defaultDs = datasetStructure.find(d => d.datasetName === DEFAULT_DATASET);
      if (defaultDs) {
        setSelectedDatasetName(DEFAULT_DATASET);
        return;
      }
      
      // Priority 2: Try public config dataset
      if (dataSource === 'public' && publicConfig?.datasetName) {
        const configDs = datasetStructure.find(d => d.datasetName === publicConfig.datasetName);
        if (configDs) {
          setSelectedDatasetName(publicConfig.datasetName);
          return;
        }
      }
      
      // Priority 3: First available dataset
      setSelectedDatasetName(datasetStructure[0].datasetName);
    }
  }, [datasetStructure, selectedDatasetName, dataSource, publicConfig]);

  // Auto-select all games when dataset changes
  useEffect(() => { 
    currentDataset ? setSelectedGameIds(currentDataset.games.map(g => g.id)) : setSelectedGameIds([]); 
  }, [currentDataset]);

  const handleToggleGame = useCallback(id => setSelectedGameIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]), []);
  const handleSelectAll = useCallback(() => currentDataset && setSelectedGameIds(currentDataset.games.map(g => g.id)), [currentDataset]);
  const handleDeselectAll = useCallback(() => setSelectedGameIds([]), []);

  const formattedLeaderboard = useMemo(() => {
    if (!combinedData || combinedData.length === 0) return [];
    const shotsFiltered = combinedData.filter(shot => {
      const matchesYear = selectedYear === 'All' || new Date(shot.matchDate).getFullYear().toString() === selectedYear;
      const matchesTeam = selectedTeam === 'All' || shot.team === selectedTeam;
      return matchesYear && matchesTeam;
    });
    if (shotsFiltered.length === 0) return [];

    const agg = shotsFiltered.reduce((acc, shot) => {
      const name = shot.playerName || 'Unknown';
      if (!acc[name]) acc[name] = { player: name, team: shot.team || 'Unknown', points: 0, goals: 0, xPoints: 0, xGoals: 0, positionPerformance: {}, shootingAttempts: 0, shootingScored: 0, goalAttempts: 0 };
      const p = acc[name];
      const pos = shot.position || 'Unknown';
      if (!p.positionPerformance[pos]) p.positionPerformance[pos] = { shots: 0, points: 0, goals: 0 };
      p.positionPerformance[pos].shots += 1;

      const translated = translateShotToOneSide(shot);
      p.shootingAttempts += 1;

      const actionLower = (shot.action || '').toLowerCase();
      const typeLower = (shot.type || '').toLowerCase();
      const isPointAction = actionLower === 'point';
      const isGoalAction = actionLower === 'goal';
      const isSetPlay = ['free', 'fortyfive', '45', 'offensive mark', 'mark'].includes(actionLower);
      const isSetPlayScore = isSetPlay && typeLower === 'score';
      const isScore = isPointAction || isGoalAction || isSetPlayScore;
      const isGoalAttempt = isGoalAction || typeLower === 'goal' || typeLower === 'saved';
      const isPointAttempt = !isGoalAttempt; // All non-goal shots are point attempts

      if (isScore) p.shootingScored += 1;
      if (isGoalAttempt) p.goalAttempts += 1;
      if (isPointAction) { p.points += 1; p.positionPerformance[pos].points += 1; }
      else if (isGoalAction) { p.goals += 1; p.positionPerformance[pos].goals += 1; }
      else if (isSetPlayScore) p.points += 1;

      // xP: Only for point attempts (non-goal shots)
      // xG: Only for goal attempts
      if (isPointAttempt) {
        p.xPoints += calculateXP(shot, translated.distMeters, calibrationModel);
      }
      if (isGoalAttempt) {
        p.xGoals += calculateXG(shot, translated.distMeters, calibrationModel);
      }
      return acc;
    }, {});

    return Object.values(agg).map(p => {
      const accuracy = p.shootingAttempts > 0 ? (p.shootingScored / p.shootingAttempts) * 100 : 0;
      const pointsPerShot = p.shootingAttempts > 0 ? p.points / p.shootingAttempts : 0;
      const goalsPerAttempt = p.goalAttempts > 0 ? p.goals / p.goalAttempts : 0;
      const positionPerformance = Object.entries(p.positionPerformance).map(([pos, stats]) => ({ position: pos, ...stats, efficiency: stats.shots > 0 ? ((stats.points + stats.goals * 3) / stats.shots) * 100 : 0 }));
      return { ...p, positionPerformance, Total_Points: p.points, accuracy, pointsPerShot, goalsPerAttempt };
    });
  }, [combinedData, selectedYear, selectedTeam, calibrationModel]);

  const goalsData = useMemo(() => formattedLeaderboard.map(p => ({ player: p.player, goals: p.goals, xGoals: p.xGoals, goalAttempts: p.goalAttempts, goalsPerAttempt: p.goalsPerAttempt })), [formattedLeaderboard]);
  const pointsData = useMemo(() => formattedLeaderboard.map(p => ({ player: p.player, points: p.points, xPoints: p.xPoints, shots: p.shootingAttempts, pointsPerShot: p.pointsPerShot })), [formattedLeaderboard]);
  const accuracyData = useMemo(() => formattedLeaderboard.map(p => ({ player: p.player, accuracy: p.accuracy, scored: p.shootingScored, attempts: p.shootingAttempts })), [formattedLeaderboard]);

  const availableYears = useMemo(() => { const years = new Set(); combinedData.forEach(s => { if (s.matchDate) years.add(new Date(s.matchDate).getFullYear()); }); return Array.from(years).sort((a, b) => b - a); }, [combinedData]);
  const availableTeams = useMemo(() => { const teams = new Set(); combinedData.forEach(s => { if (s.team) teams.add(s.team); }); return Array.from(teams).sort(); }, [combinedData]);

  const stats = useMemo(() => {
    const players = formattedLeaderboard.length;
    const shots = formattedLeaderboard.reduce((s, p) => s + p.shootingAttempts, 0);
    const points = formattedLeaderboard.reduce((s, p) => s + p.points, 0);
    const goals = formattedLeaderboard.reduce((s, p) => s + p.goals, 0);
    const totalXP = formattedLeaderboard.reduce((s, p) => s + (p.xPoints || 0), 0);
    const totalXG = formattedLeaderboard.reduce((s, p) => s + (p.xGoals || 0), 0);
    const avgAcc = players ? formattedLeaderboard.reduce((s, p) => s + p.accuracy, 0) / players : 0;
    
    // Calibration metrics
    const xpDiff = points - totalXP;
    const xgDiff = goals - totalXG;
    const xpCalibration = totalXP > 0 ? (points / totalXP * 100) : 0; // 100% = perfectly calibrated
    const xgCalibration = totalXG > 0 ? (goals / totalXG * 100) : 0;
    
    return { players, shots, points, goals, totalXP, totalXG, avgAcc, xpDiff, xgDiff, xpCalibration, xgCalibration };
  }, [formattedLeaderboard]);

  if (configLoading || structureLoading || calibrationLoading) return <div className="pdg-page"><LoadingSpinner message="Loading..." /></div>;

  return (
    <div className="pdg-page">
      <header className="pdg-header">
        <div><h1>Player Analytics</h1><p>GAA Performance Dashboard</p></div>
        <div className="pdg-header-buttons">
          <button className="pdg-admin-btn" onClick={() => setShowCalibration(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Model Accuracy
          </button>
          <button className="pdg-admin-btn" onClick={() => setShowAdmin(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
        </div>
      </header>

      <section className="pdg-controls">
        <div className="pdg-toggle-group">
          <button className={`pdg-toggle ${dataSource === 'public' ? 'active' : ''}`} onClick={() => setDataSource('public')}>Public Data</button>
          {currentUser && <button className={`pdg-toggle ${dataSource === 'own' ? 'active' : ''}`} onClick={() => setDataSource('own')}>My Data</button>}
        </div>
        <div className="pdg-select-group">
          <label>Dataset</label>
          <select value={selectedDatasetName} onChange={e => setSelectedDatasetName(e.target.value)}>
            <option value="">Select a dataset...</option>
            {datasetStructure.map(ds => <option key={ds.datasetName} value={ds.datasetName}>{ds.datasetName} ({ds.games.length} games)</option>)}
          </select>
        </div>
      </section>

      {selectedDatasetName && gamesInDataset.length > 0 && <GameSelector games={gamesInDataset} selectedGameIds={selectedGameIds} onToggleGame={handleToggleGame} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} />}

      {selectedGameIds.length > 0 && (
        <section className="pdg-filters">
          <div className="pdg-select-group"><label>Year</label><select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}><option value="All">All Years</option>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
          <div className="pdg-select-group"><label>Team</label><select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}><option value="All">All Teams</option>{availableTeams.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        </section>
      )}

      {dataLoading && <LoadingSpinner message="Loading player data..." />}
      {!dataLoading && !selectedDatasetName && <EmptyState title="No Dataset Selected" message="Choose a dataset above to begin" />}
      {!dataLoading && selectedDatasetName && selectedGameIds.length === 0 && <EmptyState title="No Games Selected" message="Select games to view player stats" />}

      {!dataLoading && selectedGameIds.length > 0 && formattedLeaderboard.length > 0 && (
        <>
          <section className="pdg-stats-row">
            <StatCard label="Players" value={stats.players} />
            <StatCard label="Shots" value={stats.shots} />
            <StatCard label="Points" value={stats.points} />
            <StatCard label="Goals" value={stats.goals} />
            <StatCard label="Avg Accuracy" value={`${stats.avgAcc.toFixed(1)}%`} />
          </section>

          <section className="pdg-mini-grid">
            <MiniLeaderboard title="Most Points" data={pointsData} sortKey="points" columns={[{ key: 'points', label: 'Pts', format: v => v?.toFixed(0) }, { key: 'xPoints', label: 'xP', format: v => v?.toFixed(1) }, { key: 'shots', label: 'Shots', format: v => v?.toFixed(0) }, { key: 'pointsPerShot', label: 'Pts/Shot', format: v => v?.toFixed(2) }]} />
            <MiniLeaderboard title="Most Goals" data={goalsData} sortKey="goals" columns={[{ key: 'goals', label: 'Goals', format: v => v?.toFixed(0) }, { key: 'xGoals', label: 'xG', format: v => v?.toFixed(2) }, { key: 'goalAttempts', label: 'Att', format: v => v?.toFixed(0) }, { key: 'goalsPerAttempt', label: 'G/Att', format: v => v?.toFixed(2) }]} />
            <MiniLeaderboard title="Best Accuracy" data={accuracyData} sortKey="accuracy" columns={[{ key: 'scored', label: 'Scored', format: v => v?.toFixed(0) }, { key: 'attempts', label: 'Att', format: v => v?.toFixed(0) }, { key: 'accuracy', label: '%', format: v => `${v?.toFixed(0)}%` }]} />
          </section>

          <MainLeaderboard data={formattedLeaderboard} />
        </>
      )}

      <CalibrationModal isOpen={showCalibration} onClose={() => setShowCalibration(false)} stats={stats} calibrationModel={calibrationModel} />
      <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} datasets={datasetStructure} currentConfig={publicConfig} onSave={setPublicConfig} userId={currentUser?.uid} activeUserId={activeUserId} />
    </div>
  );
}