import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Alert,
  LinearProgress,
  Tooltip,
  Switch,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Label as LabelIcon,
  SmartToy as SmartToyIcon,
  School as SchoolIcon,
  Dataset as DatasetIcon,
  CropFree as CropFreeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  CloudUpload as CloudUploadIcon,
  Analytics as AnalyticsIcon,
  Timeline as TimelineIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import YouTube from 'react-youtube';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { Stage, Layer, Circle, Rect, Line } from 'react-konva';
import LocationOnIcon from '@mui/icons-material/LocationOn';

// Styled Components
const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: '#0a0a0a',
  color: '#fff',
  padding: theme.spacing(3),
}));

const TrainingCard = styled(Card)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  border: '1px solid #333',
  marginBottom: theme.spacing(2),
  '& .MuiCardContent-root': {
    padding: theme.spacing(2),
  },
}));

const BoundingBox = styled(Box)(({ selected, category }) => ({
  position: 'absolute',
  border: `3px solid ${
    selected ? '#ff00ff' :
    category === 'player' ? '#00ff00' :
    category === 'ball' ? '#ff0000' :
    category === 'referee' ? '#ffff00' :
    category === 'goal' ? '#00ffff' :
    '#ffffff'
  }`,
  borderRadius: '4px',
  cursor: 'pointer',
  backgroundColor: selected ? 'rgba(255, 0, 255, 0.1)' : 'transparent',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: '4px'
  },
  '&::after': {
    content: `"${category}"`,
    position: 'absolute',
    top: '-25px',
    left: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    padding: '2px 8px',
    fontSize: '12px',
    borderRadius: '3px',
    whiteSpace: 'nowrap'
  }
}));

const ProgressMetric = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: 'rgba(40, 167, 69, 0.1)',
  border: '1px solid #28a745',
  borderRadius: theme.shape.borderRadius,
  textAlign: 'center',
  '& .metric-value': {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#28a745',
  },
  '& .metric-label': {
    fontSize: '0.875rem',
    color: '#aaa',
    marginTop: theme.spacing(0.5),
  },
}));

// Training model types and configurations
const MODEL_TYPES = {
  general: {
    name: 'General Soccer Model',
    description: 'Detect all objects and actions for comprehensive analysis',
    icon: '⚽',
    classes: [
      { id: 'player', name: 'Player', color: '#00ff00', priority: 'high' },
      { id: 'ball', name: 'Ball', color: '#ff0000', priority: 'critical' },
      { id: 'referee', name: 'Referee', color: '#ffff00', priority: 'medium' },
      { id: 'goal', name: 'Goal', color: '#00ffff', priority: 'high' },
      { id: 'goalkeeper', name: 'Goalkeeper', color: '#ff8800', priority: 'high' },
      { id: 'coach', name: 'Coach', color: '#8800ff', priority: 'low' },
      { id: 'substitutes', name: 'Substitutes', color: '#ff0088', priority: 'low' }
    ],
    actions: ['pass', 'shot', 'dribble', 'tackle', 'corner', 'throw-in', 'foul'],
    guidance: {
      title: 'Building a General Soccer Model',
      steps: [
        'Annotate 200+ frames with all visible players',
        'Mark ball position in every frame where visible',
        'Include diverse scenarios: corners, free kicks, penalties',
        'Balance day/night games and different camera angles',
        'Export in COCO format for maximum compatibility'
      ],
      tips: [
        'Focus on ball detection accuracy - it\'s the most critical',
        'Include frames with partial occlusion of players',
        'Mark goalkeepers differently from field players',
        'Annotate crowd scenes to reduce false positives'
      ]
    },
    requiredFrames: 500,
    recommendedRatio: { player: 0.6, ball: 0.8, goalkeeper: 0.1 }
  },
  shooting: {
    name: 'Shot Detection Model',
    description: 'Specialized for detecting shots, goals, and shooting scenarios',
    icon: '🥅',
    classes: [
      { id: 'shooter', name: 'Shooting Player', color: '#ff0000', priority: 'critical' },
      { id: 'ball', name: 'Ball', color: '#ffff00', priority: 'critical' },
      { id: 'goal', name: 'Goal Area', color: '#00ffff', priority: 'critical' },
      { id: 'goalkeeper', name: 'Goalkeeper', color: '#ff8800', priority: 'high' },
      { id: 'defender', name: 'Defending Player', color: '#0088ff', priority: 'medium' }
    ],
    actions: ['shot', 'goal', 'save', 'blocked_shot', 'penalty', 'free_kick_shot'],
    guidance: {
      title: 'Building a Shot Detection Model',
      steps: [
        'Focus on penalty area and goal box annotations',
        'Mark ball trajectory during shot sequences',
        'Annotate shooter\'s body position and foot contact',
        'Include goalkeeper position and reaction timing',
        'Export 3-second clips around each shot for temporal training'
      ],
      tips: [
        'Capture the moment just before, during, and after shot',
        'Include blocked shots and saves for complete coverage',
        'Mark different shot types: headers, volleys, penalties',
        'Annotate goal area boundaries precisely'
      ]
    },
    requiredFrames: 300,
    recommendedRatio: { shooter: 0.9, ball: 1.0, goal: 0.8 },
    sequenceLength: 3, // seconds
    exportSequences: true
  },
  passing: {
    name: 'Passing & Possession Model',
    description: 'Optimize for pass detection, player positioning, and ball movement',
    icon: '🤝',
    classes: [
      { id: 'passer', name: 'Passing Player', color: '#00ff00', priority: 'critical' },
      { id: 'receiver', name: 'Receiving Player', color: '#0088ff', priority: 'critical' },
      { id: 'ball', name: 'Ball', color: '#ff0000', priority: 'critical' },
      { id: 'teammate', name: 'Teammate', color: '#88ff88', priority: 'medium' },
      { id: 'opponent', name: 'Opponent', color: '#ff8888', priority: 'medium' }
    ],
    actions: ['pass', 'cross', 'through_ball', 'back_pass', 'interception', 'possession'],
    guidance: {
      title: 'Building a Passing Model',
      steps: [
        'Annotate ball position throughout pass sequences',
        'Mark passer at moment of ball contact',
        'Identify intended receiver and nearby players',
        'Track ball movement path between players',
        'Include failed passes and interceptions'
      ],
      tips: [
        'Focus on midfield passing combinations',
        'Include different pass types: short, long, crosses',
        'Mark player orientation and body position',
        'Annotate pressure situations and quick passes'
      ]
    },
    requiredFrames: 400,
    recommendedRatio: { passer: 0.8, receiver: 0.8, ball: 1.0 },
    sequenceLength: 2,
    exportSequences: true
  },
  defensive: {
    name: 'Defensive Actions Model',
    description: 'Specialized for tackles, interceptions, and defensive positioning',
    icon: '🛡️',
    classes: [
      { id: 'defender', name: 'Defending Player', color: '#0088ff', priority: 'critical' },
      { id: 'attacker', name: 'Attacking Player', color: '#ff0000', priority: 'critical' },
      { id: 'ball', name: 'Ball', color: '#ffff00', priority: 'critical' },
      { id: 'support_defender', name: 'Support Defender', color: '#4444ff', priority: 'medium' }
    ],
    actions: ['tackle', 'interception', 'clearance', 'block', 'foul', 'pressure'],
    guidance: {
      title: 'Building a Defensive Model',
      steps: [
        'Focus on 1v1 defensive situations',
        'Mark timing of tackle attempts',
        'Annotate successful vs unsuccessful tackles',
        'Include ball recovery scenarios',
        'Track defensive line positioning'
      ],
      tips: [
        'Capture the critical moment of contact',
        'Include slide tackles and standing tackles',
        'Mark defensive pressure without ball contact',
        'Annotate team defensive shape'
      ]
    },
    requiredFrames: 250,
    recommendedRatio: { defender: 0.9, attacker: 0.9, ball: 0.8 },
    sequenceLength: 2.5,
    exportSequences: true
  }
};

