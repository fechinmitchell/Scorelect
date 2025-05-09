// AIGAADefending.js - AI-Enhanced Defensive Analysis Tab
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaShieldAlt, FaDownload, FaCog, FaLightbulb, FaFilter, FaFileDownload } from 'react-icons/fa';
import { BiShield, BiX, BiAlarm } from 'react-icons/bi';
import { Stage, Layer, Rect, Circle, Text, Line } from 'react-konva';
import * as d3 from 'd3';
import Modal from 'react-modal';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../AuthContext';
import { jsPDF } from "jspdf";
import Papa from 'papaparse';
import { translateShotToOneSide } from '../components/GAAPitchComponents';

// Environment-based API URL
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Utility function to flatten shots array
const flattenShots = (games = []) => {
  return games.flatMap(g => g.gameData || []);
};

// Calculate defensive heatmap data
const calculateDefensiveHeatmap = (shots, gridSize = 8) => {
  const pitchWidth = 145 / 2; // Half pitch width
  const pitchHeight = 88;
  
  // Initialize grid with zeros
  const cellWidth = pitchWidth / gridSize;
  const cellHeight = pitchHeight / gridSize;
  
  let grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
  let blockedGrid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
  
  // Only use opponent shots
  shots.forEach(shot => {
    const x = parseFloat(shot.x) || 0;
    const y = parseFloat(shot.y) || 0;
    
    // Ensure the shot is on the left half of the pitch
    if (x <= pitchWidth) {
      const gridX = Math.min(gridSize - 1, Math.floor(x / cellWidth));
      const gridY = Math.min(gridSize - 1, Math.floor(y / cellHeight));
      
      grid[gridY][gridX]++;
      
      // Check if shot was blocked
      const action = (shot.action || '').toLowerCase().trim();
      if (action === 'blocked' || action.includes('block')) {
        blockedGrid[gridY][gridX]++;
      }
    }
  });
  
  // Normalize the grid values between 0 and 1
  const maxValue = Math.max(...grid.flat());
  const normalizedGrid = grid.map(row => 
    row.map(cell => maxValue > 0 ? cell / maxValue : 0)
  );
  
  // Normalize the blocked grid
  const normalizedBlockedGrid = blockedGrid.map((row, i) => 
    row.map((cell, j) => grid[i][j] > 0 ? cell / grid[i][j] : 0)
  );
  
  // Add zoneInfo for click handlers
  const zoneData = [];
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const value = normalizedGrid[i][j];
      const blockedRate = normalizedBlockedGrid[i][j];
      const rawCount = grid[i][j];
      const blockedCount = blockedGrid[i][j];
      
      const shotsInZone = shots.filter(shot => {
        const x = parseFloat(shot.x) || 0;
        const y = parseFloat(shot.y) || 0;
        const gridX = Math.min(gridSize - 1, Math.floor(x / cellWidth));
        const gridY = Math.min(gridSize - 1, Math.floor(y / cellHeight));
        return gridX === j && gridY === i;
      });
      
      // Calculate missed shots in this zone
      const missedInZone = shotsInZone.filter(s => {
        const action = (s.action || '').toLowerCase().trim();
        return action.includes('miss') || action.includes('wide') || action.includes('block') || action === 'short';
      }).length;
      
      zoneData.push({
        x: j * cellWidth,
        y: i * cellHeight,
        width: cellWidth,
        height: cellHeight,
        value: value,
        count: rawCount,
        blockedCount: blockedCount,
        blockedRate: blockedRate,
        missedCount: missedInZone,
        missRate: shotsInZone.length > 0 ? missedInZone / shotsInZone.length : 0,
        shots: shotsInZone
      });
    }
  }
  
  return {
    zoneData,
    gridSize,
    cellWidth,
    cellHeight
  };
};

