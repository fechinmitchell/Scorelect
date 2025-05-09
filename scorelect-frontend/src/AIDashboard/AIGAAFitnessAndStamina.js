// AIGAAFitnessAndStamina.js - Fitness & Stamina Analysis Tab
import React, { useState, useEffect, useRef } from 'react';
import { FaRunning, FaDownload, FaCog, FaFilter, FaFileDownload, FaBell, FaHistory } from 'react-icons/fa';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import 'chart.js/auto';
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';
import Modal from 'react-modal';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../AuthContext';
import { jsPDF } from "jspdf";
import Papa from 'papaparse';
import moment from 'moment';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Environment-based API URL
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Generate random sample fitness data (for demo purposes)
const generateSampleFitnessData = (players, matches) => {
  const fitnessData = [];
  
  matches.forEach(match => {
    players.forEach(player => {
      const matchDate = new Date(match.matchDate || new Date());
      
      // Generate random fitness metrics
      const distanceCovered = Math.round(7000 + Math.random() * 3000); // 7-10km
      const sprintCount = Math.round(15 + Math.random() * 25); // 15-40 sprints
      const topSpeed = (7 + Math.random() * 3).toFixed(1); // 7-10 m/s
      const highIntensityEfforts = Math.round(20 + Math.random() * 30); // 20-50 efforts
      const recoveryTime = Math.round(20 + Math.random() * 20); // 20-40 seconds
      
      fitnessData.push({
        player: player,
        match: match.match,
        matchDate: matchDate,
        distanceCovered: distanceCovered,
        sprintCount: sprintCount,
        topSpeed: topSpeed,
        highIntensityEfforts: highIntensityEfforts,
        recoveryTime: recoveryTime,
        fatigueIndex: calculateFatigueIndex(distanceCovered, sprintCount, recoveryTime)
      });
    });
  });
  
  return fitnessData;
};

// Calculate a fatigue index from metrics
const calculateFatigueIndex = (distance, sprints, recovery) => {
  // Higher values indicate more fatigue
  // Normalize the input values
  const normalizedDistance = Math.min(1, distance / 10000); // 10km is max
  const normalizedSprints = Math.min(1, sprints / 40); // 40 sprints is max
  const normalizedRecovery = Math.min(1, recovery / 40); // 40s recovery is max
  
  // Combine metrics (recovery time increases fatigue)
  const fatigueIndex = (normalizedDistance * 0.4) + (normalizedSprints * 0.3) + (normalizedRecovery * 0.3);
  
  // Return a value between 0-100
  return Math.round(fatigueIndex * 100);
};

