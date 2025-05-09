// AIGAAAttacking.js - AI-Enhanced Attacking Analysis Tab
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaChartLine, FaDownload, FaCog, FaLightbulb, FaTrophy, FaFilter, FaSave, FaFileDownload } from 'react-icons/fa';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { Stage, Layer, Rect, Circle, Text, Line } from 'react-konva';
import Konva from 'konva';
import * as d3 from 'd3';
import Modal from 'react-modal';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../AuthContext';
import { jsPDF } from "jspdf";
import Papa from 'papaparse';
import { 
  translateShotToOneSide, 
  renderOneSidePitchShots, 
  renderLegendOneSideShots 
} from '../components/GAAPitchComponents';

// Environment-based API URL
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Heatmap color scale
const getHeatmapColor = (value) => {
  const colorScale = d3.scaleSequential(d3.interpolateRdBu)
    .domain([1, 0]); // Red (high density) to Blue (low density)
  return colorScale(value);
};

// Utility function to flatten shots array
const flattenShots = (games = []) => {
  return games.flatMap(g => g.gameData || []);
};

// Calculate zone data for heatmap
const calculateZoneData = (shots, gridSize = 8) => {
  const pitchWidth = 145 / 2; // Half pitch width
  const pitchHeight = 88;
  
  // Initialize grid with zeros
  const cellWidth = pitchWidth / gridSize;
  const cellHeight = pitchHeight / gridSize;
  
  let grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
  let totalShots = 0;
  
  // Count shots in each grid cell
  shots.forEach(shot => {
    const x = parseFloat(shot.x) || 0;
    const y = parseFloat(shot.y) || 0;
    
    // Ensure the shot is on the left half of the pitch
    if (x <= pitchWidth) {
      const gridX = Math.min(gridSize - 1, Math.floor(x / cellWidth));
      const gridY = Math.min(gridSize - 1, Math.floor(y / cellHeight));
      
      grid[gridY][gridX]++;
      totalShots++;
    }
  });
  
  // Normalize the grid values between 0 and 1
  const maxValue = Math.max(...grid.flat());
  const normalizedGrid = grid.map(row => 
    row.map(cell => maxValue > 0 ? cell / maxValue : 0)
  );
  
  // Add zoneInfo for click handlers
  const zoneData = [];
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const value = normalizedGrid[i][j];
      const rawCount = grid[i][j];
      const shotsInZone = shots.filter(shot => {
        const x = parseFloat(shot.x) || 0;
        const y = parseFloat(shot.y) || 0;
        const gridX = Math.min(gridSize - 1, Math.floor(x / cellWidth));
        const gridY = Math.min(gridSize - 1, Math.floor(y / cellHeight));
        return gridX === j && gridY === i;
      });
      
      // Calculate success rate in this zone
      const totalInZone = shotsInZone.length;
      const successfulInZone = shotsInZone.filter(s => {
        const action = (s.action || '').toLowerCase().trim();
        return action === 'goal' || action === 'point' || action === 'free' || action === 'offensive mark' || action === 'fortyfive';
      }).length;
      
      const avgXP = shotsInZone.reduce((sum, s) => sum + (s.xPoints || 0), 0) / Math.max(1, totalInZone);
      const avgXG = shotsInZone.filter(s => (s.action || '').toLowerCase().includes('goal'))
        .reduce((sum, s) => sum + (s.xGoals || 0), 0) / Math.max(1, shotsInZone.filter(s => (s.action || '').toLowerCase().includes('goal')).length);
      
      zoneData.push({
        x: j * cellWidth,
        y: i * cellHeight,
        width: cellWidth,
        height: cellHeight,
        value: value,
        count: rawCount,
        successRate: totalInZone > 0 ? successfulInZone / totalInZone : 0,
        avgXP: avgXP || 0,
        avgXG: avgXG || 0,
        shots: shotsInZone
      });
    }
  }
  
  return {
    zoneData,
    totalShots,
    gridSize,
    cellWidth,
    cellHeight
  };
};

