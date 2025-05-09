// AIGAAHeadToHead.js - Head-to-Head Team Analysis Tab
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaExchangeAlt, FaDownload, FaCog, FaLightbulb, FaChartBar, FaFilter, FaFileDownload } from 'react-icons/fa';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { Stage, Layer, Rect, Circle, Text, Line } from 'react-konva';
import * as d3 from 'd3';
import Modal from 'react-modal';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../AuthContext';
import { jsPDF } from "jspdf";
import Papa from 'papaparse';
import { translateShotToOneSide } from '../components/GAAPitchComponents';
import { Radar } from 'react-chartjs-2';
import 'chart.js/auto';

// Environment-based API URL
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Utility function to flatten shots array
const flattenShots = (games = []) => {
  return games.flatMap(g => g.gameData || []);
};

// Get heatmap color
const getHeatmapColor = (value) => {
  const colorScale = d3.scaleSequential(d3.interpolateRdBu)
    .domain([1, 0]); // Red (high density) to Blue (low density)
  return colorScale(value);
};

// Create comparison function
const generateTeamComparison = (teamAShots, teamBShots) => {
  // Shot accuracy comparison
  const teamATotal = teamAShots.length;
  const teamBTotal = teamBShots.length;
  
  const teamASuccess = teamAShots.filter(s => {
    const action = (s.action || '').toLowerCase().trim();
    return action === 'goal' || action === 'point' || action === 'free' || action === 'offensive mark' || action === 'fortyfive';
  }).length;
  
  const teamBSuccess = teamBShots.filter(s => {
    const action = (s.action || '').toLowerCase().trim();
    return action === 'goal' || action === 'point' || action === 'free' || action === 'offensive mark' || action === 'fortyfive';
  }).length;
  
  const teamAAccuracy = teamATotal > 0 ? teamASuccess / teamATotal : 0;
  const teamBAccuracy = teamBTotal > 0 ? teamBSuccess / teamBTotal : 0;
  
  // Goal conversion rate
  const teamAGoals = teamAShots.filter(s => (s.action || '').toLowerCase().includes('goal')).length;
  const teamBGoals = teamBShots.filter(s => (s.action || '').toLowerCase().includes('goal')).length;
  
  const teamAGoalRate = teamATotal > 0 ? teamAGoals / teamATotal : 0;
  const teamBGoalRate = teamBTotal > 0 ? teamBGoals / teamBTotal : 0;
  
  // Average distance
  const teamAAvgDistance = teamAShots.reduce((sum, s) => sum + (s.distMeters || 0), 0) / Math.max(1, teamATotal);
  const teamBAvgDistance = teamBShots.reduce((sum, s) => sum + (s.distMeters || 0), 0) / Math.max(1, teamBTotal);
  
  // Average expected points (xP)
  const teamAAvgXP = teamAShots.reduce((sum, s) => sum + (s.xPoints || 0), 0) / Math.max(1, teamATotal);
  const teamBAvgXP = teamBShots.reduce((sum, s) => sum + (s.xPoints || 0), 0) / Math.max(1, teamBTotal);
  
  // Free kicks conversion
  const teamAFreeKicks = teamAShots.filter(s => (s.action || '').toLowerCase().includes('free')).length;
  const teamAFreeKicksSuccess = teamAShots.filter(s => (s.action || '').toLowerCase() === 'free').length;
  
  const teamBFreeKicks = teamBShots.filter(s => (s.action || '').toLowerCase().includes('free')).length;
  const teamBFreeKicksSuccess = teamBShots.filter(s => (s.action || '').toLowerCase() === 'free').length;
  
  const teamAFreeConversion = teamAFreeKicks > 0 ? teamAFreeKicksSuccess / teamAFreeKicks : 0;
  const teamBFreeConversion = teamBFreeKicks > 0 ? teamBFreeKicksSuccess / teamBFreeKicks : 0;
  
  // Set play effectiveness
  const teamASetPlays = teamAShots.filter(s => {
    const action = (s.action || '').toLowerCase();
    return action.includes('free') || action.includes('offensive mark') || action.includes('fortyfive');
  }).length;
  
  const teamASetPlaysSuccess = teamAShots.filter(s => {
    const action = (s.action || '').toLowerCase();
    return action === 'free' || action === 'offensive mark' || action === 'fortyfive';
  }).length;
  
  const teamBSetPlays = teamBShots.filter(s => {
    const action = (s.action || '').toLowerCase();
    return action.includes('free') || action.includes('offensive mark') || action.includes('fortyfive');
  }).length;
  
  const teamBSetPlaysSuccess = teamBShots.filter(s => {
    const action = (s.action || '').toLowerCase();
    return action === 'free' || action === 'offensive mark' || action === 'fortyfive';
  }).length;
  
  const teamASetPlayEfficiency = teamASetPlays > 0 ? teamASetPlaysSuccess / teamASetPlays : 0;
  const teamBSetPlayEfficiency = teamBSetPlays > 0 ? teamBSetPlaysSuccess / teamBSetPlays : 0;
  
  return {
    shotAccuracy: {
      teamA: teamAAccuracy,
      teamB: teamBAccuracy,
      difference: teamAAccuracy - teamBAccuracy,
      advantage: teamAAccuracy > teamBAccuracy ? 'teamA' : 'teamB'
    },
    goalConversion: {
      teamA: teamAGoalRate,
      teamB: teamBGoalRate,
      difference: teamAGoalRate - teamBGoalRate,
      advantage: teamAGoalRate > teamBGoalRate ? 'teamA' : 'teamB'
    },
    avgDistance: {
      teamA: teamAAvgDistance,
      teamB: teamBAvgDistance,
      difference: teamAAvgDistance - teamBAvgDistance,
      advantage: teamAAvgDistance < teamBAvgDistance ? 'teamA' : 'teamB' // Lower is better for average shot distance
    },
    expectedPoints: {
      teamA: teamAAvgXP,
      teamB: teamBAvgXP,
      difference: teamAAvgXP - teamBAvgXP,
      advantage: teamAAvgXP > teamBAvgXP ? 'teamA' : 'teamB'
    },
    freeKicks: {
      teamA: teamAFreeConversion,
      teamB: teamBFreeConversion,
      difference: teamAFreeConversion - teamBFreeConversion,
      advantage: teamAFreeConversion > teamBFreeConversion ? 'teamA' : 'teamB'
    },
    setPlays: {
      teamA: teamASetPlayEfficiency,
      teamB: teamBSetPlayEfficiency,
      difference: teamASetPlayEfficiency - teamBSetPlayEfficiency,
      advantage: teamASetPlayEfficiency > teamBSetPlayEfficiency ? 'teamA' : 'teamB'
    },
    totalShots: {
      teamA: teamATotal,
      teamB: teamBTotal
    },
    successfulShots: {
      teamA: teamASuccess,
      teamB: teamBSuccess
    }
  };
};

