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

const BasketballCourt = ({ userType }) => {
  const [coords, setCoords] = useState([]);
  const [currentCoords, setCurrentCoords] = useState([]);
  const [actionType, setActionType] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openLineDialog, setOpenLineDialog] = useState(false);
  const [formData, setFormData] = useState({
    action: 'shot',
    team: 'Lakers',
    playerName: '',
    player: '',
    position: 'forward',
    pressure: 'Yes',
    foot: 'Right',
    minute: '',
    from: null,
    to: null
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
  const [courtColor, setCourtColor] = useState('#D2B48C'); // State for court color
  const [lineColor, setLineColor] = useState('#000000'); // State for line color
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // State for settings modal

  const courtWidth = 94;
  const courtHeight = 50;
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 425 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const xScale = canvasSize.width / courtWidth;
  const yScale = canvasSize.height / courtHeight;
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [gameName, setGameName] = useState('');
  const [displayPlayerNumber, setDisplayPlayerNumber] = useState(false);
  const [displayPlayerName, setDisplayPlayerName] = useState(false);

  useEffect(() => {
    if (location.state && location.state.loadedCoords) {
      setCoords(location.state.loadedCoords);
    }
  }, [location.state]);

  useEffect(() => {
    // Set initial action buttons
    setActionButtons([
      { label: 'Shot', value: 'shot', color: '#009900', type: 'marker' },
      { label: 'Miss', value: 'miss', color: '#ffa500', type: 'marker' },
      { label: 'Pass', value: 'pass', color: '#40bdb2', type: 'line' },
      { label: 'Assist', value: 'assist', color: '#000080', type: 'line' },
      { label: 'Turnover', value: 'turnover', color: '#d64242', type: 'marker' },
      { label: 'Rebound', value: 'rebound', color: '#800080', type: 'marker' }
    ]);
  }, []);

  const handleSaveGame = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user && userType === 'paid') {
      const sportType = 'Basketball';
      await setDoc(doc(firestore, 'savedGames', user.uid, 'games', gameName), {
        gameData: coords,
        name: gameName,
        date: new Date().toISOString(),
        sport: sportType
      });
      setIsSaveModalOpen(false);
    } else {
      Swal.fire('Please upgrade to save games.');
    }
  };

  const initialActionCodes = [
    'shot', 'miss', 'pass', 'assist', 'turnover', 'rebound'
  ];

  const initialPositions = [
    'forward', 'center', 'guard'
  ];

  const nbaTeams = [
    'Lakers', 'Warriors', 'Nets', 'Bucks', 'Clippers', 'Suns', '76ers', 'Jazz', 'Heat', 'Mavericks'
  ];

  const pressures = ['Yes', 'No'];
  const feet = ['Right', 'Left', 'Hand'];

  const [actionCodes, setActionCodes] = useState(initialActionCodes);
  const [positions, setPositions] = useState(initialPositions);
  const [teams, setTeams] = useState(nbaTeams);
  const [recentActions, setRecentActions] = useState([]);
  const [recentTeams, setRecentTeams] = useState([]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'p') setActionType('pass');
      if (e.key === 's') setActionType('shot');
      if (e.key === 'm') setActionType('miss');
      if (e.key === 't') setActionType('turnover');
      if (e.key === 'r') setActionType('rebound');
      if (e.key === 'a') setActionType('assist');
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
      action: 'shot',
      team: 'Lakers',
      playerName: '',
      player: '',
      position: 'forward',
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
  
    // Set the stage dimensions to the exact court dimensions
    const stage = new Konva.Stage({
      container: screenshotLayer,
      width: courtWidth * xScale, // Set width based on court dimensions
      height: courtHeight * yScale // Set height based on court dimensions
    });
  
    const layer = new Konva.Layer();
    stage.add(layer);
  
    // Draw the court and filtered markers
    renderBasketballCourtForScreenshot(layer);
  
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
  
        // Add player number or name if the corresponding checkbox is checked
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
      width: courtWidth * xScale,
      height: courtHeight * yScale,
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

  // JSX-based renderBasketballCourt function for React rendering
  const renderBasketballCourt = () => (
    <Layer>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill={courtColor} />
  
      {/* Court background */}
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill={courtColor} />

      {/* Playing surface outline */}
      <Line points={[
        0, 0,
        canvasSize.width, 0,
        canvasSize.width, canvasSize.height,
        0, canvasSize.height,
        0, 0
      ]} stroke={lineColor} strokeWidth={2} />

      {/* Center circle */}
      <Circle 
        x={canvasSize.width / 2} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke={lineColor} 
        strokeWidth={2} 
      />

      {/* Center line */}
      <Line points={[
        canvasSize.width / 2, 0,
        canvasSize.width / 2, canvasSize.height
      ]} stroke={lineColor} strokeWidth={2} />

      {/* Three-point arcs */}
      <Arc
        x={xScale * 4.92}
        y={canvasSize.height / 2}
        innerRadius={xScale * 23.75}
        outerRadius={xScale * 23.75}
        angle={135}
        rotation={292.5}
        stroke={lineColor}
        strokeWidth={2}
      />
      <Arc
        x={canvasSize.width - (xScale * 4.92)}
        y={canvasSize.height / 2}
        innerRadius={xScale * 23.75}
        outerRadius={xScale * 23.75}
        angle={135}
        rotation={112.5}
        stroke={lineColor}
        strokeWidth={2}
      />

      {/* Free throw circles */}
      <Circle 
        x={xScale * 19} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke={lineColor} 
        strokeWidth={2} 
      />
      <Circle 
        x={canvasSize.width - (xScale * 19)} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke={lineColor} 
        strokeWidth={2} 
      />

      {/* Free throw lanes */}
      <Line points={[
        0, yScale * 19,
        xScale * 19, yScale * 19,
        xScale * 19, canvasSize.height - (yScale * 19),
        0, canvasSize.height - (yScale * 19),
        0, yScale * 19
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        canvasSize.width, yScale * 19,
        canvasSize.width - (xScale * 19), yScale * 19,
        canvasSize.width - (xScale * 19), canvasSize.height - (yScale * 19),
        canvasSize.width, canvasSize.height - (yScale * 19),
        canvasSize.width, yScale * 19
      ]} stroke={lineColor} strokeWidth={2} />

      {/* Outside Free throw lanes */}
      <Line points={[
        0, yScale * 17,
        xScale * 19, yScale * 17,
        xScale * 19, canvasSize.height - (yScale * 17),
        0, canvasSize.height - (yScale * 17),
        0, yScale * 17
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        canvasSize.width, yScale * 17,
        canvasSize.width - (xScale * 19), yScale * 17,
        canvasSize.width - (xScale * 19), canvasSize.height - (yScale * 17),
        canvasSize.width, canvasSize.height - (yScale * 17),
        canvasSize.width, yScale * 17
      ]} stroke={lineColor} strokeWidth={2} />

      {/* Baselines */}
      <Line points={[
        xScale * 14, yScale * 3,
        0, yScale * 3
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        xScale * 14, canvasSize.height - (yScale * 3),
        0, canvasSize.height - (yScale * 3)
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        canvasSize.width - (xScale * 14), yScale * 3,
        canvasSize.width, yScale * 3
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        canvasSize.width - (xScale * 14), canvasSize.height - (yScale * 3),
        canvasSize.width, canvasSize.height - (yScale * 3)
      ]} stroke={lineColor} strokeWidth={2} />

      {/* "SCORELECT" on the court */}
      <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSize.height / 40.25} fontSize={canvasSize.width / 50} f  fill="#D3D3D3" opacity={0.7} rotation={0} align="center" />
      <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 22.5} y={canvasSize.height / 1.02} fontSize={canvasSize.width / 50} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />

    </Layer>

    
  );

  // Function-based renderBasketballCourtForScreenshot for Konva-based rendering
  const renderBasketballCourtForScreenshot = (layer) => {
    const courtRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height,
      fill: courtColor
    });
    layer.add(courtRect);

    const lineColor = '#000';
    const lineWidth = 2;

    // Playing surface outline
    const courtLines = new Konva.Line({
      points: [
        0, 0,
        canvasSize.width, 0,
        canvasSize.width, canvasSize.height,
        0, canvasSize.height,
        0, 0
      ],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(courtLines);

    // Center circle
    const centerCircle = new Konva.Circle({
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      radius: xScale * 6,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(centerCircle);

    // Center line
    const centerLine = new Konva.Line({
      points: [
        canvasSize.width / 2, 0,
        canvasSize.width / 2, canvasSize.height
      ],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(centerLine);

    // Three-point arcs
    const threePointArc1 = new Konva.Arc({
      x: xScale * 4.92,
      y: canvasSize.height / 2,
      innerRadius: xScale * 23.75,
      outerRadius: xScale * 23.75,
      angle: 135,
      rotation: 292.5,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(threePointArc1);
    const threePointArc2 = new Konva.Arc({
      x: canvasSize.width - (xScale * 4.92),
      y: canvasSize.height / 2,
      innerRadius: xScale * 23.75,
      outerRadius: xScale * 23.75,
      angle: 135,
      rotation: 112.5,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(threePointArc2);

    // Free throw circles
    const freeThrowCircle1 = new Konva.Circle({
      x: xScale * 19,
      y: canvasSize.height / 2,
      radius: xScale * 6,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(freeThrowCircle1);
    const freeThrowCircle2 = new Konva.Circle({
      x: canvasSize.width - (xScale * 19),
      y: canvasSize.height / 2,
      radius: xScale * 6,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(freeThrowCircle2);

    // Free throw lanes
    const freeThrowLane1 = new Konva.Line({
      points: [
        0, yScale * 19,
        xScale * 19, yScale * 19,
        xScale * 19, canvasSize.height - (yScale * 19),
        0, canvasSize.height - (yScale * 19),
        0, yScale * 19
      ],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(freeThrowLane1);
    const freeThrowLane2 = new Konva.Line({
      points: [
        canvasSize.width, yScale * 19,
        canvasSize.width - (xScale * 19), yScale * 19,
        canvasSize.width - (xScale * 19), canvasSize.height - (yScale * 19),
        canvasSize.width, canvasSize.height - (yScale * 19),
        canvasSize.width, yScale * 19
      ],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(freeThrowLane2);

    // Baselines
    const baseline1 = new Konva.Line({
      points: [
        xScale * 14, yScale * 3,
        0, yScale * 3
      ],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(baseline1);
    const baseline2 = new Konva.Line({
      points: [
        xScale * 14, canvasSize.height - (yScale * 3),
        0, canvasSize.height - (yScale * 3)
      ],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(baseline2);
    const baseline3 = new Konva.Line({
      points: [
        canvasSize.width - (xScale * 14), yScale * 3,
        canvasSize.width, yScale * 3
      ],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(baseline3);
    const baseline4 = new Konva.Line({
      points: [
        canvasSize.width - (xScale * 14), canvasSize.height - (yScale * 3),
        canvasSize.width, canvasSize.height - (yScale * 3)
      ],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(baseline4);
  };

  const getColor = (type) => {
    const button = actionButtons.find(button => button.value === type);
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
    <div className="pitch-container">
      <div className="content">
        <div className="instructions-container">
          <h3>Instructions</h3>
          {renderActionButtons()}
          <p>Click on an action then on the court to record action at that location. Use the buttons above to specify the type of action. For actions (g, b), you will be prompted to enter additional details.</p>
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
            <button className="button" onClick={toggleDownloadModal}>Download Filtered Data</button>
            <button className="button" onClick={toggleScreenshotModal}>Download Screenshot</button>
            <button className="button" onClick={toggleModal}>View Coordinates</button>
            <button className="button" onClick={() => setIsSaveModalOpen(true)}>Save Game</button>
            <button className="button" onClick={() => setIsSettingsModalOpen(true)}>Settings</button> {/* Settings button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <button className="button" onClick={() => handleResize(375, 199.3)}>iPhone</button>
              <button className="button" onClick={() => handleResize(600, 319)}>iPad</button>
              <button className="button" onClick={() => handleResize(800, 425)}>Computer</button>
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
        {renderBasketballCourt()}
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
                    x={coord.x * xScale + 1}
                    y={coord.y * yScale - 3.5} // Adjusted to align the text above the marker
                    text={coord.player}
                    fontSize={8}
                    fill="white"
                    align="center"
                    width={10} // Set the width to ensure consistent alignment
                    offsetX={coord.player.length === 1 ? 5 : coord.player.length * 3} // Center the text horizontally based on its length
                  />
                )}
                {displayPlayerName && (
                  <Text
                    x={coord.x * xScale}
                    y={coord.y * yScale - 16} // Position the name above the marker
                    text={coord.playerName}
                    fontSize={10}
                    fill="black"
                    align="center"
                    width={coord.playerName.length * 6} // Adjust the width based on the name length
                    offsetX={(coord.playerName.length * 6) / 2} // Center the text horizontally
                  />
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>

      </div>
      {openDialog && (
        <div className="dialog-container">
          <h3>Enter Action Details</h3>
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
            <button className="button" onClick={handleCloseDialog}>Cancel</button>
            <button className="button" onClick={handleFormSubmit}>Submit</button>
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
            overflowY: 'auto'
          }
        }}
      >
        <h2>Coordinates Data</h2>
        <button onClick={toggleModal}>Close</button>
        <div style={{ marginTop: '10px', backgroundColor: 'Grey', padding: '10px', border: '1px solid #ccc' }}>
          <ul style={{ listStyleType: 'none', padding: '0' }}>
            {coords.map((coord, index) => (
              <li key={index}>
                <strong>Action:</strong> {coord.action}<br />
                <strong>Team:</strong> {coord.team}<br />
                <strong>Player Number:</strong> {coord.player}<br />
                <strong>Player Name:</strong> {coord.playerName}<br />
                <strong>Position:</strong> {coord.position}<br />
                <strong>Pressure:</strong> {coord.pressure}<br />
                <strong>Foot:</strong> {coord.foot}<br />
                <strong>Minute:</strong> {coord.minute}<br />
                {coord.from && coord.to ? (
                  <>
                    <strong>From X:</strong> {coord.from.x.toFixed(2)}, <strong>From Y:</strong> {coord.from.y.toFixed(2)}<br />
                    <strong>To X:</strong> {coord.to.x.toFixed(2)}, <strong>To Y:</strong> {coord.to.y.toFixed(2)}
                  </>
                ) : (
                  <>
                    <strong>X:</strong> {coord.x.toFixed(2)}, <strong>Y:</strong> {coord.y.toFixed(2)}
                  </>
                )}
              </li>
            ))}
          </ul>
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
        <h2>Settings</h2>
        <div className="form-group">
          <label>Court Color:</label>
          <input
            type="color"
            value={courtColor}
            onChange={(e) => setCourtColor(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Line Color:</label>
          <input
            type="color"
            value={lineColor}
            onChange={(e) => setLineColor(e.target.value)}
          />
        </div>
        <button onClick={() => setIsSettingsModalOpen(false)}>Close</button>
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
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
          }
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
            marginRight: '20px'
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
              transition: 'background 0.3s'
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
              transition: 'background 0.3s'
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
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
          }
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
              marginRight: '20px'
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
              marginRight: '20px'
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
              marginRight: '20px'
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
              transition: 'background 0.3s'
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
              transition: 'background 0.3s'
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={isDownloadModalOpen}
        onRequestClose={toggleDownloadModal}
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
              <option key={team} value={team}>
                {team}
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
            onClick={toggleDownloadModal}
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
        onRequestClose={toggleScreenshotModal}
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
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
          }
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
              marginRight: '20px'
            }}
          >
            <option value="">All Teams</option>
            {teams.map(team => <option key={team} value={team}>{team}</option>)}
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
              marginRight: '20px'
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
              marginRight: '20px'
            }}
          >
            <option value="">All Actions</option>
            {actionCodes.map(action => <option key={action} value={action}>{action}</option>)}
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
              transition: 'background 0.3s'
            }}
          >
            Download
          </button>
          <button
            onClick={toggleScreenshotModal}
            style={{
              background: '#6c757d',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>

      <div className="aggregated-data-container">
        <AggregatedData data={aggregateData} />
      </div>
    </div>

  );
}

export default BasketballCourt;
