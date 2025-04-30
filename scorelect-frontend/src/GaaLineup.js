import React, { useState, useRef, useEffect } from 'react';
import './GaaLineup.css';
import defaultCrest from './images/gaa-logo.png';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Save, Download, XCircle, CheckCircle, Image, RefreshCw, Move, Edit3, Trash2, Settings, Check } from 'lucide-react';
// Import GAA Pitch component
import { renderGAAPitch } from './components/GAAPitchComponents';
import { Stage } from 'react-konva';

const GaaLineup = () => {
  // Scorelect Theme Colors
  const scorelectTheme = {
    primary: '#3b1761',     // Purple
    secondary: '#5e2e8f',   // Lighter Purple
    darkBg: '#333333',      // Dark Grey
    lightBg: '#444444',     // Lighter Grey
    accentColor: '#ff7b25', // Orange accent
    textColor: '#ffffff'    // White text
  };

  // Theme options (updated with Scorelect theme)
  const themes = {
    scorelect: {
      name: 'Scorelect',
      pitchBg: 'url("./images/gaa-pitch.png")',
      primaryColor: scorelectTheme.primary,
      secondaryColor: scorelectTheme.secondary,
      accentColor: scorelectTheme.accentColor,
      textColor: scorelectTheme.textColor
    },
    dark: {
      name: 'Dark',
      pitchBg: 'url("./images/gaa-pitch-dark.png")',
      primaryColor: '#1e272e',
      secondaryColor: '#485460',
      accentColor: '#0be881',
      textColor: '#ffffff'
    },
    classic: {
      name: 'Classic',
      pitchBg: 'url("./images/gaa-pitch-classic.png")',
      primaryColor: '#7f8c8d',
      secondaryColor: '#95a5a6',
      accentColor: '#f39c12',
      textColor: '#2c3e50'
    },
    county: {
      name: 'County',
      pitchBg: 'url("./images/gaa-pitch-county.png")',
      primaryColor: '#27ae60',
      secondaryColor: '#2ecc71',
      accentColor: '#e67e22',
      textColor: '#ffffff'
    }
  };

  const formations = {
    traditional: {
      name: 'Traditional (1-3-3-2-3-3)',
      lines: [1, 3, 3, 2, 3, 3]
    },
    defensive: {
      name: 'Defensive (1-4-2-2-3-3)',
      lines: [1, 4, 2, 2, 3, 3]
    },
    attacking: {
      name: 'Attacking (1-2-3-3-3-3)',
      lines: [1, 2, 3, 3, 3, 3]
    },
    sweeper: {
      name: 'Sweeper (1-1-3-2-3-2-3)',
      lines: [1, 1, 3, 2, 3, 2, 3]
    }
  };

  // 1. get the DOM size you want for portrait – e.g. 500 px wide, 800 px tall
  const PORTRAIT = { width: 435, height: 575 };  //  height  ⇐ 145 m

  // 2. compute scales:  xScale maps metres→px horizontally, yScale vertically
  const xScale = PORTRAIT.height / 145; // 145 m → 800 px
  const yScale = PORTRAIT.width  / 88;  // 88 m  → 500 px

  const PITCH_WIDTH = 500;   // Width of the pitch container
  const PITCH_HEIGHT = 800;  // Height of the pitch container

  // State management
  const [teamName, setTeamName] = useState('Team Name');
  const [oppositionName, setOppositionName] = useState('Opposition');
  const [matchDetails, setMatchDetails] = useState('');
  const [managerName, setManagerName] = useState('');
  const [crest, setCrest] = useState(null);
  const [textColor, setTextColor] = useState('#ffffff');
  const [activeTheme, setActiveTheme] = useState('scorelect'); // Default to Scorelect theme
  const [activeFormation, setActiveFormation] = useState('traditional');
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayerInfo, setShowPlayerInfo] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [savedLineups, setSavedLineups] = useState([]);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [playerEditorVisible, setPlayerEditorVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [playerDetails, setPlayerDetails] = useState({
    name: '',
    number: '',
    notes: '',
    club: '',
    age: '',
    height: '',
    position: '',
    stats: {
      games: '',
      goals: '',
      points: ''
    }
  });

  // Generate initial players based on active formation
  const generateInitialPlayers = (formationKey) => {
    const formation = formations[formationKey].lines;      // e.g. [1,3,3,2,3,3]
    const FIELD_W   = PORTRAIT.width;   // 470 px
    const FIELD_H   = PORTRAIT.height;  // 570 px

    const yGap = FIELD_H / (formation.length + 0.5);         // even vertical spacing
    let idx = 0;
    const players = [];

    formation.forEach((numInLine, lineIdx) => {
      const xGap = FIELD_W / (numInLine + 1);              // even horizontal spacing
      const y = yGap * (lineIdx + 1);

      for (let i = 0; i < numInLine; i++) {
        const x = xGap * (i + 1);

        players.push({
          id      : `player-${idx + 1}`,
          number  : idx + 1,
          name    : '',
          position: getPositionName(lineIdx, i, numInLine),
          notes   : '',
          locked  : false,
          removed : false,
          // centre an 85×60 card on the point (x,y)
          posX    : x - 48,
          posY    : y - 70,
          club    : '',
          age     : '',
          height  : '',
          stats   : { games: 0, goals: 0, points: 0 }
        });
        idx++;
      }
    });

    return players;
  };


  // Get GAA position name based on formation line and position
  const getPositionName = (lineIndex, posIndex, lineCount) => {
    const positions = [
      ['GK'], // Goalkeeper
      ['RCB', 'FB', 'LCB'], // Full back line
      ['RHB', 'CHB', 'LHB'], // Half back line
      ['MF', 'MF'], // Midfield
      ['RHF', 'CHF', 'LHF'], // Half forward line
      ['RFF', 'FF', 'LFF'] // Full forward line
    ];
    
    // Additional positions for 7-line formation
    if (lineIndex === 1 && lineCount === 1) {
      return 'SW'; // Sweeper
    }
    
    // Adjust position names based on number of players in the line
    if (lineIndex < positions.length) {
      const linePositions = positions[lineIndex];
      
      if (lineCount === 1) {
        return linePositions[0];
      } else if (lineCount === 2) {
        return posIndex === 0 ? 'R' + linePositions[1] : 'L' + linePositions[1];
      } else if (lineCount === 3) {
        return linePositions[posIndex];
      } else if (lineCount === 4) {
        if (posIndex === 0) return 'R' + linePositions[0];
        if (posIndex === 1) return 'RC' + linePositions[1];
        if (posIndex === 2) return 'LC' + linePositions[1];
        if (posIndex === 3) return 'L' + linePositions[2];
      }
    }
    
    return `P${lineIndex+1}${posIndex+1}`;
  };

  const [players, setPlayers] = useState(generateInitialPlayers(activeFormation));

  // Generate subs
  const generateInitialSubs = () => {
    return Array.from({ length: 11 }, (_, i) => ({
      id: `sub-${i + 16}`,
      number: i + 16,
      name: '',
      position: '',
      locked: false,
      removed: false,
      club: '',
      age: '',
      height: '',
      stats: {
        games: 0,
        goals: 0,
        points: 0
      }
    }));
  };
  
  const [subs, setSubs] = useState(generateInitialSubs());

  // Refs for components
  const containerRef = useRef(null);
  const pitchRef = useRef(null);
  const dragDataRef = useRef(null);
  const playerEditorRef = useRef(null);

  // Update players when formation changes
  useEffect(() => {
    setPlayers(generateInitialPlayers(activeFormation));
  }, [activeFormation]);

  // Close player editor when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (playerEditorRef.current && !playerEditorRef.current.contains(event.target)) {
        setPlayerEditorVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load saved lineups from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('gaaLineups');
    if (savedData) {
      try {
        setSavedLineups(JSON.parse(savedData));
      } catch (e) {
        console.error('Error loading saved lineups:', e);
      }
    }
  }, []);

  // File upload handlers
  const handleCrestUpload = (event) => {
    if (event.target.files && event.target.files[0]) {
      setCrest(URL.createObjectURL(event.target.files[0]));
    }
  };

  // Player data handlers
  const handlePlayerChange = (id, field, value) => {
    const isPlayerNotSub = players.some(p => p.id === id);
    
    if (isPlayerNotSub) {
      const updatedPlayers = players.map(player => 
        player.id === id ? { ...player, [field]: value } : player
      );
      setPlayers(updatedPlayers);
    } else {
      const updatedSubs = subs.map(sub => 
        sub.id === id ? { ...sub, [field]: value } : sub
      );
      setSubs(updatedSubs);
    }
  };

  const handleNestedPlayerChange = (id, parentField, field, value) => {
    const isPlayerNotSub = players.some(p => p.id === id);
    
    if (isPlayerNotSub) {
      const updatedPlayers = players.map(player => 
        player.id === id 
          ? { ...player, [parentField]: { ...player[parentField], [field]: value } } 
          : player
      );
      setPlayers(updatedPlayers);
    } else {
      const updatedSubs = subs.map(sub => 
        sub.id === id 
          ? { ...sub, [parentField]: { ...sub[parentField], [field]: value } } 
          : sub
      );
      setSubs(updatedSubs);
    }
  };

  const handleLockPlayer = (id) => {
    const isPlayerNotSub = players.some(p => p.id === id);
    
    if (isPlayerNotSub) {
      const updatedPlayers = players.map(player => 
        player.id === id ? { ...player, locked: true } : player
      );
      setPlayers(updatedPlayers);
    } else {
      const updatedSubs = subs.map(sub => 
        sub.id === id ? { ...sub, locked: true } : sub
      );
      setSubs(updatedSubs);
    }
  };

  const handleRemovePlayer = (id) => {
    const isPlayerNotSub = players.some(p => p.id === id);
    
    if (isPlayerNotSub) {
      const updatedPlayers = players.map(player => 
        player.id === id ? { ...player, removed: true } : player
      );
      setPlayers(updatedPlayers);
    } else {
      const updatedSubs = subs.map(sub => 
        sub.id === id ? { ...sub, removed: true } : sub
      );
      setSubs(updatedSubs);
    }
  };

  const handleUnlockPlayer = (id) => {
    const isPlayerNotSub = players.some(p => p.id === id);
    
    if (isPlayerNotSub) {
      const updatedPlayers = players.map(player => 
        player.id === id ? { ...player, locked: false } : player
      );
      setPlayers(updatedPlayers);
    } else {
      const updatedSubs = subs.map(sub => 
        sub.id === id ? { ...sub, locked: false } : sub
      );
      setSubs(updatedSubs);
    }
  };

  const handleRestorePlayer = (id) => {
    const isPlayerNotSub = players.some(p => p.id === id);
    
    if (isPlayerNotSub) {
      const updatedPlayers = players.map(player => 
        player.id === id ? { ...player, removed: false } : player
      );
      setPlayers(updatedPlayers);
    } else {
      const updatedSubs = subs.map(sub => 
        sub.id === id ? { ...sub, removed: false } : sub
      );
      setSubs(updatedSubs);
    }
  };

  // Reset lineup to default
  const handleResetLineup = () => {
    setPlayers(generateInitialPlayers(activeFormation));
    setSubs(generateInitialSubs());
    setTeamName('Team Name');
    setOppositionName('Opposition');
    setMatchDetails('');
    setManagerName('');
    setCrest(null);
    setConfirmed(false);
  };

  // Handle confirm action to remove grey squares
  const handleConfirm = () => {
    setConfirmed(true);
  };

  // Save lineup to localStorage
  const handleSaveLineup = () => {
    const lineup = {
      id: Date.now(),
      teamName,
      oppositionName,
      matchDetails,
      managerName,
      players,
      subs,
      formation: activeFormation,
      theme: activeTheme,
      dateCreated: new Date().toISOString()
    };
    
    const updatedLineups = [...savedLineups, lineup];
    setSavedLineups(updatedLineups);
    
    // Save to localStorage
    localStorage.setItem('gaaLineups', JSON.stringify(updatedLineups));
    
    // Show saved confirmation
    alert(`Lineup "${teamName} vs ${oppositionName}" saved!`);
  };

  // Load a saved lineup
  const handleLoadLineup = (id) => {
    const lineup = savedLineups.find(l => l.id === id);
    if (lineup) {
      setTeamName(lineup.teamName);
      setOppositionName(lineup.oppositionName || 'Opposition');
      setMatchDetails(lineup.matchDetails || '');
      setManagerName(lineup.managerName);
      setPlayers(lineup.players);
      setSubs(lineup.subs);
      setActiveFormation(lineup.formation || 'traditional');
      setActiveTheme(lineup.theme || 'scorelect');
    }
  };

  // Delete a saved lineup
  const handleDeleteLineup = (id) => {
    if (window.confirm('Are you sure you want to delete this lineup?')) {
      const updatedLineups = savedLineups.filter(l => l.id !== id);
      setSavedLineups(updatedLineups);
      localStorage.setItem('gaaLineups', JSON.stringify(updatedLineups));
    }
  };

  // Generate PDF/PNG download
  const handleDownload = async (format = 'pdf') => {
    if (!containerRef.current) return;
    setIsLoading(true);
    const container = containerRef.current;

    try {
      // Add a small delay to ensure UI updates are complete
      await new Promise(res => setTimeout(res, 500));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      if (format === 'png') {
        // Download as PNG
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `${teamName.replace(/\s+/g, '_')}_vs_${oppositionName.replace(/\s+/g, '_')}.png`;
        link.click();
      } else {
        // Download as PDF
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${teamName.replace(/\s+/g, '_')}_vs_${oppositionName.replace(/\s+/g, '_')}.pdf`);
      }
    } catch (error) {
      console.error('Error generating download:', error);
      alert('Failed to generate download. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop functionality
  const handleDragStart = (e, id) => {
    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    dragDataRef.current = { id, offsetX, offsetY };
    e.dataTransfer.effectAllowed = 'move';
    
    // Add dragging class for visual feedback
    element.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    // Remove dragging class
    e.currentTarget.classList.remove('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    return false;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!dragDataRef.current || !pitchRef.current) return;

    const { id, offsetX, offsetY } = dragDataRef.current;
    const pitchRect = pitchRef.current.getBoundingClientRect();

    const newX = e.clientX - pitchRect.left - offsetX;
    const newY = e.clientY - pitchRect.top - offsetY;

    // Find the player by ID and update position
    const updatedPlayers = players.map(player => {
      if (player.id === id) {
        return {
          ...player,
          posX: Math.max(0, Math.min(newX, pitchRect.width - 100)),
          posY: Math.max(0, Math.min(newY, pitchRect.height - 85))
        };
      }
      return player;
    });
    
    setPlayers(updatedPlayers);
    dragDataRef.current = null;
    return false;
  };

  // Player editor functionality
  const openPlayerEditor = (id) => {
    let playerToEdit;
    const isPlayerNotSub = players.some(p => p.id === id);
    
    if (isPlayerNotSub) {
      playerToEdit = players.find(player => player.id === id);
    } else {
      playerToEdit = subs.find(sub => sub.id === id);
    }
    
    if (playerToEdit) {
      setPlayerDetails({
        name: playerToEdit.name || '',
        number: playerToEdit.number || '',
        notes: playerToEdit.notes || '',
        club: playerToEdit.club || '',
        age: playerToEdit.age || '',
        height: playerToEdit.height || '',
        position: playerToEdit.position || '',
        stats: {
          games: playerToEdit.stats?.games || '',
          goals: playerToEdit.stats?.goals || '',
          points: playerToEdit.stats?.points || ''
        }
      });
      setEditingPlayerId(id);
      setPlayerEditorVisible(true);
    }
  };

  const savePlayerDetails = () => {
    if (!editingPlayerId) return;
    
    const isPlayerNotSub = players.some(p => p.id === editingPlayerId);
    
    if (isPlayerNotSub) {
      const updatedPlayers = players.map(player => {
        if (player.id === editingPlayerId) {
          return {
            ...player,
            name: playerDetails.name,
            number: playerDetails.number,
            notes: playerDetails.notes,
            club: playerDetails.club,
            age: playerDetails.age,
            height: playerDetails.height,
            position: playerDetails.position,
            stats: playerDetails.stats
          };
        }
        return player;
      });
      setPlayers(updatedPlayers);
    } else {
      const updatedSubs = subs.map(sub => {
        if (sub.id === editingPlayerId) {
          return {
            ...sub,
            name: playerDetails.name,
            number: playerDetails.number,
            notes: playerDetails.notes,
            club: playerDetails.club,
            age: playerDetails.age,
            height: playerDetails.height,
            position: playerDetails.position,
            stats: playerDetails.stats
          };
        }
        return sub;
      });
      setSubs(updatedSubs);
    }
    
    setPlayerEditorVisible(false);
    setEditingPlayerId(null);
  };

  // Render player on pitch
  const renderPlayerOnPitch = (player) => {
    if (player.removed) return null;

    const currentTheme = themes[activeTheme];
    const playerStyle = {
      left: player.posX,
      top: player.posY,
      color: textColor,
      position: 'absolute'
    };

    // When confirmed, show simplified player display
    if (confirmed) {
      return (
        <div
          className="player-confirmed-slot"
          style={playerStyle}
        >
          <div className="player-confirmed-card">
            <div className="player-confirmed-number">{player.number}</div>
            <div className="player-confirmed-name">{player.name || player.position}</div>
            {player.club && <div className="player-confirmed-club">{player.club}</div>}
          </div>
        </div>
      );
    }

    // Player is locked (read-only view)
    if (player.locked) {
      return (
        <div
          className="player-locked-slot"
          style={playerStyle}
          onClick={() => setSelectedPlayerId(player.id === selectedPlayerId ? null : player.id)}
        >
          <div className="player-card" style={{ backgroundColor: currentTheme.primaryColor }}>
            <div className="player-number">{player.number}</div>
            <div className="player-name">{player.name || player.position}</div>
            {player.notes && <div className="player-notes">{player.notes}</div>}
            
            <div className="player-actions">
              <button 
                className="player-action-button" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnlockPlayer(player.id);
                }}
                title="Unlock player"
              >
                <Edit3 size={12} />
              </button>
            </div>
          </div>

          {player.id === selectedPlayerId && (
            <div className="player-details-popup" style={{ backgroundColor: currentTheme.secondaryColor }}>
              <div className="player-detail"><strong>Position:</strong> {player.position}</div>
              {player.club && <div className="player-detail"><strong>Club:</strong> {player.club}</div>}
              {player.age && <div className="player-detail"><strong>Age:</strong> {player.age}</div>}
              {player.height && <div className="player-detail"><strong>Height:</strong> {player.height}</div>}
              {player.stats && player.stats.games > 0 && (
                <div className="player-detail">
                  <strong>Stats:</strong> {player.stats.games} games, {player.stats.goals} goals, {player.stats.points} pts
                </div>
              )}
              <button 
                className="player-detail-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlayerId(null);
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      );
    }

    // Editable player
    return (
      <div
        className="player-slot"
        style={playerStyle}
        draggable={!confirmed}
        onDragStart={(e) => handleDragStart(e, player.id)}
        onDragEnd={handleDragEnd}
        onClick={() => setSelectedPlayerId(player.id === selectedPlayerId ? null : player.id)}
      >
        <div className="player-card" style={{ backgroundColor: currentTheme.primaryColor }}>
          <div className="drag-handle" title="Drag to move player">
            <Move size={14} />
          </div>
          
          <div className="player-number">{player.number}</div>
          <div className="player-name">{player.name || player.position}</div>
          {player.notes && <div className="player-notes">{player.notes}</div>}
          
          <div className="player-actions">
            <button 
              className="player-action-button edit-button" 
              onClick={(e) => {
                e.stopPropagation();
                openPlayerEditor(player.id);
              }}
              title="Edit player details"
            >
              <Edit3 size={12} />
            </button>
            <button 
              className="player-action-button lock-button" 
              onClick={(e) => {
                e.stopPropagation();
                handleLockPlayer(player.id);
              }}
              title="Lock player"
            >
              <CheckCircle size={12} />
            </button>
            <button 
              className="player-action-button remove-button" 
              onClick={(e) => {
                e.stopPropagation();
                handleRemovePlayer(player.id);
              }}
              title="Remove player"
            >
              <XCircle size={12} />
            </button>
          </div>
        </div>
        
        {player.id === selectedPlayerId && (
          <div className="player-details-popup" style={{ backgroundColor: currentTheme.secondaryColor }}>
            <div className="player-detail"><strong>Position:</strong> {player.position}</div>
            {player.club && <div className="player-detail"><strong>Club:</strong> {player.club}</div>}
            {player.age && <div className="player-detail"><strong>Age:</strong> {player.age}</div>}
            {player.height && <div className="player-detail"><strong>Height:</strong> {player.height}</div>}
            {player.stats && (
              <div className="player-detail">
                <strong>Stats:</strong> {player.stats.games || 0} games, {player.stats.goals || 0} goals, {player.stats.points || 0} pts
              </div>
            )}
            <button 
              className="player-detail-close"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPlayerId(null);
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render sub player
  const renderSubPlayer = (sub) => {
    if (sub.removed) return null;

    const currentTheme = themes[activeTheme];
    
    // Sub is locked (read-only view)
    if (sub.locked) {
      return (
        <div 
          className="sub-locked-slot"
          onClick={() => setSelectedPlayerId(sub.id === selectedPlayerId ? null : sub.id)}
        >
          <div className="sub-card" style={{ backgroundColor: currentTheme.secondaryColor }}>
            <div className="sub-number">{sub.number}</div>
            <div className="sub-name">{sub.name || 'Sub'}</div>
            {sub.position && <div className="sub-position">{sub.position}</div>}
            
            <div className="sub-actions">
              <button 
                className="sub-action-button" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnlockPlayer(sub.id);
                }}
                title="Unlock substitute"
              >
                <Edit3 size={12} />
              </button>
            </div>
          </div>
          
          {sub.id === selectedPlayerId && (
            <div className="player-details-popup sub-details-popup" style={{ backgroundColor: currentTheme.primaryColor }}>
              {sub.club && <div className="player-detail"><strong>Club:</strong> {sub.club}</div>}
              {sub.age && <div className="player-detail"><strong>Age:</strong> {sub.age}</div>}
              {sub.height && <div className="player-detail"><strong>Height:</strong> {sub.height}</div>}
              {sub.stats && sub.stats.games > 0 && (
                <div className="player-detail">
                  <strong>Stats:</strong> {sub.stats.games} games, {sub.stats.goals} goals, {sub.stats.points} pts
                </div>
              )}
              <button 
                className="player-detail-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlayerId(null);
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      );
    }

    // Editable sub
    return (
      <div 
        className="sub-slot"
        onClick={() => setSelectedPlayerId(sub.id === selectedPlayerId ? null : sub.id)}
      >
        <div className="sub-card" style={{ backgroundColor: currentTheme.secondaryColor }}>
          <div className="sub-number">{sub.number}</div>
          <div className="sub-name">{sub.name || 'Sub'}</div>
          {sub.position && <div className="sub-position">{sub.position}</div>}
          
          <div className="sub-actions">
            <button 
              className="sub-action-button edit-button" 
              onClick={(e) => {
                e.stopPropagation();
                openPlayerEditor(sub.id);
              }}
              title="Edit substitute details"
            >
              <Edit3 size={12} />
            </button>
            <button 
              className="sub-action-button lock-button" 
              onClick={(e) => {
                e.stopPropagation();
                handleLockPlayer(sub.id);
              }}
              title="Lock substitute"
              >
                <CheckCircle size={12} />
              </button>
              <button 
                className="sub-action-button remove-button" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePlayer(sub.id);
                }}
                title="Remove substitute"
              >
                <XCircle size={12} />
              </button>
            </div>
          </div>
          
          {sub.id === selectedPlayerId && (
            <div className="player-details-popup sub-details-popup" style={{ backgroundColor: currentTheme.primaryColor }}>
              {sub.club && <div className="player-detail"><strong>Club:</strong> {sub.club}</div>}
              {sub.age && <div className="player-detail"><strong>Age:</strong> {sub.age}</div>}
              {sub.height && <div className="player-detail"><strong>Height:</strong> {sub.height}</div>}
              {sub.stats && (
                <div className="player-detail">
                  <strong>Stats:</strong> {sub.stats.games || 0} games, {sub.stats.goals || 0} goals, {sub.stats.points || 0} pts
                </div>
              )}
              <button 
                className="player-detail-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlayerId(null);
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      );
    };
  
    // Render player editor modal
    const renderPlayerEditor = () => {
      if (!playerEditorVisible) return null;
      
      const currentTheme = themes[activeTheme];
      
      return (
        <div className="player-editor-overlay">
          <div 
            className="player-editor-modal"
            ref={playerEditorRef}
            style={{ 
              backgroundColor: currentTheme.secondaryColor,
              color: currentTheme.textColor,
              borderColor: currentTheme.accentColor
            }}
          >
            <h3>Edit Player Details</h3>
            
            <div className="player-editor-form">
              <div className="player-editor-row">
                <div className="player-editor-field">
                  <label>Number</label>
                  <input 
                    type="text" 
                    value={playerDetails.number}
                    onChange={(e) => setPlayerDetails({...playerDetails, number: e.target.value})}
                  />
                </div>
                <div className="player-editor-field">
                  <label>Name</label>
                  <input 
                    type="text" 
                    value={playerDetails.name}
                    onChange={(e) => setPlayerDetails({...playerDetails, name: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="player-editor-row">
                <div className="player-editor-field">
                  <label>Position</label>
                  <input 
                    type="text" 
                    value={playerDetails.position}
                    onChange={(e) => setPlayerDetails({...playerDetails, position: e.target.value})}
                  />
                </div>
                <div className="player-editor-field">
                  <label>Club</label>
                  <input 
                    type="text" 
                    value={playerDetails.club}
                    onChange={(e) => setPlayerDetails({...playerDetails, club: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="player-editor-row">
                <div className="player-editor-field">
                  <label>Age</label>
                  <input 
                    type="text" 
                    value={playerDetails.age}
                    onChange={(e) => setPlayerDetails({...playerDetails, age: e.target.value})}
                  />
                </div>
                <div className="player-editor-field">
                  <label>Height</label>
                  <input 
                    type="text" 
                    value={playerDetails.height}
                    onChange={(e) => setPlayerDetails({...playerDetails, height: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="player-editor-row">
                <div className="player-editor-field">
                  <label>Notes</label>
                  <input 
                    type="text" 
                    value={playerDetails.notes}
                    onChange={(e) => setPlayerDetails({...playerDetails, notes: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="player-editor-section">
                <h4>Player Stats</h4>
                <div className="player-editor-row">
                  <div className="player-editor-field">
                    <label>Games</label>
                    <input 
                      type="number" 
                      value={playerDetails.stats?.games}
                      onChange={(e) => setPlayerDetails({
                        ...playerDetails, 
                        stats: {...playerDetails.stats, games: e.target.value}
                      })}
                    />
                  </div>
                  <div className="player-editor-field">
                    <label>Goals</label>
                    <input 
                      type="number" 
                      value={playerDetails.stats?.goals}
                      onChange={(e) => setPlayerDetails({
                        ...playerDetails, 
                        stats: {...playerDetails.stats, goals: e.target.value}
                      })}
                    />
                  </div>
                  <div className="player-editor-field">
                    <label>Points</label>
                    <input 
                      type="number" 
                      value={playerDetails.stats?.points}
                      onChange={(e) => setPlayerDetails({
                        ...playerDetails, 
                        stats: {...playerDetails.stats, points: e.target.value}
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="player-editor-actions">
              <button
                className="cancel-button"
                onClick={() => setPlayerEditorVisible(false)}
              >
                Cancel
              </button>
              <button
                className="save-button"
                onClick={savePlayerDetails}
                style={{ 
                  backgroundColor: currentTheme.accentColor,
                  color: currentTheme.textColor
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      );
    };
  
    // Render saved lineups panel
    const renderSavedLineups = () => {
      if (savedLineups.length === 0) return (
        <div className="no-saved-lineups">
          <p>No saved lineups found. Save your current lineup to see it here.</p>
        </div>
      );
      
      const currentTheme = themes[activeTheme];
      
      return (
        <div className="saved-lineups-list">
          {savedLineups.map(lineup => (
            <div 
              key={lineup.id} 
              className="saved-lineup-item"
              style={{ backgroundColor: currentTheme.secondaryColor }}
            >
              <div className="saved-lineup-info">
                <div className="saved-lineup-name">{lineup.teamName} vs {lineup.oppositionName}</div>
                <div className="saved-lineup-date">
                  {new Date(lineup.dateCreated).toLocaleDateString()}
                </div>
              </div>
              <div className="saved-lineup-actions">
                <button 
                  className="load-lineup-button" 
                  onClick={() => handleLoadLineup(lineup.id)}
                  title="Load lineup"
                  style={{ backgroundColor: currentTheme.accentColor }}
                >
                  Load
                </button>
                <button 
                  className="delete-lineup-button" 
                  onClick={() => handleDeleteLineup(lineup.id)}
                  title="Delete lineup"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    };
  
    // Render settings panel
    const renderSettings = () => {
      if (!showSettings) return null;
  
      const currentTheme = themes[activeTheme];
  
      return (
        <div className="settings-panel" style={{ backgroundColor: currentTheme.secondaryColor }}>
          <h3>Settings</h3>
          
          <div className="settings-section">
            <h4>Theme</h4>
            <div className="theme-options">
              {Object.keys(themes).map(themeKey => (
                <button
                  key={themeKey}
                  className={`theme-option ${activeTheme === themeKey ? 'active' : ''}`}
                  onClick={() => setActiveTheme(themeKey)}
                  style={{ 
                    backgroundColor: themes[themeKey].primaryColor,
                    borderColor: themes[themeKey].accentColor
                  }}
                >
                  {themes[themeKey].name}
                </button>
              ))}
            </div>
          </div>
  
          <div className="settings-section">
            <h4>Formation</h4>
            <div className="formation-options">
              {Object.keys(formations).map(formationKey => (
                <button
                  key={formationKey}
                  className={`formation-option ${activeFormation === formationKey ? 'active' : ''}`}
                  onClick={() => setActiveFormation(formationKey)}
                  style={{ 
                    backgroundColor: currentTheme.primaryColor,
                    borderColor: currentTheme.accentColor
                  }}
                >
                  {formations[formationKey].name}
                </button>
              ))}
            </div>
          </div>
  
          <div className="settings-section">
            <h4>Display Options</h4>
            <div className="display-options">
              <div className="display-option">
                <input
                  type="checkbox"
                  id="showPlayerInfo"
                  checked={showPlayerInfo}
                  onChange={(e) => setShowPlayerInfo(e.target.checked)}
                />
                <label htmlFor="showPlayerInfo">Show Player Information</label>
              </div>
            </div>
          </div>
  
          <button
            className="close-settings-button"
            onClick={() => setShowSettings(false)}
            style={{ backgroundColor: currentTheme.accentColor }}
          >
            Close Settings
          </button>
        </div>
      );
    };
  
    // Render removed players section
    const renderRemovedPlayers = () => {
      const removedPlayers = [...players, ...subs].filter(p => p.removed);
      if (removedPlayers.length === 0) return null;
  
      const currentTheme = themes[activeTheme];
  
      return (
        <div className="removed-players-section">
          <h3>Removed Players</h3>
          <div className="removed-players-list">
            {removedPlayers.map(player => (
              <div key={player.id} className="removed-player-item" style={{ backgroundColor: currentTheme.accentColor }}>
                <div className="removed-player-info">
                  <span className="removed-player-number">{player.number}</span>
                  <span className="removed-player-name">{player.name || player.position}</span>
                </div>
                <button
                  className="restore-button"
                  onClick={() => handleRestorePlayer(player.id)}
                  title="Restore player"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    };
  
    // Main render function
    return (
      <>
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <div className="loading-text">Generating your lineup...</div>
          </div>
        )}
        
        <div className="gaa-lineup-container" ref={containerRef} style={{ backgroundColor: scorelectTheme.darkBg }}>
          {/* Top Toolbar */}
          <div className="gaa-toolbar">
            <button 
              className="settings-button" 
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings size={16} />
            </button>
            
            <div className="team-section">
              <input
                type="text"
                className="team-name-input"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team Name"
              />
              <span className="vs-text">vs</span>
              <input
                type="text"
                className="opposition-name-input"
                value={oppositionName}
                onChange={(e) => setOppositionName(e.target.value)}
                placeholder="Opposition"
              />
            </div>
            
            <div className="crest-upload">
              <label htmlFor="crest-input" title="Upload team crest">
                <img
                  src={crest || defaultCrest}
                  alt="Team Crest"
                  className="team-crest"
                />
                <Image size={16} className="upload-icon" />
              </label>
              <input
                type="file"
                id="crest-input"
                accept="image/*"
                onChange={handleCrestUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          
          {/* Match Details */}
          <div className="match-details-section">
            <input
              type="text"
              className="match-details-input"
              value={matchDetails}
              onChange={(e) => setMatchDetails(e.target.value)}
              placeholder="Match Details (Venue, Date, Competition, etc.)"
            />
          </div>
          
          {/* Main Content */}
          <div className="gaa-content">
            {/* Render Settings Panel */}
            {renderSettings()}
            
            {/* Main Layout - Pitch on left, Sidebar on right */}
            <div className="main-layout">

               {/* Previous Lineups Section */}
               <div className="lineups-history-section">
                  <div className="history-header">
                    <h3>Previous Lineups</h3>
                  </div>
                  {renderSavedLineups()}
                </div>
                
              {/* Main Pitch */}
              <div
                className="gaa-pitch"
                ref={pitchRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{ 
                  position: 'relative',
                  backgroundColor: '#2ecc71'
                }}
              >
                {/* GAAPitch component as background */}
                <div className="gaa-pitch-background" style={{ pointerEvents: 'none' }}>

                {/* ⬇︎  REPLACE the whole <Stage> … </Stage> block with this one  ⬇︎ */}
                <Stage
                  width={PORTRAIT.height}   // Height parameter (500px)
                  height={PORTRAIT.width}   // Width parameter (420px)
                  style={{
                    position: 'absolute',
                    top: '35.5%',            // Position from top at 50% of container
                    left: '56%',           // Position from left at 50% of container
                    transform: 'translate(-70%, -50%) rotate(90deg)', // Center the element and rotate
                    transformOrigin: 'center',
                    width: '90%',          // Scale width relative to container
                    height: '90%',        // Scale height to fill container
                    pointerEvents: 'none',
                    zIndex: 1
                  }}
                >
                  {renderGAAPitch({
                    canvasSizeMain: { width: PORTRAIT.height, height: PORTRAIT.width },
                    pitchColorState: '#2ecc71',
                    lightStripeColorState: '#27ae60',
                    darkStripeColorState: '#2ecc71',
                    lineColorState: '#ffffff',
                    xScale,
                    yScale
                  })}
                </Stage>
                </div>

                                
                {/* Render players on top of the pitch */}
                <div className="players-container" style={{ zIndex: 2 }}>
                  {players.map(renderPlayerOnPitch)}
                </div>
              </div>
              
              {/* Right sidebar - contains subs and previous lineups */}
              <div className="right-sidebar">
                {/* Subs Section */}
                <div className="subs-section">
                  <h3>Substitutes</h3>
                  <div className="subs-grid">
                    {subs.map((sub) => renderSubPlayer(sub))}
                  </div>
                </div>
                
               
              </div>
            </div>
            
            {/* Bottom Section for Removed Players */}
            <div className="bottom-section">
              {renderRemovedPlayers()}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="action-buttons">
            <button 
              className="save-button" 
              onClick={handleSaveLineup}
              title="Save Lineup"
            >
              <Save size={16} />
              <span>Save Lineup</span>
            </button>
            
            <div className="download-options">
              <button 
                className="download-button pdf-button" 
                onClick={() => handleDownload('pdf')}
                title="Download as PDF"
              >
                <Download size={16} />
                <span>PDF</span>
              </button>
              <button 
                className="download-button png-button" 
                onClick={() => handleDownload('png')}
                title="Download as PNG"
              >
                <Download size={16} />
                <span>PNG</span>
              </button>
            </div>
            
            <button 
              className="confirm-button" 
              onClick={handleConfirm}
              disabled={confirmed}
              title="Confirm Lineup"
              style={{ 
                backgroundColor: confirmed ? '#aaa' : scorelectTheme.accentColor,
                opacity: confirmed ? 0.7 : 1 
              }}
            >
              <Check size={16} />
              <span>Confirm</span>
            </button>
            
            <button 
              className="reset-button" 
              onClick={handleResetLineup}
              title="Reset Lineup"
            >
              <RefreshCw size={16} />
              <span>Reset</span>
            </button>
          </div>
        </div>
        
        {/* Player Editor Modal */}
        {renderPlayerEditor()}
      </>
    );
  };
  
  export default GaaLineup;