// Generate insights based on comparison
const generateInsights = (comparison, teamA, teamB) => {
  if (!comparison) return [];
  
  const insights = [];
  
  // Shot accuracy insight
  if (Math.abs(comparison.shotAccuracy.difference) > 0.1) {
    const betterTeam = comparison.shotAccuracy.advantage === 'teamA' ? teamA : teamB;
    const worseTeam = comparison.shotAccuracy.advantage === 'teamA' ? teamB : teamA;
    
    insights.push({
      title: `${betterTeam} Has Better Shot Accuracy`,
      description: `${betterTeam} converts ${(comparison.shotAccuracy[comparison.shotAccuracy.advantage] * 100).toFixed(1)}% of shots compared to ${(comparison.shotAccuracy[comparison.shotAccuracy.advantage === 'teamA' ? 'teamB' : 'teamA'] * 100).toFixed(1)}% for ${worseTeam}. Focus on shooting consistency against ${betterTeam}.`
    });
  }
  
  // Goal conversion insight
  if (Math.abs(comparison.goalConversion.difference) > 0.05) {
    const betterTeam = comparison.goalConversion.advantage === 'teamA' ? teamA : teamB;
    const worseTeam = comparison.goalConversion.advantage === 'teamA' ? teamB : teamA;
    
    insights.push({
      title: `${betterTeam} More Effective at Scoring Goals`,
      description: `${betterTeam} has a goal conversion rate of ${(comparison.goalConversion[comparison.goalConversion.advantage] * 100).toFixed(1)}% compared to ${(comparison.goalConversion[comparison.goalConversion.advantage === 'teamA' ? 'teamB' : 'teamA'] * 100).toFixed(1)}% for ${worseTeam}.`
    });
  }
  
  // Set plays insight
  if (Math.abs(comparison.setPlays.difference) > 0.1) {
    const betterTeam = comparison.setPlays.advantage === 'teamA' ? teamA : teamB;
    const worseTeam = comparison.setPlays.advantage === 'teamA' ? teamB : teamA;
    
    insights.push({
      title: `${betterTeam} More Efficient with Set Plays`,
      description: `${betterTeam} converts ${(comparison.setPlays[comparison.setPlays.advantage] * 100).toFixed(1)}% of set play opportunities compared to ${(comparison.setPlays[comparison.setPlays.advantage === 'teamA' ? 'teamB' : 'teamA'] * 100).toFixed(1)}% for ${worseTeam}.`
    });
  }
  
  // Shot distance insight
  const distanceDiff = Math.abs(comparison.avgDistance.teamA - comparison.avgDistance.teamB);
  if (distanceDiff > 3) {
    const closeTeam = comparison.avgDistance.teamA < comparison.avgDistance.teamB ? teamA : teamB;
    const farTeam = comparison.avgDistance.teamA < comparison.avgDistance.teamB ? teamB : teamA;
    
    insights.push({
      title: `${closeTeam} Takes Closer Shots`,
      description: `${closeTeam} takes shots from an average distance of ${comparison.avgDistance[comparison.avgDistance.advantage === 'teamA' ? 'teamA' : 'teamB'].toFixed(1)}m compared to ${comparison.avgDistance[comparison.avgDistance.advantage === 'teamA' ? 'teamB' : 'teamA'].toFixed(1)}m for ${farTeam}.`
    });
  }
  
  // Expected points insight
  if (Math.abs(comparison.expectedPoints.difference) > 0.05) {
    const betterTeam = comparison.expectedPoints.advantage === 'teamA' ? teamA : teamB;
    const worseTeam = comparison.expectedPoints.advantage === 'teamA' ? teamB : teamA;
    
    insights.push({
      title: `${betterTeam} Takes Higher Quality Shots`,
      description: `${betterTeam} has an average xP of ${comparison.expectedPoints[comparison.expectedPoints.advantage].toFixed(2)} compared to ${comparison.expectedPoints[comparison.expectedPoints.advantage === 'teamA' ? 'teamB' : 'teamA'].toFixed(2)} for ${worseTeam}, indicating better shot selection.`
    });
  }
  
  // Shot volume insight
  const totalDiff = Math.abs(comparison.totalShots.teamA - comparison.totalShots.teamB);
  const totalRatio = Math.max(comparison.totalShots.teamA, comparison.totalShots.teamB) / 
                    Math.max(1, Math.min(comparison.totalShots.teamA, comparison.totalShots.teamB));
  
  if (totalDiff > 5 && totalRatio > 1.2) {
    const moreShots = comparison.totalShots.teamA > comparison.totalShots.teamB ? teamA : teamB;
    const fewerShots = comparison.totalShots.teamA > comparison.totalShots.teamB ? teamB : teamA;
    
    insights.push({
      title: `${moreShots} Creates More Shooting Opportunities`,
      description: `${moreShots} takes ${comparison.totalShots[comparison.totalShots.teamA > comparison.totalShots.teamB ? 'teamA' : 'teamB']} shots compared to ${comparison.totalShots[comparison.totalShots.teamA > comparison.totalShots.teamB ? 'teamB' : 'teamA']} for ${fewerShots}.`
    });
  }
  
  // Return at most 4 insights
  return insights.slice(0, 4);
};

