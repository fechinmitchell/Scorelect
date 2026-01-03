import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { firestore } from './firebase';
import { getAuth } from 'firebase/auth';

import './TeamDataGAA.css';

/*******************************************
 * CONSTANTS
 *******************************************/
const ADMIN_USERS = ['w9ZkqaYVM3dKSqqjWHLDVyh5sVg2'];
const PUBLIC_CONFIG_PATH = 'config/publicDataset';
const DEFAULT_USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
const DEFAULT_DATASET = 'AllIreland2025';

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
            gameName, // Keep original for compatibility
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
  const isAdmin = currentUser && ADMIN_USERS.includes(currentUser.uid);
  
  const { config: publicConfig, loading: configLoading } = useFetchPublicConfig();
  const [dataSource, setDataSource] = useState('public');
  const [selectedDatasetName, setSelectedDatasetName] = useState('');
  const [selectedGameIds, setSelectedGameIds] = useState([]);
  const [selectedYear, setSelectedYear] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [gamesCollapsed, setGamesCollapsed] = useState(true);
  const tableRef = useRef(null);

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

  // Auto-select all games when dataset changes and collapse if >12 games
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

    combinedData.forEach(shot => {
      const teamName = shot.team || 'Unknown';
      const year = shot.matchDate ? new Date(shot.matchDate).getFullYear() : 'Unknown';
      
      if (!teams[teamName]) {
        teams[teamName] = {
          team: teamName,
          points: 0,
          goals: 0,
          wides: 0,
          attempts: 0,
          accuracy: 0,
          expectedPoints: 0,
          expectedGoals: 0,
        };
      }

      teams[teamName].attempts += 1;

      const actionLower = (shot.action || '').toLowerCase();
      const typeLower = (shot.type || '').toLowerCase();

      if (actionLower === 'point') teams[teamName].points += 1;
      else if (actionLower === 'goal') teams[teamName].goals += 1;
      else if (typeLower === 'wide' || actionLower === 'wide') teams[teamName].wides += 1;

      // Add expected values if available
      if (shot.xPoints) teams[teamName].expectedPoints += parseFloat(shot.xPoints);
      if (shot.xGoals) teams[teamName].expectedGoals += parseFloat(shot.xGoals);
    });

    // Calculate accuracy
    Object.values(teams).forEach(team => {
      const scores = team.points + team.goals;
      team.accuracy = team.attempts > 0 ? (scores / team.attempts) * 100 : 0;
    });

    return Object.values(teams);
  }, [combinedData]);

  // Filter teams by search
  const filteredTeams = useMemo(() => {
    return teamStats.filter(team => 
      team.team.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teamStats, searchTerm]);

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
    const avgAccuracy = totalTeams > 0 
      ? filteredTeams.reduce((sum, t) => sum + t.accuracy, 0) / totalTeams 
      : 0;

    return {
      teams: totalTeams,
      shots: totalShots,
      points: totalPoints,
      goals: totalGoals,
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

      {/* Collapsible Game Selector (PlayerDataGAA Style) */}
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

          {/* Mini Leaderboards */}
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
          </div>

          {/* Main Team Leaderboard */}
          <div className="leaderboard-container">
            <div className="leaderboard-header">
              <h2>Team Leaderboard</h2>
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
            <div className="table-wrapper" ref={tableRef}>
              <table className="leaderboard">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Points</th>
                    <th>Goals</th>
                    <th>Wides</th>
                    <th>Attempts</th>
                    <th>Accuracy</th>
                    <th>xPoints</th>
                    <th>xGoals</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams
                    .sort((a, b) => b.points + b.goals * 3 - (a.points + a.goals * 3))
                    .map((team, index) => (
                      <tr key={team.team} className="team-row">
                        <td>{index + 1}</td>
                        <td>
                          <Link to={`/team/${team.team}`}>{team.team}</Link>
                        </td>
                        <td>{team.points}</td>
                        <td>{team.goals}</td>
                        <td>{team.wides}</td>
                        <td>{team.attempts}</td>
                        <td>{team.accuracy.toFixed(1)}%</td>
                        <td>{team.expectedPoints.toFixed(1)}</td>
                        <td>{team.expectedGoals.toFixed(1)}</td>
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