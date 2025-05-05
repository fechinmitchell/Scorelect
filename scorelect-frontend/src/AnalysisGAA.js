import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import { SavedGamesContext } from './components/SavedGamesContext';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';

// Icons
import {
  FaVideo,
  FaDatabase,
  FaMapMarkedAlt,
  FaChartBar,
  FaFilter,
  FaPlay,
  FaRedo,
  FaChevronDown,
  FaChevronUp,
  FaFileUpload,
  FaEdit,
  FaChartLine,
  FaFootballBall
} from 'react-icons/fa';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import FilterListIcon from '@mui/icons-material/FilterList';
import StorageIcon from '@mui/icons-material/Storage';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import SportsIcon from '@mui/icons-material/Sports';
import AnalyticsIcon from '@mui/icons-material/Analytics';

// Import our custom CSS file
import './AnalysisGAA.css';

// --- DatasetAnalysis Component ---
const DatasetAnalysis = () => {
  const { datasets } = useContext(SavedGamesContext);
  const { currentUser, loading } = useAuth();
  const { userRole } = useUser();
  const navigate = useNavigate();

  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [selectedUserDataset, setSelectedUserDataset] = useState('');
  const [selectedMatch, setSelectedMatch] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    teams: [],
    players: [],
    actions: []
  });
  const [analysisPermission, setAnalysisPermission] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const onDrop = (files) => {
    if (!files.length) return;
    const file = files[0];
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (!json.games || !Array.isArray(json.games)) {
          throw new Error('Invalid structure');
        }
        setParsedData(json);
        Swal.fire({
          title: 'File Uploaded',
          text: `${file.name} parsed successfully.`,
          icon: 'success',
          background: 'var(--dark-card)',
          color: 'var(--light)',
          confirmButtonColor: 'var(--primary)'
        });
      } catch {
        Swal.fire({
          title: 'Error',
          text: 'Invalid JSON format.',
          icon: 'error',
          background: 'var(--dark-card)',
          color: 'var(--light)',
          confirmButtonColor: 'var(--primary)'
        });
      }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    multiple: false
  });

  useEffect(() => {
    if (loading) return;
    (async () => {
      const ref = doc(firestore, 'adminSettings', 'config');
      const snap = await getDoc(ref);
      const perms = snap.exists() ? snap.data().permissions || {} : {};
      const perm = perms.analysis || 0;
      setAnalysisPermission(perm);

      if (perm > 0 && !currentUser) {
        await Swal.fire({
          title: 'Sign In Required',
          text: 'Please sign in to continue.',
          icon: 'warning',
          background: 'var(--dark-card)',
          color: 'var(--light)',
          confirmButtonColor: 'var(--primary)'
        });
        return navigate('/signin');
      }
      if (
        (perm === 1 && userRole !== 'free') ||
        (perm === 2 && userRole !== 'premium')
      ) {
        await Swal.fire({
          title: 'Access Denied',
          text: 'Insufficient permissions.',
          icon: 'error',
          background: 'var(--dark-card)',
          color: 'var(--light)',
          confirmButtonColor: 'var(--primary)'
        });
        return navigate('/');
      }
    })();
  }, [currentUser, loading, userRole, navigate]);

  useEffect(() => {
    const source =
      parsedData || (selectedUserDataset && datasets[selectedUserDataset]);
    if (!source?.games) return;

    const teams = new Set(),
      players = new Set(),
      actions = new Set();

    source.games.forEach((g) =>
      g.gameData?.forEach((e) => {
        if (e.team) teams.add(e.team);
        if (e.playerName) players.add(e.playerName);
        if (e.action) actions.add(e.action);
      })
    );

    setFilterOptions({
      teams: [...teams].sort(),
      players: [...players].sort(),
      actions: [...actions].sort()
    });
  }, [parsedData, selectedUserDataset, datasets]);

  const handleContinue = () => {
    let data = parsedData || datasets[selectedUserDataset];
    if (!data) {
      Swal.fire({
        title: 'No Dataset',
        text: 'Upload or select a dataset first.',
        icon: 'warning',
        background: 'var(--dark-card)',
        color: 'var(--light)',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }
  
    // Filter to selected match if needed
    if (selectedMatch !== 'all') {
      data = {
        ...data,
        games: data.games.filter(
          (g) => (g.gameId || g.gameName) === selectedMatch
        )
      };
    }
  
    // Add normalization logic for coordinates
    const pitchWidth = 145;  // Width of pitch in meters
    const pitchHeight = 88;  // Height of pitch in meters
    const halfLineX = pitchWidth / 2;
    const goalY = pitchHeight / 2;
  
    // Process each game to normalize coordinates
    const processedGames = data.games.map(game => {
      const analysisType = game.analysisType || 'pitch';
      
      return {
        ...game,
        gameData: (game.gameData || []).map(tag => {
          // Different handling based on analysis type
          if (analysisType === 'video') {
            // Video analysis - normalize coordinates from percentages (0-100) to meters
            const rawX = parseFloat(tag.x) || 50;
            const rawY = parseFloat(tag.y) || 50;
            
            // Normalize coordinates to match the analysis dashboard's 145×88 meter pitch
            const normalizedX = (rawX / 100) * pitchWidth;
            const normalizedY = (rawY / 100) * pitchHeight;
            
            // Determine which goal the shot is targeting based on x position
            const isLeftSide = normalizedX <= halfLineX;
            const targetGoalX = isLeftSide ? 0 : pitchWidth;
            
            // Calculate distance to goal - required for proper positioning in analysis
            const dx = normalizedX - targetGoalX;
            const dy = normalizedY - goalY;
            const distToGoal = Math.sqrt(dx * dx + dy * dy);
            
            // Ensure position is a string value
            let positionStr = '';
            if (typeof tag.position === 'string') {
              positionStr = tag.position;
            } else if (tag.position && typeof tag.position === 'object') {
              positionStr = tag.position.type || 'forward';
            } else {
              positionStr = 'forward';
            }
            
            return {
              ...tag,
              position: positionStr,
              x: normalizedX,
              y: normalizedY,
              distMeters: distToGoal,
              side: isLeftSide ? 'Left' : 'Right',
              distanceFromGoal: distToGoal,
              pressure: tag.pressure || '0',
              foot: tag.foot || 'Right'
            };
          } else {
            // Pitch analysis - keep original coordinates but ensure all required fields
            let positionStr = '';
            if (typeof tag.position === 'string') {
              positionStr = tag.position;
            } else if (tag.position && typeof tag.position === 'object') {
              positionStr = tag.position.type || 'forward';
            } else {
              positionStr = 'forward';
            }
            
            // Calculate distance to goal if not already present
            let distMeters = tag.distMeters;
            if (!distMeters && tag.x !== undefined && tag.y !== undefined) {
              const x = parseFloat(tag.x);
              const y = parseFloat(tag.y);
              const isLeftSide = x <= halfLineX;
              const targetGoalX = isLeftSide ? 0 : pitchWidth;
              const dx = x - targetGoalX;
              const dy = y - goalY;
              distMeters = Math.sqrt(dx * dx + dy * dy);
            }
            
            // Add renderType for proper marker coloring
            let renderType = '';
            const action = tag.action?.toLowerCase().trim() || '';
            
            if (action === 'free' || action === 'fortyfive' || action === 'offensive mark') {
              renderType = 'setplayscore';
            } else if (action.includes('free') && (action.includes('miss') || action.includes('wide') || action.includes('short'))) {
              renderType = 'setplaymiss';
            } else if (action === 'goal' || action === 'penalty goal') {
              renderType = action;
            } else if (action === 'point') {
              renderType = 'point';
            } else if (action.includes('miss') || action.includes('wide') || action.includes('short')) {
              renderType = 'miss';
            } else if (action.includes('block')) {
              renderType = 'blocked';
            } else {
              renderType = action;
            }
            
            return {
              ...tag,
              position: positionStr,
              distMeters: distMeters || 30,
              side: tag.side || (tag.x <= halfLineX ? 'Left' : 'Right'),
              distanceFromGoal: tag.distanceFromGoal || distMeters || 30,
              pressure: tag.pressure || '0',
              foot: tag.foot || 'Right',
              renderType: renderType
            };
          }
        })
      };
    });
  
    // Create processed data object with normalized games
    const processedData = {
      ...data,
      games: processedGames
    };
  
    // Navigate with processed data
    navigate('/analysis/gaa-dashboard', {
      state: {
        file: processedData,
        sport: 'GAA',
        filters: {
          team: selectedTeam || null,
          player: selectedPlayer || null,
          action: selectedAction || null
        }
      }
    });
  };

  const handleReset = () => {
    setUploadedFile(null);
    setParsedData(null);
    setSelectedUserDataset('');
    setSelectedMatch('all');
    setSelectedTeam('');
    setSelectedPlayer('');
    setSelectedAction('');
    setFilterOptions({ teams: [], players: [], actions: [] });
    setShowFilters(false);
  };

  return (
    <div className="analysis-section">
      <div className="section-header">
        <h4><FaDatabase /> Dataset Analysis</h4>
      </div>

      {/* Saved Datasets */}
      {Object.keys(datasets).length > 0 && (
        <div>
          <p>Select a saved dataset:</p>
          <select
            className="custom-select"
            value={selectedUserDataset}
            onChange={(e) => {
              setSelectedUserDataset(e.target.value);
              setSelectedMatch('all');
              setShowFilters(!!e.target.value);
            }}
          >
            <option value="">-- Select Dataset --</option>
            {Object.keys(datasets).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          
          {selectedUserDataset && (
            <select
              className="custom-select"
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
            >
              <option value="all">All Matches</option>
              {datasets[selectedUserDataset].games.map((g) => {
                const id = g.gameId || g.gameName;
                return (
                  <option key={id} value={id}>
                    {g.gameName}{' '}
                    {g.matchDate
                      ? `(${new Date(g.matchDate).toLocaleDateString()})`
                      : '(N/A)'}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      )}

      {/* Upload JSON */}
      <div 
        className={`dropzone-container ${isDragActive ? 'active' : ''}`} 
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <FaFileUpload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
        {isDragActive ? (
          <h3>Drop the JSON here…</h3>
        ) : (
          <>
            <h3>Drag & drop a dataset JSON</h3>
            <p>or click to select</p>
          </>
        )}
      </div>

      {uploadedFile && (
        <div className="file-preview">
          <div className="file-icon">
            <FaDatabase />
          </div>
          <div className="file-info">
            <div className="file-name">{uploadedFile.name}</div>
            <div className="file-meta">{Math.round(uploadedFile.size / 1024)} KB</div>
          </div>
        </div>
      )}

      {/* Filters Toggle */}
      <div className="filters-header">
        <h5><FaFilter /> Additional Filters</h5>
        <button 
          className="filters-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'} {showFilters ? <FaChevronUp /> : <FaChevronDown />}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="filters-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <label>Team</label>
              <select
                className="custom-select"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                <option value="">All Teams</option>
                {filterOptions.teams.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label>Player</label>
              <select
                className="custom-select"
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
              >
                <option value="">All Players</option>
                {filterOptions.players.map((player) => (
                  <option key={player} value={player}>{player}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label>Action</label>
              <select
                className="custom-select"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
              >
                <option value="">All Actions</option>
                {filterOptions.actions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="buttons-container">
        <button className="action-button success" onClick={handleContinue}>
          <FaPlay /> Continue to Analysis
        </button>
        <button className="action-button danger" onClick={handleReset}>
          <FaRedo /> Reset
        </button>
      </div>
    </div>
  );
};

// --- VideoAnalysis Component ---
const VideoAnalysis = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const validateYouTubeUrl = (url) =>
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/.test(
      url
    );

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setYoutubeUrl(val);
    if (val && !validateYouTubeUrl(val)) {
      setUrlError('Please enter a valid YouTube URL');
    } else {
      setUrlError('');
    }
    if (val) setFile(null);
  };

  const onDrop = (files) => {
    if (!files.length) return;
    setFile(files[0]);
    setYoutubeUrl('');
    setUrlError('');
    Swal.fire({
      title: 'Video Uploaded',
      text: `${files[0].name} uploaded.`,
      icon: 'success',
      background: 'var(--dark-card)',
      color: 'var(--light)',
      confirmButtonColor: 'var(--primary)'
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/mp4': ['.mp4'] },
    multiple: false
  });

  const handleContinue = () => {
    if (!file && !youtubeUrl) {
      return Swal.fire({
        title: 'No Video Selected',
        text: 'Upload a file or enter a URL.',
        icon: 'warning',
        background: 'var(--dark-card)',
        color: 'var(--light)',
        confirmButtonColor: 'var(--primary)'
      });
    }
    if (youtubeUrl && urlError) {
      return Swal.fire({
        title: 'Invalid URL',
        text: 'Correct the YouTube URL.',
        icon: 'error',
        background: 'var(--dark-card)',
        color: 'var(--light)',
        confirmButtonColor: 'var(--primary)'
      });
    }
    navigate('/tagging/manual', {
      state: { file: file || null, youtubeUrl: youtubeUrl || null, sport: 'GAA' }
    });
  };

  const handleReset = () => {
    setFile(null);
    setYoutubeUrl('');
    setUrlError('');
  };

  return (
    <div className="analysis-section">
      <div className="section-header">
        <h4><FaVideo /> Video Analysis</h4>
      </div>

      {/* YouTube URL */}
      <div>
        <label>Enter YouTube URL</label>
        <input
          type="text"
          className="custom-input"
          value={youtubeUrl}
          onChange={handleUrlChange}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        {urlError && <p style={{ color: 'var(--danger)', marginTop: '-0.5rem' }}>{urlError}</p>}
      </div>

      {/* Upload MP4 */}
      <div 
        className={`dropzone-container ${isDragActive ? 'active' : ''}`} 
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <FaVideo size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
        {isDragActive ? (
          <h3>Drop the MP4 here…</h3>
        ) : (
          <>
            <h3>Drag & drop an MP4</h3>
            <p>or click to select</p>
          </>
        )}
      </div>

      {/* Preview */}
      {file && (
        <div className="file-preview">
          <div className="file-icon">
            <FaVideo />
          </div>
          <div className="file-info">
            <div className="file-name">{file.name}</div>
            <div className="file-meta">{Math.round(file.size / 1024)} KB</div>
          </div>
        </div>
      )}
      
      {youtubeUrl && !urlError && (
        <div className="file-preview">
          <div className="file-icon">
            <FaVideo />
          </div>
          <div className="file-info">
            <div className="file-name">YouTube Video</div>
            <div className="file-meta">{youtubeUrl}</div>
          </div>
        </div>
      )}

      {/* Tagging Options */}
      {(file || (youtubeUrl && !urlError)) && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <h4>Select tagging method:</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <button className="action-button primary" onClick={handleContinue}>
              <FaEdit /> Manual Tagging
            </button>
            
            <button className="action-button disabled" disabled title="Coming soon!">
              <AutoAwesomeIcon style={{ fontSize: 16 }} /> AI-Assisted Tagging
              <span className="premium-tag">PREMIUM</span>
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="buttons-container">
        <button className="action-button danger" onClick={handleReset}>
          <FaRedo /> Reset
        </button>
      </div>
    </div>
  );
};

// --- PitchAnalysis Component ---
const PitchAnalysis = () => {
  const { currentUser } = useAuth();
  const { userRole } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      Swal.fire({
        title: 'Sign In Required',
        text: 'Please sign in to use the Pitch Analysis tool.',
        icon: 'warning',
        background: 'var(--dark-card)',
        color: 'var(--light)',
        confirmButtonColor: 'var(--primary)'
      }).then(() => navigate('/signin'));
    }
  }, [currentUser, navigate]);

  const options = [
    {
      id: 'setup-team',
      title: 'Setup Team',
      description: 'Configure team details before analysis.',
      icon: <SportsSoccerIcon style={{ fontSize: 42, color: 'var(--primary)' }} />,
      onClick: () => navigate('/pitch', { state: { newSession: true, setupTeam: true } })
    },
    {
      id: 'skip-setup',
      title: 'Skip Setup',
      description: 'Jump straight into analysis.',
      icon: <SportsIcon style={{ fontSize: 42, color: 'var(--primary)' }} />,
      onClick: () => navigate('/pitch', { state: { newSession: true, skipSetup: true } })
    }
  ];

  const premiumFeatures = userRole === 'premium' 
    ? [
        {
          id: 'load-template',
          title: 'Load Template',
          description: 'Use a saved template to set up quickly.',
          icon: <StorageIcon style={{ fontSize: 42, color: 'var(--primary)' }} />,
          onClick: () => navigate('/pitch', { state: { newSession: true, loadTemplate: true } })
        }
      ]
    : [
        {
          id: 'premium-templates',
          title: 'Premium Templates',
          description: 'Upgrade to access and save templates.',
          icon: <AutoAwesomeIcon style={{ fontSize: 42, color: 'var(--primary)' }} />,
          isPremium: true,
          onClick: () => {
            Swal.fire({
              title: 'Premium Feature',
              html: 'Templates are available with a premium subscription.',
              icon: 'info',
              background: 'var(--dark-card)',
              color: 'var(--light)',
              confirmButtonColor: 'var(--primary)',
              confirmButtonText: 'Upgrade',
              showCancelButton: true,
              cancelButtonColor: 'var(--gray-light)'
            }).then((result) => {
              if (result.isConfirmed) navigate('/upgrade');
            });
          }
        }
      ];

  return (
    <div className="analysis-section">
      <div className="section-header">
        <h4><FaMapMarkedAlt /> Pitch Analysis</h4>
      </div>

      <p>Choose how you want to start your pitch analysis session:</p>

      <div className="options-grid">
        {options.map((option) => (
          <div key={option.id} className="option-card" onClick={option.onClick}>
            <div className="option-icon">
              {option.icon}
            </div>
            <h4 className="option-title">{option.title}</h4>
            <p className="option-description">{option.description}</p>
            <button className="action-button primary">
              Start
            </button>
          </div>
        ))}
      </div>

      {premiumFeatures.length > 0 && (
        <div style={{ marginTop: 'var(--space-xl)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-md)', color: 'var(--light)' }}>
            Additional Options
            {premiumFeatures[0].isPremium && (
              <span className="premium-tag">PREMIUM</span>
            )}
          </h4>

          <div className="options-grid" style={{ gridTemplateColumns: '1fr' }}>
            {premiumFeatures.map((feature) => (
              <div key={feature.id} className="option-card" onClick={feature.onClick} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', padding: 'var(--space-md)' }}>
                <div className="option-icon" style={{ width: '60px', height: '60px', margin: 0 }}>
                  {feature.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 className="option-title" style={{ textAlign: 'left', margin: 0 }}>{feature.title}</h4>
                  <p className="option-description" style={{ textAlign: 'left', margin: '0.5rem 0 0 0' }}>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main AnalysisGAA Component ---
const AnalysisGAA = () => {
  const [activeTab, setActiveTab] = useState(0);
  
  const tabs = [
    { label: 'Dataset', icon: <FaDatabase /> },
    { label: 'Video', icon: <FaVideo /> },
    { label: 'Pitch', icon: <FaMapMarkedAlt /> }
  ];

  return (
    <div className="analysis-container">
      {/* Header */}
      <div className="analysis-header">
        <h3>
          <AnalyticsIcon fontSize="large" style={{ marginRight: '0.5rem' }} />
          GAA Analysis
        </h3>
        <p className="analysis-subtitle">
          Track, analyze, and visualize performance metrics for your GAA matches.
        </p>
      </div>

      {/* Tabs */}
      <div className="analysis-tabs">
        {tabs.map((tab, index) => (
          <button 
            key={tab.label}
            className={`tab-button ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {tab.icon} {tab.label} Analysis
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 0 && <DatasetAnalysis />}
      {activeTab === 1 && <VideoAnalysis />}
      {activeTab === 2 && <PitchAnalysis />}
    </div>
  );
};

export default AnalysisGAA;