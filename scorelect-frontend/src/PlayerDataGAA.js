// PlayerDataGAA.js

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { firestore } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
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
          const dataset = docSnap.data();
          setData(dataset);
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
 * A mini leaderboard that shows data in columns:
 * - Player
 * - Actual (actualKey)
 * - Expected (expectedKey)
 * - Ratio
 * 
 * Default sorts by actualKey (descending), but user can click on column headers
 * to reorder the table by Player, Actual, Expected, or Ratio.
 * 
 * There's no "Show All" button; the entire list is scrollable.
 */
function MiniLeaderboard({ title, data, actualKey, expectedKey }) {
  // Default to sorting by the actualKey descending
  const [sortConfig, setSortConfig] = useState({ key: actualKey, direction: 'descending' });

  // Perform sorting
  const sortedData = useMemo(() => {
    let list = [...data];
    if (sortConfig) {
      list.sort((a, b) => {
        const aVal = getValue(a, sortConfig.key);
        const bVal = getValue(b, sortConfig.key);
        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [data, sortConfig]);

  function getValue(item, key) {
    if (key === 'ratio') {
      // ratio = actual / expected
      const actual = item[actualKey] || 0;
      const expected = item[expectedKey] || 0;
      const epsilon = 0.0001;
      return expected > 0 ? actual / expected : actual / epsilon;
    }
    return item[key] || 0;
  }

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
                {actualKey}{getSortIndicator(actualKey)}
              </th>
              <th onClick={() => requestSort(expectedKey)}>
                {expectedKey}{getSortIndicator(expectedKey)}
              </th>
              <th onClick={() => requestSort('ratio')}>
                Ratio{getSortIndicator('ratio')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((player, index) => {
              const actualVal = player[actualKey] || 0;
              const expectedVal = player[expectedKey] || 0;
              const epsilon = 0.0001;
              const ratio = expectedVal > 0 ? actualVal / expectedVal : actualVal / epsilon;

              return (
                <tr key={`${player.player}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{player.player}</td>
                  <td>{actualVal.toFixed(2)}</td>
                  <td>{expectedVal.toFixed(2)}</td>
                  <td>{ratio.toFixed(2)}</td>
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
};

function LeaderboardTable({ data }) {
  const [sortConfig, setSortConfig] = useState({ key: 'Total_Points', direction: 'descending' });
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
      <h2 style={{ color: "#fff" }}>Leaderboard</h2>
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
                <td>{entry.player}</td>
                <td>{entry.team}</td>
                <td>{entry.Total_Points}</td>
                <td>{entry.xPoints.toFixed(2)}</td>
                <td>{entry.xGoals.toFixed(2)}</td>
                <td>{entry.xPReturn.toFixed(2)}%</td>
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
                          <td>{perf.efficiency.toFixed(2)}%</td>
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
  const { data, loading, error } = useFetchDataset(
    `savedGames/${USER_ID}/games`,
    DATASET_NAME
  );

  const [selectedYear, setSelectedYear] = useState('All');

  const availableYears = useMemo(() => {
    if (!data || !data.gameData) return [];
    const yearsSet = new Set();
    data.gameData.forEach((shot) => {
      if (shot.matchDate) {
        const year = new Date(shot.matchDate).getFullYear();
        yearsSet.add(year);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [data]);

  const formattedLeaderboard = useMemo(() => {
    if (!data || !data.gameData) return [];

    const shotsFiltered = data.gameData.filter((shot) => {
      if (selectedYear === 'All') return true;
      if (!shot.matchDate) return false;
      const year = new Date(shot.matchDate).getFullYear();
      return year.toString() === selectedYear;
    });
    if (shotsFiltered.length === 0) return [];

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
        };
      }
      const p = acc[name];

      p.xPoints += shot.xPoints ? Number(shot.xPoints) : 0;
      p.xGoals += shot.xGoals ? Number(shot.xGoals) : 0;

      const setPlayActions = ['free', 'fortyfive', 'offensive mark'];

      if (shot.action === 'point') {
        p.points += 1;
      } else if (shot.action === 'goal') {
        p.points += 3;
        p.goals += 1;
      }

      if (setPlayActions.includes((shot.action || '').toLowerCase())) {
        p.setPlays += 1;
        p.xSetPlays += shot.xPoints ? Number(shot.xPoints) : 0;
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
      const positionPerformance = Object.entries(p.positionPerformance).map(([pos, stats]) => {
        const eff =
          stats.shots > 0 ? ((stats.points + stats.goals * 3) / stats.shots) * 100 : 0;
        return {
          position: pos,
          shots: stats.shots,
          points: stats.points,
          goals: stats.goals,
          efficiency: eff,
        };
      });
      return {
        ...p,
        positionPerformance,
        Total_Points: p.points,
        xPReturn,
      };
    });
    return finalArray;
  }, [data, selectedYear]);

  const goalsData = useMemo(() => {
    return formattedLeaderboard.map((p) => ({
      player: p.player,
      goals: p.goals,
      xGoals: p.xGoals,
    }));
  }, [formattedLeaderboard]);

  const pointsData = useMemo(() => {
    return formattedLeaderboard.map((p) => ({
      player: p.player,
      points: p.points,
      xPoints: p.xPoints,
    }));
  }, [formattedLeaderboard]);

  const setPlaysData = useMemo(() => {
    return formattedLeaderboard.map((p) => ({
      player: p.player,
      setPlays: p.setPlays,
      xSetPlays: p.xSetPlays,
    }));
  }, [formattedLeaderboard]);

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
      </div>

      <div className="mini-leaderboards-row">
        <MiniLeaderboard
          title="Goals Leaderboard"
          data={goalsData}
          actualKey="goals"
          expectedKey="xGoals"
        />
        <MiniLeaderboard
          title="Points Leaderboard"
          data={pointsData}
          actualKey="points"
          expectedKey="xPoints"
        />
        <MiniLeaderboard
          title="Set Plays Leaderboard"
          data={setPlaysData}
          actualKey="setPlays"
          expectedKey="xSetPlays"
        />
      </div>

      <LeaderboardTable data={formattedLeaderboard} />

      <button onClick={handleRecalculateXPoints} className="recalculate-button">
        Recalculate xPoints
      </button>
    </div>
  );
}
