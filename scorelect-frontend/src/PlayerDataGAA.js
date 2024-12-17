// src/components/PlayerDataGAA.js

import React, { useMemo, useState } from 'react';
import { firestore } from './firebase'; // Ensure this points to your Firebase setup
import { doc, getDoc } from 'firebase/firestore';
import {
  Chart,
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
import PropTypes from 'prop-types';
import './PlayerDataGAA.css';
import Swal from 'sweetalert2';

// Register Chart.js components
Chart.register(
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

/**
 * Custom Hook: useFetchDataset
 *
 * Fetches a specific dataset from Firestore.
 *
 * @param {string} collectionPath - The path to the collection.
 * @param {string} documentPath - The path to the document.
 * @returns {object} - Contains data, loading, and error states.
 */
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

/**
 * LoadingIndicator Component
 *
 * Displays a spinner while data is loading.
 */
const LoadingIndicator = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading data...</p>
  </div>
);

/**
 * ErrorMessage Component
 *
 * Displays an error message.
 *
 * @param {object} props - Component props.
 * @param {string} props.message - Error message to display.
 */
const ErrorMessage = ({ message }) => (
  <div className="error-container">
    <p>{message}</p>
  </div>
);

ErrorMessage.propTypes = {
  message: PropTypes.string.isRequired,
};

/**
 * LeaderboardTable Component
 *
 * Displays the leaderboard in a sortable and searchable table.
 *
 * @param {object} props - Component props.
 * @param {Array} props.data - Array of player data.
 */
const LeaderboardTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'points', direction: 'descending' });
  const [searchTerm, setSearchTerm] = useState('');

  const sortedData = useMemo(() => {
    let sortableData = [...data];

    if (searchTerm) {
      sortableData = sortableData.filter((entry) =>
        entry.player.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortConfig !== null) {
      sortableData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
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
    if (sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
  };

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
  );
};

LeaderboardTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      player: PropTypes.string.isRequired,
      team: PropTypes.string.isRequired,
      xPoints: PropTypes.number.isRequired,
      points: PropTypes.number.isRequired,
      goals: PropTypes.number.isRequired,
      shotEfficiency: PropTypes.number.isRequired,
      positionPerformance: PropTypes.arrayOf(
        PropTypes.shape({
          position: PropTypes.string.isRequired,
          shots: PropTypes.number.isRequired,
          points: PropTypes.number.isRequired,
          goals: PropTypes.number.isRequired,
          efficiency: PropTypes.number.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
};

/**
 * ChartsContainer Component
 *
 * Displays Bar, Pie, and Line charts based on the leaderboard data.
 *
 * @param {object} props - Component props.
 * @param {Array} props.data - Array of player data.
 */
const ChartsContainer = ({ data }) => {
  const labels = data.map((entry) => entry.player);
  const xPointsData = data.map((entry) => entry.xPoints);
  const pointsData = data.map((entry) => entry.points);
  const goalsData = data.map((entry) => entry.goals);
  const shotEfficiencyData = data.map((entry) => entry.shotEfficiency);

  // Bar Chart: Expected Points vs Actual Points
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
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Expected Points vs Actual Points per Player',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  // Pie Chart: Goals Distribution
  const pieChartData = {
    labels,
    datasets: [
      {
        label: 'Goals Distribution',
        data: goalsData,
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#C9CBCF',
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
        ],
      },
    ],
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Goals Distribution among Players',
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed;
            return `${label}: ${value} Goals`;
          },
        },
      },
    },
  };

  // Line Chart: Shot Efficiency Over Players
  const lineChartData = {
    labels,
    datasets: [
      {
        label: 'Shot Efficiency (%)',
        data: shotEfficiencyData,
        fill: false,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        tension: 0.1,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Shot Efficiency per Player',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
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
  data: PropTypes.arrayOf(
    PropTypes.shape({
      player: PropTypes.string.isRequired,
      xPoints: PropTypes.number.isRequired,
      points: PropTypes.number.isRequired,
      goals: PropTypes.number.isRequired,
      shotEfficiency: PropTypes.number.isRequired,
    })
  ).isRequired,
};

/**
 * PlayerDataGAA Component
 *
 * Main component that fetches GAA player data and displays a leaderboard and charts.
 */
const PlayerDataGAA = () => {
  const { data, loading, error } = useFetchDataset(
    'savedGames/w9ZkqaYVM3dKSqqjWHLDVyh5sVg2/games',
    'All Shots GAA'
  );

  const formattedLeaderboard = useMemo(() => {
    if (!data) return [];

    const leaderboard = data.gameData.map((shot) => ({
      player: shot.playerName,
      team: shot.team,
      action: shot.action,
      minute: Number(shot.minute),
      shotType: shot.type,
      position: shot.position,
      xP_adv_shot: shot.xP_adv_shot ? Number(shot.xP_adv_shot) : 0,
      xPoints: shot.xPoints ? Number(shot.xPoints) : 0,
      shotDistance: shot.Shot_Distance ? Number(shot.Shot_Distance) : 0,
    }));

    // Calculate Expected Points (xPoints) and Shot Efficiency
    const summary = leaderboard.reduce((acc, curr) => {
      if (!acc[curr.player]) {
        acc[curr.player] = {
          player: curr.player,
          team: curr.team,
          points: 0, // Total points including goals
          goals: 0,  // Separate count of goals
          shots: 0,
          successfulShots: 0,
          xPoints: 0,
          shotEfficiency: 0,
          positionPerformance: {},
        };
      }

      // Update Points and Goals based on action type
      if (curr.action === 'point') {
        acc[curr.player].points += 1; // Regular score
      }
      if (curr.action === 'goal') {
        acc[curr.player].points += 3; // Goal is worth 3 points
        acc[curr.player].goals += 1;  // Increment goal count
      }

      // Update Shots and Successful Shots
      acc[curr.player].shots += 1;
      if (curr.action === 'point' || curr.action === 'goal') {
        acc[curr.player].successfulShots += 1;
      }

      // Update Expected Points
      acc[curr.player].xPoints += curr.xPoints;

      // Update Position-Based Performance
      if (!acc[curr.player].positionPerformance[curr.position]) {
        acc[curr.player].positionPerformance[curr.position] = {
          shots: 0,
          points: 0,
          goals: 0,
        };
      }
      acc[curr.player].positionPerformance[curr.position].shots += 1;
      if (curr.action === 'point') acc[curr.player].positionPerformance[curr.position].points += 1;
      if (curr.action === 'goal') acc[curr.player].positionPerformance[curr.position].goals += 1;

      return acc;
    }, {});

    // Calculate Shot Efficiency and Position Performance
    const finalLeaderboard = Object.values(summary).map((player) => ({
      ...player,
      shotEfficiency: player.shots > 0 ? (player.successfulShots / player.shots) * 100 : 0,
      positionPerformance: Object.entries(player.positionPerformance)
        .map(([position, stats]) => ({
          position,
          shots: stats.shots,
          points: stats.points,
          goals: stats.goals,
          efficiency: stats.shots > 0 ? ((stats.points + stats.goals * 3) / stats.shots) * 100 : 0, // Updated efficiency
        }))
        .sort((a, b) => b.efficiency - a.efficiency),
    }));

    return finalLeaderboard;
  }, [data]);

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!data) {
    return <ErrorMessage message="No data found!" />;
  }

  return (
    <div className="player-data-container">
      <h1>Player Data GAA</h1>
      <LeaderboardTable data={formattedLeaderboard} />
      <ChartsContainer data={formattedLeaderboard} />
    </div>
  );
};

export default PlayerDataGAA;
