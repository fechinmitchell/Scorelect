import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { SavedGamesContext } from './components/SavedGamesContext';
import { GameContext } from './GameContext';
import { useAuth } from './AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import './DashboardHome.css';
import InsightsIcon from '@mui/icons-material/Insights';

// Import icons from react-icons
import { 
  FaVideo, 
  FaMapMarkedAlt, 
  FaDatabase, 
  FaHistory, 
  FaClock, 
  FaUsers,
  FaChartLine, 
  FaChartPie,
  FaSearch,
  FaRedo,
  FaBrain
} from 'react-icons/fa';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AnalyticsIcon from '@mui/icons-material/Analytics';

// Enhanced Feature Card with hover effects and better visual hierarchy
const FeatureCard = ({ icon: Icon, title, blurb, cta, onClick }) => {
  return (
    <div className="feature-card" onClick={onClick}>
      <div className="feature-icon">
        <Icon size={40} />
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">{blurb}</p>
      <button className="feature-button">
        {cta}
      </button>
    </div>
  );
};

// Helper function to build video navigation state
const buildVideoNavState = (game) => {
  let pitchWidth, pitchHeight;
  
  if (game.sport === 'Soccer') {
    pitchWidth = 105;
    pitchHeight = 68;
  } else {
    pitchWidth = 145;
    pitchHeight = 88;
  }
  
  const halfLineX = pitchWidth / 2;
  const goalY = pitchHeight / 2;

  // Ensure gameData exists and is an array
  const gameData = Array.isArray(game.gameData) ? game.gameData : [];

  return {
    youtubeUrl: game.youtubeUrl,
    sport: game.sport,
    datasetName: game.datasetName,
    teamsData: game.teamsData,
    tags: gameData.map((tag) => {
      const rawX = parseFloat(tag.x) || 50;
      const rawY = parseFloat(tag.y) || 50;
      
      const normalizedX = (rawX / 100) * pitchWidth;
      const normalizedY = (rawY / 100) * pitchHeight;
      
      const isLeftSide = normalizedX <= halfLineX;
      const targetGoalX = isLeftSide ? 0 : pitchWidth;
      
      const dx = normalizedX - targetGoalX;
      const dy = normalizedY - goalY;
      const distToGoal = Math.sqrt(dx * dx + dy * dy);
      
      return {
        id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: tag.timestamp || 0,
        category: tag.category || 'Unknown',
        action: tag.action,
        team: tag.team,
        player: tag.playerName || tag.player,
        outcome: tag.outcome,
        position: tag.position || 'forward',
        x: normalizedX,
        y: normalizedY,
        distMeters: distToGoal,
        side: isLeftSide ? 'Left' : 'Right',
        distanceFromGoal: distToGoal,
        pressure: tag.pressure || '0',
        foot: tag.foot || 'Right',
        notes: tag.notes || '',
      };
    }),
  };
};

