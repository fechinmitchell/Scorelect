// src/components/PlayerDataGAA.js

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { firestore } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import PropTypes from 'prop-types';
import './PlayerDataGAA.css';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const useFetchDataset = (collectionPath, documentPath) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const fetchDataset = async () => {
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
        console.error('Error fetching the dataset:', err);
        setError(err.message);
        Swal.fire('Error', err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchDataset();
  }, [collectionPath, documentPath]);

  return { data, loading, error };
};

const LoadingIndicator = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading data...</p>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div className="error-container">
    <p>{message}</p>
  </div>
);

ErrorMessage.propTypes = {
  message: PropTypes.string.isRequired,
};

const LeaderboardTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'points', direction: 'descending' });
  const [searchTerm, setSearchTerm] = useState('');
  const rowRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(500);

  useEffect(() => {
    if (rowRef.current) {
      const rowHeight = rowRef.current.getBoundingClientRect().height;
      setMaxHeight(rowHeight * 10);
    }
  }, [data]);

  const sortedData = useMemo(() => {
    let sortableData = [...data];

    if (searchTerm) {
      sortableData = sortableData.filter((entry) =>
        entry.player.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortConfig !== null && sortConfig.key) {
      sortableData.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return sortableData;
  }, [data, sortConfig, searchTerm]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
  };

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
      <h2>Leaderboard</h2>
      <input
        type="text"
        placeholder="Search Players..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
        aria-label="Search Players"
      />
      <div className="table-wrapper" style={{ maxHeight: `${maxHeight}px` }}>
        <table className="leaderboard">
          <thead>
            <tr>
              <th onClick={() => requestSort('player')}>
                Player {getSortIndicator('player')}
              </th>
              <th onClick={() => requestSort('team')}>
                Team {getSortIndicator('team')}
              </th>
              <th onClick={() => requestSort('xPoints')}>
                Expected Points {getSortIndicator('xPoints')}
              </th>
              <th onClick={() => requestSort('points')}>
                Points {getSortIndicator('points')}
              </th>
              <th onClick={() => requestSort('goals')}>
                Goals {getSortIndicator('goals')}
              </th>
              <th onClick={() => requestSort('shotEfficiency')}>
                Shot Efficiency {getSortIndicator('shotEfficiency')}
              </th>
              <th onClick={() => requestSort('positionPerformance')}>
                Position Performance {getSortIndicator('positionPerformance')}
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
                <td>{entry.xPoints.toFixed(2)}</td>
                <td>{entry.points}</td>
                <td>{entry.goals}</td>
                <td>{entry.shotEfficiency.toFixed(2)}%</td>
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
};

LeaderboardTable.propTypes = {
  data: PropTypes.array.isRequired,
};

const ChartsContainer = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="charts-container">
        <p>No chart data available to display.</p>
      </div>
    );
  }

  const labels = data.map((entry) => entry.player);
  const xPointsData = data.map((entry) => entry.xPoints);
  const pointsData = data.map((entry) => entry.points);
  const goalsData = data.map((entry) => entry.goals);
  const shotEfficiencyData = data.map((entry) => entry.shotEfficiency);

  const barChartData = {
    labels,
    datasets: [
      {
        label: 'Expected Points (xPoints)',
        data: xPointsData,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
      {
        label: 'Actual Points',
        data: pointsData,
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Expected Points vs Actual Points per Player' },
    },
    interaction: { mode: 'index', intersect: false },
  };

  const pieChartData = {
    labels,
    datasets: [
      {
        label: 'Goals Distribution',
        data: goalsData,
        backgroundColor: [
          '#FF6384','#36A2EB','#FFCE56','#4BC0C0',
          '#9966FF','#FF9F40','#C9CBCF','#FF6384',
          '#36A2EB','#FFCE56'
        ],
      },
    ],
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'right' },
      title: { display: true, text: 'Goals Distribution among Players' },
    },
  };

  const lineChartData = {
    labels,
    datasets: [
      {
        label: 'Shot Efficiency (%)',
        data: shotEfficiencyData,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        fill: false,
        tension: 0.1,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Shot Efficiency per Player' },
    },
    interaction: { mode: 'index', intersect: false },
  };

  return (
    <div className="charts-container">
      <div className="chart">
        <Bar data={barChartData} options={barChartOptions} />
      </div>
      <div className="chart">
        <Pie data={pieChartData} options={pieChartOptions} />
      </div>
      <div className="chart">
        <Line data={lineChartData} options={lineChartOptions} />
      </div>
    </div>
  );
};

