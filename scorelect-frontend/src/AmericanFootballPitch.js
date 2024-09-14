import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Circle, Arc, Group, Text } from 'react-konva';
import Modal from 'react-modal';
import Konva from 'konva';
import html2canvas from 'html2canvas';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import AggregatedData from './AggregatedData';
import './PitchGraphic.css';
import './SavedGames.css';
import './AggregatedData.css';

const AmericanFootballPitch = ({ userType }) => {
  const [coords, setCoords] = useState([]);
  const [currentCoords, setCurrentCoords] = useState([]);
  const [actionType, setActionType] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openLineDialog, setOpenLineDialog] = useState(false);
  const [formData, setFormData] = useState({
    action: 'pass',
    team: 'Patriots',
    playerName: '',
    player: '',
    position: 'Quarterback',
    pressure: 'Yes',
    foot: 'Right',
    minute: '',
    from: null,
    to: null,
  });
 const [isModalOpen, setIsModalOpen] = useState(false);
  const [customInput, setCustomInput] = useState({ action: '', team: '', position: '', pressure: '', foot: '', color: '#000000', type: 'marker' });
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isAddActionModalOpen, setIsAddActionModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
  const [actionButtons, setActionButtons] = useState([]);
  const [downloadTeam, setDownloadTeam] = useState('');
  const [downloadPlayer, setDownloadPlayer] = useState('');
  const [downloadAction, setDownloadAction] = useState('');
  const [screenshotTeam, setScreenshotTeam] = useState('');
  const [screenshotPlayer, setScreenshotPlayer] = useState('');
  const [screenshotAction, setScreenshotAction] = useState('');
  const stageRef = useRef();
  const [downloadsRemaining, setDownloadsRemaining] = useState(1);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [pitchColor, setPitchColor] = useState('#00A86B');
  const [lineColor, setLineColor] = useState('#FFFFFF');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [displayPlayerNumber, setDisplayPlayerNumber] = useState(false);
  const [displayPlayerName, setDisplayPlayerName] = useState(false);
  const [teams, setTeams] = useState([{ name: '', players: [] }]);
  const [isSetupTeamsModalOpen, setIsSetupTeamsModalOpen] = useState(false);
  const [team1Players, setTeam1Players] = useState(Array(11).fill({ name: '' }));
  const [team2Players, setTeam2Players] = useState(Array(11).fill({ name: '' }));
  const [team1Color, setTeam1Color] = useState({ main: '#FF0000', secondary: '#FFFFFF' }); // Arsenal (Red and White)
  const [team2Color, setTeam2Color] = useState({ main: '#0000FF', secondary: '#FFFFFF' }); // Brighton (Blue and White)
  const [isSetupTeamModalOpen, setIsSetupTeamModalOpen] = useState(false); // State for Setup Team modal
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');

  const pitchWidth = 120;
  const pitchHeight = 53.3;
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 355.33 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [gameName, setGameName] = useState('');
  const [showSetupTeamsContainer, setShowSetupTeamsContainer] = useState(false);

  useEffect(() => {
    if (location.state && location.state.loadedCoords) {
      setCoords(location.state.loadedCoords);
    }
  }, [location.state]);

  useEffect(() => {
    // Set initial action buttons
    setActionButtons([
      { label: 'Pass', value: 'pass', color: '#1E90FF', type: 'line' },
      { label: 'Run', value: 'run', color: '#32CD32', type: 'line' },
      { label: 'Tackle', value: 'tackle', color: '#FF4500', type: 'marker' },
      { label: 'Touchdown', value: 'touchdown', color: '#FFD700', type: 'marker' },
      { label: 'Field Goal', value: 'field goal', color: '#800080', type: 'marker' },
      { label: 'Interception', value: 'interception', color: '#FF8C00', type: 'marker' },
      { label: 'Fumble', value: 'fumble', color: '#8B4513', type: 'marker' },
    ]);
  }, []);


  const handleSetupTeams = () => {
    setIsSetupTeamModalOpen(false);
    setShowSetupTeamsContainer(true);
  };  

  const handleSaveGame = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user && userType === 'paid') {
      const sportType = 'AmericanFootball';
      await setDoc(doc(firestore, 'savedGames', user.uid, 'games', gameName), {
        gameData: coords,
        name: gameName,
        date: new Date().toISOString(),
        sport: sportType,
      });
      setIsSaveModalOpen(false);
    } else {
      Swal.fire('Please upgrade to save games.');
    }
  };

  const initialActionCodes = [
    'pass',
    'run',
    'tackle',
    'touchdown',
    'field goal',
    'interception',
    'fumble',
  ];

  const initialNFLTeams = [
    'Patriots',
    'Bills',
    'Dolphins',
    'Jets',
    'Ravens',
    'Bengals',
    'Browns',
    'Steelers',
    'Texans',
    'Colts',
    'Jaguars',
    'Titans',
    'Broncos',
    'Chiefs',
    'Raiders',
    'Chargers',
    'Cowboys',
    'Giants',
    'Eagles',
    'Commanders',
    'Bears',
    'Lions',
    'Packers',
    'Vikings',
    'Falcons',
    'Panthers',
    'Saints',
    'Buccaneers',
    'Cardinals',
    'Rams',
    '49ers',
    'Seahawks',
  ];

  const initialPositions = [
    'Quarterback',
    'Running Back',
    'Wide Receiver',
    'Tight End',
    'Offensive Lineman',
    'Defensive Lineman',
    'Linebacker',
    'Cornerback',
    'Safety',
    'Kicker',
    'Punter',
  ];
  
  const pressures = ['Yes', 'No'];
  const feet = ['Right', 'Left'];

  const [actionCodes, setActionCodes] = useState(initialActionCodes);
  const [positions, setPositions] = useState(initialPositions);
  const [recentActions, setRecentActions] = useState([]);
  const [recentTeams, setRecentTeams] = useState([]);
  const [NFLTeams, setNFLTeams] = useState(initialNFLTeams);

    useEffect(() => {
      const handleKeyPress = (e) => {
        if (e.key === 'p') setActionType('pass');
        if (e.key === 'r') setActionType('run');
        if (e.key === 't') setActionType('tackle');
        if (e.key === 'd') setActionType('touchdown');
        if (e.key === 'f') setActionType('field goal');
        if (e.key === 'i') setActionType('interception');
      };
      window.addEventListener('keypress', handleKeyPress);
      return () => {
        window.removeEventListener('keypress', handleKeyPress);
      };
    }, []);
  

    useEffect(() => {
      const auth = getAuth();
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUser(user);
          const docRef = doc(firestore, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            const lastDownloadDate = userData.lastDownloadDate;
            const today = new Date().toLocaleDateString();
            if (lastDownloadDate === today) {
              setDownloadsRemaining(userData.downloadsRemaining);
            } else {
              await setDoc(docRef, { lastDownloadDate: today, downloadsRemaining: 1 }, { merge: true });
              setDownloadsRemaining(1);
            }
          } else {
            await setDoc(docRef, { lastDownloadDate: new Date().toLocaleDateString(), downloadsRemaining: 1 });
            setDownloadsRemaining(1);
          }
        } else {
          const storedDownloadCount = localStorage.getItem('downloadCount');
          const lastDownloadDate = localStorage.getItem('lastDownloadDate');
          const today = new Date().toLocaleDateString();
          if (lastDownloadDate === today) {
            setDownloadsRemaining(parseInt(storedDownloadCount, 10) || 0);
          } else {
            localStorage.setItem('lastDownloadDate', today);
            localStorage.setItem('downloadCount', '1');
            setDownloadsRemaining(1);
          }
        }
      });
    }, []);

    const handleClick = (e) => {
      const stage = e.target.getStage();
      const point = stage.getPointerPosition();
      const newCoord = { x: point.x / xScale, y: point.y / yScale };
  
      if (actionType && actionType.type === 'line') {
        setCurrentCoords([...currentCoords, newCoord]);
        if (currentCoords.length === 1) {
          setFormData({ ...formData, from: currentCoords[0], to: newCoord, type: actionType.value });
          setOpenLineDialog(true);
        }
      } else if (actionType) {
        setFormData({ ...formData, x: newCoord.x, y: newCoord.y, type: actionType.value });
        setOpenDialog(true);
      }
    };
  
    const handleTap = (e) => {
      handleClick(e);
    };


  const handlePlayerClick = (team, playerName, playerNumber) => {
    setFormData({
      ...formData,
      team: team,
      playerName: playerName,
      player: playerNumber,
    });
  };
  
    const handleRightClick = (e) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const point = stage.getPointerPosition();
      setCurrentCoords({ x: point.x / xScale, y: point.y / yScale });
      setIsContextMenuOpen(true);
      setContextMenuPosition({ x: point.x, y: point.y });
    };
  
    const handleCloseDialog = () => {
      setOpenDialog(false);
    };
  
    const handleCloseLineDialog = () => {
      setOpenLineDialog(false);
    };
  
  const handleFormSubmit = async () => {
    if (customInput.action) {
      setActionCodes([...actionCodes, customInput.action]);
      formData.action = customInput.action;
    }
    if (customInput.team) {
      setTeams([...teams, customInput.team]);
      formData.team = customInput.team;
    }
    if (customInput.position) {
      setPositions([...positions, customInput.position]);
      formData.position = customInput.position;
    }
    if (customInput.pressure) {
      pressures.push(customInput.pressure);
      formData.pressure = customInput.pressure;
    }
    if (customInput.foot) {
      feet.push(customInput.foot);
      formData.foot = customInput.foot;
    }

    const updatedFormData = {
      action: formData.action || actionCodes[0],
      team: formData.team || teams[0],
      playerName: formData.playerName || '',
      player: formData.player || '',
      position: formData.position || positions[0],
      pressure: formData.pressure || pressures[0],
      foot: formData.foot || feet[0],
      minute: formData.minute || '',
      x: formData.x,
      y: formData.y,
      type: formData.type,
      from: formData.from,
      to: formData.to
    };
    setCoords([...coords, updatedFormData]);
    setOpenDialog(false);
    setOpenLineDialog(false);
    setRecentActions([formData.action, ...recentActions.filter(action => action !== formData.action)]);
    setRecentTeams([formData.team, ...recentTeams.filter(team => team !== formData.team)]);
    setFormData({
      action: 'pass',
      team: 'Patriots',
      playerName: '',
      player: '',
      position: 'Quarterback',
      pressure: 'Yes',
      foot: 'Right',
      minute: '',
      from: null,
      to: null
    });
    setCurrentCoords([]);
    setCustomInput({ action: '', team: '', position: '', pressure: '', foot: '', color: '#000000', type: 'marker' });
    setIsContextMenuOpen(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleActionButtonClick = (action) => {
    setActionType(action);
    setFormData({ ...formData, action: action.value });
  };

  const handleClearMarkers = () => {
    setCoords([]);
  };

  const handleUndoLastMarker = () => {
    setCoords(coords.slice(0, -1));
  };

  // Function to handle downloading all data
  const handleDownloadData = async () => {
    const jsonData = JSON.stringify(coords, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coordinates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Function to handle downloading filtered data
  const handleDownloadFilteredData = async () => {
    const filteredCoords = coords.filter(coord => {
      return (
        (downloadTeam ? coord.team === downloadTeam : true) &&
        (downloadPlayer ? coord.playerName === downloadPlayer : true) &&
        (downloadAction ? coord.action === downloadAction : true)  // Include action filter
      );
    });

    const jsonData = JSON.stringify(filteredCoords, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_coordinates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setIsDownloadModalOpen(false);
  };


  const handleDownloadScreenshot = async () => {
    const filteredCoords = coords.filter(coord => {
      return (
        (screenshotTeam ? coord.team === screenshotTeam : true) &&
        (screenshotPlayer ? coord.playerName === screenshotPlayer : true) &&
        (screenshotAction ? coord.action === screenshotAction : true)
      );
    });
  
    const screenshotLayer = document.createElement('div');
    document.body.appendChild(screenshotLayer);
  
    const stage = new Konva.Stage({
      container: screenshotLayer,
      width: pitchWidth * xScale,
      height: pitchHeight * yScale
    });
  
    const layer = new Konva.Layer();
    stage.add(layer);
  
    renderFootballFieldForScreenshot(layer);
  
    filteredCoords.forEach(coord => {
      if (coord.from && coord.to) {
        const line = new Konva.Line({
          points: [
            coord.from.x * xScale,
            coord.from.y * yScale,
            coord.to.x * xScale,
            coord.to.y * yScale
          ],
          stroke: getColor(coord.type),
          strokeWidth: 2
        });
        layer.add(line);
      } else {
        const shape = new Konva.Circle({
          x: coord.x * xScale,
          y: coord.y * yScale,
          radius: 5,
          fill: getColor(coord.type)
        });
        layer.add(shape);
  
        if (displayPlayerNumber && coord.player) {
          const playerNumberText = new Konva.Text({
            x: coord.x * xScale - 5,
            y: coord.y * yScale - 3,
            text: coord.player,
            fontSize: 8,
            fill: "white",
            align: "center"
          });
          layer.add(playerNumberText);
        }
  
        if (displayPlayerName && coord.playerName) {
          const playerNameText = new Konva.Text({
            x: coord.x * xScale - 28,
            y: coord.y * yScale - 16,
            text: coord.playerName,
            fontSize: 10,
            fill: "black",
            align: "center"
          });
          layer.add(playerNameText);
        }
      }
    });
  
    layer.draw();
  
    html2canvas(screenshotLayer, {
      width: pitchWidth * xScale,
      height: pitchHeight * yScale,
    }).then(canvas => {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'screenshot.png';
      link.click();
      document.body.removeChild(screenshotLayer);
    });
  
    setIsScreenshotModalOpen(false);
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const toggleDownloadModal = () => {
    if (userType === 'paid') {
      setIsDownloadModalOpen(!isDownloadModalOpen);
    } else {
      Swal.fire('This feature is only available for paid users.');
    }
  };
  
  const toggleScreenshotModal = () => {
    if (userType === 'paid') {
      setIsScreenshotModalOpen(!isScreenshotModalOpen);
    } else {
      Swal.fire('This feature is only available for paid users.');
    }
  };
  

  const handleResize = (width, height) => {
    setCanvasSize({ width, height });
  };

  const renderFootballField = () => (
    <Layer>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill={pitchColor} />

      {/* Side and goal lines */}
      <Line points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} stroke={lineColor} strokeWidth={2} />

      {/* End zones */}
      <Rect x={0} y={0} width={xScale * 10} height={canvasSize.height} fill="#FF0000" opacity={0.3} />
      <Rect x={canvasSize.width - xScale * 10} y={0} width={xScale * 10} height={canvasSize.height} fill="#FF0000" opacity={0.3} />

      {/* "SCORELECT" in the end zones */}
      <Text text="SCORELECT.COM" x={xScale * 2.5} y={canvasSize.height / 1.07} fontSize={canvasSize.width / 22.5} fill="#FFF" rotation={-90} align="center" />
      <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 2.5} y={canvasSize.height / 14} fontSize={canvasSize.width / 22.5} fill="#FFF" rotation={90} align="center" />

      {/* Yard lines */}
      {[...Array(11)].map((_, i) => (
        <Line key={i} points={[xScale * (10 + i * 10), 0, xScale * (10 + i * 10), canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      ))}

      {/* Hash marks */}
      {[...Array(11)].map((_, i) => (
        <>
          <Line key={`left-${i}`} points={[xScale * (10 + i * 10), yScale * 23.5, xScale * (10 + i * 10), yScale * 29.8]} stroke={lineColor} strokeWidth={2} />
          <Line key={`right-${i}`} points={[xScale * (10 + i * 10), yScale * 53.3 - yScale * 23.5, xScale * (10 + i * 10), yScale * 53.3 - yScale * 29.8]} stroke={lineColor} strokeWidth={2} />
        </>
      ))}

      {/* Yard line numbers */}
      {Array.from({ length: 4 }, (_, i) => (
        <>
          {/* Left side */}
          <Text key={`left-${i}`} text={`${10 + i * 10}`} x={xScale * (19.6 + i * 10) - canvasSize.width / 100} y={yScale * 3} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
          <Text key={`left-${i}-bottom`} text={`${10 + i * 10}`} x={xScale * (19.6 + i * 10) - canvasSize.width / 100} y={canvasSize.height - yScale * 4} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
          {/* Right side */}
          <Text key={`right-${i}`} text={`${10 + i * 10}`} x={canvasSize.width - xScale * (20.4 + i * 10) - canvasSize.width / 100} y={yScale * 3} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
          <Text key={`right-${i}-bottom`} text={`${10 + i * 10}`} x={canvasSize.width - xScale * (20.4 + i * 10) - canvasSize.width / 100} y={canvasSize.height - yScale * 4} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
        </>
      ))}

      {/* 50 yard line */}
      <Text text="50" x={canvasSize.width / 2.0175 - canvasSize.width / 100} y={yScale * 3} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
      <Text text="50" x={canvasSize.width / 2.0175 - canvasSize.width / 100} y={canvasSize.height - yScale * 4} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
    </Layer>
  );

  const renderFootballFieldForScreenshot = (layer) => {
    const fieldRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height,
      fill: pitchColor
    });
    layer.add(fieldRect);

    // Side and goal lines
    const fieldLines = new Konva.Line({
      points: [0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0],
      stroke: lineColor,
      strokeWidth: 2
    });
    layer.add(fieldLines);

    // End zones
    const endZoneLeft = new Konva.Rect({
      x: 0,
      y: 0,
      width: xScale * 10,
      height: canvasSize.height,
      fill: "#FF0000",
      opacity: 0.3
    });
    layer.add(endZoneLeft);
    const endZoneRight = new Konva.Rect({
      x: canvasSize.width - xScale * 10,
      y: 0,
      width: xScale * 10,
      height: canvasSize.height,
      fill: "#FF0000",
      opacity: 0.3
    });
    layer.add(endZoneRight);

    // Yard lines
    for (let i = 0; i < 11; i++) {
      const yardLine = new Konva.Line({
        points: [xScale * (10 + i * 10), 0, xScale * (10 + i * 10), canvasSize.height],
        stroke: lineColor,
        strokeWidth: 2
      });
      layer.add(yardLine);
    }

    // Hash marks
    for (let i = 0; i < 11; i++) {
      const hashMarkLeft = new Konva.Line({
        points: [xScale * (10 + i * 10), yScale * 23.5, xScale * (10 + i * 10), yScale * 29.8],
        stroke: lineColor,
        strokeWidth: 2
      });
      layer.add(hashMarkLeft);
      const hashMarkRight = new Konva.Line({
        points: [xScale * (10 + i * 10), yScale * 53.3 - yScale * 23.5, xScale * (10 + i * 10), yScale * 53.3 - yScale * 29.8],
        stroke: lineColor,
        strokeWidth: 2
      });
      layer.add(hashMarkRight);
    }

    // Yard line numbers
    const yardLineNumbers = [10, 20, 30, 40, 50, 40, 30, 20, 10];
    yardLineNumbers.forEach((number, i) => {
      const textLeft = new Konva.Text({
        text: `${number}`,
        x: xScale * (19.6 + i * 10) - canvasSize.width / 100,
        y: yScale * 3,
        fontSize: canvasSize.width / 40,
        fill: lineColor,
        align: "center"
      });
      layer.add(textLeft);
      const textRight = new Konva.Text({
        text: `${number}`,
        x: canvasSize.width - xScale * (20.4 + i * 10) - canvasSize.width / 100,
        y: yScale * 3,
        fontSize: canvasSize.width / 40,
        fill: lineColor,
        align: "center"
      });
      layer.add(textRight);
    });

    const fiftyYardLine = new Konva.Text({
      text: "50",
      x: canvasSize.width / 2.0175 - canvasSize.width / 100,
      y: yScale * 3,
      fontSize: canvasSize.width / 40,
      fill: lineColor,
      align: "center"
    });
    layer.add(fiftyYardLine);
  };

  const getColor = (type) => {
    const button = actionButtons.find((button) => button.value === type);
    return button ? button.color : 'black';
  };

  const handleDeleteAction = (actionToDelete) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this action button?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        setActionButtons(actionButtons.filter(button => button.value !== actionToDelete));
        setActionCodes(actionCodes.filter(action => action !== actionToDelete));
      }
    });
  };
  
  const handleAddAction = (newAction, newColor, newType) => {
    if (!actionCodes.includes(newAction)) {
      setActionButtons([...actionButtons, { label: newAction.charAt(0).toUpperCase() + newAction.slice(1), value: newAction, color: newColor, type: newType }]);
      setActionCodes([...actionCodes, newAction]);
    }
    setIsAddActionModalOpen(false);
  };

  const renderActionButtons = () => (
    <div className="action-buttons">
      {actionButtons.map(action => (
        <button
          key={action.value}
          className={`action-button ${action.value}`}
          onClick={() => handleActionButtonClick(action)}
          onContextMenu={(e) => {
            e.preventDefault();
            handleDeleteAction(action.value);
          }}
          style={{ borderColor: action.color, borderWidth: '2px', borderStyle: 'solid', backgroundColor: '#800080' }} 
        >
          {action.label}
        </button>
      ))}
      <button className="action-button add-action" onClick={() => setIsAddActionModalOpen(true)}>Add Action</button>
    </div>
  );

  
  const renderContextMenu = () => (
    <div className="context-menu" style={{ top: contextMenuPosition.y, left: contextMenuPosition.x }}>
      <label>Player Number:</label>
      <input type="text" value={formData.player} onChange={handleChange} name="player" />
      <label>Action:</label>
      <select name="action" value={formData.action} onChange={handleChange}>
        {actionCodes.map(action => <option key={action} value={action}>{action}</option>)}
      </select>
      <button onClick={handleFormSubmit}>Submit</button>
    </div>
  );

  const addPlayerToTeam1 = () => {
    setTeam1Players([...team1Players, { name: '', number: '' }]);
  };
  
  const addPlayerToTeam2 = () => {
    setTeam2Players([...team2Players, { name: '', number: '' }]);
  };

  const updatePlayerInTeam1 = (index, field, value) => {
    const updatedPlayers = team1Players.map((player, i) =>
      i === index ? { ...player, [field]: value } : player
    );
    setTeam1Players(updatedPlayers);
  };

  const updatePlayerInTeam2 = (index, field, value) => {
    const updatedPlayers = team2Players.map((player, i) =>
      i === index ? { ...player, [field]: value } : player
    );
    setTeam2Players(updatedPlayers);
  };
  
  const removePlayerFromTeam1 = (index) => {
    const updatedPlayers = team1Players.filter((_, i) => i !== index);
    setTeam1Players(updatedPlayers);
  };
  
  const removePlayerFromTeam2 = (index) => {
    const updatedPlayers = team2Players.filter((_, i) => i !== index);
    setTeam2Players(updatedPlayers);
  };

  const renderTeamPlayers = (teamName, teamPlayers, teamColor) => (
    <div>
      <h4>{teamName}</h4>
      <div className="team-players">
        {teamPlayers.map((player, index) => (
          <button
            key={index}
            onClick={() => handlePlayerClick(teamName, player.name, player.number)}
            className="player-button"
            style={{
              backgroundColor: teamColor.main,
              color: teamColor.secondary,
              border: `2px solid ${teamColor.secondary}`,
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            {player.name} ({player.number})
          </button>
        ))}
      </div>
    </div>
  );


  // Aggregate data by team and action
  const aggregateData = coords.reduce((acc, curr) => {
    const { team, action } = curr;
    if (!acc[team]) {
      acc[team] = {};
    }
    if (!acc[team][action]) {
      acc[team][action] = 0;
    }
    acc[team][action]++;
    return acc;
  }, {});

  useEffect(() => {
    console.log('Coords updated:', coords);
  }, [coords]);

  return (
    <div class="scroll-container">
    <div className="pitch-container">
    {showSetupTeamsContainer && (
        <div className="setup-team-container">
          <h3>Setup Team</h3>
          <div className="team-buttons-wrapper">
            <div className="team-buttons-container">
              {renderTeamPlayers(team1, team1Players, team1Color)}
              {renderTeamPlayers(team2, team2Players, team2Color)}
            </div>
          </div>
        </div>
      )}




      <div className="content">
        <div className="instructions-container">
          <h3>Instructions</h3>
          {renderActionButtons()}
          <p>Click on an action then on the pitch to record action at that location. Use the buttons above to specify the type of action. For actions (g, b), you will be prompted to enter additional details.</p>
          <div className="toggle-switches">
          <label>
            <input
              type="checkbox"
              checked={displayPlayerNumber}
              onChange={() => setDisplayPlayerNumber(!displayPlayerNumber)}
            />
            Player Number
          </label>
          <label>
            <input
              type="checkbox"
              checked={displayPlayerName}
              onChange={() => setDisplayPlayerName(!displayPlayerName)}
            />
            Player Name
          </label>
        </div>
        <div className="button-container">
          <button className="button" onClick={handleClearMarkers}>Clear Markers</button>
          <button className="button" onClick={handleUndoLastMarker}>Undo Last Marker</button>
          <button className="button" onClick={handleDownloadData}>{userType === 'free' ? `Download Data (${downloadsRemaining} left)` : 'Download Data (Unlimited)'}</button>
          <button className="button" onClick={toggleDownloadModal} disabled={userType === 'free'}> Download Filtered Data </button>
          <button className="button" onClick={toggleScreenshotModal} disabled={userType === 'free'}>Download Screenshot</button>
          <button className="button" onClick={toggleModal}>View Coordinates</button>
          <button className="button" onClick={() => setIsSaveModalOpen(true) } disabled={userType === 'free'}>Save Game</button>
          <button className="button" onClick={() => setIsSettingsModalOpen(true)}>Settings</button> {/* Settings button */}
          <button className="button" onClick={() => setIsSetupTeamModalOpen(true)}>Setup Team</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <button className="button" onClick={() => handleResize(375, 166.56)}>iPhone</button>
            <button className="button" onClick={() => handleResize(600, 266.50)}>iPad</button>
            <button className="button" onClick={() => handleResize(800, 355.33)}>Computer</button>
          </div>
          <div className="custom-slider-container">
            <label htmlFor="customZoom">Custom:</label>
            <input
              type="range"
              id="customZoom"
              min="0.5"
              max="2"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => {
                setZoomLevel(e.target.value);
                handleResize(canvasSize.width * e.target.value, canvasSize.height * e.target.value);
              }}
            />
          </div>
        </div>
        </div>

        <div className="pitch-and-data-container">
      <div className="stage-container"></div>
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleClick}
          onContextMenu={handleRightClick}
          onTap={handleTap}
          ref={stageRef}
          scaleX={zoomLevel}
          scaleY={zoomLevel}
        >
          {renderFootballField()}
          {isContextMenuOpen && renderContextMenu()}
          <Layer>
            {coords.map((coord, index) => {
              if (coord.from && coord.to) {
                return (
                  <Line
                    key={index}
                    points={[
                      coord.from.x * xScale,
                      coord.from.y * yScale,
                      coord.to.x * xScale,
                      coord.to.y * yScale
                    ]}
                    stroke={getColor(coord.type)}
                    strokeWidth={2}
                  />
                );
              }
      return (
        <Group key={index}>
          <Circle
            x={coord.x * xScale}
            y={coord.y * yScale}
            radius={6}
            fill={getColor(coord.type)}
          />
          {displayPlayerNumber && (
            <Text
              x={coord.x * xScale}
              y={coord.y * yScale - 4}  // Adjusted to align the text vertically better
              text={coord.player}
              fontSize={8}
              fill="white"
              align="center"
              width={10}  // Set the width to ensure consistent alignment
              offsetX={coord.player.length === 1 ? 4.5 : 4.5}  // Fine-tuned offset values for better centering
              />
          )}
          {displayPlayerName && (
            <Text
              x={coord.x * xScale}
              y={coord.y * yScale - 16}  // Position the name above the marker
              text={coord.playerName}
              fontSize={10}
              fill="black"
              align="center"
              width={coord.playerName.length * 6}  // Adjust the width based on the name length
              offsetX={(coord.playerName.length * 6) / 2}  // Center the text horizontally
            />
          )}
        </Group>
      );
    })}
  </Layer>
</Stage>
<div className="aggregated-data-container">
      <AggregatedData data={aggregateData} />
    </div>
  </div>
</div>

      </div>
      {openDialog && (
        <div className="dialog-container">
          <h3>Enter Action Details</h3>
          <div className="form-group">
            <label>Action:</label>
            <select name="action" value={formData.action} onChange={handleChange}>
              <option value="custom">Add New Action</option>
              {recentActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
              {actionCodes.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            {formData.action === 'custom' && (
              <div className="form-group">
                <label>New Action:</label>
                <input
                  type="text"
                  name="customAction"
                  value={customInput.action}
                  onChange={(e) => setCustomInput({ ...customInput, action: e.target.value })}
                />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Team:</label>
            <select name="team" value={formData.team} onChange={handleChange}>
                <option value="custom">Add New Team</option>
                {recentTeams.map((team) => (
                  <option key={team.name} value={team.name}>
                    {team.name}
                  </option>
                ))}
                {teams.map((team) => (
                  <option key={team.name} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>

            {formData.team === 'custom' && (
              <div className="form-group">
                <label>New Team Name:</label>
                <input
                  type="text"
                  name="customTeam"
                  value={customInput.team}
                  onChange={(e) => setCustomInput({ ...customInput, team: e.target.value })}
                />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Player Name:</label>
            <input type="text" name="playerName" value={formData.playerName} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Player Number:</label>
            <input type="text" name="player" value={formData.player} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Position:</label>
            <select name="position" value={formData.position} onChange={handleChange}>
              <option value="custom">Add New Position</option>
              {positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
            {formData.position === 'custom' && (
              <div className="form-group">
                <label>New Position:</label>
                <input
                  type="text"
                  name="customPosition"
                  value={customInput.position}
                  onChange={(e) => setCustomInput({ ...customInput, position: e.target.value })}
                />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Pressure:</label>
            <select name="pressure" value={formData.pressure} onChange={handleChange}>
              <option value="custom">Add New Pressure</option>
              {pressures.map((pressure) => (
                <option key={pressure} value={pressure}>
                  {pressure}
                </option>
              ))}
            </select>
            {formData.pressure === 'custom' && (
              <div className="form-group">
                <label>New Pressure:</label>
                <input
                  type="text"
                  name="customPressure"
                  value={customInput.pressure}
                  onChange={(e) => setCustomInput({ ...customInput, pressure: e.target.value })}
                />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Foot:</label>
            <select name="foot" value={formData.foot} onChange={handleChange}>
              <option value="custom">Add New Foot</option>
              {feet.map((foot) => (
                <option key={foot} value={foot}>
                  {foot}
                </option>
              ))}
            </select>
            {formData.foot === 'custom' && (
              <div className="form-group">
                <label>New Foot:</label>
                <input
                  type="text"
                  name="customFoot"
                  value={customInput.foot}
                  onChange={(e) => setCustomInput({ ...customInput, foot: e.target.value })}
                />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Minute:</label>
            <input type="text" name="minute" value={formData.minute} onChange={handleChange} />
          </div>
          <div className="button-container">
            <button className="button" onClick={handleCloseDialog}>
              Cancel
            </button>
            <button className="button" onClick={handleFormSubmit}>
              Submit
            </button>
          </div>
        </div>
      )}
      {openLineDialog && (
        <div className="dialog-container">
          <h3>Enter Action Details for Line</h3>
          <div className="form-group">
            <label>Action:</label>
            <select name="action" value={formData.action} onChange={handleChange}>
              <option value="custom">Add New Action</option>
              {recentActions.map(action => <option key={action} value={action}>{action}</option>)}
              {actionCodes.map(action => <option key={action} value={action}>{action}</option>)}
            </select>
            {formData.action === 'custom' && (
              <div className="form-group">
                <label>New Action:</label>
                <input type="text" name="customAction" value={customInput.action} onChange={(e) => setCustomInput({ ...customInput, action: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Team:</label>
            <select name="team" value={formData.team} onChange={handleChange}>
              <option value="custom">Add New Team</option>
              {recentTeams.map(team => <option key={team} value={team}>{team}</option>)}
              {teams.map(team => <option key={team} value={team}>{team}</option>)}
            </select>
            {formData.team === 'custom' && (
              <div className="form-group">
                <label>New Team Name:</label>
                <input type="text" name="customTeam" value={customInput.team} onChange={(e) => setCustomInput({ ...customInput, team: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Player Name:</label>
            <input type="text" name="playerName" value={formData.playerName} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Player Number:</label>
            <input type="text" name="player" value={formData.player} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Position:</label>
            <select name="position" value={formData.position} onChange={handleChange}>
              <option value="custom">Add New Position</option>
              {positions.map(position => <option key={position} value={position}>{position}</option>)}
            </select>
            {formData.position === 'custom' && (
              <div className="form-group">
                <label>New Position:</label>
                <input type="text" name="customPosition" value={customInput.position} onChange={(e) => setCustomInput({ ...customInput, position: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Pressure:</label>
            <select name="pressure" value={formData.pressure} onChange={handleChange}>
              <option value="custom">Add New Pressure</option>
              {pressures.map(pressure => <option key={pressure} value={pressure}>{pressure}</option>)}
            </select>
            {formData.pressure === 'custom' && (
              <div className="form-group">
                <label>New Pressure:</label>
                <input type="text" name="customPressure" value={customInput.pressure} onChange={(e) => setCustomInput({ ...customInput, pressure: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Foot:</label>
            <select name="foot" value={formData.foot} onChange={handleChange}>
              <option value="custom">Add New Foot</option>
              {feet.map(foot => <option key={foot} value={foot}>{foot}</option>)}
            </select>
            {formData.foot === 'custom' && (
              <div className="form-group">
                <label>New Foot:</label>
                <input type="text" name="customFoot" value={customInput.foot} onChange={(e) => setCustomInput({ ...customInput, foot: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Minute:</label>
            <input type="text" name="minute" value={formData.minute} onChange={handleChange} />
          </div>
          <div className="button-container">
            <button className="button" onClick={handleCloseLineDialog}>Cancel</button>
            <button className="button" onClick={handleFormSubmit}>Submit</button>
          </div>
        </div>
      )}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={toggleModal}
        contentLabel="Coordinates Data"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxHeight: '60%',
            overflowY: 'auto',
          },
        }}
      >
        <h2>Coordinates Data</h2>
        <button onClick={toggleModal}>Close</button>
        <div style={{ marginTop: '10px', backgroundColor: 'Grey', padding: '10px', border: '1px solid #ccc' }}>
          <ul style={{ listStyleType: 'none', padding: '0' }}>
            {coords.map((coord, index) => (
              <li key={index}>
              <strong>Action:</strong> {coord.action}
              <br />
              <strong>Team:</strong> {coord.team}
              <br />
              <strong>Player Number:</strong> {coord.player}
              <br />
              <strong>Player Name:</strong> {coord.playerName}
              <br />
              <strong>Position:</strong> {coord.position}
              <br />
              <strong>Pressure:</strong> {coord.pressure}
              <br />
              <strong>Foot:</strong> {coord.foot}
              <br />
              <strong>Minute:</strong> {coord.minute}
              <br />
              {coord.from && coord.to ? (
                <>
                  <strong>From X:</strong> {coord.from.x?.toFixed(2)}, <strong>From Y:</strong> {coord.from.y?.toFixed(2)}
                  <br />
                  <strong>To X:</strong> {coord.to.x?.toFixed(2)}, <strong>To Y:</strong> {coord.to.y?.toFixed(2)}
                </>
              ) : (
                <>
                  <strong>X:</strong> {coord.x?.toFixed(2)}, <strong>Y:</strong> {coord.y?.toFixed(2)}
                </>
              )}
            </li>
            
            ))}
          </ul>
        </div>
      </Modal>
      <Modal
        isOpen={isSaveModalOpen}
        onRequestClose={() => setIsSaveModalOpen(false)}
        contentLabel="Save Game"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '50%',
            maxHeight: '60%',
            overflowY: 'auto',
            background: '#2e2e2e',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <h2>Save Game</h2>
        <input
          type="text"
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          placeholder="Enter game name"
          style={{
            width: '97%',
            padding: '10px',
            margin: '5px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            marginRight: '20px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={handleSaveGame}
            style={{
              background: '#007bff',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Save
          </button>
          <button
            onClick={() => setIsSaveModalOpen(false)}
            style={{
              background: '#6c757d',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={isAddActionModalOpen}
        onRequestClose={() => setIsAddActionModalOpen(false)}
        contentLabel="Add Action"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '50%',
            maxHeight: '60%',
            overflowY: 'auto',
            background: '#2e2e2e',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <h2>Add Action</h2>
        <div className="form-group">
          <label>Action Name:</label>
          <input
            type="text"
            value={customInput.action}
            onChange={(e) => setCustomInput({ ...customInput, action: e.target.value })}
            placeholder="Enter new action"
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          />
          <label>Marker Color:</label>
          <input
            type="color"
            value={customInput.color}
            onChange={(e) => setCustomInput({ ...customInput, color: e.target.value })}
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          />
          <label>Type:</label>
          <select
            value={customInput.type}
            onChange={(e) => setCustomInput({ ...customInput, type: e.target.value })}
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          >
            <option value="marker">Marker</option>
            <option value="line">Line</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => handleAddAction(customInput.action, customInput.color, customInput.type)}
            style={{
              background: '#007bff',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Add Action
          </button>
          <button
            onClick={() => setIsAddActionModalOpen(false)}
            style={{
              background: '#6c757d',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={isDownloadModalOpen}
        onRequestClose={() => setIsDownloadModalOpen(false)}
        contentLabel="Download Filtered Data"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '50%',
            maxHeight: '60%',
            overflowY: 'auto',
            background: '#2e2e2e',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <h2>Download Filtered Data</h2>
        <div className="form-group">
          <label>Team:</label>
          <select
            value={downloadTeam}
            onChange={(e) => setDownloadTeam(e.target.value)}
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          >
           <option value="">All Teams</option>
              {teams.map((team) => (
                <option key={team.name} value={team.name}>
                  {team.name}
                </option>
              ))}
            </select>
        </div>
        <div className="form-group">
          <label>Player:</label>
          <input
            type="text"
            value={downloadPlayer}
            onChange={(e) => setDownloadPlayer(e.target.value)}
            placeholder="Enter player name"
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          />
        </div>
        <div className="form-group">
          <label>Action:</label>
          <select
            value={downloadAction}
            onChange={(e) => setDownloadAction(e.target.value)}
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          >
            <option value="">All Actions</option>
            {actionCodes.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={handleDownloadFilteredData}
            style={{
              background: '#007bff',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Download
          </button>
          <button
            onClick={() => setIsDownloadModalOpen(false)}
            style={{
              background: '#6c757d',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={isScreenshotModalOpen}
        onRequestClose={() => setIsScreenshotModalOpen(false)}
        contentLabel="Download Screenshot"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '50%',
            maxHeight: '60%',
            overflowY: 'auto',
            background: '#2e2e2e',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <h2>Download Screenshot</h2>
        <div className="form-group">
          <label>Team:</label>
          <select
            value={screenshotTeam}
            onChange={(e) => setScreenshotTeam(e.target.value)}
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          >
            <option value="">All Teams</option>
            {teams.map((team) => (
              <option key={team.name} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Player:</label>
          <input
            type="text"
            value={screenshotPlayer}
            onChange={(e) => setScreenshotPlayer(e.target.value)}
            placeholder="Enter player name"
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          />
        </div>
        <div className="form-group">
          <label>Action:</label>
          <select
            value={screenshotAction}
            onChange={(e) => setScreenshotAction(e.target.value)}
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          >
            <option value="">All Actions</option>
            {actionCodes.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={handleDownloadScreenshot}
            style={{
              background: '#007bff',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Download
          </button>
          <button
            onClick={() => setIsScreenshotModalOpen(false)}
            style={{
              background: '#6c757d',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={isSettingsModalOpen}
        onRequestClose={() => setIsSettingsModalOpen(false)}
        contentLabel="Settings"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '40%',
            maxHeight: '60%',
            overflowY: 'auto',
            background: '#2e2e2e',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <h2>Settings</h2>
        <div className="form-group">
          <label>Pitch Color:</label>
          <input
            type="color"
            value={pitchColor}
            onChange={(e) => setPitchColor(e.target.value)}
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          />
        </div>
        <div className="form-group">
          <label>Line Color:</label>
          <input
            type="color"
            value={lineColor}
            onChange={(e) => setLineColor(e.target.value)}
            style={{
              width: '97%',
              padding: '10px',
              margin: '5px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '20px',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            style={{
              background: '#007bff',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Close
          </button>
        </div>
      </Modal>

      {/* Modal for setting up teams */}
      <Modal
        isOpen={isSetupTeamModalOpen}
        onRequestClose={() => setIsSetupTeamModalOpen(false)}
        contentLabel="Setup Teams"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '60%',
            maxHeight: '80%',
            overflowY: 'auto',
            background: '#2e2e2e',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <h2>Setup Teams</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
          <div className="team-setup">
            <h3>Team 1</h3>
            <input
              type="text"
              value={team1}
              onChange={(e) => setTeam1(e.target.value)}
              placeholder="Team 1 Name"
              style={{
                width: '90%',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
            <div className="form-group">
              <label>Main Color (Button):</label>
              <input
                type="color"
                value={team1Color.main}
                onChange={(e) => setTeam1Color({ ...team1Color, main: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Secondary Color (Text):</label>
              <input
                type="color"
                value={team1Color.secondary}
                onChange={(e) => setTeam1Color({ ...team1Color, secondary: e.target.value })}
              />
            </div>
            <h4>Players</h4>
            {team1Players.map((player, index) => (
              <div key={index} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => updatePlayerInTeam1(index, 'name', e.target.value)}
                  placeholder={`Player ${index + 1} Name`}
                  style={{
                    width: '60%',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    marginRight: '5px',
                  }}
                />
                <input
                  type="text"
                  value={player.number}
                  onChange={(e) => updatePlayerInTeam1(index, 'number', e.target.value)}
                  placeholder="Number"
                  style={{
                    width: '20%',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    marginRight: '5px',
                  }}
                />
                <button
                  onClick={() => removePlayerFromTeam1(index)}
                  style={{
                    background: '#cf4242',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'background 0.3s',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={addPlayerToTeam1}
              style={{
                background: '#007bff',  // Fixed color for Add Player button
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                transition: 'background 0.3s',
              }}
            >
              Add Player
            </button>
          </div>

          <div className="team-setup">
            <h3>Team 2</h3>
            <input
              type="text"
              value={team2}
              onChange={(e) => setTeam2(e.target.value)}
              placeholder="Team 2 Name"
              style={{
                width: '90%',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc',
              }}
            />
            {/* Team 2 Colors */}
            <div className="form-group">
              <label>Main Color (Button):</label>
              <input
                type="color"
                value={team2Color.main}
                onChange={(e) => setTeam2Color({ ...team2Color, main: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Secondary Color (Text):</label>
              <input
                type="color"
                value={team2Color.secondary}
                onChange={(e) => setTeam2Color({ ...team2Color, secondary: e.target.value })}
              />
            </div>
            <h4>Players</h4>
            {team2Players.map((player, index) => (
              <div key={index} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => updatePlayerInTeam2(index, 'name', e.target.value)}
                  placeholder={`Player ${index + 1} Name`}
                  style={{
                    width: '60%',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    marginRight: '5px',
                  }}
                />
                <input
                  type="text"
                  value={player.number}
                  onChange={(e) => updatePlayerInTeam2(index, 'number', e.target.value)}
                  placeholder="Number"
                  style={{
                    width: '20%',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    marginRight: '5px',
                  }}
                />
                <button
                  onClick={() => removePlayerFromTeam2(index)}
                  style={{
                    background: '#cf4242',
                    color: '#fff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'background 0.3s',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={addPlayerToTeam2}
              style={{
                background: '#007bff',
                color: '#fff',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                transition: 'background 0.3s',
              }}
            >
              Add Player
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button
            onClick={handleSetupTeams}
            style={{
              background: '#28a745',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s',
            }}
          >
            Setup Teams
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AmericanFootballPitch;