// Calculate zone data for heatmap
const calculateZoneData = (shots, gridSize = 8) => {
  const pitchWidth = 145 / 2; // Half pitch width
  const pitchHeight = 88;
  
  // Initialize grid with zeros
  const cellWidth = pitchWidth / gridSize;
  const cellHeight = pitchHeight / gridSize;
  
  let grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
  
  // Count shots in each grid cell
  shots.forEach(shot => {
    const x = parseFloat(shot.x) || 0;
    const y = parseFloat(shot.y) || 0;
    
    // Ensure the shot is on the left half of the pitch
    if (x <= pitchWidth) {
      const gridX = Math.min(gridSize - 1, Math.floor(x / cellWidth));
      const gridY = Math.min(gridSize - 1, Math.floor(y / cellHeight));
      
      grid[gridY][gridX]++;
    }
  });
  
  // Normalize the grid values between 0 and 1
  const maxValue = Math.max(...grid.flat());
  const normalizedGrid = grid.map(row => 
    row.map(cell => maxValue > 0 ? cell / maxValue : 0)
  );
  
  return {
    grid: normalizedGrid,
    gridSize,
    cellWidth,
    cellHeight
  };
};

// Main component
const AIGAAHeadToHead = ({ data, refreshKey, datasets }) => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [shotData, setShotData] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    matches: [], teams: []
  });
  const [filters, setFilters] = useState({
    match: '',
    teamA: '',
    teamB: ''
  });
  const [teamAData, setTeamAData] = useState([]);
  const [teamBData, setTeamBData] = useState([]);
  const [teamAHeatmap, setTeamAHeatmap] = useState(null);
  const [teamBHeatmap, setTeamBHeatmap] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [insights, setInsights] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsState, setSettingsState] = useState({
    gridSize: 8,
    showWeakZones: true,
    normalizePossession: true
  });

  // Refs for the canvas and download
  const contentRef = useRef(null);
  const teamARef = useRef(null);
  const teamBRef = useRef(null);

  // Process data on mount and when refreshKey changes
  useEffect(() => {
    const processData = async () => {
      setIsLoading(true);
      
      if (!data || !data.games) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Extract all shots
        const allShots = flattenShots(data.games);
        setShotData(allShots);
        
        // Extract filter options
        const m = new Set(), t = new Set();
        data.games.forEach(g => {
          g.match && m.add(g.match);
          (g.gameData || []).forEach(sh => {
            sh.team && t.add(sh.team);
          });
        });
        
        setFilterOptions({
          matches: Array.from(m),
          teams: Array.from(t)
        });
        
        // Set default teams if not already set
        if (t.size >= 2) {
          const teams = Array.from(t);
          if (!filters.teamA) {
            setFilters(prev => ({ ...prev, teamA: teams[0] }));
          }
          if (!filters.teamB) {
            setFilters(prev => ({ ...prev, teamB: teams[1] }));
          }
        }
      } catch (error) {
        console.error('Error processing data:', error);
        Swal.fire({
          title: 'Data Processing Error',
          text: 'Failed to process head-to-head data.',
          icon: 'error',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    processData();
  }, [data, refreshKey]);

  // Update team data when filters change
  useEffect(() => {
    if (!shotData.length || !filters.teamA || !filters.teamB) return;
    
    let filteredShots = [...shotData];
    
    if (filters.match) {
      filteredShots = filteredShots.filter(shot => {
        // Find the game this shot belongs to
        const game = data.games.find(g => 
          g.gameData && g.gameData.some(s => 
            s.x === shot.x && s.y === shot.y && s.playerName === shot.playerName
          )
        );
        return game && game.match === filters.match;
      });
    }
    
    // Filter shots by teams
    const teamAShots = filteredShots.filter(shot => shot.team === filters.teamA);
    const teamBShots = filteredShots.filter(shot => shot.team === filters.teamB);
    
    setTeamAData(teamAShots);
    setTeamBData(teamBShots);
    
    // Generate heatmaps
    if (teamAShots.length > 0) {
      setTeamAHeatmap(calculateZoneData(teamAShots, settingsState.gridSize));
    } else {
      setTeamAHeatmap(null);
    }
    
    if (teamBShots.length > 0) {
      setTeamBHeatmap(calculateZoneData(teamBShots, settingsState.gridSize));
    } else {
      setTeamBHeatmap(null);
    }
    
    // Generate comparison
    if (teamAShots.length > 0 && teamBShots.length > 0) {
      const comp = generateTeamComparison(teamAShots, teamBShots);
      setComparison(comp);
      
      // Generate insights
      setInsights(generateInsights(comp, filters.teamA, filters.teamB));
    } else {
      setComparison(null);
      setInsights([]);
    }
  }, [shotData, filters, data.games, settingsState.gridSize]);

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Export as PDF
  const exportPDF = async () => {
    setIsDownloading(true);
    try {
      if (!contentRef.current || !comparison) {
        throw new Error('Content or comparison not available');
      }
      
      // Create a new PDF
      const pdf = new jsPDF('l', 'mm', 'a4');
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      
      // Capture heatmap images
      let teamAImage = null;
      let teamBImage = null;
      
      if (teamARef.current) {
        teamAImage = teamARef.current.toDataURL();
      }
      
      if (teamBRef.current) {
        teamBImage = teamBRef.current.toDataURL();
      }
      
      // Add content to PDF
      pdf.setFillColor(15, 10, 27); // Background color
      pdf.rect(0, 0, width, height, 'F');
      
      // Add title
      pdf.setTextColor(115, 63, 170); // Purple
      pdf.setFontSize(24);
      pdf.text(`Head-to-Head Analysis: ${filters.teamA} vs ${filters.teamB}`, width / 2, 20, { align: 'center' });
      
      // Add match info if selected
      if (filters.match) {
        pdf.setTextColor(255, 121, 198); // Pink
        pdf.setFontSize(16);
        pdf.text(`Match: ${filters.match}`, width / 2, 30, { align: 'center' });
      }
      
      // Add comparison summary
      pdf.setTextColor(230, 230, 250); // Light color
      pdf.setFontSize(14);
      pdf.text('Team Comparison', 20, 45);
      
      // Comparison stats table
      const statsY = 55;
      const colWidth = (width - 40) / 3;
      
      // Headers
      pdf.setFillColor(37, 25, 67); // Dark purple
      pdf.rect(20, statsY, width - 40, 10, 'F');
      
      pdf.setTextColor(230, 230, 250);
      pdf.setFontSize(10);
      pdf.text(filters.teamA, 20 + (colWidth / 2), statsY + 6, { align: 'center' });
      pdf.text('Metric', 20 + colWidth + (colWidth / 2), statsY + 6, { align: 'center' });
      pdf.text(filters.teamB, 20 + (2 * colWidth) + (colWidth / 2), statsY + 6, { align: 'center' });
      
      // Rows
      const metrics = [
        { 
          name: 'Shot Accuracy', 
          teamA: `${(comparison.shotAccuracy.teamA * 100).toFixed(1)}%`, 
          teamB: `${(comparison.shotAccuracy.teamB * 100).toFixed(1)}%`,
          advantage: comparison.shotAccuracy.advantage
        },
        { 
          name: 'Goal Conversion', 
          teamA: `${(comparison.goalConversion.teamA * 100).toFixed(1)}%`, 
          teamB: `${(comparison.goalConversion.teamB * 100).toFixed(1)}%`,
          advantage: comparison.goalConversion.advantage
        },
        { 
          name: 'Avg Shot Distance', 
          teamA: `${comparison.avgDistance.teamA.toFixed(1)}m`, 
          teamB: `${comparison.avgDistance.teamB.toFixed(1)}m`,
          advantage: comparison.avgDistance.advantage
        },
        { 
          name: 'Set Play Efficiency', 
          teamA: `${(comparison.setPlays.teamA * 100).toFixed(1)}%`, 
          teamB: `${(comparison.setPlays.teamB * 100).toFixed(1)}%`,
          advantage: comparison.setPlays.advantage
        },
        { 
          name: 'Expected Points (xP)', 
          teamA: comparison.expectedPoints.teamA.toFixed(2), 
          teamB: comparison.expectedPoints.teamB.toFixed(2),
          advantage: comparison.expectedPoints.advantage
        },
        { 
          name: 'Total Shots', 
          teamA: comparison.totalShots.teamA, 
          teamB: comparison.totalShots.teamB,
          advantage: comparison.totalShots.teamA > comparison.totalShots.teamB ? 'teamA' : 'teamB'
        }
      ];
      
      metrics.forEach((metric, i) => {
        const rowY = statsY + 10 + (i * 8);
        
        // Alternate row background
        if (i % 2 === 0) {
          pdf.setFillColor(26, 18, 50, 0.3);
          pdf.rect(20, rowY, width - 40, 8, 'F');
        }
        
        // Highlight advantage
        if (metric.advantage === 'teamA') {
          pdf.setTextColor(80, 250, 123); // Green for advantage
        } else {
          pdf.setTextColor(230, 230, 250);
        }
        pdf.text(metric.teamA, 20 + (colWidth / 2), rowY + 5, { align: 'center' });
        
        if (metric.advantage === 'teamB') {
          pdf.setTextColor(80, 250, 123); // Green for advantage
        } else {
          pdf.setTextColor(230, 230, 250);
        }
        pdf.text(metric.teamB, 20 + (2 * colWidth) + (colWidth / 2), rowY + 5, { align: 'center' });
        
        // Metric name
        pdf.setTextColor(230, 230, 250);
        pdf.text(metric.name, 20 + colWidth + (colWidth / 2), rowY + 5, { align: 'center' });
      });
      
      // Add heatmaps
      const heatmapY = statsY + 10 + (metrics.length * 8) + 20;
      
      pdf.setTextColor(230, 230, 250);
      pdf.setFontSize(14);
      pdf.text('Shot Distribution Comparison', 20, heatmapY - 10);
      
      if (teamAImage && teamBImage) {
        const imgWidth = (width - 60) / 2;
        const imgHeight = (teamAImage.height * imgWidth) / teamAImage.width;
        
        pdf.addImage(teamAImage, 'PNG', 20, heatmapY, imgWidth, imgHeight);
        pdf.addImage(teamBImage, 'PNG', 40 + imgWidth, heatmapY, imgWidth, imgHeight);
        
        // Team labels
        pdf.setTextColor(230, 230, 250);
        pdf.setFontSize(12);
        pdf.text(filters.teamA, 20 + (imgWidth / 2), heatmapY + imgHeight + 10, { align: 'center' });
        pdf.text(filters.teamB, 40 + imgWidth + (imgWidth / 2), heatmapY + imgHeight + 10, { align: 'center' });
      }
      
      // Add insights
      if (insights.length > 0) {
        const insightsY = height - 70;
        
        pdf.setTextColor(255, 121, 198); // Pink
        pdf.setFontSize(14);
        pdf.text('Key Insights', 20, insightsY);
        
        pdf.setTextColor(230, 230, 250);
        pdf.setFontSize(10);
        
        insights.forEach((insight, i) => {
          pdf.setTextColor(255, 121, 198); // Pink
          pdf.text(`${i + 1}. ${insight.title}`, 25, insightsY + 10 + (i * 12));
          
          pdf.setTextColor(230, 230, 250);
          pdf.text(insight.description, 30, insightsY + 16 + (i * 12), {
            maxWidth: width - 60
          });
        });
      }
      
      // Add footer
      pdf.setTextColor(155, 102, 217); // Purple
      pdf.setFontSize(8);
      pdf.text('Generated by Scorelect AI Analytics', width - 15, height - 10, { align: 'right' });
      
      // Save the PDF
      pdf.save('head-to-head-analysis.pdf');
      
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
      if (!comparison) {
        throw new Error('No comparison data available');
      }
      
      // Prepare data for CSV
      const csvData = [
        {
          Metric: 'Shot Accuracy',
          [filters.teamA]: `${(comparison.shotAccuracy.teamA * 100).toFixed(1)}%`,
          [filters.teamB]: `${(comparison.shotAccuracy.teamB * 100).toFixed(1)}%`,
          Difference: `${(Math.abs(comparison.shotAccuracy.difference) * 100).toFixed(1)}%`,
          Advantage: comparison.shotAccuracy.advantage === 'teamA' ? filters.teamA : filters.teamB
        },
        {
          Metric: 'Goal Conversion',
          [filters.teamA]: `${(comparison.goalConversion.teamA * 100).toFixed(1)}%`,
          [filters.teamB]: `${(comparison.goalConversion.teamB * 100).toFixed(1)}%`,
          Difference: `${(Math.abs(comparison.goalConversion.difference) * 100).toFixed(1)}%`,
          Advantage: comparison.goalConversion.advantage === 'teamA' ? filters.teamA : filters.teamB
        },
        {
          Metric: 'Average Shot Distance',
          [filters.teamA]: `${comparison.avgDistance.teamA.toFixed(1)}m`,
          [filters.teamB]: `${comparison.avgDistance.teamB.toFixed(1)}m`,
          Difference: `${Math.abs(comparison.avgDistance.difference).toFixed(1)}m`,
          Advantage: comparison.avgDistance.advantage === 'teamA' ? filters.teamA : filters.teamB
        },
        {
          Metric: 'Set Play Efficiency',
          [filters.teamA]: `${(comparison.setPlays.teamA * 100).toFixed(1)}%`,
          [filters.teamB]: `${(comparison.setPlays.teamB * 100).toFixed(1)}%`,
          Difference: `${(Math.abs(comparison.setPlays.difference) * 100).toFixed(1)}%`,
          Advantage: comparison.setPlays.advantage === 'teamA' ? filters.teamA : filters.teamB
        },
        {
          Metric: 'Expected Points (xP)',
          [filters.teamA]: comparison.expectedPoints.teamA.toFixed(2),
          [filters.teamB]: comparison.expectedPoints.teamB.toFixed(2),
          Difference: Math.abs(comparison.expectedPoints.difference).toFixed(2),
          Advantage: comparison.expectedPoints.advantage === 'teamA' ? filters.teamA : filters.teamB
        },
        {
          Metric: 'Total Shots',
          [filters.teamA]: comparison.totalShots.teamA,
          [filters.teamB]: comparison.totalShots.teamB,
          Difference: Math.abs(comparison.totalShots.teamA - comparison.totalShots.teamB),
          Advantage: comparison.totalShots.teamA > comparison.totalShots.teamB ? filters.teamA : filters.teamB
        },
        {
          Metric: 'Successful Shots',
          [filters.teamA]: comparison.successfulShots.teamA,
          [filters.teamB]: comparison.successfulShots.teamB,
          Difference: Math.abs(comparison.successfulShots.teamA - comparison.successfulShots.teamB),
          Advantage: comparison.successfulShots.teamA > comparison.successfulShots.teamB ? filters.teamA : filters.teamB
        }
      ];
      
      // Convert to CSV
      const csv = Papa.unparse(csvData);
      
      // Create a download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'head-to-head-analysis.csv';
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

  // Render team heatmap
  const renderHeatmap = (heatmapData, stageRef, teamColor) => {
    if (!heatmapData) return null;
    
    const pitchWidth = 145 / 2; // Half pitch width
    const pitchHeight = 88;
    const xScale = 3, yScale = 3;
    
    const cells = [];
    
    // Render heatmap cells
    for (let i = 0; i < heatmapData.gridSize; i++) {
      for (let j = 0; j < heatmapData.gridSize; j++) {
        const value = heatmapData.grid[i][j];
        
        if (value > 0) {
          cells.push(
            <Rect
              key={`cell-${i}-${j}`}
              x={j * heatmapData.cellWidth * xScale}
              y={i * heatmapData.cellHeight * yScale}
              width={heatmapData.cellWidth * xScale}
              height={heatmapData.cellHeight * yScale}
              fill={teamColor === 'teamA' ? 
                    `rgba(155, 102, 217, ${value * 0.8})` : 
                    `rgba(255, 121, 198, ${value * 0.8})`}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth={0.5}
            />
          );
        }
      }
    }
    
    // Highlight weak zones if enabled
    if (settingsState.showWeakZones && teamColor === 'teamB') {
      // Find areas with high activity from team A but low from team B
      const oppositeHeatmap = teamColor === 'teamA' ? teamBHeatmap : teamAHeatmap;
      
      if (oppositeHeatmap) {
        for (let i = 0; i < heatmapData.gridSize; i++) {
          for (let j = 0; j < heatmapData.gridSize; j++) {
            const thisValue = heatmapData.grid[i][j];
            const oppositeValue = oppositeHeatmap.grid[i][j];
            
            // If this zone has low activity but opposite team has high activity
            if (thisValue < 0.3 && oppositeValue > 0.6) {
              cells.push(
                <Rect
                  key={`weak-${i}-${j}`}
                  x={j * heatmapData.cellWidth * xScale}
                  y={i * heatmapData.cellHeight * yScale}
                  width={heatmapData.cellWidth * xScale}
                  height={heatmapData.cellHeight * yScale}
                  stroke="#FF5555"
                  strokeWidth={2}
                  dash={[5, 2]}
                />
              );
            }
          }
        }
      }
    }
    
    return (
      <Stage
        width={pitchWidth * xScale}
        height={pitchHeight * yScale}
        ref={stageRef}
      >
        <Layer>
          {/* Pitch background */}
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
            strokeWidth={1}
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
          
          {/* Render the heatmap cells */}
          {cells}
        </Layer>
      </Stage>
    );
  };

  // Render radar chart for team comparison
  const renderRadarChart = () => {
    if (!comparison) return null;
    
    const data = {
      labels: [
        'Shot Accuracy',
        'Goal Conversion',
        'Set Play Efficiency',
        'Shot Quality (xP)',
        'Shot Volume',
        'Close Range Shots'
      ],
      datasets: [
        {
          label: filters.teamA,
          data: [
            comparison.shotAccuracy.teamA * 100,
            comparison.goalConversion.teamA * 100,
            comparison.setPlays.teamA * 100,
            comparison.expectedPoints.teamA * 100,
            // Normalize shot volume (0-100 scale)
            Math.min(100, (comparison.totalShots.teamA / Math.max(1, Math.max(comparison.totalShots.teamA, comparison.totalShots.teamB))) * 100),
            // Close range shot % (inverse of average distance, normalized to 0-100)
            Math.min(100, (40 - comparison.avgDistance.teamA) * 5)
          ],
          backgroundColor: 'rgba(155, 102, 217, 0.2)',
          borderColor: 'rgb(155, 102, 217)',
          pointBackgroundColor: 'rgb(155, 102, 217)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(155, 102, 217)'
        },
        {
          label: filters.teamB,
          data: [
            comparison.shotAccuracy.teamB * 100,
            comparison.goalConversion.teamB * 100,
            comparison.setPlays.teamB * 100,
            comparison.expectedPoints.teamB * 100,
            // Normalize shot volume (0-100 scale)
            Math.min(100, (comparison.totalShots.teamB / Math.max(1, Math.max(comparison.totalShots.teamA, comparison.totalShots.teamB))) * 100),
            // Close range shot % (inverse of average distance, normalized to 0-100)
            Math.min(100, (40 - comparison.avgDistance.teamB) * 5)
          ],
          backgroundColor: 'rgba(255, 121, 198, 0.2)',
          borderColor: 'rgb(255, 121, 198)',
          pointBackgroundColor: 'rgb(255, 121, 198)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(255, 121, 198)'
        }
      ]
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            color: 'rgba(255, 255, 255, 0.2)'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.2)'
          },
          pointLabels: {
            color: '#E6E6FA',
            font: {
              size: 12
            }
          },
          ticks: {
            color: '#9BAACB',
            backdropColor: 'transparent',
            font: {
              size: 10
            }
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#E6E6FA',
            font: {
              size: 12
            }
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
      <div className="ai-radar-chart">
        <h3>Performance Comparison</h3>
        <div className="ai-chart-container">
          <Radar data={data} options={options} height={350} />
        </div>
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
        contentLabel="Head-to-Head Settings"
      >
        <div className="ai-modal-header">
          <h2 className="ai-modal-title">Comparison Settings</h2>
        </div>
        
        <div className="ai-modal-body">
          <div className="ai-settings-group">
            <label className="ai-settings-label">
              Heatmap Grid Size
              <input
                type="range"
                min="6"
                max="12"
                step="2"
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
                checked={settingsState.showWeakZones}
                onChange={e => setSettingsState(prev => ({ ...prev, showWeakZones: e.target.checked }))}
              />
              Highlight Vulnerable Zones
            </label>
          </div>
          
          <div className="ai-settings-group ai-settings-checkbox">
            <label className="ai-settings-label">
              <input
                type="checkbox"
                checked={settingsState.normalizePossession}
                onChange={e => setSettingsState(prev => ({ ...prev, normalizePossession: e.target.checked }))}
              />
              Normalize by Possession (when available)
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

  // Render insights panel
  const renderInsightsPanel = () => {
    if (!insights || !insights.length) return null;
    
    return (
      <div className="ai-insights-panel">
        <div className="ai-insights-header">
          <FaLightbulb className="ai-insights-icon" />
          <h3 className="ai-insights-title">AI-Powered Match Insights</h3>
        </div>
        
        <div className="ai-insights-content">
          {insights.map((insight, i) => (
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
          <p>Loading head-to-head analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-head-to-head-dashboard" ref={contentRef}>
      <div className="ai-section">
        <div className="ai-section-header">
          <h2 className="ai-section-title">
            <FaExchangeAlt /> Head-to-Head Team Analysis
          </h2>
          <div className="ai-section-actions">
            <button 
              className="ai-button" 
              onClick={exportPDF}
              disabled={isDownloading || !comparison}
            >
              <FaDownload /> {isDownloading ? 'Exporting...' : 'Export PDF'}
            </button>
            <button 
              className="ai-button secondary" 
              onClick={exportCSV}
              disabled={!comparison}
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
              value={filters.teamA}
              onChange={e => handleFilterChange('teamA', e.target.value)}
            >
              <option value="">Select Team A</option>
              {filterOptions.teams.map((team, i) => (
                <option key={i} value={team}>{team}</option>
              ))}
            </select>
          </div>
          
          <div className="ai-filter-group">
            <select 
              className="ai-filter-select"
              value={filters.teamB}
              onChange={e => handleFilterChange('teamB', e.target.value)}
            >
              <option value="">Select Team B</option>
              {filterOptions.teams.map((team, i) => (
                <option key={i} value={team}>{team}</option>
              ))}
            </select>
          </div>
        </div>
        
        {comparison ? (
          <>
            <div className="ai-comparison-stats">
              <div className="ai-stats-row">
                <div className="ai-team-stat">
                  <div className="ai-team-name">{filters.teamA}</div>
                  <div className="ai-team-shots">
                    <FaChartBar /> {comparison.totalShots.teamA} Shots
                  </div>
                  <div className="ai-team-accuracy">
                    {(comparison.shotAccuracy.teamA * 100).toFixed(1)}% Accuracy
                  </div>
                </div>
                
                <div className="ai-stats-vs">VS</div>
                
                <div className="ai-team-stat">
                  <div className="ai-team-name">{filters.teamB}</div>
                  <div className="ai-team-shots">
                    <FaChartBar /> {comparison.totalShots.teamB} Shots
                  </div>
                  <div className="ai-team-accuracy">
                    {(comparison.shotAccuracy.teamB * 100).toFixed(1)}% Accuracy
                  </div>
                </div>
              </div>
              
              <div className="ai-comparison-details">
                <div className="ai-compare-item">
                  <div className="ai-compare-label">Goal Conversion</div>
                  <div className="ai-compare-bar">
                    <div 
                      className="ai-team-a-bar"
                      style={{ width: `${comparison.goalConversion.teamA * 100}%` }}
                    >
                      {(comparison.goalConversion.teamA * 100).toFixed(1)}%
                    </div>
                    <div 
                      className="ai-team-b-bar"
                      style={{ width: `${comparison.goalConversion.teamB * 100}%` }}
                    >
                      {(comparison.goalConversion.teamB * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="ai-compare-item">
                  <div className="ai-compare-label">Set Play Efficiency</div>
                  <div className="ai-compare-bar">
                    <div 
                      className="ai-team-a-bar"
                      style={{ width: `${comparison.setPlays.teamA * 100}%` }}
                    >
                      {(comparison.setPlays.teamA * 100).toFixed(1)}%
                    </div>
                    <div 
                      className="ai-team-b-bar"
                      style={{ width: `${comparison.setPlays.teamB * 100}%` }}
                    >
                      {(comparison.setPlays.teamB * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="ai-compare-item">
                  <div className="ai-compare-label">Expected Points (xP)</div>
                  <div className="ai-compare-bar">
                    <div 
                      className="ai-team-a-bar"
                      style={{ width: `${comparison.expectedPoints.teamA * 100}%` }}
                    >
                      {comparison.expectedPoints.teamA.toFixed(2)}
                    </div>
                    <div 
                      className="ai-team-b-bar"
                      style={{ width: `${comparison.expectedPoints.teamB * 100}%` }}
                    >
                      {comparison.expectedPoints.teamB.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="ai-comparison-grids">
              <div className="ai-heatmap-wrapper">
                <h3>{filters.teamA} Shot Heatmap</h3>
                {teamAHeatmap ? 
                  renderHeatmap(teamAHeatmap, teamARef, 'teamA') : 
                  <div className="ai-no-data">No shot data available</div>
                }
              </div>
              
              <div className="ai-heatmap-wrapper">
                <h3>{filters.teamB} Shot Heatmap</h3>
                {teamBHeatmap ? 
                  renderHeatmap(teamBHeatmap, teamBRef, 'teamB') : 
                  <div className="ai-no-data">No shot data available</div>
                }
              </div>
            </div>
            
            <div className="ai-comparison-details-row">
              <div className="ai-radar-chart-wrapper">
                {renderRadarChart()}
              </div>
              
              <div className="ai-insights-wrapper">
                {renderInsightsPanel()}
              </div>
            </div>
          </>
        ) : (
          <div className="ai-no-comparison">
            <p>Select two teams to view head-to-head analysis.</p>
          </div>
        )}
      </div>
      
      {renderSettingsModal()}
    </div>
  );
};

export default AIGAAHeadToHead;