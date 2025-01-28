// src/components/TeamDataGAA.js

import React, { useMemo, useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';

import './TeamDataGAA.css'; // Create this CSS file for styling

/*******************************************
 * 1) HELPER: parseJSONNoNaN
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
 * 2) HELPER: translateShotToOneSide
 *******************************************/
function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = shot.side === 'Left' ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters };
}

/*******************************************
 * 3) HELPER HOOK: useFetchDataset
 *******************************************/
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

/*******************************************
 * 4) LOADING & ERROR UI
 *******************************************/
function LoadingIndicator() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading team data...</p>
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

/*******************************************
 * 5) MiniLeaderboard Component
 *******************************************/
function MiniLeaderboard({
  title,
  data,
  actualKey,
  expectedKey,
  useDifference = false,
  differenceLabel = 'Difference (actual - expected)',
  hideCalcColumn = false,

  // New props to set default sorting by main stat in ascending order
  initialSortKey = null,         // e.g. 'points' or 'goals'
  initialDirection = 'descending' // default ascending
}) {
  // By default, we’ll sort by `initialSortKey` if provided
  const [sortConfig, setSortConfig] = useState({
    key: initialSortKey || '_calcVal',
    direction: initialDirection,
  });

  // Compute `_calcVal` if not hidden
  const sortedData = useMemo(() => {
    let list = [...data];

    // If not hiding the difference/ratio column, compute _calcVal
    if (!hideCalcColumn) {
      list = list.map((item) => {
        const actualVal = Number(item[actualKey] || 0);
        const expectedVal = Number(item[expectedKey] || 0);
        if (useDifference) {
          item._calcVal = actualVal - expectedVal; // difference
        } else {
          const safeExpected = expectedVal === 0 ? 1e-6 : expectedVal;
          item._calcVal = (actualVal / safeExpected) * 100; // ratio -> %
        }
        return item;
      });
    }

    // Sort logic
    if (sortConfig?.key) {
      list.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? 0;
        const bVal = b[sortConfig.key] ?? 0;

        if (aVal < bVal) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return list;
  }, [data, actualKey, expectedKey, useDifference, sortConfig, hideCalcColumn]);

  function requestSort(key) {
    let direction = 'ascending';
    // If we're clicking the same column, toggle
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
              <th onClick={() => requestSort('team')}>
                Team{getSortIndicator('team')}
              </th>
              <th onClick={() => requestSort(actualKey)}>
                {actualKey.replace('_', ' ')}
                {getSortIndicator(actualKey)}
              </th>
              <th onClick={() => requestSort(expectedKey)}>
                {expectedKey.replace('_', ' ')}
                {getSortIndicator(expectedKey)}
              </th>

              {/* Conditionally render the difference/ratio column */}
              {!hideCalcColumn && (
                <th onClick={() => requestSort('_calcVal')}>
                  {useDifference ? differenceLabel : 'Percentage (%)'}
                  {getSortIndicator('_calcVal')}
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {sortedData.map((item, index) => {
              const actualVal = Number(item[actualKey] || 0);
              const expectedVal = Number(item[expectedKey] || 0);

              let lastColumnValue = '';
              if (!hideCalcColumn) {
                if (useDifference) {
                  lastColumnValue = (actualVal - expectedVal).toFixed(2);
                } else {
                  const safeExpected = expectedVal === 0 ? 1e-6 : expectedVal;
                  const pct = (actualVal / safeExpected) * 100;
                  lastColumnValue = pct.toFixed(2) + '%';
                }
              }

              return (
                <tr key={`${item.team}-${index}`}>
                  <td>{index + 1}</td>
                  <td>
                    <Link
                      to={`/team/${encodeURIComponent(item.team)}`}
                      style={{
                        color: '#FFA500',
                        textDecoration: 'underline',
                      }}
                    >
                      {item.team}
                    </Link>
                  </td>
                  <td>{actualVal.toFixed(2)}</td>
                  <td>{expectedVal.toFixed(2)}</td>
                  {!hideCalcColumn && <td>{lastColumnValue}</td>}
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
  useDifference: PropTypes.bool,
  differenceLabel: PropTypes.string,
  hideCalcColumn: PropTypes.bool,
  initialSortKey: PropTypes.string,
  initialDirection: PropTypes.oneOf(['ascending', 'descending']),
};

/*******************************************
 * 6) AvgDistanceLeaderboard Component
 *******************************************/
function AvgDistanceLeaderboard({ title, data }) {
  const sortedData = useMemo(() => {
    let list = [...data];
    // Sort descending by "avgScoreDistance" as an example
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
              <th>Team</th>
              <th>Avg Distance (m)</th>
              <th>Avg Score Distance (m)</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => (
              <tr key={`${item.team}-${index}`}>
                <td>{index + 1}</td>
                <td>
                  <Link
                    to={`/team/${encodeURIComponent(item.team)}`}
                    state={{ teamData: item }}
                    style={{ color: '#FFA500', textDecoration: 'underline' }}
                  >
                    {item.team}
                  </Link>
                </td>
                <td>
                  {!isNaN(Number(item.avgDistance))
                    ? Number(item.avgDistance).toFixed(2)
                    : '0.00'}
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

/*******************************************
 * 7) Main Leaderboard Table Component
 *******************************************/
function LeaderboardTable({ data }) {
  const [sortConfig, setSortConfig] = useState({
    key: 'Total_Points',
    direction: 'descending', // Keep main LB descending by default
  });
  const [searchTerm, setSearchTerm] = useState('');
  const rowRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(500);

  // Calculate a maximum table height for scrolling
  useEffect(() => {
    if (rowRef.current) {
      const rowHeight = rowRef.current.getBoundingClientRect().height;
      setMaxHeight(rowHeight * 5);
    }
  }, [data]);

  // Sort & filter by searchTerm
  const sortedData = useMemo(() => {
    let list = [...data];

    // Filter if we have a searchTerm
    if (searchTerm) {
      list = list.filter((entry) =>
        entry.team.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Then sort
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

  // For changing the sorting key/direction
  function requestSort(key) {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }

  // Show an arrow next to sorted columns
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
      <h2 style={{ color: '#fff' }}>Team Leaderboard</h2>

      {/* Search box */}
      <input
        type="text"
        placeholder="Search Teams..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

      {/* Scrollable container */}
      <div className="table-wrapper" style={{ maxHeight: `${maxHeight}px` }}>
        <table className="leaderboard">
          <thead>
            <tr>
              <th onClick={() => requestSort('team')}>
                Team{getSortIndicator('team')}
              </th>
              <th onClick={() => requestSort('Total_Points')}>
                Total Points (Ex. Goals){getSortIndicator('Total_Points')}
              </th>
              <th onClick={() => requestSort('xPoints')}>
                Expected Points (xPoints){getSortIndicator('xPoints')}
              </th>
              <th onClick={() => requestSort('xGoals')}>
                Expected Goals (xGoals){getSortIndicator('xGoals')}
              </th>
              <th onClick={() => requestSort('xPReturn')}>
                xP Return (%) {getSortIndicator('xPReturn')}
              </th>
              <th onClick={() => requestSort('setPlays')}>
                Set Plays{getSortIndicator('setPlays')}
              </th>
              <th onClick={() => requestSort('offensiveMarks')}>
                Offensive Marks{getSortIndicator('offensiveMarks')}
              </th>
              <th onClick={() => requestSort('frees')}>
                Frees{getSortIndicator('frees')}
              </th>
              <th onClick={() => requestSort('pressureShots')}>
                Pressure Shots{getSortIndicator('pressureShots')}
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedData.map((entry, index) => (
              <tr
                key={index}
                className={`team-row ${index % 2 === 0 ? 'even' : 'odd'}`}
                ref={index === 0 ? rowRef : null}
              >
                <td>
                  <Link
                    to={`/team/${encodeURIComponent(entry.team)}`}
                    state={{ teamData: entry }}
                    style={{
                      color: '#FFA500',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    {entry.team}
                  </Link>
                </td>
                <td>{entry.Total_Points}</td>
                <td>
                  {!isNaN(Number(entry.xPoints))
                    ? Number(entry.xPoints).toFixed(2)
                    : '0.00'}
                </td>
                <td>
                  {!isNaN(Number(entry.xGoals))
                    ? Number(entry.xGoals).toFixed(2)
                    : '0.00'}
                </td>
                <td>
                  {!isNaN(Number(entry.xPReturn))
                    ? Number(entry.xPReturn).toFixed(2) + '%'
                    : '0.00%'}
                </td>
                <td>{entry.setPlays}</td>
                <td>{entry.offensiveMarks}</td>
                <td>{entry.frees}</td>
                <td>{entry.pressureShots}</td>
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

/*******************************************
 * 8) Main TeamDataGAA Component
 *******************************************/
export default function TeamDataGAA() {
  // Replace with your own user/dataset
  const USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
  const DATASET_NAME = 'All Shots GAA';

  // Fetch from Firestore
  const { data, loading, error } = useFetchDataset(
    `savedGames/${USER_ID}/games`,
    DATASET_NAME
  );

  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedTeam, setSelectedTeam] = useState('All');

  // Collect unique years
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

  // Collect unique teams
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

  // Build a final "leaderboard" array
  const formattedLeaderboard = useMemo(() => {
    if (!data || !data.gameData) return [];

    // Filter by chosen year & team
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

    // Distances reference
    const goalY = 44;
    const goalX = 145;
    const halfLineX = 72.5;

    // Aggregate
    const aggregator = shotsFiltered.reduce((acc, shot) => {
      const teamName = shot.team || 'Unknown Team';
      if (!acc[teamName]) {
        acc[teamName] = {
          team: teamName,
          points: 0,
          goals: 0,
          xPoints: 0,
          xGoals: 0,
          setPlays: 0,
          xSetPlays: 0,
          offensiveMarks: 0,
          frees: 0,
          pressureShots: 0,
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

      const entry = acc[teamName];
      const act = (shot.action || '').toLowerCase().trim();

      if (act === 'point') {
        entry.points += 1;
        const translatedShot = translateShotToOneSide(shot, halfLineX, goalX, goalY);
        if (
          typeof translatedShot.x === 'number' &&
          typeof translatedShot.y === 'number' &&
          translatedShot.distMeters >= 40
        ) {
          entry.twoPointerAttempts += 1;
          entry.twoPointerScores += 1; // Assuming points are scored
        }
      }

      if (act === 'goal' || act === 'penalty goal') {
        entry.goals += 1;
        entry.shootingScored += 1;
      }

      if (
        act.includes('offensive mark') &&
        !act.includes('wide') &&
        !act.includes('short') &&
        !act.includes('miss')
      ) {
        entry.offensiveMarks += 1;
      }

      if (
        act === 'free' ||
        act === 'missed free' ||
        act === 'free wide' ||
        act === 'free short'
      ) {
        entry.frees += 1;
      }

      if (act.includes('fortyfive')) {
        entry.setPlays += 1;
        if (shot.xPoints) entry.xSetPlays += Number(shot.xPoints);
      }

      // Expected values
      if (shot.xPoints) entry.xPoints += Number(shot.xPoints);
      if (shot.xGoals) entry.xGoals += Number(shot.xGoals);

      // Pressured shots
      const isPressured = (shot.pressure || '').toLowerCase().startsWith('y');
      if (isPressured) {
        entry.pressuredShots += 1;
        if (act === 'goal') {
          entry.pressuredScores += 1;
        }
      }

      // Shooting attempts and distances
      const translated = translateShotToOneSide(shot, halfLineX, goalX, goalY);
      entry.totalDistance += translated.distMeters;
      entry.shootingAttempts += 1;
      if (act === 'goal' || act === 'point') {
        entry.totalScoreDistance += translated.distMeters;
      }

      return acc;
    }, {});

    // Turn aggregator object into array
    const finalArray = Object.values(aggregator).map((team) => {
      // xPReturn => ratio of actualPoints / xPoints * 100
      const xPReturn = team.xPoints > 0 ? (team.points / team.xPoints) * 100 : 0;

      // average distances
      const avgDistance =
        team.shootingAttempts > 0
          ? team.totalDistance / team.shootingAttempts
          : 0;
      const avgScoreDistance =
        team.shootingScored > 0
          ? team.totalScoreDistance / team.shootingScored
          : 0;

      return {
        ...team,
        Total_Points: team.points, // rename for the main Leaderboard
        xPReturn,
        avgDistance,
        avgScoreDistance,
      };
    });

    return finalArray;
  }, [data, selectedYear, selectedTeam]);

  // Sub-data for mini leaderboards:
  const goalsData = useMemo(
    () =>
      formattedLeaderboard.map((team) => ({
        team: team.team,
        goals: team.goals,
        xGoals: team.xGoals,
      })),
    [formattedLeaderboard]
  );

  const pointsData = useMemo(
    () =>
      formattedLeaderboard.map((team) => ({
        team: team.team,
        points: team.points,
        xPoints: team.xPoints,
      })),
    [formattedLeaderboard]
  );

  const setPlaysData = useMemo(
    () =>
      formattedLeaderboard.map((team) => ({
        team: team.team,
        setPlays: team.setPlays,
        xSetPlays: team.xSetPlays,
      })),
    [formattedLeaderboard]
  );

  const accuracyData = useMemo(
    () =>
      formattedLeaderboard.map((team) => ({
        team: team.team,
        shootingScored: team.shootingScored,
        shootingAttempts: team.shootingAttempts,
      })),
    [formattedLeaderboard]
  );

  const twoPointerData = useMemo(
    () =>
      formattedLeaderboard.map((team) => ({
        team: team.team,
        twoPointerScores: team.twoPointerScores,
        twoPointerAttempts: team.twoPointerAttempts,
      })),
    [formattedLeaderboard]
  );

  const pressureData = useMemo(
    () =>
      formattedLeaderboard.map((team) => ({
        team: team.team,
        pressuredScores: team.pressuredScores,
        pressuredShots: team.pressuredShots,
      })),
    [formattedLeaderboard]
  );

  const distanceData = useMemo(
    () =>
      formattedLeaderboard.map((team) => ({
        team: team.team,
        avgDistance: !isNaN(team.avgDistance)
          ? team.avgDistance.toFixed(2)
          : '0.00',
        avgScoreDistance: !isNaN(team.avgScoreDistance)
          ? team.avgScoreDistance.toFixed(2)
          : '0.00',
      })),
    [formattedLeaderboard]
  );

  /**
   * Handles recalculating xPoints via an API call.
   */
  async function handleRecalculateXPoints() {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/recalculate-xpoints`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: USER_ID,
            datasetName: DATASET_NAME,
          }),
        }
      );
      const result = await parseJSONNoNaN(response);
      if (!response.ok) {
        Swal.fire(
          'Error',
          result.error || 'Failed to recalculate xPoints.',
          'error'
        );
      } else {
        Swal.fire('Success', 'xPoints recalculated successfully!', 'success');
        window.location.reload();
      }
    } catch (err) {
      Swal.fire('Error', 'Network error while recalculating xPoints.', 'error');
    }
  }

  // Loading or error or no data
  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (!data || !data.gameData || formattedLeaderboard.length === 0) {
    return <ErrorMessage message="No data available to display." />;
  }

  return (
    <div className="team-data-container">
      <h1 style={{ color: '#fff' }}>Team Data GAA</h1>

      {/* Filter: Year, Team */}
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

      {/* MINI-LEADERBOARDS */}
      <div className="mini-leaderboards-row">
        <MiniLeaderboard
          title="Goals Leaderboard"
          data={goalsData}
          actualKey="goals"
          expectedKey="xGoals"
          useDifference={true}         // diff column
          differenceLabel="Diff"
          initialSortKey="goals"       // Sort by actual goals descending by default
          initialDirection="descending"
        />

        <MiniLeaderboard
          title="Points Leaderboard"
          data={pointsData}
          actualKey="points"
          expectedKey="xPoints"
          useDifference={true}
          differenceLabel="Diff"
          initialSortKey="points"      // Sort by actual points descending
          initialDirection="descending"
        />

        <MiniLeaderboard
          title="Set Plays Leaderboard"
          data={setPlaysData}
          actualKey="setPlays"
          expectedKey="xSetPlays"
          hideCalcColumn={true}        // No difference/percentage column
          initialSortKey="setPlays"    // Sort by setPlays descending
          initialDirection="descending"
        />
      </div>

      <div className="mini-leaderboards-row">
        <MiniLeaderboard
          title="Shooting Accuracy"
          data={accuracyData}
          actualKey="shootingScored"
          expectedKey="shootingAttempts"
          useDifference={false}        // Show ratio => %
          initialSortKey="shootingScored" // Sort by shootingScored descending
          initialDirection="descending"
        />

        <MiniLeaderboard
          title="2-Pointer Leaderboard"
          data={twoPointerData}
          actualKey="twoPointerScores"
          expectedKey="twoPointerAttempts"
          useDifference={false}
          initialSortKey="twoPointerScores"
          initialDirection="descending"
        />
      </div>

      <div className="mini-leaderboards-row">
        <MiniLeaderboard
          title="Under Pressure Shots"
          data={pressureData}
          actualKey="pressuredScores"
          expectedKey="pressuredShots"
          useDifference={false}
          initialSortKey="pressuredScores"
          initialDirection="descending"
        />

        <AvgDistanceLeaderboard
          title="Avg Shooting Distance"
          data={distanceData}
        />
      </div>

      {/* MAIN LEADERBOARD */}
      <LeaderboardTable data={formattedLeaderboard} />

      {/* Recalculate button */}
      <button onClick={handleRecalculateXPoints} className="recalculate-button">
        Recalculate xPoints
      </button>
    </div>
  );
}
