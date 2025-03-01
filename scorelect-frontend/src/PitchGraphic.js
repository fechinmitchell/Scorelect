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
import './PitchGraphic.css';
import './SavedGames.css';
import AggregatedData from './AggregatedData';
import { onSnapshot } from 'firebase/firestore'; // Add this import
import { GameContext } from './GameContext'; // Import GameContext
import { Rnd } from 'react-rnd';
import { utils, writeFile } from 'xlsx';
import { saveAs } from 'file-saver';
import InitialSetupModal from './components/InitialSetupModal';
import NewGameSetupModal from './components/NewGameSetupModal';


const PitchGraphic = () => {
  const initialActionButtons = [
    { label: 'Point', value: 'point', color: '#048522', type: 'marker' },
    { label: 'Wide', value: 'wide', color: '#ff0000', type: 'marker' },
    { label: 'Goal', value: 'goal', color: '#0000ff', type: 'marker' },
    { label: 'Miss', value: 'miss', color: '#ff00ff', type: 'marker' },
    { label: 'Pass Completed', value: 'successful pass', color: '#00ffff', type: 'line' },
    { label: 'Pass Incomplete', value: 'unsuccessful pass', color: '#ffff00', type: 'line' },
  ];

  const [actionButtons, setActionButtons] = useState(initialActionButtons);
  const [actionType, setActionType] = useState(initialActionButtons[0]); // Default to first action

  const [coords, setCoords] = useState([]);
  const [currentCoords, setCurrentCoords] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openLineDialog, setOpenLineDialog] = useState(false);
  const [formData, setFormData] = useState({
    action: initialActionButtons[0].value, // Default action value
    team: 'Armagh',
    playerName: '',
    player: '',
    position: 'forward',
    pressure: '0',
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
  const [pitchColor, setPitchColor] = useState('#006400');
  const [lineColor, setLineColor] = useState('#FFF');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [displayPlayerNumber, setDisplayPlayerNumber] = useState(false);
  const [displayPlayerName, setDisplayPlayerName] = useState(false);
  const [isSetupTeamsModalOpen, setIsSetupTeamsModalOpen] = useState(false);
  const [team1Players, setTeam1Players] = useState(Array(30).fill({ name: '' }));
  const [team2Players, setTeam2Players] = useState(Array(30).fill({ name: '' }));
  const [team1Color, setTeam1Color] = useState({ main: '#581830', secondary: '#FFFFFF' }); // Galway 
  const [team2Color, setTeam2Color] = useState({ main: '#008000', secondary: '#FF0000' }); // Mayo 
  const [isSetupTeamModalOpen, setIsSetupTeamModalOpen] = useState(false); // State for Setup Team modal
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const { loadedCoords } = useContext(GameContext); // Access loadedCoords from context


  const pitchWidth = 145;
  const pitchHeight = 88;
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 484.8 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [gameName, setGameName] = useState('');
  const [showSetupTeamsContainer, setShowSetupTeamsContainer] = useState(false);
  const [userType, setUserType] = useState('free'); // Initialize userType state
  const lightStripeColor = '#228B22'; // Light green
  const darkStripeColor = '#006400';  // Slightly darker green


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

    const [isInitialSetupModalOpen, setIsInitialSetupModalOpen] = useState(true); // Open on mount
    const [isNewGameSetupModalOpen, setIsNewGameSetupModalOpen] = useState(false);

    //Download Modal
    const [isCustomDownloadModalOpen, setIsCustomDownloadModalOpen] = useState(false);
    const [downloadFileName, setDownloadFileName] = useState('my_data');
    const [downloadFormat, setDownloadFormat] = useState('json');

    // For Download Filtered Data
    const [filteredFileName, setFilteredFileName] = useState('filtered_data');
    const [filteredFormat, setFilteredFormat] = useState('json');

    //View Coordinate Functions
    // New state for review/editing
    const [reviewData, setReviewData] = useState([]);

    // When opening the review modal, copy the current coordinates:
    const toggleReviewModal = () => {
      // If opening (i.e. modal currently closed) then copy coords into reviewData
      if (!isModalOpen) {
        setReviewData([...coords]);
      }
      setIsModalOpen(!isModalOpen);
    };

    // Handler to update a field in reviewData (for dynamic editing)
    const handleReviewChange = (index, field, value) => {
      const newData = [...reviewData];
      newData[index] = { ...newData[index], [field]: value };
      setReviewData(newData);
    };

    // Handler to delete a row from reviewData
    const handleDeleteCoordinate = (index) => {
      const newData = reviewData.filter((_, i) => i !== index);
      setReviewData(newData);
    };

    // When the user clicks "Save Changes" in the review modal,
    // update the main coords state and close the modal.
    const handleSaveReviewChanges = () => {
      setCoords(reviewData);
      setIsModalOpen(false);
    };


    const customDownloadModalStyle = {
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

    const handleCustomDownload = async () => {
      if (userType === 'free' && downloadsRemaining <= 0) {
        handlePremiumFeatureAccess('Download Data');
        return;
      }

      if (userType === 'free') {
        setDownloadsRemaining(downloadsRemaining - 1);
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          const docRef = doc(firestore, 'users', user.uid);
          await setDoc(docRef, { downloadsRemaining: downloadsRemaining - 1 }, { merge: true });
        } else {
          localStorage.setItem('downloadCount', (downloadsRemaining - 1).toString());
        }
      }
    
      // 3) Build the data object (this is used only for the JSON export)
      const datasetName = selectedDataset || newDatasetName || 'My Dataset';
      const finalData = {
        dataset: {
          name: datasetName,
          description: '',
          price: 0.0,
          category: 'GAA',
          created_at: null,
          updated_at: null
        },
        games: [
          {
            gameName: gameName || 'Unnamed Game',
            matchDate: matchDate || null,
            sport: 'GAA',
            gameData: coords
          }
        ]
      };
    
      // 4) Create a safe file name by replacing spaces with underscores
      const fileNameSafe = downloadFileName.replace(/\s+/g, '_');
      let fileBlob;
      let extension = downloadFormat; // 'json' | 'csv' | 'xlsx'
    
      if (downloadFormat === 'json') {
        // Create JSON file
        const jsonString = JSON.stringify(finalData, null, 2);
        fileBlob = new Blob([jsonString], { type: 'application/json' });
      } else if (downloadFormat === 'csv') {
        // Create a minimal CSV file using only a few fields (adjust if needed)
        const header = ['team', 'playerName', 'action', 'x', 'y'].join(',');
        const rows = coords.map(c => [c.team, c.playerName, c.action, c.x, c.y].join(','));
        const csvOutput = [header, ...rows].join('\n');
        fileBlob = new Blob([csvOutput], { type: 'text/csv' });
      } else if (downloadFormat === 'xlsx') {
        // --------------- XLSX ---------------
        // Define the header row with all desired fields
        const header = [
          'action',
          'foot',
          'from',
          'minute',
          'player',
          'playerName',
          'position',
          'pressure',
          'team',
          'to',
          'type',
          'x',
          'y'
        ];
        // Map the coords to rows
        const dataRows = coords.map(c => [
          c.action,
          c.foot,
          c.from ? JSON.stringify(c.from) : '',
          c.minute,
          c.player,
          c.playerName,
          c.position,
          c.pressure,
          c.team,
          c.to ? JSON.stringify(c.to) : '',
          c.type,
          c.x,
          c.y
        ]);
        // Combine header and rows
        const sheetData = [header, ...dataRows];
    
        // Create a worksheet and workbook using SheetJS
        const ws = utils.aoa_to_sheet(sheetData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Data');
    
        // Write the workbook and trigger the download
        writeFile(wb, `${fileNameSafe}.xlsx`);
    
        // Close the modal and exit the function (skip the blob download code below)
        setIsCustomDownloadModalOpen(false);
        return;
      }
    
      // 5) For JSON or CSV, trigger a download from the Blob
      if (fileBlob) {
        const url = URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileNameSafe}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    
      // 6) Close the modal
      setIsCustomDownloadModalOpen(false);
    };    

    const handleStartNewGame = () => {
      setIsInitialSetupModalOpen(false);
      setIsSetupTeamModalOpen(true); // directly open the black setup team modal
    };
    
    
    const handleSkipSetup = () => {
      setIsInitialSetupModalOpen(false);
      // Proceed to main functionality, e.g., initializing default teams or leaving them empty
    };
    
    const handleNewGameSetupSubmit = (gameSetupData) => {
      // Validate or process gameSetupData if necessary
      // You can set the team names, colors, match date, and players here
      // For example:
      setTeam1(gameSetupData.team1);
      setTeam2(gameSetupData.team2);
      setTeam1Color(gameSetupData.team1Color);
      setTeam2Color(gameSetupData.team2Color);
      setMatchDate(gameSetupData.matchDate);
      setTeam1Players(gameSetupData.team1Players);
      setTeam2Players(gameSetupData.team2Players);
    
      // Optionally, open the Setup Teams Modal if needed
      setIsNewGameSetupModalOpen(false);
      setIsSetupTeamModalOpen(true);
    };

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
    if (userType === '') {
      handlePremiumFeatureAccess('Save Game');
      return;
    }
    setIsSaveModalOpen(true);
  };

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
      console.log(' GAA Pitch mounted. LoadedCoords from context:', loadedCoords);
      if (loadedCoords) {
        setCoords(loadedCoords);
        console.log('Coords updated:', loadedCoords);
      } else {
        console.log('No loadedCoords found in context');
      }
    }, [loadedCoords]);

  useEffect(() => {
    setActionButtons([
      { label: 'Point', value: 'point', color: '#048522', type: 'marker' },
      { label: 'Wide', value: 'wide', color: '#ff0000', type: 'marker' },
      { label: 'Goal', value: 'goal', color: '#0000ff', type: 'marker' },
      { label: 'Miss', value: 'miss', color: '#ff00ff', type: 'marker' },
      { label: 'Pass Completed', value: 'successful pass', color: '#00ffff', type: 'line' },
      { label: 'Pass Incomplete', value: 'unsuccessful pass', color: '#ffff00', type: 'line' }
    ]);
  }, []);

  const handleSetupTeams = () => {
    setIsSetupTeamModalOpen(false);
  };

