import React, { useState, useRef, useEffect, useContext } from 'react';
import { Stage, Layer, Rect, Line, Circle, Arc, Group, Text, Arrow } from 'react-konva';
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
import { Rnd } from 'react-rnd';


const AmericanFootballPitch = () => {
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
  const [isSetupTeamsModalOpen, setIsSetupTeamsModalOpen] = useState(false);
  const [team1Players, setTeam1Players] = useState(Array(11).fill({ name: '' }));
  const [team2Players, setTeam2Players] = useState(Array(11).fill({ name: '' }));
  const [team1Color, setTeam1Color] = useState({ main: '#FF0000', secondary: '#FFFFFF' }); // Arsenal (Red and White)
  const [team2Color, setTeam2Color] = useState({ main: '#0000FF', secondary: '#FFFFFF' }); // Brighton (Blue and White)
  const [isSetupTeamModalOpen, setIsSetupTeamModalOpen] = useState(false); // State for Setup Team modal
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const { loadedCoords } = useContext(GameContext); // Access loadedCoords from context

  const pitchWidth = 120;
  const pitchHeight = 53.3;
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 355.33 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [gameName, setGameName] = useState('');
  const [showSetupTeamsContainer, setShowSetupTeamsContainer] = useState(false);
  const [userType, setUserType] = useState('free'); // Initialize userType state

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

  useEffect(() => {
    console.log('American Football Pitch mounted. LoadedCoords from context:', loadedCoords);
    if (loadedCoords) {
      setCoords(loadedCoords);
      console.log('Coords updated:', loadedCoords);
    } else {
      console.log('No loadedCoords found in context');
    }
  }, [loadedCoords]);

  useEffect(() => {
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

  const handleSetupTeams = () => {
    setIsSetupTeamModalOpen(false);
    setShowSetupTeamsContainer(true);
  };  

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
      sport: 'AmericanFootball',
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
      sport: 'AmericanFootball',
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
  

  const [actionCodes, setActionCodes] = useState(initialActionCodes);
  const [positions, setPositions] = useState(initialPositions);
  const [recentActions, setRecentActions] = useState([]);
  const [recentTeams, setRecentTeams] = useState([]);
  const [teams, setTeams] = useState(initialNFLTeams);
  const [pressures, setPressures] = useState(['Yes', 'No']);
  const [feet, setFeet] = useState(['Right', 'Left']);


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
        if (currentCoords.length === 0) {
          setCurrentCoords([newCoord]); // Start with the first point
        } else if (currentCoords.length === 1) {
          const fromCoord = currentCoords[0];
          const toCoord = newCoord;
          setFormData({
            ...formData,
            from: fromCoord,
            to: toCoord,
            type: actionType.value,
          });
          setOpenLineDialog(true);
          setCurrentCoords([]); // Reset after capturing the line
        }
      } else if (actionType) {
        setFormData({
          ...formData,
          x: newCoord.x,
          y: newCoord.y,
          type: actionType.value,
        });
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
      setActionType(''); // Reset actionType here
    };
    
    const handleCloseLineDialog = () => {
      setOpenLineDialog(false);
      setActionType(''); // Reset actionType here
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
        x: null,
        y: null,
        type: '',
      });
    
      // Reset currentCoords and customInput
      setCurrentCoords([]);
      setCustomInput({ action: '', team: '', position: '', pressure: '', foot: '', color: '#000000', type: 'marker' });
      setIsContextMenuOpen(false);
      setActionType(''); // Reset actionType here
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
  
    renderFootballFieldForScreenshot(layer);
  
    filteredCoords.forEach((coord) => {
      if (coord.from && coord.to) {
        // Change Line to Arrow for line-type actions
        const arrow = new Konva.Arrow({
          points: [
            coord.from.x * xScale,
            coord.from.y * yScale,
            coord.to.x * xScale,
            coord.to.y * yScale,
          ],
          stroke: getColor(coord.type),
          strokeWidth: 2,
          pointerLength: 10,
          pointerWidth: 10,
          fill: getColor(coord.type)
        });
        layer.add(arrow);
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
  
    const datasetName = selectedDataset || newDatasetName || 'My Dataset';
  
    const downloadData = {
      dataset: {
        name: datasetName,
        description: '',
        price: 0.0,
        category: 'AmericanFootball',
        created_at: null,
        updated_at: null
      },
      games: [
        {
          gameName: gameName || 'Unnamed Game',
          matchDate: matchDate || null,
          sport: 'AmericanFootball',
          gameData: coords
        }
      ]
    };
  
    const jsonData = JSON.stringify(downloadData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datasetName.replace(' ', '_')}_${(gameName || 'Unnamed_Game').replace(' ', '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };  
  

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
  
    const datasetName = selectedDataset || newDatasetName || 'My Dataset';
  
    const downloadData = {
      dataset: {
        name: datasetName,
        description: '',
        price: 0.0,
        category: 'AmericanFootball',
        created_at: null,
        updated_at: null
      },
      games: [
        {
          gameName: gameName || 'Unnamed Game',
          matchDate: matchDate || null,
          sport: 'AmericanFootball',
          gameData: filteredCoords
        }
      ]
    };
  
    const jsonData = JSON.stringify(downloadData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datasetName.replace(' ', '_')}_${(gameName || 'Unnamed_Game').replace(' ', '_')}_filtered.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  
    setIsDownloadModalOpen(false);
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

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
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
          <button className="button" onClick={toggleDownloadModal}>Download Filtered Data</button>
          <button className="button" onClick={toggleScreenshotModal}>Download Screenshot</button>
          <button className="button" onClick={toggleModal}>View Coordinates</button>
          <button className="button" onClick={handleOpenSaveModal}>Save Game</button>
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
                  <Arrow
                    key={index}
                    points={[
                      coord.from.x * xScale,
                      coord.from.y * yScale,
                      coord.to.x * xScale,
                      coord.to.y * yScale
                    ]}
                    stroke={getColor(coord.type)}
                    strokeWidth={2}
                    pointerLength={10}
                    pointerWidth={10}
                  />
                );
              } else {
                return (
                  <Circle
                    key={index}
                    x={coord.x * xScale}
                    y={coord.y * yScale}
                    radius={6}
                    fill={getColor(coord.type)}
                  />
                );
              }
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
        <Rnd
        default={{
          x: window.innerWidth / 2 - 200,
          y: window.innerHeight / 2 - 200,
          width: 400,
          height: 400,
        }}
        minWidth={300}
        minHeight={300}
        bounds="window"
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true,
        }}
        dragHandleClassName="drag-handle"
        resizeHandleStyles={{
          bottomRight: {
            cursor: 'se-resize',
            width: '20px',
            height: '20px',
            right: '-10px',
            bottom: '-10px',
            backgroundColor: 'transparent', // Or a visible color if you prefer
          },
          // Add styles for other handles
        }}
        style={{ zIndex: 1000 }}
      >
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
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
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
            <button
              className="button"
              onClick={() => {
                handleCloseDialog();
                setActionType('');
              }}
            >
              Cancel
            </button>
            <button
              className="button"
              onClick={() => {
                handleFormSubmit();
                setActionType('');
              }}
            >
              Submit
            </button>
          </div>
        </div>
        </Rnd>


      )}
      {openLineDialog && (
        <Rnd
        default={{
          x: window.innerWidth / 2 - 200,
          y: window.innerHeight / 2 - 200,
          width: 400,
          height: 400,
        }}
        minWidth={300}
        minHeight={300}
        bounds="window"
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true,
        }}
        style={{ zIndex: 1000 }}
        dragHandleClassName="drag-handle" // Add this line

      >
        <div className="dialog-container">
          <h3>Enter Action Details for Line</h3>
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
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
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
            <button
              className="button"
              onClick={() => {
                handleCloseLineDialog();
                setActionType('');
              }}
            >
              Cancel
            </button>
            <button
              className="button"
              onClick={() => {
                handleFormSubmit();
                setActionType('');
              }}
            >
              Submit
            </button>
          </div>
        </div>
        </Rnd>
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