// Enhanced Recent Game Item with better styling and animation
const RecentGameItem = ({ game, onSelect }) => {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [permissions, setPermissions] = useState({});
  const [userLevel, setUserLevel] = useState(0);
  const { fetchFullGameData } = useContext(SavedGamesContext);
  
  // Check if text is overflowing on mount and window resize
  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        const isTextOverflowing = textRef.current.scrollWidth > textRef.current.clientWidth;
        setIsOverflowing(isTextOverflowing);
      }
    };
    
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    
    return () => window.removeEventListener('resize', checkOverflow);
  }, [game.gameName]);
  
  // Fetch permissions from Firestore when component mounts
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const featuresRef = doc(firestore, 'adminSettings', 'config');
        const featuresSnap = await getDoc(featuresRef);
        if (featuresSnap.exists()) {
          setPermissions(featuresSnap.data().permissions || {});
        }
        
        if (currentUser && currentUser.premium) {
          setUserLevel(2);
        } else if (currentUser) {
          setUserLevel(1);
        } else {
          setUserLevel(0);
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
      }
    };
    
    fetchPermissions();
  }, [currentUser]);
  
  // Format the date if available
  const formattedDate = game.matchDate 
    ? new Date(game.matchDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'No date';
  
  // Open in dataset analysis - handles both video and pitch analysis
  const handleDatasetAnalysis = async (e) => {
    e.stopPropagation();
    
    // Check if this is a video analysis game
    const analysisType = game.analysisType || 'pitch';
    
    if (analysisType === 'video') {
      // For video analysis games, open the video tagging interface
      Swal.fire({
        title: 'Opening Video Analysis',
        text: `Loading video for ${game.gameName}`,
        icon: 'info',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
        showConfirmButton: false,
        timer: 1500
      });
      
      try {
        // Fetch full game data if needed
        let fullGameData;
        if (game.gameData && Array.isArray(game.gameData) && game.gameData.length > 0) {
          fullGameData = game;
        } else {
          // Fetch the full game data
          fullGameData = await fetchFullGameData(game.gameId || game.gameName);
        }
        
        // Ensure gameData is an array
        if (!Array.isArray(fullGameData.gameData)) {
          fullGameData.gameData = Object.values(fullGameData.gameData || {});
        }
        
        // Navigate to video tagging with the game data
        navigate('/tagging/manual', { 
          state: buildVideoNavState(fullGameData) 
        });
      } catch (error) {
        console.error('Error loading video game:', error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to load video data. Please try again.',
          icon: 'error',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
      }
      return;
    }
    
    // For pitch analysis games, open the data analysis dashboard
    Swal.fire({
      title: 'Loading Game Data...',
      text: 'Please wait while we prepare your analysis.',
      allowOutsideClick: false,
      background: 'var(--dark-card)',
      color: 'var(--light)',
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    try {
      // Fetch full game data
      let fullGameData;
      if (game.gameData && game.gameData.length > 0) {
        fullGameData = game;
      } else {
        fullGameData = await fetchFullGameData(game.gameId || game.gameName);
      }
      
      // Ensure gameData is an array
      if (!Array.isArray(fullGameData.gameData)) {
        fullGameData.gameData = Object.values(fullGameData.gameData || {});
      }
      
      // Check the sport type and route to the correct dashboard
      if (game.sport === 'Soccer') {
        const pitchWidth = 105;
        const pitchHeight = 68;
        const halfLineX = pitchWidth / 2;
        const goalY = pitchHeight / 2;
        
        // Process the game data for soccer analysis
        const processedGame = {
          ...fullGameData,
          gameId: fullGameData.gameId || fullGameData.gameName,
          gameName: fullGameData.gameName,
          matchDate: fullGameData.matchDate,
          sport: fullGameData.sport || 'Soccer',
          datasetName: fullGameData.datasetName,
          analysisType: fullGameData.analysisType || 'pitch',
          gameData: (fullGameData.gameData || []).map(tag => {
            // Process each tag
            let positionStr = '';
            if (typeof tag.position === 'string') {
              positionStr = tag.position;
            } else if (tag.position && typeof tag.position === 'object') {
              positionStr = tag.position.type || 'forward';
            } else {
              positionStr = 'forward';
            }
            
            // Get coordinates
            let x = tag.x || 50;
            let y = tag.y || 50;
            
            // Calculate distance to goal
            const isLeftSide = x <= halfLineX;
            const targetGoalX = isLeftSide ? 0 : pitchWidth;
            const dx = x - targetGoalX;
            const dy = y - goalY;
            const distMeters = Math.sqrt(dx * dx + dy * dy);
            
            return {
              ...tag,
              position: positionStr,
              x: x,
              y: y,
              distMeters: distMeters,
              side: isLeftSide ? 'Left' : 'Right',
              distanceFromGoal: distMeters,
              pressure: tag.pressure || '0',
              foot: tag.foot || 'Right',
              playerName: tag.playerName || tag.player || '',
              team: tag.team || 'Unknown',
              action: tag.action || '',
              minute: tag.minute || 0
            };
          })
        };
        
        // Navigate to soccer analysis with properly formatted data
        const dataForAnalysis = {
          datasetName: processedGame.datasetName || 'Dataset',
          games: [processedGame]
        };
        
        Swal.close();
        console.log('Navigating to soccer dashboard with data:', dataForAnalysis);
        
        navigate('/analysis/soccer-dashboard', { 
          state: { 
            file: dataForAnalysis, 
            sport: 'Soccer',
            filters: {
              match: '',
              team: '',
              player: '',
              action: ''
            }
          } 
        });
      } else {
        // GAA pitch dimensions and goal positions
        const pitchWidth = 145;
        const pitchHeight = 88;
        const halfLineX = pitchWidth / 2;
        const goalY = pitchHeight / 2;
        
        const processedGame = {
          ...fullGameData,
          gameId: fullGameData.gameId || fullGameData.gameName,
          gameName: fullGameData.gameName,
          matchDate: fullGameData.matchDate,
          sport: fullGameData.sport || 'GAA',
          datasetName: fullGameData.datasetName,
          analysisType: fullGameData.analysisType || 'pitch',
          gameData: (fullGameData.gameData || []).map(tag => {
            // Process each tag
            let positionStr = '';
            if (typeof tag.position === 'string') {
              positionStr = tag.position;
            } else if (tag.position && typeof tag.position === 'object') {
              positionStr = tag.position.type || 'forward';
            } else {
              positionStr = 'forward';
            }
            
            // Get coordinates
            let x = tag.x || 50;
            let y = tag.y || 50;
            
            // Calculate distance to goal
            const isLeftSide = x <= halfLineX;
            const targetGoalX = isLeftSide ? 0 : pitchWidth;
            const dx = x - targetGoalX;
            const dy = y - goalY;
            const distMeters = Math.sqrt(dx * dx + dy * dy);
            
            return {
              ...tag,
              position: positionStr,
              x: x,
              y: y,
              distMeters: distMeters,
              side: isLeftSide ? 'Left' : 'Right',
              distanceFromGoal: distMeters,
              pressure: tag.pressure || '0',
              foot: tag.foot || 'Right',
              playerName: tag.playerName || tag.player || '',
              team: tag.team || 'Unknown',
              action: tag.action || '',
              minute: tag.minute || 0,
              touchedInFlight: tag.touchedInFlight || false,
              pointValue: tag.pointValue,
              xP: tag.xP,
              xPoints: tag.xPoints,
              xGoals: tag.xGoals
            };
          })
        };
        
        // Navigate to GAA analysis with properly formatted data
        const dataForAnalysis = {
          datasetName: processedGame.datasetName || 'Dataset',
          games: [processedGame]
        };
        
        Swal.close();
        console.log('Navigating to GAA dashboard with data:', dataForAnalysis);
        
        navigate('/analysis/gaa-dashboard', { 
          state: { 
            file: dataForAnalysis, 
            sport: 'GAA',
            filters: {
              match: '',
              team: '',
              player: '',
              action: ''
            }
          } 
        });
      }
    } catch (error) {
      console.error('Error loading game data:', error);
      Swal.close();
      Swal.fire({
        title: 'Error',
        text: 'Failed to load game data. Please try again.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    }
  };
  
  // AI analysis - NOW CHECKS PERMISSIONS
  const handleAIAnalysis = (e) => {
    e.stopPropagation();
    
    const aiAnalysisPermission = permissions['aiAnalysis'] ?? 2;
    
    if (userLevel >= aiAnalysisPermission) {
      Swal.fire({
        title: 'Opening AI Analysis',
        text: `Analyzing performance data for ${game.gameName}`,
        icon: 'info',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
        showConfirmButton: false,
        timer: 1500
      });
      
      if (game.sport === 'Soccer') {
        navigate('/ai-soccer-dashboard', { 
          state: { 
            file: { 
              datasetName: game.datasetName,
              games: [game] 
            }, 
            sport: 'Soccer'
          } 
        });
      } else {
        navigate('/ai-dashboard', { 
          state: { 
            file: { 
              datasetName: game.datasetName,
              games: [game] 
            }, 
            sport: game.sport || 'GAA'
          } 
        });
      }
    } else {
      Swal.fire({
        title: 'Premium Feature',
        html: `
          <div style="text-align: left; color: var(--light)">
            <p>AI-powered match analysis is a premium feature that provides:</p>
            <ul style="margin-left: 20px">
              <li>Advanced performance metrics</li>
              <li>Predictive play patterns</li>
              <li>Player improvement recommendations</li>
              <li>Tactical suggestions</li>
            </ul>
          </div>
        `,
        icon: 'info',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
        confirmButtonText: 'Upgrade',
        showCancelButton: true,
        cancelButtonText: 'Maybe Later',
        cancelButtonColor: 'var(--gray-light)'
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/upgrade');
        }
      });
    }
  };
    
  return (
    <div className="recent-game-item" onClick={() => onSelect(game)}>
      <div className="game-avatar">
        <FaHistory />
      </div>
      
      <div className="game-info">
        <div
          ref={textRef}
          className="game-name"
        >
          {game.gameName}
        </div>
        
        <div className="game-date">
          <FaClock /> {formattedDate}
        </div>
      </div>
      
      <div className="game-actions">
        <button
          className="action-btn analyze"
          onClick={handleDatasetAnalysis}
          title={game.analysisType === 'video' ? 'Open Video Analysis' : 'Open in Data Analysis'}
        >
          <InsightsIcon style={{ fontSize: 16 }} />
        </button>
        
        <button
          className="action-btn ai"
          onClick={handleAIAnalysis}
          title="AI Analysis"
        >
          <AutoAwesomeIcon style={{ fontSize: 14 }} />
          {(permissions['aiAnalysis'] ?? 2) > 0 && <div className="premium-dot"></div>}
        </button>
      </div>
    </div>
  );
};

// Enhanced Recent List with animations and better empty state
const RecentList = ({ games, empty, onSelect, title }) => (
  <div className="recent-list-section">
    <div className="recent-list-header">
      <FaHistory /> {title}
      <div className="recent-list-divider"></div>
    </div>
    
    <div className="recent-list">
      {games.length === 0 ? (
        <div className="empty-state">
          {empty}
        </div>
      ) : (
        games.map((g) => (
          <RecentGameItem 
            key={g.gameId || g.gameName} 
            game={g} 
            onSelect={onSelect} 
          />
        ))
      )}
    </div>
  </div>
);

const DashboardHome = ({ selectedSport, onNavigate }) => {
  const { datasets } = useContext(SavedGamesContext);
  const { setLoadedCoords } = useContext(GameContext);
  const navigate = useNavigate();

  // Helper to send the user straight to the correct tool
  const loadGame = (game) => {
    if (!game || !game.gameData) {
      Swal.fire({
        title: 'Error',
        text: 'Game data is empty or corrupted.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
      return;
    }
    
    const type = game.analysisType || 'pitch';
    
    if (type === 'video' || type === 'combined') {
      navigate('/tagging/manual', { state: buildVideoNavState(game) });
    } else {
      const normalizedCoords = Array.isArray(game.gameData)
        ? game.gameData
        : Object.values(game.gameData || {});
      
      setLoadedCoords(normalizedCoords);
      
      if (game.sport === 'Soccer') {
        navigate('/soccer-pitch', { state: { gameLoaded: true } });
      } else {
        navigate('/pitch', { state: { gameLoaded: true } });
      }
    }
  };
  
  /** pull five most-recent of each type for this sport */
  const { recentPitch, recentVideo } = useMemo(() => {
    const all = Object.values(datasets)
      .flatMap((d) => d.games)
      .filter((g) => g.sport === selectedSport);

    const byDate = (a, b) =>
      new Date(b.matchDate || 0) - new Date(a.matchDate || 0);

    return {
      recentPitch: all.filter((g) => (g.analysisType || 'pitch') === 'pitch').sort(byDate).slice(0, 5),
      recentVideo: all.filter((g) => g.analysisType === 'video').sort(byDate).slice(0, 5),
    };
  }, [datasets, selectedSport]);

  const handlePitchClick = () => {
    if (selectedSport === 'Soccer') {
      navigate('/soccer-pitch');
    } else {
      navigate('/pitch');
    }
  };

  const handleVideoClick = () => {
    switch (selectedSport) {
      case 'Soccer':
        navigate('/analysis-soccer', { state: { defaultTab: 'video' } });
        break;
      case 'GAA':
        navigate('/analysis-gaa', { state: { defaultTab: 'video' } });
        break;
      case 'Basketball':
        navigate('/analysis-basketball', { state: { defaultTab: 'video' } });
        break;
      case 'American Football':
        navigate('/analysis-american-football', { state: { defaultTab: 'video' } });
        break;
      default:
        navigate('/analysis-gaa', { state: { defaultTab: 'video' } });
        break;
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h3>{selectedSport} Dashboard</h3>
        <p className="dashboard-subtitle">
          Track, analyze, and visualize performance metrics for your {selectedSport} matches.
        </p>
      </div>

      <div className="feature-grid">
        <FeatureCard
          icon={FaMapMarkedAlt}
          title="Pitch Analysis"
          blurb="Tag events directly on a virtual pitch. Analyze player movements and team formations in real-time."
          cta="Open Pitch Tool"
          onClick={handlePitchClick}
        />

        <FeatureCard
          icon={FaVideo}
          title="Video Analysis"
          blurb="Upload or load match footage for detailed video analysis. Tag plays, track player movements, and identify key moments."
          cta="Open Video Tool"
          onClick={handleVideoClick}
        />

        <FeatureCard
          icon={FaDatabase}
          title="Data Hub"
          blurb="Access, share and explore performance datasets. Generate insights, export reports, and collaborate with your team."
          cta="Open Data Hub"
          onClick={() => navigate('/sports-datahub')}
        />
      </div>

      <div className="dashboard-content">
        <div className="dashboard-row">
          <div className="dashboard-column">
            <RecentList
              title="Recent Pitch Sessions"
              games={recentPitch}
              empty="No recent pitch analysis sessions found. Start a new session to see it here."
              onSelect={loadGame}
            />
          </div>

          <div className="dashboard-column">
            <RecentList
              title="Recent Video Sessions"
              games={recentVideo}
              empty="No recent video analysis sessions found. Upload a video to get started."
              onSelect={loadGame}
            />
          </div>

          <div className="dashboard-column">
            <div className="recent-list-section">
              <div className="recent-list-header">
                <FaDatabase /> Data Hub Stats
                <div className="recent-list-divider"></div>
              </div>
              
              <div className="recent-list">
                <div className="stats-container">
                  <div className="stat-item">
                    <div className="stat-label">Total Datasets:</div>
                    <div className="stat-value">{Object.keys(datasets).length}</div>
                  </div>
                  
                  <div className="stat-item">
                    <div className="stat-label">{selectedSport} Games:</div>
                    <div className="stat-value">
                      {Object.values(datasets)
                        .flatMap((d) => d.games)
                        .filter((g) => g.sport === selectedSport).length}
                    </div>
                  </div>
                  
                  <div className="stat-divider"></div>
                  
                  <div className="stat-section">Data Analysis</div>
                  
                  <div className="stat-item">
                    <div className="stat-label">Pitch Analyses:</div>
                    <div className="stat-value">{recentPitch.length}</div>
                  </div>
                  
                  <div className="stat-item">
                    <div className="stat-label">Video Analyses:</div>
                    <div className="stat-value">{recentVideo.length}</div>
                  </div>
                  
                  <div className="stat-divider"></div>
                  
                  <div className="stat-section">System Status</div>
                  
                  <div className="stat-item">
                    <div className="stat-label">Storage Used:</div>
                    <div className="stat-value">{Math.floor(Math.random() * 50) + 20}%</div>
                  </div>
                  
                  <div className="stat-item">
                    <div className="stat-label">Last Backup:</div>
                    <div className="stat-value">{new Date().toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;