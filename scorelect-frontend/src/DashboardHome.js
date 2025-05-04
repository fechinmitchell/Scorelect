import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { SavedGamesContext } from './components/SavedGamesContext';
import { GameContext } from './GameContext';
import './DashboardHome.css'; // Import the new CSS file

// Import icons from react-icons
import { 
  FaVideo, 
  FaMapMarkedAlt, 
  FaDatabase, 
  FaHistory, 
  FaClock, 
  FaChartLine, 
  FaChartPie,
  FaSearch,
  FaRedo,
  FaBrain
} from 'react-icons/fa';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import InsightsIcon from '@mui/icons-material/Insights';

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

// Enhanced Recent Game Item with better styling and animation
const RecentGameItem = ({ game, onSelect }) => {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef(null);
  const navigate = useNavigate();
  
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
  
  // Format the date if available
  const formattedDate = game.matchDate 
    ? new Date(game.matchDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'No date';
  
  // Open in dataset analysis
  const handleDatasetAnalysis = (e) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    
    Swal.fire({
      title: 'Opening Analysis Dashboard',
      text: `Analyzing performance data for ${game.gameName}`,
      icon: 'info',
      background: 'var(--dark-card)',
      confirmButtonColor: 'var(--primary)',
      showConfirmButton: false,
      timer: 1500
    });
    
    // GAA pitch dimensions and goal positions used in the analysis dashboard
    const pitchWidth = 145;  // Width of pitch in meters
    const pitchHeight = 88;  // Height of pitch in meters
    const halfLineX = pitchWidth / 2;
    const goalY = pitchHeight / 2;
    
    // Check if this is pitch or video analysis data
    const analysisType = game.analysisType || 'pitch';
    
    // Process the game data to normalize coordinates for correct positioning
    const processedGame = {
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
            // Store position as a string value for compatibility with analysis dashboard
            position: positionStr,
            // Use the normalized coordinates
            x: normalizedX,
            y: normalizedY,
            // Add these properties required for proper analysis visualization
            distMeters: distToGoal,
            side: isLeftSide ? 'Left' : 'Right',
            distanceFromGoal: distToGoal,
            pressure: tag.pressure || '0',
            foot: tag.foot || 'Right'
          };
        } else {
          // Pitch analysis - coordinates are already in the correct format
          // Just ensure position is a string value and add required fields if missing
          
          // Handle position string
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
          // This maps actions to their visual representation
          let renderType = '';
          const action = tag.action?.toLowerCase().trim() || '';
          
          if (action === 'free' || action === 'fortyfive' || action === 'offensive mark') {
            renderType = 'setplayscore'; // Green with white ring
          } else if (action.includes('free') && (action.includes('miss') || action.includes('wide') || action.includes('short'))) {
            renderType = 'setplaymiss'; // Red with white ring
          } else if (action === 'goal' || action === 'penalty goal') {
            renderType = action; // Yellow
          } else if (action === 'point') {
            renderType = 'point'; // Green
          } else if (action.includes('miss') || action.includes('wide') || action.includes('short')) {
            renderType = 'miss'; // Red
          } else if (action.includes('block')) {
            renderType = 'blocked'; // Orange
          } else {
            // Default fallback
            renderType = action;
          }
          
          return {
            ...tag,
            position: positionStr,
            distMeters: distMeters || 30, // Default if missing
            side: tag.side || (tag.x <= halfLineX ? 'Left' : 'Right'),
            distanceFromGoal: tag.distanceFromGoal || distMeters || 30,
            pressure: tag.pressure || '0',
            foot: tag.foot || 'Right',
            renderType: renderType // Add renderType for proper coloring
          };
        }
      })
    };
    
    // Navigate to analysis with this game's data
    const dataForAnalysis = {
      datasetName: game.datasetName,
      games: [processedGame]
    };
    
    navigate('/analysis/gaa-dashboard', { 
      state: { 
        file: dataForAnalysis, 
        sport: game.sport || 'GAA'
      } 
    });
  };
  
  // AI analysis (locked feature)
  const handleAIAnalysis = (e) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    
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
      
      {/* Action buttons */}
      <div className="game-actions">
        {/* Dataset Analysis Button */}
        <button
          className="action-btn analyze"
          onClick={handleDatasetAnalysis}
          title="Open in Data Analysis"
        >
          <InsightsIcon style={{ fontSize: 16 }} />
        </button>
        
        {/* AI Analysis Button (Locked) */}
        <button
          className="action-btn ai"
          onClick={handleAIAnalysis}
          title="AI Analysis (Premium)"
        >
          <AutoAwesomeIcon style={{ fontSize: 14 }} />
          <div className="premium-dot"></div>
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