ChartsContainer.propTypes = {
  data: PropTypes.array.isRequired,
};

const PlayerDataGAA = () => {
  // NOTE: Make sure that "All Shots GAA" is actually the name of the dataset you have in Firestore.
  // If the datasetName in Firestore doesn't match, you will get a 404 "No data found for this dataset" error when recalculating.
  const { data, loading, error } = useFetchDataset(
    'savedGames/w9ZkqaYVM3dKSqqjWHLDVyh5sVg2/games', 
    'All Shots GAA'
  );

  const formattedLeaderboard = useMemo(() => {
    if (!data || !data.gameData) return [];

    const leaderboard = data.gameData.map((shot) => {
      const successfulOutcomes = ['score', 'made', 'hit'];
      const outcome = shot.Outcome ? shot.Outcome.toLowerCase() : 'unknown';
      const isSuccess = successfulOutcomes.includes(outcome);

      return {
        player: shot.playerName || 'Unknown Player',
        team: shot.team || 'Unknown Team',
        action: shot.action || 'unknown',
        position: shot.position || 'unknown',
        points: 0, 
        goals: 0,
        shots: 1,
        successfulShots: isSuccess ? 1 : 0,
        xPoints: shot.xPoints ? Number(shot.xPoints) : 0,
        actionIsGoal: (shot.action === 'goal'),
        actionIsPoint: (shot.action === 'point'),
      };
    });

    const summary = leaderboard.reduce((acc, curr) => {
      const playerKey = curr.player;
      if (!acc[playerKey]) {
        acc[playerKey] = {
          player: curr.player,
          team: curr.team,
          points: 0,
          goals: 0,
          shots: 0,
          successfulShots: 0,
          xPoints: 0,
          positionPerformance: {},
        };
      }

      if (curr.actionIsPoint) {
        acc[playerKey].points += 1;
      }
      if (curr.actionIsGoal) {
        acc[playerKey].points += 3;
        acc[playerKey].goals += 1;
      }

      acc[playerKey].shots += curr.shots;
      acc[playerKey].successfulShots += curr.successfulShots;
      acc[playerKey].xPoints += curr.xPoints;

      const position = curr.position;
      if (!acc[playerKey].positionPerformance[position]) {
        acc[playerKey].positionPerformance[position] = {
          shots: 0,
          points: 0,
          goals: 0
        };
      }
      acc[playerKey].positionPerformance[position].shots += curr.shots;
      if (curr.actionIsPoint) acc[playerKey].positionPerformance[position].points += 1;
      if (curr.actionIsGoal) acc[playerKey].positionPerformance[position].goals += 1;

      return acc;
    }, {});

    const finalLeaderboard = Object.values(summary).map(player => {
      const shotEfficiency = player.shots > 0 ? (player.successfulShots / player.shots) * 100 : 0;
      const positionPerformance = Object.entries(player.positionPerformance).map(([pos, stats]) => {
        const eff = stats.shots > 0 ? ((stats.points + stats.goals * 3) / stats.shots) * 100 : 0;
        return {
          position: pos,
          shots: stats.shots,
          points: stats.points,
          goals: stats.goals,
          efficiency: eff,
        };
      }).sort((a, b) => b.efficiency - a.efficiency);

      return {
        ...player,
        shotEfficiency,
        positionPerformance,
      };
    });

    return finalLeaderboard;
  }, [data]);

  const handleRecalculateXPoints = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/recalculate-xpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2', 
          datasetName: 'All Shots GAA' 
        })
      });

      const result = await response.json();
      if (!response.ok) {
        Swal.fire('Error', result.error || 'Failed to recalculate xpoints.', 'error');
      } else {
        Swal.fire('Success', 'xPoints recalculated successfully!', 'success');
        window.location.reload(); // Reload to fetch updated data
      }
    } catch (err) {
      Swal.fire('Error', 'Network error while recalculating xpoints.', 'error');
    }
  };

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;

  if (!data || !data.gameData || formattedLeaderboard.length === 0) {
    return <ErrorMessage message="No data available to display." />;
  }

  return (
    <div className="player-data-container">
      <h1>Player Data GAA</h1>
      <LeaderboardTable data={formattedLeaderboard} />
      <ChartsContainer data={formattedLeaderboard} />
      {/* Button to trigger recalculation */}
      <button onClick={handleRecalculateXPoints}>Recalculate xPoints</button>
    </div>
  );
};

export default PlayerDataGAA;
