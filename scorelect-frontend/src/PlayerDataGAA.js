// src/components/PlayerDataGAA.js

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import Swal from 'sweetalert2';
import PropTypes from 'prop-types';
import './PlayerDataGAA.css';

function parseJSONNoNaN(response) {
  return response.text().then((rawText) => {
    const safeText = rawText
      .replace(/\bNaN\b/g, 'null')
      .replace(/\bInfinity\b/g, '999999999')
      .replace(/\b-Infinity\b/g, '-999999999');
    return JSON.parse(safeText);
  });
}

function useFetchDataset(collectionPath, documentPath) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDataset() {
      setLoading(true);
      try {
        const docRef = doc(firestore, `${collectionPath}/${documentPath}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData(docSnap.data());
        } else {
          throw new Error('No such document exists!');
        }
      } catch (err) {
        setError(err.message);
        Swal.fire('Error', err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchDataset();
  }, [collectionPath, documentPath]);

  return { data, loading, error };
}

function LoadingIndicator() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading data...</p>
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

ErrorMessage.propTypes = {
  message: PropTypes.string.isRequired,
};

/**
 * Translate a shot to reference one goal based on half-line.
 * Adds a 'distMeters' property to the shot for distance from nearest goal.
 */
function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = shot.x <= halfLineX ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters };
}

function MiniLeaderboard({
  title,
  data,
  actualKey,
  expectedKey,
  showRatio = true,
  initialDirection = 'descending',
}) {
  const [sortConfig, setSortConfig] = useState({ key: actualKey, direction: initialDirection });

  const sortedData = useMemo(() => {
    let list = [...data];
    if (sortConfig) {
      list.sort((a, b) => {
        const aVal = a[sortConfig.key] || 0;
        const bVal = b[sortConfig.key] || 0;
        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [data, sortConfig]);

  function requestSort(key) {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }

  function getSortIndicator(key) {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
  }

  return (
    <div className="mini-leaderboard">
      <h3 className="mini-leaderboard-title">{title}</h3>
      <div className="mini-leaderboard-table-wrapper">
        <table className="mini-leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th onClick={() => requestSort('player')}>
                Player{getSortIndicator('player')}
              </th>
              <th onClick={() => requestSort(actualKey)}>
                {actualKey}
                {getSortIndicator(actualKey)}
              </th>
              <th onClick={() => requestSort(expectedKey)}>
                {expectedKey}
                {getSortIndicator(expectedKey)}
              </th>
              {showRatio && (
                <th onClick={() => requestSort('ratio')}>
                  Ratio{getSortIndicator('ratio')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => {
              const actualVal = item[actualKey] || 0;
              const expectedVal = item[expectedKey] || 0;
              const epsilon = 0.0001;
              const ratioVal = expectedVal > 0 ? actualVal / expectedVal : actualVal / epsilon;
              return (
                <tr key={`${item.player}-${index}`}>
                  <td>{index + 1}</td>
                  <td>
                    <Link
                      to={`/player/${encodeURIComponent(item.player)}`}
                      state={{ playerData: item }}
                      style={{
                        color: '#FFA500',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      {item.player}
                    </Link>
                  </td>
                  <td>
                    {!isNaN(Number(actualVal)) ? Number(actualVal).toFixed(2) : '0.00'}
                  </td>
                  <td>
                    {!isNaN(Number(expectedVal)) ? Number(expectedVal).toFixed(2) : '0.00'}
                  </td>
                  {showRatio && (
                    <td>
                      {!isNaN(Number(ratioVal)) ? Number(ratioVal).toFixed(2) : '0.00'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

MiniLeaderboard.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.array.isRequired,
  actualKey: PropTypes.string.isRequired,
  expectedKey: PropTypes.string.isRequired,
  showRatio: PropTypes.bool,
};

function AvgDistanceLeaderboard({ title, data }) {
  const sortedData = useMemo(() => {
    let list = [...data];
    list.sort((a, b) => (b.avgScoreDistance || 0) - (a.avgScoreDistance || 0));
    return list;
  }, [data]);

  return (
    <div className="mini-leaderboard">
      <h3 className="mini-leaderboard-title">{title}</h3>
      <div className="mini-leaderboard-table-wrapper">
        <table className="mini-leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Avg Distance (m)</th>
              <th>Avg Score Distance (m)</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => (
              <tr key={`${item.player}-${index}`}>
                <td>{index + 1}</td>
                <td>
                  <Link
                    to={`/player/${encodeURIComponent(item.player)}`}
                    state={{ playerData: item }}
                    style={{
                      color: '#FFA500',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    {item.player}
                  </Link>
                </td>
                <td>
                  {!isNaN(Number(item.avgDistance)) ? Number(item.avgDistance).toFixed(2) : '0.00'}
                </td>
                <td>
                  {!isNaN(Number(item.avgScoreDistance))
                    ? Number(item.avgScoreDistance).toFixed(2)
                    : '0.00'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

AvgDistanceLeaderboard.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.array.isRequired,
};

function LeaderboardTable({ data }) {
  const [sortConfig, setSortConfig] = useState({
    key: 'Total_Points',
    direction: 'descending',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const rowRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(500);

  useEffect(() => {
    if (rowRef.current) {
      const rowHeight = rowRef.current.getBoundingClientRect().height;
      setMaxHeight(rowHeight * 5);
    }
  }, [data]);

  const sortedData = useMemo(() => {
    let list = [...data];
    if (searchTerm) {
      list = list.filter((entry) =>
        entry.player.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (sortConfig && sortConfig.key) {
      list.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [data, searchTerm, sortConfig]);

  function requestSort(key) {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }

  function getSortIndicator(key) {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
  }

  if (data.length === 0) {
    return (
      <div className="leaderboard-container">
        <h2>Leaderboard</h2>
        <p>No data available to display.</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <h2 style={{ color: '#fff' }}>Leaderboard</h2>
      <input
        type="text"
        placeholder="Search Players..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
      <div className="table-wrapper" style={{ maxHeight: `${maxHeight}px` }}>
        <table className="leaderboard">
          <thead>
            <tr>
              <th onClick={() => requestSort('player')}>
                Player{getSortIndicator('player')}
              </th>
              <th onClick={() => requestSort('team')}>
                Team{getSortIndicator('team')}
              </th>
              <th onClick={() => requestSort('Total_Points')}>
                Total Points{getSortIndicator('Total_Points')}
              </th>
              <th onClick={() => requestSort('xPoints')}>
                Expected Points (xPoints){getSortIndicator('xPoints')}
              </th>
              <th onClick={() => requestSort('xGoals')}>
                Expected Goals (xGoals){getSortIndicator('xGoals')}
              </th>
              <th onClick={() => requestSort('xPReturn')}>
                xP Return (%){getSortIndicator('xPReturn')}
              </th>
              <th onClick={() => requestSort('positionPerformance')}>
                Position Performance{getSortIndicator('positionPerformance')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((entry, index) => (
              <tr
                key={index}
                className={`player-row ${index % 2 === 0 ? 'even' : 'odd'}`}
                ref={index === 0 ? rowRef : null}
              >
                <td>
                  <Link
                    to={`/player/${encodeURIComponent(entry.player)}`}
                    state={{ playerData: entry }}
                    style={{
                      color: '#FFA500',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    {entry.player}
                  </Link>
                </td>
                <td>{entry.team}</td>
                <td>{entry.Total_Points}</td>
                <td>
                  {!isNaN(Number(entry.xPoints)) ? Number(entry.xPoints).toFixed(2) : '0.00'}
                </td>
                <td>
                  {!isNaN(Number(entry.xGoals)) ? Number(entry.xGoals).toFixed(2) : '0.00'}
                </td>
                <td>
                  {!isNaN(Number(entry.xPReturn))
                    ? Number(entry.xPReturn).toFixed(2) + '%'
                    : '0.00%'}
                </td>
                <td>
                  <table className="nested-table">
                    <thead>
                      <tr>
                        <th>Position</th>
                        <th>Shots</th>
                        <th>Points</th>
                        <th>Goals</th>
                        <th>Efficiency (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.positionPerformance.map((perf, idx) => (
                        <tr key={idx}>
                          <td>{perf.position}</td>
                          <td>{perf.shots}</td>
                          <td>{perf.points}</td>
                          <td>{perf.goals}</td>
                          <td>
                            {!isNaN(Number(perf.efficiency))
                              ? Number(perf.efficiency).toFixed(2) + '%'
                              : '0.00%'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

LeaderboardTable.propTypes = {
  data: PropTypes.array.isRequired,
};

export default function PlayerDataGAA() {
  const USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
  const DATASET_NAME = 'All Shots GAA';
  const { data, loading, error } = useFetchDataset(`savedGames/${USER_ID}/games`, DATASET_NAME);

  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState('All');

  const availableYears = useMemo(() => {
    if (!data || !data.gameData) return [];
    const yearsSet = new Set();
    data.gameData.forEach((shot) => {
      if (shot.matchDate) {
        yearsSet.add(new Date(shot.matchDate).getFullYear());
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [data]);

  const availableTeams = useMemo(() => {
    if (!data || !data.gameData) return [];
    const teamSet = new Set();
    data.gameData.forEach((shot) => {
      if (shot.team) {
        teamSet.add(shot.team);
      }
    });
    return Array.from(teamSet).sort();
  }, [data]);

  const formattedLeaderboard = useMemo(() => {
    if (!data || !data.gameData) return [];
    const shotsFiltered = data.gameData.filter((shot) => {
      const matchesYear =
        selectedYear === 'All'
          ? true
          : new Date(shot.matchDate).getFullYear().toString() === selectedYear;
      const matchesTeam =
        selectedTeam === 'All' ? true : shot.team === selectedTeam;
      return matchesYear && matchesTeam;
    });
    if (shotsFiltered.length === 0) return [];

    const goalY = 44;
    const goalX = 145;
    const halfLineX = 72.5;

    const aggregator = shotsFiltered.reduce((acc, shot) => {
      const name = shot.playerName || 'Unknown Player';
      if (!acc[name]) {
        acc[name] = {
          player: name,
          team: shot.team || 'Unknown Team',
          points: 0,
          goals: 0,
          xPoints: 0,
          xGoals: 0,
          setPlays: 0,
          xSetPlays: 0,
          positionPerformance: {},
          shootingAttempts: 0,
          shootingScored: 0,
          twoPointerAttempts: 0,
          twoPointerScores: 0,
          pressuredShots: 0,
          pressuredScores: 0,
          totalDistance: 0,
          totalScoreDistance: 0,
        };
      }
      const p = acc[name];
    
      const translatedShot = translateShotToOneSide(shot, halfLineX, goalX, goalY);
      const distMeters = translatedShot.distMeters;
    
      p.totalDistance += distMeters;
      p.shootingAttempts += 1; // Every shot counts as an attempt
    
      // Count total score distance for successful scoring actions, including free scores that are points
      if (
        shot.action === 'point' && shot.type === 'score'|| 
        shot.action === 'goal' && shot.type === 'score'|| 
        (shot.action === 'free' && shot.type === 'score')
      ) {
        p.totalScoreDistance += distMeters;
      }
    
      // Two-pointer logic remains unchanged
      if (distMeters >= 40) {
        p.twoPointerAttempts += 1;
        if (
          shot.action === 'point' && shot.type === 'score'|| 
          shot.action === 'goal' || 
          (shot.action === 'free' && shot.type === 'score')
        ) {
          p.twoPointerScores += 1;
        }
      }
    
      // Increase shootingScored for scoring actions including free scores
      if (
        shot.action === 'point' && shot.type === 'score'|| 
        shot.action === 'goal' || 
        (shot.action === 'free' && shot.type === 'score')
      ) {
        p.shootingScored += 1;
      }
    
      if (shot.action === 'point') {
        p.points += 1;
      } else if (shot.action === 'goal') {
        p.points += 3;
        p.goals += 1;
      } else if (shot.action === 'free' && shot.type === 'score') {
        // Treat free score as a point (adjust as needed)
        p.points += 1;
      }
    
      p.xPoints += shot.xPoints ? Number(shot.xPoints) : 0;
      p.xGoals += shot.xGoals ? Number(shot.xGoals) : 0;
    
      const setPlayActions = ['free', 'fortyfive', 'offensive mark'];
      if (setPlayActions.includes((shot.action || '').toLowerCase())) {
        p.setPlays += 1;
        p.xSetPlays += shot.xPoints ? Number(shot.xPoints) : 0;
      }
    
      const isPressured = (shot.pressure || '').toLowerCase().startsWith('y');
      if (isPressured) {
        p.pressuredShots += 1;
        if (
          shot.action === 'point' && shot.type === 'score'|| 
          shot.action === 'goal' || 
          (shot.action === 'free' && shot.type === 'score')
        ) {
          p.pressuredScores += 1;
        }
      }
    
      const pos = shot.position || 'unknown';
      if (!p.positionPerformance[pos]) {
        p.positionPerformance[pos] = { shots: 0, points: 0, goals: 0 };
      }
      p.positionPerformance[pos].shots += 1;
      if (shot.action === 'point') p.positionPerformance[pos].points += 1;
      if (shot.action === 'goal') p.positionPerformance[pos].goals += 1;
    
      return acc;
    }, {});    

    const finalArray = Object.values(aggregator).map((p) => {
      const xPReturn = p.xPoints > 0 ? (p.points / p.xPoints) * 100 : 0;
      const avgDistance =
        p.shootingAttempts > 0 ? p.totalDistance / p.shootingAttempts : 0;
      const avgScoreDistance =
        p.shootingScored > 0
          ? p.totalScoreDistance / p.shootingScored
          : 0;

      const positionPerformance = Object.entries(p.positionPerformance).map(
        ([pos, stats]) => {
          const eff =
            stats.shots > 0
              ? ((stats.points + stats.goals * 3) / stats.shots) * 100
              : 0;
          return {
            position: pos,
            shots: stats.shots,
            points: stats.points,
            goals: stats.goals,
            efficiency: eff,
          };
        }
      );

      return {
        ...p,
        positionPerformance,
        Total_Points: p.points,
        xPReturn,
        avgDistance,
        avgScoreDistance,
      };
    });

    return finalArray;
  }, [data, selectedYear, selectedTeam]);

  const goalsData = useMemo(
    () =>
      formattedLeaderboard.map((p) => ({
        player: p.player,
        goals: p.goals,
        xGoals: p.xGoals,
      })),
    [formattedLeaderboard]
  );

  const pointsData = useMemo(
    () =>
      formattedLeaderboard.map((p) => ({
        player: p.player,
        points: p.points,
        xPoints: p.xPoints,
      })),
    [formattedLeaderboard]
  );

  const setPlaysData = useMemo(
    () =>
      formattedLeaderboard.map((p) => ({
        player: p.player,
        setPlays: p.setPlays,
        xSetPlays: p.xSetPlays,
      })),
    [formattedLeaderboard]
  );

  const accuracyData = useMemo(
    () =>
      formattedLeaderboard.map((p) => ({
        player: p.player,
        shootingScored: p.shootingScored,
        shootingAttempts: p.shootingAttempts,
      })),
    [formattedLeaderboard]
  );

  const twoPointerData = useMemo(
    () =>
      formattedLeaderboard.map((p) => ({
        player: p.player,
        twoPointerScores: p.twoPointerScores,
        twoPointerAttempts: p.twoPointerAttempts,
      })),
    [formattedLeaderboard]
  );

  const pressureData = useMemo(
    () =>
      formattedLeaderboard.map((p) => ({
        player: p.player,
        pressuredScores: p.pressuredScores,
        pressuredShots: p.pressuredShots,
      })),
    [formattedLeaderboard]
  );

  const distanceData = useMemo(
    () =>
      formattedLeaderboard.map((p) => ({
        player: p.player,
        avgDistance: !isNaN(p.avgDistance) ? Number(p.avgDistance).toFixed(2) : '0.00',
        avgScoreDistance: !isNaN(p.avgScoreDistance)
          ? Number(p.avgScoreDistance).toFixed(2)
          : '0.00',
      })),
    [formattedLeaderboard]
  );

  async function handleRecalculateXPoints() {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/recalculate-xpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: USER_ID,
          datasetName: DATASET_NAME,
        }),
      });
      const result = await parseJSONNoNaN(response);
      if (!response.ok) {
        Swal.fire('Error', result.error || 'Failed to recalculate xpoints.', 'error');
      } else {
        Swal.fire('Success', 'xPoints recalculated successfully!', 'success');
        window.location.reload();
      }
    } catch (err) {
      Swal.fire('Error', 'Network error while recalculating xpoints.', 'error');
    }
  }

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (!data || !data.gameData || formattedLeaderboard.length === 0) {
    return <ErrorMessage message="No data available to display." />;
  }

  return (
    <div className="player-data-container">
      <h1 style={{ color: '#fff' }}>Player Data GAA</h1>

      <div className="year-filter">
        <label style={{ color: '#fff' }} htmlFor="year-select">
          Filter by Year:
        </label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
        >
          <option value="All">All Years</option>
          {availableYears.map((year) => (
            <option key={year} value={year.toString()}>
              {year}
            </option>
          ))}
        </select>
        <label style={{ color: '#fff', marginLeft: '10px' }} htmlFor="team-select">
          Filter by Team:
        </label>
        <select
          id="team-select"
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
        >
          <option value="All">All Teams</option>
          {availableTeams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </div>

      <div className="mini-leaderboards-row">
        <MiniLeaderboard
          title="Goals Leaderboard"
          data={goalsData}
          actualKey="goals"
          expectedKey="xGoals"
          showRatio={true}
        />
        <MiniLeaderboard
          title="Points Leaderboard"
          data={pointsData}
          actualKey="points"
          expectedKey="xPoints"
          showRatio={true}
        />
        <MiniLeaderboard
          title="Set Plays Leaderboard"
          data={setPlaysData}
          actualKey="setPlays"
          expectedKey="xSetPlays"
          showRatio={false}
        />
      </div>

      <div className="mini-leaderboards-row">
        <MiniLeaderboard
          title="Shooting Accuracy"
          data={accuracyData}
          actualKey="shootingScored"
          expectedKey="shootingAttempts"
          showRatio={true}
        />
        <MiniLeaderboard
          title="2 Pointer Leaderboard"
          data={twoPointerData}
          actualKey="twoPointerScores"
          expectedKey="twoPointerAttempts"
          showRatio={true}
        />
      </div>

      <div className="mini-leaderboards-row">
        <MiniLeaderboard
          title="Under Pressure Shots"
          data={pressureData}
          actualKey="pressuredScores"
          expectedKey="pressuredShots"
          showRatio={true}
        />
        <AvgDistanceLeaderboard title="Avg Shooting Distance" data={distanceData} />
      </div>

      <LeaderboardTable data={formattedLeaderboard} />

      <button onClick={handleRecalculateXPoints} className="recalculate-button">
        Recalculate xPoints
      </button>
    </div>
  );
}