// Full handleSaveGame function
const handleSaveGame = async () => {
  console.log('handleSaveGame called'); // Debugging statement

  if (userType === '') {
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
      sport: 'GAA',
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
      sport: 'GAA',
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
    'point', 'wide', 'goal', 'goal miss', 'free', 'missed free', 'short', 'blocked', 'offensive mark', 'offensive mark wide', 'post',
    'free short', 'free wide', 'mark wide', 'missed 45', 'penalty goal', 'pen miss', 'successful pass', 'unsuccessful pass', 'successful kickout', 'unsuccessful kickout'
  ];

  const initialPositions = [
    'forward', 'midfield', 'back', 'goalkeeper'
  ];

  const initialCounties = [
    'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry',
    'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon',
    'Sligo', 'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
  ];

  const pressures = ['0', '1', '2'];
  const feet = ['Right', 'Left', 'Hand'];

  const [actionCodes, setActionCodes] = useState(initialActionCodes);
  const [positions, setPositions] = useState(initialPositions);
  const [counties, setCounties] = useState(initialCounties);
  const [recentActions, setRecentActions] = useState([]);
  const [recentTeams, setRecentTeams] = useState([]);
  const [teams, setTeams] = useState(initialCounties);


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

            // Handle downloadsRemaining
            const lastDownloadDate = userData.lastDownloadDate;
            const today = new Date().toLocaleDateString();
            if (lastDownloadDate === today) {
              setDownloadsRemaining(userData.downloadsRemaining);
            } else {
              setDoc(docRef, { lastDownloadDate: today, downloadsRemaining: FREE_USER_DOWNLOAD_LIMIT }, { merge: true });
              setDownloadsRemaining(FREE_USER_DOWNLOAD_LIMIT);
            }
            
          } else {
            // If user document doesn't exist, create it with default values
            setDoc(docRef, {
              role: 'free', // Changed from userType to role
              lastDownloadDate: new Date().toLocaleDateString(),
              downloadsRemaining: FREE_USER_DOWNLOAD_LIMIT,
            });
            setUserType('free');
            setDownloadsRemaining(FREE_USER_DOWNLOAD_LIMIT);
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
          setDownloadsRemaining(parseInt(storedDownloadCount, 10) || FREE_USER_DOWNLOAD_LIMIT);
        } else {
          localStorage.setItem('lastDownloadDate', today);
          localStorage.setItem('downloadCount', FREE_USER_DOWNLOAD_LIMIT.toString());
          setDownloadsRemaining(FREE_USER_DOWNLOAD_LIMIT);
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
      setFormData({ ...formData, x: newCoord.x, y: newCoord.y, type: actionType.value });
      setOpenDialog(true);
    }
  };

  const handleTap = (e) => {
    handleClick(e);
  };

    const handlePlayerClick = (team, playerName, playerNumber) => {
    // Update form data with player info
    setFormData({
      ...formData,
      team: team,
      playerName: playerName,
      player: playerNumber,
    });
    
    // Make sure an action type is selected if none is currently selected
    if (!actionType) {
      // Set a default action type (first one in the list)
      setActionType(actionButtons[0]);
    }
    
    // Optional: Add visual feedback to show the player was selected
    Swal.fire({
      title: 'Player Selected',
      text: `${playerName} (${playerNumber}) from ${team} selected. Now click on the pitch to record an action.`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
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
      setCounties([...counties, customInput.team]);
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
      team: formData.team || counties[0],
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
      action: 'point',
      team: 'Armagh',
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

  const handleScreenshot = () => {
    const screenshotLayer = document.createElement('div');
    screenshotLayer.style.position = 'absolute';
    screenshotLayer.style.top = '-9999px';
    document.body.appendChild(screenshotLayer);

    const stage = new Konva.Stage({
      container: screenshotLayer,
      width: canvasSize.width,
      height: canvasSize.height,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    // Render the pitch
    renderGAAPitchForScreenshot(layer);

    // Add all markers and arrows
    coords.forEach((coord) => {
      if (coord.from && coord.to) {
        // Create arrow for line-type actions
        const arrow = new Konva.Arrow({
          points: [
            coord.from.x * xScale,
            coord.from.y * yScale,
            coord.to.x * xScale,
            coord.to.y * yScale
          ],
          stroke: getColor(coord.type),
          strokeWidth: 2,
          pointerLength: 10,
          pointerWidth: 10,
          fill: getColor(coord.type)
        });
        layer.add(arrow);
      } else {
        // Create circle for marker-type actions
        const circle = new Konva.Circle({
          x: coord.x * xScale,
          y: coord.y * yScale,
          radius: 6,
          fill: getColor(coord.type)
        });
        layer.add(circle);
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
    // If opening the modal (i.e. isModalOpen is false), copy current coords into reviewData.
    if (!isModalOpen) {
      setReviewData([...coords]);
    }
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

  const renderGAAPitch = () => {
    const numStripes = 10;
    const stripeWidth = canvasSize.width / numStripes;

    return (
      <Layer>
        {/* Pitch Background */}
        <Rect
          x={0}
          y={0}
          width={canvasSize.width}
          height={canvasSize.height}
          fill={pitchColor}
        />

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
      <Line points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} stroke={lineColor} strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasSize.width, yScale * 47.25]} stroke={lineColor} strokeWidth={2} />
      <Line points={[0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25]} stroke={lineColor} strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 37, xScale * 140.5, yScale * 37, xScale * 140.5, yScale * 51, canvasSize.width, yScale * 51]} stroke={lineColor} strokeWidth={2} />
      <Line points={[0, yScale * 37, xScale * 4.5, yScale * 37, xScale * 4.5, yScale * 51, 0, yScale * 51]} stroke={lineColor} strokeWidth={2} />
      <Line points={[0, yScale * 34.5, xScale * 13, yScale * 34.5, xScale * 13, yScale * 53.5, 0, yScale * 53.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 34.5, xScale * 132, yScale * 34.5, xScale * 132, yScale * 53.5, canvasSize.width, yScale * 53.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5]} stroke={lineColor} strokeWidth={2} />
      <Arc x={xScale * 125} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={90} stroke={lineColor} strokeWidth={2} />
      <Arc x={xScale * 20} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={270} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 13, 0, xScale * 13, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 132, 0, xScale * 132, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 20, 0, xScale * 20, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 125, 0, xScale * 125, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 45, 0, xScale * 45, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 100, 0, xScale * 100, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 65, 0, xScale * 65, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 80, 0, xScale * 80, canvasSize.height]} stroke={lineColor} strokeWidth={2} />

      <Arc
        x={xScale * 0}
        y={yScale * 44}
        innerRadius={xScale * 40}    // Set equal to outerRadius
        outerRadius={xScale * 40}
        angle={120}
        rotation={300}
        stroke={lineColor}
        strokeWidth={2}
        closed={false}
        lineCap="round"
        />

        <Arc
        x={xScale * 145}
        y={yScale * 44}
        innerRadius={xScale * 40}    // Set equal to outerRadius
        outerRadius={xScale * 40}
        angle={120}
        rotation={120}
        stroke={lineColor}
        strokeWidth={2}
        closed={false}
        lineCap="round"
        />

      {/* "SCORELECT" in the end zones */}
      <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSize.height / 40.25} fontSize={canvasSize.width / 60} f  fill="#D3D3D3" opacity={0.7} rotation={0} align="center" />
      <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 22.5} y={canvasSize.height / 1.02} fontSize={canvasSize.width / 60} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />

      </Layer>
    );
  };


  const renderGAAPitchForScreenshot = (layer) => {
    const fieldRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height,
      fill: pitchColor
    });
    layer.add(fieldRect);

    const lineColor = '#000';
    const lineWidth = 2;

    const fieldLines = new Konva.Line({
      points: [0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(fieldLines);

    const goalLines1 = new Konva.Line({
      points: [canvasSize.width, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasSize.width, yScale * 47.25],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(goalLines1);
    const goalLines2 = new Konva.Line({
      points: [0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(goalLines2);

    const sixYardBox1 = new Konva.Line({
      points: [canvasSize.width, yScale * 37, xScale * 139, yScale * 37, xScale * 139, yScale * 51, canvasSize.width, yScale * 51],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(sixYardBox1);
    const sixYardBox2 = new Konva.Line({
      points: [0, yScale * 37, xScale * 6, yScale * 37, xScale * 6, yScale * 51, 0, yScale * 51],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(sixYardBox2);

    const largeRectangle1 = new Konva.Line({
      points: [0, yScale * 34.5, xScale * 14, yScale * 34.5, xScale * 14, yScale * 53.5, 0, yScale * 53.5],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(largeRectangle1);
    const largeRectangle2 = new Konva.Line({
      points: [canvasSize.width, yScale * 34.5, xScale * 131, yScale * 34.5, xScale * 131, yScale * 53.5, canvasSize.width, yScale * 53.5],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(largeRectangle2);

    const halfwayLine = new Konva.Line({
      points: [xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(halfwayLine);

    const penoLine1 = new Konva.Line({
      points: [xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(penoLine1);
    const penoLine2 = new Konva.Line({
      points: [xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(penoLine2);

    const halfCircle1 = new Konva.Arc({
      x: xScale * 124,
      y: yScale * 44,
      innerRadius: 0,
      outerRadius: xScale * 12,
      angle: 180,
      rotation: 90,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(halfCircle1);
    const halfCircle2 = new Konva.Arc({
      x: xScale * 21,
      y: yScale * 44,
      innerRadius: 0,
      outerRadius: xScale * 12,
      angle: 180,
      rotation: 270,
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(halfCircle2);

    const yardLine14_1 = new Konva.Line({
      points: [xScale * 14, 0, xScale * 14, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(yardLine14_1);
    const yardLine14_2 = new Konva.Line({
      points: [xScale * 131, 0, xScale * 131, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(yardLine14_2);

    const yardLine21_1 = new Konva.Line({
      points: [xScale * 21, 0, xScale * 21, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(yardLine21_1);
    const yardLine21_2 = new Konva.Line({
      points: [xScale * 124, 0, xScale * 124, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(yardLine21_2);

    const yardLine45_1 = new Konva.Line({
      points: [xScale * 45, 0, xScale * 45, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(yardLine45_1);
    const yardLine45_2 = new Konva.Line({
      points: [xScale * 100, 0, xScale * 100, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(yardLine45_2);

    const yardLine65_1 = new Konva.Line({
      points: [xScale * 65, 0, xScale * 65, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(yardLine65_1);
    const yardLine65_2 = new Konva.Line({
      points: [xScale * 80, 0, xScale * 80, canvasSize.height],
      stroke: lineColor,
      strokeWidth: lineWidth
    });
    layer.add(yardLine65_2);
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

  const FREE_USER_DOWNLOAD_LIMIT = 10; // Set the new free download limit

  const handleDownloadData = async () => {
    if (userType === 'free') {
      if (downloadsRemaining <= 0) {
        // Optionally reset downloads every month
        const lastResetDate = localStorage.getItem('lastResetDate');
        const today = new Date().toISOString().split('T')[0];
  
        if (lastResetDate !== today) {
          setDownloadsRemaining(FREE_USER_DOWNLOAD_LIMIT);
          localStorage.setItem('lastResetDate', today);
        } else {
          handlePremiumFeatureAccess('Download Data');
          return;
        }
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
        category: 'GAA',
        created_at: null,
        updated_at: null
      },
      games: [
        {
          gameName: gameName || 'Unnamed Game',
          matchDate: matchDate || null,
          sport: 'GAA',
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
    // 1) If user is free but out of downloads => upgrade
    if (userType === 'free') {
      handlePremiumFeatureAccess('Download Filtered Data');
      return;
    }
  
    // 2) Filter the coords
    const filteredCoords = coords.filter((coord) => {
      const matchTeam = downloadTeam ? coord.team === downloadTeam : true;
      const matchPlayer = downloadPlayer ? coord.playerName === downloadPlayer : true;
      const matchAction = downloadAction ? coord.action === downloadAction : true;
      return matchTeam && matchPlayer && matchAction;
    });
  
    // 3) Build data object
    const datasetName = selectedDataset || newDatasetName || 'My Dataset';
    const downloadData = {
      dataset: {
        name: datasetName,
        description: '',
        price: 0.0,
        category: 'GAA',
        created_at: null,
        updated_at: null
      },
      games: [
        {
          gameName: gameName || 'Unnamed Game',
          matchDate: matchDate || null,
          sport: 'GAA',
          gameData: filteredCoords
        }
      ]
    };
  
    // 4) Figure out extension & safe filename
    const fileNameSafe = filteredFileName.replace(/\s+/g, '_');
    let extension = filteredFormat;  // 'json','csv','xlsx'
    let fileBlob;
  
    if (filteredFormat === 'json') {
      // JSON approach
      const jsonString = JSON.stringify(downloadData, null, 2);
      fileBlob = new Blob([jsonString], { type: 'application/json' });
    } 
    else if (filteredFormat === 'csv') {
      // Minimal CSV example
      // Flatten just the "gameData" portion if you want
      const header = ['team','playerName','action','x','y'].join(',');
      const rows = filteredCoords.map(c =>
        [c.team, c.playerName, c.action, c.x, c.y].join(',')
      );
      const csvOutput = [header, ...rows].join('\n');
      fileBlob = new Blob([csvOutput], { type: 'text/csv' });
    }
    else if (filteredFormat === 'xlsx') {
      // Build sheet via sheetjs
      const sheetData = [
        ['team','playerName','action','x','y'],
        ...filteredCoords.map(c => [c.team, c.playerName, c.action, c.x, c.y]),
      ];
      const ws = utils.aoa_to_sheet(sheetData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'FilteredData');
      writeFile(wb, `${fileNameSafe}.xlsx`);
      
      // Close modal & return
      setIsDownloadModalOpen(false);
      return;
    }
  
    // 5) For JSON/CSV, do normal blob download
    if (fileBlob) {
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileNameSafe}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  
    // 6) Close the modal
    setIsDownloadModalOpen(false);
  };
  

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

  const handleUploadRawData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          
          // Validate the JSON structure
          if (validateUploadedData(jsonData)) {
            const gameData = jsonData.games?.[0]?.gameData || [];
            setCoords(gameData); // Load the data onto the pitch
            Swal.fire('Success', 'Raw data uploaded successfully!', 'success');
          } else {
            Swal.fire('Error', 'Invalid data format. Please upload a properly formatted JSON file.', 'error');
          }
        } catch (err) {
          Swal.fire('Error', 'Unable to parse the file. Please upload a valid JSON file.', 'error');
        }
      };
      reader.readAsText(file);
    }
  };
  
  const validateUploadedData = (data) => {
    if (
      data &&
      typeof data === 'object' &&
      data.dataset &&
      Array.isArray(data.games) &&
      data.games[0]?.gameData &&
      Array.isArray(data.games[0].gameData)
    ) {
      return true;
    }
    return false;
  };
  
  
  
  const handleAddAction = (newAction, newColor, newType) => {
    if (!actionCodes.includes(newAction)) {
      setActionButtons([...actionButtons, { label: newAction.charAt(0).toUpperCase() + newAction.slice(1), value: newAction, color: newColor, type: newType }]);
      setActionCodes([...actionCodes, newAction]);
    }
    setIsAddActionModalOpen(false);
  };

  return (
  <div className="scroll-container">
    <div className="pitch-graphic-container">

      {/* Initial Setup Modal */}
      <InitialSetupModal
        isOpen={isInitialSetupModalOpen}
        onStartNewGame={handleStartNewGame}
        onSkipSetup={handleSkipSetup}
      />

      {/* New Game Setup Modal */}
      <NewGameSetupModal
        isOpen={isNewGameSetupModalOpen}
        onClose={() => setIsNewGameSetupModalOpen(false)}
        onSubmit={handleNewGameSetupSubmit}
        initialTeam1={team1}
        initialTeam2={team2}
        initialTeam1Color={team1Color}
        initialTeam2Color={team2Color}
      />

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
          <button 
            className="button" 
            onClick={() => { 
              if (userType === 'free' && downloadsRemaining <= 0) { 
                handlePremiumFeatureAccess('Download Data'); 
                return; 
              } 
              setIsCustomDownloadModalOpen(true); 
            }} 
          >
            {userType === 'free' 
              ? `Download Data (${downloadsRemaining} download${downloadsRemaining === 1 ? '' : 's'} left)` 
              : 'Download Data (Unlimited)'}
          </button>
          <button className="button" onClick={toggleDownloadModal}>Download Filtered Data</button>
          <button className="button" onClick={toggleScreenshotModal}>Download Screenshot</button>
          <button className="button" onClick={toggleModal}>Review Data</button>
          <button className="button" onClick={handleOpenSaveModal}>Save Game</button>
          <button className="button" onClick={() => setIsSettingsModalOpen(true)}>Settings</button> {/* Settings button */}
          <button className="button" onClick={() => setIsSetupTeamModalOpen(true)}>Setup Team</button>
          <button className="button" onClick={() => document.getElementById('uploadRawDataInput').click()}>Upload Raw Data</button><input type="file" id="uploadRawDataInput"style={{ display: 'none' }} accept=".json" onChange={handleUploadRawData}/>
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
            preventDefault={false}
            style={{
              pointerEvents:
                openDialog ||
                openLineDialog ||
                isContextMenuOpen ||
                isInitialSetupModalOpen ||
                isNewGameSetupModalOpen
                  ? 'none'
                  : 'auto',
            }}
          >
          {renderGAAPitch()}
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
                    pointerLength={10} // Length of the arrowhead
                    pointerWidth={10}  // Width of the arrowhead
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
      <Rnd
      default={{
          x: Math.max( (window.innerWidth - 330) / 2, 0 ),
          y: Math.max( (window.innerHeight - 385) / 2, 0 ),
          width: 400,
          height: 500
        }}
        minWidth={300}
        minHeight={400}
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
          top: {
            cursor: 'n-resize',
            height: '10px',
            top: '-5px',
          },
          right: {
            cursor: 'e-resize',
            width: '10px',
            right: '-5px',
          },
          bottom: {
            cursor: 's-resize',
            height: '10px',
            bottom: '-5px',
          },
          left: {
            cursor: 'w-resize',
            width: '10px',
            left: '-5px',
          },
          topRight: {
            cursor: 'ne-resize',
            width: '20px',
            height: '20px',
            right: '-10px',
            top: '-10px',
          },
          bottomRight: {
            cursor: 'se-resize',
            width: '20px',
            height: '20px',
            right: '-10px',
            bottom: '-10px',
          },
          bottomLeft: {
            cursor: 'sw-resize',
            width: '20px',
            height: '20px',
            left: '-10px',
            bottom: '-10px',
          },
          topLeft: {
            cursor: 'nw-resize',
            width: '20px',
            height: '20px',
            left: '-10px',
            top: '-10px',
          },
        }}
        style={{ zIndex: 1000 }}
      >
        <div className="dialog-container">
          <div className="dialog-header drag-handle">
            <h3>Enter Action Details</h3>
            <button className="close-button" onClick={handleCloseDialog}>
              &#10005;
            </button>
          </div>
          <div className="form-content">
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
                    onChange={(e) =>
                      setCustomInput({ ...customInput, action: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
            <div className="form-group">
            <label>Team:</label>
              <select name="team" value={formData.team} onChange={handleChange}>
                {
                  // IF user typed something in team1/team2, show only those.
                  // IF they skipped, fallback to the entire county list (or any default).
                  (team1 || team2)
                    ? (
                      <>
                        {team1 && <option value={team1}>{team1}</option>}
                        {team2 && <option value={team2}>{team2}</option>}
                      </>
                    )
                    : (
                      // fallback list of counties
                      initialCounties.map(county => (
                        <option key={county} value={county}>
                          {county}
                        </option>
                      ))
                    )
                }
              </select>

              {formData.team === 'custom' && (
                <div className="form-group">
                  <label>New Team Name:</label>
                  <input
                    type="text"
                    name="customTeam"
                    value={customInput.team}
                    onChange={(e) =>
                      setCustomInput({ ...customInput, team: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Player Name:</label>
              <input
                type="text"
                name="playerName"
                value={formData.playerName}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Player Number:</label>
              <input
                type="text"
                name="player"
                value={formData.player}
                onChange={handleChange}
              />
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
                    onChange={(e) =>
                      setCustomInput({ ...customInput, position: e.target.value })
                    }
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
                    onChange={(e) =>
                      setCustomInput({ ...customInput, pressure: e.target.value })
                    }
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
                  <label>New Hand:</label>
                  <input
                    type="text"
                    name="customFoot"
                    value={customInput.foot}
                    onChange={(e) =>
                      setCustomInput({ ...customInput, foot: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Minute:</label>
              <input
                type="text"
                name="minute"
                value={formData.minute}
                onChange={handleChange}
              />
            </div>
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
          <div className="dialog-header">
            <h3>Enter Action Details for Line</h3>
            <button className="close-button" onClick={handleCloseLineDialog}>
              &#10005;
            </button>
          </div>
          <div className="form-content">
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
                {counties.map((county) => (
                  <option key={county} value={county}>
                    {county}
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
          </div>
          <div className="button-container">
            <button className="button" onClick={handleCloseLineDialog}>
              Cancel
            </button>
            <button className="button" onClick={handleFormSubmit}>
              Submit
            </button>
          </div>
        </div>
      </Rnd>
    )}

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
            zIndex: 1000,
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
          {/* New: Review Data Button */}
          <button
            onClick={toggleReviewModal}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Review Data
          </button>
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
  <h2 style={{ color: '#fff', marginBottom: '20px' }}>Download Filtered Data</h2>

  {/* Filter by Team */}
  <div className="form-group" style={{ marginBottom: '15px' }}>
    <label style={{ color: '#fff' }}>Team:</label>
    <select
      value={downloadTeam}
      onChange={(e) => setDownloadTeam(e.target.value)}
      style={{
        width: '97%',
        padding: '10px',
        marginTop: '5px',
        borderRadius: '5px',
        border: '1px solid #ccc',
      }}
    >
      <option value="">All Teams</option>
      {counties.map((county) => (
        <option key={county} value={county}>
          {county}
        </option>
      ))}
    </select>
  </div>

  {/* Filter by Player */}
  <div className="form-group" style={{ marginBottom: '15px' }}>
    <label style={{ color: '#fff' }}>Player:</label>
    <input
      type="text"
      value={downloadPlayer}
      onChange={(e) => setDownloadPlayer(e.target.value)}
      placeholder="Enter player name"
      style={{
        width: '97%',
        padding: '10px',
        marginTop: '5px',
        borderRadius: '5px',
        border: '1px solid #ccc',
      }}
    />
  </div>

  {/* Filter by Action */}
  <div className="form-group" style={{ marginBottom: '15px' }}>
    <label style={{ color: '#fff' }}>Action:</label>
    <select
      value={downloadAction}
      onChange={(e) => setDownloadAction(e.target.value)}
      style={{
        width: '97%',
        padding: '10px',
        marginTop: '5px',
        borderRadius: '5px',
        border: '1px solid #ccc',
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

  {/* New: File name + File format */}
  <div className="form-group" style={{ marginBottom: '15px' }}>
    <label style={{ color: '#fff' }}>File Name:</label>
    <input
      type="text"
      value={filteredFileName}
      onChange={(e) => setFilteredFileName(e.target.value)}
      placeholder="filtered_data"
      style={{
        width: '97%',
        padding: '10px',
        marginTop: '5px',
        borderRadius: '5px',
        border: '1px solid #ccc',
      }}
    />
  </div>

  <div className="form-group" style={{ marginBottom: '15px' }}>
    <label style={{ color: '#fff' }}>File Format:</label>
    <select
      value={filteredFormat}
      onChange={(e) => setFilteredFormat(e.target.value)}
      style={{
        width: '97%',
        padding: '10px',
        marginTop: '5px',
        borderRadius: '5px',
        border: '1px solid #ccc',
      }}
    >
      <option value="json">JSON</option>
      <option value="csv">CSV</option>
      <option value="xlsx">Excel (.xlsx)</option>
    </select>
  </div>

  {/* Buttons */}
  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25px' }}>
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
    <label>Filter by Team:</label>
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
      {counties.map((county) => (
        <option key={county} value={county}>
          {county}
        </option>
      ))}
    </select>
  </div>
  <div className="form-group">
    <label>Filter by Player:</label>
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
    <label>Filter by Action:</label>
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
      onClick={handleScreenshot}
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
      Download Screenshot
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
        <h2 style={{ color: '#fff' }}>Setup Teams</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
          <div className="team-setup">
            <h3 style={{ color: '#fff' }}>Team 1</h3>
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
            <h4 style={{ color: '#fff' }}>Players</h4>
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
            <h3 style={{ color: '#fff' }}>Team 2</h3>
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
            <h4 style={{ color: '#fff' }}>Players</h4>
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

      <Modal
        isOpen={isCustomDownloadModalOpen}
        onRequestClose={() => setIsCustomDownloadModalOpen(false)}
        contentLabel="Custom Download"
        style={customDownloadModalStyle}  // <-- Use the style object
      >
        <h2 style={{ color: '#fff' }}>Download Data</h2>
        
        <div className="form-group">
          <label style={{ color: '#fff' }}>File Name:</label>
          <input
            type="text"
            value={downloadFileName}
            onChange={(e) => setDownloadFileName(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              margin: '5px 0',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
          />
        </div>

        <div className="form-group">
          <label style={{ color: '#fff' }}>File Format:</label>
          <select
            value={downloadFormat}
            onChange={(e) => setDownloadFormat(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              margin: '5px 0',
              borderRadius: '5px',
              border: '1px solid #ccc',
            }}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (.xlsx)</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={() => setIsCustomDownloadModalOpen(false)}
            style={{
              marginRight: '10px',
              background: '#6c757d',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCustomDownload}
            style={{
              background: '#007bff',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Download
          </button>
        </div>
      </Modal>


      <Modal
      isOpen={isModalOpen}
      onRequestClose={toggleReviewModal}
      contentLabel="Review Data"
      style={{
        overlay: {
          zIndex: 2000,  // Higher than Save Game modal's 1000
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        },
        content: {
          top: '50%',
          left: '50%',
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#2e2e2e',
          padding: '20px',
          borderRadius: '10px',
          maxHeight: '80vh',
          overflowY: 'auto',
          border: 'none'
        }
      }}
    >
      <div className="review-modal-container">
        <h2 className="review-modal-header" style={{ color: '#fff', textAlign: 'center', marginBottom: '15px' }}>
          Review Data
        </h2>
        <table className="review-table" style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Action</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Team</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Player #</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Player Name</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Position</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Pressure</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Foot</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Minute</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>X</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Y</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {reviewData.map((coord, index) => (
              <tr key={index}>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={coord.action}
                    onChange={(e) => handleReviewChange(index, 'action', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={coord.team}
                    onChange={(e) => handleReviewChange(index, 'team', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={coord.player}
                    onChange={(e) => handleReviewChange(index, 'player', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={coord.playerName}
                    onChange={(e) => handleReviewChange(index, 'playerName', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={coord.position}
                    onChange={(e) => handleReviewChange(index, 'position', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={coord.pressure}
                    onChange={(e) => handleReviewChange(index, 'pressure', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={coord.foot}
                    onChange={(e) => handleReviewChange(index, 'foot', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    value={coord.minute}
                    onChange={(e) => handleReviewChange(index, 'minute', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="number"
                    value={coord.x}
                    onChange={(e) => handleReviewChange(index, 'x', parseFloat(e.target.value))}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="number"
                    value={coord.y}
                    onChange={(e) => handleReviewChange(index, 'y', parseFloat(e.target.value))}
                    style={{ width: '100%', backgroundColor: '#2e2e2e', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '4px' }}
                  />
                </td>
                <td style={{ textAlign: 'center', padding: '8px' }}>
                  <button
                    className="review-modal-btn"
                    onClick={() => handleDeleteCoordinate(index)}
                    style={{
                      backgroundColor: '#cf4242',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#fff',
                      padding: '4px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: '15px' }}>
          <button
            className="review-modal-btn"
            onClick={handleSaveReviewChanges}
            style={{
              backgroundColor: '#007bff',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              padding: '8px 16px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Save Changes
          </button>
          <button
            className="review-modal-btn"
            onClick={toggleReviewModal}
            style={{
              backgroundColor: '#6c757d',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              padding: '8px 16px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>



    </div>
  );
};

export default PitchGraphic;