// Soccer Pitch Selector Component
const SoccerPitchSelector = ({ currentPosition, setCurrentPosition }) => {
  const aspectRatio = 105 / 68;
  const stageRef = useRef(null);
  const [dimensions, setDimensions] = useState({
    width: 525,
    height: 340,
  });

  useEffect(() => {
    const checkSize = () => {
      if (stageRef.current) {
        const container = stageRef.current.container();
        if (container && container.offsetWidth) {
          const containerWidth = container.offsetWidth;
          const stageWidth = Math.min(containerWidth * 0.9, 525);
          setDimensions({
            width: stageWidth,
            height: stageWidth / aspectRatio
          });
        }
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleStageClick = (e) => {
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    
    const newPosition = {
      x: (pointerPosition.x / stage.width()) * 100,
      y: (pointerPosition.y / stage.height()) * 100
    };
    
    setCurrentPosition(newPosition);
  };

  // Simplified pitch rendering
  const renderPitch = () => {
    const width = dimensions.width;
    const height = dimensions.height;
    const lineColor = '#FFFFFF';
    const pitchColor = '#1D6E1D';
    
    return (
      <>
        {/* Pitch background */}
        <Rect x={0} y={0} width={width} height={height} fill={pitchColor} />
        
        {/* Pitch outline */}
        <Rect x={10} y={10} width={width-20} height={height-20} stroke={lineColor} strokeWidth={2} fill="transparent" />
        
        {/* Center line */}
        <Line points={[width/2, 10, width/2, height-10]} stroke={lineColor} strokeWidth={2} />
        
        {/* Center circle */}
        <Circle x={width/2} y={height/2} radius={50} stroke={lineColor} strokeWidth={2} fill="transparent" />
        
        {/* Penalty areas */}
        <Rect x={10} y={height/2-60} width={60} height={120} stroke={lineColor} strokeWidth={2} fill="transparent" />
        <Rect x={width-70} y={height/2-60} width={60} height={120} stroke={lineColor} strokeWidth={2} fill="transparent" />
        
        {/* Goal areas */}
        <Rect x={10} y={height/2-30} width={25} height={60} stroke={lineColor} strokeWidth={2} fill="transparent" />
        <Rect x={width-35} y={height/2-30} width={25} height={60} stroke={lineColor} strokeWidth={2} fill="transparent" />
      </>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Typography variant="h6" sx={{ color: '#fff' }}>
        Click on the pitch to mark event location
      </Typography>
      <Stage 
        ref={stageRef}
        width={dimensions.width} 
        height={dimensions.height} 
        onClick={handleStageClick}
        style={{ 
          border: '2px solid white',
          borderRadius: '8px',
          cursor: 'pointer',
          backgroundColor: '#1D6E1D'
        }}
      >
        <Layer>
          {renderPitch()}
          
          {/* Position marker */}
          <Circle
            x={(currentPosition.x / 100) * dimensions.width}
            y={(currentPosition.y / 100) * dimensions.height}
            radius={6}
            fill="#ff0000"
            stroke="#ffffff"
            strokeWidth={2}
          />
        </Layer>
      </Stage>
      <Typography variant="body2" sx={{ color: '#aaa' }}>
        Position: X: {currentPosition.x.toFixed(1)}%, Y: {currentPosition.y.toFixed(1)}%
      </Typography>
    </Box>
  );
};

// Add before the main component return
const PitchPositionDialog = ({ open, onClose, position, setPosition, annotation, updateAnnotationPosition }) => {
  const [tempPosition, setTempPosition] = useState(position);
  
  useEffect(() => {
    setTempPosition(position);
  }, [position]);
  
  const handleConfirm = () => {
    if (annotation) {
      updateAnnotationPosition(annotation.id, tempPosition);
    } else {
      setPosition(tempPosition);
    }
    onClose();
  };
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { backgroundColor: '#1a1a1a', color: '#fff' } }}
    >
      <DialogTitle>
        {annotation ? 'Update Event Position' : 'Select Position on Pitch'}
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: '#aaa' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <SoccerPitchSelector
          currentPosition={tempPosition}
          setCurrentPosition={setTempPosition}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: '#aaa' }}>Cancel</Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          sx={{ backgroundColor: '#5e2e8f', '&:hover': { backgroundColor: '#7e4cb8' } }}
        >
          Confirm Position
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Enhanced Pitch Display Component with better styling
const PitchEventDisplay = ({ annotations, selectedModelType, videoDuration, currentTime, handleJumpToTag, updateAnnotationPosition }) => {
  const width = 580;
  const height = 370;
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draggedAnnotation, setDraggedAnnotation] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    setMousePos({ x: point.x, y: point.y });
  };
  
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const handleDragStart = (annotation) => {
    setDraggedAnnotation(annotation);
    setIsDragging(true);
    setHoveredAnnotation(null);
  };

  const handleDragEnd = (e, annotation) => {
    const stage = e.target.getStage();
    const newPosition = {
      x: (e.target.x() / width) * 100,
      y: (e.target.y() / height) * 100
    };
    
    // Ensure position is within bounds
    newPosition.x = Math.max(0, Math.min(100, newPosition.x));
    newPosition.y = Math.max(0, Math.min(100, newPosition.y));
    
    updateAnnotationPosition(annotation.id, newPosition);
    setDraggedAnnotation(null);
    setIsDragging(false);
  };
  
  return (
    <TrainingCard>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOnIcon /> Event Locations on Pitch
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, position: 'relative' }}>
          <Stage 
            width={width} 
            height={height} 
            style={{ 
              border: '2px solid #333',
              borderRadius: '8px',
              backgroundColor: '#0d4f0d',
              cursor: isDragging ? 'grabbing' : 'default'
            }}
            onMouseMove={handleMouseMove}
          >
            <Layer>
              {/* Pitch background with stripes */}
              <Rect x={0} y={0} width={width} height={height} fill="#0d4f0d" />
              
              {/* Grass stripes */}
              {[...Array(10)].map((_, i) => (
                <Rect 
                  key={i} 
                  x={i * (width/10)} 
                  y={0} 
                  width={width/10} 
                  height={height} 
                  fill={i % 2 === 0 ? "#0d4f0d" : "#0f5a0f"} 
                />
              ))}
              
              {/* Pitch outline */}
              <Rect x={20} y={20} width={width-40} height={height-40} stroke="#fff" strokeWidth={3} fill="transparent" />
              
              {/* Center line */}
              <Line points={[width/2, 20, width/2, height-20]} stroke="#fff" strokeWidth={3} />
              
              {/* Center circle */}
              <Circle x={width/2} y={height/2} radius={60} stroke="#fff" strokeWidth={3} fill="transparent" />
              <Circle x={width/2} y={height/2} radius={5} fill="#fff" />
              
              {/* Penalty areas */}
              <Rect x={20} y={height/2-80} width={100} height={160} stroke="#fff" strokeWidth={3} fill="transparent" />
              <Rect x={width-120} y={height/2-80} width={100} height={160} stroke="#fff" strokeWidth={3} fill="transparent" />
              
              {/* Goal areas */}
              <Rect x={20} y={height/2-40} width={50} height={80} stroke="#fff" strokeWidth={3} fill="transparent" />
              <Rect x={width-70} y={height/2-40} width={50} height={80} stroke="#fff" strokeWidth={3} fill="transparent" />
              
              {/* Penalty spots */}
              <Circle x={90} y={height/2} radius={3} fill="#fff" />
              <Circle x={width-90} y={height/2} radius={3} fill="#fff" />
              
              {/* Position markers for all annotations */}
              {annotations.map((annotation, idx) => {
                const position = annotation.pitchPosition || { x: 50, y: 50 };
                const classInfo = selectedModelType?.classes.find(cls => cls.id === annotation.class);
                const isCurrentFrame = Math.abs(annotation.timestamp - currentTime) < 0.5;
                const isBeingDragged = draggedAnnotation?.id === annotation.id;
                
                return (
                  <Circle
                    key={annotation.id}
                    x={(position.x / 100) * width}
                    y={(position.y / 100) * height}
                    radius={isCurrentFrame ? 8 : 6}
                    fill={classInfo?.color || '#ff0000'}
                    stroke="#fff"
                    strokeWidth={isCurrentFrame ? 3 : 2}
                    opacity={isBeingDragged ? 0.7 : (isCurrentFrame ? 1 : 0.6)}
                    shadowBlur={isCurrentFrame ? 10 : 0}
                    shadowColor={classInfo?.color || '#ff0000'}
                    draggable
                    onDragStart={() => handleDragStart(annotation)}
                    onDragEnd={(e) => handleDragEnd(e, annotation)}
                    onMouseEnter={(e) => {
                      if (!isDragging) {
                        const container = e.target.getStage().container();
                        container.style.cursor = 'grab';
                        setHoveredAnnotation(annotation);
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDragging) {
                        const container = e.target.getStage().container();
                        container.style.cursor = 'default';
                        setHoveredAnnotation(null);
                      }
                    }}
                    onDblClick={() => handleJumpToTag(annotation.timestamp)}
                  />
                );
              })}
            </Layer>
          </Stage>
          
          {/* Tooltip */}
          {hoveredAnnotation && !isDragging && (
            <Box
              sx={{
                position: 'absolute',
                left: mousePos.x,
                top: mousePos.y - 70,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 1000,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  marginLeft: '-5px',
                  borderWidth: '5px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(0, 0, 0, 0.9) transparent transparent transparent',
                }
              }}
            >
              <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {selectedModelType?.classes.find(cls => cls.id === hoveredAnnotation.class)?.name || hoveredAnnotation.class}
              </Box>
              <Box sx={{ fontSize: '0.75rem', color: '#ccc' }}>
                Time: {formatTime(hoveredAnnotation.timestamp)}
              </Box>
              <Box sx={{ fontSize: '0.75rem', color: '#ccc' }}>
                Position: X:{hoveredAnnotation.pitchPosition?.x.toFixed(0)}%, Y:{hoveredAnnotation.pitchPosition?.y.toFixed(0)}%
              </Box>
              <Box sx={{ fontSize: '0.625rem', color: '#888', mt: 0.5 }}>
                Drag to move • Double-click to jump
              </Box>
            </Box>
          )}
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {annotations.length === 0 
            ? "No events tagged yet. Tagged events will appear on the pitch." 
            : `${annotations.length} total events tagged. Drag markers to reposition • Double-click to jump to frame`
          }
        </Typography>
      </CardContent>
    </TrainingCard>
  );
};