// Main component
const AIGAAFitnessAndStamina = ({ data, refreshKey, datasets }) => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [fitnessData, setFitnessData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [playerAlerts, setPlayerAlerts] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    matches: [], players: []
  });
  const [filters, setFilters] = useState({
    match: '',
    player: ''
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsState, setSettingsState] = useState({
    alertThreshold: 70, // Fatigue index threshold for alerts
    compareHistoricalData: true,
    showProjections: true
  });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);

  // Refs for the canvas and download
  const contentRef = useRef(null);
  const stageRef = useRef(null);

  // Process data on mount and when refreshKey changes
  useEffect(() => {
    const processData = async () => {
      setIsLoading(true);
      
      if (!data || !data.games) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Extract players and matches
        const players = new Set();
        const matches = [];
        
        data.games.forEach(game => {
          if (game.match) {
            matches.push({
              match: game.match,
              matchDate: game.date || new Date().toISOString()
            });
          }
          
          (game.gameData || []).forEach(shot => {
            if (shot.playerName) {
              players.add(shot.playerName);
            }
          });
        });
        
        // Set filter options
        setFilterOptions({
          matches: Array.from(new Set(matches.map(m => m.match))),
          players: Array.from(players)
        });
        
        // Generate sample fitness data
        const sampleData = generateSampleFitnessData(Array.from(players), matches);
        setFitnessData(sampleData);
        setFilteredData(sampleData);
        
        // Generate player alerts
        const alerts = generatePlayerAlerts(sampleData, settingsState.alertThreshold);
        setPlayerAlerts(alerts);
        
      } catch (error) {
        console.error('Error processing data:', error);
        Swal.fire({
          title: 'Data Processing Error',
          text: 'Failed to process fitness data.',
          icon: 'error',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    processData();
  }, [data, refreshKey, settingsState.alertThreshold]);

  // Apply filters
  useEffect(() => {
    if (!fitnessData.length) return;
    
    let filtered = [...fitnessData];
    
    if (filters.match) {
      filtered = filtered.filter(item => item.match === filters.match);
    }
    
    if (filters.player) {
      filtered = filtered.filter(item => item.player === filters.player);
      
      // If a player is selected, update the heatmap data
      if (filters.player && filtered.length > 0) {
        setSelectedPlayer(filters.player);
        generateHeatmapData(filters.player);
      } else {
        setSelectedPlayer(null);
        setHeatmapData(null);
      }
    } else {
      setSelectedPlayer(null);
      setHeatmapData(null);
    }
    
    setFilteredData(filtered);
  }, [fitnessData, filters]);

  // Generate player alerts
  const generatePlayerAlerts = (data, threshold) => {
    if (!data || !data.length) return [];
    
    const alerts = [];
    const playerMap = new Map();
    
    // Group data by player and sort by date
    data.forEach(item => {
      if (!playerMap.has(item.player)) {
        playerMap.set(item.player, []);
      }
      playerMap.get(item.player).push(item);
    });
    
    // Process each player's data
    playerMap.forEach((playerData, player) => {
      // Sort by date, most recent first
      playerData.sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate));
      
      const recentMatch = playerData[0];
      
      // Check fatigue index
      if (recentMatch.fatigueIndex > threshold) {
        alerts.push({
          player: player,
          match: recentMatch.match,
          alert: `High fatigue level (${recentMatch.fatigueIndex}%)`,
          severity: 'high',
          metric: 'fatigue'
        });
      }
      
      // If we have multiple matches, check for decreasing performance
      if (playerData.length > 1) {
        const prevMatch = playerData[1];
        
        // Check for significant sprint count decrease
        if (prevMatch.sprintCount > 0 && 
            (recentMatch.sprintCount / prevMatch.sprintCount) < 0.8) {
          alerts.push({
            player: player,
            match: recentMatch.match,
            alert: `Sprint count decreased by ${Math.round((1 - recentMatch.sprintCount / prevMatch.sprintCount) * 100)}%`,
            severity: 'medium',
            metric: 'sprint'
          });
        }
        
        // Check for increasing recovery time
        if (prevMatch.recoveryTime > 0 && 
            (recentMatch.recoveryTime / prevMatch.recoveryTime) > 1.2) {
          alerts.push({
            player: player,
            match: recentMatch.match,
            alert: `Recovery time increased by ${Math.round((recentMatch.recoveryTime / prevMatch.recoveryTime - 1) * 100)}%`,
            severity: 'medium',
            metric: 'recovery'
          });
        }
      }
    });
    
    return alerts;
  };

  // Generate heatmap data for a player
  const generateHeatmapData = (player) => {
    if (!player) return;
    
    // Get all shots by this player
    const playerShots = [];
    
    data.games.forEach(game => {
      (game.gameData || []).forEach(shot => {
        if (shot.playerName === player) {
          playerShots.push({
            x: parseFloat(shot.x) || 0,
            y: parseFloat(shot.y) || 0,
            matchDate: game.date || new Date().toISOString(),
            match: game.match
          });
        }
      });
    });
    
    // Create heatmap grid
    const pitchWidth = 145;
    const pitchHeight = 88;
    const gridSize = 12;
    
    const cellWidth = pitchWidth / gridSize;
    const cellHeight = pitchHeight / gridSize;
    
    let grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    
    // Count shots in each grid cell
    playerShots.forEach(shot => {
      const gridX = Math.min(gridSize - 1, Math.floor(shot.x / cellWidth));
      const gridY = Math.min(gridSize - 1, Math.floor(shot.y / cellHeight));
      
      grid[gridY][gridX]++;
    });
    
    // Normalize the grid values between 0 and 1
    const maxValue = Math.max(...grid.flat());
    const normalizedGrid = grid.map(row => 
      row.map(cell => maxValue > 0 ? cell / maxValue : 0)
    );
    
    // Set heatmap data
    setHeatmapData({
      grid: normalizedGrid,
      gridSize,
      cellWidth,
      cellHeight,
      totalCoverage: playerShots.length
    });
  };

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Export as PDF
  // Export as PDF
  const exportPDF = async () => {
    setIsDownloading(true);
    try {
      if (!contentRef.current) {
        throw new Error('Content ref not available');
      }
      
      // Create a new PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      
      // Add content to PDF
      pdf.setFillColor(15, 10, 27); // Background color
      pdf.rect(0, 0, width, height, 'F');
      
      // Add title
      pdf.setTextColor(115, 63, 170); // Purple
      pdf.setFontSize(24);
      pdf.text('Fitness & Stamina Analysis', width / 2, 20, { align: 'center' });
      
      // Add player info if selected
      if (selectedPlayer) {
        pdf.setTextColor(255, 121, 198); // Pink
        pdf.setFontSize(16);
        pdf.text(`Player: ${selectedPlayer}`, width / 2, 30, { align: 'center' });
      }
      
      // Add date
      pdf.setTextColor(230, 230, 250); // Light color
      pdf.setFontSize(10);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, width / 2, 40, { align: 'center' });
      
      // Add player metrics if selected
      let yPosition = 50;
      if (selectedPlayer) {
        const playerData = filteredData.filter(item => item.player === selectedPlayer);
        
        if (playerData.length > 0) {
          pdf.setTextColor(230, 230, 250);
          pdf.setFontSize(14);
          pdf.text('Player Metrics', 20, yPosition);
          yPosition += 10;
          
          // Add metrics table
          const metrics = [
            ['Match', 'Distance', 'Sprints', 'Top Speed', 'High Intensity', 'Recovery', 'Fatigue']
          ];
          
          playerData.forEach(data => {
            metrics.push([
              data.match,
              `${data.distanceCovered}m`,
              data.sprintCount,
              `${data.topSpeed}m/s`,
              data.highIntensityEfforts,
              `${data.recoveryTime}s`,
              `${data.fatigueIndex}%`
            ]);
          });
          
          // Table
          const startX = 15;
          const startY = yPosition;
          const cellWidth = (width - 30) / 7;
          const cellHeight = 10;
          
          // Add header
          pdf.setFillColor(115, 63, 170);
          pdf.rect(startX, startY, width - 30, cellHeight, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(8);
          
          metrics[0].forEach((header, i) => {
            pdf.text(header, startX + (i * cellWidth) + cellWidth / 2, startY + cellHeight / 2, { 
              align: 'center', 
              baseline: 'middle' 
            });
          });
          
          // Add rows
          pdf.setTextColor(230, 230, 250);
          for (let i = 1; i < metrics.length; i++) {
            const rowY = startY + (i * cellHeight);
            
            // Alternate row background
            if (i % 2 === 0) {
              pdf.setFillColor(26, 18, 50, 0.5);
              pdf.rect(startX, rowY, width - 30, cellHeight, 'F');
            }
            
            metrics[i].forEach((cell, j) => {
              pdf.text(cell.toString(), startX + (j * cellWidth) + cellWidth / 2, rowY + cellHeight / 2, { 
                align: 'center', 
                baseline: 'middle' 
              });
            });
          }
          
          yPosition = startY + (metrics.length * cellHeight) + 15;
        }
        
        // Add alerts for this player
        const playerAlerts = playerAlerts.filter(alert => alert.player === selectedPlayer);
        if (playerAlerts.length > 0) {
          pdf.setTextColor(255, 121, 198); // Pink
          pdf.setFontSize(14);
          pdf.text('Player Alerts', 20, yPosition);
          yPosition += 10;
          
          pdf.setTextColor(230, 230, 250);
          pdf.setFontSize(10);
          
          playerAlerts.forEach(alert => {
            pdf.setTextColor(alert.severity === 'high' ? '#FF5555' : '#FFBF4D');
            pdf.text(`• ${alert.alert} (${alert.match})`, 25, yPosition);
            yPosition += 8;
          });
          
          yPosition += 10;
        }
      } else {
        // Add summary of all players
        pdf.setTextColor(230, 230, 250);
        pdf.setFontSize(14);
        pdf.text('Team Fitness Summary', 20, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(10);
        pdf.text(`Total Players: ${new Set(filteredData.map(item => item.player)).size}`, 25, yPosition);
        yPosition += 8;
        
        pdf.text(`Players with Alerts: ${new Set(playerAlerts.map(alert => alert.player)).size}`, 25, yPosition);
        yPosition += 8;
        
        pdf.text(`Total Alerts: ${playerAlerts.length}`, 25, yPosition);
        yPosition += 15;
        
        // Alert summary by type
        const fatigueAlerts = playerAlerts.filter(alert => alert.metric === 'fatigue').length;
        const sprintAlerts = playerAlerts.filter(alert => alert.metric === 'sprint').length;
        const recoveryAlerts = playerAlerts.filter(alert => alert.metric === 'recovery').length;
        
        pdf.text(`Fatigue Alerts: ${fatigueAlerts}`, 25, yPosition);
        yPosition += 8;
        
        pdf.text(`Sprint Decline Alerts: ${sprintAlerts}`, 25, yPosition);
        yPosition += 8;
        
        pdf.text(`Recovery Decline Alerts: ${recoveryAlerts}`, 25, yPosition);
        yPosition += 15;
      }
      
      // Add footer
      pdf.setTextColor(155, 102, 217); // Purple
      pdf.setFontSize(8);
      pdf.text('Generated by Scorelect AI Analytics', width - 15, height - 10, { align: 'right' });
      
      // Save the PDF
      pdf.save('fitness-analysis.pdf');
      
      Swal.fire({
        title: 'Export Complete',
        text: 'PDF has been downloaded successfully.',
        icon: 'success',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    } catch (error) {
      console.error('PDF export error:', error);
      Swal.fire({
        title: 'Export Failed',
        text: 'Failed to generate PDF.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Export as CSV
  const exportCSV = () => {
    try {
      if (!filteredData.length) {
        throw new Error('No data to export');
      }
      
      // Prepare data for CSV
      const csvData = filteredData.map(item => ({
        Player: item.player || '',
        Match: item.match || '',
        MatchDate: new Date(item.matchDate).toLocaleDateString(),
        DistanceCovered: item.distanceCovered || 0,
        SprintCount: item.sprintCount || 0,
        TopSpeed: item.topSpeed || 0,
        HighIntensityEfforts: item.highIntensityEfforts || 0,
        RecoveryTime: item.recoveryTime || 0,
        FatigueIndex: item.fatigueIndex || 0
      }));
      
      // Convert to CSV
      const csv = Papa.unparse(csvData);
      
      // Create a download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fitness-analysis.csv';
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      Swal.fire({
        title: 'Export Complete',
        text: 'CSV has been downloaded successfully.',
        icon: 'success',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    } catch (error) {
      console.error('CSV export error:', error);
      Swal.fire({
        title: 'Export Failed',
        text: 'Failed to generate CSV file.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    }
  };

  // Render player fitness metrics as charts
  const renderPlayerMetricsCharts = () => {
    if (!selectedPlayer || !filteredData.length) {
      return (
        <div className="ai-no-player-selected">
          <p>Select a player to view fitness metrics.</p>
        </div>
      );
    }
    
    // Get data for selected player
    const playerData = filteredData
      .filter(item => item.player === selectedPlayer)
      .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
    
    if (!playerData.length) {
      return (
        <div className="ai-no-data">
          <p>No fitness data available for {selectedPlayer}.</p>
        </div>
      );
    }
    
    // Extract match labels and metrics
    const labels = playerData.map(item => item.match);
    const distanceData = playerData.map(item => item.distanceCovered);
    const sprintData = playerData.map(item => item.sprintCount);
    const fatigueData = playerData.map(item => item.fatigueIndex);
    const recoveryData = playerData.map(item => item.recoveryTime);
    
    // Calculate projection for next match if enabled
    let projectedData = {};
    
    if (settingsState.showProjections && playerData.length >= 3) {
      // Use simple linear regression for projection
      const lastThreeMatches = playerData.slice(-3);
      
      // Project distance
      const avgDistanceChange = (lastThreeMatches[2].distanceCovered - lastThreeMatches[0].distanceCovered) / 2;
      const projectedDistance = Math.max(5000, lastThreeMatches[2].distanceCovered + avgDistanceChange);
      
      // Project sprints
      const avgSprintChange = (lastThreeMatches[2].sprintCount - lastThreeMatches[0].sprintCount) / 2;
      const projectedSprints = Math.max(5, lastThreeMatches[2].sprintCount + avgSprintChange);
      
      // Project recovery time
      const avgRecoveryChange = (lastThreeMatches[2].recoveryTime - lastThreeMatches[0].recoveryTime) / 2;
      const projectedRecovery = Math.max(10, lastThreeMatches[2].recoveryTime + avgRecoveryChange);
      
      // Project fatigue
      const projectedFatigue = calculateFatigueIndex(projectedDistance, projectedSprints, projectedRecovery);
      
      projectedData = {
        distance: projectedDistance,
        sprints: projectedSprints,
        recovery: projectedRecovery,
        fatigue: projectedFatigue
      };
      
      // Add projection to charts
      labels.push('Next Match (Projected)');
      distanceData.push(projectedDistance);
      sprintData.push(projectedSprints);
      fatigueData.push(projectedFatigue);
      recoveryData.push(projectedRecovery);
    }
    
    // Prepare chart data
    const distanceChartData = {
      labels: labels,
      datasets: [
        {
          label: 'Distance Covered (meters)',
          data: distanceData,
          borderColor: '#50FA7B',
          backgroundColor: 'rgba(80, 250, 123, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    };
    
    const sprintChartData = {
      labels: labels,
      datasets: [
        {
          label: 'Sprint Count',
          data: sprintData,
          borderColor: '#9B66D9',
          backgroundColor: 'rgba(155, 102, 217, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    };
    
    const fatigueChartData = {
      labels: labels,
      datasets: [
        {
          label: 'Fatigue Index (%)',
          data: fatigueData,
          borderColor: '#FF5555',
          backgroundColor: 'rgba(255, 85, 85, 0.2)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Alert Threshold',
          data: Array(labels.length).fill(settingsState.alertThreshold),
          borderColor: '#FFBF4D',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
          pointRadius: 0
        }
      ]
    };
    
    const recoveryChartData = {
      labels: labels,
      datasets: [
        {
          label: 'Recovery Time (seconds)',
          data: recoveryData,
          borderColor: '#FF79C6',
          backgroundColor: 'rgba(255, 121, 198, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    };
    
    // Chart options
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#9BAACB'
          }
        },
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#9BAACB'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#E6E6FA'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(37, 25, 67, 0.9)',
          titleColor: '#E6E6FA',
          bodyColor: '#E6E6FA',
          borderColor: '#733FAA',
          borderWidth: 1
        }
      }
    };
    
    return (
      <div className="ai-player-metrics">
        <div className="ai-metrics-header">
          <h3 className="ai-metrics-title">{selectedPlayer} - Fitness Metrics</h3>
          {playerAlerts.filter(alert => alert.player === selectedPlayer).length > 0 && (
            <div className="ai-metrics-alert-badge">
              <FaBell /> {playerAlerts.filter(alert => alert.player === selectedPlayer).length} Alerts
            </div>
          )}
        </div>
        
        <div className="ai-charts-container">
          <div className="ai-chart-wrapper">
            <h4>Distance Covered</h4>
            <div className="ai-chart">
              <Line data={distanceChartData} options={chartOptions} height={200} />
            </div>
          </div>
          
          <div className="ai-chart-wrapper">
            <h4>Sprint Count</h4>
            <div className="ai-chart">
              <Line data={sprintChartData} options={chartOptions} height={200} />
            </div>
          </div>
          
          <div className="ai-chart-wrapper">
            <h4>Fatigue Index</h4>
            <div className="ai-chart">
              <Line data={fatigueChartData} options={chartOptions} height={200} />
            </div>
          </div>
          
          <div className="ai-chart-wrapper">
            <h4>Recovery Time</h4>
            <div className="ai-chart">
              <Line data={recoveryChartData} options={chartOptions} height={200} />
            </div>
          </div>
        </div>
        
        {settingsState.showProjections && Object.keys(projectedData).length > 0 && (
          <div className="ai-projections-panel">
            <h4><FaHistory /> Performance Projections</h4>
            <p>Based on recent trends, for the next match we predict:</p>
            <ul>
              <li>Distance: <strong>{Math.round(projectedData.distance)}m</strong> ({projectedData.distance > playerData[playerData.length - 1].distanceCovered ? '+' : ''}{Math.round(projectedData.distance - playerData[playerData.length - 1].distanceCovered)}m)</li>
              <li>Sprints: <strong>{Math.round(projectedData.sprints)}</strong> ({projectedData.sprints > playerData[playerData.length - 1].sprintCount ? '+' : ''}{Math.round(projectedData.sprints - playerData[playerData.length - 1].sprintCount)})</li>
              <li>Recovery Time: <strong>{Math.round(projectedData.recovery)}s</strong> ({projectedData.recovery > playerData[playerData.length - 1].recoveryTime ? '+' : ''}{Math.round(projectedData.recovery - playerData[playerData.length - 1].recoveryTime)}s)</li>
              <li>Fatigue Index: <strong>{Math.round(projectedData.fatigue)}%</strong> ({projectedData.fatigue > playerData[playerData.length - 1].fatigueIndex ? '+' : ''}{Math.round(projectedData.fatigue - playerData[playerData.length - 1].fatigueIndex)}%)</li>
            </ul>
            {projectedData.fatigue > settingsState.alertThreshold && (
              <div className="ai-projection-alert">
                <FaBell /> Alert: Projected fatigue index exceeds threshold. Consider adjusting training load.
              </div>
            )}
          </div>
        )}
        
        {playerAlerts.filter(alert => alert.player === selectedPlayer).length > 0 && (
          <div className="ai-alerts-panel">
            <h4>Player Alerts</h4>
            <div className="ai-alerts-list">
              {playerAlerts
                .filter(alert => alert.player === selectedPlayer)
                .map((alert, i) => (
                  <div key={i} className={`ai-alert-item ${alert.severity}`}>
                    <div className="ai-alert-icon">
                      <FaBell />
                    </div>
                    <div className="ai-alert-content">
                      <div className="ai-alert-title">{alert.alert}</div>
                      <div className="ai-alert-match">{alert.match}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
        
        {heatmapData && (
          <div className="ai-heatmap-section">
            <h4>Player Coverage Map</h4>
            <p>This heatmap shows {selectedPlayer}'s movement across the pitch:</p>
            
            <div className="ai-coverage-map">
              <Stage
                width={435}
                height={264}
                ref={stageRef}
              >
                <Layer>
                  {/* Pitch background */}
                  <Rect
                    x={0}
                    y={0}
                    width={435}
                    height={264}
                    fill="#0F0A1B" // Dark background
                  />
                  
                  {/* Pitch Lines */}
                  <Rect
                    x={0}
                    y={0}
                    width={435}
                    height={264}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                  />
                  
                  {/* Center Line */}
                  <Line
                    points={[435/2, 0, 435/2, 264]}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                    dash={[5, 5]}
                  />
                  
                  {/* Render heatmap cells */}
                  {heatmapData.grid.map((row, i) => 
                    row.map((value, j) => (
                      <Rect
                        key={`cell-${i}-${j}`}
                        x={j * (435 / heatmapData.gridSize)}
                        y={i * (264 / heatmapData.gridSize)}
                        width={435 / heatmapData.gridSize}
                        height={264 / heatmapData.gridSize}
                        fill={
                          value === 0 
                            ? 'transparent' 
                            : `rgba(155, 102, 217, ${value * 0.7})`
                        }
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth={0.5}
                      />
                    ))
                  )}
                </Layer>
              </Stage>
              
              <div className="ai-heatmap-legend">
                <div className="ai-legend-title">Coverage Intensity</div>
                <div className="ai-legend-gradient">
                  <div className="ai-legend-color-low"></div>
                  <div className="ai-legend-color-mid"></div>
                  <div className="ai-legend-color-high"></div>
                </div>
                <div className="ai-legend-labels">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render team overview
  const renderTeamOverview = () => {
    if (!filteredData.length) {
      return (
        <div className="ai-no-data">
          <p>No fitness data available.</p>
        </div>
      );
    }
    
    // Get unique players
    const players = Array.from(new Set(filteredData.map(item => item.player)));
    
    // Calculate team averages
    const teamAverages = {
      distance: 0,
      sprints: 0,
      recovery: 0,
      fatigue: 0
    };
    
    // Get most recent data for each player
    const playerLatestData = [];
    
    players.forEach(player => {
      const playerData = filteredData
        .filter(item => item.player === player)
        .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate));
      
      if (playerData.length > 0) {
        playerLatestData.push(playerData[0]);
        
        teamAverages.distance += playerData[0].distanceCovered;
        teamAverages.sprints += playerData[0].sprintCount;
        teamAverages.recovery += playerData[0].recoveryTime;
        teamAverages.fatigue += playerData[0].fatigueIndex;
      }
    });
    
    // Calculate averages
    if (playerLatestData.length > 0) {
      teamAverages.distance /= playerLatestData.length;
      teamAverages.sprints /= playerLatestData.length;
      teamAverages.recovery /= playerLatestData.length;
      teamAverages.fatigue /= playerLatestData.length;
    }
    
    // Sort players by fatigue index (descending)
    playerLatestData.sort((a, b) => b.fatigueIndex - a.fatigueIndex);
    
    // Prepare data for bar chart
    const barChartData = {
      labels: playerLatestData.map(item => item.player),
      datasets: [
        {
          label: 'Fatigue Index (%)',
          data: playerLatestData.map(item => item.fatigueIndex),
          backgroundColor: playerLatestData.map(item => 
            item.fatigueIndex > settingsState.alertThreshold ? 
              'rgba(255, 85, 85, 0.7)' : 'rgba(155, 102, 217, 0.7)'
          ),
          borderColor: playerLatestData.map(item => 
            item.fatigueIndex > settingsState.alertThreshold ? 
              '#FF5555' : '#9B66D9'
          ),
          borderWidth: 1
        }
      ]
    };
    
    const barChartOptions = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#9BAACB'
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#9BAACB'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#E6E6FA'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(37, 25, 67, 0.9)',
          titleColor: '#E6E6FA',
          bodyColor: '#E6E6FA',
          borderColor: '#733FAA',
          borderWidth: 1
        }
      }
    };
    
    return (
      <div className="ai-team-overview">
        <h3 className="ai-section-subtitle">Team Fitness Overview</h3>
        
        <div className="ai-team-stats-grid">
          <div className="ai-team-stat-card">
            <div className="ai-team-stat-title">Avg Distance</div>
            <div className="ai-team-stat-value">{Math.round(teamAverages.distance)}m</div>
          </div>
          
          <div className="ai-team-stat-card">
            <div className="ai-team-stat-title">Avg Sprints</div>
            <div className="ai-team-stat-value">{Math.round(teamAverages.sprints)}</div>
          </div>
          
          <div className="ai-team-stat-card">
            <div className="ai-team-stat-title">Avg Recovery</div>
            <div className="ai-team-stat-value">{Math.round(teamAverages.recovery)}s</div>
          </div>
          
          <div className="ai-team-stat-card">
            <div className="ai-team-stat-title">Avg Fatigue</div>
            <div className="ai-team-stat-value">{Math.round(teamAverages.fatigue)}%</div>
          </div>
        </div>
        
        <div className="ai-team-fatigue-chart">
          <h4>Player Fatigue Comparison</h4>
          <div className="ai-team-chart">
            <Bar data={barChartData} options={barChartOptions} height={Math.max(300, players.length * 25)} />
          </div>
        </div>
        
        {playerAlerts.length > 0 && (
          <div className="ai-team-alerts">
            <h4>Team Alerts ({playerAlerts.length})</h4>
            <div className="ai-team-alerts-list">
              {playerAlerts.map((alert, i) => (
                <div key={i} className={`ai-alert-item ${alert.severity}`}>
                  <div className="ai-alert-icon">
                    <FaBell />
                  </div>
                  <div className="ai-alert-content">
                    <div className="ai-alert-player">{alert.player}</div>
                    <div className="ai-alert-title">{alert.alert}</div>
                    <div className="ai-alert-match">{alert.match}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Settings modal
  const renderSettingsModal = () => {
    return (
      <Modal
        isOpen={isSettingsModalOpen}
        onRequestClose={() => setIsSettingsModalOpen(false)}
        className="ai-modal-content"
        overlayClassName="ai-modal-overlay"
        contentLabel="Fitness Settings"
      >
        <div className="ai-modal-header">
          <h2 className="ai-modal-title">Fitness Analytics Settings</h2>
        </div>
        
        <div className="ai-modal-body">
          <div className="ai-settings-group">
            <label className="ai-settings-label">
              Fatigue Alert Threshold
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={settingsState.alertThreshold}
                onChange={e => setSettingsState(prev => ({ ...prev, alertThreshold: parseInt(e.target.value) }))}
              />
              <span className="ai-settings-value">{settingsState.alertThreshold}%</span>
            </label>
          </div>
          
          <div className="ai-settings-group ai-settings-checkbox">
            <label className="ai-settings-label">
              <input
                type="checkbox"
                checked={settingsState.compareHistoricalData}
                onChange={e => setSettingsState(prev => ({ ...prev, compareHistoricalData: e.target.checked }))}
              />
              Compare with Historical Data
            </label>
          </div>
          
          <div className="ai-settings-group ai-settings-checkbox">
            <label className="ai-settings-label">
              <input
                type="checkbox"
                checked={settingsState.showProjections}
                onChange={e => setSettingsState(prev => ({ ...prev, showProjections: e.target.checked }))}
              />
              Show Performance Projections
            </label>
          </div>
        </div>
        
        <div className="ai-modal-footer">
          <button 
            className="ai-button" 
            onClick={() => setIsSettingsModalOpen(false)}
          >
            Apply
          </button>
        </div>
      </Modal>
    );
  };

  // Main return
  if (isLoading) {
    return (
      <div className="ai-section">
        <div className="ai-loading">
          <div className="ai-loading-spinner"></div>
          <p>Loading fitness and stamina analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-fitness-dashboard" ref={contentRef}>
      <div className="ai-section">
        <div className="ai-section-header">
          <h2 className="ai-section-title">
            <FaRunning /> Fitness & Stamina Analysis
          </h2>
          <div className="ai-section-actions">
            <button 
              className="ai-button" 
              onClick={exportPDF}
              disabled={isDownloading}
            >
              <FaDownload /> {isDownloading ? 'Exporting...' : 'Export PDF'}
            </button>
            <button 
              className="ai-button secondary" 
              onClick={exportCSV}
            >
              <FaFileDownload /> Export CSV
            </button>
            <button 
              className="ai-button secondary" 
              onClick={() => setIsSettingsModalOpen(true)}
            >
              <FaCog /> Settings
            </button>
          </div>
        </div>
        
        <div className="ai-filter-controls">
          <div className="ai-filter-group">
            <FaFilter />
            <select 
              className="ai-filter-select"
              value={filters.match}
              onChange={e => handleFilterChange('match', e.target.value)}
            >
              <option value="">All Matches</option>
              {filterOptions.matches.map((match, i) => (
                <option key={i} value={match}>{match}</option>
              ))}
            </select>
          </div>
          
          <div className="ai-filter-group">
            <select 
              className="ai-filter-select"
              value={filters.player}
              onChange={e => handleFilterChange('player', e.target.value)}
            >
              <option value="">All Players</option>
              {filterOptions.players.map((player, i) => (
                <option key={i} value={player}>{player}</option>
              ))}
            </select>
          </div>
        </div>
        
        {selectedPlayer ? renderPlayerMetricsCharts() : renderTeamOverview()}
      </div>
      
      {renderSettingsModal()}
    </div>
  );
};


export default AIGAAFitnessAndStamina;