// Generate defensive insights
const generateDefensiveInsights = (shots, zoneData, team) => {
  if (!shots || !shots.length || !zoneData || !zoneData.length) {
    return {
      vulnerableZones: [],
      defensiveInsights: [{ 
        title: "Insufficient Data", 
        description: "Add more shot data for AI-powered insights." 
      }]
    };
  }
  
  // Find most vulnerable zones (highest shot density, lowest blocked rate)
  const vulnerableZones = zoneData
    .filter(zone => zone.count >= 3)
    .sort((a, b) => {
      // First by shot density, then by inverse of blocked rate
      if (b.value !== a.value) return b.value - a.value;
      return a.blockedRate - b.blockedRate;
    })
    .slice(0, 3)
    .map(zone => ({
      ...zone,
      vulnerability: zone.blockedRate < 0.3 ? 'High' : zone.blockedRate < 0.6 ? 'Medium' : 'Low',
      recommendation: `This zone has ${zone.count} opponent shots with only ${zone.blockedCount} blocked.`
    }));
  
  // Defensive insights
  let defensiveInsights = [];
  
  // Overall defensive effectiveness
  const totalShots = shots.length;
  const blockedShots = shots.filter(s => {
    const action = (s.action || '').toLowerCase().trim();
    return action === 'blocked' || action.includes('block');
  }).length;
  
  const missedShots = shots.filter(s => {
    const action = (s.action || '').toLowerCase().trim();
    return action.includes('miss') || action.includes('wide') || action === 'short';
  }).length;
  
  const successfulShots = totalShots - blockedShots - missedShots;
  const defensiveEffectiveness = (blockedShots + missedShots) / Math.max(1, totalShots);
  
  defensiveInsights.push({
    title: `Overall Defense: ${(defensiveEffectiveness * 100).toFixed(0)}% Effective`,
    description: `${team || 'Defense'} prevented ${blockedShots + missedShots} from ${totalShots} total shots (${blockedShots} blocked, ${missedShots} missed).`
  });
  
  // Shot distance analysis
  const distanceGroups = {
    close: { total: 0, prevented: 0 },
    medium: { total: 0, prevented: 0 },
    far: { total: 0, prevented: 0 }
  };
  
  shots.forEach(shot => {
    const dist = shot.distMeters || 0;
    const action = (shot.action || '').toLowerCase().trim();
    const isPrevented = action === 'blocked' || action.includes('block') || action.includes('miss') || action.includes('wide') || action === 'short';
    
    if (dist < 20) {
      distanceGroups.close.total++;
      if (isPrevented) distanceGroups.close.prevented++;
    } else if (dist < 35) {
      distanceGroups.medium.total++;
      if (isPrevented) distanceGroups.medium.prevented++;
    } else {
      distanceGroups.far.total++;
      if (isPrevented) distanceGroups.far.prevented++;
    }
  });
  
  // Find most vulnerable distance
  const vulnerableDist = Object.entries(distanceGroups)
    .filter(([_, data]) => data.total >= 3)
    .sort(([_, a], [__, b]) => 
      (a.prevented / a.total) - (b.prevented / b.total)
    )[0];
  
  if (vulnerableDist) {
    const [range, data] = vulnerableDist;
    const preventionRate = data.total > 0 ? data.prevented / data.total : 0;
    
    defensiveInsights.push({
      title: `Vulnerable Distance: ${range === 'close' ? 'Under 20m' : range === 'medium' ? '20-35m' : 'Over 35m'}`,
      description: `Only ${(preventionRate * 100).toFixed(0)}% prevention rate from ${data.total} shots at this distance. Focus defensive efforts here.`
    });
  }
  
  // Time-based defensive analysis
  const timeGroups = {
    early: { total: 0, prevented: 0 }, // 0-30
    middle: { total: 0, prevented: 0 }, // 31-60
    late: { total: 0, prevented: 0 }  // 61+
  };
  
  shots.forEach(shot => {
    const minute = parseInt(shot.minute) || 0;
    const action = (shot.action || '').toLowerCase().trim();
    const isPrevented = action === 'blocked' || action.includes('block') || action.includes('miss') || action.includes('wide') || action === 'short';
    
    if (minute <= 30) {
      timeGroups.early.total++;
      if (isPrevented) timeGroups.early.prevented++;
    } else if (minute <= 60) {
      timeGroups.middle.total++;
      if (isPrevented) timeGroups.middle.prevented++;
    } else {
      timeGroups.late.total++;
      if (isPrevented) timeGroups.late.prevented++;
    }
  });
  
  // Find weakest time period
  const weakestPeriod = Object.entries(timeGroups)
    .filter(([_, data]) => data.total >= 3)
    .sort(([_, a], [__, b]) => 
      (a.prevented / a.total) - (b.prevented / b.total)
    )[0];
  
  if (weakestPeriod) {
    const [period, data] = weakestPeriod;
    const preventionRate = data.total > 0 ? data.prevented / data.total : 0;
    
    defensiveInsights.push({
      title: `Defensive Fade: ${period === 'early' ? 'First 30 Min' : period === 'middle' ? '31-60 Min' : 'Last 30 Min'}`,
      description: `Defense is weakest during this period with only ${(preventionRate * 100).toFixed(0)}% prevention rate from ${data.total} shots.`
    });
  }
  
  // Identify best defensive players
  const defenders = {};
  shots.forEach(shot => {
    const action = (shot.action || '').toLowerCase().trim();
    if (action === 'blocked' || action.includes('block')) {
      // Extract the defender from the note if available
      const note = (shot.note || '').toLowerCase();
      const defenderMatch = note.match(/blocked by ([a-z\s]+)/i);
      
      if (defenderMatch && defenderMatch[1]) {
        const defender = defenderMatch[1].trim();
        defenders[defender] = (defenders[defender] || 0) + 1;
      }
    }
  });
  
  // Get top defenders
  const topDefenders = Object.entries(defenders)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 2);
  
  if (topDefenders.length > 0) {
    const topDefendersList = topDefenders
      .map(([name, blocks]) => `${name} (${blocks} blocks)`)
      .join(', ');
    
    defensiveInsights.push({
      title: 'Top Defenders',
      description: `${topDefendersList} - These players are most effective at blocking opponent shots.`
    });
  }
  
  return {
    vulnerableZones,
    defensiveInsights: defensiveInsights.slice(0, 4) // Limit to 4 insights
  };
};

