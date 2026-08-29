import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { firestore } from './firebase';
import { getAuth } from 'firebase/auth';
import axios from 'axios';
import { useCalibrationModel, calculateXP, calculateXG, _engineerFeatures } from './components/Model2026';

import './TeamDataGAA.css';

/*******************************************
 * CONSTANTS
 *******************************************/
const ADMIN_USERS = ['w9ZkqaYVM3dKSqqjWHLDVyh5sVg2'];
const PUBLIC_CONFIG_PATH = 'config/publicDataset';
const DEFAULT_USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
const DEFAULT_DATASET = 'AllIreland2025';
const BASE_API_URL = process.env.REACT_APP_API_URL || 'https://scorelect.onrender.com';

// GAA pitch dimensions
const GOAL_X = 145;
const GOAL_Y = 44;
const MIDLINE_X = 72.5;

/*******************************************
 * HELPER: parseJSONNoNaN
 *******************************************/
function parseJSONNoNaN(response) {
  return response.text().then((rawText) => {
    const safeText = rawText
      .replace(/\bNaN\b/g, 'null')
      .replace(/\bInfinity\b/g, '999999999')
      .replace(/\b-Infinity\b/g, '-999999999');
    return JSON.parse(safeText);
  });
}

/*******************************************
 * HELPER: translateShotToOneSide
 *******************************************/
function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = shot.side === 'Left' ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters: Math.max(0, distMeters) };
}



function calculateTwoPointerValue(action, distanceMeters) {
  const act = String(action || '').toLowerCase().trim();
  if (act === 'goal' || act === 'penalty goal') return 3;
  const scoringActions = ['point', 'free', 'offensive mark', '45', 'fortyfive'];
  const isScoringShot = scoringActions.some(a => act.includes(a));
  if (!isScoringShot) return 1;
  const isFrom45 = act.includes('45') || act.includes('fortyfive');
  if (isFrom45) return 1;
  if (distanceMeters >= 40) return 2;
  return 1;
}

function getMatchTeams(gameName = '') {
  const parts = String(gameName).split('_');
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : gameName;
}

/*******************************************
 * MODEL SELECTOR COMPONENT
 *******************************************/