/**
 * Builds the same navigation-state object that SavedGames.js uses
 * so ManualTagging (or PitchGraphic) can boot up instantly.
 */
const buildVideoNavState = (game) => {
  // GAA pitch dimensions and goal positions used in the analysis dashboard
  const pitchWidth = 145;  // Width of pitch in meters
  const pitchHeight = 88;  // Height of pitch in meters
  const halfLineX = pitchWidth / 2;
  const goalY = pitchHeight / 2;

  return {
    youtubeUrl: game.youtubeUrl,
    sport:      game.sport,
    datasetName: game.datasetName,
    teamsData:   game.teamsData,
    tags: game.gameData.map((tag) => {
      // Extract and normalize coordinates
      const rawX = parseFloat(tag.x) || 50;
      const rawY = parseFloat(tag.y) || 50;
      
      // Normalize coordinates to match the analysis dashboard's 145×88 meter pitch
      // Convert from percentages (0-100) to meters
      const normalizedX = (rawX / 100) * pitchWidth;
      const normalizedY = (rawY / 100) * pitchHeight;
      
      // Determine which goal the shot is targeting based on x position
      const isLeftSide = normalizedX <= halfLineX;
      const targetGoalX = isLeftSide ? 0 : pitchWidth;
      
      // Calculate distance to goal - required for proper positioning in analysis
      const dx = normalizedX - targetGoalX;
      const dy = normalizedY - goalY;
      const distToGoal = Math.sqrt(dx * dx + dy * dy);
      
      return {
        id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: tag.timestamp,
        category:  tag.category || 'Unknown',
        action:    tag.action,
        team:      tag.team,
        player:    tag.playerName,
        outcome:   tag.outcome,
        
        // Store position as a string value for compatibility with analysis dashboard
        position: tag.position || 'forward',
        
        // Store coordinates using the normalized values in meters
        x: normalizedX,
        y: normalizedY,
        
        // Add these properties required for proper analysis visualization
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

const DashboardHome = ({ selectedSport }) => {
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
      // -- normalize gameData into an array --
      const normalizedCoords = Array.isArray(game.gameData)
        ? game.gameData
        : Object.values(game.gameData || {});
      
      // pass only the coords array into context
      setLoadedCoords(normalizedCoords);
      
      navigate('/pitch', { state: { gameLoaded: true } });
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

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h3>{selectedSport} Dashboard</h3>
        <p className="dashboard-subtitle">
          Track, analyze, and visualize performance metrics for your {selectedSport} matches.
        </p>
      </div>

      <div className="feature-grid">
        {/* Pitch Analysis */}
        <FeatureCard
          icon={FaMapMarkedAlt}
          title="Pitch Analysis"
          blurb="Tag events directly on a virtual pitch. Analyze player movements and team formations in real-time."
          cta="Open Pitch Tool"
          onClick={() => navigate('/pitch')}
        />

        {/* Video Analysis */}
        <FeatureCard
          icon={FaVideo}
          title="Video Analysis"
          blurb="Upload or load match footage for detailed video analysis. Tag plays, track player movements, and identify key moments."
          cta="Open Video Tool"
          onClick={() => navigate('/video')}
        />

        {/* Data Hub */}
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
          {/* Recent Pitch Sessions */}
          <div className="dashboard-column">
            <RecentList
              title="Recent Pitch Sessions"
              games={recentPitch}
              empty="No recent pitch analysis sessions found. Start a new session to see it here."
              onSelect={loadGame}
            />
          </div>

          {/* Recent Video Sessions */}
          <div className="dashboard-column">
            <RecentList
              title="Recent Video Sessions"
              games={recentVideo}
              empty="No recent video analysis sessions found. Upload a video to get started."
              onSelect={loadGame}
            />
          </div>

          {/* Data Hub Statistics */}
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