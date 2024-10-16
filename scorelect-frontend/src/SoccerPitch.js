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
import { onSnapshot } from 'firebase/firestore'; // Add this import


const SoccerPitch =() => {
  const [coords, setCoords] = useState([]);
  const [currentCoords, setCurrentCoords] = useState([]);
  const [actionType, setActionType] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openLineDialog, setOpenLineDialog] = useState(false);
  const [formData, setFormData] = useState({
    action: 'goal',
    team: 'Arsenal',
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
  const [isSetupTeamModalOpen, setIsSetupTeamModalOpen] = useState(false); // State for Setup Team modal
  const [actionButtons, setActionButtons] = useState([]);
  const [downloadTeam, setDownloadTeam] = useState('');
  const [downloadPlayer, setDownloadPlayer] = useState('');
  const [downloadAction, setDownloadAction] = useState('');
  const [screenshotTeam, setScreenshotTeam] = useState('');
  const [screenshotPlayer, setScreenshotPlayer] = useState('');
  const [screenshotAction, setScreenshotAction] = useState('');
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [team1Players, setTeam1Players] = useState(Array(11).fill({ name: '' }));
  const [team2Players, setTeam2Players] = useState(Array(11).fill({ name: '' }));
  const [team1Color, setTeam1Color] = useState({ main: '#FF0000', secondary: '#FFFFFF' }); // Arsenal (Red and White)
  const [team2Color, setTeam2Color] = useState({ main: '#0000FF', secondary: '#FFFFFF' }); // Brighton (Blue and White)
  const navigate = useNavigate();

  const stageRef = useRef();
  const [downloadsRemaining, setDownloadsRemaining] = useState(1);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const [pitchColor, setPitchColor] = useState('#00A86B'); // State for pitch color
  const [lineColor, setLineColor] = useState('#000000'); // State for line color
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // State for settings modal


  const pitchWidth = 105;
  const pitchHeight = 68;
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 519.5 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [gameName, setGameName] = useState('');
  const [displayPlayerNumber, setDisplayPlayerNumber] = useState(false);
  const [displayPlayerName, setDisplayPlayerName] = useState(false);
  const [showSetupTeamsContainer, setShowSetupTeamsContainer] = useState(false);
  const [userType, setUserType] = useState('free'); // Initialize userType state
  // Define stripe colors
  const lightStripeColor = '#A8D5BA'; // Light green
  const darkStripeColor = '#8FBF9C';  // Slightly darker green


  useEffect(() => {
    if (location.state && location.state.loadedCoords) {
      console.log('Loaded coords:', location.state.loadedCoords); // Debug log
      setCoords(location.state.loadedCoords);
    } else {
      console.log('No loadedCoords found in location.state');
    }
  }, [location.state]);  

  useEffect(() => {
    // Set initial action buttons
    setActionButtons([
      { label: 'Goal', value: 'goal', color: '#009900', type: 'marker' },
      { label: 'Assist', value: 'assist', color: '#ffa500', type: 'marker' },
      { label: 'Shot on Target', value: 'shot on target', color: '#3eb9c7', type: 'marker' },
      { label: 'Shot off Target', value: 'shot off target', color: '#ff0000', type: 'marker' },
      { label: 'Pass Completed', value: 'pass completed', color: '#fff400', type: 'line' },
      { label: 'Pass Incomplete', value: 'pass incomplete', color: '#000080', type: 'line' }
    ]);
  }, []);

  // Full handleSaveGame function
  const handleSaveGame = async () => {
    console.log('handleSaveGame called'); // Log when the function is invoked
  
    if (userType === 'free') {
      console.log('User is free. Accessing premium feature.');
      handlePremiumFeatureAccess('Save Game');
      return;
    }
  
    if (!gameName.trim()) {
      console.log('Invalid game name entered.');
      Swal.fire({
        title: 'Invalid Game Name',
        text: 'Please enter a valid game name.',
        icon: 'warning',
        confirmButtonText: 'OK',
      });
      return;
    }
  
    const auth = getAuth();
    const user = auth.currentUser;
  
    console.log('Authenticated user:', user); // Log the authenticated user
  
    if (user) {
      console.log('User UID:', user.uid); // Log the user's UID
  
      try {
        const sanitizedGameName = gameName.replace(/[^a-zA-Z0-9_-]/g, '_');
        console.log('Sanitized Game Name:', sanitizedGameName);
  
        const existingGameDoc = await getDoc(doc(firestore, 'savedGames', user.uid, 'games', sanitizedGameName));
        console.log('Existing Game Document:', existingGameDoc.exists());
  
        if (existingGameDoc.exists()) {
          const result = await Swal.fire({
            title: 'Overwrite Game?',
            text: 'A game with this name already exists. Do you want to overwrite it?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, overwrite it',
            cancelButtonText: 'No, cancel',
          });
          console.log('User decision to overwrite:', result.isConfirmed);
          if (!result.isConfirmed) {
            return;
          }
        }
  
        console.log('Saving game:', gameName, coords);
  
        const sportType = 'Soccer';
        await setDoc(doc(firestore, 'savedGames', user.uid, 'games', sanitizedGameName), {
          gameData: coords,
          name: gameName,
          date: new Date().toISOString(),
          sport: sportType,
        });
  
        console.log('Game saved successfully.');
  
        setIsSaveModalOpen(false);
        Swal.fire({
          title: 'Success',
          text: 'Game has been saved successfully!',
          icon: 'success',
          confirmButtonText: 'OK',
        });
      } catch (error) {
        console.error('Error saving game:', error);
        Swal.fire({
          title: 'Error',
          text: 'An error occurred while saving the game. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
        });
      }
    } else {
      console.log('User not authenticated.');
      Swal.fire({
        title: 'Not Logged In',
        text: 'Please log in to save your game.',
        icon: 'warning',
        confirmButtonText: 'OK',
      });
    }
  };

  const initialActionCodes = [
    'goal', 'assist', 'shot on target', 'shot off target', 'pass completed', 'pass incomplete'
  ];

  const initialPositions = [
    'forward', 'midfield', 'defense', 'goalkeeper'
  ];

  const premierLeagueTeams = [
    'Arsenal', 'Aston Villa', 'Brentford', 'Brighton', 'Burnley', 'Chelsea', 'Crystal Palace', 'Everton',
    'Fulham', 'Liverpool', 'Luton Town', 'Manchester City', 'Manchester United', 'Newcastle United', 'Nottingham Forest',
    'Sheffield United', 'Tottenham Hotspur', 'West Ham United', 'Wolverhampton Wanderers'
  ];

  const [actionCodes, setActionCodes] = useState(initialActionCodes);
  const [positions, setPositions] = useState(initialPositions);
  const [teams, setTeams] = useState(premierLeagueTeams);
  const [recentActions, setRecentActions] = useState([]);
  const [recentTeams, setRecentTeams] = useState([]);
  const [pressures, setPressures] = useState(['Yes', 'No']);
  const [feet, setFeet] = useState(['Right', 'Left']);


  const handlePremiumFeatureAccess = (featureName) => {
    Swal.fire({
      title: 'Upgrade Required',
      text: `Access to "${featureName}" is a premium feature. Please upgrade to unlock this functionality.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Upgrade Now',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        // Redirect to the upgrade page
        navigate('/signup');
      }
    });
  };

  // Create handleOpenSaveModal
  const handleOpenSaveModal = () => {
    if (userType === 'free') {
      handlePremiumFeatureAccess('Save Game');
      return;
    }
    setIsSaveModalOpen(true);
  };


  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'p') setActionType('pass');
      if (e.key === 'u') setActionType('badpass');
      if (e.key === 'k') setActionType('kickout');
      if (e.key === 'c') setActionType('badkickout');
      if (e.key === 'g') setActionType('action');
      if (e.key === 'b') setActionType('badaction');
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

        // Use onSnapshot to listen for real-time updates
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUserType(userData.role || 'free'); // Changed from userData.userType to userData.role

            // Handle downloadsRemaining as before
            const lastDownloadDate = userData.lastDownloadDate;
            const today = new Date().toLocaleDateString();
            if (lastDownloadDate === today) {
              setDownloadsRemaining(userData.downloadsRemaining);
            } else {
              setDoc(docRef, { lastDownloadDate: today, downloadsRemaining: 1 }, { merge: true });
              setDownloadsRemaining(1);
            }
          } else {
            // If user document doesn't exist, create it with default values
            setDoc(docRef, {
              role: 'free', // Changed from userType to role
              lastDownloadDate: new Date().toLocaleDateString(),
              downloadsRemaining: 1,
            });
            setUserType('free');
            setDownloadsRemaining(1);
          }
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
      } else {
        // Handle unauthenticated users
        setUserType('free');
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
    // Handle custom inputs
    if (customInput.action) {
      if (!actionCodes.includes(customInput.action)) {
        setActionCodes([...actionCodes, customInput.action]);
      }
      formData.action = customInput.action;
    }
  
    // Handle custom team input
    if (customInput.team) {
      if (!teams.includes(customInput.team)) {
        setTeams([...teams, customInput.team]);
      }
      formData.team = customInput.team;
    }
  
    // Handle custom position input
    if (customInput.position) {
      if (!positions.includes(customInput.position)) {
        setPositions([...positions, customInput.position]);
      }
      formData.position = customInput.position;
    }
  
    // Handle custom pressure input
    if (customInput.pressure) {
      if (!pressures.includes(customInput.pressure)) {
        setPressures([...pressures, customInput.pressure]);
      }
      formData.pressure = customInput.pressure;
    }
  
    // Handle custom foot input
    if (customInput.foot) {
      if (!feet.includes(customInput.foot)) {
        setFeet([...feet, customInput.foot]);
      }
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
      action: 'goal',
      team: 'Arsenal',
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
    if (userType === 'free') {
      handlePremiumFeatureAccess('Download Screenshot');
      return;
    }
  
    // Proceed with downloading screenshot
    const filteredCoords = coords.filter((coord) => {
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
      width: canvasSize.width,
      height: canvasSize.height,
    });
  
    const layer = new Konva.Layer();
    stage.add(layer);
  
    renderSoccerPitchForScreenshot(layer);
  
    filteredCoords.forEach((coord) => {
      if (coord.from && coord.to) {
        const line = new Konva.Line({
          points: [
            coord.from.x * xScale,
            coord.from.y * yScale,
            coord.to.x * xScale,
            coord.to.y * yScale,
          ],
          stroke: getColor(coord.type),
          strokeWidth: 2,
        });
        layer.add(line);
      } else {
        const shape = new Konva.Circle({
          x: coord.x * xScale,
          y: coord.y * yScale,
          radius: 5,
          fill: getColor(coord.type),
        });
        layer.add(shape);
  
        if (displayPlayerNumber && coord.player) {
          const playerNumberText = new Konva.Text({
            x: coord.x * xScale - 5, // Adjusted x position for better centering
            y: coord.y * yScale - 4, // Slightly adjusted y position
            text: coord.player,
            fontSize: 8,
            fill: 'white',
            align: 'center',
            width: 10, // Fixed width to center the text
          });
          layer.add(playerNumberText);
        }
  
        if (displayPlayerName && coord.playerName) {
          const playerNameText = new Konva.Text({
            x: coord.x * xScale - 28,
            y: coord.y * yScale - 16,
            text: coord.playerName,
            fontSize: 10,
            fill: 'black',
            align: 'center',
          });
          layer.add(playerNameText);
        }
      }
    });
  
    layer.draw();
  
    html2canvas(screenshotLayer, {
      width: canvasSize.width,
      height: canvasSize.height,
    }).then((canvas) => {
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

  // Update toggleDownloadModal
  const toggleDownloadModal = () => {
    if (userType === 'free') {
      handlePremiumFeatureAccess('Download Filtered Data');
      return;
    }
    setIsDownloadModalOpen(!isDownloadModalOpen);
  };

  // Update toggleScreenshotModal
  const toggleScreenshotModal = () => {
    if (userType === 'free') {
      handlePremiumFeatureAccess('Download Screenshot');
      return;
    }
    setIsScreenshotModalOpen(!isScreenshotModalOpen);
  };

  const handleResize = (width, height) => {
    setCanvasSize({ width, height });
  };

  // JSX-based renderSoccerPitch function for React rendering
  const renderSoccerPitch = () => {
    const numStripes = 10;
    const stripeWidth = canvasSize.width / numStripes;

    return (
      <Layer>
        {/* Pitch Background */}
        <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill={pitchColor} />

        {/* Stripes */}
        {Array.from({ length: numStripes }, (_, i) => (
          <Rect
            key={i}
            x={i * stripeWidth}
            y={0}
            width={stripeWidth}
            height={canvasSize.height}
            fill={i % 2 === 0 ? lightStripeColor : darkStripeColor}
            opacity={0.3} // Adjust opacity for subtlety
          />
        ))}

        {/* Side and Goal Lines */}
        <Line points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} stroke={lineColor} strokeWidth={2} />

        {/* Goals */}
        <Line points={[canvasSize.width, yScale * 30.34, xScale * 105, yScale * 30.34, xScale * 105, yScale * 37.66, canvasSize.width, yScale * 37.66]} stroke={lineColor} strokeWidth={2} />
        <Line points={[0, yScale * 30.34, xScale * 0, yScale * 30.34, xScale * 0, yScale * 37.66, 0, yScale * 37.66]} stroke={lineColor} strokeWidth={2} />

        {/* 6-yard Boxes */}
        <Line points={[0, yScale * 23.1, xScale * 5.5, yScale * 23.1, xScale * 5.5, yScale * 44.9, 0, yScale * 44.9]} stroke={lineColor} strokeWidth={2} />
        <Line points={[canvasSize.width, yScale * 23.1, xScale * 99.5, yScale * 23.1, xScale * 99.5, yScale * 44.9, canvasSize.width, yScale * 44.9]} stroke={lineColor} strokeWidth={2} />

        {/* Penalty Areas */}
        <Line points={[0, yScale * 14, xScale * 16.5, yScale * 14, xScale * 16.5, yScale * 54, 0, yScale * 54]} stroke={lineColor} strokeWidth={2} />
        <Line points={[canvasSize.width, yScale * 14, xScale * 88.5, yScale * 14, xScale * 88.5, yScale * 54, canvasSize.width, yScale * 54]} stroke={lineColor} strokeWidth={2} />

        {/* Penalty Spots */}
        <Circle x={xScale * 11} y={yScale * 34} radius={xScale * 0.4} fill={lineColor} />
        <Circle x={xScale * 94} y={yScale * 34} radius={xScale * 0.4} fill={lineColor} />

        {/* Halfway Line */}
        <Line points={[xScale * 52.5, 0, xScale * 52.5, canvasSize.height]} stroke={lineColor} strokeWidth={2} />

        {/* Center Circle */}
        <Circle x={xScale * 52.5} y={yScale * 34} radius={xScale * 9.15} stroke={lineColor} strokeWidth={2} />

        {/* Corner Arcs */}
        <Arc x={xScale * 0} y={yScale * 0} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={0} stroke={lineColor} strokeWidth={2} />
        <Arc x={xScale * 0} y={yScale * 68} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={270} stroke={lineColor} strokeWidth={2} />
        <Arc x={xScale * 105} y={yScale * 0} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={90} stroke={lineColor} strokeWidth={2} />
        <Arc x={xScale * 105} y={yScale * 68} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={180} stroke={lineColor} strokeWidth={2} />

        {/* Penalty Arcs */}
        <Arc x={xScale * 94} y={yScale * 34} innerRadius={xScale * 9.15} outerRadius={xScale * 9.15} angle={105} rotation={127.5} stroke={lineColor} strokeWidth={2} />
        <Arc x={xScale * 11} y={yScale * 34} innerRadius={xScale * 9.15} outerRadius={xScale * 9.15} angle={105} rotation={307.5} stroke={lineColor} strokeWidth={2} />

        {/* "SCORELECT" in the End Zones */}
        <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSize.height / 40.25} fontSize={canvasSize.width / 50} fill="#D3D3D3" opacity={0.7} align="center" />
        <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 22.5} y={canvasSize.height / 1.02} fontSize={canvasSize.width / 50} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />
      </Layer>
    );
  }; 

  // Function-based renderSoccerPitchForScreenshot for Konva-based rendering
  const renderSoccerPitchForScreenshot = (layer) => {
    const fieldRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height,
      fill: '#00A86B'
    });
    layer.add(fieldRect);

    const lineColor = '#000';
    const lineWidth = 2;

    // Side and goal lines
    const fieldLines = new Konva.Line({
      points: [0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(fieldLines);

    // Goals
    const goalLines1 = new Konva.Line({
      points: [canvasSize.width, yScale * 30.34, xScale * 105, yScale * 30.34, xScale * 105, yScale * 37.66, canvasSize.width, yScale * 37.66],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(goalLines1);
    const goalLines2 = new Konva.Line({
      points: [0, yScale * 30.34, xScale * 0, yScale * 30.34, xScale * 0, yScale * 37.66, 0, yScale * 37.66],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(goalLines2);

    // 6-yard boxes
    const sixYardBox1 = new Konva.Line({
      points: [0, yScale * 23.1, xScale * 5.5, yScale * 23.1, xScale * 5.5, yScale * 44.9, 0, yScale * 44.9],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(sixYardBox1);
    const sixYardBox2 = new Konva.Line({
      points: [canvasSize.width, yScale * 23.1, xScale * 99.5, yScale * 23.1, xScale * 99.5, yScale * 44.9, canvasSize.width, yScale * 44.9],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(sixYardBox2);

    // Penalty areas
    const penaltyArea1 = new Konva.Line({
      points: [0, yScale * 14, xScale * 16.5, yScale * 14, xScale * 16.5, yScale * 54, 0, yScale * 54],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(penaltyArea1);
    const penaltyArea2 = new Konva.Line({
      points: [canvasSize.width, yScale * 14, xScale * 88.5, yScale * 14, xScale * 88.5, yScale * 54, canvasSize.width, yScale * 54],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(penaltyArea2);

    // Penalty spots
    const penaltySpot1 = new Konva.Circle({
      x: xScale * 11,
      y: yScale * 34,
      radius: xScale * 0.4,
      fill: lineColor
    });
    layer.add(penaltySpot1);
    const penaltySpot2 = new Konva.Circle({
      x: xScale * 94,
      y: yScale * 34,
      radius: xScale * 0.4,
      fill: lineColor
    });
    layer.add(penaltySpot2);

    // Halfway line
    const halfwayLine = new Konva.Line({
      points: [xScale * 52.5, 0, xScale * 52.5, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(halfwayLine);

    // Center circle
    const centerCircle = new Konva.Circle({
      x: xScale * 52.5,
      y: yScale * 34,
      radius: xScale * 9.15,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(centerCircle);

    // Corner arcs
    const cornerArc1 = new Konva.Arc({
      x: xScale * 0,
      y: yScale * 0,
      innerRadius: 0,
      outerRadius: xScale * 1,
      angle: 90,
      rotation: 0,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(cornerArc1);
    const cornerArc2 = new Konva.Arc({
      x: xScale * 0,
      y: yScale * 68,
      innerRadius: 0,
      outerRadius: xScale * 1,
      angle: 90,
      rotation: 270,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(cornerArc2);
    const cornerArc3 = new Konva.Arc({
      x: xScale * 105,
      y: yScale * 0,
      innerRadius: 0,
      outerRadius: xScale * 1,
      angle: 90,
      rotation: 90,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(cornerArc3);
    const cornerArc4 = new Konva.Arc({
      x: xScale * 105,
      y: yScale * 68,
      innerRadius: 0,
      outerRadius: xScale * 1,
      angle: 90,
      rotation: 180,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(cornerArc4);

    // Penalty arcs
    const penaltyArc1 = new Konva.Arc({
      x: xScale * 94,
      y: yScale * 34,
      innerRadius: xScale * 9.15,
      outerRadius: xScale * 9.15,
      angle: 105,
      rotation: 127.5,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(penaltyArc1);
    const penaltyArc2 = new Konva.Arc({
      x: xScale * 11,
      y: yScale * 34,
      innerRadius: xScale * 9.15,
      outerRadius: xScale * 9.15,
      angle: 105,
      rotation: 307.5,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(penaltyArc2);
    
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
    if (userType === 'free') {
      if (downloadsRemaining <= 0) {
        handlePremiumFeatureAccess('Download Data');
        return;
      }
      // Decrease downloadsRemaining
      setDownloadsRemaining(downloadsRemaining - 1);
  
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(firestore, 'users', user.uid);
        await setDoc(docRef, { downloadsRemaining: downloadsRemaining - 1 }, { merge: true });
      } else {
        // Update localStorage for unauthenticated users
        localStorage.setItem('downloadCount', (downloadsRemaining - 1).toString());
      }
    }

        // Proceed with downloading data
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
  if (userType === 'free') {
    handlePremiumFeatureAccess('Download Filtered Data');
    return;
  }

  // Proceed with downloading filtered data
  const filteredCoords = coords.filter((coord) => {
    return (
      (downloadTeam ? coord.team === downloadTeam : true) &&
      (downloadPlayer ? coord.playerName === downloadPlayer : true) &&
      (downloadAction ? coord.action === downloadAction : true)
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

  const handleSetupTeams = () => {
    setIsSetupTeamModalOpen(false);
  };

  const handlePlayerClick = (team, playerName, playerNumber) => {
    setFormData({
      ...formData,
      team: team,
      playerName: playerName,
      player: playerNumber,
    });
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
              backgroundColor: teamColor.main,  // Use the team's main color for the button background
              color: teamColor.secondary,      // Use the team's secondary color for the text
              border: `2px solid ${teamColor.secondary}`, // Add a border with the secondary color
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
          <button className="button" onClick={toggleDownloadModal}>Download Filtered Data</button>
          <button className="button" onClick={toggleScreenshotModal}>Download Screenshot</button>
          <button className="button" onClick={toggleModal}>View Coordinates</button>
          <button className="button" onClick={handleOpenSaveModal}>Save Game</button>
          <button className="button" onClick={() => setIsSettingsModalOpen(true)}>Settings</button> {/* Settings button */}
          <button className="button" onClick={() => setIsSetupTeamModalOpen(true)}>Setup Team</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <button className="button" onClick={() => handleResize(375, 243.5)}>iPhone</button>
            <button className="button" onClick={() => handleResize(600, 389.6)}>iPad</button>
            <button className="button" onClick={() => handleResize(800, 600)}>Computer</button>
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
          {renderSoccerPitch()}
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
          <label>Pitch Color:</label>
          <input
            type="color"
            value={pitchColor}
            onChange={(e) => setPitchColor(e.target.value)}
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

{/* Setup Teams Modal */}
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
      {/* Team 1 Colors */}
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
  </div>

  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
    <button
      onClick={() => {
        setShowSetupTeamsContainer(true); // Set the state to show the container above the pitch graphic
        setIsSetupTeamModalOpen(false); // Close the modal after pressing the button
        setTeams((prevTeams) => {
          const newTeams = [...prevTeams];
          if (team1 && !newTeams.includes(team1)) {
            newTeams.push(team1);
          }
          if (team2 && !newTeams.includes(team2)) {
            newTeams.push(team2);
          }
          return newTeams;
        });
      }}
      style={{
        background: '#28a745', // Fixed color for Setup Teams button
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
    </div>


  );
}

export default SoccerPitch;
