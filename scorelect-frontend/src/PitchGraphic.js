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
import './PitchGraphicMobile.css';
import './PitchGraphicLaptop.css';
import AggregatedData from './AggregatedData';
import { onSnapshot } from 'firebase/firestore'; // Add this import
import { GameContext } from './GameContext'; // Import GameContext
import { Rnd } from 'react-rnd';
import { utils, writeFile } from 'xlsx';
import { saveAs } from 'file-saver';
import InitialSetupModal from './components/InitialSetupModal';
import NewGameSetupModal from './components/NewGameSetupModal';
import Draggable from 'react-draggable';


// Phone detection: the CSS-width check, plus a fallback for phones whose browser
// reports a desktop-size width (missing viewport meta tag or "Desktop site" mode).
const isPhoneScreen = () => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) return true;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return touch && shortSide <= 768;
};

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
  const [displayPlayerNumber, setDisplayPlayerNumber] = useState(true);
  const [displayPlayerName, setDisplayPlayerName] = useState(true);
  const [isSetupTeamsModalOpen, setIsSetupTeamsModalOpen] = useState(false);
  // helper that builds 30 independent objects
  const buildEmptyTeam = () =>
    Array.from({ length: 30 }, (_, i) => ({ name: '', number: i + 1 }));

  const [team1Players, setTeam1Players] = useState(buildEmptyTeam());
  const [team2Players, setTeam2Players] = useState(buildEmptyTeam());
  
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
  const [isMobileViewport, setIsMobileViewport] = useState(() => isPhoneScreen());
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;

  // ---------- Mobile layout state ----------
  const pitchWrapRef = useRef(null);
  const pitchLayerRef = useRef(null);
  const [pitchView, setPitchView] = useState('full'); // 'full' | 'top' | 'bottom' (portrait only)
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeTeamTab, setActiveTeamTab] = useState(1);
  const [showSubs, setShowSubs] = useState(false);
  const [lastSaved, setLastSaved] = useState(null); // { label, color } for the undo toast
  const toastTimerRef = useRef(null);
  const lastChoicesRef = useRef({}); // remembers foot/pressure per player
  const mobileUploadRef = useRef(null);
  const [sheetType, setSheetType] = useState('play');
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Laptop toolbar menus ('export' | 'settings' | null)
  const [openMenu, setOpenMenu] = useState(null);

  // Set up match modal
  const [setupTab, setSetupTab] = useState(1);
  const [setupSubs, setSetupSubs] = useState({ 1: false, 2: false });
  const [setupTouched, setSetupTouched] = useState({ 1: false, 2: false });
  const [setupAttempted, setSetupAttempted] = useState(false);

  // Keyboard shortcuts in the laptop shot dialog (handlers refreshed every render)
  const shotShortcutRef = useRef(null);
  const shotSubmitRef = useRef(null);

  // canvasSize ALWAYS stays in landscape terms (length x width), so xScale/yScale
  // and the saved coordinates never change. In portrait we just rotate the layers.
  const isPortrait = isMobileViewport;
  const halfView = isPortrait && pitchView !== 'full';
  const stageW = isPortrait ? canvasSize.height : canvasSize.width;
  const stageH = isPortrait
    ? (halfView ? canvasSize.width / 2 : canvasSize.width)
    : canvasSize.height;
  const layerOffsetY = halfView && pitchView === 'bottom' ? -canvasSize.width / 2 : 0;
  const layerTransform = isPortrait
    ? { rotation: 90, x: canvasSize.height, y: layerOffsetY }
    : { rotation: 0, x: 0, y: 0 };
  const counterRotation = isPortrait ? -90 : 0;

  // Size the pitch to the space available (replaces the iPhone/iPad/Computer buttons)
  useEffect(() => {
    const el = pitchWrapRef.current;
    if (!el) return;

    const compute = () => {
      const portrait = isPhoneScreen();
      setIsMobileViewport(portrait);
      const available = portrait
        ? Math.min(el.clientWidth || window.innerWidth, window.innerWidth) - 16
        : (el.clientWidth || 800);

      if (portrait) {
        // on screen, the pitch's width is the landscape height
        let h = available;
        if (pitchView === 'full') {
          const reserved = 270; // score bar + player strip + bottom toolbar
          const maxByHeight = (window.innerHeight - reserved) * (pitchHeight / pitchWidth);
          h = Math.min(available, Math.max(maxByHeight, 220));
        }
        setCanvasSize({ width: h * (pitchWidth / pitchHeight), height: h });
      } else {
        const w = Math.min(available, 1000);
        setCanvasSize({ width: w, height: w * (pitchHeight / pitchWidth) });
      }
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [pitchView, isMobileViewport]);

  // Laptop shot dialog: P/G/W/S/O/B/V pick the outcome, Enter saves (Esc is handled by the modal)
  useEffect(() => {
    if (!openDialog || isMobileViewport) return undefined;
    const KEYS = { p: 'Point', g: 'Goal', w: 'Wide', s: 'Short', o: 'Post', b: 'Blocked', v: 'Saved' };
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (e.key === 'Enter') {
        if (tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        if (shotSubmitRef.current) shotSubmitRef.current();
        return;
      }
      if (typing) return;
      const outcome = KEYS[(e.key || '').toLowerCase()];
      if (outcome && shotShortcutRef.current) {
        e.preventDefault();
        shotShortcutRef.current(outcome);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDialog, isMobileViewport]);

  // Pointer position in the pitch layer's own (landscape pixel) coordinates,
  // whatever the rotation or half-pitch offset.
  const getPitchPointer = (stage) => {
    const layer = pitchLayerRef.current;
    if (layer && typeof layer.getRelativePointerPosition === 'function') {
      return layer.getRelativePointerPosition();
    }
    // Fallback for Konva < 8
    const p = stage.getPointerPosition();
    if (!isPortrait) return p;
    return { x: p.y - layerOffsetY, y: canvasSize.height - p.x };
  };

  const cyclePitchView = () => {
    setPitchView(v => (v === 'full' ? 'top' : v === 'top' ? 'bottom' : 'full'));
  };
  const pitchViewLabel = pitchView === 'full' ? 'Full pitch' : pitchView === 'top' ? 'Top half' : 'Bottom half';

  // Modal widths that fit a phone
  const mw = (desktopWidth) => (isMobileViewport ? '92%' : desktopWidth);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [gameName, setGameName] = useState('');
  const [saveTeamName, setSaveTeamName] = useState('');
  const [saveOpposition, setSaveOpposition] = useState('');
  const [saveCompetition, setSaveCompetition] = useState('');

  const COMPETITIONS = ['League', 'Cup', 'Championship', 'Friendly'];
  const [currentHalf, setCurrentHalf] = useState('1');
  const [halfFilter, setHalfFilter] = useState('current'); // 'current' | 'all'
  const HALVES = ['1', '2', 'ET1', 'ET2'];
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

    // Add a new state to track line completion
    const [lineCompleted, setLineCompleted] = useState(false);

    const [uploadedDataset, setUploadedDataset] = useState(null);

    const [isRefreshingDatasets, setIsRefreshingDatasets] = useState(false);

    const handleRefreshDatasets = async () => {
      if (!user) return;
      
      setIsRefreshingDatasets(true);
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
          console.error('Failed to refresh datasets:', errorData.error || response.statusText);
          setDatasetsFetchError(true);
          Swal.fire('Error', 'Failed to refresh datasets.', 'error');
          return;
        }
    
        const data = await response.json();
        setAvailableDatasets(data.datasets);
        setDatasetsFetchError(false);
        console.log('Datasets refreshed successfully:', data.datasets);
        
        // Show success message
        Swal.fire({
          title: 'Success',
          text: 'Datasets refreshed successfully!',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        
      } catch (error) {
        console.error('Error refreshing datasets:', error);
        setDatasetsFetchError(true);
        Swal.fire('Error', 'Network error while refreshing datasets.', 'error');
      } finally {
        setIsRefreshingDatasets(false);
      }
    };

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
        width: mw('50%'),
        maxHeight: isMobileViewport ? '85%' : '60%',
        overflowY: 'auto',
        background: '#2e2e2e',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      },
    };

    // Refined action button styles
    const actionButtonStyles = (action, isActive) => ({
      borderColor: action.color,
      borderWidth: '2px',
      borderStyle: 'solid',
      backgroundColor: isActive ? '#a020f0' : '#800080', // Brighter purple when active
      position: 'relative',
      boxShadow: isActive ? '0 0 8px 2px rgba(0, 255, 0, 0.4)' : 'none', // Green glow when active
      paddingRight: action.type === 'line' ? '40px' : '10px' // Extra padding for line actions
    });
    /*
    // Updated renderActionButtons function
    const renderActionButtons = () => (
      <div className="action-buttons">
        {actionButtons.map(action => (
          <button
            key={action.value}
            className={`action-button ${action.value} ${actionType && actionType.value === action.value ? 'active' : ''}`}
            onClick={() => handleActionButtonClick(action)}
            onContextMenu={(e) => {
              e.preventDefault();
              handleDeleteAction(action.value);
            }}
          >
            {action.label}
            
    //         {/* Line action state indicators - only show when this action is selected 
    //         {action.type === 'line' && actionType && actionType.value === action.value && (
    //           <div style={{
    //             position: 'absolute',
    //             top: '50%',
    //             right: '10px',
    //             transform: 'translateY(-50%)',
    //             display: 'flex',
    //             gap: '5px'
    //           }}>
    //             <span style={{
    //               width: '8px',
    //               height: '8px',
    //               borderRadius: '50%',
    //               backgroundColor: currentCoords.length >= 1 ? '#00ff00' : '#555',
    //               border: '1px solid #333',
    //               display: 'inline-block'
    //             }}></span>
    //             <span style={{
    //               width: '8px',
    //               height: '8px',
    //               borderRadius: '50%',
    //               backgroundColor: lineCompleted ? '#00ff00' : '#555',
    //               border: '1px solid #333',
    //               display: 'inline-block'
    //             }}></span>
    //           </div>
    //         )}
    //       </button>
    //     ))}
    //     <button 
    //       className="button"
    //       onClick={() => setIsAddActionModalOpen(true)}
    //       style={{ marginTop: '12px' }}
    //     >
    //       Add Action
    //     </button>
    //   </div>
    // ); */
    
    // 2) "Download Data" (custom modal) – respects free‑user limits, uses uploadedDataset if present
    const handleCustomDownload = async () => {
      // free‑user quota check
      if (userType === 'free' && downloadsRemaining <= 0) {
        handlePremiumFeatureAccess('Download Data');
        return;
      }
      if (userType === 'free') {
        setDownloadsRemaining(downloadsRemaining - 1);
        const auth = getAuth(), u = auth.currentUser;
        if (u) {
          await setDoc(doc(firestore, 'users', u.uid), { downloadsRemaining: downloadsRemaining - 1 }, { merge: true });
        } else {
          localStorage.setItem('downloadCount', (downloadsRemaining - 1).toString());
        }
      }

      // build the payload, preferring the uploadedDataset
      const datasetPayload = uploadedDataset || {
        name: selectedDataset || newDatasetName || 'My Dataset',
        description: '',
        price: 0.0,
        category: 'GAA',
        created_at: null,
        updated_at: null
      };
      const finalData = {
        dataset: datasetPayload,
        games: [{
          gameName: buildGameName() || 'Unnamed_Game',
          matchDate: matchDate || null,
          sport: 'GAA',
          gameData: coords
        }]
      };

      // file name + blob
      const fileNameSafe = downloadFileName.replace(/\s+/g, '_');
      let fileBlob, extension = downloadFormat;

      if (extension === 'json') {
        fileBlob = new Blob([JSON.stringify(finalData, null, 2)], { type: 'application/json' });

      } else if (extension === 'csv') {
        const header = ['team','playerName','action','x','y'].join(',');
        const rows = coords.map(c => [c.team,c.playerName,c.action,c.x,c.y].join(','));
        fileBlob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });

      } else if (extension === 'xlsx') {
        const header = ['action','foot','from','half', 'minute','player','playerName','position','pressure','team','to','type','x','y'];
        const dataRows = coords.map(c => [
          c.action, c.foot,
          c.from ? JSON.stringify(c.from) : '',
          c.half,
          c.minute, c.player, c.playerName,
          c.position, c.pressure,
          c.team,
          c.to ? JSON.stringify(c.to) : '',
          c.type, c.x, c.y
        ]);
        const ws = utils.aoa_to_sheet([ header, ...dataRows ]);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Data');
        writeFile(wb, `${fileNameSafe}.xlsx`);
        setIsCustomDownloadModalOpen(false);
        return;
      }

      // trigger JSON or CSV download
      if (fileBlob) {
        const url = URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileNameSafe}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setIsCustomDownloadModalOpen(false);
    };

     

    // 5) Open "new game" flow
    const handleStartNewGame = () => {
      setIsInitialSetupModalOpen(false);
      setIsSetupTeamModalOpen(true);
    };

    // 6) Skip initial setup entirely
    const handleSkipSetup = () => {
      setIsInitialSetupModalOpen(false);
      // …and proceed with whatever defaults you've got in place
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

    useEffect(() => {
      if (isSaveModalOpen) {
      if (!saveTeamName && team1) setSaveTeamName(team1);
      if (!saveOpposition && team2) setSaveOpposition(team2);
      }
    }, [isSaveModalOpen, team1, team2]);

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

  // if (!gameName.trim()) {
  //   Swal.fire('Invalid Game Name', 'Please enter a valid game name.', 'warning');
  //   return;
  // }
    if (!saveTeamName.trim()) {
    Swal.fire('Missing Team', 'Please enter your team name.', 'warning');
    return;
  }
  if (!saveOpposition.trim()) {
    Swal.fire('Missing Opposition', 'Please enter the opposition name.', 'warning');
    return;
  }
  if (!saveCompetition) {
    Swal.fire('Missing Competition', 'Please select a competition.', 'warning');
    return;
  }
  if (!matchDate) {
    Swal.fire('Missing Date', 'Please choose a match date.', 'warning');
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
    const generatedName = buildGameName();

    const token = await user.getIdToken();
    
    const payload = {
      uid: user.uid,
      gameName: generatedName,
      teamName: saveTeamName.trim(),
      opposition: saveOpposition.trim(),
      competition: saveCompetition,
      matchDate,
      gameData: coords,
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
      setSaveTeamName('');
      setSaveOpposition('');
      setSaveCompetition('');
      setMatchDate('');
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
// const handleSaveToDataset = async () => {
//   if (!gameName.trim()) {
//     Swal.fire('Invalid Game Name', 'Please enter a valid game name.', 'warning');
//     return;
//   }

//   if (!selectedDataset && selectedDataset !== 'new') {
//     Swal.fire('Select Dataset', 'Please select or create a dataset to save the game.', 'warning');
//     return;
//   }

//   setSaveDatasetButtonStatus('loading');

//   try {
//     const token = await user.getIdToken();
//     const payload = {
//       uid: user.uid,
//       gameName,
//       gameData: coords,
//       sport: 'GAA',
//       datasetName: selectedDataset === 'new' ? newDatasetName : selectedDataset
//     };

//     // Save the game (reuse the save-game endpoint)
//     const saveResponse = await fetch(`${process.env.REACT_APP_API_URL}/save-game`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${token}`
//       },
//       body: JSON.stringify(payload),
//     });

//     const saveData = await saveResponse.json();

//     if (saveResponse.ok) {
//       if (selectedDataset === 'new') {
//         // Create a new dataset
//         const createResponse = await fetch(`${process.env.REACT_APP_API_URL}/create-dataset`, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${token}`
//           },
//           body: JSON.stringify({
//             uid: user.uid,
//             datasetName: newDatasetName
//           }),
//         });

//         const createData = await createResponse.json();

//         if (createResponse.ok) {
//           setSaveDatasetButtonStatus('success');
//           Swal.fire('Dataset Created', `New dataset "${newDatasetName}" has been created and the game has been added.`, 'success');
//         } else {
//           setSaveDatasetButtonStatus('error');
//           Swal.fire('Error Creating Dataset', createData.error || 'Failed to create dataset.', 'error');
//         }
//       } else {
//         // Append to existing dataset
//         setSaveDatasetButtonStatus('success');
//         Swal.fire('Success', 'Game has been saved successfully to the dataset!', 'success');
//       }
//       // Reset modal state
//       setIsSaveModalOpen(false);
//       setGameName('');
//       setSaveToDataset(false);
//       setSelectedDataset('');
//       setNewDatasetName('');
//     } else {
//       setSaveDatasetButtonStatus('error');
//       Swal.fire('Error Saving Game', saveData.error || 'Failed to save game.', 'error');
//     }
//   } catch (error) {
//     setSaveDatasetButtonStatus('error');
//     Swal.fire('Error', 'Network error while saving to dataset.', 'error');
//   } finally {
//     // Reset button status after a short delay to show the success/error state
//     setTimeout(() => {
//       setSaveDatasetButtonStatus('idle');
//     }, 2000);
//   }
// };

// new
const sanitise = (s) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const buildGameName = () => {
  const parts = [saveTeamName, saveOpposition, saveCompetition].map(sanitise);
  const date = (matchDate || '').trim();
  return parts.every(Boolean) && date ? [...parts, date].join('_') : '';
};

  const initialActionCodes = [
    'point', 'wide', 'goal', 'free', 'free wide', 'goal miss', 'short', 'blocked', 'offensive mark', 'offensive mark wide', 'post',
    'free short', 'free post', 'mark wide', 'fortyfive', 'fortyfive wide', 'fortyfive short', 'fortyfive post', 'penalty goal', 'pen miss'
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


  // (The old single-letter keypress shortcuts were removed: they set action types
  // that no longer exist and clashed with the shot dialog shortcuts.)

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
  

  // Update the handleClick function to correctly light up indicators without showing messages every time
  const handleClick = (e) => {
    const stage = e.target.getStage();
    const point = getPitchPointer(stage); // landscape pixels in any orientation
    const newCoord = {
      x: point.x / xScale,
      y: pitchHeight - (point.y / yScale)  // Flip Y coordinate
    };

    // Ignore taps outside the pitch (e.g. the empty edge of a half-pitch view)
    if (newCoord.x < 0 || newCoord.x > pitchWidth || newCoord.y < 0 || newCoord.y > pitchHeight) return;

    // Team names are required before anything can be tagged
    if (!(team1 || '').trim() || !(team2 || '').trim()) {
      setSetupAttempted(true);
      setSetupTab(!(team1 || '').trim() ? 1 : 2);
      setIsSetupTeamModalOpen(true);
      return;
    }

    // Keep the player selected between shots: if an action was reset after the last
    // save but a player is still highlighted, fall back to the default marker action.
    let act = actionType;
    if (!act && selectedPlayer) {
      act = actionButtons[0];
      setActionType(act);
    }

    if (act && act.type === 'line') {
      if (currentCoords.length === 0) {
        // First click for line - store the starting point
        setCurrentCoords([newCoord]);
        setLineCompleted(false);
        
        // Only show the message the first time a user uses a line action in this session
        if (!localStorage.getItem('lineActionInstructionShown')) {
          Swal.fire({
            title: 'Starting Point Selected',
            text: 'Now click on the pitch again to set the end point of the line.',
            icon: 'info',
            timer: 2000,
            showConfirmButton: false
          });
          localStorage.setItem('lineActionInstructionShown', 'true');
        }
        
      } else if (currentCoords.length === 1) {
        // Second click for line - complete the line
        const fromCoord = currentCoords[0];
        const toCoord = newCoord;
        setFormData({
          ...formData,
          from: fromCoord,
          to: toCoord,
          type: act.value,
        });
        setLineCompleted(true); // Set line as completed
        setOpenLineDialog(true);
      }
    } else if (act) {
      // Regular marker action
      setFormData({ ...formData, x: newCoord.x, y: newCoord.y, type: act.value });
      setOpenDialog(true);
    } else {
      // No action type selected
      Swal.fire({
        title: 'Select a Player',
        text: isMobileViewport
          ? 'Tap a player number above the pitch first, then tap where the shot was taken.'
          : 'Please select a player before clicking on the pitch.',
        icon: 'warning',
        timer: 2000,
        showConfirmButton: false
      });
    }
  };

  const handleTap = (e) => {
    handleClick(e);
  };

    // Add this state to track selected player
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    // Modified handlePlayerClick function - remove Swal notification
    const handlePlayerClick = (teamName, playerName, playerNumber) => {
      // Pre-fill this player's last foot/pressure, if we've seen them before
      const remembered = lastChoicesRef.current[`${teamName}|${playerNumber}`] || {};

      // Update form data with player info
      setFormData({
        ...formData,
        ...remembered,
        team: teamName,
        playerName: playerName,
        player: playerNumber,
      });
      
      // Save the selected player info for highlighting
      setSelectedPlayer({ 
        team: teamName, 
        playerName: playerName, 
        playerNumber: playerNumber 
      });
      
      // Make sure an action type is selected if none is currently selected
      if (!actionType) {
        setActionType(actionButtons[0]);
      }
    };

  const handleRightClick = (e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const point = getPitchPointer(stage);
    const screen = stage.getPointerPosition();
    setCurrentCoords({ x: point.x / xScale, y: point.y / yScale });
    setIsContextMenuOpen(true);
    setContextMenuPosition({ x: screen.x, y: screen.y });
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Update handleCloseLineDialog to delay resetting currentCoords
  const handleCloseLineDialog = () => {
    setOpenLineDialog(false);
    
    // Keep the indicators lit for 2 seconds before resetting
    setTimeout(() => {
      setCurrentCoords([]);
      setLineCompleted(false);
    }, 2000);
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
      half: currentHalf,
      x: formData.x,
      y: formData.y,
      type: formData.type,
      from: formData.from,
      to: formData.to
    };
    setCoords([...coords, updatedFormData]);
    
    // Store whether this was a line action
    const wasLineAction = formData.from && formData.to;
    
    setOpenDialog(false);
    setOpenLineDialog(false);
    setRecentActions([formData.action, ...recentActions.filter(action => action !== formData.action)]);
    setRecentTeams([formData.team, ...recentTeams.filter(team => team !== formData.team)]);

    // Remember this player's foot/pressure for next time
    if (updatedFormData.player !== '') {
      lastChoicesRef.current[`${updatedFormData.team}|${updatedFormData.player}`] = {
        foot: updatedFormData.foot,
        pressure: updatedFormData.pressure,
      };
    }

    // Undo toast
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setLastSaved({
      label: `${updatedFormData.action}${updatedFormData.player !== '' ? ` · #${updatedFormData.player}` : ''}${updatedFormData.playerName ? ` ${updatedFormData.playerName}` : ''}${updatedFormData.minute ? ` · ${updatedFormData.minute}'` : ''}`,
      color: pointValueFor(updatedFormData) > 0 ? '#0b8a2c' : '#d93025',
    });
    toastTimerRef.current = setTimeout(() => setLastSaved(null), 4000);

    // Reset the form, but keep the selected player (still highlighted) and the minute
    setFormData({
      action: 'point',
      team: selectedPlayer ? selectedPlayer.team : 'Armagh',
      playerName: selectedPlayer ? selectedPlayer.playerName : '',
      player: selectedPlayer ? selectedPlayer.playerNumber : '',
      position: 'forward',
      pressure: '0',
      foot: 'Right',
      minute: updatedFormData.minute || '',
      from: null,
      to: null,
      ...(selectedPlayer ? (lastChoicesRef.current[`${selectedPlayer.team}|${selectedPlayer.playerNumber}`] || {}) : {}),
    });
    
    // If it was a line action, delay resetting currentCoords and lineCompleted
    if (wasLineAction) {
      setTimeout(() => {
        setCurrentCoords([]);
        setLineCompleted(false);
        setIsContextMenuOpen(false);
        setActionType(''); // Reset actionType after delay
      }, 2000);
    } else {
      // For non-line actions, reset immediately
      setCurrentCoords([]);
      setLineCompleted(false);
      setIsContextMenuOpen(false);
      setActionType(''); // Reset actionType here
    }
    
    setCustomInput({ action: '', team: '', position: '', pressure: '', foot: '', color: '#000000', type: 'marker' });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleActionButtonClick = (action) => {
    setActionType(action);
    setFormData({ ...formData, action: action.value });
    setCurrentCoords([]); // Reset line state when changing actions
    setLineCompleted(false); // Reset line completion state
  };

  const handleClearMarkers = () => {
    setCoords(coords.filter(c => (c.half || '1') !== currentHalf));
  };

  const handleUndoLastMarker = () => {
    const reverseIdx = [...coords].reverse().findIndex(c => (c.half || '1') === currentHalf);
    if (reverseIdx === -1) return;
    const realIdx = coords.length - 1 - reverseIdx;
    setCoords(coords.filter((_, i) => i !== realIdx));
    setLastSaved(null);
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
            (pitchHeight - coord.from.y) * yScale,  // Flip Y
            coord.to.x * xScale,
            (pitchHeight - coord.to.y) * yScale     // Flip Y
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
          y: (pitchHeight - coord.y) * yScale,  // Flip Y
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
    // If opening the modal (i.e. isModalOpen is false) then copy current coords into reviewData.
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
      <Layer ref={pitchLayerRef} {...layerTransform}>
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

  // 3) Legacy "Download Data" button (no custom modal) — same dataset logic
  const handleDownloadData = async () => {
    if (userType === 'free') {
      if (downloadsRemaining <= 0) {
        handlePremiumFeatureAccess('Download Data');
        return;
      }
      setDownloadsRemaining(downloadsRemaining - 1);
      const auth = getAuth(), u = auth.currentUser;
      if (u) {
        await setDoc(doc(firestore, 'users', u.uid), { downloadsRemaining: downloadsRemaining - 1 }, { merge: true });
      } else {
        localStorage.setItem('downloadCount', (downloadsRemaining - 1).toString());
      }
    }

    const ds = uploadedDataset || {
      name: selectedDataset || newDatasetName || 'My Dataset',
      description: '',
      price: 0.0,
      category: 'GAA',
      created_at: null,
      updated_at: null
    };

    const fileBase = buildGameName() || 'Unnamed_Game';

    const payload = {
      dataset: ds,
      games: [{
        gameName: buildGameName() || 'Unnamed_Game',
        matchDate: matchDate || null,
        sport: 'GAA',
        gameData: coords
      }]
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ds.name.replace(/\s+/g,'_')}_${fileBase}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  

  // 4) Download only the filtered coords
  const handleDownloadFilteredData = async () => {
    if (userType === 'free') {
      handlePremiumFeatureAccess('Download Filtered Data');
      return;
    }

    const filteredCoords = coords.filter(c => 
      (!downloadTeam   || c.team       === downloadTeam) &&
      (!downloadPlayer || c.playerName === downloadPlayer) &&
      (!downloadAction || c.action     === downloadAction)
    );

    const ds = uploadedDataset || {
      name: selectedDataset || newDatasetName || 'My Dataset',
      description: '',
      price: 0.0,
      category: 'GAA',
      created_at: null,
      updated_at: null
    };

    const fileBase = buildGameName() || 'Unnamed_Game';

    const payload = {
      dataset: ds,
      games: [{
        gameName: fileBase,
        matchDate: matchDate || null,
        sport: 'GAA',
        gameData: filteredCoords
      }]
    };


    const fileNameSafe = filteredFileName.replace(/\s+/g, '_');
    let fileBlob, ext = filteredFormat;

    if (ext === 'json') {
      fileBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });

    } else if (ext === 'csv') {
      const header = ['team','playerName','action','x','y'].join(',');
      const rows = filteredCoords.map(c => [c.team,c.playerName,c.action,c.x,c.y].join(','));
      fileBlob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });

    } else if (ext === 'xlsx') {
      const sheetData = [
        ['team','playerName','action','x','y'],
        ...filteredCoords.map(c => [c.team,c.playerName,c.action,c.x,c.y])
      ];
      const ws = utils.aoa_to_sheet(sheetData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'FilteredData');
      writeFile(wb, `${fileNameSafe}.xlsx`);
      setIsDownloadModalOpen(false);
      return;
    }

    if (fileBlob) {
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileNameSafe}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

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
  
  const updatePlayerInTeam1 = (index, field, value) =>
    setTeam1Players(prev =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  
  const updatePlayerInTeam2 = (index, field, value) =>
    setTeam2Players(prev =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );  
  
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
            key={`${teamName}-${index}`}
            onClick={() => handlePlayerClick(teamName, player.name, index + 1)}
            style={playerButtonStyle(player, teamName, index, teamColor)}
            className="player-button"
          >
            {displayPlayerNumber && (index + 1)} {displayPlayerName && player.name}
          </button>
        ))}
      </div>
    </div>
  );

  // 1) Upload raw JSON and store both dataset metadata + coords
const handleUploadRawData = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);
      if (!validateUploadedData(jsonData)) {
        Swal.fire('Error', 'Invalid data format…', 'error');
        return;
      }

      // store the full dataset metadata
      setUploadedDataset(jsonData.dataset);

      // now grab the first game
      const game = jsonData.games[0];
      setGameName(game.gameName    || '');
      setMatchDate(game.matchDate  || '');
      setCoords(   game.gameData   || []);

      Swal.fire('Success', 'Raw data uploaded successfully!', 'success');
    } catch {
      Swal.fire('Error', 'Unable to parse the file…', 'error');
    }
  };

  reader.readAsText(file);
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

  // Add this style function for player buttons
  const playerButtonStyle = (player, teamName, index, teamColor) => {
    const isSelected = selectedPlayer &&
      selectedPlayer.team === teamName &&
      selectedPlayer.playerNumber === (index + 1);

    return {
      backgroundColor: isSelected ? '#a020f0' : teamColor.main,
      color: isSelected ? '#fff' : teamColor.secondary,
      boxShadow: isSelected ? '0 0 8px 2px rgba(0, 255, 0, 0.4)' : 'none',
      border: isSelected ? '2px solid #00ff00' : `2px solid ${teamColor.secondary}`,
      padding: '10px',
      borderRadius: '5px',
      marginBottom: '5px',
      cursor: 'pointer',
      transition: 'all 0.3s',
    };
  };
    // --- Scoring logic (mirrors GAAAnalysisDashboard) ---
  const GOAL_ACTIONS = ['goal', 'penalty goal'];
  const SCORING_ACTIONS = ['point', 'free', 'offensive mark', '45', 'fortyfive'];

  const ARC_RADIUS = 40;   // metres — radius of the two-point arc
  const GOAL_Y = 44;       // centre of the goal line
  const ARC_CUTOFF = 20;   // the arc terminates at the 20m line

  // Distance to the nearer goal, and distance up the pitch from that endline
  const shotGeometry = (coord) => {
    if (typeof coord.x !== 'number' || typeof coord.y !== 'number') return null;
    const distLeft = Math.hypot(coord.x - 0, coord.y - GOAL_Y);
    const distRight = Math.hypot(coord.x - pitchWidth, coord.y - GOAL_Y);
    const atLeftEnd = distLeft <= distRight;
    return {
      dist: Math.min(distLeft, distRight),
      fromEndline: atLeftEnd ? coord.x : pitchWidth - coord.x,
    };
  };

  // Returns 3 for a goal, 2 for a two-pointer, 1 for a point, 0 for anything else
  const pointValueFor = (coord) => {
    const action = (coord.action || '').toString().toLowerCase().trim();

    if (GOAL_ACTIONS.includes(action)) return 3;

    // Wides, shorts, posts, blocks and misses score nothing
    if (/miss|wide|short|blocked|post/.test(action)) return 0;

    if (!SCORING_ACTIONS.some(a => action.includes(a))) return 0;

    // 45s are always one point, whatever the distance
    if (action.includes('45') || action.includes('fortyfive')) return 1;

    const g = shotGeometry(coord);
    if (!g) return 1;

    // Two points only if beyond the arc AND outside the 20m line
    return (g.dist >= ARC_RADIUS && g.fromEndline >= ARC_CUTOFF) ? 2 : 1;
  };

  const scoreboard = coords.reduce((acc, c) => {
    const team = c.team || 'Unknown';
    if (!acc[team]) acc[team] = { goals: 0, points: 0, twoPointers: 0 };

    const value = pointValueFor(c);
    if (value === 3) acc[team].goals++;
    else if (value === 2) acc[team].twoPointers++;
    else if (value === 1) acc[team].points++;

    return acc;
  }, {});

  const renderScoreboard = () => {
    const entries = Object.entries(scoreboard);
    if (entries.length === 0) return null;

    const colourFor = (team) =>
      team === team1 ? team1Color.main : team === team2 ? team2Color.main : '#555';

    return (
      <div className="scoreboard-container">
        <h3>Score</h3>
        <div className="scoreboard-teams">
          {entries.map(([team, { goals, points, twoPointers }]) => {
            const totalPoints = points + twoPointers * 2;
            const total = goals * 3 + totalPoints;
            return (
              <div key={team} className="scoreboard-team">
                <span
                  className="scoreboard-team-name"
                  style={{ borderLeft: `4px solid ${colourFor(team)}` }}
                >
                  {team}
                </span>
                <span className="scoreboard-score">
                  {goals}-{String(totalPoints).padStart(2, '0')}
                </span>
                <span className="scoreboard-detail">
                  {twoPointers > 0 ? `${twoPointers} × 2pt` : ''}
                </span>
                <span className="scoreboard-total">({total} pts)</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleEndOfHalf = () => {
    const next = currentHalf === '1' ? '2' : currentHalf === '2' ? 'ET1' : 'ET2';
    const count = coords.filter(c => (c.half || '1') === currentHalf).length;

    Swal.fire({
      title: `End of half ${currentHalf}?`,
      text: `${count} action${count === 1 ? '' : 's'} recorded. They'll be kept in the data and hidden from the pitch. Switching to ${next}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, next half',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        setCurrentHalf(next);
        setHalfFilter('current');
        setSelectedPlayer(null);
        setActionType('');
        setCurrentCoords([]);
        setLineCompleted(false);
      }
    });
  };

  const visibleCoords = halfFilter === 'all'
    ? coords
    : coords.filter(c => (c.half || '1') === currentHalf);

  // =====================================================================
  //  Pitch stage (shared by desktop and mobile layouts)
  // =====================================================================

  // Markers are coloured by outcome: goal = blue, score = green, no score = red.
  // Two-pointers get a gold ring.
  const markerColor = (coord) => {
    const v = pointValueFor(coord);
    if (v === 3) return '#2f6bff';
    if (v > 0) return '#0b8a2c';
    return '#d93025';
  };

  const renderStage = () => (
    <>
      <Stage
        width={stageW}
        height={stageH}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        onTap={handleTap}
        ref={stageRef}
        preventDefault={false}
        style={{
          pointerEvents:
            openDialog ||
            openLineDialog ||
            isContextMenuOpen ||
            isInitialSetupModalOpen ||
            isNewGameSetupModalOpen ||
            toolsOpen
              ? 'none'
              : 'auto',
        }}
      >
        {renderGAAPitch()}
        <Layer {...layerTransform}>
          {visibleCoords.map((coord, index) => {
            if (coord.from && coord.to) {
              return (
                <Arrow
                  key={index}
                  points={[
                    coord.from.x * xScale,
                    (pitchHeight - coord.from.y) * yScale,  // Flip Y
                    coord.to.x * xScale,
                    (pitchHeight - coord.to.y) * yScale     // Flip Y
                  ]}
                  stroke={getColor(coord.type)}
                  strokeWidth={2}
                  pointerLength={10}
                  pointerWidth={10}
                />
              );
            }
            const numberLabel = coord.player !== undefined && coord.player !== null ? String(coord.player) : '';
            const nameLabel = coord.playerName || '';
            const nameWidth = Math.max(nameLabel.length * 6, 10);
            const isTwoPointer = pointValueFor(coord) === 2;
            const r = isPortrait ? 7 : 6;
            // The Group sits at the shot and is turned back by the layer's rotation,
            // so numbers and names stay upright on the vertical pitch.
            return (
              <Group
                key={index}
                x={coord.x * xScale}
                y={(pitchHeight - coord.y) * yScale}  // Flip Y
                rotation={counterRotation}
              >
                {isTwoPointer && <Circle radius={r + 4} stroke="#ffd166" strokeWidth={2} />}
                <Circle radius={r} fill={markerColor(coord)} stroke="#ffffff" strokeWidth={1} />
                {displayPlayerNumber && numberLabel && (
                  <Text
                    text={numberLabel}
                    fontSize={8}
                    fontStyle="bold"
                    fill="white"
                    align="center"
                    width={16}
                    offsetX={8}
                    offsetY={4}
                  />
                )}
                {displayPlayerName && nameLabel && (
                  <Text
                    text={nameLabel}
                    y={-(r + 12)}
                    fontSize={10}
                    fill="black"
                    align="center"
                    width={nameWidth}
                    offsetX={nameWidth / 2}
                  />
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>
      {/* DOM elements can't live inside a Konva Stage, so the menu sits beside it */}
      {isContextMenuOpen && renderContextMenu()}
    </>
  );

  // =====================================================================
  //  Mobile layout
  // =====================================================================

  const halfLabel = (h) => (h === '1' ? '1st' : h === '2' ? '2nd' : h);

  const teamScoreText = (team) => {
    const s = scoreboard[team];
    if (!s) return '0-00';
    const pts = s.points + s.twoPointers * 2;
    return `${s.goals}-${String(pts).padStart(2, '0')}`;
  };

  const headerNames = [
    team1 || Object.keys(scoreboard)[0] || 'Team 1',
    team2 || Object.keys(scoreboard)[1] || 'Team 2',
  ];

  const renderMobileHeader = () => (
    <header className="pg-m-header">
      <div className="pg-m-score pg-m-score-left">
        <span className="pg-m-team">
          <span className="pg-m-swatch" style={{ background: team1Color.main }} />
          {headerNames[0]}
        </span>
        <span className="pg-m-points">{teamScoreText(headerNames[0])}</span>
      </div>
      <div className="pg-m-half">{halfLabel(currentHalf)} half</div>
      <div className="pg-m-score pg-m-score-right">
        <span className="pg-m-team">
          {headerNames[1]}
          <span className="pg-m-swatch" style={{ background: team2Color.main }} />
        </span>
        <span className="pg-m-points">{teamScoreText(headerNames[1])}</span>
      </div>
    </header>
  );

  const renderMobilePlayerPicker = () => {
    const teams = [
      { n: 1, name: team1, label: team1 || 'Team 1', players: team1Players, color: team1Color },
      { n: 2, name: team2, label: team2 || 'Team 2', players: team2Players, color: team2Color },
    ];
    const t = teams[activeTeamTab - 1];
    const start = showSubs ? 15 : 0;
    const shown = t.players.slice(start, showSubs ? t.players.length : 15);

    const selectedText = selectedPlayer
      ? `#${selectedPlayer.playerNumber}${selectedPlayer.playerName ? ` ${selectedPlayer.playerName}` : ''} selected · tap the pitch`
      : 'Pick a player, then tap the pitch';

    return (
      <div className="pg-m-picker">
        <div className="pg-m-team-tabs">
          {teams.map(team => (
            <button
              key={team.n}
              type="button"
              onClick={() => { setActiveTeamTab(team.n); setShowSubs(false); }}
              style={activeTeamTab === team.n
                ? { background: team.color.main, color: team.color.secondary }
                : undefined}
              className={activeTeamTab === team.n ? 'is-active' : ''}
            >
              {team.label}
            </button>
          ))}
        </div>

        <div className="pg-m-strip">
          {shown.map((player, i) => {
            const number = start + i + 1;
            const isSelected = selectedPlayer &&
              selectedPlayer.team === t.name &&
              selectedPlayer.playerNumber === number;
            return (
              <button
                key={`${t.n}-${number}`}
                type="button"
                className={`pg-m-num ${isSelected ? 'is-selected' : ''}`}
                aria-label={`Player ${number}${player.name ? ` ${player.name}` : ''}`}
                onClick={() => handlePlayerClick(t.name, player.name, number)}
              >
                {number}
              </button>
            );
          })}
          {t.players.length > 15 && (
            <button type="button" className="pg-m-subs" onClick={() => setShowSubs(s => !s)}>
              {showSubs ? 'Starters' : 'Subs'}
            </button>
          )}
        </div>

        <div className="pg-m-caption">
          <span>{selectedText}</span>
          {halfView && <span>{pitchViewLabel}</span>}
        </div>
      </div>
    );
  };

  const Icon = ({ d, children }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d && <path d={d} />}
      {children}
    </svg>
  );

  const renderMobileToolbar = () => (
    <nav className="pg-m-toolbar">
      <button type="button" onClick={handleUndoLastMarker}>
        <Icon d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />Undo
      </button>
      <button type="button" onClick={handleEndOfHalf}>
        <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>End {halfLabel(currentHalf)}
      </button>
      <button type="button" onClick={cyclePitchView} className={halfView ? 'is-on' : ''}>
        <Icon><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M6 12h12" /></Icon>{pitchViewLabel}
      </button>
      <button type="button" onClick={() => setToolsOpen(true)}>
        <Icon d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Icon>Tools
      </button>
    </nav>
  );

  // Close the drawer, then run the action (so modals open on top of a clean screen)
  const fromTools = (fn) => () => { setToolsOpen(false); fn(); };

  const renderToolsDrawer = () => (
    <div className="pg-m-overlay" onClick={() => setToolsOpen(false)}>
      <section className="pg-m-sheet" aria-label="Tools" onClick={(e) => e.stopPropagation()}>
        <div className="pg-m-handle" />
        <div className="pg-m-sheet-head">
          <h2>Tools</h2>
          <button type="button" className="pg-m-icon-btn" aria-label="Close tools" onClick={() => setToolsOpen(false)}>
            <Icon d="M6 6l12 12M18 6 6 18" />
          </button>
        </div>

        <div className="pg-m-group">
          <span className="pg-m-label">MATCH</span>
          <div className="pg-m-seg pg-m-seg-4">
            {HALVES.map(h => (
              <button key={h} type="button" className={currentHalf === h ? 'is-on' : ''} onClick={() => setCurrentHalf(h)}>
                {halfLabel(h)}
              </button>
            ))}
          </div>
          <button type="button" className="pg-m-btn" onClick={fromTools(handleEndOfHalf)}>
            End {halfLabel(currentHalf)} half → start next
          </button>
          <label className="pg-m-toggle">
            Show all halves on pitch
            <input type="checkbox" checked={halfFilter === 'all'}
                   onChange={() => setHalfFilter(halfFilter === 'all' ? 'current' : 'all')} />
          </label>
        </div>

        <div className="pg-m-group">
          <span className="pg-m-label">DISPLAY</span>
          <label className="pg-m-toggle">
            Player numbers on markers
            <input type="checkbox" checked={displayPlayerNumber} onChange={() => setDisplayPlayerNumber(!displayPlayerNumber)} />
          </label>
          <label className="pg-m-toggle">
            Player names on markers
            <input type="checkbox" checked={displayPlayerName} onChange={() => setDisplayPlayerName(!displayPlayerName)} />
          </label>
        </div>

        <div className="pg-m-group">
          <span className="pg-m-label">DATA</span>
          <div className="pg-m-grid">
            <button type="button" className="pg-m-btn is-primary" onClick={fromTools(handleOpenSaveModal)}>Save game</button>
            <button type="button" className="pg-m-btn" onClick={fromTools(toggleModal)}>Review data</button>
            <button type="button" className="pg-m-btn" onClick={fromTools(() => {
              if (userType === 'free' && downloadsRemaining <= 0) {
                handlePremiumFeatureAccess('Download Data');
                return;
              }
              setIsCustomDownloadModalOpen(true);
            })}>
              Download data
              <small>{userType === 'free' ? `${downloadsRemaining} left today` : 'Unlimited'}</small>
            </button>
            <button type="button" className="pg-m-btn" onClick={fromTools(toggleDownloadModal)}>Filtered download</button>
            <button type="button" className="pg-m-btn" onClick={fromTools(toggleScreenshotModal)}>Screenshot</button>
            <button type="button" className="pg-m-btn" onClick={fromTools(() => mobileUploadRef.current && mobileUploadRef.current.click())}>Upload raw data</button>
          </div>
        </div>

        <div className="pg-m-group">
          <span className="pg-m-label">SETUP</span>
          <div className="pg-m-grid">
            <button type="button" className="pg-m-btn" onClick={fromTools(() => setIsSetupTeamModalOpen(true))}>Setup teams</button>
            <button type="button" className="pg-m-btn" onClick={fromTools(() => setIsSettingsModalOpen(true))}>Settings</button>
            <button type="button" className="pg-m-btn" onClick={fromTools(handleClearMarkers)}>Clear this half</button>
          </div>
        </div>
      </section>
    </div>
  );

  const renderMobileLayout = () => (
    <div className="pg-mobile">
      {renderMobileHeader()}
      {renderMobilePlayerPicker()}

      <div ref={pitchWrapRef} className="pg-m-pitch">
        {renderStage()}
        {lastSaved && (
          <div className="pg-m-toast" role="status">
            <span className="pg-m-dot" style={{ background: lastSaved.color }} />
            <span className="pg-m-toast-text">{lastSaved.label}</span>
            <button type="button" onClick={handleUndoLastMarker}>Undo</button>
          </div>
        )}
      </div>

      <div className="pg-m-extra">
        <AggregatedData data={aggregateData} />
      </div>

      {renderMobileToolbar()}
      {toolsOpen && renderToolsDrawer()}

      <input
        type="file"
        ref={mobileUploadRef}
        accept=".json"
        onChange={handleUploadRawData}
        className="pg-m-hidden-input"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );

  // =====================================================================
  //  Mobile shot sheet (replaces the action pop-up on phones)
  // =====================================================================

  const SHOT_TYPES = [
    { id: 'play', label: 'From play' },
    { id: 'free', label: 'Free' },
    { id: 'mark', label: 'Mark' },
    { id: '45', label: '45' },
    { id: 'pen', label: 'Penalty' },
  ];
  const OUTCOMES = ['Point', 'Goal', 'Wide', 'Short', 'Post', 'Blocked', 'Saved'];
  // Outcome x type -> your existing action codes (so scoring and exports are unchanged)
  const ACTION_MAP = {
    play: { Point: 'point', Goal: 'goal', Wide: 'wide', Short: 'short', Post: 'post', Blocked: 'blocked', Saved: 'goal miss' },
    free: { Point: 'free', Wide: 'free wide', Short: 'free short', Post: 'free post' },
    mark: { Point: 'offensive mark', Wide: 'offensive mark wide' },
    '45': { Point: 'fortyfive', Wide: 'fortyfive wide', Short: 'fortyfive short', Post: 'fortyfive post' },
    pen: { Goal: 'penalty goal', Saved: 'pen miss' },
  };
  const actionToParts = (action) => {
    for (const [type, outcomes] of Object.entries(ACTION_MAP)) {
      for (const [outcome, code] of Object.entries(outcomes)) {
        if (code === action) return { type, outcome };
      }
    }
    return null;
  };

  // =====================================================================
  //  Shot details: shared model for the phone sheet and the laptop dialog
  // =====================================================================

  const getShotModel = () => {
    const parts = actionToParts(formData.action);
    const activeType = parts ? parts.type : sheetType;
    const activeOutcome = parts ? parts.outcome : null;
    const available = ACTION_MAP[activeType] || {};

    const setType = (typeId) => {
      setSheetType(typeId);
      const keep = activeOutcome && ACTION_MAP[typeId][activeOutcome];
      const fallback = ACTION_MAP[typeId].Point || ACTION_MAP[typeId].Goal || '';
      setFormData({ ...formData, action: keep || fallback });
    };
    const setOutcome = (outcome) => {
      setShowMoreActions(false);
      setFormData({ ...formData, action: available[outcome] });
    };
    const setField = (name, value) => setFormData({ ...formData, [name]: value });
    const bumpMinute = (delta) => {
      const m = parseInt(formData.minute, 10);
      const next = Math.max(0, (isNaN(m) ? 0 : m) + delta);
      setField('minute', String(next));
    };

    const geo = shotGeometry(formData);
    const value = formData.action ? pointValueFor(formData) : 0;
    const geoText = geo
      ? `${Math.round(geo.dist)} m from goal · ${geo.dist >= ARC_RADIUS && geo.fromEndline >= ARC_CUTOFF ? 'outside' : 'inside'} 2-pt arc`
      : '';
    const teamColor = formData.team === team2 ? team2Color : team1Color;
    const saveLabel = activeOutcome
      ? `Save ${activeOutcome.toLowerCase()}${value === 2 ? ' (2 pts)' : ''}`
      : formData.action ? `Save ${formData.action}` : 'Pick an outcome';
    const who = `${formData.playerName || (formData.player ? `Player ${formData.player}` : 'No player')}${formData.team ? ` · ${formData.team}` : ''}`;

    return {
      parts, activeType, activeOutcome, available, setType, setOutcome,
      setField, bumpMinute, geoText, teamColor, saveLabel, who,
    };
  };

  const OUTCOME_KEYS = { Point: 'P', Goal: 'G', Wide: 'W', Short: 'S', Post: 'O', Blocked: 'B', Saved: 'V' };

  const renderOutcomeButtons = (m, withKeys) => (
    <>
      <div className="pg-m-outcomes">
        {OUTCOMES.map(o => (
          <button
            key={o}
            type="button"
            disabled={!m.available[o]}
            className={`${m.activeOutcome === o ? 'is-on' : ''} ${o === 'Point' || o === 'Goal' ? 'is-score' : ''} ${withKeys ? 'has-key' : ''}`}
            onClick={() => m.setOutcome(o)}
          >
            {o}
            {withKeys && <small>{OUTCOME_KEYS[o]}</small>}
          </button>
        ))}
        <button type="button" className={`is-more ${withKeys ? 'has-key' : ''}`} onClick={() => setShowMoreActions(s => !s)}>
          More…
        </button>
      </div>
      {(showMoreActions || (!m.parts && formData.action)) && (
        <select name="action" value={formData.action} onChange={handleChange} className="pg-m-select">
          {actionCodes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
    </>
  );

  const renderTypeChips = (m) => (
    <div className="pg-m-chips">
      {SHOT_TYPES.map(t => (
        <button key={t.id} type="button" className={m.activeType === t.id ? 'is-on' : ''} onClick={() => m.setType(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );

  const PRESSURE_LABELS = { '0': '0 · None', '1': '1 · Some', '2': '2 · Heavy' };

  const renderFootPressure = (m, long) => (
    <>
      <div className="pg-m-group">
        <span className="pg-m-label">FOOT / HAND</span>
        <div className="pg-m-seg">
          {feet.map(f => (
            <button key={f} type="button" className={formData.foot === f ? 'is-on' : ''} onClick={() => m.setField('foot', f)}>
              {long ? f : f === 'Right' ? 'R' : f === 'Left' ? 'L' : f}
            </button>
          ))}
        </div>
      </div>
      <div className="pg-m-group">
        <span className="pg-m-label">PRESSURE</span>
        <div className="pg-m-seg">
          {pressures.map(p => (
            <button key={p} type="button" className={formData.pressure === p ? 'is-on' : ''} onClick={() => m.setField('pressure', p)}>
              {long ? (PRESSURE_LABELS[p] || p) : p}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const renderPositionButtons = (m, grid) => (
    <div className={grid ? 'pg-dlg-positions' : 'pg-m-chips'}>
      {positions.map(p => (
        <button key={p} type="button" className={formData.position === p ? 'is-on' : ''} onClick={() => m.setField('position', p)}>
          {p}
        </button>
      ))}
    </div>
  );

  const sheetStyle = {
    overlay: { backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000 },
    content: {
      top: 'auto', left: 0, right: 0, bottom: 0,
      width: '100%', maxHeight: '88vh', overflowY: 'auto',
      margin: 0, padding: '8px 16px 16px', boxSizing: 'border-box',
      border: 'none', borderRadius: '20px 20px 0 0',
      background: '#26242c', color: '#f2f0f5',
    },
  };

  const renderMobileShotSheet = () => {
    const m = getShotModel();
    return (
      <Modal isOpen={openDialog} onRequestClose={handleCloseDialog} contentLabel="Shot details" style={sheetStyle}>
        <div className="pg-m-handle" />

        <div className="pg-m-shot-head">
          <div className="pg-m-shot-num" style={{ background: m.teamColor.main, color: m.teamColor.secondary }}>
            {formData.player || '–'}
          </div>
          <div className="pg-m-shot-who">
            <strong>{m.who}</strong>
            <span>{m.geoText}</span>
          </div>
          <div className="pg-m-stepper">
            <button type="button" aria-label="Minute down" onClick={() => m.bumpMinute(-1)}>−</button>
            <input
              aria-label="Minute"
              inputMode="numeric"
              value={formData.minute}
              placeholder="min"
              onChange={(e) => m.setField('minute', e.target.value.replace(/[^0-9+]/g, ''))}
            />
            <button type="button" aria-label="Minute up" onClick={() => m.bumpMinute(1)}>+</button>
          </div>
        </div>

        <div className="pg-m-group">
          <span className="pg-m-label">OUTCOME</span>
          {renderOutcomeButtons(m, false)}
        </div>

        <div className="pg-m-group">
          <span className="pg-m-label">TYPE</span>
          {renderTypeChips(m)}
        </div>

        <div className="pg-m-two-col">{renderFootPressure(m, false)}</div>

        <div className="pg-m-group">
          <span className="pg-m-label">POSITION</span>
          {renderPositionButtons(m, false)}
        </div>

        <div className="pg-m-actions">
          <button type="button" className="pg-m-cancel" onClick={handleCloseDialog}>Cancel</button>
          <button type="button" className="pg-m-save" disabled={!formData.action} onClick={handleFormSubmit}>
            {m.saveLabel}
          </button>
        </div>
      </Modal>
    );
  };

  const desktopDialogStyle = {
    overlay: { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000 },
    content: {
      top: '50%', left: '50%', right: 'auto', bottom: 'auto',
      transform: 'translate(-50%, -50%)',
      width: '760px', maxWidth: '95vw', maxHeight: '90vh',
      padding: 0, overflow: 'auto',
      border: '1px solid #34323c', borderRadius: '16px',
      background: '#26242c', color: '#f2f0f5',
    },
  };

  const renderDesktopShotDialog = () => {
    const m = getShotModel();
    return (
      <Modal isOpen={openDialog} onRequestClose={handleCloseDialog} contentLabel="Shot details" style={desktopDialogStyle}>
        <div className="pg-dlg">
          <header className="pg-dlg-head">
            <div className="pg-m-shot-num" style={{ background: m.teamColor.main, color: m.teamColor.secondary }}>
              {formData.player || '–'}
            </div>
            <div className="pg-m-shot-who">
              <strong>{m.who}</strong>
              <span>{m.geoText}{m.geoText ? ' · ' : ''}{halfLabel(currentHalf)} half</span>
            </div>
            <label className="pg-dlg-minute">
              Minute
              <input
                inputMode="numeric"
                value={formData.minute}
                onChange={(e) => m.setField('minute', e.target.value.replace(/[^0-9+]/g, ''))}
              />
            </label>
            <button type="button" className="pg-m-icon-btn" aria-label="Close" onClick={handleCloseDialog}>
              <Icon d="M6 6l12 12M18 6 6 18" />
            </button>
          </header>

          <div className="pg-dlg-body">
            <div className="pg-dlg-col">
              <div className="pg-m-group">
                <span className="pg-m-label">OUTCOME</span>
                {renderOutcomeButtons(m, true)}
              </div>
              <div className="pg-m-group">
                <span className="pg-m-label">TYPE</span>
                {renderTypeChips(m)}
              </div>
            </div>
            <div className="pg-dlg-col">
              {renderFootPressure(m, true)}
              <div className="pg-m-group">
                <span className="pg-m-label">POSITION</span>
                {renderPositionButtons(m, true)}
              </div>
            </div>
          </div>

          <footer className="pg-dlg-foot">
            <span>Keys: letter picks the outcome · Enter saves · Esc cancels</span>
            <button type="button" className="pg-m-cancel" onClick={handleCloseDialog}>Cancel</button>
            <button type="button" className="pg-m-save" disabled={!formData.action} onClick={handleFormSubmit}>
              {m.saveLabel}
            </button>
          </footer>
        </div>
      </Modal>
    );
  };

  // Keyboard shortcuts for the laptop dialog read the latest handlers from these refs
  shotShortcutRef.current = (outcome) => {
    const m = getShotModel();
    if (m.available[outcome]) m.setOutcome(outcome);
  };
  shotSubmitRef.current = () => {
    if (formData.action) handleFormSubmit();
  };

  // =====================================================================
  //  Laptop layout
  // =====================================================================

  // Per-player running tally for the roster, e.g. "1-02 · 1 W"
  const playerTallies = coords.reduce((acc, c) => {
    if (c.from && c.to) return acc;
    if (c.player === '' || c.player === undefined || c.player === null) return acc;
    const key = `${c.team}|${c.player}`;
    const t = acc[key] || (acc[key] = { g: 0, p: 0, w: 0 });
    const v = pointValueFor(c);
    if (v === 3) t.g += 1;
    else if (v > 0) t.p += v;
    else if (/wide/.test((c.action || '').toLowerCase())) t.w += 1;
    return acc;
  }, {});

  const tallyText = (team, number) => {
    const t = playerTallies[`${team}|${number}`];
    if (!t) return '';
    const out = [];
    if (t.g || t.p) out.push(`${t.g}-${String(t.p).padStart(2, '0')}`);
    if (t.w) out.push(`${t.w} W`);
    return out.join(' · ');
  };

  const teamSummary = (team) => {
    const shots = coords.filter(c => !(c.from && c.to) && c.team === team);
    const scores = shots.filter(c => pointValueFor(c) > 0).length;
    const wides = shots.filter(c => /wide/.test((c.action || '').toLowerCase())).length;
    return {
      shots: shots.length,
      scores,
      wides,
      conv: shots.length ? `${Math.round((scores * 100) / shots.length)}%` : '–',
    };
  };

  const recentRows = coords
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => (c.half || '1') === currentHalf)
    .slice(-3)
    .reverse();

  const describeAction = (c) => {
    const v = pointValueFor(c);
    const label = v === 2 ? '2-pointer' : (c.action || '');
    const who = c.player !== '' && c.player !== undefined ? ` · #${c.player}${c.playerName ? ` ${c.playerName}` : ''}` : '';
    const team = c.team && c.team !== team1 ? ` (${c.team})` : '';
    return `${label}${who}${team}`;
  };

  const openDownloadData = () => {
    if (userType === 'free' && downloadsRemaining <= 0) {
      handlePremiumFeatureAccess('Download Data');
      return;
    }
    setIsCustomDownloadModalOpen(true);
  };

  const confirmClearHalf = () => {
    Swal.fire({
      title: `Clear ${halfLabel(currentHalf)} half?`,
      text: 'This removes every marker recorded in this half.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Clear markers',
    }).then((r) => { if (r.isConfirmed) handleClearMarkers(); });
  };

  const menuAction = (fn) => () => { setOpenMenu(null); fn(); };

  const renderDesktopToolbar = () => (
    <header className="pg-d-toolbar">
      <div className="pg-d-title">
        <strong>{team1 && team2 ? `${team1} v ${team2}` : 'New match'}</strong>
        <span>
          {[saveCompetition, matchDate].filter(Boolean).join(' · ') ||
            (team1 && team2 ? 'Pick a player, then click the pitch' : 'Set up teams to start tagging')}
        </span>
      </div>

      <div className="pg-m-seg pg-d-halves" role="group" aria-label="Half">
        {HALVES.map(h => (
          <button key={h} type="button" className={currentHalf === h ? 'is-on' : ''} onClick={() => setCurrentHalf(h)}>
            {halfLabel(h)}
          </button>
        ))}
      </div>
      <button type="button" className="pg-d-btn" onClick={handleEndOfHalf}>End {halfLabel(currentHalf)} half</button>

      <div className="pg-d-spacer" />

      <button type="button" className="pg-d-btn" onClick={handleUndoLastMarker}>
        <Icon d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />Undo
      </button>
      <button type="button" className="pg-d-btn" onClick={toggleModal}>Review data</button>

      <div className="pg-d-menu-wrap">
        <button
          type="button"
          className="pg-d-btn"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'export'}
          onClick={() => setOpenMenu(o => (o === 'export' ? null : 'export'))}
        >
          Export <Icon d="m6 9 6 6 6-6" />
        </button>
        {openMenu === 'export' && (
          <div className="pg-d-menu" role="menu">
            <button type="button" role="menuitem" onClick={menuAction(openDownloadData)}>
              Download data
              <small>{userType === 'free' ? `${downloadsRemaining} left today` : 'Unlimited'}</small>
            </button>
            <button type="button" role="menuitem" onClick={menuAction(toggleDownloadModal)}>Download filtered data</button>
            <button type="button" role="menuitem" onClick={menuAction(toggleScreenshotModal)}>Download screenshot</button>
            <button type="button" role="menuitem" onClick={menuAction(() => mobileUploadRef.current && mobileUploadRef.current.click())}>
              Upload raw data
            </button>
          </div>
        )}
      </div>

      <button type="button" className="pg-d-btn is-primary" onClick={handleOpenSaveModal}>Save game</button>

      <div className="pg-d-menu-wrap">
        <button
          type="button"
          className="pg-d-icon"
          aria-label="Settings"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'settings'}
          onClick={() => setOpenMenu(o => (o === 'settings' ? null : 'settings'))}
        >
          <Icon d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"><circle cx="12" cy="12" r="3" /></Icon>
        </button>
        {openMenu === 'settings' && (
          <div className="pg-d-menu is-right" role="menu">
            <button type="button" role="menuitem" onClick={menuAction(() => setIsSetupTeamModalOpen(true))}>Set up teams</button>
            <button type="button" role="menuitem" onClick={menuAction(() => setIsSettingsModalOpen(true))}>Pitch colours</button>
            <div className="pg-d-menu-sep" />
            <label className="pg-d-menu-toggle">
              Player numbers on markers
              <input type="checkbox" checked={displayPlayerNumber} onChange={() => setDisplayPlayerNumber(!displayPlayerNumber)} />
            </label>
            <label className="pg-d-menu-toggle">
              Player names on markers
              <input type="checkbox" checked={displayPlayerName} onChange={() => setDisplayPlayerName(!displayPlayerName)} />
            </label>
            <label className="pg-d-menu-toggle">
              Show all halves
              <input type="checkbox" checked={halfFilter === 'all'} onChange={() => setHalfFilter(halfFilter === 'all' ? 'current' : 'all')} />
            </label>
            <div className="pg-d-menu-sep" />
            <button type="button" role="menuitem" className="is-danger" onClick={menuAction(confirmClearHalf)}>
              Clear {halfLabel(currentHalf)} half markers
            </button>
          </div>
        )}
      </div>
    </header>
  );

  const renderDesktopPlayerPanel = () => {
    const teams = [
      { n: 1, name: team1, label: team1 || 'Home team', players: team1Players, color: team1Color },
      { n: 2, name: team2, label: team2 || 'Away team', players: team2Players, color: team2Color },
    ];
    const t = teams[activeTeamTab - 1];
    const start = showSubs ? 15 : 0;
    const shown = t.players.slice(start, showSubs ? t.players.length : 15);

    return (
      <aside className="pg-d-players" aria-label="Players">
        <div className="pg-d-team-tabs">
          {teams.map(team => (
            <button
              key={team.n}
              type="button"
              className={activeTeamTab === team.n ? 'is-active' : ''}
              style={activeTeamTab === team.n ? { background: team.color.main, color: team.color.secondary } : undefined}
              onClick={() => { setActiveTeamTab(team.n); setShowSubs(false); }}
            >
              {team.label}
            </button>
          ))}
        </div>

        {(!team1 || !team2) && (
          <button type="button" className="pg-d-setup-cta" onClick={() => setIsSetupTeamModalOpen(true)}>
            Set up teams to start tagging
          </button>
        )}

        <div className="pg-d-roster">
          {shown.map((player, i) => {
            const number = start + i + 1;
            const isSelected = selectedPlayer && selectedPlayer.team === t.name && selectedPlayer.playerNumber === number;
            return (
              <button
                key={`${t.n}-${number}`}
                type="button"
                className={`pg-d-player ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handlePlayerClick(t.name, player.name, number)}
              >
                <span className="pg-d-player-num">{number}</span>
                <span className="pg-d-player-name">{player.name || `Player ${number}`}</span>
                <span className="pg-d-player-tally">{tallyText(t.name, number)}</span>
              </button>
            );
          })}
        </div>

        {t.players.length > 15 && (
          <button type="button" className="pg-d-subs" onClick={() => setShowSubs(s => !s)}>
            {showSubs ? 'Show starters (1–15)' : `Show subs (16–${t.players.length})`}
          </button>
        )}
      </aside>
    );
  };

  const twoPointers = (team) => (scoreboard[team] ? scoreboard[team].twoPointers : 0);

  const renderDesktopLayout = () => (
    <div className="pg-d">
      {renderDesktopToolbar()}

      <div className="pg-d-body">
        {renderDesktopPlayerPanel()}

        <main className="pg-d-main">
          <div className="pg-d-score" style={{ width: stageW }}>
            <div className="pg-d-score-team">
              <span className="pg-d-score-bar" style={{ background: team1Color.main }} />
              <strong>{headerNames[0]}</strong>
              <small>{twoPointers(headerNames[0])} × 2pt</small>
            </div>
            <div className="pg-d-score-mid">
              <span>{teamScoreText(headerNames[0])}</span>
              <em>{halfLabel(currentHalf)} half</em>
              <span>{teamScoreText(headerNames[1])}</span>
            </div>
            <div className="pg-d-score-team is-right">
              <small>{twoPointers(headerNames[1])} × 2pt</small>
              <strong>{headerNames[1]}</strong>
              <span className="pg-d-score-bar" style={{ background: team2Color.main }} />
            </div>
          </div>

          <div ref={pitchWrapRef} className="pg-d-pitch">
            <div className="pg-d-stage" style={{ width: stageW }}>
              {renderStage()}
              <div className="pg-d-pitch-hint">
                {selectedPlayer
                  ? `#${selectedPlayer.playerNumber}${selectedPlayer.playerName ? ` ${selectedPlayer.playerName}` : ''} selected · click the pitch`
                  : 'Pick a player on the left, then click the pitch'}
              </div>
            </div>
          </div>

          <div className="pg-d-bottom" style={{ width: stageW }}>
            <section className="pg-d-card pg-d-summary" aria-label="Match totals">
              <span />
              <span className="pg-d-th">SHOTS</span>
              <span className="pg-d-th">SCORES</span>
              <span className="pg-d-th">WIDES</span>
              <span className="pg-d-th">CONV.</span>
              {headerNames.map(name => {
                const s = teamSummary(name);
                return (
                  <React.Fragment key={name}>
                    <strong>{name}</strong>
                    <span>{s.shots}</span>
                    <span>{s.scores}</span>
                    <span>{s.wides}</span>
                    <span>{s.conv}</span>
                  </React.Fragment>
                );
              })}
            </section>

            <section className="pg-d-card pg-d-recent" aria-label="Recent actions">
              {recentRows.length === 0 && <span className="pg-d-empty">No actions in this half yet</span>}
              {recentRows.map(({ c, i }, idx) => (
                <div key={i} className="pg-d-recent-row">
                  <span className="pg-m-dot" style={{ background: markerColor(c) }} />
                  <span className="pg-d-recent-min">{c.minute ? `${c.minute}'` : ''}</span>
                  <span className="pg-d-recent-text">{describeAction(c)}</span>
                  {idx === 0 && (
                    <button type="button" onClick={handleUndoLastMarker}>Undo</button>
                  )}
                </div>
              ))}
            </section>
          </div>

          <div className="aggregated-data-container" style={{ maxWidth: stageW }}>
            <AggregatedData data={aggregateData} />
          </div>
        </main>
      </div>

      {openMenu && <div className="pg-d-menu-backdrop" onClick={() => setOpenMenu(null)} />}

      <input
        type="file"
        ref={mobileUploadRef}
        accept=".json"
        onChange={handleUploadRawData}
        className="pg-m-hidden-input"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );

  // =====================================================================
  //  Set up match (laptop: side by side, phone: one team at a time)
  // =====================================================================

  const KIT_PRESETS = [
    { main: '#8a2a52', secondary: '#ffffff', label: 'Maroon and white' },
    { main: '#1f8a3a', secondary: '#ff4d4d', label: 'Green and red' },
    { main: '#1d4fa0', secondary: '#ffffff', label: 'Blue and white' },
    { main: '#111111', secondary: '#f2c200', label: 'Black and amber' },
    { main: '#f2f2f2', secondary: '#c8102e', label: 'White and red' },
    { main: '#0a6b4d', secondary: '#ffffff', label: 'Green and white' },
    { main: '#6cace4', secondary: '#0b2c5f', label: 'Sky blue and navy' },
    { main: '#c8102e', secondary: '#ffffff', label: 'Red and white' },
  ];

  const nameErrorFor = (n) => {
    const mine = ((n === 1 ? team1 : team2) || '').trim();
    const other = ((n === 1 ? team2 : team1) || '').trim();
    if (!mine) return 'Enter a team name to start tagging';
    if (other && mine.toLowerCase() === other.toLowerCase()) return 'The two teams need different names';
    return '';
  };
  const setupValid = !nameErrorFor(1) && !nameErrorFor(2);
  const visibleNameError = (n) => ((setupTouched[n] || setupAttempted) ? nameErrorFor(n) : '');

  const setupFooterMessage = () => {
    if (setupValid) return '';
    const e1 = nameErrorFor(1);
    const e2 = nameErrorFor(2);
    if (e1.startsWith('The two') || e2.startsWith('The two')) return 'The two teams need different names';
    if (e1 && e2) return 'Both teams need a name';
    return e1 ? 'Home team needs a name' : 'Away team needs a name';
  };

  const handlePasteList = async (teamNo) => {
    const { value } = await Swal.fire({
      title: 'Paste player names',
      input: 'textarea',
      inputPlaceholder: 'One name per line, in jersey order.\nYou can start a line with the number, e.g. "14 J. Smith".',
      showCancelButton: true,
      confirmButtonText: 'Fill names',
    });
    if (!value) return;
    const lines = value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const setter = teamNo === 1 ? setTeam1Players : setTeam2Players;
    setter(prev => {
      const next = prev.map(p => ({ ...p }));
      let auto = 0;
      lines.forEach(line => {
        const match = line.match(/^(\d{1,2})[\s.\-:)]+(.+)$/);
        const idx = match ? parseInt(match[1], 10) - 1 : auto;
        const name = match ? match[2].trim() : line;
        if (idx < 0) return;
        while (next.length <= idx) next.push({ name: '', number: next.length + 1 });
        next[idx] = { ...next[idx], name };
        auto = idx + 1;
      });
      return next;
    });
  };

  const handleClearNames = (teamNo) => {
    const setter = teamNo === 1 ? setTeam1Players : setTeam2Players;
    setter(prev => prev.map(p => ({ ...p, name: '' })));
  };

  const handleStartTagging = () => {
    if (!setupValid) {
      setSetupAttempted(true);
      return;
    }
    const t1 = team1.trim();
    const t2 = team2.trim();
    setTeam1(t1);
    setTeam2(t2);
    setShowSetupTeamsContainer(true);
    setIsSetupTeamModalOpen(false);
    setSetupAttempted(false);
    setSetupTouched({ 1: false, 2: false });
    setSetupTab(1);
    setTeams(prev => {
      const next = [...prev];
      [t1, t2].forEach(t => { if (t && !next.includes(t)) next.push(t); });
      return next;
    });
  };

  const renderSetupCard = (t) => {
    const err = visibleNameError(t.n);
    const subsOpen = setupSubs[t.n];
    const shown = t.players.slice(0, subsOpen ? t.players.length : 15);
    const named = t.players.slice(0, 15).filter(p => p.name && p.name.trim()).length;
    const rows = Math.ceil(shown.length / 2);

    return (
      <section className="pg-su-card" key={t.n}>
        <div className="pg-su-card-head">
          <span className="pg-su-side">{t.side.toUpperCase()}</span>
          <span className="pg-su-count">{named} of 15 named</span>
        </div>

        <div className="pg-su-top">
          <div className="pg-su-field">
            <label htmlFor={`pg-team-name-${t.n}`}>Team name <span className="pg-su-req">*</span></label>
            <input
              id={`pg-team-name-${t.n}`}
              value={t.name}
              placeholder={t.n === 1 ? 'e.g. Galway' : 'e.g. Mayo'}
              aria-invalid={!!err}
              aria-describedby={err ? `pg-team-err-${t.n}` : undefined}
              className={err ? 'is-invalid' : ''}
              onChange={(e) => t.setName(e.target.value)}
              onBlur={() => setSetupTouched(s => ({ ...s, [t.n]: true }))}
            />
            {err && <span id={`pg-team-err-${t.n}`} className="pg-su-error">{err}</span>}
          </div>

          <div className="pg-su-field">
            <span className="pg-su-label">Kit colours</span>
            <div className="pg-su-kits">
              {KIT_PRESETS.map(k => {
                const on = k.main.toLowerCase() === (t.color.main || '').toLowerCase() &&
                  k.secondary.toLowerCase() === (t.color.secondary || '').toLowerCase();
                return (
                  <button
                    key={k.label}
                    type="button"
                    aria-label={k.label}
                    aria-pressed={on}
                    className={`pg-su-kit ${on ? 'is-on' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${k.main} 50%, ${k.secondary} 50%)` }}
                    onClick={() => t.setColor({ main: k.main, secondary: k.secondary })}
                  />
                );
              })}
              <label className="pg-su-custom" title="Custom main colour">
                <input type="color" aria-label="Custom main colour" value={t.color.main}
                       onChange={(e) => t.setColor({ ...t.color, main: e.target.value })} />
              </label>
              <label className="pg-su-custom" title="Custom number colour">
                <input type="color" aria-label="Custom number colour" value={t.color.secondary}
                       onChange={(e) => t.setColor({ ...t.color, secondary: e.target.value })} />
              </label>
              <span className="pg-su-preview" aria-hidden="true" style={{ background: t.color.main, color: t.color.secondary }}>14</span>
            </div>
          </div>
        </div>

        <div className="pg-su-players-head">
          <span>Players <small>· names optional</small></span>
          <button type="button" className="pg-su-small" onClick={() => handlePasteList(t.n)}>Paste list</button>
          <button type="button" className="pg-su-small is-ghost" onClick={() => handleClearNames(t.n)}>Clear</button>
        </div>

        <div className="pg-su-players" style={isMobileViewport ? undefined : { gridTemplateRows: `repeat(${rows}, auto)` }}>
          {shown.map((p, i) => (
            <label className="pg-su-player" key={i}>
              <span
                className="pg-su-num"
                style={isMobileViewport ? { background: t.color.main, color: t.color.secondary } : undefined}
              >
                {i + 1}
              </span>
              <input
                value={p.name || ''}
                placeholder={isMobileViewport ? `Player ${i + 1} name` : 'Name (optional)'}
                onChange={(e) => t.update(i, 'name', e.target.value)}
              />
            </label>
          ))}
        </div>

        {t.players.length > 15 && (
          <button type="button" className="pg-su-subs" onClick={() => setSetupSubs(s => ({ ...s, [t.n]: !s[t.n] }))}>
            {subsOpen ? 'Hide subs' : `+ Subs (16–${t.players.length})`}
          </button>
        )}
      </section>
    );
  };

  const setupModalStyle = isMobileViewport
    ? {
        overlay: { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000 },
        content: {
          inset: 0, top: 0, left: 0, right: 0, bottom: 0,
          padding: 0, border: 'none', borderRadius: 0,
          background: '#1f1e24', color: '#f2f0f5',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        },
      }
    : {
        overlay: { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000 },
        content: {
          top: '50%', left: '50%', right: 'auto', bottom: 'auto',
          transform: 'translate(-50%, -50%)',
          width: '1200px', maxWidth: '95vw', maxHeight: '92vh',
          padding: 0, border: '1px solid #34323c', borderRadius: '16px',
          background: '#26242c', color: '#f2f0f5',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        },
      };

  const renderSetupTeamsModal = () => {
    const cards = [
      { n: 1, side: 'Home team', name: team1, setName: setTeam1, color: team1Color, setColor: setTeam1Color, players: team1Players, update: updatePlayerInTeam1 },
      { n: 2, side: 'Away team', name: team2, setName: setTeam2, color: team2Color, setColor: setTeam2Color, players: team2Players, update: updatePlayerInTeam2 },
    ];
    const footerMsg = setupAttempted || setupTouched[1] || setupTouched[2] ? setupFooterMessage() : '';

    return (
      <Modal
        isOpen={isSetupTeamModalOpen}
        onRequestClose={() => setIsSetupTeamModalOpen(false)}
        contentLabel="Set up match"
        style={setupModalStyle}
      >
        <div className={`pg-su ${isMobileViewport ? 'is-phone' : 'is-laptop'}`}>
          <header className="pg-su-head">
            {isMobileViewport && (
              <button type="button" className="pg-m-icon-btn is-plain" aria-label="Close" onClick={() => setIsSetupTeamModalOpen(false)}>
                <Icon d="M6 6l12 12M18 6 6 18" />
              </button>
            )}
            <div className="pg-su-titles">
              <h2>Set up match</h2>
              {!isMobileViewport && <span>Team names are required. Player names are optional: numbers work on their own.</span>}
            </div>
            {isMobileViewport
              ? <span className="pg-su-step">{setupTab} of 2</span>
              : (
                <button type="button" className="pg-m-icon-btn" aria-label="Close" onClick={() => setIsSetupTeamModalOpen(false)}>
                  <Icon d="M6 6l12 12M18 6 6 18" />
                </button>
              )}
          </header>

          {isMobileViewport && (
            <div className="pg-su-tabs">
              {cards.map(c => {
                const ok = !nameErrorFor(c.n);
                const showWarn = !ok && (setupTouched[c.n] || setupAttempted);
                const active = setupTab === c.n;
                return (
                  <button
                    key={c.n}
                    type="button"
                    className={active ? 'is-active' : ''}
                    style={active ? { background: c.color.main, color: c.color.secondary } : undefined}
                    onClick={() => setSetupTab(c.n)}
                  >
                    {ok && <Icon d="m5 12 5 5 9-10" />}
                    {showWarn && <Icon d="M12 7v6M12 16.5v.5"><circle cx="12" cy="12" r="9" /></Icon>}
                    {(c.name || '').trim() || c.side}
                  </button>
                );
              })}
            </div>
          )}

          <div className="pg-su-body">
            {isMobileViewport ? renderSetupCard(cards[setupTab - 1]) : cards.map(renderSetupCard)}
          </div>

          <footer className="pg-su-foot">
            {footerMsg && (
              <span className="pg-su-foot-msg" role="status">
                <Icon d="M12 7v6M12 16.5v.5"><circle cx="12" cy="12" r="9" /></Icon>
                {footerMsg}
              </span>
            )}
            {!isMobileViewport && (
              <button type="button" className="pg-m-cancel" onClick={() => setIsSetupTeamModalOpen(false)}>Cancel</button>
            )}
            {isMobileViewport && setupTab === 1 ? (
              <button
                type="button"
                className="pg-m-save"
                onClick={() => {
                  setSetupTouched(s => ({ ...s, 1: true }));
                  if ((team1 || '').trim()) setSetupTab(2);
                }}
              >
                Next: away team →
              </button>
            ) : (
              <button type="button" className="pg-m-save" disabled={!setupValid} onClick={handleStartTagging}>
                Start tagging
              </button>
            )}
          </footer>
        </div>
      </Modal>
    );
  };

  return (
  <div className={`scroll-container ${isMobileViewport ? 'pg-mobile-root' : ''}`}>
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




      {isMobileViewport ? renderMobileLayout() : renderDesktopLayout()}
</div>

{openDialog && isMobileViewport && renderMobileShotSheet()}

{openDialog && !isMobileViewport && renderDesktopShotDialog()}

{openLineDialog && (
  <Modal
    isOpen={openLineDialog}
    onRequestClose={handleCloseLineDialog}
    contentLabel="Line Action Details"
    style={{
      overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1000,
      },
      content: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        transform: 'translate(-50%, -50%)',
        marginRight: '-50%',
        background: '#2e2e2e',
        borderRadius: '10px',
        padding: '20px',
        width: mw('500px'),
        maxHeight: '90vh',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      },
    }}
  >
    <div
      className="dialog-header"
      style={{
        marginBottom: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <h3 style={{ color: 'white' }}>Enter Action Details for Line</h3>
      <button
        className="close-button"
        onClick={handleCloseLineDialog}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
        }}
      >
        &#10005;
      </button>
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '10px',
        width: '100%',
      }}
    >
      {/* Action Field */}
      <div>
        <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Action:</label>
        <select
          name="action"
          value={formData.action}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
        >
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
          <div style={{ marginTop: '5px' }}>
            <input
              type="text"
              placeholder="New Action Name"
              name="customAction"
              value={customInput.action}
              onChange={(e) =>
                setCustomInput({ ...customInput, action: e.target.value })
              }
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>

      {/* Team & Minute */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Team:</label>
          <select
            name="team"
            value={formData.team}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          >
            {(team1 || team2) ? (
              <>
                {team1 && <option value={team1}>{team1}</option>}
                {team2 && <option value={team2}>{team2}</option>}
              </>
            ) : (
              initialCounties.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))
            )}
            <option value="custom">Add New Team</option>
          </select>
          {formData.team === 'custom' && (
            <div style={{ marginTop: '5px' }}>
              <input
                type="text"
                placeholder="New Team Name"
                name="customTeam"
                value={customInput.team}
                onChange={(e) =>
                  setCustomInput({ ...customInput, team: e.target.value })
                }
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Minute:</label>
          <input
            type="text"
            name="minute"
            value={formData.minute}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Half:</label>
          <select
            value={currentHalf}
            onChange={(e) => setCurrentHalf(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          >
            {HALVES.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Player Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Player Name:</label>
          <input
            type="text"
            name="playerName"
            value={formData.playerName}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Player Number:</label>
          <input
            type="text"
            name="player"
            value={formData.player}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Position & Pressure */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Position:</label>
          <select
            name="position"
            value={formData.position}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          >
            <option value="custom">Add New Position</option>
            {positions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
          {formData.position === 'custom' && (
            <div style={{ marginTop: '5px' }}>
              <input
                type="text"
                placeholder="New Position"
                name="customPosition"
                value={customInput.position}
                onChange={(e) =>
                  setCustomInput({ ...customInput, position: e.target.value })
                }
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Pressure:</label>
          <select
            name="pressure"
            value={formData.pressure}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          >
            <option value="custom">Add New Pressure</option>
            {pressures.map((pressure) => (
              <option key={pressure} value={pressure}>
                {pressure}
              </option>
            ))}
          </select>
          {formData.pressure === 'custom' && (
            <div style={{ marginTop: '5px' }}>
              <input
                type="text"
                placeholder="New Pressure"
                name="customPressure"
                value={customInput.pressure}
                onChange={(e) =>
                  setCustomInput({ ...customInput, pressure: e.target.value })
                }
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Foot/Hand */}
      <div>
        <label style={{ display: 'block', marginBottom: '5px', color: 'white' }}>Foot/Hand:</label>
        <select
          name="foot"
          value={formData.foot}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
        >
          <option value="custom">Add New Option</option>
          {feet.map((foot) => (
            <option key={foot} value={foot}>
              {foot}
            </option>
          ))}
        </select>
        {formData.foot === 'custom' && (
          <div style={{ marginTop: '5px' }}>
            <input
              type="text"
              placeholder="New Foot/Hand Option"
              name="customFoot"
              value={customInput.foot}
              onChange={(e) =>
                setCustomInput({ ...customInput, foot: e.target.value })
              }
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>

      {/* Modal Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '20px',
        }}
      >
        <button
          onClick={handleCloseLineDialog}
          style={{
            padding: '8px 16px',
            background: '#444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleFormSubmit}
          style={{
            padding: '8px 16px',
            background: '#8e44ad',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Submit
        </button>
      </div>
    </div>
  </Modal>
)}

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
        width: mw('80%'),
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

    {/* Game Name Input
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
    </div> */}

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

        {/* Team Name */}
    <div style={{ marginBottom: '20px' }}>
      <label htmlFor="saveTeamName" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#fff' }}>
        Team Name: <span style={{ color: '#dc3545' }}>*</span>
      </label>
      <input
        type="text"
        id="saveTeamName"
        value={saveTeamName}
        onChange={(e) => setSaveTeamName(e.target.value)}
        placeholder="e.g. Louth"
        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
      />
    </div>

    {/* Opposition */}
    <div style={{ marginBottom: '20px' }}>
      <label htmlFor="saveOpposition" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#fff' }}>
        Opposition: <span style={{ color: '#dc3545' }}>*</span>
      </label>
      <input
        type="text"
        id="saveOpposition"
        value={saveOpposition}
        onChange={(e) => setSaveOpposition(e.target.value)}
        placeholder="e.g. Meath"
        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
      />
    </div>

    {/* Competition */}
    <div style={{ marginBottom: '20px' }}>
      <label htmlFor="saveCompetition" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#fff' }}>
        Competition: <span style={{ color: '#dc3545' }}>*</span>
      </label>
      <select
        id="saveCompetition"
        value={saveCompetition}
        onChange={(e) => setSaveCompetition(e.target.value)}
        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
      >
        <option value="">-- Select a Competition --</option>
        {COMPETITIONS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>

    <div style={{ marginBottom: '20px', color: '#b0b0b0', fontSize: '13px' }}>
      Will be saved as:{' '}
      <strong style={{ color: '#9254de' }}>
        {buildGameName() ? `${buildGameName()}.json` : '—'}
      </strong>
    </div>

    {/* Save to Dataset Section with Refresh Button */}
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        <label
          htmlFor="saveToDataset"
          style={{ fontWeight: 'bold', color: '#fff', marginRight: '10px' }}
        >
          Save to Dataset:
        </label>
        <button
          onClick={handleRefreshDatasets}
          disabled={isRefreshingDatasets}
          style={{
            padding: '5px 10px',
            backgroundColor: isRefreshingDatasets ? '#6c757d' : '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isRefreshingDatasets ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
          title="Refresh the list of available datasets"
        >
          {isRefreshingDatasets && (
            <span
              style={{
                width: '12px',
                height: '12px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            ></span>
          )}
          {isRefreshingDatasets ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
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
      {/* Review Data Button */}
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
            width: mw('50%'),
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
      width: mw('50%'),
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
        margin: '5px 0',
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
        margin: '5px 0',
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
        margin: '5px 0',
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
      width: mw('50%'),
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
            width: mw('40%'),
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

      {renderSetupTeamsModal()}

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
          maxWidth: '95vw',
          overflowY: 'auto',
          border: 'none'
        }
      }}
    >
      <div className="review-modal-container">
        <h2 className="review-modal-header" style={{ color: '#fff', textAlign: 'center', marginBottom: '15px' }}>
          Review Data
        </h2>
        <div style={{ overflowX: 'auto' }}>
        <table className="review-table" style={{ width: '100%', minWidth: isMobileViewport ? '900px' : undefined, borderCollapse: 'collapse', color: '#fff' }}>
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
              <th style={{ padding: '8px', borderBottom: '1px solid #555' }}>Half</th>
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
                    type="text"
                    value={coord.half || ''}
                    onChange={(e) => handleReviewChange(index, 'half', e.target.value)}
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
        </div>
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
