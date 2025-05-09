// AIGAATactics.js - AI-Enhanced Tactical Analysis Tab
import React, { useState, useEffect, useRef } from 'react';
import { FaChessBoard, FaDownload, FaSync, FaFilter, FaExternalLinkAlt, FaMagic, FaRegClipboard } from 'react-icons/fa';
import { Stage, Layer, Rect, Circle, Line, Arrow, Text } from 'react-konva';
import Modal from 'react-modal';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../AuthContext';
import { jsPDF } from "jspdf";

// Environment-based API URL
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Utility function to flatten shots array
const flattenShots = (games = []) => {
  return games.flatMap(g => g.gameData || []);
};

// Team colors
const teamColors = {
  default: { primary: '#733FAA', secondary: '#9B66D9' }
};

// Pitch constants
const pitchWidth = 145;
const pitchHeight = 88;
const xScale = 3, yScale = 3;

// Main component
const AIGAATactics = ({ data, refreshKey, datasets }) => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [shotData, setShotData] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    matches: [], teams: [], players: []
  });
  const [filters, setFilters] = useState({
    match: '',
    team: ''
  });
  const [teamData, setTeamData] = useState({});
  const [tacticalAnalysis, setTacticalAnalysis] = useState(null);
  const [formationData, setFormationData] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [tacticalReport, setTacticalReport] = useState(null);
  const [isWebDataModalOpen, setIsWebDataModalOpen] = useState(false);
  const [webDataUrl, setWebDataUrl] = useState('');
  const [webDataResult, setWebDataResult] = useState('');

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
        // Extract all shots
        const allShots = flattenShots(data.games);
        setShotData(allShots);
        
        // Extract filter options
        const m = new Set(), t = new Set(), p = new Set();
        data.games.forEach(g => {
          g.match && m.add(g.match);
          (g.gameData || []).forEach(sh => {
            sh.team && t.add(sh.team);
            sh.playerName && p.add(sh.playerName);
          });
        });
        
        setFilterOptions({
          matches: Array.from(m),
          teams: Array.from(t),
          players: Array.from(p)
        });
        
        // Calculate team data
        if (t.size > 0) {
          const teams = Array.from(t);
          const teamStats = {};
          
          teams.forEach(team => {
            const teamShots = allShots.filter(s => s.team === team);
            
            // Basic team stats
            teamStats[team] = {
              totalShots: teamShots.length,
              goals: teamShots.filter(s => (s.action || '').toLowerCase().includes('goal')).length,
              points: teamShots.filter(s => (s.action || '').toLowerCase() === 'point').length,
              setplays: teamShots.filter(s => ['free', 'offensive mark', 'fortyfive'].some(sp => 
                (s.action || '').toLowerCase().includes(sp))).length,
              playerPositions: {},
              formation: '3-3-2-6', // Default formation
              style: 'balanced', // Default style
            };
            
            // Player positions
            teamShots.forEach(shot => {
              if (shot.playerName && shot.position) {
                if (!teamStats[team].playerPositions[shot.playerName]) {
                  teamStats[team].playerPositions[shot.playerName] = {
                    position: shot.position,
                    count: 1
                  };
                } else {
                  teamStats[team].playerPositions[shot.playerName].count++;
                }
              }
            });
          });
          
          setTeamData(teamStats);
          
          // Set default team if not already set
          if (!filters.team && teams.length > 0) {
            setFilters(prev => ({ ...prev, team: teams[0] }));
          }
        }
      } catch (error) {
        console.error('Error processing data:', error);
        Swal.fire({
          title: 'Data Processing Error',
          text: 'Failed to process tactical data.',
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

  // Generate tactical analysis when team changes
  useEffect(() => {
    if (filters.team && teamData[filters.team]) {
      generateFormationData(filters.team);
    }
  }, [filters.team, teamData]);

  // Generate formation data based on team stats
  const generateFormationData = (team) => {
    if (!teamData[team]) return;
    
    // Start with empty formation
    const formationPlayers = [];
    
    // Extract player positions
    const positions = teamData[team].playerPositions;
    
    // Get assigned positions (for players with position data)
    const playersByPosition = {};
    Object.entries(positions).forEach(([player, data]) => {
      const pos = (data.position || '').toLowerCase();
      if (!playersByPosition[pos]) {
        playersByPosition[pos] = [];
      }
      playersByPosition[pos].push({
        name: player,
        count: data.count
      });
    });
    
    // Sort players in each position by shot count
    Object.keys(playersByPosition).forEach(pos => {
      playersByPosition[pos].sort((a, b) => b.count - a.count);
    });
    
    // Determine formation based on available positions
    let formation = '3-3-2-6'; // Default
    
    if (playersByPosition['defender'] && playersByPosition['defender'].length >= 4) {
      formation = '4-3-3-4';
    } else if (playersByPosition['midfielder'] && playersByPosition['midfielder'].length >= 4) {
      formation = '3-4-3-4';
    } else if (playersByPosition['forward'] && playersByPosition['forward'].length >= 7) {
      formation = '3-2-1-8';
    }
    
    // Parse formation
    const formationParts = formation.split('-').map(Number);
    
    // Set formation style based on shot patterns
    let style = 'balanced';
    const teamShots = shotData.filter(s => s.team === team);
    const leftShots = teamShots.filter(s => (s.x || 0) < pitchWidth / 3).length;
    const centerShots = teamShots.filter(s => (s.x || 0) >= pitchWidth / 3 && (s.x || 0) <= 2 * pitchWidth / 3).length;
    const rightShots = teamShots.filter(s => (s.x || 0) > 2 * pitchWidth / 3).length;
    
    const totalShots = leftShots + centerShots + rightShots;
    if (totalShots > 0) {
      const leftPercent = leftShots / totalShots;
      const centerPercent = centerShots / totalShots;
      const rightPercent = rightShots / totalShots;
      
      if (centerPercent > 0.5) {
        style = 'direct';
      } else if (leftPercent > 0.4 || rightPercent > 0.4) {
        style = 'wing-play';
      } else if (Math.abs(leftPercent - rightPercent) < 0.1) {
        style = 'balanced';
      }
    }
    
    setFormationData({
      formation: formation,
      style: style,
      players: formationPlayers
    });
    
    // Generate tactical analysis text
    generateTacticalAnalysis(team, formation, style);
  };

  // Generate tactical analysis with OpenAI API
  const generateTacticalAnalysis = async (team, formation, style) => {
    if (!team) return;
    
    setIsGeneratingAnalysis(true);
    
    try {
      const teamStats = teamData[team];
      
      // First check if we have a cached analysis
      if (tacticalAnalysis && tacticalAnalysis.team === team) {
        setIsGeneratingAnalysis(false);
        return;
      }
      
      // For demo purposes, generate a descriptive analysis locally
      // In a real app, this would be an API call to OpenAI
      
      // Generate formation description
      const formationDesc = {
        '3-3-2-6': 'a 3-3-2-6 formation with three defensive backs, three half-backs, two midfielders, and six forwards',
        '4-3-3-4': 'a 4-3-3-4 formation with a strong defensive line of four, three half-backs, three midfielders, and four forwards',
        '3-4-3-4': 'a 3-4-3-4 formation with three backs, a strong midfield of four, three half-forwards, and four full-forwards',
        '3-2-1-8': 'an attacking 3-2-1-8 formation with three backs, two midfielders, one center half-forward, and eight forwards'
      }[formation] || 'a traditional GAA formation';
      
      // Generate style description
      const styleDesc = {
        'direct': 'a direct, central playing style that focuses on quick movement through the center of the pitch',
        'wing-play': 'a wing-focused approach that utilizes the width of the pitch to create scoring opportunities',
        'balanced': 'a balanced approach that distributes play across the pitch'
      }[style] || 'a balanced playing style';
      
      // Team strengths based on stats
      let strengths = [];
      if (teamStats.goals > 5) {
        strengths.push('goal-scoring ability');
      }
      if (teamStats.points > 15) {
        strengths.push('consistent point-taking');
      }
      if (teamStats.setplays > 10) {
        strengths.push('set-piece execution');
      }
      
      if (strengths.length === 0) {
        strengths.push('balanced attacking approach');
      }
      
      const strengthsText = strengths.join(', ');
      
      // Generate tactical analysis
      const analysis = {
        team: team,
        formation: formation,
        style: style,
        overview: `${team} employs ${formationDesc} with ${styleDesc}. Their key strengths include ${strengthsText}.`,
        strengths: [
          `Formation: ${formation} provides good structure and balance across the pitch.`,
          `Playing Style: ${style === 'direct' ? 'Direct central play creates high-percentage scoring opportunities.' : 
                            style === 'wing-play' ? 'Wing play stretches defenses and creates space for forwards.' : 
                            'Balanced approach makes the team less predictable.'}`,
          `Attacking: The team has demonstrated ${teamStats.goals > 5 ? 'excellent goal-scoring ability' : 'good point-taking ability'}.`
        ],
        weaknesses: [
          `Defensive Cover: The ${formation.split('-')[0]}-player defensive line might be vulnerable against teams with strong forward lines.`,
          `Midfield Battles: With ${formation.split('-')[2]} midfielders, contested possession could be challenging.`,
          `Counter-Attack: ${style === 'direct' ? 'Direct play can leave the team vulnerable to counter-attacks when possession is lost.' : 
                              style === 'wing-play' ? 'Wing play sometimes results in crosses being intercepted, leading to counter-attacks.' : 
                              'Balanced approach sometimes lacks the penetration needed against packed defenses.'}`
        ],
        recommendations: [
          `Defensive Positioning: Ensure defenders maintain disciplined positioning, especially during opposition counter-attacks.`,
          `Set Piece Strategy: Develop more varied set-piece routines to capitalize on ${teamStats.setplays > 10 ? 'proven set-piece ability' : 'scoring opportunities'}.`,
          `Tactical Flexibility: Consider adjusting the ${formation} formation against teams with particularly strong ${formation.split('-')[2] > 3 ? 'forward lines' : 'midfields'}.`
        ]
      };
      
      setTacticalAnalysis(analysis);
      
      // Generate tactical report
      generateTacticalReport(team, analysis);
    } catch (error) {
      console.error('Error generating tactical analysis:', error);
      Swal.fire({
        title: 'Analysis Generation Error',
        text: 'Failed to generate tactical analysis.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  // Generate a formatted tactical report
  const generateTacticalReport = (team, analysis) => {
    if (!team || !analysis) return;
    
    const report = {
      title: `${team} Tactical Analysis Report`,
      date: new Date().toLocaleDateString(),
      sections: [
        {
          title: 'Formation and Style Overview',
          content: analysis.overview
        },
        {
          title: 'Team Strengths',
          content: analysis.strengths.join('\n\n')
        },
        {
          title: 'Areas for Improvement',
          content: analysis.weaknesses.join('\n\n')
        },
        {
          title: 'Tactical Recommendations',
          content: analysis.recommendations.join('\n\n')
        }
      ]
    };
    
    setTacticalReport(report);
  };

  // Handle web data scraping for additional team info
  const scrapeWebData = async () => {
    if (!webDataUrl) {
      Swal.fire({
        title: 'URL Required',
        text: 'Please enter a valid URL to scrape team data.',
        icon: 'warning',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
      return;
    }
    
    setIsGeneratingAnalysis(true);
    
    try {
      // In a real app, this would call your backend to scrape data
      // Simulating with a timeout
      setTimeout(() => {
        const team = filters.team || 'Selected Team';
        
        // Simulate scraped data
        setWebDataResult(`
          ## Web Data for ${team}
          
          **Recent Results:**
          - Win vs. Team A (2-15 to 1-12)
          - Loss vs. Team B (0-10 to 1-15)
          - Win vs. Team C (3-12 to 2-8)
          
          **Key Players:**
          - Player 1: Averaging 0-5 per game
          - Player 2: 3 goals in last 4 matches
          - Player 3: Strong defensive performances
          
          **Tactical Notes:**
          - Primarily uses ${formationData.formation} formation
          - Strong on counter-attacks
          - Vulnerable when pressed high
        `);
        
        setIsGeneratingAnalysis(false);
      }, 2000);
    } catch (error) {
      console.error('Web scraping error:', error);
      Swal.fire({
        title: 'Data Scraping Error',
        text: 'Failed to scrape web data.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
      setIsGeneratingAnalysis(false);
    }
  };

  // Reset web data
  const resetWebData = () => {
    setWebDataUrl('');
    setWebDataResult('');
  };

  // Apply filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Export as PDF
  const exportPDF = async () => {
    setIsDownloading(true);
    try {
      if (!contentRef.current || !tacticalReport) {
        throw new Error('Content or report not available');
      }
      
      // Create a new PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      
      // Capture formation diagram
      const stage = stageRef.current;
      let stageImage = null;
      
      if (stage) {
        stageImage = stage.toDataURL();
      }
      
      // Add content to PDF
      pdf.setFillColor(15, 10, 27); // Background color
      pdf.rect(0, 0, width, height, 'F');
      
      // Add title
      pdf.setTextColor(115, 63, 170); // Purple
      pdf.setFontSize(24);
      pdf.text(tacticalReport.title, width / 2, 20, { align: 'center' });
      
      // Add date
      pdf.setTextColor(255, 121, 198); // Pink
      pdf.setFontSize(12);
      pdf.text(`Generated on: ${tacticalReport.date}`, width / 2, 30, { align: 'center' });
      
      // Add formation diagram if available
      let yPosition = 40;
      if (stageImage) {
        const imgWidth = width - 40;
        const imgHeight = (pitchHeight * xScale * imgWidth) / (pitchWidth * xScale);
        pdf.addImage(stageImage, 'PNG', 20, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 20;
      }
      
      // Add report sections
      pdf.setTextColor(230, 230, 250); // Light color
      
      tacticalReport.sections.forEach(section => {
        // Check if we need a new page
        if (yPosition > height - 50) {
          pdf.addPage();
          pdf.setFillColor(15, 10, 27);
          pdf.rect(0, 0, width, height, 'F');
          yPosition = 20;
        }
        
        // Add section title
        pdf.setTextColor(255, 121, 198); // Pink
        pdf.setFontSize(16);
        pdf.text(section.title, 20, yPosition);
        yPosition += 10;
        
        // Add section content
        pdf.setTextColor(230, 230, 250);
        pdf.setFontSize(12);
        
        // Split content into lines to avoid overflow
        const contentLines = pdf.splitTextToSize(section.content, width - 40);
        pdf.text(contentLines, 20, yPosition);
        yPosition += contentLines.length * 7 + 15;
      });
      
      // Add footer
      pdf.setTextColor(155, 102, 217); // Purple
      pdf.setFontSize(8);
      pdf.text('Generated by Scorelect AI Analytics', width - 15, height - 10, { align: 'right' });
      
      // Save the PDF
      pdf.save('tactical-analysis.pdf');
      
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

  // Copy report to clipboard
  const copyReportToClipboard = () => {
    if (!tacticalReport) return;
    
    let reportText = `# ${tacticalReport.title}\nGenerated on: ${tacticalReport.date}\n\n`;
    
    tacticalReport.sections.forEach(section => {
      reportText += `## ${section.title}\n${section.content}\n\n`;
    });
    
    navigator.clipboard.writeText(reportText).then(() => {
      Swal.fire({
        title: 'Copied!',
        text: 'Report copied to clipboard.',
        icon: 'success',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
        timer: 1500,
        showConfirmButton: false
      });
    });
  };

  // Render formation diagram
  const renderFormation = () => {
    if (!formationData.players || !formationData.players.length) {
      return null;
    }
    
    return (
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
          strokeWidth={2}
        />
        
        {/* Center Line */}
        <Line
          points={[(pitchWidth / 2) * xScale, 0, (pitchWidth / 2) * xScale, pitchHeight * yScale]}
          stroke="#FFFFFF"
          strokeWidth={1}
          dash={[5, 5]}
        />
        
        {/* 13m Lines */}
        <Line
          points={[13 * xScale, 0, 13 * xScale, pitchHeight * yScale]}
          stroke="#FFFFFF"
          strokeWidth={1}
        />
        <Line
          points={[(pitchWidth - 13) * xScale, 0, (pitchWidth - 13) * xScale, pitchHeight * yScale]}
          stroke="#FFFFFF"
          strokeWidth={1}
        />
        
        {/* 20m Lines */}
        <Line
          points={[20 * xScale, 0, 20 * xScale, pitchHeight * yScale]}
          stroke="#FFFFFF"
          strokeWidth={1}
        />
        <Line
          points={[(pitchWidth - 20) * xScale, 0, (pitchWidth - 20) * xScale, pitchHeight * yScale]}
          stroke="#FFFFFF"
          strokeWidth={1}
        />
        
        {/* 45m Lines */}
        <Line
          points={[45 * xScale, 0, 45 * xScale, pitchHeight * yScale]}
          stroke="#FFFFFF"
          strokeWidth={1}
        />
        <Line
          points={[(pitchWidth - 45) * xScale, 0, (pitchWidth - 45) * xScale, pitchHeight * yScale]}
          stroke="#FFFFFF"
          strokeWidth={1}
        />
        
        {/* Goal Areas */}
        <Rect
          x={0}
          y={(pitchHeight / 2 - 4.5) * yScale}
          width={4.5 * xScale}
          height={9 * yScale}
          stroke="#FFFFFF"
          strokeWidth={1}
          fill="transparent"
        />
        <Rect
          x={(pitchWidth - 4.5) * xScale}
          y={(pitchHeight / 2 - 4.5) * yScale}
          width={4.5 * xScale}
          height={9 * yScale}
          stroke="#FFFFFF"
          strokeWidth={1}
          fill="transparent"
        />
        
        {/* Draw small circle for goals */}
        <Circle
          x={0}
          y={pitchHeight / 2 * yScale}
          radius={3}
          fill="#FFFFFF"
        />
        <Circle
          x={pitchWidth * xScale}
          y={pitchHeight / 2 * yScale}
          radius={3}
          fill="#FFFFFF"
        />
        
        {/* Formation Title */}
        <Text
          x={(pitchWidth / 2) * xScale}
          y={10}
          text={`Formation: ${formationData.formation}`}
          fontSize={16}
          fill="#FFFFFF"
          align="center"
          width={pitchWidth * xScale}
        />
        
        {/* Formation Style */}
        <Text
          x={(pitchWidth / 2) * xScale}
          y={30}
          text={`Style: ${formationData.style === 'direct' ? 'Direct Central Play' : 
                         formationData.style === 'wing-play' ? 'Wing-focused Play' : 
                         'Balanced Approach'}`}
          fontSize={14}
          fill="#FFFFFF"
          align="center"
          width={pitchWidth * xScale}
        />
        
        {/* Draw players */}
        {formationData.players.map((player, i) => (
          <React.Fragment key={i}>
            {/* Player position */}
            <Circle
              x={player.x * xScale}
              y={player.y * yScale}
              radius={12}
              fill={player.position === 'Goalkeeper' ? '#FF5555' : 
                    player.position === 'Defender' ? '#50FA7B' :
                    player.position === 'Midfielder' ? '#FFBF4D' : 
                    '#9B66D9'}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            
            {/* Player name */}
            <Text
              x={player.x * xScale}
              y={(player.y + 15) * yScale}
              text={player.name.split(' ')[0]} // Just first name to save space
              fontSize={10}
              fill="#FFFFFF"
              align="center"
              width={30}
              offsetX={15}
            />
          </React.Fragment>
        ))}
        
        {/* Draw movement arrows based on style */}
        {formationData.style === 'direct' && (
          <>
            {/* Central direct arrows */}
            <Arrow
              points={[
                (pitchWidth / 2 - 15) * xScale, 65 * yScale,
                (pitchWidth / 2 - 5) * xScale, 45 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                (pitchWidth / 2 + 15) * xScale, 65 * yScale,
                (pitchWidth / 2 + 5) * xScale, 45 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                (pitchWidth / 2) * xScale, 45 * yScale,
                (pitchWidth / 2) * xScale, 25 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
          </>
        )}
        
        {formationData.style === 'wing-play' && (
          <>
            {/* Wing play arrows */}
            <Arrow
              points={[
                25 * xScale, 65 * yScale,
                15 * xScale, 45 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                (pitchWidth - 25) * xScale, 65 * yScale,
                (pitchWidth - 15) * xScale, 45 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                15 * xScale, 45 * yScale,
                25 * xScale, 25 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                (pitchWidth - 15) * xScale, 45 * yScale,
                (pitchWidth - 25) * xScale, 25 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
          </>
        )}
        
        {formationData.style === 'balanced' && (
          <>
            {/* Balanced play arrows */}
            <Arrow
              points={[
                25 * xScale, 65 * yScale,
                25 * xScale, 45 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                (pitchWidth / 2) * xScale, 65 * yScale,
                (pitchWidth / 2) * xScale, 45 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                (pitchWidth - 25) * xScale, 65 * yScale,
                (pitchWidth - 25) * xScale, 45 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                25 * xScale, 45 * yScale,
                25 * xScale, 25 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                (pitchWidth / 2) * xScale, 45 * yScale,
                (pitchWidth / 2) * xScale, 25 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
            <Arrow
              points={[
                (pitchWidth - 25) * xScale, 45 * yScale,
                (pitchWidth - 25) * xScale, 25 * yScale
              ]}
              stroke="#FF79C6"
              strokeWidth={2}
              fill="#FF79C6"
            />
          </>
        )}
      </Layer>
    );
  };

  // Render formation legend
  const renderFormationLegend = () => {
    return (
      <div className="ai-formation-legend">
        <div className="ai-legend-item">
          <div className="ai-legend-color" style={{ background: '#FF5555' }}></div>
          <span>Goalkeeper</span>
        </div>
        <div className="ai-legend-item">
          <div className="ai-legend-color" style={{ background: '#50FA7B' }}></div>
          <span>Defender</span>
        </div>
        <div className="ai-legend-item">
          <div className="ai-legend-color" style={{ background: '#FFBF4D' }}></div>
          <span>Midfielder</span>
        </div>
        <div className="ai-legend-item">
          <div className="ai-legend-color" style={{ background: '#9B66D9' }}></div>
          <span>Forward</span>
        </div>
        <div className="ai-legend-item">
          <div className="ai-legend-arrow" style={{ borderColor: "#FF79C6" }}></div>
          <span>Movement Pattern</span>
        </div>
      </div>
    );
  };

  // Web Data Modal
  const renderWebDataModal = () => {
    return (
      <Modal
        isOpen={isWebDataModalOpen}
        onRequestClose={() => setIsWebDataModalOpen(false)}
        className="ai-modal-content"
        overlayClassName="ai-modal-overlay"
        contentLabel="Web Data Scraping"
      >
        <div className="ai-modal-header">
          <h2 className="ai-modal-title">Web Data Integration</h2>
        </div>
        
        <div className="ai-modal-body">
          <p>Enter a URL to scrape additional data about {filters.team || 'the selected team'}.</p>
          <div className="ai-web-data-input">
            <input
              type="text"
              value={webDataUrl}
              onChange={(e) => setWebDataUrl(e.target.value)}
              placeholder="Enter URL (e.g., team website, news article)"
              className="ai-text-input"
            />
            <button 
              className="ai-button"
              onClick={scrapeWebData}
              disabled={isGeneratingAnalysis}
            >
              {isGeneratingAnalysis ? 'Scraping...' : 'Scrape Data'}
            </button>
          </div>
          
          {webDataResult && (
            <div className="ai-web-data-result">
              <h3>Web Data Results</h3>
              <div className="ai-web-data-content">
                <pre>{webDataResult}</pre>
              </div>
              <button 
                className="ai-button secondary"
                onClick={resetWebData}
              >
                Reset
              </button>
            </div>
          )}
        </div>
        
        <div className="ai-modal-footer">
          <button 
            className="ai-button secondary" 
            onClick={() => setIsWebDataModalOpen(false)}
          >
            Close
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
          <p>Loading tactical analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-tactics-dashboard" ref={contentRef}>
      <div className="ai-section">
        <div className="ai-section-header">
          <h2 className="ai-section-title">
            <FaChessBoard /> Tactical Formation Analysis
          </h2>
          <div className="ai-section-actions">
            <button 
              className="ai-button" 
              onClick={exportPDF}
              disabled={isDownloading || !tacticalReport}
            >
              <FaDownload /> {isDownloading ? 'Exporting...' : 'Export PDF'}
            </button>
            <button 
              className="ai-button secondary" 
              onClick={copyReportToClipboard}
              disabled={!tacticalReport}
            >
              <FaRegClipboard /> Copy Report
            </button>
            <button 
              className="ai-button secondary" 
              onClick={() => setIsWebDataModalOpen(true)}
            >
              <FaExternalLinkAlt /> Web Data
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
              <option value="">Select Team</option>
              {filterOptions.teams.map((team, i) => (
                <option key={i} value={team}>{team}</option>
              ))}
            </select>
          </div>
          
          <button 
            className="ai-button secondary"
            onClick={() => generateTacticalAnalysis(filters.team, formationData.formation, formationData.style)}
            disabled={isGeneratingAnalysis || !filters.team}
          >
            <FaSync /> {isGeneratingAnalysis ? 'Analyzing...' : 'Regenerate Analysis'}
          </button>
        </div>
        
        <div className="ai-formation-container">
          <Stage
            width={pitchWidth * xScale}
            height={pitchHeight * yScale}
            ref={stageRef}
          >
            {renderFormation()}
          </Stage>
          
          {renderFormationLegend()}
        </div>
        
        {isGeneratingAnalysis ? (
          <div className="ai-loading">
            <div className="ai-loading-spinner"></div>
            <p>Generating tactical analysis with AI...</p>
          </div>
        ) : tacticalAnalysis ? (
          <div className="ai-tactical-report">
            <div className="ai-report-header">
              <FaMagic className="ai-report-icon" />
              <h3 className="ai-report-title">AI-Generated Tactical Analysis</h3>
            </div>
            
            <div className="ai-report-overview">
              <h4>Overview</h4>
              <p>{tacticalAnalysis.overview}</p>
            </div>
            
            <div className="ai-report-columns">
              <div className="ai-report-column">
                <h4>Team Strengths</h4>
                <ul>
                  {tacticalAnalysis.strengths.map((strength, i) => (
                    <li key={i}>{strength}</li>
                  ))}
                </ul>
              </div>
              
              <div className="ai-report-column">
                <h4>Areas for Improvement</h4>
                <ul>
                  {tacticalAnalysis.weaknesses.map((weakness, i) => (
                    <li key={i}>{weakness}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="ai-report-recommendations">
              <h4>Tactical Recommendations</h4>
              <ul>
                {tacticalAnalysis.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
            
            {webDataResult && (
              <div className="ai-report-web-data">
                <h4>Additional Web Data</h4>
                <pre>{webDataResult}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="ai-no-analysis">
            <p>Select a team to generate tactical analysis.</p>
          </div>
        )}
      </div>
      
      {renderWebDataModal()}
    </div>
  );
};

export default AIGAATactics;