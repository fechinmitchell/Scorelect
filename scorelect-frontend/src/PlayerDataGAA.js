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

import ChartDataLabels from 'chartjs-plugin-datalabels'; // Import the plugin
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
  Legend,
  ChartDataLabels // Register the plugin
);

// Custom Hook to fetch dataset
const useFetchDataset = (collectionPath, documentPath) => {
  const [data, setData] = useState(null); // useState called at top
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

// Loading Indicator Component
const LoadingIndicator = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading data...</p>
  </div>
);

// Error Message Component
const ErrorMessage = ({ message }) => (
  <div className="error-container">
    <p>{message}</p>
  </div>
);

ErrorMessage.propTypes = {
  message: PropTypes.string.isRequired,
};

// Leaderboard Table Component
const LeaderboardTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'xPoints', direction: 'descending' });
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
      <h2 style={{ color: "#fff"}}>Leaderboard</h2>
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
                Expected Points (xPoints) {getSortIndicator('xPoints')}
              </th>
              <th onClick={() => requestSort('points')}>
                Points {getSortIndicator('points')}
              </th>
              <th onClick={() => requestSort('goals')}>
                Goals {getSortIndicator('goals')}
              </th>
              <th onClick={() => requestSort('xPReturn')}>
                xP Return (%) {getSortIndicator('xPReturn')}
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
};

LeaderboardTable.propTypes = {
  data: PropTypes.array.isRequired,
};