// Identify optimal shooting zones
const identifyOptimalZones = (zoneData) => {
  if (!zoneData || !zoneData.length) return [];
  
  return zoneData
    .filter(zone => zone.count >= 3 && zone.successRate >= 0.65)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3)
    .map(zone => ({
      ...zone,
      recommendation: `This zone has a ${(zone.successRate * 100).toFixed(0)}% success rate from ${zone.count} shots.`,
      insight: `Players are ${zone.successRate > 0.8 ? 'extremely' : 'very'} effective shooting from this position.`
    }));
};

// Identify scoring zones for AI insights
const generateAIInsights = (shots, zoneData) => {
  if (!shots || !shots.length || !zoneData || !zoneData.length) {
    return {
      optimalZones: [],
      playerInsights: [],
      generalInsights: [{ 
        title: "Insufficient Data", 
        description: "Add more shot data for AI-powered insights." 
      }]
    };
  }
  
  // Find optimal zones
  const optimalZones = identifyOptimalZones(zoneData);
  
  // Player-specific insights
  const players = {};
  shots.forEach(shot => {
    const player = shot.playerName || 'Unknown Player';
    if (!players[player]) {
      players[player] = {
        name: player,
        totalShots: 0,
        goals: 0,
        points: 0,
        misses: 0,
        successRate: 0,
        avgXP: 0,
        xPSum: 0
      };
    }
    
    players[player].totalShots++;
    players[player].xPSum += (shot.xPoints || 0);
    
    const action = (shot.action || '').toLowerCase().trim();
    if (action === 'goal' || action === 'penalty goal') {
      players[player].goals++;
    } else if (action === 'point' || action === 'free' || action === 'offensive mark' || action === 'fortyfive') {
      players[player].points++;
    } else {
      players[player].misses++;
    }
  });
  
  // Calculate success rates
  Object.values(players).forEach(player => {
    player.successRate = (player.goals + player.points) / player.totalShots;
    player.avgXP = player.xPSum / player.totalShots;
  });
  
  // Find top performers
  const topPlayers = Object.values(players)
    .filter(p => p.totalShots >= 5)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3);
  
  // Generate player insights
  const playerInsights = topPlayers.map(player => ({
    title: `${player.name} - ${(player.successRate * 100).toFixed(0)}% Success Rate`,
    description: `${player.name} has converted ${player.goals + player.points} from ${player.totalShots} shots, with an average xP of ${player.avgXP.toFixed(2)}.`
  }));
  
  // Generate general insights
  let generalInsights = [];
  
  const allSuccessfulShots = shots.filter(s => {
    const action = (s.action || '').toLowerCase().trim();
    return action === 'goal' || action === 'point' || action === 'free' || action === 'offensive mark' || action === 'fortyfive';
  });
  
  const allMissedShots = shots.filter(s => {
    const action = (s.action || '').toLowerCase().trim();
    return !['goal', 'point', 'free', 'offensive mark', 'fortyfive'].includes(action);
  });
  
  // Overall conversion rate
  const overallConversionRate = allSuccessfulShots.length / Math.max(1, shots.length);
  
  generalInsights.push({
    title: `Overall Conversion: ${(overallConversionRate * 100).toFixed(0)}%`,
    description: `The team has converted ${allSuccessfulShots.length} from ${shots.length} total shots.`
  });
  
  // Distance analysis
  if (shots.length > 0) {
    const successByDistance = {
      close: { total: 0, success: 0 },
      medium: { total: 0, success: 0 },
      far: { total: 0, success: 0 }
    };
    
    shots.forEach(shot => {
      const dist = shot.distMeters || 0;
      const isSuccess = ['goal', 'point', 'free', 'offensive mark', 'fortyfive'].includes((shot.action || '').toLowerCase().trim());
      
      if (dist < 20) {
        successByDistance.close.total++;
        if (isSuccess) successByDistance.close.success++;
      } else if (dist < 35) {
        successByDistance.medium.total++;
        if (isSuccess) successByDistance.medium.success++;
      } else {
        successByDistance.far.total++;
        if (isSuccess) successByDistance.far.success++;
      }
    });
    
    // Find best distance range
    const ranges = Object.entries(successByDistance).map(([range, data]) => ({
      range,
      rate: data.total > 0 ? data.success / data.total : 0,
      total: data.total
    }));
    
    const bestRange = ranges.filter(r => r.total >= 3).sort((a, b) => b.rate - a.rate)[0];
    
    if (bestRange) {
      generalInsights.push({
        title: `Best Distance: ${bestRange.range === 'close' ? 'Under 20m' : bestRange.range === 'medium' ? '20-35m' : 'Over 35m'}`,
        description: `${(bestRange.rate * 100).toFixed(0)}% conversion rate from ${bestRange.total} shots at this distance.`
      });
    }
  }
  
  // Pressure analysis
  const shotsByPressure = {};
  shots.forEach(shot => {
    const pressure = (shot.pressure || 'none').toLowerCase();
    if (!shotsByPressure[pressure]) {
      shotsByPressure[pressure] = { total: 0, success: 0 };
    }
    shotsByPressure[pressure].total++;
    
    const isSuccess = ['goal', 'point', 'free', 'offensive mark', 'fortyfive'].includes((shot.action || '').toLowerCase().trim());
    if (isSuccess) shotsByPressure[pressure].success++;
  });
  
  const pressureInsight = Object.entries(shotsByPressure)
    .filter(([_, data]) => data.total >= 5)
    .map(([pressure, data]) => ({
      pressure,
      rate: data.success / data.total,
      total: data.total
    }))
    .sort((a, b) => b.rate - a.rate)[0];
  
  if (pressureInsight) {
    generalInsights.push({
      title: `Pressure Impact: ${pressureInsight.pressure === 'none' ? 'No Pressure' : pressureInsight.pressure === 'low' ? 'Low Pressure' : pressureInsight.pressure === 'medium' ? 'Medium Pressure' : 'High Pressure'} is Best`,
      description: `${(pressureInsight.rate * 100).toFixed(0)}% conversion rate from ${pressureInsight.total} shots with ${pressureInsight.pressure} pressure.`
    });
  }
  
  return {
    optimalZones,
    playerInsights,
    generalInsights: generalInsights.slice(0, 4) // Limit to 4 insights
  };
};

