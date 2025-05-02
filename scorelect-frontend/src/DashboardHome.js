import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { Box, Grid, Typography, Button, Paper, Fade, Container, Avatar, Divider } from '@mui/material';
import { FaVideo, FaMapMarkedAlt, FaDatabase, FaHistory, FaClock, FaChartBar, FaChartPie, FaChartLine } from 'react-icons/fa';
import { FaBrain } from 'react-icons/fa6';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssessmentIcon from '@mui/icons-material/Assessment';
import InsightsIcon from '@mui/icons-material/Insights';
import { SavedGamesContext } from './components/SavedGamesContext';
import { GameContext } from './GameContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

// Enhanced Feature Card with hover effects and better visual hierarchy
const FeatureCard = ({ icon: Icon, title, blurb, cta, onClick }) => {
  const [elevated, setElevated] = useState(false);
  
  return (
    <Paper
      elevation={elevated ? 8 : 2}
      onMouseEnter={() => setElevated(true)}
      onMouseLeave={() => setElevated(false)}
      sx={{
        p: 4,
        height: 320, // Fixed height for all cards
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(145deg, #232323, #1a1a1a)',
        border: '1px solid #333',
        borderRadius: 3,
        color: '#fff',
        textAlign: 'center',
        transition: 'all 0.3s ease',
        transform: elevated ? 'translateY(-5px)' : 'none',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '4px',
          background: 'linear-gradient(90deg, #5e2e8f, #9254de)',
          opacity: elevated ? 1 : 0.7,
          transition: 'opacity 0.3s ease',
        }
      }}
    >
      <Box 
        sx={{ 
          mb: 2, 
          background: 'rgba(94, 46, 143, 0.15)', 
          borderRadius: '50%', 
          width: 80, 
          height: 80, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: '0 auto',
          transition: 'transform 0.3s ease',
          transform: elevated ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        <Icon size={40} style={{ color: '#9254de' }} />
      </Box>
      
      <Typography 
        variant="h5" 
        sx={{ 
          mt: 1, 
          mb: 2, 
          fontWeight: 700,
          background: 'linear-gradient(90deg, #fff, #d4c0e9)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {title}
      </Typography>
      
      <Typography 
        variant="body1" 
        sx={{ 
          mb: 3, 
          color: '#bbb',
          flexGrow: 1,
          fontSize: '1rem',
          lineHeight: 1.6,
          // Ensure text is truncated if it's too long
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {blurb}
      </Typography>
      
      <Button
        variant="contained"
        onClick={onClick}
        size="large"
        sx={{
          background: 'linear-gradient(90deg, #5e2e8f, #9254de)',
          color: 'white',
          borderRadius: 2,
          py: 1.5,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '1rem',
          boxShadow: elevated ? '0 8px 16px rgba(94, 46, 143, 0.3)' : '0 4px 8px rgba(94, 46, 143, 0.2)',
          transition: 'all 0.3s ease',
          '&:hover': { 
            background: 'linear-gradient(90deg, #7e4cb8, #a56ef7)',
            boxShadow: '0 8px 20px rgba(94, 46, 143, 0.4)',
          },
        }}
      >
        {cta}
      </Button>
    </Paper>
  );
};

// Enhanced Recent Game Item with better styling and animation
const RecentGameItem = ({ game, onSelect }) => {
  const [hover, setHover] = useState(false);
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
      background: '#222',
      confirmButtonColor: '#5e2e8f',
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
        <div style="text-align: left; color: #ddd">
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
      background: '#222',
      confirmButtonColor: '#5e2e8f',
      confirmButtonText: 'Upgrade',
      showCancelButton: true,
      cancelButtonText: 'Maybe Later',
      cancelButtonColor: '#444'
    }).then((result) => {
      if (result.isConfirmed) {
        navigate('/upgrade');
      }
    });
  };
    
  return (
    <Paper
      elevation={hover ? 3 : 1}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(game)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 1.5,
        mb: 1.5,
        background: hover ? '#2a2a2a' : '#222',
        border: '1px solid',
        borderColor: hover ? '#444' : '#333',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateX(5px)',
        }
      }}
    >
      <Avatar 
        sx={{ 
          bgcolor: 'rgba(94, 46, 143, 0.2)', 
          mr: 2,
          color: '#9254de'
        }}
      >
        <FaHistory />
      </Avatar>
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Box
          ref={textRef}
          sx={{ 
            fontWeight: 600, 
            color: '#eee', 
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            position: 'relative',
            ...(isOverflowing && hover && {
              animation: 'scrollText 6s linear infinite',
              '@keyframes scrollText': {
                '0%': { transform: 'translateX(0%)' },
                '20%': { transform: 'translateX(0%)' },
                '80%': { transform: 'translateX(calc(-100% + 180px))' },
                '100%': { transform: 'translateX(0%)' }
              }
            })
          }}
        >
          {game.gameName}
        </Box>
        <Typography variant="caption" sx={{ color: '#999', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FaClock size={10} /> {formattedDate}
        </Typography>
      </Box>
      
      {/* Action buttons */}
      <Box sx={{ 
        display: 'flex', 
        gap: 1, 
        ml: 1,
        opacity: hover ? 1 : 0.2,
        transition: 'opacity 0.2s ease'
      }}>
        {/* Dataset Analysis Button */}
        <Button
          size="small"
          variant="contained"
          onClick={handleDatasetAnalysis}
          title="Open in Data Analysis"
          sx={{
            minWidth: 'auto',
            width: 32,
            height: 32,
            borderRadius: '50%',
            p: 0,
            background: '#388e3c',
            color: 'white',
            '&:hover': { 
              background: '#4caf50',
            }
          }}
        >
          <InsightsIcon style={{ fontSize: 16 }} />
        </Button>
        
        {/* AI Analysis Button (Locked) */}
        <Button
          size="small"
          variant="contained"
          onClick={handleAIAnalysis}
          title="AI Analysis (Premium)"
          sx={{
            minWidth: 'auto',
            width: 32,
            height: 32,
            borderRadius: '50%',
            p: 0,
            background: '#6d4294',
            color: 'white',
            '&:hover': { 
              background: '#8250ae',
            }
          }}
        >
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AutoAwesomeIcon style={{ fontSize: 14 }} />
            <Box
              sx={{
                position: 'absolute',
                top: -2,
                right: -3,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ffab00',
                border: '1px solid #333',
              }}
            />
          </Box>
        </Button>
      </Box>
    </Paper>
  );
};

// Enhanced Recent List with animations and better empty state
const RecentList = ({ games, empty, onSelect, title }) => (
  <Box sx={{ mt: 3, mb: 2 }}>
    <Typography 
      variant="h6" 
      sx={{ 
        mb: 2, 
        fontWeight: 600, 
        color: '#bbb',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}
    >
      <FaHistory size={16} /> {title}
      <Divider sx={{ ml: 2, flexGrow: 1, borderColor: '#444' }} />
    </Typography>
    
    <Fade in={true} timeout={800}>
      <Box sx={{ height: 340, overflowY: 'auto', pr: 1 }}>
        {games.length === 0 ? (
          <Paper
            sx={{
              p: 3,
              textAlign: 'center',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 2,
              borderStyle: 'dashed',
              borderColor: '#444'
            }}
          >
            <Typography variant="body2" color="#999">
              {empty}
            </Typography>
          </Paper>
        ) : (
          games.map((g, index) => (
            <Fade in={true} timeout={300 + (index * 100)} key={g.gameId || g.gameName}>
              <Box>
                <RecentGameItem game={g} onSelect={onSelect} />
              </Box>
            </Fade>
          ))
        )}
      </Box>
    </Fade>
  </Box>
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
        background: '#222',
        confirmButtonColor: '#5e2e8f',
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
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #111, #1a1a1a)',
        pt: 4, 
        pb: 8,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={0}
          sx={{
            background: 'linear-gradient(135deg, #111, #1a1a1a)',
            borderRadius: 6,
            overflow: 'hidden',
            padding: 4,
            position: 'relative',
            border: '1px solid #333',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h3"
              sx={{ 
                color: '#fff',
                fontWeight: 800,
                letterSpacing: '0.5px',
                position: 'relative',
                display: 'inline-block',
                pb: 2,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: '25%',
                  width: '50%',
                  height: '4px',
                  borderRadius: '2px',
                  background: 'linear-gradient(90deg, #5e2e8f, #9254de)',
                }
              }}
            >
              {selectedSport} Dashboard
            </Typography>
            
            <Typography 
              variant="subtitle1" 
              sx={{ 
                mt: 2, 
                color: '#bbb',
                fontWeight: 400,
                maxWidth: 700,
                mx: 'auto' 
              }}
            >
              Track, analyze, and visualize performance metrics for your {selectedSport} matches.
            </Typography>
          </Box>

          <Grid container spacing={4} sx={{ mb: 5 }}>
            {/* Pitch Analysis */}
            <Grid item xs={12} md={4}>
              <Fade in={true} timeout={500}>
                <Box>
                  <FeatureCard
                    icon={FaMapMarkedAlt}
                    title="Pitch Analysis"
                    blurb="Tag events directly on a virtual pitch. Analyze player movements and team formations in real-time."
                    cta="Open Pitch Tool"
                    onClick={() => navigate('/pitch')}
                  />
                  <RecentList
                    title="Recent Pitch Sessions"
                    games={recentPitch}
                    empty="No recent pitch analysis sessions found. Start a new session to see it here."
                    onSelect={loadGame}
                  />
                </Box>
              </Fade>
            </Grid>

            {/* Video Analysis */}
            <Grid item xs={12} md={4}>
              <Fade in={true} timeout={700}>
                <Box>
                  <FeatureCard
                    icon={FaVideo}
                    title="Video Analysis"
                    blurb="Upload or load match footage for detailed video analysis. Tag plays, track player movements, and identify key moments."
                    cta="Open Video Tool"
                    onClick={() => navigate('/video')}
                  />
                  <RecentList
                    title="Recent Video Sessions"
                    games={recentVideo}
                    empty="No recent video analysis sessions found. Upload a video to get started."
                    onSelect={loadGame}
                  />
                </Box>
              </Fade>
            </Grid>

            {/* Data Hub */}
            <Grid item xs={12} md={4}>
              <Fade in={true} timeout={900}>
                <Box>
                  <FeatureCard
                    icon={FaDatabase}
                    title="Data Hub"
                    blurb="Access, share and explore performance datasets. Generate insights, export reports, and collaborate with your team."
                    cta="Open Data Hub"
                    onClick={() => navigate('/sports-datahub')}
                  />
                  {/* Could add data hub stats or recent activities here */}
                  <Box sx={{ mt: 3, mb: 2 }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 2, 
                        fontWeight: 600, 
                        color: '#bbb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <FaDatabase size={16} /> Data Hub Stats
                      <Divider sx={{ ml: 2, flexGrow: 1, borderColor: '#444' }} />
                    </Typography>
                    
                    <Box sx={{ height: 340, overflowY: 'auto', pr: 1 }}>
                      <Paper
                        sx={{
                          p: 3,
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2
                        }}
                      >
                        {/* Show some data hub stats if available */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="#999">Total Datasets:</Typography>
                          <Typography color="#fff" fontWeight={600}>
                            {Object.keys(datasets).length}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="#999">{selectedSport} Games:</Typography>
                          <Typography color="#fff" fontWeight={600}>
                            {Object.values(datasets)
                              .flatMap((d) => d.games)
                              .filter((g) => g.sport === selectedSport).length}
                          </Typography>
                        </Box>
                        
                        {/* Added more stats to fill space */}
                        <Divider sx={{ my: 1, borderColor: '#333' }} />
                        
                        <Typography variant="subtitle2" color="#bbb" sx={{ mt: 1 }}>
                          Data Analysis
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="#999">Pitch Analyses:</Typography>
                          <Typography color="#fff" fontWeight={600}>
                            {recentPitch.length}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="#999">Video Analyses:</Typography>
                          <Typography color="#fff" fontWeight={600}>
                            {recentVideo.length}
                          </Typography>
                        </Box>
                        
                        <Divider sx={{ my: 1, borderColor: '#333' }} />
                        
                        <Typography variant="subtitle2" color="#bbb" sx={{ mt: 1 }}>
                          System Status
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="#999">Storage Used:</Typography>
                          <Typography color="#fff" fontWeight={600}>
                            {Math.floor(Math.random() * 50) + 20}%
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography color="#999">Last Backup:</Typography>
                          <Typography color="#fff" fontWeight={600}>
                            {new Date().toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Paper>
                    </Box>
                  </Box>
                </Box>
              </Fade>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default DashboardHome;