// Charts Container Component
const ChartsContainer = ({ data }) => {
  // **Move all Hooks to the top before any conditional returns**

  // Calculate average xPoints
  const averageXPoints = useMemo(() => {
    if (data.length === 0) return 0;
    const xPointsData = data.map(entry => entry.xPoints);
    if (xPointsData.length === 0) return 0;
    const total = xPointsData.reduce((sum, val) => sum + val, 0);
    return total / xPointsData.length;
  }, [data]);

  // **Early return after Hooks**
  if (data.length === 0) {
    return (
      <div className="charts-container">
        <p>No chart data available to display.</p>
      </div>
    );
  }

  // Define chart colors consistently
  const chartColors = {
    xPoints: 'rgba(75, 192, 192, 0.6)',
    actualPoints: 'rgba(255, 159, 64, 0.6)',
    goals: [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
      '#9966FF', '#FF9F40', '#C9CBCF', '#FF6384',
      '#36A2EB', '#FFCE56'
    ],
    xPReturn: 'rgba(153, 102, 255, 0.6)',
  };

  const labels = data.map((entry) => entry.player);
  const xPointsData = data.map((entry) => entry.xPoints);
  const pointsData = data.map((entry) => entry.points);
  const goalsData = data.map((entry) => entry.goals);
  const xPReturnData = data.map((entry) => entry.xPReturn);

  // Bar Chart: Expected Points vs Actual Points
  const barChartData = {
    labels,
    datasets: [
      {
        label: 'Expected Points (xPoints)',
        data: xPointsData,
        backgroundColor: chartColors.xPoints,
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
      {
        label: 'Actual Points',
        data: pointsData,
        backgroundColor: chartColors.actualPoints,
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allows setting custom height
    plugins: {
      legend: { 
        position: 'top',
        onClick: (e, legendItem, legend) => {
          const index = legendItem.datasetIndex;
          const ci = legend.chart;
          const meta = ci.getDatasetMeta(index);
          meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
          ci.update();
        },
      },
      title: { display: true, text: 'Expected Points vs Actual Points (Top 5 Players)' },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y}`;
          }
        }
      },
      datalabels: { // Data labels plugin configuration
        anchor: 'end',
        align: 'top',
        formatter: (value) => value.toFixed(2),
        color: '#000',
        font: {
          weight: 'bold',
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 40, // **Set maximum y-axis value to 40**
        ticks: {
          stepSize: 5, // **Set step size to 5 for tick intervals at 5, 10, ..., 40**
        },
        title: { display: true, text: 'Points' },
      },
      x: {
        title: { display: true, text: 'Players' },
      },
    },
    interaction: { mode: 'index', intersect: false },
  };

  // Pie Chart: Goals Distribution
  const pieChartData = {
    labels,
    datasets: [
      {
        label: 'Goals Distribution',
        data: goalsData,
        backgroundColor: chartColors.goals,
        borderColor: '#fff',
        borderWidth: 1,
      },
    ],
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allows setting custom height
    plugins: {
      legend: { 
        position: 'right',
        onClick: (e, legendItem, legend) => {
          const index = legendItem.index;
          const ci = legend.chart;
          const meta = ci.getDatasetMeta(0);
          meta.data[index].hidden = !meta.data[index].hidden;
          ci.update();
        },
      },
      title: { display: true, text: 'Goals Distribution among Top 5 Players' },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.chart._metasets[context.datasetIndex].total;
            const percentage = ((value / total) * 100).toFixed(2);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
      datalabels: { // Data labels plugin configuration
        formatter: (value, context) => `${value} (${((value / data.reduce((sum, entry) => sum + entry.goals, 0)) * 100).toFixed(2)}%)`,
        color: '#fff',
        font: {
          weight: 'bold',
        },
      },
    },
  };

  // Line Chart: xP Return
  const lineChartData = {
    labels,
    datasets: [
      {
        label: 'xP Return (%)',
        data: xPReturnData,
        backgroundColor: chartColors.xPReturn,
        borderColor: 'rgba(153, 102, 255, 1)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allows setting custom height
    plugins: {
      legend: { 
        position: 'top',
        onClick: (e, legendItem, legend) => {
          const index = legendItem.datasetIndex;
          const ci = legend.chart;
          const meta = ci.getDatasetMeta(index);
          meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
          ci.update();
        },
      },
      title: { display: true, text: 'xP Return per Top 5 Player' },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `xP Return: ${context.parsed.y.toFixed(2)}%`;
          }
        }
      },
      datalabels: { // Data labels plugin configuration
        anchor: 'end',
        align: 'top',
        formatter: (value) => value.toFixed(2),
        color: '#000',
        font: {
          weight: 'bold',
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 500, // **Set maximum y-axis value to 500**
        ticks: {
          stepSize: 50, // **Set step size to 50 for tick intervals at 50, 100, ..., 400**
        },
        title: { display: true, text: 'xP Return (%)' },
      },
      x: {
        title: { display: true, text: 'Players' },
      },
    },
    interaction: { mode: 'nearest', intersect: true },
  };

  return (
    <div className="charts-container">
      <div className="chart-wrapper">
        <Bar data={barChartData} options={barChartOptions} />
      </div>
      <div className="chart-wrapper">
        <Pie data={pieChartData} options={pieChartOptions} />
      </div>
      <div className="chart-wrapper">
        <Line data={lineChartData} options={lineChartOptions} />
      </div>
    </div>
  );
};

ChartsContainer.propTypes = {
  data: PropTypes.array.isRequired,
};

const PlayerDataGAA = () => {
  // Replace with dynamic USER_ID and DATASET_NAME as needed
  const USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
  const DATASET_NAME = 'All Shots GAA';

  const { data, loading, error } = useFetchDataset(
    `savedGames/${USER_ID}/games`, 
    DATASET_NAME
  );

  // State for selected year
  const [selectedYear, setSelectedYear] = useState('All');

  // Extract unique years from the data for the dropdown
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    data?.gameData?.forEach((shot) => {
      if (shot.matchDate) {
        const year = new Date(shot.matchDate).getFullYear();
        yearsSet.add(year);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a); // Sort years descending
  }, [data]);

  const formattedLeaderboard = useMemo(() => {
    if (!data || !data.gameData) return [];

    // Filter shots based on selected year
    const filteredShots = data.gameData.filter((shot) => {
      if (selectedYear === 'All') return true;
      if (!shot.matchDate) return false; // Exclude shots without matchDate
      const shotYear = new Date(shot.matchDate).getFullYear();
      return shotYear.toString() === selectedYear;
    });

    if (filteredShots.length === 0) return [];

    const leaderboard = filteredShots.map((shot) => {
      const successfulOutcomes = ['score', 'made', 'hit'];
      const outcome = shot.Outcome ? shot.Outcome.toLowerCase() : 'unknown';
      const isSuccess = successfulOutcomes.includes(outcome);

      // Extract year from matchDate
      const shotYear = shot.matchDate ? new Date(shot.matchDate).getFullYear() : 'Unknown';

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
        year: shotYear,
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
      // Calculate xP Return (%) = (Actual Points / Expected Points) * 100
      const xPReturn = player.xPoints > 0 ? (player.points / player.xPoints) * 100 : 0;

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
        xPReturn,
        positionPerformance,
      };
    });

    return finalLeaderboard;
  }, [data, selectedYear]);

  // **Compute Top 5 Leaderboard based on Points**
  const top5Leaderboard = useMemo(() => {
    if (!formattedLeaderboard || formattedLeaderboard.length === 0) return [];

    // Sort the leaderboard by 'points' in descending order
    const sortedByPoints = [...formattedLeaderboard].sort((a, b) => b.points - a.points);

    // Slice the top 5 players
    return sortedByPoints.slice(0, 5);
  }, [formattedLeaderboard]);

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

  // **Ensure all Hooks are called before any conditional returns**
  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (!data || !data.gameData || formattedLeaderboard.length === 0) {
    return <ErrorMessage message="No data available to display." />;
  }

  return (
    <div className="player-data-container">
      <h1 style={{ color: "#fff"}}>Player Data GAA</h1>
      
      {/* Year Filter Dropdown */}
      <div className="year-filter">
        <label style={{ color: "#fff"}} htmlFor="year-select">Filter by Year: </label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
        >
          <option value="All">All Years</option>
          {availableYears.map((year) => (
            <option key={year} value={year.toString()}>{year}</option>
          ))}
        </select>
      </div>

      {/* Leaderboard Table */}
      <LeaderboardTable data={formattedLeaderboard} />

      {/* Charts - Only Top 5 Players */}
      <ChartsContainer data={top5Leaderboard} />

      {/* Button to trigger recalculation */}
      <button onClick={handleRecalculateXPoints} className="recalculate-button">Recalculate xPoints</button>
    </div>
  );
};

export default PlayerDataGAA;