// Main component
const AIGAAAttacking = ({ data, refreshKey, datasets }) => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [shotData, setShotData] = useState([]);
  const [filteredShots, setFilteredShots] = useState([]);
  const [heatmapData, setHeatmapData] = useState({ zoneData: [] });
  const [selectedZone, setSelectedZone] = useState(null);
  const [filters, setFilters] = useState({
    match: '',
    team: '',
    player: '',
    action: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    matches: [], teams: [], players: [], actions: []
  });
  const [gridSize, setGridSize] = useState(8);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsState, setSettingsState] = useState({
    showOptimalZones: true,
    gridSize: 8,
    showLabels: true,
    highlightSuccessRate: true
  });
  const [insights, setInsights] = useState({
    optimalZones: [],
    playerInsights: [],
    generalInsights: []
  });

  // Pitch constants
  const pitchWidth = 145 / 2; // Half pitch (attacking half)
  const pitchHeight = 88;
  const xScale = 6, yScale = 6;

  // Refs for the canvas and download
  const stageRef = useRef(null);
  const contentRef = useRef(null);

  // Process data on mount and when refreshKey changes
  useEffect(() => {
    const processData = async () => {
      setIsLoading(true);
      
      if (!data || !data.games) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Process games data
        const processedGames = data.games.map(game => {
          // Ensure gameData is an array
          if (!game.gameData || !Array.isArray(game.gameData)) {
            game.gameData = [];
          }
          
          // Process each shot to ensure it has xPoints and distMeters
          game.gameData = game.gameData.map(shot => {
            const translatedShot = translateShotToOneSide(shot, pitchWidth, pitchWidth * 2, pitchHeight / 2);
            
            // Ensure xPoints is set
            if (typeof shot.xPoints !== 'number') {
              shot.xPoints = Math.random() * 0.5 + 0.3; // Placeholder
            }
            
            // Set distance if not already present
            if (typeof shot.distMeters !== 'number') {
              shot.distMeters = translatedShot.distMeters;
            }
            
            return shot;
          });
          
          return game;
        });
        
        // Extract all shots
        const allShots = flattenShots(processedGames);
        setShotData(allShots);
        setFilteredShots(allShots);
        
        // Extract filter options
        const m = new Set(), t = new Set(), p = new Set(), a = new Set();
        processedGames.forEach(g => {
          g.match && m.add(g.match);
          (g.gameData || []).forEach(sh => {
            sh.team && t.add(sh.team);
            sh.playerName && p.add(sh.playerName);
            sh.action && a.add(sh.action);
          });
        });
        
        setFilterOptions({
          matches: Array.from(m),
          teams: Array.from(t),
          players: Array.from(p),
          actions: Array.from(a)
        });
      } catch (error) {
        console.error('Error processing data:', error);
        Swal.fire({
          title: 'Data Processing Error',
          text: 'Failed to process shot data.',
          icon: 'error',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    processData();
  }, [data, refreshKey, pitchWidth, pitchHeight]);

  // Update heatmap and insights when filtered shots change or grid size changes
  useEffect(() => {
    if (filteredShots.length > 0) {
      const zoneInfo = calculateZoneData(filteredShots, gridSize);
      setHeatmapData(zoneInfo);
      
      // Generate AI insights
      const newInsights = generateAIInsights(filteredShots, zoneInfo.zoneData);
      setInsights(newInsights);
    } else {
      setHeatmapData({ zoneData: [] });
      setInsights({
        optimalZones: [],
        playerInsights: [],
        generalInsights: [{ 
          title: "No Data Available", 
          description: "Apply different filters to view shot analysis." 
        }]
      });
    }
  }, [filteredShots, gridSize]);

  // Apply filters
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Update filtered shots when filters change
  useEffect(() => {
    if (!shotData.length) return;
    
    let filtered = [...shotData];
    
    if (filters.match) {
      const matchShots = data.games
        .filter(g => g.match === filters.match)
        .flatMap(g => g.gameData || []);
      filtered = filtered.filter(shot => matchShots.some(ms => 
        ms.x === shot.x && ms.y === shot.y && ms.playerName === shot.playerName
      ));
    }
    
    if (filters.team) {
      filtered = filtered.filter(shot => shot.team === filters.team);
    }
    
    if (filters.player) {
      filtered = filtered.filter(shot => shot.playerName === filters.player);
    }
    
    if (filters.action) {
      filtered = filtered.filter(shot => shot.action === filters.action);
    }
    
    setFilteredShots(filtered);
  }, [filters, shotData, data]);

  // Handle zone click
  const handleZoneClick = (zone) => {
    setSelectedZone(zone);
  };

  // Export as PDF
  const exportPDF = async () => {
    setIsDownloading(true);
    try {
      if (!contentRef.current) {
        throw new Error('Content ref not available');
      }
      
      const content = contentRef.current;
      
      // Create a new PDF
      const pdf = new jsPDF('l', 'mm', 'a4');
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      
      // Capture stage as image
      const stage = stageRef.current;
      if (!stage) {
        throw new Error('Stage ref not available');
      }
      
      // Convert Konva stage to image
      const stageImage = stage.toDataURL();
      
      // Add content to PDF
      pdf.setFillColor(15, 10, 27); // Background color
      pdf.rect(0, 0, width, height, 'F');
      
      // Add title
      pdf.setTextColor(115, 63, 170); // Purple
      pdf.setFontSize(24);
      pdf.text('AI-Powered Attacking Analysis', width / 2, 20, { align: 'center' });
      
      // Add heatmap image
      pdf.addImage(stageImage, 'PNG', 10, 30, width - 20, height / 2);
      
      // Add insights
      pdf.setTextColor(230, 230, 250); // Light color
      pdf.setFontSize(14);
      pdf.text('AI Insights', 15, height / 2 + 35);
      
      pdf.setFontSize(10);
      let yPos = height / 2 + 45;
      
      insights.generalInsights.forEach(insight => {
        pdf.setTextColor(255, 121, 198); // Pink
        pdf.text(insight.title, 15, yPos);
        yPos += 5;
        
        pdf.setTextColor(230, 230, 250);
        pdf.text(insight.description, 15, yPos, {
          maxWidth: width - 30
        });
        yPos += 10;
      });
      
      // Add footer
      pdf.setTextColor(155, 102, 217); // Purple
      pdf.setFontSize(8);
      pdf.text('Generated by Scorelect AI Analytics', width - 15, height - 10, { align: 'right' });
      
      // Save the PDF
      pdf.save('attacking-analysis.pdf');
      
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
      if (!filteredShots.length) {
        throw new Error('No data to export');
      }
      
      // Prepare data for CSV
      const csvData = filteredShots.map(shot => ({
        Team: shot.team || '',
        Player: shot.playerName || '',
        Action: shot.action || '',
        X: shot.x || 0,
        Y: shot.y || 0,
        Distance: shot.distMeters?.toFixed(2) || 0,
        Minute: shot.minute || '',
        xPoints: shot.xPoints?.toFixed(3) || 0,
        xGoals: shot.xGoals?.toFixed(3) || 0,
        Pressure: shot.pressure || '',
        Position: shot.position || '',
        Match: shot.match || ''
      }));
      
      // Convert to CSV
      const csv = Papa.unparse(csvData);
      
      // Create a download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'attacking-analysis.csv';
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

  // Render heatmap
  const renderHeatmap = () => {
    if (!heatmapData.zoneData || !heatmapData.zoneData.length) {
      return null;
    }
    
    return (
      <Layer>
        {/* Render zones */}
        {heatmapData.zoneData.map((zone, i) => (
          <Rect
            key={`zone-${i}`}
            x={zone.x * xScale}
            y={zone.y * yScale}
            width={zone.width * xScale}
            height={zone.height * yScale}
            fill={getHeatmapColor(zone.value)}
            opacity={0.7}
            stroke="#000"
            strokeWidth={0.5}
            onClick={() => handleZoneClick(zone)}
            onTap={() => handleZoneClick(zone)}
          />
        ))}
        
        {/* Render optimal zones if enabled */}
        {settingsState.showOptimalZones && insights.optimalZones.map((zone, i) => (
          <Rect
            key={`optimal-${i}`}
            x={zone.x * xScale}
            y={zone.y * yScale}
            width={zone.width * xScale}
            height={zone.height * yScale}
            stroke="#50FA7B"
            strokeWidth={3}
            dash={[5, 2]}
          />
        ))}
        
        {/* Render labels if enabled */}
        {settingsState.showLabels && heatmapData.zoneData
          .filter(zone => zone.count > 0)
          .map((zone, i) => (
          <Text
            key={`label-${i}`}
            x={(zone.x + zone.width / 2) * xScale}
            y={(zone.y + zone.height / 2) * yScale}
            text={zone.count.toString()}
            fontSize={12}
            fontStyle="bold"
            fill="#fff"
            align="center"
            verticalAlign="middle"
            offsetX={5}
            offsetY={6}
          />
        ))}
        
        {/* Render success rates if enabled */}
        {settingsState.highlightSuccessRate && heatmapData.zoneData
          .filter(zone => zone.count >= 3)
          .map((zone, i) => (
          <Text
            key={`success-${i}`}
            x={(zone.x + zone.width / 2) * xScale}
            y={(zone.y + zone.height / 3) * yScale}
            text={`${(zone.successRate * 100).toFixed(0)}%`}
            fontSize={9}
            fontStyle="bold"
            fill={zone.successRate > 0.7 ? "#50FA7B" : zone.successRate > 0.4 ? "#FFFF33" : "#FF5555"}
            align="center"
            verticalAlign="middle"
            offsetX={5}
            offsetY={-10}
          />
        ))}
      </Layer>
    );
  };

  // Statistics summary
  const renderStatsSummary = () => {
    if (!filteredShots.length) return null;
    
    const totalShots = filteredShots.length;
    const goals = filteredShots.filter(s => (s.action || '').toLowerCase().includes('goal')).length;
    const points = filteredShots.filter(s => (s.action || '').toLowerCase() === 'point').length;
    const setplays = filteredShots.filter(s => ['free', 'offensive mark', 'fortyfive'].some(sp => 
      (s.action || '').toLowerCase().includes(sp))).length;
    const misses = totalShots - goals - points - setplays;
    
    const avgXP = filteredShots.reduce((sum, s) => sum + (s.xPoints || 0), 0) / totalShots;
    
    return (
      <div className="ai-stats-grid">
        <div className="ai-stat-card">
          <div className="ai-stat-title">Total Shots</div>
          <div className="ai-stat-value">{totalShots}</div>
        </div>
        
        <div className="ai-stat-card">
          <div className="ai-stat-title">Goals</div>
          <div className="ai-stat-value">{goals}</div>
          <div className="ai-stat-trend">
            <span className="ai-trend-positive">{(goals / totalShots * 100).toFixed(1)}% of total</span>
          </div>
        </div>
        
        <div className="ai-stat-card">
          <div className="ai-stat-title">Points</div>
          <div className="ai-stat-value">{points + setplays}</div>
          <div className="ai-stat-trend">
            <span className="ai-trend-positive">{((points + setplays) / totalShots * 100).toFixed(1)}% of total</span>
          </div>
        </div>
        
        <div className="ai-stat-card">
          <div className="ai-stat-title">Success Rate</div>
          <div className="ai-stat-value">{((goals + points + setplays) / totalShots * 100).toFixed(1)}%</div>
          <div className="ai-stat-trend">
            <span className={((goals + points + setplays) / totalShots) > 0.5 ? "ai-trend-positive" : "ai-trend-negative"}>
              {((goals + points + setplays) / totalShots) > 0.5 ? "Above Average" : "Below Average"}
            </span>
          </div>
        </div>
        
        <div className="ai-stat-card">
          <div className="ai-stat-title">Average xP</div>
          <div className="ai-stat-value">{avgXP.toFixed(2)}</div>
        </div>
      </div>
    );
  };

  // Modal for showing zone details
  const renderZoneDetailModal = () => {
    if (!selectedZone) return null;
    
    return (
      <Modal
        isOpen={!!selectedZone}
        onRequestClose={() => setSelectedZone(null)}
        className="ai-modal-content"
        overlayClassName="ai-modal-overlay"
        contentLabel="Zone Details"
      >
        <div className="ai-modal-header">
          <h2 className="ai-modal-title">Zone Analysis</h2>
        </div>
        
        <div className="ai-modal-body">
          <div className="ai-zone-stats">
            <div className="ai-zone-stat-row">
              <span className="ai-zone-stat-label">Total Shots:</span>
              <span className="ai-zone-stat-value">{selectedZone.count}</span>
            </div>
            
            <div className="ai-zone-stat-row">
              <span className="ai-zone-stat-label">Success Rate:</span>
              <span className="ai-zone-stat-value">{(selectedZone.successRate * 100).toFixed(1)}%</span>
            </div>
            
            <div className="ai-zone-stat-row">
              <span className="ai-zone-stat-label">Average xP:</span>
              <span className="ai-zone-stat-value">{selectedZone.avgXP.toFixed(2)}</span>
            </div>
            
            {selectedZone.avgXG > 0 && (
              <div className="ai-zone-stat-row">
                <span className="ai-zone-stat-label">Average xG:</span>
                <span className="ai-zone-stat-value">{selectedZone.avgXG.toFixed(2)}</span>
              </div>
            )}
          </div>
          
          <h3 className="ai-section-subtitle">Shots in this Zone</h3>
          <div className="ai-zone-shots-list">
            {selectedZone.shots.length > 0 ? (
              <table className="ai-zone-shots-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Action</th>
                    <th>Distance</th>
                    <th>xP</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedZone.shots.map((shot, i) => (
                    <tr key={i}>
                      <td>{shot.playerName || 'Unknown'}</td>
                      <td>{shot.action || 'Unknown'}</td>
                      <td>{shot.distMeters?.toFixed(1) || 0}m</td>
                      <td>{shot.xPoints?.toFixed(2) || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No shots data available for this zone.</p>
            )}
          </div>
          
          <h3 className="ai-section-subtitle">AI Recommendations</h3>
          <div className="ai-zone-recommendations">
            {selectedZone.count >= 3 ? (
              <>
                <p>
                  <strong>Success Rate:</strong> {selectedZone.successRate > 0.7 ? 'High' : selectedZone.successRate > 0.4 ? 'Medium' : 'Low'}
                </p>
                <p>
                  <strong>Recommendation:</strong> {
                    selectedZone.successRate > 0.7 
                      ? 'This is a high-value zone. Encourage shots from this position.'
                      : selectedZone.successRate > 0.4
                        ? 'This zone has moderate success. Take shots when under low pressure.'
                        : 'This is a low-value zone. Look for better shooting opportunities.'
                  }
                </p>
                <p>
                  <strong>Player Match:</strong> {
                    selectedZone.shots.length > 0 &&
                    (
                      (() => {
                        const playerStats = {};
                        selectedZone.shots.forEach(shot => {
                          const player = shot.playerName || 'Unknown';
                          if (!playerStats[player]) {
                            playerStats[player] = { shots: 0, success: 0 };
                          }
                          playerStats[player].shots++;
                          
                          const isSuccess = ['goal', 'point', 'free', 'offensive mark', 'fortyfive'].includes(
                            (shot.action || '').toLowerCase().trim()
                          );
                          
                          if (isSuccess) playerStats[player].success++;
                        });
                        
                        // Find best player in this zone
                        const bestPlayer = Object.entries(playerStats)
                          .filter(([_, stats]) => stats.shots >= 2)
                          .sort(([_, statsA], [__, statsB]) => 
                            (statsB.success / statsB.shots) - (statsA.success / statsA.shots)
                          )[0];
                        
                        return bestPlayer 
                          ? `${bestPlayer[0]} performs well in this zone with ${bestPlayer[1].success}/${bestPlayer[1].shots} conversion.`
                          : 'No player has enough shots in this zone for analysis.';
                      })()
                    )
                  }
                </p>
              </>
            ) : (
              <p>Insufficient data for this zone. Minimum 3 shots required for AI analysis.</p>
            )}
          </div>
        </div>
        
        <div className="ai-modal-footer">
          <button 
            className="ai-button" 
            onClick={() => setSelectedZone(null)}
          >
            Close
          </button>
        </div>
      </Modal>
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
        contentLabel="Heatmap Settings"
      >
        <div className="ai-modal-header">
          <h2 className="ai-modal-title">Heatmap Settings</h2>
        </div>
        
        <div className="ai-modal-body">
          <div className="ai-settings-group">
            <label className="ai-settings-label">
              Grid Size
              <input
                type="range"
                min="4"
                max="12"
                step="1"
                value={settingsState.gridSize}
                onChange={e => setSettingsState(prev => ({ ...prev, gridSize: parseInt(e.target.value) }))}
              />
              <span className="ai-settings-value">{settingsState.gridSize}x{settingsState.gridSize}</span>
            </label>
          </div>
          
          <div className="ai-settings-group ai-settings-checkbox">
            <label className="ai-settings-label">
              <input
                type="checkbox"
                checked={settingsState.showOptimalZones}
                onChange={e => setSettingsState(prev => ({ ...prev, showOptimalZones: e.target.checked }))}
              />
              Highlight Optimal Zones
            </label>
          </div>
          
          <div className="ai-settings-group ai-settings-checkbox">
            <label className="ai-settings-label">
              <input
                type="checkbox"
                checked={settingsState.showLabels}
                onChange={e => setSettingsState(prev => ({ ...prev, showLabels: e.target.checked }))}
              />
              Show Shot Counts
            </label>
          </div>
          
          <div className="ai-settings-group ai-settings-checkbox">
            <label className="ai-settings-label">
              <input
                type="checkbox"
                checked={settingsState.highlightSuccessRate}
                onChange={e => setSettingsState(prev => ({ ...prev, highlightSuccessRate: e.target.checked }))}
              />
              Show Success Rates
            </label>
          </div>
        </div>
        
        <div className="ai-modal-footer">
          <button 
            className="ai-button" 
            onClick={() => {
              setGridSize(settingsState.gridSize);
              setIsSettingsModalOpen(false);
            }}
          >
            Apply
          </button>
          <button 
            className="ai-button secondary" 
            onClick={() => setIsSettingsModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>
    );
  };

  // Render AI insights panel
  const renderInsightsPanel = () => {
    return (
      <div className="ai-insights-panel">
        <div className="ai-insights-header">
          <FaLightbulb className="ai-insights-icon" />
          <h3 className="ai-insights-title">AI-Powered Insights</h3>
        </div>
        
        <div className="ai-insights-content">
          {insights.generalInsights.map((insight, i) => (
            <div className="ai-insight-item" key={i}>
              <div className="ai-insight-icon">
                <HiOutlineLightBulb />
              </div>
              <div className="ai-insight-content">
                <div className="ai-insight-title">{insight.title}</div>
                <div className="ai-insight-desc">{insight.description}</div>
              </div>
            </div>
          ))}
          
          {insights.playerInsights.map((insight, i) => (
            <div className="ai-insight-item" key={i}>
              <div className="ai-insight-icon">
                <FaTrophy />
              </div>
              <div className="ai-insight-content">
                <div className="ai-insight-title">{insight.title}</div>
                <div className="ai-insight-desc">{insight.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Main return
  if (isLoading) {
    return (
      <div className="ai-section">
        <div className="ai-loading">
          <div className="ai-loading-spinner"></div>
          <p>Loading attacking analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-attacking-dashboard" ref={contentRef}>
      <div className="ai-section">
        <div className="ai-section-header">
          <h2 className="ai-section-title">
            <FaChartLine /> Attacking Heatmap Analysis
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
              value={filters.team}
              onChange={e => handleFilterChange('team', e.target.value)}
            >
              <option value="">All Teams</option>
              {filterOptions.teams.map((team, i) => (
                <option key={i} value={team}>{team}</option>
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
          
          <div className="ai-filter-group">
            <select 
              className="ai-filter-select"
              value={filters.action}
              onChange={e => handleFilterChange('action', e.target.value)}
            >
              <option value="">All Actions</option>
              {filterOptions.actions.map((action, i) => (
                <option key={i} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>
        
        {renderStatsSummary()}
        
        <div className="ai-map-wrapper">
          <Stage
            width={pitchWidth * xScale}
            height={pitchHeight * yScale}
            ref={stageRef}
          >
            <Layer>
              {/* Background */}
              <Rect
                x={0}
                y={0}
                width={pitchWidth * xScale}
                height={pitchHeight * yScale}
                fill="#0F0A1B" // Dark background
              />
              
              {/* Pitch Lines */}
              <Rect
                x={0}
                y={0}
                width={pitchWidth * xScale}
                height={pitchHeight * yScale}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              
              {/* 13m Line */}
              <Line
                points={[13 * xScale, 0, 13 * xScale, pitchHeight * yScale]}
                stroke="#FFFFFF"
                strokeWidth={1}
              />
              
              {/* 20m Line */}
              <Line
                points={[20 * xScale, 0, 20 * xScale, pitchHeight * yScale]}
                stroke="#FFFFFF"
                strokeWidth={1}
              />
              
              {/* 45m Line */}
              <Line
                points={[45 * xScale, 0, 45 * xScale, pitchHeight * yScale]}
                stroke="#FFFFFF"
                strokeWidth={1}
              />
              
              {/* Goal Area */}
              <Rect
                x={0}
                y={(pitchHeight / 2 - 4.5) * yScale}
                width={4.5 * xScale}
                height={9 * yScale}
                stroke="#FFFFFF"
                strokeWidth={1}
                fill="transparent"
              />
              
              {/* Draw small circle for goal */}
              <Circle
                x={0}
                y={pitchHeight / 2 * yScale}
                radius={3}
                fill="#FFFFFF"
              />
            </Layer>
            
            {renderHeatmap()}
          </Stage>
          
          <div className="ai-map-legend">
            <div className="ai-legend-item">
              <div className="ai-legend-color" style={{ background: getHeatmapColor(1) }}></div>
              <span>High Density</span>
            </div>
            <div className="ai-legend-item">
              <div className="ai-legend-color" style={{ background: getHeatmapColor(0.5) }}></div>
              <span>Medium Density</span>
            </div>
            <div className="ai-legend-item">
              <div className="ai-legend-color" style={{ background: getHeatmapColor(0) }}></div>
              <span>Low Density</span>
            </div>
            {settingsState.showOptimalZones && (
              <div className="ai-legend-item">
                <div className="ai-legend-border" style={{ borderColor: "#50FA7B", borderStyle: "dashed" }}></div>
                <span>Optimal Zone</span>
              </div>
            )}
          </div>
        </div>
        
        {renderInsightsPanel()}
      </div>
      
      {renderZoneDetailModal()}
      {renderSettingsModal()}
    </div>
  );
};

export default AIGAAAttacking;// AIGAAAttacking.js - AI-Enhanced Attacking Analysis Tab