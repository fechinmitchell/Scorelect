import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Modal from 'react-modal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './SoccerAnalysisDashboard.css';

// Import icons
import { 
  FaFilter, 
  FaDownload, 
  FaCog, 
  FaChartLine, 
  FaSearch,
  FaHistory,
  FaCalculator,
  FaSyncAlt,
  FaEye,
  FaEyeSlash
} from 'react-icons/fa';

// Helper function to calculate expected goals (xG)
const calculateXG = (event) => {
  // Basic xG calculation (just for demonstration)
  let xg = 0;
  if (event.action === 'goal') xg = 0.7;
  else if (event.action === 'shot on target') xg = 0.3;
  else if (event.action === 'shot off target') xg = 0.1;
  return xg;
};

// Main Dashboard Component
const SoccerAnalysisDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data = location.state?.file, filters, charts, sport } = location.state || {};

  // UI state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hiddenCharts, setHiddenCharts] = useState({
    xgChart: false,
    shotDistribution: false,
    passCompletion: false,
    goalsOverTime: false,
    playerShots: false,
    teamPossession: false
  });

  // Filter state
  const [dashboardTeam, setDashboardTeam] = useState('All');
  const [dashboardPlayer, setDashboardPlayer] = useState('All');
  const [dashboardEvent, setDashboardEvent] = useState('All');

  // Theme settings state
  const [chartColors, setChartColors] = useState({
    xgChart: '#733FAA',
    shotDistribution: '#8C52CC',
    passCompletion: {
      completed: '#50FA7B',
      missed: '#FF5555'
    },
    goalsOverTime: '#FFBF4D',
    playerShots: '#FF79C6',
    teamPossession: '#733FAA'
  });

  // Validate data
  useEffect(() => {
    if (!data || !sport) {
      Swal.fire({
        title: 'No Data',
        text: 'No dataset found. Please select a dataset from the analysis page.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      }).then(() => navigate('/analysis'));
      return;
    }

    if (sport !== 'Soccer') {
      Swal.fire({
        title: 'Wrong Sport',
        text: 'This dashboard is only available for Soccer. Please select Soccer from the sidebar.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      }).then(() => navigate('/analysis'));
      return;
    }
  }, [data, sport, navigate]);

  // Process data
  const allGames = data?.games || [];
  const allEvents = useMemo(() => {
    return allGames.flatMap((game) => {
      const gameEvents = game.gameData || [];
      return gameEvents.map(event => ({
        ...event,
        match: game.match || game.gameName || 'Unknown Match',
        xG: calculateXG(event)
      }));
    });
  }, [allGames]);

  // Extract unique values for filters
  const uniqueTeams = useMemo(() => 
    Array.from(new Set(allEvents.map(e => e.team))).filter(Boolean),
  [allEvents]);
  
  const uniquePlayers = useMemo(() => 
    Array.from(new Set(allEvents.map(e => e.playerName))).filter(Boolean),
  [allEvents]);
  
  const uniqueActions = useMemo(() => 
    Array.from(new Set(allEvents.map(e => e.action))).filter(Boolean),
  [allEvents]);

  const uniqueMatches = useMemo(() => 
    Array.from(new Set(allEvents.map(e => e.match))).filter(Boolean),
  [allEvents]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      const teamMatch = dashboardTeam === 'All' ? true : event.team === dashboardTeam;
      const playerMatch = dashboardPlayer === 'All' ? true : event.playerName === dashboardPlayer;
      const actionMatch = dashboardEvent === 'All' ? true : event.action === dashboardEvent;
      return teamMatch && playerMatch && actionMatch;
    });
  }, [allEvents, dashboardTeam, dashboardPlayer, dashboardEvent]);

  // Calculate summary metrics
  const summary = useMemo(() => {
    const totalGoals = filteredEvents.filter(e => e.action === 'goal').length;
    const totalShots = filteredEvents.filter(e => (e.action || '').includes('shot')).length;
    const totalAssists = filteredEvents.filter(e => e.action === 'assist').length;
    const totalMatches = new Set(filteredEvents.map(e => e.match)).size;
    const possession = dashboardTeam !== 'All' ? 
      Math.round(Math.random() * 40) + 30 : null; // Mock possession data

    return {
      totalGoals,
      totalShots,
      totalAssists,
      totalMatches,
      possession
    };
  }, [filteredEvents, dashboardTeam]);

  // Prepare chart data
  // 1. XG by team
  const xgByTeamData = useMemo(() => {
    const xgMap = {};
    filteredEvents.forEach(e => {
      if (!xgMap[e.team]) xgMap[e.team] = 0;
      xgMap[e.team] += e.xG || 0;
    });
    return Object.entries(xgMap).map(([team, xg]) => ({ 
      name: team, 
      xg: parseFloat(xg.toFixed(2)) 
    }));
  }, [filteredEvents]);

  // 2. Shot distribution by action
  const shotDistributionData = useMemo(() => {
    const actionMap = {};
    filteredEvents.filter(e => e.action && (
      e.action.includes('shot') || 
      e.action === 'goal' || 
      e.action.includes('miss')
    )).forEach(e => {
      const action = e.action || 'Unknown';
      if (!actionMap[action]) actionMap[action] = 0;
      actionMap[action]++;
    });
    return Object.entries(actionMap).map(([action, count]) => ({ 
      action, 
      count 
    }));
  }, [filteredEvents]);

  // 3. Pass completion data
  const passCompletionData = useMemo(() => {
    const passMap = {};
    
    filteredEvents.filter(e => 
      e.action === 'pass' || 
      e.action === 'assist' || 
      e.action === 'missed pass'
    ).forEach(e => {
      if (!passMap[e.team]) {
        passMap[e.team] = { completed: 0, missed: 0 };
      }
      
      if (e.action === 'missed pass') {
        passMap[e.team].missed++;
      } else {
        passMap[e.team].completed++;
      }
    });
    
    return Object.entries(passMap).map(([team, stats]) => ({
      team,
      completed: stats.completed,
      missed: stats.missed
    }));
  }, [filteredEvents]);

  // 4. Goals over time data
  const goalsOverTimeData = useMemo(() => {
    const timeIntervals = [
      '0-15', '16-30', '31-45', '46-60', '61-75', '76-90+'
    ];
    
    const goalsMap = timeIntervals.reduce((acc, interval) => {
      acc[interval] = 0;
      return acc;
    }, {});
    
    filteredEvents.filter(e => e.action === 'goal').forEach(e => {
      const minute = parseInt(e.minute, 10);
      if (isNaN(minute)) return;
      
      let interval;
      if (minute <= 15) interval = '0-15';
      else if (minute <= 30) interval = '16-30';
      else if (minute <= 45) interval = '31-45';
      else if (minute <= 60) interval = '46-60';
      else if (minute <= 75) interval = '61-75';
      else interval = '76-90+';
      
      goalsMap[interval]++;
    });
    
    return Object.entries(goalsMap).map(([minute, goals]) => ({
      minute,
      goals
    }));
  }, [filteredEvents]);

  // 5. Player shots data
  const playerShotsData = useMemo(() => {
    const shotMap = {};
    
    filteredEvents.filter(e => 
      e.action === 'shot on target' || 
      e.action === 'shot off target' || 
      e.action === 'goal'
    ).forEach(e => {
      const player = e.playerName || 'Unknown';
      if (!shotMap[player]) {
        shotMap[player] = { 
          shots: 0, 
          goals: 0,
          onTarget: 0,
          offTarget: 0
        };
      }
      
      shotMap[player].shots++;
      
      if (e.action === 'goal') {
        shotMap[player].goals++;
        shotMap[player].onTarget++;
      } else if (e.action === 'shot on target') {
        shotMap[player].onTarget++;
      } else if (e.action === 'shot off target') {
        shotMap[player].offTarget++;
      }
    });
    
    return Object.entries(shotMap)
      .map(([player, stats]) => ({
        player,
        shots: stats.shots,
        goals: stats.goals,
        onTarget: stats.onTarget,
        offTarget: stats.offTarget,
        accuracy: stats.shots > 0 ? 
          (stats.onTarget / stats.shots * 100).toFixed(1) + '%' : '0%'
      }))
      .sort((a, b) => b.shots - a.shots)
      .slice(0, 10); // Top 10 players
  }, [filteredEvents]);

  // 6. Team possession data (mock)
  const teamPossessionData = useMemo(() => {
    const teams = [...new Set(filteredEvents.map(e => e.team))];
    if (teams.length === 0) return [];
    
    // Creating mock possession data
    let remaining = 100;
    const result = [];
    
    teams.forEach((team, index) => {
      // For the last team, use the remaining percentage
      const isLastTeam = index === teams.length - 1;
      const possession = isLastTeam ? 
        remaining : 
        index === 0 ? Math.floor(Math.random() * 30) + 40 : Math.floor(remaining / (teams.length - index));
      
      result.push({
        name: team,
        possession
      });
      
      remaining -= possession;
    });
    
    return result;
  }, [filteredEvents]);

  // Handler for chart visibility toggling
  const handleToggleChart = (chartKey) => {
    setHiddenCharts(prev => ({ 
      ...prev, 
      [chartKey]: !prev[chartKey] 
    }));
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    
    try {
      const content = document.getElementById('pdf-content');
      
      if (!content) {
        throw new Error('Content not found');
      }
      
      const canvas = await html2canvas(content, { 
        scale: 2,
        backgroundColor: '#0F0A1B' // Match the dark background
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const { width, height } = pdf.internal.pageSize;
      
      // Add dark background
      pdf.setFillColor(15, 10, 27);
      pdf.rect(0, 0, width, height, 'F');
      
      // Calculate image dimensions to fit the page
      const imageProps = pdf.getImageProperties(imgData);
      const imgWidth = width;
      const imgHeight = (imageProps.height * imgWidth) / imageProps.width;
      
      // Center the image vertically
      pdf.addImage(imgData, 'PNG', 0, (height - imgHeight) / 2, imgWidth, imgHeight);
      
      // Add footer text
      pdf.setFontSize(12);
      pdf.setTextColor(230, 230, 250);
      const footerText = 'Soccer Analysis Dashboard - Generated ' + new Date().toLocaleDateString();
      pdf.text(footerText, width - 100, height - 10);
      
      pdf.save('soccer-analysis-dashboard.pdf');
      
      Swal.fire({
        title: 'Success',
        text: 'PDF downloaded successfully!',
        icon: 'success',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      
      Swal.fire({
        title: 'Error',
        text: 'Failed to generate PDF. Please try again.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Event selection handler
  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  // Settings handler for chart colors
  const handleColorChange = (chartKey, value) => {
    setChartColors(prev => {
      // Handle nested objects for pass completion
      if (chartKey.includes('.')) {
        const [parent, child] = chartKey.split('.');
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        };
      }
      
      return {
        ...prev,
        [chartKey]: value
      };
    });
  };

  // Check if we have data
  if (!data || !sport) {
    return null; // Early return, handled by useEffect
  }

  return (
    <div className="soccer-dashboard">
      <div className="soccer-dashboard-header">
        <h1>Soccer Analysis Dashboard</h1>
        <p>Advanced metrics and performance analysis for soccer matches</p>
      </div>
      
      {/* Controls Bar */}
      <div className="soccer-controls-bar">
        <div className="soccer-controls-group">
          <select
            className="soccer-filter-select"
            value={dashboardTeam}
            onChange={(e) => setDashboardTeam(e.target.value)}
          >
            <option value="All">All Teams</option>
            {uniqueTeams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          
          <select
            className="soccer-filter-select"
            value={dashboardPlayer}
            onChange={(e) => setDashboardPlayer(e.target.value)}
          >
            <option value="All">All Players</option>
            {uniquePlayers.map((player) => (
              <option key={player} value={player}>{player}</option>
            ))}
          </select>
          
          <select
            className="soccer-filter-select"
            value={dashboardEvent}
            onChange={(e) => setDashboardEvent(e.target.value)}
          >
            <option value="All">All Events</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
        
        <div className="soccer-controls-group">
          <button 
            className="soccer-button primary"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>Downloading...</>
            ) : (
              <>
                <FaDownload className="button-icon" /> Download PDF
              </>
            )}
          </button>
          
          <button 
            className="soccer-button icon"
            onClick={() => setIsSettingsModalOpen(true)}
            title="Settings"
          >
            <FaCog />
          </button>
        </div>
      </div>
      
      {/* Summary Tiles */}
      <div className="soccer-summary-section">
        <div className="soccer-tiles-container">
          <div className="soccer-tile">
            <h5 className="soccer-tile-title">Total Matches</h5>
            <p className="soccer-tile-value">{summary.totalMatches}</p>
          </div>
          
          <div className="soccer-tile">
            <h5 className="soccer-tile-title">Total Goals</h5>
            <p className="soccer-tile-value">{summary.totalGoals}</p>
          </div>
          
          <div className="soccer-tile">
            <h5 className="soccer-tile-title">Total Shots</h5>
            <p className="soccer-tile-value">{summary.totalShots}</p>
          </div>
          
          <div className="soccer-tile">
            <h5 className="soccer-tile-title">Total Assists</h5>
            <p className="soccer-tile-value">{summary.totalAssists}</p>
          </div>
          
          {dashboardTeam !== 'All' && summary.possession && (
            <div className="soccer-tile highlight">
              <h5 className="soccer-tile-title">Possession</h5>
              <p className="soccer-tile-value">{summary.possession}%</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Dashboard Content */}
      <div id="pdf-content">
        <div className="soccer-chart-grid">
          {/* XG Chart */}
          {!hiddenCharts.xgChart && (
            <div className="soccer-chart-card">
              <div className="soccer-chart-header">
                <h3 className="soccer-chart-title">Expected Goals (xG) by Team</h3>
                <button
                  className="soccer-chart-toggle"
                  onClick={() => handleToggleChart('xgChart')}
                  title="Hide Chart"
                >
                  <FaEyeSlash />
                </button>
              </div>
              
              {xgByTeamData.length > 0 ? (
                <div className="soccer-chart-content">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={xgByTeamData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: 'var(--light)' }}
                      />
                      <YAxis 
                        tick={{ fill: 'var(--light)' }}
                        label={{ 
                          value: 'xG', 
                          angle: -90, 
                          position: 'insideLeft',
                          fill: 'var(--light)'
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--dark-card)',
                          border: '1px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--light)'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="xg" 
                        fill={chartColors.xgChart} 
                        name="Expected Goals" 
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="soccer-no-data">No data available for this chart.</div>
              )}
            </div>
          )}
          
          {/* Shot Distribution Chart */}
          {!hiddenCharts.shotDistribution && (
            <div className="soccer-chart-card">
              <div className="soccer-chart-header">
                <h3 className="soccer-chart-title">Shot Distribution</h3>
                <button
                  className="soccer-chart-toggle"
                  onClick={() => handleToggleChart('shotDistribution')}
                  title="Hide Chart"
                >
                  <FaEyeSlash />
                </button>
              </div>
              
              {shotDistributionData.length > 0 ? (
                <div className="soccer-chart-content">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={shotDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="action" 
                        tick={{ fill: 'var(--light)' }}
                      />
                      <YAxis 
                        tick={{ fill: 'var(--light)' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--dark-card)',
                          border: '1px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--light)'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="count" 
                        fill={chartColors.shotDistribution} 
                        name="Count" 
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="soccer-no-data">No shot data available.</div>
              )}
            </div>
          )}
          
          {/* Pass Completion Chart */}
          {!hiddenCharts.passCompletion && (
            <div className="soccer-chart-card">
              <div className="soccer-chart-header">
                <h3 className="soccer-chart-title">Pass Completion</h3>
                <button
                  className="soccer-chart-toggle"
                  onClick={() => handleToggleChart('passCompletion')}
                  title="Hide Chart"
                >
                  <FaEyeSlash />
                </button>
              </div>
              
              {passCompletionData.length > 0 ? (
                <div className="soccer-chart-content">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={passCompletionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="team" 
                        tick={{ fill: 'var(--light)' }}
                      />
                      <YAxis 
                        tick={{ fill: 'var(--light)' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--dark-card)',
                          border: '1px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--light)'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="completed" 
                        stackId="a" 
                        fill={chartColors.passCompletion.completed} 
                        name="Completed" 
                        animationDuration={1500}
                      />
                      <Bar 
                        dataKey="missed" 
                        stackId="a" 
                        fill={chartColors.passCompletion.missed} 
                        name="Missed" 
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="soccer-no-data">No passing data available.</div>
              )}
            </div>
          )}
          
          {/* Goals Over Time Chart */}
          {!hiddenCharts.goalsOverTime && (
            <div className="soccer-chart-card">
              <div className="soccer-chart-header">
                <h3 className="soccer-chart-title">Goals Over Time</h3>
                <button
                  className="soccer-chart-toggle"
                  onClick={() => handleToggleChart('goalsOverTime')}
                  title="Hide Chart"
                >
                  <FaEyeSlash />
                </button>
              </div>
              
              {goalsOverTimeData.length > 0 ? (
                <div className="soccer-chart-content">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={goalsOverTimeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="minute" 
                        tick={{ fill: 'var(--light)' }}
                      />
                      <YAxis 
                        tick={{ fill: 'var(--light)' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--dark-card)',
                          border: '1px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--light)'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="goals" 
                        stroke={chartColors.goalsOverTime} 
                        name="Goals" 
                        strokeWidth={2}
                        dot={{ fill: chartColors.goalsOverTime, r: 5 }}
                        activeDot={{ r: 8, fill: 'var(--accent)' }}
                        animationDuration={1500}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="soccer-no-data">No goal timing data available.</div>
              )}
            </div>
          )}
          
          {/* Player Shots Chart */}
          {!hiddenCharts.playerShots && (
            <div className="soccer-chart-card">
              <div className="soccer-chart-header">
                <h3 className="soccer-chart-title">Player Shots</h3>
                <button
                  className="soccer-chart-toggle"
                  onClick={() => handleToggleChart('playerShots')}
                  title="Hide Chart"
                >
                  <FaEyeSlash />
                </button>
              </div>
              
              {playerShotsData.length > 0 ? (
                <div className="soccer-chart-content">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={playerShotsData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        type="number"
                        tick={{ fill: 'var(--light)' }}
                      />
                      <YAxis 
                        type="category"
                        dataKey="player" 
                        tick={{ fill: 'var(--light)' }}
                        width={100}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--dark-card)',
                          border: '1px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--light)'
                        }}
                        formatter={(value, name, props) => {
                          if (name === 'shots') return [value, 'Total Shots'];
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="shots" 
                        fill={chartColors.playerShots} 
                        name="shots" 
                        animationDuration={1500}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="soccer-no-data">No player shot data available.</div>
              )}
            </div>
          )}
          
          {/* Team Possession Chart */}
          {!hiddenCharts.teamPossession && (
            <div className="soccer-chart-card">
              <div className="soccer-chart-header">
                <h3 className="soccer-chart-title">Team Possession</h3>
                <button
                  className="soccer-chart-toggle"
                  onClick={() => handleToggleChart('teamPossession')}
                  title="Hide Chart"
                >
                  <FaEyeSlash />
                </button>
              </div>
              
              {teamPossessionData.length > 0 ? (
                <div className="soccer-chart-content">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={teamPossessionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="possession"
                        nameKey="name"
                        label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        animationDuration={1500}
                      >
                        {teamPossessionData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? chartColors.teamPossession : 'var(--accent)'} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--dark-card)',
                          border: '1px solid var(--primary)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--light)'
                        }}
                        formatter={(value, name) => [`${value}%`, `${name}`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="soccer-no-data">No possession data available.</div>
              )}
            </div>
          )}
        </div>
        
        {/* Player Stats Table */}
        {playerShotsData.length > 0 && (
          <div className="soccer-stats-card">
            <div className="soccer-chart-header">
              <h3 className="soccer-chart-title">Player Shot Statistics</h3>
            </div>
            
            <div className="soccer-stats-table-container">
              <table className="soccer-stats-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Shots</th>
                    <th>Goals</th>
                    <th>On Target</th>
                    <th>Off Target</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {playerShotsData.map((player) => (
                    <tr key={player.player} onClick={() => handleEventClick(player)}>
                      <td>{player.player}</td>
                      <td>{player.shots}</td>
                      <td>{player.goals}</td>
                      <td>{player.onTarget}</td>
                      <td>{player.offTarget}</td>
                      <td>{player.accuracy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden Charts Control */}
      {Object.values(hiddenCharts).some(hidden => hidden) && (
        <div className="soccer-hidden-charts-controls">
          <h4>Show Hidden Charts:</h4>
          <div className="soccer-hidden-chart-buttons">
            {Object.entries(hiddenCharts).map(([chartKey, isHidden]) => 
              isHidden && (
                <button
                  key={chartKey}
                  className="soccer-button secondary"
                  onClick={() => handleToggleChart(chartKey)}
                >
                  <FaEye className="button-icon" /> 
                  {chartKey === 'xgChart' ? 'Expected Goals' : 
                   chartKey === 'shotDistribution' ? 'Shot Distribution' : 
                   chartKey === 'passCompletion' ? 'Pass Completion' : 
                   chartKey === 'goalsOverTime' ? 'Goals Over Time' : 
                   chartKey === 'playerShots' ? 'Player Shots' : 
                   chartKey === 'teamPossession' ? 'Team Possession' : 
                   chartKey}
                </button>
              )
            )}
          </div>
        </div>
      )}
      
      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsModalOpen}
        onRequestClose={() => setIsSettingsModalOpen(false)}
        className="soccer-modal-content"
        overlayClassName="soccer-modal-overlay"
        contentLabel="Dashboard Settings"
      >
        <h2 className="soccer-modal-title">Dashboard Settings</h2>
        
        <div className="soccer-modal-body">
          <h3 className="soccer-settings-subtitle">Chart Colors</h3>
          
          <div className="soccer-color-setting">
            <label htmlFor="xgColor">Expected Goals Chart:</label>
            <input
              type="color"
              id="xgColor"
              value={chartColors.xgChart}
              onChange={(e) => handleColorChange('xgChart', e.target.value)}
            />
          </div>
          
          <div className="soccer-color-setting">
            <label htmlFor="shotDistColor">Shot Distribution Chart:</label>
            <input
              type="color"
              id="shotDistColor"
              value={chartColors.shotDistribution}
              onChange={(e) => handleColorChange('shotDistribution', e.target.value)}
            />
          </div>
          
          <div className="soccer-color-setting">
            <label htmlFor="passCompletedColor">Pass Completion (Completed):</label>
            <input
              type="color"
              id="passCompletedColor"
              value={chartColors.passCompletion.completed}
              onChange={(e) => handleColorChange('passCompletion.completed', e.target.value)}
            />
          </div>
          
          <div className="soccer-color-setting">
            <label htmlFor="passMissedColor">Pass Completion (Missed):</label>
            <input
              type="color"
              id="passMissedColor"
              value={chartColors.passCompletion.missed}
              onChange={(e) => handleColorChange('passCompletion.missed', e.target.value)}
            />
          </div>
          
          <div className="soccer-color-setting">
            <label htmlFor="goalsTimeColor">Goals Over Time:</label>
            <input
              type="color"
              id="goalsTimeColor"
              value={chartColors.goalsOverTime}
              onChange={(e) => handleColorChange('goalsOverTime', e.target.value)}
            />
          </div>
          
          <div className="soccer-color-setting">
            <label htmlFor="playerShotsColor">Player Shots:</label>
            <input
              type="color"
              id="playerShotsColor"
              value={chartColors.playerShots}
              onChange={(e) => handleColorChange('playerShots', e.target.value)}
            />
          </div>
          
          <div className="soccer-color-setting">
            <label htmlFor="teamPossessionColor">Team Possession:</label>
            <input
              type="color"
              id="teamPossessionColor"
              value={chartColors.teamPossession}
              onChange={(e) => handleColorChange('teamPossession', e.target.value)}
            />
          </div>
        </div>
        
        <div className="soccer-modal-actions">
          <button 
            className="soccer-button primary"
            onClick={() => {
              // Save settings to localStorage if needed
              localStorage.setItem('soccerChartColors', JSON.stringify(chartColors));
              setIsSettingsModalOpen(false);
              
              Swal.fire({
                title: 'Settings Saved',
                text: 'Your dashboard settings have been saved.',
                icon: 'success',
                background: 'var(--dark-card)',
                confirmButtonColor: 'var(--primary)',
              });
            }}
          >
            Save Settings
          </button>
          
          <button 
            className="soccer-button secondary"
            onClick={() => setIsSettingsModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>
      
      {/* Event Details Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onRequestClose={() => setSelectedEvent(null)}
        className="soccer-modal-content"
        overlayClassName="soccer-modal-overlay"
        contentLabel="Event Details"
      >
        {selectedEvent && (
          <>
            <h2 className="soccer-modal-title">Player Details</h2>
            
            <div className="soccer-modal-body">
              <div className="soccer-detail-row">
                <span className="soccer-detail-label">Player:</span>
                <span className="soccer-detail-value">{selectedEvent.player}</span>
              </div>
              
              <div className="soccer-detail-row">
                <span className="soccer-detail-label">Total Shots:</span>
                <span className="soccer-detail-value">{selectedEvent.shots}</span>
              </div>
              
              <div className="soccer-detail-row">
                <span className="soccer-detail-label">Goals:</span>
                <span className="soccer-detail-value">{selectedEvent.goals}</span>
              </div>
              
              <div className="soccer-detail-row">
                <span className="soccer-detail-label">On Target:</span>
                <span className="soccer-detail-value">{selectedEvent.onTarget}</span>
              </div>
              
              <div className="soccer-detail-row">
                <span className="soccer-detail-label">Off Target:</span>
                <span className="soccer-detail-value">{selectedEvent.offTarget}</span>
              </div>
              
              <div className="soccer-detail-row">
                <span className="soccer-detail-label">Shot Accuracy:</span>
                <span className="soccer-detail-value">{selectedEvent.accuracy}</span>
              </div>
              
              <div className="soccer-detail-row">
                <span className="soccer-detail-label">Conversion Rate:</span>
                <span className="soccer-detail-value">
                  {selectedEvent.shots > 0 
                    ? ((selectedEvent.goals / selectedEvent.shots) * 100).toFixed(1) + '%' 
                    : '0%'}
                </span>
              </div>
            </div>
            
            <div className="soccer-modal-actions">
              <button 
                className="soccer-button primary"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default SoccerAnalysisDashboard;