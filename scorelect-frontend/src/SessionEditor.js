import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { firestore } from './firebase';
import { doc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import {
  Stage,
  Layer,
  Line,
  Circle,
  Text,
  Image as KonvaImage,
  Group,
  Transformer,
  Rect, 
} from 'react-konva';
import useImage from 'use-image';
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Tooltip,
  Drawer,
  Tabs,
  Tab,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Divider,
  CircularProgress,
  Stack,
  Menu,
  Slider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  FileDownload as ExportIcon,
  ArrowBack as ArrowBackIcon,
  TextFields as TextIcon,
  Square as SquareIcon,
  Image as ImageIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  FormatColorFill as FillIcon,
  BorderColor as StrokeIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  GridOn as GridIcon,
  ViewQuilt as TemplatesIcon,
  ArrowLeft as PrevIcon,
  ArrowRight as NextIcon,
  Fullscreen as FullscreenIcon,
  FormatSize as FontSizeIcon,
  Create as DrawIcon,
  LabelOutlined as LabelIcon,
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  Tune as TuneIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignRight as AlignRightIcon,
  SportsSoccer as SportsIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  MouseOutlined as CursorIcon,
} from '@mui/icons-material';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import images
import coneImg from './images/cone.png';
import ballImg from './images/ball.png';
import playerImg from './images/player.png';
import gaaPitchImg from './images/gaa-pitch.png';
import soccerPitchImg from './images/soccer_collect_main.png';
import basketballCourtImg from './images/basketball_collect_main.png';
import amFootballPitchImg from './images/amfootball_collect_main.png';
import moveIcon from './images/move-icon.png';
import rotateIcon from './images/rotate-icon.png';
import resizeIcon from './images/resize-icon.png';
import deleteIcon from './images/delete-icon.png';

// Constants - Updated with your theme colors
const PRIMARY_COLOR = '#5e2e8f';  // Main purple color
const SECONDARY_COLOR = '#501387'; // Darker purple
const BACKGROUND_COLOR = '#2a2a2a'; // Dark gray
const TEXT_COLOR = '#ffffff';      // White text
const CANVAS_BG = '#ffffff';       // Keep canvas white for contrast
const PANEL_BG = '#333333';        // Slightly lighter gray for panels

// Styled Components with updated theme colors
const EditorContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: BACKGROUND_COLOR,
  color: TEXT_COLOR,
  overflow: 'hidden',
}));

const EditorContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
  padding: theme.spacing(2),
}));

const SideToolbar = styled(Paper)(({ theme }) => ({
  width: 60,
  backgroundColor: PANEL_BG,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(2),
  gap: theme.spacing(2),
  borderRight: `1px solid ${PRIMARY_COLOR}`,
  zIndex: 100,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  borderRadius: theme.spacing(1),
  height: 'calc(100% - 150px)',
  overflowY: 'auto',
  marginRight: theme.spacing(2),
  position: 'relative',
  '&::-webkit-scrollbar': {
    width: '4px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: PRIMARY_COLOR,
    borderRadius: '2px',
  },
  // Add fullscreen styles
  '&.fullscreen': {
    position: 'fixed',
    left: 0,
    top: 0,
    height: '100vh',
    zIndex: 1400,
  },
}));

const ToolGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1),
  width: '100%',
  padding: theme.spacing(1, 0),
}));

const ToolButton = styled(IconButton)(({ theme, selected }) => ({
  width: 40,
  height: 40,
  borderRadius: theme.spacing(1),
  color: selected ? TEXT_COLOR : 'rgba(255, 255, 255, 0.7)',
  backgroundColor: selected ? PRIMARY_COLOR : 'transparent',
  '&:hover': {
    backgroundColor: selected ? PRIMARY_COLOR : 'rgba(255, 255, 255, 0.1)',
    transform: 'scale(1.05)',
  },
  transition: 'all 0.2s ease',
  '&.Mui-disabled': {
    color: 'rgba(255, 255, 255, 0.3)',
  },
}));

const ToolDivider = styled(Divider)(({ theme }) => ({
  width: '80%',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  margin: theme.spacing(1, 0),
}));

const CanvasArea = styled(Box)(({ theme, isFullscreen }) => ({
  flex: 1,
  backgroundColor: BACKGROUND_COLOR,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
  ...(isFullscreen && {
    position: 'fixed',
    top: 0,
    left: 60, // Account for toolbar width
    right: 0,
    bottom: 0,
    zIndex: 1300,
  }),
}));

const StageContainer = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  overflow: 'hidden',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

const TopToolsPanel = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: PANEL_BG,
  borderRadius: theme.spacing(3),
  padding: theme.spacing(1),
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  zIndex: 100,
  maxWidth: '90%',
}));

const ColorButton = styled(Box)(({ theme, color, selected }) => ({
  width: 24,
  height: 24,
  backgroundColor: color,
  borderRadius: '50%',
  cursor: 'pointer',
  border: selected ? `2px solid ${PRIMARY_COLOR}` : '2px solid transparent',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'scale(1.1)',
  },
}));

const CanvasControls = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(3),
  right: theme.spacing(3),
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const ZoomControls = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0.5),
  borderRadius: theme.spacing(5),
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  backgroundColor: PANEL_BG,
  color: TEXT_COLOR,
}));

const ZoomText = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(0, 1),
  userSelect: 'none',
  color: TEXT_COLOR,
}));

const PageControls = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0.5),
  borderRadius: theme.spacing(5),
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  backgroundColor: PANEL_BG,
  color: TEXT_COLOR,
}));

const ObjectProperties = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const ColorPalette = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

// Dark theme for dialogs and popups
const DarkThemedPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: PANEL_BG,
  color: TEXT_COLOR,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
}));

// Dark theme for form controls
const DarkTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    color: TEXT_COLOR,
    '& fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.23)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    '&.Mui-focused fieldset': {
      borderColor: PRIMARY_COLOR,
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: PRIMARY_COLOR,
  },
}));

// Predefined color palette
const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#5e2e8f',
];

// Tool definitions
const TOOLS = [
  { id: 'select', icon: <CursorIcon />, label: 'Select' },
  { id: 'cone', icon: <AddIcon />, label: 'Cone', image: coneImg },
  { id: 'ball', icon: <SportsIcon />, label: 'Ball', image: ballImg },
  { id: 'player', icon: <AddIcon />, label: 'Player', image: playerImg },
  { id: 'line', icon: <DrawIcon />, label: 'Line' },
  { id: 'square', icon: <SquareIcon />, label: 'Square' },
  { id: 'text', icon: <TextIcon />, label: 'Text' },
  { id: 'paragraph', icon: <TextIcon />, label: 'Paragraph' },
  { id: 'pitch', icon: <ImageIcon />, label: 'Pitch' },
];

