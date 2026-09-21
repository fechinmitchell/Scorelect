import React, { useMemo, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { firestore } from './firebase';
import { getAuth } from 'firebase/auth';
import { useCalibrationModel, calculateXP, calculateXG } from './components/Model2026';

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
const ARC_CUTOFF = 20; // two-point arc stops at the 20m line
const MISS_REGEX = /miss|wide|short|blocked|post/;
const POINT_SCORE_ACTIONS = ['point', 'free', 'fortyfive', '45', 'offensive mark', 'mark'];

// Placed balls: frees, 45s, penalties and marks — any outcome
const isPlacedBall = (act) => /free|fortyfive|\b45\b|penalty|pen miss|mark/.test(act);

function getMatchTeams(gameName = '') {
  const parts = String(gameName).split('_');
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : gameName;
}

const LEADERBOARD_COLUMNS = [
  { key: 'totalShots',  label: 'Shots',        decimals: 0, perGame: true },
  { key: 'xGoals',      label: 'xG',           decimals: 2, perGame: true },
  { key: 'goals',       label: 'Goals',        decimals: 0, perGame: true, compareTo: 'xGoals' },
  { key: 'xPoints',     label: 'xP',           decimals: 1, perGame: true },
  { key: 'points',      label: 'Points',       decimals: 0, perGame: true, compareTo: 'xPoints' },
  { key: 'xScore',      label: 'xScore',       decimals: 1, perGame: true },
  { key: 'score',       label: 'Score',        decimals: 0, perGame: true, compareTo: 'xScore' },
  { key: 'diff',        label: 'Diff',         decimals: 1, perGame: true, signed: true },
  { key: 'twoPointers', label: '2PT',          decimals: 0, perGame: true },
  { key: 'onePointers', label: '1PT',          decimals: 0, perGame: true },
  { key: 'avgDist',     label: 'Avg Dist (m)', decimals: 1, perGame: false },
  { key: 'misses',      label: 'Misses',       decimals: 0, perGame: true },
  { key: 'accuracy',    label: 'Accuracy',     decimals: 0, perGame: false },
];

const GREEN = '#50FA7B';
const RED = '#FF5555';
const WHITE = '#FFFFFF';

/*******************************************
 * CALIBRATION DATA HOOK
 * Builds probability model from historical data
 *******************************************/


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
            gameDataArray.forEach(shot => allShots.push({
              ...shot,
              _gameId: gameId,
              gameName: data.gameName || gameId,
              matchDate: shot.matchDate || data.matchDate || null,
            }));
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

function MainLeaderboard({ data, userId, gameIds }) {
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [perGame, setPerGame] = useState(false);

  const valueFor = (p, col) => {
    const v = p[col.key] || 0;
    return perGame && col.perGame ? v / (p.games || 1) : v;
  };

  const sorted = useMemo(() => {
    const filtered = data.filter(p =>
      String(p.player ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (sortKey === 'player' || sortKey === 'team') {
        const cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const col = LEADERBOARD_COLUMNS.find(c => c.key === sortKey);
      if (!col) return 0;
      const div = (p) => (perGame && col.perGame ? (p.games || 1) : 1);
      const av = (a[col.key] || 0) / div(a);
      const bv = (b[col.key] || 0) / div(b);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, sortKey, sortDir, search, perGame]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const arrow = (key) => sortKey === key
    ? <span className="pdg-sort-arrow">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
    : null;

  const fmt = (p, col) => {
    if (col.key === 'accuracy') return `${(p.accuracy || 0).toFixed(0)}%`;
    const d = perGame && col.perGame ? Math.max(col.decimals, 1) : col.decimals;
    const text = valueFor(p, col).toFixed(d);
    return col.signed && Number(text) > 0 ? `+${text}` : text;
  };

  const cellColour = (p, col) => {
    if (col.compareTo) {
      return (p[col.compareTo] || 0) > (p[col.key] || 0) ? RED : GREEN;
    }
    if (col.signed) {
      const v = Number(valueFor(p, col).toFixed(col.decimals));
      return v > 0 ? GREEN : v < 0 ? RED : WHITE;
    }
    return WHITE;
  };

  return (
    <div className="pdg-main-board">
      <div className="pdg-board-header">
        <div>
          <h3>Full Leaderboard {perGame ? '(Per Game)' : '(Totals)'}</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#b0b0b0' }}>
            Click on a player to view trends
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pdg-toggle-group">
            <button className={`pdg-toggle ${!perGame ? 'active' : ''}`} onClick={() => setPerGame(false)}>Totals</button>
            <button className={`pdg-toggle ${perGame ? 'active' : ''}`} onClick={() => setPerGame(true)}>Per Game</button>
          </div>
          <div className="pdg-search">
            <input type="text" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="pdg-table-wrap">
        <table className="pdg-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('team')} className="pdg-sortable">Team{arrow('team')}</th>
              <th onClick={() => handleSort('player')} className="pdg-sortable">Player{arrow('player')}</th>
              {LEADERBOARD_COLUMNS.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="pdg-sortable">
                  {col.label}{arrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={`${p.team}-${p.player}`}>
                <td style={{ color: WHITE }}>{p.team}</td>
                <td>
                  <Link
                    to="/team-trends"
                    state={{ teamName: p.team, playerName: p.player, userId, gameIds }}
                    style={{ color: WHITE }}
                  >
                    {p.player}
                  </Link>
                </td>
                {LEADERBOARD_COLUMNS.map(col => (
                  <td key={col.key} style={{ color: cellColour(p, col), fontWeight: col.compareTo || col.signed ? 600 : 400 }}>
                    {fmt(p, col)}
                  </td>
                ))}
              </tr>
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
  const { calibrationModel } = useCalibrationModel();
  const [dataSource, setDataSource] = useState('public');
  const [selectedDatasetName, setSelectedDatasetName] = useState('');
  const [selectedGameIds, setSelectedGameIds] = useState([]);
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState('All');
  const [shotType, setShotType] = useState('all');
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
      const act = (shot.action || '').toLowerCase().trim();
      const matchesYear = selectedYear === 'All' ||
        (shot.matchDate && new Date(shot.matchDate).getFullYear().toString() === selectedYear);
      const matchesTeam = selectedTeam === 'All' || shot.team === selectedTeam;
      const placed = isPlacedBall(act);
      const matchesType = shotType === 'all' || (shotType === 'placed' ? placed : !placed);
      return matchesYear && matchesTeam && matchesType;
    });
    if (shotsFiltered.length === 0) return [];

    const agg = {};

    shotsFiltered.forEach(shot => {
      const name = String(shot.playerName ?? '').trim() || 'Unknown';
      const team = shot.team || 'Unknown';
      const key = `${team}__${name}`;
      if (!agg[key]) {
        agg[key] = {
          player: name, team,
          points: 0, goals: 0, xPoints: 0, xGoals: 0,
          twoPointers: 0, onePointers: 0, misses: 0,
          totalShots: 0, scored: 0, distAcc: 0,
          gamesSet: new Set(),
        };
      }
      const p = agg[key];
      p.totalShots += 1;
      p.gamesSet.add(`${getMatchTeams(shot.gameName || '')}__${shot.matchDate || ''}`);

      const act = (shot.action || '').toLowerCase().trim();
      const typeLower = (shot.type || '').toLowerCase();

      const translated = translateShotToOneSide(shot);
      const dist = translated.distMeters;
      p.distAcc += dist;
      const x = parseFloat(shot.x) || 0;
      const fromEndline = x <= MIDLINE_X ? x : GOAL_X - x;

      const isMiss = MISS_REGEX.test(act);
      const isGoalAttempt = act.includes('goal') || act === 'pen miss' || typeLower === 'goal' || typeLower === 'saved';
      const isFortyFive = act.includes('45') || act.includes('fortyfive');
      const twoPtZone = !isFortyFive && dist >= ARC_DISTANCE_METERS && fromEndline >= ARC_CUTOFF;

      // Expected values — every attempt contributes
      if (isGoalAttempt) {
        p.xGoals += calculateXG(shot, null, calibrationModel);
      } else {
        p.xPoints += calculateXP(shot, null, calibrationModel) * (twoPtZone ? 2 : 1);
      }

      // Actual outcomes
      if (!isMiss && (act === 'goal' || act === 'penalty goal')) {
        p.goals += 1;
        p.scored += 1;
      } else if (!isMiss && POINT_SCORE_ACTIONS.includes(act)) {
        const value = twoPtZone ? 2 : 1;
        p.points += value;
        if (value === 2) p.twoPointers += 1;
        else p.onePointers += 1;
        p.scored += 1;
      } else if (isMiss) {
        p.misses += 1;
      }
    });

    return Object.values(agg).map(p => {
      const games = p.gamesSet.size;
      delete p.gamesSet;
      const score = p.goals * 3 + p.points;
      const xScore = p.xPoints + p.xGoals * 3;
      return {
        ...p,
        games,
        score,
        xScore,
        diff: score - xScore,
        avgDist: p.totalShots > 0 ? p.distAcc / p.totalShots : 0,
        accuracy: p.totalShots > 0 ? (p.scored / p.totalShots) * 100 : 0,
        Total_Points: p.points,
      };
    });
  }, [combinedData, selectedYear, selectedTeam, shotType, calibrationModel]);


 
  const availableYears = useMemo(() => { const years = new Set(); combinedData.forEach(s => { if (s.matchDate) years.add(new Date(s.matchDate).getFullYear()); }); return Array.from(years).sort((a, b) => b - a); }, [combinedData]);
  const availableTeams = useMemo(() => { const teams = new Set(); combinedData.forEach(s => { if (s.team) teams.add(s.team); }); return Array.from(teams).sort(); }, [combinedData]);

  const stats = useMemo(() => {
    const players = formattedLeaderboard.length;
    const shots = formattedLeaderboard.reduce((s, p) => s + p.totalShots, 0);
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

  if (configLoading || structureLoading) return <div className="pdg-page"><LoadingSpinner message="Loading..." /></div>;

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
          <div className="pdg-select-group">
            <label>Shot Type</label>
            <div className="pdg-toggle-group">
              {[['all', 'All'], ['play', 'From Play'], ['placed', 'Placed Balls']].map(([v, l]) => (
                <button key={v} className={`pdg-toggle ${shotType === v ? 'active' : ''}`} onClick={() => setShotType(v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
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

          

          <MainLeaderboard data={formattedLeaderboard} userId={activeUserId} gameIds={selectedGameIds} />
        </>
      )}

      <CalibrationModal isOpen={showCalibration} onClose={() => setShowCalibration(false)} stats={stats} calibrationModel={calibrationModel} />
      <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} datasets={datasetStructure} currentConfig={publicConfig} onSave={setPublicConfig} userId={currentUser?.uid} activeUserId={activeUserId} />
    </div>
  );
}