function ModelSelector({ 
  onModelApplied, 
  datasetName = '', 
  shotData = [], 
  disabled = false,
  activeModel = null,
}) {
  const auth = getAuth();
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('default');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);


  // Fetch available models
  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      const response = await axios.post(
        `${BASE_API_URL}/get-model-history`,
        { uid: user.uid },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const history = response.data.history || [];
      const validModels = history
        .filter(m => m.metrics && (m.config || m.algorithm))
        .sort((a, b) => (b.metrics?.accuracy || 0) - (a.metrics?.accuracy || 0));
      
      setModels(validModels);
    } catch (err) {
      console.error('Error fetching models:', err);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleModelChange = async (e) => {
    const modelId = e.target.value;
    setSelectedModelId(modelId);
    
    if (modelId === 'default') {
      onModelApplied?.(null, null);
      return;
    }
    
    const model = models.find(m => m.id === modelId);
    if (!model || shotData.length === 0) return;

    try {
      setApplying(true);
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      
      const response = await axios.post(
        `${BASE_API_URL}/api/model-lab/predict`,
        {
          uid: user.uid,
          model_config: model.config || {
            algorithm: model.algorithm,
            features: model.features_used || ['dist', 'angle_abs', 'pressure_value', 'is_setplay'],
          },
          shots: shotData,
          training_dataset: model.dataset_name || model.source_dataset,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        onModelApplied?.(response.data.predictions, model);
        Swal.fire({
          title: 'Model Applied!',
          text: `${model.run_name || model.algorithm} applied to ${shotData.length} shots`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      console.error('Error applying model:', err);
      Swal.fire('Error', 'Failed to apply model', 'error');
    } finally {
      setApplying(false);
    }
  };

  const formatModelName = (model) => {
    if (model.run_name) return model.run_name;
    if (model.algorithm) return model.algorithm.replace(/_/g, ' ');
    return 'Unnamed Model';
  };

  if (loading) {
    return (
      <div className="model-selector-container">
        <span className="model-selector-loading">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="model-selector-container">
      <label className="model-selector-label">
        <span>🧪</span>
        xP/xG Model:
      </label>
      
      <select
        className="model-selector-select"
        value={selectedModelId}
        onChange={handleModelChange}
        disabled={disabled || applying}
      >
        <option value="default">Default Model (Distance-based)</option>
        {models.length > 0 && (
          <optgroup label="Your Trained Models">
            {models.slice(0, 20).map((model, index) => (
              <option key={model.id} value={model.id}>
                {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`} {formatModelName(model)} 
                ({((model.metrics?.accuracy || 0) * 100).toFixed(1)}%)
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {applying && (
        <span className="model-selector-applying">
          <span className="model-selector-spinner"></span>
          Applying...
        </span>
      )}

      {activeModel && !applying && (
        <span className="model-selector-active">
          ✓ {formatModelName(activeModel)}
        </span>
      )}
    </div>
  );
}

/*******************************************
 * FETCH PUBLIC CONFIG HOOK
 *******************************************/
function useFetchPublicConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const docRef = doc(firestore, PUBLIC_CONFIG_PATH);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data());
        }
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

/*******************************************
 * FETCH DATASET STRUCTURE HOOK
 *******************************************/
function useFetchDatasetStructure(userId) {
  const [datasetStructure, setDatasetStructure] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStructure() {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      try {
        const gamesCollectionRef = collection(firestore, `savedGames/${userId}/games`);
        const snapshot = await getDocs(gamesCollectionRef);
        
        const datasets = {};
        
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const datasetName = data.datasetName || 'Unnamed Dataset';
          const gameId = docSnap.id;
          const gameName = data.gameName || gameId;
          const matchDate = data.matchDate || null;
          const sport = data.sport || 'GAA';
          const gameData = data.gameData || [];
          const shotCount = Array.isArray(gameData) ? gameData.length : Object.keys(gameData).length;
          
          if (!datasets[datasetName]) {
            datasets[datasetName] = { datasetName, games: [] };
          }
          
          datasets[datasetName].games.push({ 
            id: gameId, 
            name: gameName,
            gameName,
            matchDate, 
            sport,
            shotCount
          });
        });
        
        const structureArray = Object.values(datasets);
        setDatasetStructure(structureArray);
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

/*******************************************
 * FETCH MULTIPLE GAMES HOOK
 *******************************************/
function useFetchMultipleGames(userId, gameIds) {
  const [combinedData, setCombinedData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGames() {
      if (!userId || gameIds.length === 0) {
        setCombinedData([]);
        setLoading(false);
        return;
      }

      try {
        const allData = [];
        
        for (const gameId of gameIds) {
          const gameDocRef = doc(firestore, `savedGames/${userId}/games/${gameId}`);
          const docSnap = await getDoc(gameDocRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            const gameData = data.gameData || [];
            const gameDataArray = Array.isArray(gameData) ? gameData : Object.values(gameData);
            
            const enrichedData = gameDataArray.map(item => ({
              ...item,
              gameName: data.gameName || gameId,
              matchDate: data.matchDate || null,
              gameId: gameId
            }));
            
            allData.push(...enrichedData);
          }
        }
        
        setCombinedData(allData);
      } catch (err) {
        console.error('Error fetching games:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchGames();
  }, [userId, gameIds]);

  return { combinedData, loading };
}

/*******************************************
 * LOADING & ERROR UI
 *******************************************/
function LoadingIndicator({ message = 'Loading data...' }) {
  return (
    <div className="team-data-loading-container">
      <div className="team-data-spinner"></div>
      <div className="team-data-loading-text">{message}</div>
    </div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="error-container">
      <p>{message}</p>
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="team-data-empty">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

/*******************************************
 * MiniLeaderboard Component
 *******************************************/
function MiniLeaderboard({
  title,
  data,
  actualKey,
  expectedKey,
  useDifference = false,
  differenceLabel = 'Difference (Actual - Expected)',
  hideCalcColumn = false,
}) {
  const sorted = [...data].sort((a, b) => {
    if (useDifference) {
      return (b[actualKey] - b[expectedKey]) - (a[actualKey] - a[expectedKey]);
    }
    return b[actualKey] - a[actualKey];
  }).slice(0, 5);

  return (
    <div className="mini-leaderboard">
      <div className="mini-leaderboard-header">
        <h4 className="mini-leaderboard-title">{title}</h4>
      </div>
      <div className="mini-leaderboard-table-wrapper">
        <table className="mini-leaderboard-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>{actualKey.replace(/([A-Z])/g, ' $1').trim()}</th>
              {!hideCalcColumn && (
                <th>{useDifference ? differenceLabel : expectedKey.replace(/([A-Z])/g, ' $1').trim()}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, index) => (
              <tr key={team.team}>
                <td>
                  <Link to={`/team/${team.team}`}>{team.team}</Link>
                </td>
                <td>{team[actualKey]?.toFixed(1) || 0}</td>
                {!hideCalcColumn && (
                  <td>{
                    useDifference 
                      ? (team[actualKey] - team[expectedKey])?.toFixed(1) || 0
                      : team[expectedKey]?.toFixed(1) || 0
                  }</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/*******************************************
 * MAIN COMPONENT
 *******************************************/
function TeamDataGAA() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { calibrationModel } = useCalibrationModel();
  const isAdmin = currentUser && ADMIN_USERS.includes(currentUser.uid);
  
  const { config: publicConfig, loading: configLoading } = useFetchPublicConfig();
  const [dataSource, setDataSource] = useState('public');
  const [selectedDatasetName, setSelectedDatasetName] = useState('');
  const [selectedGameIds, setSelectedGameIds] = useState([]);
  const [selectedYear, setSelectedYear] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [gamesCollapsed, setGamesCollapsed] = useState(true);
  const tableRef = useRef(null);
  const [perGame, setPerGame] = useState(false);
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');

  // Model selector state
  const [modelPredictions, setModelPredictions] = useState(null);
  const [activeModel, setActiveModel] = useState(null);

  // Handle model applied
  const handleModelApplied = useCallback((predictions, model) => {
    setModelPredictions(predictions);
    setActiveModel(model || null);
  }, []);

  // Determine active user ID based on data source
  const activeUserId = useMemo(() => {
    if (dataSource === 'own' && currentUser) return currentUser.uid;
    return publicConfig?.userId || DEFAULT_USER_ID;
  }, [dataSource, currentUser, publicConfig]);

  const { datasetStructure, loading: structureLoading } = useFetchDatasetStructure(activeUserId);
  const currentDataset = useMemo(() => 
    datasetStructure.find(d => d.datasetName === selectedDatasetName), 
    [datasetStructure, selectedDatasetName]
  );
  const gamesInDataset = currentDataset?.games || [];
  const { combinedData, loading: dataLoading } = useFetchMultipleGames(activeUserId, selectedGameIds);

  // Reset model when data changes
  useEffect(() => {
    setModelPredictions(null);
    setActiveModel(null);
  }, [selectedDatasetName, selectedGameIds]);

  // Auto-select default dataset
  useEffect(() => {
    if (datasetStructure.length > 0 && !selectedDatasetName) {
      const defaultDs = datasetStructure.find(d => d.datasetName === DEFAULT_DATASET);
      if (defaultDs) {
        setSelectedDatasetName(DEFAULT_DATASET);
      } else if (dataSource === 'public' && publicConfig?.datasetName) {
        const configDs = datasetStructure.find(d => d.datasetName === publicConfig.datasetName);
        if (configDs) {
          setSelectedDatasetName(publicConfig.datasetName);
        }
      } else {
        setSelectedDatasetName(datasetStructure[0].datasetName);
      }
    }
  }, [datasetStructure, selectedDatasetName, dataSource, publicConfig]);

  // Auto-select all games when dataset changes
  useEffect(() => { 
    if (currentDataset) {
      setSelectedGameIds(currentDataset.games.map(g => g.id));
      setGamesCollapsed(currentDataset.games.length > 12);
    } else {
      setSelectedGameIds([]);
    }
  }, [currentDataset]);

  const handleToggleGame = useCallback(id => {
    setSelectedGameIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (currentDataset) {
      setSelectedGameIds(currentDataset.games.map(g => g.id));
    }
  }, [currentDataset]);

  const handleDeselectAll = useCallback(() => setSelectedGameIds([]), []);

  const allGamesSelected = gamesInDataset.length > 0 && 
    gamesInDataset.every(g => selectedGameIds.includes(g.id));

  // Format game name helper
  const formatGameName = (name) => {
    let formatted = name.replace(/_/g, ' ');
    formatted = formatted
      .replace(/1sthalf/gi, '- 1st Half')
      .replace(/2ndhalf/gi, '- 2nd Half')
      .replace(/firsthalf/gi, '- 1st Half')
      .replace(/secondhalf/gi, '- 2nd Half');
    
    formatted = formatted
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return formatted;
  };

  // Calculate team statistics from the loaded data
  const teamStats = useMemo(() => {
    if (!combinedData || combinedData.length === 0) return [];

    const teams = {};

    combinedData.forEach((shot, shotIndex) => {
      const teamName = shot.team || 'Unknown';
      const act = (shot.action || '').toString().toLowerCase().trim();

      if (!teams[teamName]) {
        teams[teamName] = {
          team: teamName,
          expectedPoints: 0,
          points: 0,
          expectedGoals: 0,
          goals: 0,
          miss: 0,
          attempts: 0,
          successfulShots: 0,
          accuracy: 0,
          gamesSet: new Set(),
        };
      }

      teams[teamName].attempts += 1;

      if (shot.gameName) {
        const key = `${getMatchTeams(shot.gameName)}__${shot.matchDate || ''}`;
        teams[teamName].gamesSet.add(key);
      }



      // Distance from the SAME engineered features the model uses
      const feats = _engineerFeatures(shot);
      const distanceMeters = feats.Shot_Distance;

      // Classification — mirrors GAAAnalysisDashboard exactly
      const scoringActions = ['point', 'free', 'offensive mark', '45', 'fortyfive', 'goal', 'penalty goal'];
      const isScoring = scoringActions.some(a => act.includes(a));
      const isMiss = /miss|wide|short|blocked|post/.test(act);
      const isGoalAttempt = act.includes('goal');
      const isPointAttempt = !isGoalAttempt;

      // Expected values (always added, regardless of outcome)
      if (isPointAttempt) {
        const twoPtValue = calculateTwoPointerValue(act, distanceMeters);
        if (modelPredictions && modelPredictions[shotIndex] !== undefined) {
          teams[teamName].expectedPoints += modelPredictions[shotIndex] * twoPtValue;
        } else {
          const baseXP = calculateXP(shot, null, calibrationModel);
          teams[teamName].expectedPoints += baseXP * twoPtValue;
        }
      } else {
        teams[teamName].expectedGoals += calculateXG(shot, null, calibrationModel);
      }

      // Actual outcomes — mirrors dashboard
      if (act.includes('goal') && !isMiss) {
        teams[teamName].goals += 1;
        teams[teamName].successfulShots += 1;
      } else if (isScoring && !isMiss && !act.includes('goal')) {
        teams[teamName].points += calculateTwoPointerValue(act, distanceMeters);
        teams[teamName].successfulShots += 1;
      } else if (isMiss) {
        teams[teamName].miss += 1;
      }
    });

    // Accuracy (successful shots / attempts)
    Object.values(teams).forEach(team => {
      team.accuracy = team.attempts > 0
        ? (team.successfulShots / team.attempts) * 100
        : 0;
      team.games = team.gamesSet.size;   // <-- final count
      delete team.gamesSet;
    });

    return Object.values(teams);
  }, [combinedData, modelPredictions, calibrationModel]);

  // Filter teams by search
  const filteredTeams = useMemo(() => {
    return teamStats.filter(team =>
      team.team.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teamStats, searchTerm]);

    // Divide by games when in per-game mode; guard against divide-by-zero
  const perGameVal = (value, games, decimals = 1) => {
    if (!perGame) {
      return typeof value === 'number' && !Number.isInteger(value)
        ? value.toFixed(decimals)
        : value;
    }
    const g = games || 1;
    return (value / g).toFixed(decimals);
  };

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const columns = [
    { key: 'games', label: 'Games' },
    { key: 'expectedPoints', label: 'xP' },
    { key: 'points', label: 'Points' },
    { key: 'expectedGoals', label: 'xG' },
    { key: 'goals', label: 'Goals' },
    { key: 'miss', label: 'Misses' },
    { key: 'attempts', label: 'Attempts' },
    { key: 'accuracy', label: 'Accuracy' },
  ];

  const arrow = (key) => (key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  // Value used for sorting a given team on a given key, respecting per-game mode
  const sortValue = (team, key) => {
    if (key === 'team') return team.team;
    if (key === 'score') {
      const raw = team.points + team.goals * 3;
      return perGame ? raw / (team.games || 1) : raw;
    }
    if (key === 'games' || key === 'accuracy') return team[key];
    const v = team[key] || 0;
    return perGame ? v / (team.games || 1) : v;
  };

  const sortedTeams = useMemo(() => {
    const arr = [...filteredTeams];
    arr.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (typeof av === 'string' || typeof bv === 'string') {
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [filteredTeams, sortKey, sortDir, perGame]);

  // Available years for filter
  const availableYears = useMemo(() => {
    const years = new Set();
    combinedData.forEach(shot => {
      if (shot.matchDate) {
        years.add(new Date(shot.matchDate).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [combinedData]);

  // Stats summary
  const stats = useMemo(() => {
    const totalTeams = filteredTeams.length;
    const totalShots = filteredTeams.reduce((sum, t) => sum + t.attempts, 0);
    const totalPoints = filteredTeams.reduce((sum, t) => sum + t.points, 0);
    const totalGoals = filteredTeams.reduce((sum, t) => sum + t.goals, 0);
    const totalXP = filteredTeams.reduce((sum, t) => sum + t.expectedPoints, 0);
    const totalXG = filteredTeams.reduce((sum, t) => sum + t.expectedGoals, 0);
    const avgAccuracy = totalTeams > 0
      ? filteredTeams.reduce((sum, t) => sum + t.accuracy, 0) / totalTeams
      : 0;

    return {
      teams: totalTeams,
      shots: totalShots,
      points: totalPoints,
      goals: totalGoals,
      totalXP,
      totalXG,
      avgAccuracy
    };
  }, [filteredTeams]);

  const isLoading = configLoading || structureLoading || dataLoading;

  return (
    <div className="team-data-container">
      <header className="team-data-header">
        <div>
          <h1>Team Analytics</h1>
          <p>GAA Team Performance Dashboard</p>
        </div>
      </header>

      {/* Data Source & Dataset Selection */}
      <section className="pdg-controls">
        <div className="pdg-toggle-group">
          <button 
            className={`pdg-toggle ${dataSource === 'public' ? 'active' : ''}`} 
            onClick={() => setDataSource('public')}
          >
            Public Data
          </button>
          {currentUser && (
            <button 
              className={`pdg-toggle ${dataSource === 'own' ? 'active' : ''}`} 
              onClick={() => setDataSource('own')}
            >
              My Data
            </button>
          )}
        </div>
        <div className="pdg-select-group">
          <label>Dataset</label>
          <select 
            value={selectedDatasetName} 
            onChange={e => setSelectedDatasetName(e.target.value)}
          >
            <option value="">Select a dataset...</option>
            {datasetStructure.map(ds => (
              <option key={ds.datasetName} value={ds.datasetName}>
                {ds.datasetName} ({ds.games.length} games)
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* MODEL SELECTOR - commented out: always use default Model2026
      {currentUser && combinedData.length > 0 && (
        <ModelSelector
          onModelApplied={handleModelApplied}
          datasetName={selectedDatasetName}
          shotData={combinedData}
          disabled={combinedData.length === 0}
          activeModel={activeModel}
        />
      )}
      */}

      {/* Active Model Indicator */}
      {activeModel && (
        <div className="active-model-banner">
          <span className="active-model-icon">✓</span>
          <span>Using model: <strong>{activeModel.run_name || activeModel.algorithm}</strong></span>
          <span className="active-model-accuracy">
            ({((activeModel.metrics?.accuracy || 0) * 100).toFixed(1)}% accuracy)
          </span>
          <button 
            className="active-model-reset"
            onClick={() => handleModelApplied(null, null)}
          >
            Reset to Default
          </button>
        </div>
      )}

      {/* Collapsible Game Selector */}
      {selectedDatasetName && gamesInDataset.length > 0 && (
        <div className="pdg-game-selector">
          <div className="pdg-game-header">
            <div className="pdg-game-title" onClick={() => setGamesCollapsed(!gamesCollapsed)}>
              <h4>Games</h4>
              <span className="pdg-badge">{selectedGameIds.length} / {gamesInDataset.length}</span>
              <span className={`pdg-chevron ${gamesCollapsed ? '' : 'open'}`}>&#9660;</span>
            </div>
            <button 
              className="pdg-btn-text" 
              onClick={allGamesSelected ? handleDeselectAll : handleSelectAll}
            >
              {allGamesSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {!gamesCollapsed && (
            <div className="pdg-game-grid">
              {gamesInDataset.map(game => (
                <label 
                  key={game.id} 
                  className={`pdg-game-item ${selectedGameIds.includes(game.id) ? 'selected' : ''}`}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedGameIds.includes(game.id)} 
                    onChange={() => handleToggleGame(game.id)} 
                  />
                  <span className="pdg-game-name">{formatGameName(game.name)}</span>
                  <span className="pdg-game-shots">{game.shotCount || 0} shots</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Year Filter */}
      {selectedGameIds.length > 0 && availableYears.length > 0 && (
        <div className="year-filter">
          <label htmlFor="year-select">Filter by Year:</label>
          <select 
            id="year-select" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="All">All Years</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading, Empty, and Error States */}
      {isLoading && <LoadingIndicator message="Loading team data..." />}
      {!isLoading && !selectedDatasetName && (
        <EmptyState title="No Dataset Selected" message="Choose a dataset above to begin" />
      )}
      {!isLoading && selectedDatasetName && selectedGameIds.length === 0 && (
        <EmptyState title="No Games Selected" message="Select games to view team stats" />
      )}

      {/* Main Content */}
      {!isLoading && selectedGameIds.length > 0 && filteredTeams.length > 0 && (
        <>
          {/* Stats Row */}
          <section className="team-stats-row">
            <div className="team-stat-card">
              <div className="team-stat-value">{stats.teams}</div>
              <div className="team-stat-label">Teams</div>
            </div>
            <div className="team-stat-card">
              <div className="team-stat-value">{stats.shots}</div>
              <div className="team-stat-label">Total Shots</div>
            </div>
            <div className="team-stat-card">
              <div className="team-stat-value">{stats.points}</div>
              <div className="team-stat-label">Total Points</div>
            </div>
            <div className="team-stat-card">
              <div className="team-stat-value">{stats.goals}</div>
              <div className="team-stat-label">Total Goals</div>
            </div>
            <div className="team-stat-card">
              <div className="team-stat-value">{stats.avgAccuracy.toFixed(1)}%</div>
              <div className="team-stat-label">Avg Accuracy</div>
            </div>
          </section>
          
          {/* Mini Leaderboards 
          <div className="mini-leaderboards-row">
            <MiniLeaderboard
              title="Most Points"
              data={filteredTeams}
              actualKey="points"
              expectedKey="expectedPoints"
            />
            <MiniLeaderboard
              title="Most Goals"
              data={filteredTeams}
              actualKey="goals"
              expectedKey="expectedGoals"
            />
            <MiniLeaderboard
              title="Best Accuracy"
              data={filteredTeams}
              actualKey="accuracy"
              expectedKey="attempts"
              hideCalcColumn={true}
            />
          </div>*/}

          {/* Main Team Leaderboard */}
          <div className="leaderboard-container">
            <div className="leaderboard-header">
              <h2>Team Leaderboard {perGame ? '(Per Game)' : '(Totals)'}</h2>
              <div className="leaderboard-header-actions">
                <button
                  className={`pdg-pergame-toggle ${perGame ? 'active' : ''}`}
                  onClick={() => setPerGame(p => !p)}
                >
                  {perGame ? 'Show Totals' : 'Show Per Game'}
                </button>
                <div className="search-container">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search teams..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="table-wrapper" ref={tableRef}>
              <table className="leaderboard">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th
                      onClick={() => handleSort('team')}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      Team{arrow('team')}
                    </th>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        {col.label}{arrow(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.map((team, index) => (
                    <tr key={team.team} className="team-row">
                      <td>{index + 1}</td>
                      <td>
                        <Link to={`/team/${team.team}`}>{team.team}</Link>
                      </td>
                      <td>{team.games}</td>
                      <td>{perGameVal(team.expectedPoints, team.games)}</td>
                      <td>{perGameVal(team.points, team.games)}</td>
                      <td>{perGameVal(team.expectedGoals, team.games)}</td>
                      <td>{perGameVal(team.goals, team.games)}</td>
                      <td>{perGameVal(team.miss, team.games)}</td>
                      <td>{perGameVal(team.attempts, team.games)}</td>
                      <td>{team.accuracy.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TeamDataGAA;