// Get defensive heatmap color
const getDefensiveColor = (value) => {
  // Red for high density (opponent shooting areas)
  const colorScale = d3.scaleSequential(d3.interpolateReds)
    .domain([0, 1]);
  return colorScale(value);
};

// Main component
const AIGAADefending = ({ data, refreshKey, datasets }) => {
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
      showVulnerableZones: true,
      gridSize: 8,
      showLabels: true,
      showBlockedOverlay: true
    });
    const [insights, setInsights] = useState({
      vulnerableZones: [],
      defensiveInsights: []
    });
    const [selectedTeam, setSelectedTeam] = useState('');
  
    // Pitch constants
    const pitchWidth = 145 / 2; // Half pitch (defending half)
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
            
            // Process each shot to ensure it has needed properties
            game.gameData = game.gameData.map(shot => {
              const translatedShot = translateShotToOneSide(shot, pitchWidth, pitchWidth * 2, pitchHeight / 2);
              
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
          
          // Set default team if available
          if (t.size > 0) {
            setSelectedTeam(Array.from(t)[0]);
          }
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
        // Get opponent shots (not by selected team)
        const opponentShots = selectedTeam 
          ? filteredShots.filter(shot => shot.team !== selectedTeam)
          : filteredShots;
        
        const zoneInfo = calculateDefensiveHeatmap(opponentShots, gridSize);
        setHeatmapData(zoneInfo);
        
        // Generate defensive insights
        const defInsights = generateDefensiveInsights(opponentShots, zoneInfo.zoneData, selectedTeam);
        setInsights(defInsights);
      } else {
        setHeatmapData({ zoneData: [] });
        setInsights({
          vulnerableZones: [],
          defensiveInsights: [{ 
            title: "No Data Available", 
            description: "Apply different filters to view defensive analysis." 
          }]
        });
      }
    }, [filteredShots, gridSize, selectedTeam]);
  
    // Apply filters
    const handleFilterChange = (field, value) => {
      setFilters(prev => ({ ...prev, [field]: value }));
      
      // Update selected team if team filter changes
      if (field === 'team') {
        setSelectedTeam(value);
      }
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
        pdf.text('Defensive Analysis Dashboard', width / 2, 20, { align: 'center' });
        
        // Add team info
        pdf.setTextColor(255, 121, 198); // Pink
        pdf.setFontSize(16);
        pdf.text(`Team: ${selectedTeam || 'All Teams'}`, width / 2, 30, { align: 'center' });
        
        // Add heatmap image
        pdf.addImage(stageImage, 'PNG', 10, 40, width - 20, height / 2);
        
        // Add insights
        pdf.setTextColor(230, 230, 250); // Light color
        pdf.setFontSize(14);
        pdf.text('Defensive Insights', 15, height / 2 + 40);
        
        pdf.setFontSize(10);
        let yPos = height / 2 + 50;
        
        insights.defensiveInsights.forEach(insight => {
          pdf.setTextColor(255, 121, 198); // Pink
          pdf.text(insight.title, 15, yPos);
          yPos += 5;
          
          pdf.setTextColor(230, 230, 250);
          pdf.text(insight.description, 15, yPos, {
            maxWidth: width - 30
          });
          yPos += 10;
        });
        
        // Add vulnerable zones
        if (insights.vulnerableZones.length > 0) {
          yPos += 5;
          pdf.setTextColor(230, 230, 250);
          pdf.setFontSize(14);
          pdf.text('Vulnerable Zones', 15, yPos);
          yPos += 10;
          
          pdf.setFontSize(10);
          insights.vulnerableZones.forEach((zone, index) => {
            pdf.setTextColor(255, 85, 85); // Red
            pdf.text(`Zone ${index + 1}: ${zone.count} shots, ${zone.blockedCount} blocked (${(zone.blockedRate * 100).toFixed(0)}%)`, 15, yPos);
            yPos += 8;
          });
        }
        
        // Add footer
        pdf.setTextColor(155, 102, 217); // Purple
        pdf.setFontSize(8);
        pdf.text('Generated by Scorelect AI Analytics', width - 15, height - 10, { align: 'right' });
        
        // Save the PDF
        pdf.save('defensive-analysis.pdf');
        
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
        
        // Get opponent shots (not by selected team)
        const opponentShots = selectedTeam 
          ? filteredShots.filter(shot => shot.team !== selectedTeam)
          : filteredShots;
        
        // Prepare data for CSV
        const csvData = opponentShots.map(shot => ({
          Team: shot.team || '',
          Player: shot.playerName || '',
          Action: shot.action || '',
          X: shot.x || 0,
          Y: shot.y || 0,
          Distance: shot.distMeters?.toFixed(2) || 0,
          Minute: shot.minute || '',
          Blocked: ['blocked', 'block'].includes((shot.action || '').toLowerCase()) ? 'Yes' : 'No',
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
        link.download = 'defensive-analysis.csv';
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
              fill={getDefensiveColor(zone.value)}
              opacity={0.7}
              stroke="#000"
              strokeWidth={0.5}
              onClick={() => handleZoneClick(zone)}
              onTap={() => handleZoneClick(zone)}
            />
          ))}
          
          {/* Render vulnerable zones if enabled */}
          {settingsState.showVulnerableZones && insights.vulnerableZones.map((zone, i) => (
            <Rect
              key={`vulnerable-${i}`}
              x={zone.x * xScale}
              y={zone.y * yScale}
              width={zone.width * xScale}
              height={zone.height * yScale}
              stroke="#FF5555"
              strokeWidth={3}
              dash={[5, 2]}
            />
          ))}
          
          {/* Render blocked overlay if enabled */}
          {settingsState.showBlockedOverlay && heatmapData.zoneData
            .filter(zone => zone.blockedCount > 0)
            .map((zone, i) => (
            <Circle
              key={`blocked-${i}`}
              x={(zone.x + zone.width / 2) * xScale}
              y={(zone.y + zone.height / 2) * yScale}
              radius={10 * zone.blockedRate + 5}
              stroke="#50FA7B"
              strokeWidth={2}
              dash={[2, 2]}
              opacity={0.7}
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
        </Layer>
      );
    };
  
    // Defensive statistics summary
    const renderDefensiveStats = () => {
      if (!filteredShots.length) return null;
      
      // Get opponent shots (not by selected team)
      const opponentShots = selectedTeam 
        ? filteredShots.filter(shot => shot.team !== selectedTeam)
        : filteredShots;
      
      const totalShots = opponentShots.length;
      const blockedShots = opponentShots.filter(s => 
        ['blocked', 'block'].includes((s.action || '').toLowerCase().trim())
      ).length;
      
      const missedShots = opponentShots.filter(s => {
        const action = (s.action || '').toLowerCase().trim();
        return action.includes('miss') || action.includes('wide') || action === 'short';
      }).length;
      
      const successfulShots = totalShots - blockedShots - missedShots;
      const preventionRate = (blockedShots + missedShots) / Math.max(1, totalShots);
      
      return (
        <div className="ai-stats-grid">
          <div className="ai-stat-card">
            <div className="ai-stat-title">Opponent Shots</div>
            <div className="ai-stat-value">{totalShots}</div>
          </div>
          
          <div className="ai-stat-card">
            <div className="ai-stat-title">Blocked Shots</div>
            <div className="ai-stat-value">{blockedShots}</div>
            <div className="ai-stat-trend">
              <span className="ai-trend-positive">{(blockedShots / totalShots * 100).toFixed(1)}% of total</span>
            </div>
          </div>
          
          <div className="ai-stat-card">
            <div className="ai-stat-title">Missed Shots</div>
            <div className="ai-stat-value">{missedShots}</div>
            <div className="ai-stat-trend">
              <span className="ai-trend-positive">{(missedShots / totalShots * 100).toFixed(1)}% of total</span>
            </div>
          </div>
          
          <div className="ai-stat-card">
            <div className="ai-stat-title">Prevention Rate</div>
            <div className="ai-stat-value">{(preventionRate * 100).toFixed(1)}%</div>
            <div className="ai-stat-trend">
              <span className={preventionRate > 0.7 ? "ai-trend-positive" : "ai-trend-negative"}>
                {preventionRate > 0.7 ? "Strong Defense" : "Needs Improvement"}
              </span>
            </div>
          </div>
          
          <div className="ai-stat-card">
            <div className="ai-stat-title">Goals Conceded</div>
            <div className="ai-stat-value">{
              opponentShots.filter(s => 
                (s.action || '').toLowerCase().includes('goal')
              ).length
            }</div>
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
            <h2 className="ai-modal-title">Defensive Zone Analysis</h2>
          </div>
          
          <div className="ai-modal-body">
            <div className="ai-zone-stats">
              <div className="ai-zone-stat-row">
                <span className="ai-zone-stat-label">Opponent Shots:</span>
                <span className="ai-zone-stat-value">{selectedZone.count}</span>
              </div>
              
              <div className="ai-zone-stat-row">
                <span className="ai-zone-stat-label">Blocked Shots:</span>
                <span className="ai-zone-stat-value">{selectedZone.blockedCount}</span>
              </div>
              
              <div className="ai-zone-stat-row">
                <span className="ai-zone-stat-label">Missed Shots:</span>
                <span className="ai-zone-stat-value">{selectedZone.missedCount}</span>
              </div>
              
              <div className="ai-zone-stat-row">
                <span className="ai-zone-stat-label">Block Rate:</span>
                <span className="ai-zone-stat-value">{(selectedZone.blockedRate * 100).toFixed(1)}%</span>
              </div>
              
              <div className="ai-zone-stat-row">
                <span className="ai-zone-stat-label">Miss Rate:</span>
                <span className="ai-zone-stat-value">{(selectedZone.missRate * 100).toFixed(1)}%</span>
              </div>
              
              <div className="ai-zone-stat-row">
                <span className="ai-zone-stat-label">Prevention Rate:</span>
                <span className="ai-zone-stat-value">{((selectedZone.blockedRate + selectedZone.missRate) * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            <h3 className="ai-section-subtitle">Shots in this Zone</h3>
            <div className="ai-zone-shots-list">
              {selectedZone.shots.length > 0 ? (
                <table className="ai-zone-shots-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Player</th>
                      <th>Action</th>
                      <th>Minute</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedZone.shots.map((shot, i) => (
                      <tr key={i}>
                        <td>{shot.team || 'Unknown'}</td>
                        <td>{shot.playerName || 'Unknown'}</td>
                        <td>{shot.action || 'Unknown'}</td>
                        <td>{shot.minute || 'N/A'}</td>
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
                    <strong>Vulnerability:</strong> {
                      selectedZone.blockedRate < 0.3 
                        ? 'High' 
                        : selectedZone.blockedRate < 0.6 
                          ? 'Medium' 
                          : 'Low'
                    }
                  </p>
                  <p>
                    <strong>Recommendation:</strong> {
                      selectedZone.blockedRate < 0.3 
                        ? `This is a high-risk zone with ${selectedZone.count} opponent shots and only ${selectedZone.blockedCount} blocked. Strengthen defensive coverage here.`
                        : selectedZone.blockedRate < 0.6
                          ? `This zone has moderate defensive coverage with ${selectedZone.blockedCount} blocked from ${selectedZone.count} shots. Continue to improve positioning.`
                          : `Good defensive coverage in this zone. ${selectedZone.blockedCount} blocked from ${selectedZone.count} shots.`
                    }
                  </p>
                  <p>
                    <strong>Shot Pattern:</strong> {
                      selectedZone.shots.length > 0
                        ? `Most shots from this zone come in the ${
                            (() => {
                              const minutes = selectedZone.shots.map(s => parseInt(s.minute) || 0);
                              const avgMinute = minutes.reduce((acc, min) => acc + min, 0) / minutes.length;
                              return avgMinute <= 20 
                                ? 'early game' 
                                : avgMinute <= 50 
                                  ? 'middle of the game' 
                                  : 'late game';
                            })()
                          }.`
                        : 'No pattern detected.'
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
            <h2 className="ai-modal-title">Defensive Heatmap Settings</h2>
          </div>
          
          <div className="ai-modal-body">
            <div className="ai-settings-group">
              <label className="ai-settings-label">
                Grid Size
                <input
                  type="range"
                  min="4"
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
                  checked={settingsState.showVulnerableZones}
                  onChange={e => setSettingsState(prev => ({ ...prev, showVulnerableZones: e.target.checked }))}
                />
                Highlight Vulnerable Zones
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
                  checked={settingsState.showBlockedOverlay}
                  onChange={e => setSettingsState(prev => ({ ...prev, showBlockedOverlay: e.target.checked }))}
                />
                Show Blocked Shot Indicators
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
            <h3 className="ai-insights-title">Defensive Insights</h3>
          </div>
          
          <div className="ai-insights-content">
            {insights.defensiveInsights.map((insight, i) => (
              <div className="ai-insight-item" key={i}>
                <div className="ai-insight-icon">
                  {i === 0 ? <BiShield /> : i === 1 ? <BiX /> : <BiAlarm />}
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
            <p>Loading defensive analysis...</p>
          </div>
        </div>
      );
    }
  
    return (
      <div className="ai-defending-dashboard" ref={contentRef}>
        <div className="ai-section">
          <div className="ai-section-header">
            <h2 className="ai-section-title">
              <FaShieldAlt /> Defensive Heatmap Analysis
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
                <option value="">Select Your Team</option>
                {filterOptions.teams.map((team, i) => (
                  <option key={i} value={team}>{team}</option>
                ))}
              </select>
            </div>
          </div>
          
          {renderDefensiveStats()}
          
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
              <div className="ai-legend-color" style={{ background: getDefensiveColor(1) }}></div>
              <span>High Shot Density</span>
            </div>
            <div className="ai-legend-item">
              <div className="ai-legend-color" style={{ background: getDefensiveColor(0.5) }}></div>
              <span>Medium Shot Density</span>
            </div>
            <div className="ai-legend-item">
              <div className="ai-legend-color" style={{ background: getDefensiveColor(0) }}></div>
              <span>Low Shot Density</span>
            </div>
            {settingsState.showBlockedOverlay && (
              <div className="ai-legend-item">
                <div className="ai-legend-border" style={{ borderColor: "#50FA7B", borderStyle: "dashed", borderRadius: "50%" }}></div>
                <span>Blocked Shots</span>
              </div>
            )}
            {settingsState.showVulnerableZones && (
              <div className="ai-legend-item">
                <div className="ai-legend-border" style={{ borderColor: "#FF5555", borderStyle: "dashed" }}></div>
                <span>Vulnerable Zone</span>
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

export default AIGAADefending;