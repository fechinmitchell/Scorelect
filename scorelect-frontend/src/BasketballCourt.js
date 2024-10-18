import React, { useState, useRef, useEffect, useContext } from 'react';
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
import { GameContext } from './GameContext'; // Import GameContext

const BasketballCourt = () => {
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
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [team1Players, setTeam1Players] = useState(Array(12).fill({ name: '', number: '' }));
  const [team2Players, setTeam2Players] = useState(Array(12).fill({ name: '', number: '' }));
  const [team1Color, setTeam1Color] = useState({ main: '#FDB927', secondary: '#552583' }); // Lakers colors
  const [team2Color, setTeam2Color] = useState({ main: '#C8102E', secondary: '#FFFFFF' }); // Bulls colors
  const [isSetupTeamModalOpen, setIsSetupTeamModalOpen] = useState(false);
  const [showSetupTeamsContainer, setShowSetupTeamsContainer] = useState(false);
  const [userType, setUserType] = useState('free'); // Initialize userType state
  const { loadedCoords } = useContext(GameContext); // Access loadedCoords from context

  // New state variables for dataset functionality
  const [saveToDataset, setSaveToDataset] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [newDatasetName, setNewDatasetName] = useState('');
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [saveButtonStatus, setSaveButtonStatus] = useState('idle'); // idle, loading, success, error
  const [saveDatasetButtonStatus, setSaveDatasetButtonStatus] = useState('idle'); // idle, loading, success, error  
  const [datasetsFetchError, setDatasetsFetchError] = useState(false);
  const [matchDate, setMatchDate] = useState('');
  const [duplicateDatasetError, setDuplicateDatasetError] = useState(false); // For duplicate dataset handling
  
  // Fetch datasets when the modal opens
  useEffect(() => {
  const fetchDatasets = async () => {
    if (user) {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${process.env.REACT_APP_API_URL}/list-datasets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ uid: user.uid }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to fetch datasets:', errorData.error || response.statusText);
          setAvailableDatasets([]);
          setDatasetsFetchError(true);
          return;
        }

        const data = await response.json();
        setAvailableDatasets(data.datasets);
        setDatasetsFetchError(false);
        console.log('Fetched datasets successfully:', data.datasets);
      } catch (error) {
        console.error('Error fetching datasets:', error);
        setAvailableDatasets([]);
        setDatasetsFetchError(true);
      }
    }
  };

  if (isSaveModalOpen) {
    fetchDatasets();
  }
}, [isSaveModalOpen, user]);

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
    console.log('Court mounted. LoadedCoords from context:', loadedCoords);
    if (loadedCoords) {
      setCoords(loadedCoords);
      console.log('Coords updated:', loadedCoords);
    } else {
      console.log('No loadedCoords found in context');
    }
  }, [loadedCoords]);

  useEffect(() => {
    // Set initial action buttons
    setActionButtons([
      { label: 'Shot', value: 'shot', color: '#009900', type: 'marker' },
      { label: 'Miss', value: 'miss', color: '#ffa500', type: 'marker' },
      { label: 'Pass', value: 'pass', color: '#40bdb2', type: 'line' },
      { label: 'Assist', value: 'assist', color: '#000080', type: 'line' },
      { label: 'Turnover', value: 'turnover', color: '#aaaaaa', type: 'marker' },
      { label: 'Rebound', value: 'rebound', color: '#800080', type: 'marker' }
    ]);
  }, []);

  // Full handleSaveGame function
  const handleSaveGame = async () => {
    console.log('handleSaveGame called'); // Debugging statement
  
    if (userType === 'free') {
      console.log('User is free. Prompting for upgrade.'); // Debugging statement
      handlePremiumFeatureAccess('Save Game');
      return;
    }
  
    if (!gameName.trim()) {
      Swal.fire('Invalid Game Name', 'Please enter a valid game name.', 'warning');
      return;
    }
  
    if (saveToDataset && selectedDataset === 'new' && !newDatasetName.trim()) {
      Swal.fire('Invalid Dataset Name', 'Please enter a valid dataset name.', 'warning');
      return;
    }
  
    setSaveButtonStatus('loading');
    setDuplicateDatasetError(false); // Reset duplicate error before saving
    console.log('Saving game...', { gameName, saveToDataset, selectedDataset, newDatasetName, matchDate }); // Debugging
  
    try {
      if (!user) {
        console.error('No user authenticated'); // Debugging
        Swal.fire('Error', 'User not authenticated.', 'error');
        setSaveButtonStatus('error');
        return;
      }
  
      const token = await user.getIdToken();
      const payload = {
        uid: user.uid,
        gameName,
        matchDate, // Include match date
        gameData: coords, // Ensure 'coords' contains the game data
        sport: 'Basketball',
      };
  
      // Include datasetName if saving to a dataset
      if (saveToDataset) {
        payload.datasetName = selectedDataset === 'new' ? newDatasetName : selectedDataset;
      }
  
      // If creating a new dataset, create it first
      if (saveToDataset && selectedDataset === 'new') {
        // Check for duplicate dataset name
        if (availableDatasets.includes(newDatasetName)) {
          setDuplicateDatasetError(true);
          Swal.fire('Error Creating Dataset', 'Dataset name already exists. Please choose a different name.', 'error');
          setSaveButtonStatus('error');
          return;
        }
  
        console.log('Creating new dataset...');
        const createResponse = await fetch(`${process.env.REACT_APP_API_URL}/create-dataset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            uid: user.uid,
            datasetName: newDatasetName
          }),
        });
  
        const createData = await createResponse.json();
        console.log('Create dataset response status:', createResponse.status); // Debugging
        console.log('Create dataset response data:', createData); // Debugging
  
        if (!createResponse.ok) {
          setSaveButtonStatus('error');
          Swal.fire('Error Creating Dataset', createData.error || 'Failed to create dataset.', 'error');
          return;
        } else {
          Swal.fire('Dataset Created', `New dataset "${newDatasetName}" has been created.`, 'success');
        }
      }
  
      // Now, save the game
      console.log('Saving game to dataset...');
      const saveResponse = await fetch(`${process.env.REACT_APP_API_URL}/save-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
  
      console.log('Save response status:', saveResponse.status); // Debugging
  
      const saveData = await saveResponse.json();
      console.log('Save response data:', saveData); // Debugging
  
      if (saveResponse.ok) {
        if (saveToDataset) {
          if (selectedDataset === 'new') {
            // Already created the dataset, so just confirm the save
            setSaveButtonStatus('success');
            Swal.fire('Success', `Game has been saved successfully to the new dataset "${newDatasetName}".`, 'success');
          } else {
            // Append to existing dataset
            setSaveButtonStatus('success');
            Swal.fire('Success', 'Game has been saved successfully to the dataset!', 'success');
          }
        } else {
          setSaveButtonStatus('success');
          Swal.fire('Success', 'Game has been saved successfully!', 'success');
        }
        // Reset modal state
        setIsSaveModalOpen(false);
        setGameName('');
        setMatchDate(''); // Reset match date
        setSaveToDataset(false);
        setSelectedDataset('');
        setNewDatasetName('');
      } else {
        setSaveButtonStatus('error');
        Swal.fire('Error Saving Game', saveData.error || 'Failed to save game.', 'error');
      }
    } catch (error) {
      console.error('Error in handleSaveGame:', error); // Debugging
      setSaveButtonStatus('error');
      Swal.fire('Error', 'Network error while saving game.', 'error');
    } finally {
      // Reset button status after a short delay to show the success/error state
      setTimeout(() => {
        setSaveButtonStatus('idle');
        setSaveDatasetButtonStatus('idle');
      }, 2000);
    }
  };

  // Function to handle saving to dataset separately (if needed)
  const handleSaveToDataset = async () => {
    if (!gameName.trim()) {
      Swal.fire('Invalid Game Name', 'Please enter a valid game name.', 'warning');
      return;
    }

    if (!selectedDataset && selectedDataset !== 'new') {
      Swal.fire('Select Dataset', 'Please select or create a dataset to save the game.', 'warning');
      return;
    }

    setSaveDatasetButtonStatus('loading');

    try {
      const token = await user.getIdToken();
      const payload = {
        uid: user.uid,
        gameName,
        gameData: coords,
        sport: 'Basketball',
        datasetName: selectedDataset === 'new' ? newDatasetName : selectedDataset
      };

      // Save the game (reuse the save-game endpoint)
      const saveResponse = await fetch(`${process.env.REACT_APP_API_URL}/save-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const saveData = await saveResponse.json();

      if (saveResponse.ok) {
        if (selectedDataset === 'new') {
          // Create a new dataset
          const createResponse = await fetch(`${process.env.REACT_APP_API_URL}/create-dataset`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              uid: user.uid,
              datasetName: newDatasetName
            }),
          });

          const createData = await createResponse.json();

          if (createResponse.ok) {
            setSaveDatasetButtonStatus('success');
            Swal.fire('Dataset Created', `New dataset "${newDatasetName}" has been created and the game has been added.`, 'success');
          } else {
            setSaveDatasetButtonStatus('error');
            Swal.fire('Error Creating Dataset', createData.error || 'Failed to create dataset.', 'error');
          }
        } else {
          // Append to existing dataset
          setSaveDatasetButtonStatus('success');
          Swal.fire('Success', 'Game has been saved successfully to the dataset!', 'success');
        }
        // Reset modal state
        setIsSaveModalOpen(false);
        setGameName('');
        setSaveToDataset(false);
        setSelectedDataset('');
        setNewDatasetName('');
      } else {
        setSaveDatasetButtonStatus('error');
        Swal.fire('Error Saving Game', saveData.error || 'Failed to save game.', 'error');
      }
    } catch (error) {
      setSaveDatasetButtonStatus('error');
      Swal.fire('Error', 'Network error while saving to dataset.', 'error');
    } finally {
      // Reset button status after a short delay to show the success/error state
      setTimeout(() => {
        setSaveDatasetButtonStatus('idle');
      }, 2000);
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

  const [actionCodes, setActionCodes] = useState(initialActionCodes);
  const [positions, setPositions] = useState(initialPositions);
  const [teams, setTeams] = useState(nbaTeams);
  const [recentActions, setRecentActions] = useState([]);
  const [recentTeams, setRecentTeams] = useState([]);
  const [pressures, setPressures] = useState(['Yes', 'No']);
  const [feet, setFeet] = useState(['Right', 'Left']);


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

  const handleSetupTeams = () => {
    setIsSetupTeamModalOpen(false);
  };

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
  
    renderBasketballCourtForScreenshot(layer);
  
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
  
  const handlePlayerClick = (team, playerName, playerNumber) => {
    setFormData({
      ...formData,
      team: team,
      playerName: playerName,
      player: playerNumber,
    });
  };
  

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

      {/* Save Game Modal */}
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
            width: '80%',
            maxHeight: '80%',
            overflowY: 'auto',
            background: '#2e2e2e',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000, // Ensure it appears above other elements
          },
        }}
      >
        <h2 style={{ marginBottom: '20px', color: '#fff' }}>Save Game</h2>

        {/* Warning Message if Datasets Failed to Fetch */}
        {datasetsFetchError && (
          <div
            style={{
              color: '#dc3545',
              marginBottom: '15px',
              padding: '10px',
              border: '1px solid #dc3545',
              borderRadius: '5px',
              backgroundColor: '#f8d7da',
            }}
          >
            <strong>Warning:</strong> Failed to fetch datasets. You can still save your game, but saving to a dataset won't be available.
          </div>
        )}

        {/* Game Name Input */}
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="gameName"
            style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#fff' }}
          >
            Game Name:
          </label>
          <input
            type="text"
            id="gameName"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="Enter game name"
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        {/* Match Date Input */}
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="matchDate"
            style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#fff' }}
          >
            Match Date:
          </label>
          <input
            type="date"
            id="matchDate"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        {/* Save to Dataset Section */}
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="saveToDataset"
            style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#fff' }}
          >
            Save to Dataset:
          </label>
          <select
            id="saveToDataset"
            value={saveToDataset ? selectedDataset : ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                setSaveToDataset(false);
                setSelectedDataset('');
                setNewDatasetName('');
              } else {
                setSaveToDataset(true);
                setSelectedDataset(value);
              }
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
          >
            <option value="">-- Select a Dataset --</option>
            {availableDatasets.map((dataset, index) => (
              <option key={index} value={dataset}>
                {dataset}
              </option>
            ))}
            <option value="new">Create New Dataset</option>
          </select>

          {/* New Dataset Name Input */}
          {saveToDataset && selectedDataset === 'new' && (
            <div style={{ marginTop: '15px' }}>
              <label
                htmlFor="newDatasetName"
                style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#fff' }}
              >
                New Dataset Name:
              </label>
              <input
                type="text"
                id="newDatasetName"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                placeholder="Enter new dataset name"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #ccc',
                }}
              />
              {/* Duplicate Dataset Warning */}
              {duplicateDatasetError && (
                <div
                  style={{
                    color: '#dc3545',
                    marginTop: '5px',
                    padding: '5px',
                    border: '1px solid #dc3545',
                    borderRadius: '5px',
                    backgroundColor: '#f8d7da',
                  }}
                >
                  <strong>Error:</strong> Dataset name already exists. Please choose a different name.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '30px',
          }}
        >
          {/* Save Game Button */}
          <button
            onClick={handleSaveGame}
            disabled={saveButtonStatus === 'loading'}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: saveButtonStatus === 'loading' ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            {saveButtonStatus === 'loading' && (
              <span
                className="spinner"
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #f3f3f3',
                  borderTop: '2px solid #fff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              ></span>
            )}
            {saveButtonStatus === 'success' ? (
              <span>&#10004; Saved!</span>
            ) : saveButtonStatus === 'error' ? (
              <span>&#10008; Error</span>
            ) : (
              'Save Game'
            )}
          </button>

          {/* Save to Dataset Button */}
          {/* {saveToDataset && (
            <button
              onClick={handleSaveToDataset}
              disabled={saveDatasetButtonStatus === 'loading'}
              style={{
                padding: '10px 20px',
                backgroundColor: '#17a2b8',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: saveDatasetButtonStatus === 'loading' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {saveDatasetButtonStatus === 'loading' && (
                <span
                  className="spinner"
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                ></span>
              )}
              {saveDatasetButtonStatus === 'success' ? (
                <span>&#10004; Saved!</span>
              ) : saveDatasetButtonStatus === 'error' ? (
                <span>&#10008; Error</span>
              ) : (
                'Save to Dataset'
              )}
            </button>
          )} */}

          {/* Exit Button */}
          <button
            onClick={() => setIsSaveModalOpen(false)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Exit
          </button>
        </div>

        {/* Spinner Animation */}
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
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

  );
}

export default BasketballCourt;