// Template definitions
const TEMPLATES = [
  { id: 'blank', name: 'Blank Canvas', sport: null, background: '#FFFFFF' },
  { id: 'gaa', name: 'GAA Field', sport: 'GAA', background: '#E8F5E9' },
  { id: 'soccer', name: 'Soccer Field', sport: 'Soccer', background: '#E3F2FD' },
  { id: 'basketball', name: 'Basketball Court', sport: 'Basketball', background: '#FFF8E1' },
  { id: 'football', name: 'Football Field', sport: 'AmericanFootball', background: '#EFEBE9' },
];

const SessionEditor = ({ selectedSport = 'GAA' }) => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Session state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState(selectedSport);
  const [pages, setPages] = useState([{ objects: [], canvasColor: '#FFFFFF' }]);
  const [currentPage, setCurrentPage] = useState(0);
  const [orientation, setOrientation] = useState('landscape');
  const [loading, setLoading] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // UI state
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState(null);
  
  // Drawing state
  const [selectedTool, setSelectedTool] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [editingObjectId, setEditingObjectId] = useState(null);
  const [editText, setEditText] = useState('');
  const [lineStartPoint, setLineStartPoint] = useState(null);
  const [squareStartPoint, setSquareStartPoint] = useState(null);
  const [tempLine, setTempLine] = useState(null);
  const [tempSquare, setTempSquare] = useState(null);
  const [currentColor, setCurrentColor] = useState('#000000');
  
  // History state
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Refs
  const stageRef = useRef(null);
  const canvasAreaRef = useRef(null);
  const transformerRef = useRef(null);
  
  // Define isMobile here
  const isMobile = window.innerWidth <= 768;
  
  // Load images
  const [coneImage] = useImage(coneImg);
  const [ballImage] = useImage(ballImg);
  const [playerImage] = useImage(playerImg);
  const [gaaPitchImage] = useImage(gaaPitchImg);
  const [soccerPitchImage] = useImage(soccerPitchImg);
  const [basketballCourtImage] = useImage(basketballCourtImg);
  const [amFootballPitchImage] = useImage(amFootballPitchImg);
  
  // Tool properties
  const [toolColors, setToolColors] = useState({
    player: '#5e2e8f',
    line: '#ff9800',
    square: '#f44336',
    text: '#000', // Changed to white
    paragraph: '#000', // Changed to white
  });
  
  // Size constants
  const A4_LANDSCAPE = { width: 842, height: 595 };
  const A4_PORTRAIT = { width: 595, height: 842 };
  
  // Calculate stage dimensions based on container and zoom level
  const getStageDimensions = () => {
    if (!canvasAreaRef.current) return orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;

    const containerWidth = canvasAreaRef.current.offsetWidth;
    const containerHeight = canvasAreaRef.current.offsetHeight;
    const baseDimensions = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;

    const scaleX = containerWidth / baseDimensions.width;
    const scaleY = containerHeight / baseDimensions.height;
    const scale = Math.min(scaleX, scaleY) * zoomLevel;

    return {
      width: baseDimensions.width * scale,
      height: baseDimensions.height * scale,
      scale,
    };
  };

  const [stageDimensions, setStageDimensions] = useState(getStageDimensions());

  // Update dimensions on resize, orientation, or zoom change
  useEffect(() => {
    const updateDimensions = () => {
      setStageDimensions(getStageDimensions());
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, [orientation, zoomLevel, isFullscreen]);

  // Fetch session data on load
  useEffect(() => {
    const fetchOrInitSession = async () => {
      try {
        if (sessionId === 'new' && location.state) {
          const { title, description, sport, type, creator, price, image, orientation } = location.state;
          setTitle(title || 'New Session');
          setDescription(description || '');
          setSport(sport || selectedSport);
          setOrientation(orientation || 'landscape');
          setPages([{ objects: [], canvasColor: '#FFFFFF' }]);
          
          // When creating new from template
          if (location.state.template) {
            applyTemplate(location.state.template);
          }
        } else if (sessionId !== 'new') {
          const sessionRef = doc(firestore, 'public_sessions', sessionId);
          const sessionSnap = await getDoc(sessionRef);
          
          if (sessionSnap.exists()) {
            const data = sessionSnap.data();
            setTitle(data.title || 'Untitled Session');
            setDescription(data.description || '');
            setSport(data.sport || selectedSport);
            
            // Sanitize pages to remove image objects
            const sanitizedPages = (data.pages || [{ objects: data.objects || [], canvasColor: data.canvasColor || '#FFFFFF' }]).map(page => ({
              ...page,
              objects: page.objects.map(obj => 
                obj.type === 'pitch' ? { ...obj, image: undefined } : obj
              ),
            }));
            
            setPages(sanitizedPages);
            setOrientation(data.orientation || 'landscape');
          } else {
            showNotification('Session not found', 'error');
            navigate('/sessions');
          }
        }
      } catch (error) {
        console.error('Error fetching session:', error);
        showNotification('Failed to load session', 'error');
        navigate('/sessions');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrInitSession();
  }, [sessionId, navigate, location.state, selectedSport]);

  // Save to history whenever pages change
  useEffect(() => {
    if (!loading && pages.length > 0) {
      // Don't update history when loading initial state
      if (historyIndex === -1) {
        setHistory([pages]);
        setHistoryIndex(0);
      } else {
        // If we're not at the end of history, truncate it
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(pages)));
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
      
      setUnsavedChanges(true);
    }
  }, [pages]);

  // Update transformer on selection change
  useEffect(() => {
    if (selectedNode && transformerRef.current) {
      transformerRef.current.nodes([selectedNode]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedNode]);

  // Warning before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChanges]);

  // Add object based on selected tool
  const addObject = (type) => {
    setSelectedTool(type);
    setSelectedObjectId(null);
    setSelectedNode(null);
  };

  // Handle canvas click for object placement
  const handleCanvasClick = (e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const id = Date.now();

    // Check if clicking on an existing object
    const clickedObject = stage.getIntersection(pointer);
    if (clickedObject && clickedObject.getParent()?.id().startsWith('object-')) {
      // If we're not using the select tool, don't select the object
      if (selectedTool !== 'select' && selectedTool !== null) {
        // Continue with tool operation
      } else {
        // Select the object
        const objectId = clickedObject.getParent().id().split('-')[1];
        handleSelectObject(parseInt(objectId));
        return;
      }
    } else if (selectedTool !== 'line' && selectedTool !== 'square') {
      // Clear selection if not clicking on an object and not drawing a line/square
      setSelectedObjectId(null);
      setSelectedNode(null);
      setEditingObjectId(null);
    }

    // Handle different tools
    if (selectedTool === 'line') {
      if (!lineStartPoint) {
        setLineStartPoint(pointer);
      } else {
        const newLine = {
          id,
          type: 'line',
          points: [lineStartPoint.x, lineStartPoint.y, pointer.x, pointer.y],
          color: toolColors.line,
          size: 3,
        };
        updatePageObjects([...pages[currentPage].objects, newLine]);
        setLineStartPoint(null);
        setTempLine(null);
      }
    } else if (selectedTool === 'square') {
      if (!squareStartPoint) {
        setSquareStartPoint(pointer);
      } else {
        const width = pointer.x - squareStartPoint.x;
        const height = pointer.y - squareStartPoint.y;
        const newSquare = {
          id,
          type: 'square',
          x: width < 0 ? pointer.x : squareStartPoint.x,
          y: height < 0 ? pointer.y : squareStartPoint.y,
          width: Math.abs(width),
          height: Math.abs(height),
          color: toolColors.square,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        updatePageObjects([...pages[currentPage].objects, newSquare]);
        setSquareStartPoint(null);
        setTempSquare(null);
      }
    } else if (selectedTool === 'text') {
      const newText = {
        id,
        type: 'text',
        x: pointer.x,
        y: pointer.y,
        text: 'New Text',
        fontSize: 20,
        fill: toolColors.text,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        fontStyle: 'normal',
        fontWeight: 'normal',
        fontFamily: 'Arial',
      };
      updatePageObjects([...pages[currentPage].objects, newText]);
      
      // Immediately start editing the text
      setTimeout(() => {
        startEditing(id);
      }, 100);
    } else if (selectedTool === 'paragraph') {
      const newParagraph = {
        id,
        type: 'paragraph',
        x: pointer.x,
        y: pointer.y,
        text: 'New Paragraph\nAdd your text here',
        fontSize: 16,
        fill: toolColors.paragraph,
        width: 200,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      updatePageObjects([...pages[currentPage].objects, newParagraph]);
      
      // Immediately start editing the paragraph
      setTimeout(() => {
        startEditing(id);
      }, 100);
    } else if (selectedTool === 'pitch') {
      const newPitch = {
        id,
        type: 'pitch',
        subtype: sport,
        x: pointer.x - 150, // Center the pitch at the click point
        y: pointer.y - 100,
        width: 300,
        height: 200,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      updatePageObjects([...pages[currentPage].objects, newPitch]);
    } else if (selectedTool && selectedTool !== 'select') {
      const newObj = {
        id,
        type: selectedTool,
        x: pointer.x,
        y: pointer.y,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        size: 25,
        label: '',
        color: selectedTool === 'player' ? toolColors.player : null,
      };
      updatePageObjects([...pages[currentPage].objects, newObj]);
    }
  };

  // Handle mouse movement for drawing operations
  const handleMouseMove = (e) => {
    if (!selectedTool || !stageRef.current) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    if (selectedTool === 'line' && lineStartPoint) {
      setTempLine({
        points: [lineStartPoint.x, lineStartPoint.y, pointer.x, pointer.y],
        color: toolColors.line,
        size: 3,
      });
    } else if (selectedTool === 'square' && squareStartPoint) {
      const width = pointer.x - squareStartPoint.x;
      const height = pointer.y - squareStartPoint.y;
      setTempSquare({
        x: width < 0 ? pointer.x : squareStartPoint.x,
        y: height < 0 ? pointer.y : squareStartPoint.y,
        width: Math.abs(width),
        height: Math.abs(height),
        color: toolColors.square,
        size: 2,
      });
    }
  };

  // Handle mouse up event
  const handleMouseUp = () => {
    // Only clear temporary shapes if done drawing
    if (selectedTool === 'line' && !lineStartPoint) {
      setTempLine(null);
    }
    if (selectedTool === 'square' && !squareStartPoint) {
      setTempSquare(null);
    }
  };

  // Select an object by ID
  const handleSelectObject = (id) => {
    setSelectedObjectId(id);
    setSelectedTool('select');
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const layer = stage.findOne('#objects-layer');
    if (!layer) return;
    
    const node = layer.findOne(`#object-${id}`);
    if (node) {
      setSelectedNode(node);
      setShowProperties(true);
    } else {
      setSelectedObjectId(null);
      setSelectedNode(null);
      setShowProperties(false);
    }
  };

  // Handle dragging objects
  const handleDragObject = (e, id) => {
    const updatedObjects = pages[currentPage].objects.map((obj) => {
      if (obj.id === id) {
        if (obj.type === 'line') {
          const dx = e.target.x();
          const dy = e.target.y();
          const centerX = (obj.points[0] + obj.points[2]) / 2;
          const centerY = (obj.points[1] + obj.points[3]) / 2;
          const offsetX = dx - centerX;
          const offsetY = dy - centerY;
          return {
            ...obj,
            points: obj.points.map((p, i) => (i % 2 === 0 ? p + offsetX : p + offsetY)),
          };
        }
        return { ...obj, x: e.target.x(), y: e.target.y() };
      }
      return obj;
    });
    updatePageObjects(updatedObjects);
  };

  // Handle transform complete (resize/rotate)
  const handleTransformEnd = (e, id) => {
    const node = e.target;
    
    // Get the object
    const obj = pages[currentPage].objects.find(obj => obj.id === id);
    if (!obj) return;
    
    // Update object based on transformation
    const updatedObjects = pages[currentPage].objects.map((o) => {
      if (o.id === id) {
        // For line objects
        if (o.type === 'line') {
          // Handle line resizing and rotation
          const newPoints = [...o.points];
          // Apply transformations to line points
          // (This would need a more complex calculation for accurate line transformations)
          return { ...o, points: newPoints };
        }
        
        // For all other objects
        return {
          ...o,
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        };
      }
      return o;
    });
    
    updatePageObjects(updatedObjects);
  };

  // Start editing text
  const startEditing = (id) => {
    const obj = pages[currentPage].objects.find((o) => o.id === id);
    if (obj && (obj.type === 'text' || obj.type === 'paragraph')) {
      setEditingObjectId(id);
      setEditText(obj.text);
      setSelectedObjectId(null);
      setSelectedNode(null);
    }
  };

  // Save text edits
  const saveEdit = () => {
    if (editingObjectId !== null) {
      const updatedObjects = pages[currentPage].objects.map((obj) =>
        obj.id === editingObjectId ? { ...obj, text: editText } : obj
      );
      updatePageObjects(updatedObjects);
      setEditingObjectId(null);
      setEditText('');
      showNotification('Text updated', 'success');
    }
  };

  // Update page objects and trigger history update
  const updatePageObjects = (newObjects) => {
    const updatedPages = [...pages];
    updatedPages[currentPage] = { ...updatedPages[currentPage], objects: newObjects };
    setPages(updatedPages);
  };

  // Show notification toast
  const showNotification = (message, type = 'info') => {
    toast[type](message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: "dark", // Use dark theme for notifications
    });
  };

  // Apply a template to current page
  const applyTemplate = (templateId) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    // Set sport if template has one
    if (template.sport) {
      setSport(template.sport);
    }
    
    // Set background color
    const updatedPages = [...pages];
    updatedPages[currentPage] = { 
      ...updatedPages[currentPage], 
      canvasColor: template.background 
    };
    
    // Add template-specific objects
    if (template.id !== 'blank') {
      const centerX = stageDimensions.width / 2;
      const centerY = stageDimensions.height / 2;
      
      const pitchObj = {
        id: Date.now(),
        type: 'pitch',
        subtype: template.sport,
        x: centerX - 200,
        y: centerY - 150,
        width: 400,
        height: 300,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      
      updatedPages[currentPage].objects = [
        ...updatedPages[currentPage].objects,
        pitchObj
      ];
    }
    
    setPages(updatedPages);
    showNotification(`Template "${template.name}" applied`, 'success');
  };

  // Handle undo action
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPages(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      showNotification('Undo successful', 'info');
    } else {
      showNotification('Nothing to undo', 'warning');
    }
  };

  // Handle redo action
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPages(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      showNotification('Redo successful', 'info');
    } else {
      showNotification('Nothing to redo', 'warning');
    }
  };

  // Zoom in/out
  const handleZoom = (direction) => {
    if (direction === 'in') {
      setZoomLevel(Math.min(zoomLevel + 0.1, 2));
    } else if (direction === 'out') {
      setZoomLevel(Math.max(zoomLevel - 0.1, 0.5));
    } else if (direction === 'reset') {
      setZoomLevel(1);
    }
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Reset zoom when toggling fullscreen
    setZoomLevel(1);
  };

  // Add new page
  const addNewPage = () => {
    setPages([...pages, { objects: [], canvasColor: '#FFFFFF' }]);
    setCurrentPage(pages.length);
    showNotification('New page added', 'success');
  };

  // Delete current page
  const deletePage = () => {
    if (pages.length <= 1) {
      showNotification('Cannot delete the last page', 'error');
      return;
    }
    
    const updatedPages = pages.filter((_, index) => index !== currentPage);
    setPages(updatedPages);
    setCurrentPage(currentPage >= updatedPages.length ? updatedPages.length - 1 : currentPage);
    setSelectedObjectId(null);
    setSelectedNode(null);
    setEditingObjectId(null);
    
    showNotification('Page deleted', 'info');
  };

  // Navigate to next page
  const nextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedObjectId(null);
      setSelectedNode(null);
      setEditingObjectId(null);
    }
  };

  // Navigate to previous page
  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedObjectId(null);
      setSelectedNode(null);
      setEditingObjectId(null);
    }
  };

  // Set page canvas color
  const setPageCanvasColor = (color) => {
    const updatedPages = [...pages];
    updatedPages[currentPage] = { ...updatedPages[currentPage], canvasColor: color };
    setPages(updatedPages);
  };

  // Update object properties
  const updateObjectProperty = (property, value) => {
    if (!selectedObjectId) return;
    
    const updatedObjects = pages[currentPage].objects.map((obj) => {
      if (obj.id === selectedObjectId) {
        return { ...obj, [property]: value };
      }
      return obj;
    });
    
    updatePageObjects(updatedObjects);
  };

  // Delete selected object
  const deleteSelectedObject = () => {
    if (!selectedObjectId) return;
    
    const updatedObjects = pages[currentPage].objects.filter(
      (obj) => obj.id !== selectedObjectId
    );
    
    updatePageObjects(updatedObjects);
    setSelectedObjectId(null);
    setSelectedNode(null);
    showNotification('Object deleted', 'info');
  };

  // Handle drag over for drop operations
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  // Handle drop from toolbar
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const tool = e.dataTransfer.getData('tool');
    if (!tool || ['line', 'square'].includes(tool)) return;
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const canvas = stage.getContent();
    const rect = canvas.getBoundingClientRect();
    
    // Calculate position in stage coordinates
    const stageX = (e.clientX - rect.left) / stageDimensions.scale;
    const stageY = (e.clientY - rect.top) / stageDimensions.scale;
    
    if (stageX < 0 || stageX > stage.width() / stageDimensions.scale || 
        stageY < 0 || stageY > stage.height() / stageDimensions.scale) return;
    
    // Create a new object at drop position
    const id = Date.now();
    let newObj;
    
    switch (tool) {
      case 'text':
        newObj = {
          id,
          type: 'text',
          x: stageX,
          y: stageY,
          text: 'New Text',
          fontSize: 20,
          fill: toolColors.text,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        break;
      case 'paragraph':
        newObj = {
          id,
          type: 'paragraph',
          x: stageX,
          y: stageY,
          text: 'New Paragraph\nAdd your text here',
          fontSize: 16,
          fill: toolColors.paragraph,
          width: 200,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        break;
      case 'pitch':
        newObj = {
          id,
          type: 'pitch',
          subtype: sport,
          x: stageX - 150,
          y: stageY - 100,
          width: 300,
          height: 200,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        break;
      default:
        newObj = {
          id,
          type: tool,
          x: stageX,
          y: stageY,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          size: 25,
          label: '',
          color: tool === 'player' ? toolColors.player : null,
        };
    }
    
    updatePageObjects([...pages[currentPage].objects, newObj]);
    showNotification(`${tool} added`, 'success');
    
    // Start editing if it's a text object
    if (tool === 'text' || tool === 'paragraph') {
      setTimeout(() => {
        startEditing(id);
      }, 100);
    }
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  // Save session to Firestore
  const saveSession = async () => {
    if (!title.trim()) {
      showNotification('Please enter a session title', 'error');
      return;
    }
    
    setLoading(true);
    
    const sessionData = {
      title,
      time: 'N/A',
      type: location.state?.type || 'Custom',
      creator: location.state?.creator || 'User Created',
      price: 'Free',
      image: location.state?.image || `https://via.placeholder.com/300x150?text=${title.replace(/\s+/g, '+')}`,
      description,
      createdAt: sessionId === 'new' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
      sport,
      pages,
      orientation: orientation || 'landscape',
    };
    
    try {
      let savedSessionId = sessionId;
      
      if (sessionId === 'new') {
        const docRef = await addDoc(collection(firestore, 'public_sessions'), sessionData);
        savedSessionId = docRef.id;
        console.log('Session created:', { id: savedSessionId, data: sessionData });
      } else {
        const sessionRef = doc(firestore, 'public_sessions', sessionId);
        await updateDoc(sessionRef, sessionData);
        console.log('Session updated:', { id: sessionId, data: sessionData });
      }
      
      showNotification('Session saved successfully!', 'success');
      setUnsavedChanges(false);
      
      // Delay navigation to ensure Firestore write propagates
      await new Promise((resolve) => setTimeout(resolve, 500));
      navigate(`/session-detail/${savedSessionId}`);
    } catch (error) {
      console.error('Error saving session:', error, { sessionData, sessionId });
      showNotification(`Failed to save session: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    setLoading(true);
    showNotification('Preparing PDF...', 'info');
    
    try {
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const baseDimensions = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
      const scale = Math.min(pdfWidth / (baseDimensions.width / 72), pdfHeight / (baseDimensions.height / 72));
      
      // Store current page
      const originalPage = currentPage;
      
      // Generate each page
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        // Switch to page and wait for render
        setCurrentPage(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        // Capture canvas as image
        const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
        pdf.addImage(uri, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      // Return to original page
      setCurrentPage(originalPage);
      
      // Save the PDF
      pdf.save(`${title || 'session'}.pdf`);
      showNotification('PDF exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showNotification('Failed to export PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Render objects on the canvas
  const renderObjects = () => {
    const pitchImageMap = {
      GAA: gaaPitchImage,
      Soccer: soccerPitchImage,
      Basketball: basketballCourtImage,
      AmericanFootball: amFootballPitchImage,
    };
    
    return pages[currentPage].objects.map((obj) => {
      const isSelected = obj.id === selectedObjectId;
      
      switch (obj.type) {
        case 'cone':
        case 'ball': {
          const konvaImg = obj.type === 'cone' ? coneImage : ballImage;
          return (
            <Group
              key={obj.id}
              id={`object-${obj.id}`}
              x={obj.x}
              y={obj.y}
              draggable={selectedTool === 'select'}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
            >
              {obj.label && (
                <Text
                  text={obj.label}
                  fontSize={obj.size / 2}
                  fill="#000000"
                  x={-obj.size / 2}
                  y={-obj.size - obj.size / 8}
                  width={obj.size}
                  align="center"
                />
              )}
              <KonvaImage
                image={konvaImg}
                x={0}
                y={0}
                offsetX={obj.size / 2}
                offsetY={obj.size / 2}
                width={obj.size}
                height={obj.size}
              />
            </Group>
          );
        }
        case 'player':
          return (
            <Group
              key={obj.id}
              id={`object-${obj.id}`}
              x={obj.x}
              y={obj.y}
              draggable={selectedTool === 'select'}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
            >
              <Circle radius={obj.size / 2} fill={obj.color || '#5e2e8f'} />
              {obj.label && (
                <Text
                  text={obj.label}
                  fontSize={obj.size / 2}
                  fill="#ffffff"
                  align="center"
                  verticalAlign="middle"
                  offsetX={-obj.size / 4}
                  offsetY={-obj.size / 4}
                />
              )}
            </Group>
          );
        case 'line':
          return (
            <Line
              key={obj.id}
              id={`object-${obj.id}`}
              points={obj.points}
              stroke={obj.color || '#ff9800'}
              strokeWidth={obj.size || 3}
              draggable={selectedTool === 'select'}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
            />
          );
        case 'square':
          return (
            <Rect
              key={obj.id}
              id={`object-${obj.id}`}
              x={obj.x}
              y={obj.y}
              width={obj.width}
              height={obj.height}
              fill="transparent"
              stroke={obj.color || '#f44336'}
              strokeWidth={2}
              draggable={selectedTool === 'select'}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
            />
          );
        case 'text':
          if (obj.id === editingObjectId) return null;
          return (
            <Text
              key={obj.id}
              id={`object-${obj.id}`}
              x={obj.x}
              y={obj.y}
              text={obj.text}
              fontSize={obj.fontSize}
              fill={obj.fill || '#000000'}
              draggable={selectedTool === 'select'}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDblClick={() => startEditing(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
            />
          );
        case 'paragraph':
          if (obj.id === editingObjectId) return null;
          return (
            <Text
              key={obj.id}
              id={`object-${obj.id}`}
              x={obj.x}
              y={obj.y}
              text={obj.text}
              fontSize={obj.fontSize}
              fill={obj.fill || '#000000'}
              width={obj.width}
              wrap="word"
              draggable={selectedTool === 'select'}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDblClick={() => startEditing(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
            />
          );
        case 'pitch':
          const pitchImage = pitchImageMap[obj.subtype] || gaaPitchImage;
          return (
            <Group
              key={obj.id}
              id={`object-${obj.id}`}
              x={obj.x}
              y={obj.y}
              draggable={selectedTool === 'select'}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
            >
              <KonvaImage
                image={pitchImage}
                x={0}
                y={0}
                width={obj.width}
                height={obj.height}
              />
            </Group>
          );
        default:
          return null;
      }
    });
  };

  // Render text editing field
  const renderEditField = () => {
    if (!editingObjectId) return null;
    
    const obj = pages[currentPage].objects.find((o) => o.id === editingObjectId);
    if (!obj) return null;
    
    return (
      <DarkThemedPaper
        elevation={3}
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: obj.type === 'paragraph' ? '400px' : '300px',
          padding: 2,
          zIndex: 1000,
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6" color="white">Edit Text</Typography>
          
          <DarkTextField
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            multiline={obj.type === 'paragraph'}
            rows={obj.type === 'paragraph' ? 4 : 1}
            autoFocus
            variant="outlined"
            fullWidth
            placeholder="Enter text here..."
            sx={{
              '.MuiInputBase-root': { 
                fontSize: `${obj.fontSize}px`,
                color: obj.fill || TEXT_COLOR,
              }
            }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button 
              variant="outlined" 
              onClick={() => {
                setEditingObjectId(null);
                setEditText('');
              }}
              sx={{ color: TEXT_COLOR, borderColor: 'rgba(255, 255, 255, 0.5)' }}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={saveEdit}
              sx={{ backgroundColor: PRIMARY_COLOR, '&:hover': { backgroundColor: SECONDARY_COLOR } }}
            >
              Save
            </Button>
          </Box>
        </Stack>
      </DarkThemedPaper>
    );
  };

  // Render grid for alignment
  const renderGrid = () => {
    if (!showGrid) return null;
    
    const gridLines = [];
    const width = stageDimensions.width;
    const height = stageDimensions.height;
    
    // Create vertical lines
    for (let i = 0; i <= width; i += gridSize) {
      gridLines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, height]}
          stroke="#aaaaaa"
          strokeWidth={0.5}
          dash={[2, 2]}
        />
      );
    }
    
    // Create horizontal lines
    for (let i = 0; i <= height; i += gridSize) {
      gridLines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, width, i]}
          stroke="#aaaaaa"
          strokeWidth={0.5}
          dash={[2, 2]}
        />
      );
    }
    
    return gridLines;
  };

  // Render object properties panel
  const renderObjectProperties = () => {
    if (!selectedObjectId || !showProperties) return null;
    
    const obj = pages[currentPage].objects.find(o => o.id === selectedObjectId);
    if (!obj) return null;
    
    let propertyControls;
    
    // Common properties
    const commonControls = (
      <>
        <Typography variant="subtitle2" color={TEXT_COLOR}>Position</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <DarkTextField
            label="X"
            type="number"
            size="small"
            value={Math.round(obj.x)}
            onChange={(e) => updateObjectProperty('x', Number(e.target.value))}
            sx={{ width: '48%' }}
          />
          <DarkTextField
            label="Y"
            type="number"
            size="small"
            value={Math.round(obj.y)}
            onChange={(e) => updateObjectProperty('y', Number(e.target.value))}
            sx={{ width: '48%' }}
          />
        </Box>
        
        <Typography variant="subtitle2" color={TEXT_COLOR}>Rotation</Typography>
        <Slider
          value={obj.rotation}
          onChange={(e, value) => updateObjectProperty('rotation', value)}
          min={0}
          max={360}
          valueLabelDisplay="auto"
          sx={{
            color: PRIMARY_COLOR,
            '& .MuiSlider-thumb': {
              backgroundColor: PRIMARY_COLOR,
            },
            '& .MuiSlider-track': {
              backgroundColor: PRIMARY_COLOR,
            },
          }}
        />
      </>
    );
    
    // Type-specific properties
    switch (obj.type) {
      case 'player':
      case 'cone':
      case 'ball':
        propertyControls = (
          <>
            {commonControls}
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Size</Typography>
            <Slider
              value={obj.size}
              onChange={(e, value) => updateObjectProperty('size', value)}
              min={10}
              max={100}
              valueLabelDisplay="auto"
              sx={{ 
                color: PRIMARY_COLOR,
                '& .MuiSlider-thumb': {
                  backgroundColor: PRIMARY_COLOR,
                },
                '& .MuiSlider-track': {
                  backgroundColor: PRIMARY_COLOR,
                },
              }}
            />
            
            {obj.type === 'player' && (
              <>
                <Typography variant="subtitle2" color={TEXT_COLOR}>Color</Typography>
                <ColorPalette>
                  {COLORS.map((color, index) => (
                    <ColorButton
                      key={index}
                      color={color}
                      selected={obj.color === color}
                      onClick={() => updateObjectProperty('color', color)}
                    />
                  ))}
                </ColorPalette>
              </>
            )}
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Label</Typography>
            <DarkTextField
              value={obj.label || ''}
              onChange={(e) => updateObjectProperty('label', e.target.value)}
              size="small"
              placeholder="Enter label"
              fullWidth
            />
          </>
        );
        break;
      
      case 'line':
        propertyControls = (
          <>
            <Typography variant="subtitle2" color={TEXT_COLOR}>Line Width</Typography>
            <Slider
              value={obj.size || 3}
              onChange={(e, value) => updateObjectProperty('size', value)}
              min={1}
              max={10}
              valueLabelDisplay="auto"
              sx={{ 
                color: PRIMARY_COLOR,
                '& .MuiSlider-thumb': {
                  backgroundColor: PRIMARY_COLOR,
                },
                '& .MuiSlider-track': {
                  backgroundColor: PRIMARY_COLOR,
                },
              }}
            />
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Color</Typography>
            <ColorPalette>
              {COLORS.map((color, index) => (
                <ColorButton
                  key={index}
                  color={color}
                  selected={obj.color === color}
                  onClick={() => updateObjectProperty('color', color)}
                />
              ))}
            </ColorPalette>
          </>
        );
        break;
      
      case 'square':
        propertyControls = (
          <>
            {commonControls}
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Dimensions</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <DarkTextField
                label="Width"
                type="number"
                size="small"
                value={Math.round(obj.width)}
                onChange={(e) => updateObjectProperty('width', Number(e.target.value))}
                sx={{ width: '48%' }}
              />
              <DarkTextField
                label="Height"
                type="number"
                size="small"
                value={Math.round(obj.height)}
                onChange={(e) => updateObjectProperty('height', Number(e.target.value))}
                sx={{ width: '48%' }}
              />
            </Box>
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Color</Typography>
            <ColorPalette>
              {COLORS.map((color, index) => (
                <ColorButton
                  key={index}
                  color={color}
                  selected={obj.color === color}
                  onClick={() => updateObjectProperty('color', color)}
                />
              ))}
            </ColorPalette>
          </>
        );
        break;
      
      case 'text':
      case 'paragraph':
        propertyControls = (
          <>
            {commonControls}
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Text</Typography>
            <DarkTextField
              value={obj.text || ''}
              onChange={(e) => updateObjectProperty('text', e.target.value)}
              size="small"
              multiline={obj.type === 'paragraph'}
              rows={obj.type === 'paragraph' ? 4 : 1}
              fullWidth
            />
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Font Size</Typography>
            <Slider
              value={obj.fontSize}
              onChange={(e, value) => updateObjectProperty('fontSize', value)}
              min={8}
              max={72}
              valueLabelDisplay="auto"
              sx={{ 
                color: PRIMARY_COLOR,
                '& .MuiSlider-thumb': {
                  backgroundColor: PRIMARY_COLOR,
                },
                '& .MuiSlider-track': {
                  backgroundColor: PRIMARY_COLOR,
                },
              }}
            />
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Font Style</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Tooltip title="Bold">
                <IconButton
                  size="small"
                  onClick={() => updateObjectProperty('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold')}
                  sx={{ 
                    color: obj.fontWeight === 'bold' ? PRIMARY_COLOR : TEXT_COLOR,
                    backgroundColor: obj.fontWeight === 'bold' ? 'rgba(94, 46, 143, 0.1)' : 'transparent',
                  }}
                >
                  <FormatBoldIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Italic">
                <IconButton
                  size="small"
                  onClick={() => updateObjectProperty('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic')}
                  sx={{ 
                    color: obj.fontStyle === 'italic' ? PRIMARY_COLOR : TEXT_COLOR,
                    backgroundColor: obj.fontStyle === 'italic' ? 'rgba(94, 46, 143, 0.1)' : 'transparent',
                  }}
                >
                  <FormatItalicIcon />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Font Family</Typography>
            <FormControl fullWidth size="small">
              <Select
                value={obj.fontFamily || 'Arial'}
                onChange={(e) => updateObjectProperty('fontFamily', e.target.value)}
                sx={{ 
                  color: TEXT_COLOR,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.23)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
              >
                <MenuItem value="Arial">Arial</MenuItem>
                <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                <MenuItem value="Courier New">Courier New</MenuItem>
                <MenuItem value="Georgia">Georgia</MenuItem>
                <MenuItem value="Verdana">Verdana</MenuItem>
              </Select>
            </FormControl>
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Color</Typography>
            <ColorPalette>
              {COLORS.map((color, index) => (
                <ColorButton
                  key={index}
                  color={color}
                  selected={obj.fill === color}
                  onClick={() => updateObjectProperty('fill', color)}
                />
              ))}
            </ColorPalette>
            
            {obj.type === 'paragraph' && (
              <>
                <Typography variant="subtitle2" color={TEXT_COLOR}>Width</Typography>
                <Slider
                  value={obj.width}
                  onChange={(e, value) => updateObjectProperty('width', value)}
                  min={100}
                  max={500}
                  valueLabelDisplay="auto"
                  sx={{ 
                    color: PRIMARY_COLOR,
                    '& .MuiSlider-thumb': {
                      backgroundColor: PRIMARY_COLOR,
                    },
                    '& .MuiSlider-track': {
                      backgroundColor: PRIMARY_COLOR,
                    },
                  }}
                />
              </>
            )}
          </>
        );
        break;
      
      case 'pitch':
        propertyControls = (
          <>
            {commonControls}
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Dimensions</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <DarkTextField
                label="Width"
                type="number"
                size="small"
                value={Math.round(obj.width)}
                onChange={(e) => updateObjectProperty('width', Number(e.target.value))}
                sx={{ width: '48%' }}
              />
              <DarkTextField
                label="Height"
                type="number"
                size="small"
                value={Math.round(obj.height)}
                onChange={(e) => updateObjectProperty('height', Number(e.target.value))}
                sx={{ width: '48%' }}
              />
            </Box>
            
            <Typography variant="subtitle2" color={TEXT_COLOR}>Type</Typography>
            <FormControl fullWidth size="small" sx={{ 
              '& .MuiInputBase-root': { color: TEXT_COLOR },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.23)' },
              '& .MuiSelect-icon': { color: TEXT_COLOR },
            }}>
              <Select
                value={obj.subtype}
                onChange={(e) => updateObjectProperty('subtype', e.target.value)}
                MenuProps={{
                  PaperProps: {
                    sx: { backgroundColor: PANEL_BG }
                  }
                }}
              >
                <MenuItem value="GAA" sx={{ color: TEXT_COLOR }}>GAA</MenuItem>
                <MenuItem value="Soccer" sx={{ color: TEXT_COLOR }}>Soccer</MenuItem>
                <MenuItem value="Basketball" sx={{ color: TEXT_COLOR }}>Basketball</MenuItem>
                <MenuItem value="AmericanFootball" sx={{ color: TEXT_COLOR }}>American Football</MenuItem>
              </Select>
            </FormControl>
          </>
        );
        break;
      
      default:
        propertyControls = null;
    }
    
    return (
      <DarkThemedPaper
        elevation={3}
        sx={{
          position: 'absolute',
          top: '50%',
          right: 20,
          transform: 'translateY(-50%)',
          width: 280,
          padding: 2,
          zIndex: 1000,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" color={TEXT_COLOR}>Properties</Typography>
            <IconButton 
              size="small" 
              onClick={() => setShowProperties(false)}
              aria-label="close properties"
              sx={{ color: TEXT_COLOR }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }} />
          
          <ObjectProperties>
            {propertyControls}
          </ObjectProperties>
          
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={deleteSelectedObject}
            fullWidth
          >
            Delete Object
          </Button>
        </Stack>
      </DarkThemedPaper>
    );
  };

  // Render help/tips dialog
  const renderHelpDialog = () => {
    if (!showHelp) return null;
    
    return (
      <DarkThemedPaper
        elevation={3}
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60%',
          maxWidth: 600,
          maxHeight: '80vh',
          padding: 3,
          zIndex: 1500,
          overflowY: 'auto',
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" color={TEXT_COLOR}>Session Editor Help</Typography>
            <IconButton 
              size="small" 
              onClick={() => setShowHelp(false)}
              aria-label="close help"
              sx={{ color: TEXT_COLOR }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }} />
          
          <Typography variant="h6" color={TEXT_COLOR}>Basic Controls</Typography>
          <Typography color={TEXT_COLOR}>
            • Click on a tool in the toolbar to select it<br />
            • Click on the canvas to place the selected object<br />
            • Click the Select tool (cursor) to move and resize objects<br />
            • Double-click on text to edit it<br />
            • Use the zoom controls to zoom in/out<br />
            • Use the page controls to navigate between pages
          </Typography>
          
          <Typography variant="h6" color={TEXT_COLOR}>Keyboard Shortcuts</Typography>
          <Typography color={TEXT_COLOR}>
            • Delete: Delete selected object<br />
            • Ctrl+Z: Undo<br />
            • Ctrl+Y: Redo<br />
            • Ctrl+S: Save session<br />
            • Ctrl+D: Duplicate selected object<br />
            • Escape: Cancel current operation
          </Typography>
          
          <Typography variant="h6" color={TEXT_COLOR}>Tips</Typography>
          <Typography color={TEXT_COLOR}>
            • Use the grid for precise positioning<br />
            • Double-click objects to edit their properties<br />
            • Drag and drop tools directly onto the canvas<br />
            • Use templates to quickly start a new session<br />
            • Export to PDF to share your session
          </Typography>
          
          <Button 
            variant="outlined" 
            onClick={() => setShowHelp(false)}
            sx={{ alignSelf: 'center', mt: 2, color: TEXT_COLOR, borderColor: 'rgba(255, 255, 255, 0.5)' }}
          >
            Close
          </Button>
        </Stack>
      </DarkThemedPaper>
    );
  };
  
  // Render template selection dialog
  const renderTemplateSelector = () => {
    if (!showTemplates) return null;
    
    return (
      <DarkThemedPaper
        elevation={3}
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60%',
          maxWidth: 600,
          padding: 3,
          zIndex: 1500,
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" color={TEXT_COLOR}>Select Template</Typography>
            <IconButton 
              size="small" 
              onClick={() => setShowTemplates(false)}
              aria-label="close templates"
              sx={{ color: TEXT_COLOR }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }} />
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
            {TEMPLATES.map((template) => (
              <Paper 
                key={template.id}
                elevation={2}
                sx={{ 
                  width: 150, 
                  height: 120, 
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: template.background,
                  cursor: 'pointer',
                  '&:hover': { 
                    boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                    transform: 'translateY(-4px)',
                  },
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  applyTemplate(template.id);
                  setShowTemplates(false);
                }}
              >
                <Typography variant="subtitle1" sx={{ color: '#333', textAlign: 'center', p: 1 }}>
                  {template.name}
                </Typography>
              </Paper>
            ))}
          </Box>
          
          <Button 
            variant="outlined" 
            onClick={() => setShowTemplates(false)}
            sx={{ alignSelf: 'center', mt: 2, color: TEXT_COLOR, borderColor: 'rgba(255, 255, 255, 0.5)' }}
          >
            Cancel
          </Button>
        </Stack>
      </DarkThemedPaper>
    );
  };

  // Main render function
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: BACKGROUND_COLOR,
      }}>
        <CircularProgress sx={{ color: PRIMARY_COLOR }} />
        <Typography variant="h6" sx={{ ml: 2, color: TEXT_COLOR }}>Loading Session...</Typography>
      </Box>
    );
  }

  return (
    <EditorContainer>
      {/* Toast notifications */}
      <ToastContainer />
      
      {/* App Bar */}
      <AppBar position="static" elevation={0} sx={{ backgroundColor: PRIMARY_COLOR }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {title || 'Untitled Session'}
          </Typography>
          
          <Tooltip title="Templates">
            <IconButton color="inherit" onClick={() => setShowTemplates(true)}>
              <TemplatesIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Save">
            <IconButton color="inherit" onClick={saveSession}>
              <SaveIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Export PDF">
            <IconButton color="inherit" onClick={exportToPDF}>
              <ExportIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Help">
            <IconButton color="inherit" onClick={() => setShowHelp(true)}>
              <HelpIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Back to Sessions">
            <IconButton 
              color="inherit" 
              onClick={() => {
                if (unsavedChanges) {
                  Swal.fire({
                    title: 'Unsaved Changes',
                    text: 'You have unsaved changes. Are you sure you want to leave?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, leave',
                    cancelButtonText: 'No, stay',
                    background: PANEL_BG,
                    color: TEXT_COLOR,
                    confirmButtonColor: PRIMARY_COLOR,
                  }).then((result) => {
                    if (result.isConfirmed) {
                      navigate('/sessions');
                    }
                  });
                } else {
                  navigate('/sessions');
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      
      <EditorContent>
        {/* Side Toolbar */}
        <SideToolbar className={isFullscreen ? 'fullscreen' : ''}>
          <ToolGroup>
            {TOOLS.map((tool) => (
              <Tooltip key={tool.id} title={tool.label} placement="right">
                <ToolButton
                  selected={selectedTool === tool.id}
                  onClick={() => addObject(tool.id)}
                  size="small"
                >
                  {tool.image ? (
                    <img src={tool.image} alt={tool.label} style={{ width: 20, height: 20 }} />
                  ) : (
                    tool.icon
                  )}
                </ToolButton>
              </Tooltip>
            ))}
          </ToolGroup>

          <ToolDivider />

          <ToolGroup>
            <Tooltip title="Fill Color" placement="right">
              <ToolButton
                size="small"
                onClick={(e) => {
                  setColorPickerOpen(!colorPickerOpen);
                  setColorPickerTarget(e.currentTarget);
                }}
              >
                <FillIcon style={{ color: currentColor }} />
              </ToolButton>
            </Tooltip>

            <Tooltip title="Properties" placement="right">
              <ToolButton
                size="small"
                onClick={() => setShowProperties(!showProperties)}
                selected={showProperties}
              >
                <TuneIcon />
              </ToolButton>
            </Tooltip>
          </ToolGroup>

          <ToolDivider />

          <ToolGroup>
            <Tooltip title="Undo" placement="right">
              <span>
                <ToolButton
                  size="small"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                >
                  <UndoIcon />
                </ToolButton>
              </span>
            </Tooltip>

            <Tooltip title="Redo" placement="right">
              <span>
                <ToolButton
                  size="small"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                >
                  <RedoIcon />
                </ToolButton>
              </span>
            </Tooltip>
          </ToolGroup>

          <ToolDivider />

          <ToolGroup>
            <Tooltip title="Toggle Grid" placement="right">
              <ToolButton
                size="small"
                onClick={() => setShowGrid(!showGrid)}
                selected={showGrid}
              >
                <GridIcon />
              </ToolButton>
            </Tooltip>

            <Tooltip title="Toggle Fullscreen" placement="right">
              <ToolButton
                size="small"
                onClick={toggleFullscreen}
              >
                <FullscreenIcon />
              </ToolButton>
            </Tooltip>
          </ToolGroup>
        </SideToolbar>
        
        {/* Main Canvas Area */}
        <CanvasArea 
          ref={canvasAreaRef} 
          isFullscreen={isFullscreen}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          sx={{
            borderStyle: isDraggingOver ? 'dashed' : 'solid',
            borderWidth: isDraggingOver ? 2 : 0,
            borderColor: isDraggingOver ? PRIMARY_COLOR : 'transparent',
          }}
        >
          {/* Canvas */}
          <StageContainer>
            <Stage
              ref={stageRef}
              width={stageDimensions.width}
              height={stageDimensions.height}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* Background Layer */}
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={stageDimensions.width}
                  height={stageDimensions.height}
                  fill={pages[currentPage].canvasColor}
                />
              </Layer>
              
              {/* Grid Layer */}
              {showGrid && (
                <Layer>
                  {renderGrid()}
                </Layer>
              )}
              
              {/* Objects Layer */}
              <Layer id="objects-layer">
                {renderObjects()}
                
                {/* Temporary drawing shapes */}
                {tempLine && (
                  <Line
                    points={tempLine.points}
                    stroke={tempLine.color}
                    strokeWidth={tempLine.size}
                    dash={[4, 4]}
                  />
                )}
                {tempSquare && (
                  <Rect
                    x={tempSquare.x}
                    y={tempSquare.y}
                    width={tempSquare.width}
                    height={tempSquare.height}
                    fill="transparent"
                    stroke={tempSquare.color}
                    strokeWidth={tempSquare.size}
                    dash={[4, 4]}
                  />
                )}
              </Layer>
              
              {/* Selection Layer */}
              <Layer>
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Minimum size constraints
                    if (newBox.width < 5 || newBox.height < 5) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                  keepRatio={false}
                  rotateEnabled={true}
                  enabledAnchors={[
                    'top-left', 'top-center', 'top-right',
                    'middle-left', 'middle-right',
                    'bottom-left', 'bottom-center', 'bottom-right'
                  ]}
                  anchorCornerRadius={8}
                  borderDash={[6, 2]}
                  borderStroke={PRIMARY_COLOR}
                  anchorStroke={PRIMARY_COLOR}
                  anchorFill={BACKGROUND_COLOR}
                />
              </Layer>
            </Stage>
          </StageContainer>
          
          {/* Canvas Controls */}
          <CanvasControls>
            <ZoomControls>
              <IconButton onClick={() => handleZoom('out')} size="small" sx={{ color: TEXT_COLOR }}>
                <ZoomOutIcon />
              </IconButton>
              <ZoomText variant="body2" color={TEXT_COLOR}>
                {Math.round(zoomLevel * 100)}%
              </ZoomText>
              <IconButton onClick={() => handleZoom('in')} size="small" sx={{ color: TEXT_COLOR }}>
                <ZoomInIcon />
              </IconButton>
              <IconButton onClick={() => handleZoom('reset')} size="small" sx={{ color: TEXT_COLOR }}>
                <SettingsIcon />
              </IconButton>
            </ZoomControls>
            
            <PageControls>
              <IconButton onClick={prevPage} disabled={currentPage === 0} size="small" sx={{ color: TEXT_COLOR }}>
                <PrevIcon />
              </IconButton>
              <Typography variant="body2" sx={{ px: 1, color: TEXT_COLOR }}>
                {currentPage + 1} / {pages.length}
              </Typography>
              <IconButton onClick={nextPage} disabled={currentPage === pages.length - 1} size="small" sx={{ color: TEXT_COLOR }}>
                <NextIcon />
              </IconButton>
              <Tooltip title="Add Page">
                <IconButton onClick={addNewPage} size="small" sx={{ color: TEXT_COLOR }}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Page">
                <span>
                  <IconButton onClick={deletePage} size="small" disabled={pages.length <= 1} sx={{ color: TEXT_COLOR }}>
                    <DeleteIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </PageControls>
          </CanvasControls>
          
          {/* Render text editing field */}
          {renderEditField()}
          
          {/* Render object properties panel */}
          {renderObjectProperties()}
          
          {/* Render help dialog */}
          {renderHelpDialog()}
          
          {/* Render template selector */}
          {renderTemplateSelector()}
        </CanvasArea>
      </EditorContent>
    </EditorContainer>
  );
};

export default SessionEditor;