const AITrainingModelArena = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const videoFile = location.state?.file;
  const youtubeUrl = location.state?.youtubeUrl;
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  
  // State
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  
  // Training state
  const [annotations, setAnnotations] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentDraw, setCurrentDraw] = useState(null);
  const [selectedClass, setSelectedClass] = useState('player');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  
  // Pitch coordinate state
  const [showPitchSelector, setShowPitchSelector] = useState(false);
  const [currentPitchPosition, setCurrentPitchPosition] = useState({ x: 50, y: 50 });
  
  // Training progress
  const [trainingStats, setTrainingStats] = useState({
    totalFrames: 0,
    annotatedFrames: 0,
    totalAnnotations: 0,
    classDistribution: {}
  });
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(true);
  const [selectedModelType, setSelectedModelType] = useState(null);
  const [exportFormat, setExportFormat] = useState('yolo');
  const [activeStep, setActiveStep] = useState(0);
  
  // Training steps - dynamic based on model type
  const getTrainingSteps = () => {
    if (!selectedModelType) {
      return [
        { label: 'Choose Model Type', description: 'Select your training objective and model specialization' }
      ];
    }
    
    const baseSteps = [
      { label: 'Setup Video', description: 'Load and prepare your training video' },
      { label: 'Create Annotations', description: 'Draw bounding boxes and label objects' },
      { label: 'Review & Validate', description: 'Check your annotations for accuracy' },
      { label: 'Export Dataset', description: 'Download training data in your preferred format' }
    ];
    
    if (selectedModelType.exportSequences) {
      baseSteps.splice(3, 0, { 
        label: 'Generate Sequences', 
        description: 'Create action clips for temporal training' 
      });
    }
    
    return baseSteps;
  };

  // Initialize video and model selection
  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (youtubeUrl) {
      // For YouTube, we can proceed to model selection
    }
    
    // If we have video but no model selected, show model selector
    if ((videoFile || youtubeUrl) && !selectedModelType) {
      setShowModelSelector(true);
      setActiveStep(0);
    } else if (selectedModelType) {
      setActiveStep(1);
      setShowModelSelector(false);
    }
  }, [videoFile, youtubeUrl, selectedModelType]);

  // Update training stats with model-specific recommendations
  useEffect(() => {
    const frameMap = new Map();
    const classCount = {};
    
    annotations.forEach(ann => {
      frameMap.set(ann.frame, true);
      classCount[ann.class] = (classCount[ann.class] || 0) + 1;
    });
    
    const stats = {
      totalFrames: Math.floor(videoDuration * 30), // Assuming 30 FPS
      annotatedFrames: frameMap.size,
      totalAnnotations: annotations.length,
      classDistribution: classCount
    };
    
    // Add model-specific progress indicators
    if (selectedModelType) {
      stats.progressPercentage = (stats.annotatedFrames / selectedModelType.requiredFrames) * 100;
      stats.isComplete = stats.annotatedFrames >= selectedModelType.requiredFrames;
      
      // Check class balance based on model requirements
      stats.classBalance = {};
      selectedModelType.classes.forEach(cls => {
        const current = classCount[cls.id] || 0;
        const target = Math.floor(selectedModelType.requiredFrames * (selectedModelType.recommendedRatio[cls.id] || 0.3));
        stats.classBalance[cls.id] = {
          current,
          target,
          percentage: target > 0 ? (current / target) * 100 : 0,
          status: current >= target ? 'complete' : current >= target * 0.7 ? 'good' : 'needs_work'
        };
      });
    }
    
    setTrainingStats(stats);
  }, [annotations, videoDuration, selectedModelType]);

  // Get YouTube video ID
  const getYouTubeVideoId = (url) => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Handle video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      setCurrentFrame(Math.floor(time * 30)); // 30 FPS
    }
  };

  // Handle YouTube ready
  const onYouTubeReady = (event) => {
    setYoutubePlayer(event.target);
    setVideoDuration(event.target.getDuration());
  };

  // Drawing handlers with improved canvas support
  const handleMouseDown = (e) => {
    if (!isDrawing) return;
    
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Ensure coordinates are within bounds
    const boundedX = Math.max(0, Math.min(100, x));
    const boundedY = Math.max(0, Math.min(100, y));
    
    setDrawStart({ x: boundedX, y: boundedY });
    setCurrentDraw({ x: boundedX, y: boundedY, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !drawStart) return;
    
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Ensure coordinates are within bounds
    const boundedX = Math.max(0, Math.min(100, x));
    const boundedY = Math.max(0, Math.min(100, y));
    
    // Update current drawing rectangle
    const newDraw = {
      x: Math.min(drawStart.x, boundedX),
      y: Math.min(drawStart.y, boundedY),
      width: Math.abs(boundedX - drawStart.x),
      height: Math.abs(boundedY - drawStart.y)
    };
    
    setCurrentDraw(newDraw);
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !drawStart || !currentDraw) return;
    
    // Only create annotation if box is large enough (minimum 2% width/height)
    if (currentDraw.width > 2 && currentDraw.height > 2) {
      const newAnnotation = {
        id: Date.now(),
        frame: currentFrame,
        timestamp: currentTime,
        class: selectedClass,
        bbox: currentDraw,
        confidence: 1.0, // Manual annotations have full confidence
        verified: true,
        pitchPosition: { ...currentPitchPosition } // Add pitch position
      };
      
      setAnnotations(prev => [...prev, newAnnotation]);
      toast.success(`Added ${selectedClass} annotation`);
      
      if (autoSave) {
        saveToLocalStorage([...annotations, newAnnotation]);
      }
    } else {
      toast.warning('Bounding box too small - draw a larger area');
    }
    
    setDrawStart(null);
    setCurrentDraw(null);
  };

  // Handle mouse leave to prevent drawing issues
  const handleMouseLeave = () => {
    if (isDrawing && drawStart) {
      setDrawStart(null);
      setCurrentDraw(null);
    }
  };

  // Get current frame annotations
  const getCurrentFrameAnnotations = () => {
    return annotations.filter(ann => ann.frame === currentFrame);
  };

  // Delete annotation
  const deleteAnnotation = (annotationId) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
    setSelectedAnnotation(null);
    toast.success('Annotation deleted');
  };

  // Update annotation class
  const updateAnnotationClass = (annotationId, newClass) => {
    setAnnotations(prev => 
      prev.map(ann => 
        ann.id === annotationId ? { ...ann, class: newClass } : ann
      )
    );
    toast.success('Annotation updated');
  };

  // Update annotation position
  const updateAnnotationPosition = (annotationId, newPosition) => {
    setAnnotations(prev => 
      prev.map(ann => 
        ann.id === annotationId ? { ...ann, pitchPosition: newPosition } : ann
      )
    );
    toast.success('Position updated');
  };

  // Handle annotation double click
  const handleAnnotationDoubleClick = (annotation) => {
    setSelectedAnnotation(annotation);
    setCurrentPitchPosition(annotation.pitchPosition || { x: 50, y: 50 });
    setShowPitchSelector(true);
  };

  // Save to localStorage
  const saveToLocalStorage = (data) => {
    try {
      localStorage.setItem('trainingData', JSON.stringify({
        videoName: videoFile?.name || youtubeUrl,
        annotations: data,
        lastSaved: new Date().toISOString(),
        stats: trainingStats
      }));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  };

  // Load from localStorage
  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('trainingData');
      if (saved) {
        const data = JSON.parse(saved);
        setAnnotations(data.annotations || []);
        toast.success('Loaded saved annotations');
        return true;
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    return false;
  };

  // Export training data
  const exportTrainingData = () => {
    if (annotations.length === 0) {
      toast.error('No annotations to export');
      return;
    }

    let exportData;
    const videoName = videoFile?.name || 'youtube_video';
    
    switch (exportFormat) {
      case 'yolo':
        // YOLO format: class_id center_x center_y width height (normalized 0-1)
        exportData = annotations.map(ann => {
          const classId = selectedModelType?.classes.findIndex(cls => cls.id === ann.class) || 0;
          const centerX = (ann.bbox.x + ann.bbox.width / 2) / 100;
          const centerY = (ann.bbox.y + ann.bbox.height / 2) / 100;
          const width = ann.bbox.width / 100;
          const height = ann.bbox.height / 100;
          return `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
        }).join('\n');
        break;
        
      case 'coco':
        // COCO format (simplified)
        exportData = {
          images: [{
            id: 1,
            file_name: videoName,
            width: 1920, // Default resolution
            height: 1080
          }],
          annotations: annotations.map((ann, idx) => ({
            id: idx + 1,
            image_id: 1,
            category_id: (selectedModelType?.classes.findIndex(cls => cls.id === ann.class) || 0) + 1,
            bbox: [
              ann.bbox.x * 19.2, // Convert to pixel coordinates
              ann.bbox.y * 10.8,
              ann.bbox.width * 19.2,
              ann.bbox.height * 10.8
            ],
            area: (ann.bbox.width * 19.2) * (ann.bbox.height * 10.8),
            iscrowd: 0
          })),
          categories: (selectedModelType?.classes || []).map((cls, idx) => ({
            id: idx + 1,
            name: cls.name,
            supercategory: 'object'
          }))
        };
        exportData = JSON.stringify(exportData, null, 2);
        break;
        
      case 'custom':
        // Custom format with all metadata
        exportData = {
          video: {
            name: videoName,
            duration: videoDuration,
            fps: 30
          },
          classes: selectedModelType?.classes || [],
          annotations: annotations,
          stats: trainingStats,
          exported: new Date().toISOString()
        };
        exportData = JSON.stringify(exportData, null, 2);
        break;
        
      default:
        exportData = JSON.stringify(annotations, null, 2);
    }

    // Download file
    const blob = new Blob([exportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training_data_${videoName.replace(/\.[^/.]+$/, '')}_${exportFormat}.${exportFormat === 'yolo' ? 'txt' : 'json'}`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Training data exported in ${exportFormat.toUpperCase()} format`);
    setShowExportDialog(false);
  };

  // Smart annotation suggestions (AI-assisted)
  const generateSmartSuggestions = async () => {
    // This would integrate with your existing AI detection
    toast.info('Smart suggestions coming soon!');
  };

  return (
    <PageContainer>
      <Box sx={{ maxWidth: 1600, margin: '0 auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate(-1)} sx={{ color: '#fff' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SchoolIcon /> AI Training Model Arena
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip 
              label={`${annotations.length} Annotations`} 
              color="success"
              icon={<LabelIcon />}
            />
            <IconButton onClick={() => setShowSettings(true)} sx={{ color: '#fff' }}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Model Selection Dialog */}
        {showModelSelector && (
          <Box sx={{ mb: 3 }}>
            <TrainingCard>
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
                  🎯 Choose Your AI Training Objective
                </Typography>
                <Typography variant="body1" sx={{ textAlign: 'center', mb: 4, color: '#aaa' }}>
                  Select the type of model you want to build for optimized training guidance
                </Typography>
                
                <Grid container spacing={3}>
                  {Object.entries(MODEL_TYPES).map(([key, modelType]) => (
                    <Grid item xs={12} md={6} key={key}>
                      <Card 
                        sx={{ 
                          backgroundColor: '#2a2a2a',
                          border: '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          height: '100%',
                          '&:hover': {
                            borderColor: '#5e2e8f',
                            backgroundColor: '#333'
                          }
                        }}
                        onClick={() => {
                          setSelectedModelType(modelType);
                          setSelectedClass(modelType.classes[0].id);
                          setShowModelSelector(false);
                          setActiveStep(1);
                        }}
                      >
                        <CardContent sx={{ textAlign: 'center', p: 3 }}>
                          <Typography variant="h2" sx={{ mb: 2 }}>
                            {modelType.icon}
                          </Typography>
                          <Typography variant="h6" gutterBottom>
                            {modelType.name}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#aaa', mb: 2 }}>
                            {modelType.description}
                          </Typography>
                          
                          <Box sx={{ mt: 2 }}>
                            <Chip 
                              label={`${modelType.requiredFrames}+ frames needed`}
                              size="small"
                              sx={{ mr: 1, mb: 1 }}
                            />
                            <Chip 
                              label={`${modelType.classes.length} object types`}
                              size="small"
                              sx={{ mr: 1, mb: 1 }}
                            />
                            {modelType.exportSequences && (
                              <Chip 
                                label="Action sequences"
                                size="small"
                                color="success"
                                sx={{ mb: 1 }}
                              />
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </TrainingCard>
          </Box>
        )}

        {/* Progress Stepper */}
        {selectedModelType && (
          <TrainingCard sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Training: {selectedModelType.name} {selectedModelType.icon}
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => setShowModelSelector(true)}
                  sx={{ color: '#aaa', borderColor: '#aaa' }}
                >
                  Change Model Type
                </Button>
              </Box>
              <Stepper activeStep={activeStep} alternativeLabel>
                {getTrainingSteps().map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel>{step.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </TrainingCard>
        )}

        {selectedModelType && !showModelSelector && (
          <Grid container spacing={3}>
            {/* Video Section */}
            <Grid item xs={12} lg={8}>
              <TrainingCard>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Video Training Interface
                  </Typography>
                  
                  {/* Video Player with Annotation Overlay */}
                  <Box sx={{ position: 'relative', backgroundColor: '#000', borderRadius: 1, overflow: 'hidden', mb: 2 }}>
                    {videoFile ? (
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        style={{ width: '100%', height: 'auto' }}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={() => {
                          if (videoRef.current) {
                            setVideoDuration(videoRef.current.duration);
                          }
                        }}
                        controls
                      />
                    ) : youtubeUrl ? (
                      <YouTube
                        videoId={getYouTubeVideoId(youtubeUrl)}
                        opts={{ width: '100%', height: '400' }}
                        onReady={onYouTubeReady}
                      />
                    ) : (
                      <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography>No video loaded</Typography>
                      </Box>
                    )}
                    
                    {/* Annotation Overlay */}
                    {showAnnotations && (
                      <Box
                        ref={overlayRef}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          pointerEvents: isDrawing ? 'auto' : 'none',
                          cursor: isDrawing ? 'crosshair' : 'default'
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                      >
                        {/* Render current frame annotations */}
                        {getCurrentFrameAnnotations().map((annotation) => (
                          <BoundingBox
                            key={annotation.id}
                            selected={selectedAnnotation?.id === annotation.id}
                            category={annotation.class}
                            sx={{
                              left: `${annotation.bbox.x}%`,
                              top: `${annotation.bbox.y}%`,
                              width: `${annotation.bbox.width}%`,
                              height: `${annotation.bbox.height}%`
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnnotation(annotation);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleAnnotationDoubleClick(annotation);
                            }}
                          />
                        ))}
                        
                        {/* Show current drawing rectangle */}
                        {isDrawing && currentDraw && currentDraw.width > 0 && currentDraw.height > 0 && (
                          <Box
                            sx={{
                              position: 'absolute',
                              left: `${currentDraw.x}%`,
                              top: `${currentDraw.y}%`,
                              width: `${currentDraw.width}%`,
                              height: `${currentDraw.height}%`,
                              border: '2px dashed #fff',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              pointerEvents: 'none'
                            }}
                          />
                        )}
                      </Box>
                    )}
                    
                    {/* Frame Info */}
                    <Box sx={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      borderRadius: 1,
                      p: 1
                    }}>
                      <Typography variant="caption" sx={{ color: '#fff' }}>
                        Frame: {currentFrame} | Time: {currentTime.toFixed(2)}s
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Annotation Tools */}
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel sx={{ color: '#aaa' }}>Object Class</InputLabel>
                      <Select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        label="Object Class"
                        sx={{ color: '#fff' }}
                      >
                        {(selectedModelType?.classes || []).map((cls) => (
                          <MenuItem key={cls.id} value={cls.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  backgroundColor: cls.color,
                                  borderRadius: '50%'
                                }}
                              />
                              <Typography sx={{ color: cls.priority === 'critical' ? '#ff6b6b' : cls.priority === 'high' ? '#ffa726' : '#fff' }}>
                                {cls.name}
                              </Typography>
                              {cls.priority === 'critical' && (
                                <Chip label="Critical" size="small" color="error" sx={{ ml: 1, height: 16 }} />
                              )}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <Button
                      variant={isDrawing ? "contained" : "outlined"}
                      startIcon={<CropFreeIcon />}
                      onClick={() => setIsDrawing(!isDrawing)}
                      color={isDrawing ? "success" : "primary"}
                    >
                      {isDrawing ? 'Drawing Mode' : 'Enable Drawing'}
                    </Button>
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showAnnotations}
                          onChange={(e) => setShowAnnotations(e.target.checked)}
                        />
                      }
                      label="Show Annotations"
                    />
                    
                    <Button
                      variant="outlined"
                      startIcon={<SmartToyIcon />}
                      onClick={generateSmartSuggestions}
                      sx={{ color: '#17a2b8', borderColor: '#17a2b8' }}
                    >
                      AI Suggestions
                    </Button>
                    
                    {/* Video Navigation Controls */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                          } else if (youtubePlayer) {
                            youtubePlayer.seekTo(Math.max(0, youtubePlayer.getCurrentTime() - 10));
                          }
                        }}
                        sx={{ 
                          color: '#fff', 
                          border: '1px solid rgba(255,255,255,0.3)',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                        }}
                        title="Back 10 seconds"
                      >
                        <Typography variant="caption">-10s</Typography>
                      </IconButton>
                      
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 1);
                          } else if (youtubePlayer) {
                            youtubePlayer.seekTo(Math.max(0, youtubePlayer.getCurrentTime() - 1));
                          }
                        }}
                        sx={{ 
                          color: '#fff', 
                          border: '1px solid rgba(255,255,255,0.3)',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                        }}
                        title="Back 1 second"
                      >
                        <Typography variant="caption">-1s</Typography>
                      </IconButton>
                      
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.min(videoDuration, videoRef.current.currentTime + 1);
                          } else if (youtubePlayer) {
                            youtubePlayer.seekTo(Math.min(videoDuration, youtubePlayer.getCurrentTime() + 1));
                          }
                        }}
                        sx={{ 
                          color: '#fff', 
                          border: '1px solid rgba(255,255,255,0.3)',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                        }}
                        title="Forward 1 second"
                      >
                        <Typography variant="caption">+1s</Typography>
                      </IconButton>
                      
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.min(videoDuration, videoRef.current.currentTime + 10);
                          } else if (youtubePlayer) {
                            youtubePlayer.seekTo(Math.min(videoDuration, youtubePlayer.getCurrentTime() + 10));
                          }
                        }}
                        sx={{ 
                          color: '#fff', 
                          border: '1px solid rgba(255,255,255,0.3)',
                          '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                        }}
                        title="Forward 10 seconds"
                      >
                        <Typography variant="caption">+10s</Typography>
                      </IconButton>
                    </Box>
                    
                    {/* Pitch Position Button */}
                    <Button
                      variant="outlined"
                      startIcon={<LocationOnIcon />}
                      onClick={() => setShowPitchSelector(true)}
                      sx={{ 
                        color: '#5e2e8f', 
                        borderColor: '#5e2e8f',
                        '&:hover': { 
                          backgroundColor: 'rgba(94, 46, 143, 0.1)',
                          borderColor: '#7e4cb8' 
                        }
                      }}
                    >
                      Pitch Position
                    </Button>
                  </Box>
                </CardContent>
              </TrainingCard>

              {/* Timeline with Annotation Markers */}
              <TrainingCard>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Annotation Timeline
                  </Typography>
                  <Box sx={{ position: 'relative', height: 60, backgroundColor: '#0a0a0a', borderRadius: 1, overflow: 'hidden' }}>
                    {/* Timeline markers for annotated frames */}
                    {annotations.map((annotation, index) => (
                      <Box
                        key={index}
                        sx={{
                          position: 'absolute',
                          left: `${(annotation.timestamp / videoDuration) * 100}%`,
                          width: '3px',
                          height: '100%',
                          backgroundColor: selectedModelType?.classes.find(cls => cls.id === annotation.class)?.color || '#fff',
                          cursor: 'pointer'
                        }}
                        title={`${annotation.class} at ${annotation.timestamp.toFixed(2)}s`}
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = annotation.timestamp;
                          }
                        }}
                      />
                    ))}
                    
                    {/* Current time indicator */}
                    {videoDuration > 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: `${(currentTime / videoDuration) * 100}%`,
                          width: '2px',
                          height: '100%',
                          backgroundColor: '#fff',
                          zIndex: 10
                        }}
                      />
                    )}
                  </Box>
                </CardContent>
              </TrainingCard>
              
              {/* Pitch Event Display */}
              <PitchEventDisplay
                annotations={annotations}
                selectedModelType={selectedModelType}
                videoDuration={videoDuration}
                currentTime={currentTime}
                handleJumpToTag={(time) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = time;
                  } else if (youtubePlayer) {
                    youtubePlayer.seekTo(time, true);
                  }
                  setCurrentTime(time);
                }}
                updateAnnotationPosition={updateAnnotationPosition}
              />
            </Grid>

            {/* Tools & Stats Section */}
            <Grid item xs={12} lg={4}>
              {/* Training Progress */}
              <TrainingCard>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Training Progress
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <ProgressMetric>
                        <div className="metric-value">{trainingStats.annotatedFrames}</div>
                        <div className="metric-label">Annotated Frames</div>
                      </ProgressMetric>
                    </Grid>
                    <Grid item xs={6}>
                      <ProgressMetric>
                        <div className="metric-value">{trainingStats.totalAnnotations}</div>
                        <div className="metric-label">Total Annotations</div>
                      </ProgressMetric>
                    </Grid>
                  </Grid>
                  
                  {/* Class Distribution */}
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                    Class Distribution
                  </Typography>
                  {Object.entries(trainingStats.classDistribution).map(([className, count]) => {
                    const classInfo = selectedModelType?.classes.find(cls => cls.id === className);
                    const percentage = (count / trainingStats.totalAnnotations) * 100;
                    
                    return (
                      <Box key={className} sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                backgroundColor: classInfo?.color || '#fff',
                                borderRadius: '50%'
                              }}
                            />
                            <Typography variant="caption">{classInfo?.name || className}</Typography>
                          </Box>
                          <Typography variant="caption">{count} ({percentage.toFixed(1)}%)</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={percentage}
                          sx={{
                            height: 4,
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: classInfo?.color || '#fff'
                            }
                          }}
                        />
                      </Box>
                    );
                  })}
                </CardContent>
              </TrainingCard>

              {/* Current Frame Annotations */}
              <TrainingCard>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Current Frame ({getCurrentFrameAnnotations().length})
                  </Typography>
                  <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {getCurrentFrameAnnotations().map((annotation) => {
                      const classInfo = selectedModelType?.classes.find(cls => cls.id === annotation.class);
                      
                      return (
                        <ListItem
                          key={annotation.id}
                          selected={selectedAnnotation?.id === annotation.id}
                          onClick={() => setSelectedAnnotation(annotation)}
                          onDoubleClick={() => handleAnnotationDoubleClick(annotation)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <ListItemIcon>
                            <Box
                              sx={{
                                width: 20,
                                height: 20,
                                backgroundColor: classInfo?.color || '#fff',
                                borderRadius: '50%'
                              }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={classInfo?.name || annotation.class}
                            secondary={
                              <>
                                {`${annotation.bbox.width.toFixed(1)}% × ${annotation.bbox.height.toFixed(1)}%`}
                                {annotation.pitchPosition && (
                                  <Typography variant="caption" sx={{ display: 'block', color: '#aaa' }}>
                                    Pitch: X:{annotation.pitchPosition.x.toFixed(0)}%, Y:{annotation.pitchPosition.y.toFixed(0)}%
                                  </Typography>
                                )}
                              </>
                            }
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteAnnotation(annotation.id);
                            }}
                            sx={{ color: '#f44336' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </CardContent>
              </TrainingCard>

              {/* Training Guidance Panel */}
              <TrainingCard>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon /> {selectedModelType.guidance.title}
                  </Typography>
                  
                  <Typography variant="subtitle2" sx={{ mb: 2, color: '#28a745' }}>
                    📋 Training Steps:
                  </Typography>
                  <List dense>
                    {selectedModelType.guidance.steps.map((step, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <Typography variant="body2" sx={{ color: '#5e2e8f', fontWeight: 'bold' }}>
                            {index + 1}.
                          </Typography>
                        </ListItemIcon>
                        <ListItemText 
                          primary={step} 
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: '#17a2b8' }}>
                    💡 Pro Tips:
                  </Typography>
                  <List dense>
                    {selectedModelType.guidance.tips.map((tip, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 30 }}>
                          <Typography variant="body2">💡</Typography>
                        </ListItemIcon>
                        <ListItemText 
                          primary={tip} 
                          primaryTypographyProps={{ variant: 'body2', color: '#aaa' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  {/* Progress Indicator */}
                  <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(94, 46, 143, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Training Progress
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(trainingStats.progressPercentage || 0, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: trainingStats.isComplete ? '#4caf50' : '#5e2e8f'
                        }
                      }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                      {trainingStats.annotatedFrames || 0} / {selectedModelType.requiredFrames} frames annotated
                      {trainingStats.isComplete && (
                        <Chip 
                          label="Ready to Export!" 
                          size="small" 
                          color="success" 
                          sx={{ ml: 1 }} 
                        />
                      )}
                    </Typography>
                  </Box>
                </CardContent>
              </TrainingCard>

              {/* Class Balance Indicator */}
              {selectedModelType && trainingStats.classBalance && (
                <TrainingCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Class Balance Monitor
                    </Typography>
                    {selectedModelType.classes.map((cls) => {
                      const balance = trainingStats.classBalance[cls.id];
                      if (!balance) return null;
                      
                      return (
                        <Box key={cls.id} sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  backgroundColor: cls.color,
                                  borderRadius: '50%'
                                }}
                              />
                              <Typography variant="body2">{cls.name}</Typography>
                              {cls.priority === 'critical' && (
                                <Chip label="Critical" size="small" color="error" sx={{ height: 16 }} />
                              )}
                            </Box>
                            <Typography variant="caption">
                              {balance.current} / {balance.target}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(balance.percentage, 100)}
                            sx={{
                              height: 4,
                              backgroundColor: 'rgba(255,255,255,0.1)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: 
                                  balance.status === 'complete' ? '#4caf50' :
                                  balance.status === 'good' ? '#ff9800' : '#f44336'
                              }
                            }}
                          />
                        </Box>
                      );
                    })}
                  </CardContent>
                </TrainingCard>
              )}

              {/* Actions */}
              <TrainingCard>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<SaveIcon />}
                      onClick={() => saveToLocalStorage(annotations)}
                      sx={{ backgroundColor: '#28a745' }}
                    >
                      Save Training Data
                    </Button>
                    
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<UploadIcon />}
                      onClick={loadFromLocalStorage}
                      sx={{ borderColor: '#17a2b8', color: '#17a2b8' }}
                    >
                      Load Saved Data
                    </Button>
                    
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<DownloadIcon />}
                      onClick={() => setShowExportDialog(true)}
                      disabled={annotations.length === 0}
                      sx={{ backgroundColor: '#5e2e8f' }}
                    >
                      Export Dataset
                    </Button>
                  </Box>
                </CardContent>
              </TrainingCard>
            </Grid>
          </Grid>
        )}

        {/* Export Dialog */}
        <Dialog
          open={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { backgroundColor: '#1a1a1a', color: '#fff' } }}
        >
          <DialogTitle>Export Training Dataset</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Typography gutterBottom>
                Choose the export format for your training dataset:
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel sx={{ color: '#aaa' }}>Export Format</InputLabel>
                <Select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  label="Export Format"
                  sx={{ color: '#fff' }}
                >
                  <MenuItem value="yolo">YOLO Format (.txt)</MenuItem>
                  <MenuItem value="coco">COCO Format (.json)</MenuItem>
                  <MenuItem value="custom">Custom Format (.json)</MenuItem>
                </Select>
              </FormControl>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {exportFormat === 'yolo' && 'YOLO format: class_id center_x center_y width height (normalized)'}
                  {exportFormat === 'coco' && 'COCO format: Standard object detection format with categories and annotations'}
                  {exportFormat === 'custom' && 'Custom format: Includes all metadata, timestamps, and video information'}
                </Typography>
              </Alert>
              
              <Typography variant="body2" color="text.secondary">
                {annotations.length} annotations across {trainingStats.annotatedFrames} frames will be exported.
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowExportDialog(false)}>Cancel</Button>
            <Button onClick={exportTrainingData} variant="contained" sx={{ backgroundColor: '#28a745' }}>
              Export Dataset
            </Button>
          </DialogActions>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog
          open={showSettings}
          onClose={() => setShowSettings(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { backgroundColor: '#1a1a1a', color: '#fff' } }}
        >
          <DialogTitle>Training Settings</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                  />
                }
                label="Auto-save annotations"
              />
              
              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Keyboard Shortcuts
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>• Space: Play/Pause video</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>• D: Toggle drawing mode</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>• Delete: Remove selected annotation</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>• 1-7: Quick class selection</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>• Esc: Cancel current drawing</Typography>
              </Box>
              
              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Drawing Tips
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>• Draw boxes slightly larger than the object</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>• Ensure minimum 2% width/height for valid boxes</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>• Click outside drawing area to cancel</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>• Use different colors for easy identification</Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettings(false)}>Close</Button>
          </DialogActions>
        </Dialog>
        
        {/* Pitch Position Dialog */}
        <PitchPositionDialog
          open={showPitchSelector}
          onClose={() => {
            setShowPitchSelector(false);
            setSelectedAnnotation(null);
          }}
          position={currentPitchPosition}
          setPosition={setCurrentPitchPosition}
          annotation={selectedAnnotation}
          updateAnnotationPosition={updateAnnotationPosition}
        />
      </Box>
    </PageContainer>
  );
};

export default AITrainingModelArena;