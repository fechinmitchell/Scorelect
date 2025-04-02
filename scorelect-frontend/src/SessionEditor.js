import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { firestore } from './firebase';
import { doc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import {
  Stage,
  Layer,
  Rect,
  Line,
  Circle,
  Text,
  Image as KonvaImage,
  Group,
} from 'react-konva';
import useImage from 'use-image';
import {
  Box,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { FaPlus, FaTrash, FaSave, FaFileExport, FaTextHeight, FaSquare, FaImage, FaArrowsAlt, FaRedo, FaParagraph } from 'react-icons/fa';

// Import images
import coneImg from './images/cone.png';
import ballImg from './images/ball.png';
import playerImg from './images/player.png';
import gaaPitchImg from './images/gaa-pitch.png';
import soccerPitchImg from './images/soccer_collect_main.png';
import basketballCourtImg from './images/basketball_collect_main.png';
import amFootballPitchImg from './images/amfootball_collect_main.png';

// Styled Components
const EditorContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  color: '#ffffff',
  backgroundColor: '#2c2c2c',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'row',
  gap: theme.spacing(4),
}));

const CanvasArea = styled(Box)(({ theme }) => ({
  flex: 1,
  backgroundColor: '#3a3a3a',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(2),
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  position: 'relative', // For positioning the edit field
}));

const Sidebar = styled(Box)(({ theme }) => ({
  width: '300px',
  backgroundColor: '#444',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const SidebarSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const ToolRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const SessionEditor = ({ selectedSport = 'GAA' }) => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState(selectedSport);
  const [objects, setObjects] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orientation, setOrientation] = useState('landscape');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingObjectId, setEditingObjectId] = useState(null);
  const [editText, setEditText] = useState('');

  // A4 dimensions in pixels at 72 DPI
  const A4_LANDSCAPE = { width: 842, height: 595 };
  const A4_PORTRAIT = { width: 595, height: 842 };

  // Refs for dynamic sizing
  const canvasAreaRef = useRef(null);
  const stageRef = useRef(null);

  // Calculate stage dimensions to fit container
  const getStageDimensions = () => {
    if (!canvasAreaRef.current) return orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;

    const containerWidth = canvasAreaRef.current.offsetWidth;
    const containerHeight = canvasAreaRef.current.offsetHeight;
    const baseDimensions = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;

    const scaleX = containerWidth / baseDimensions.width;
    const scaleY = containerHeight / baseDimensions.height;
    const scale = Math.min(scaleX, scaleY);

    return {
      width: baseDimensions.width * scale,
      height: baseDimensions.height * scale,
      scale,
    };
  };

  const [stageDimensions, setStageDimensions] = useState(getStageDimensions());

  // Update dimensions on orientation change or resize
  useEffect(() => {
    const updateDimensions = () => {
      setStageDimensions(getStageDimensions());
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [orientation]);

  // For line/square drawing
  const [lineStartPoint, setLineStartPoint] = useState(null);
  const [tempLine, setTempLine] = useState(null);
  const [squareStartPoint, setSquareStartPoint] = useState(null);
  const [tempSquare, setTempSquare] = useState(null);

  // Load images
  const [coneImage] = useImage(coneImg);
  const [ballImage] = useImage(ballImg);
  const [playerImage] = useImage(playerImg);
  const [gaaPitchImage] = useImage(gaaPitchImg);
  const [soccerPitchImage] = useImage(soccerPitchImg);
  const [basketballCourtImage] = useImage(basketballCourtImg);
  const [amFootballPitchImage] = useImage(amFootballPitchImg);

  // Load or pre-fill session
  useEffect(() => {
    const fetchOrInitSession = async () => {
      if (sessionId === 'new' && location.state) {
        const { title, description, sport, type, creator, price, image } = location.state;
        setTitle(title || '');
        setDescription(description || '');
        setSport(sport || selectedSport);
        setObjects([]);
      } else if (sessionId !== 'new') {
        try {
          const sessionRef = doc(firestore, 'public_sessions', sessionId);
          const sessionSnap = await getDoc(sessionRef);
          if (sessionSnap.exists()) {
            const data = sessionSnap.data();
            setTitle(data.title || '');
            setDescription(data.description || '');
            setSport(data.sport || selectedSport);
            setObjects(data.objects || []);
            setOrientation(data.orientation || 'landscape');
          } else {
            Swal.fire('Error', 'Session not found.', 'error');
            navigate('/sessions');
          }
        } catch (error) {
          console.error('Error fetching session:', error);
          Swal.fire('Error', 'Failed to load session.', 'error');
          navigate('/sessions');
        }
      }
      setLoading(false);
    };
    fetchOrInitSession();
  }, [sessionId, navigate, location.state, selectedSport]);

  // Add object
  const addObject = (type) => {
    setSelectedTool(type);
  };

  // Handle canvas click
  const handleCanvasClick = (e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const id = Date.now();

    // Check if click is on an object
    const clickedObject = stage.getIntersection(pointer);
    if (!clickedObject || !clickedObject.getParent().id().startsWith('object-')) {
      setSelectedObjectId(null);
      setSelectedNode(null);
      setEditingObjectId(null); // Exit edit mode if clicking outside
    }

    if (selectedTool === 'line') {
      if (!lineStartPoint) {
        setLineStartPoint(pointer);
      } else {
        const newLine = {
          id,
          type: 'line',
          points: [lineStartPoint.x, lineStartPoint.y, pointer.x, pointer.y],
          color: '#FFA500',
          size: 3,
        };
        setObjects([...objects, newLine]);
        setLineStartPoint(null);
        setTempLine(null);
        setSelectedTool(null);
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
          color: '#FFFF00',
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        setObjects([...objects, newSquare]);
        setSquareStartPoint(null);
        setTempSquare(null);
        setSelectedTool(null);
      }
    } else if (selectedTool === 'text') {
      const newText = {
        id,
        type: 'text',
        x: pointer.x,
        y: pointer.y,
        text: 'New Text',
        fontSize: 20,
        fill: '#000000',
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      setObjects([...objects, newText]);
      setSelectedTool(null);
    } else if (selectedTool === 'paragraph') {
      const newParagraph = {
        id,
        type: 'paragraph',
        x: pointer.x,
        y: pointer.y,
        text: 'New Paragraph\nAdd your text here',
        fontSize: 16,
        fill: '#000000',
        width: 200,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      setObjects([...objects, newParagraph]);
      setSelectedTool(null);
    } else if (selectedTool === 'pitch') {
      const pitchImage = {
        GAA: gaaPitchImage,
        Soccer: soccerPitchImage,
        Basketball: basketballCourtImage,
        AmericanFootball: amFootballPitchImage,
      }[sport] || gaaPitchImage;
      const newPitch = {
        id,
        type: 'pitch',
        subtype: sport,
        x: pointer.x,
        y: pointer.y,
        width: 200,
        height: 150,
        image: pitchImage,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      setObjects([...objects, newPitch]);
      setSelectedTool(null);
    } else if (selectedTool) {
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
        color: selectedTool === 'player' ? '#000000' : null,
      };
      setObjects([...objects, newObj]);
      setSelectedTool(null);
    }
  };

  // Handle mouse move for preview
  const handleMouseMove = (e) => {
    if (!selectedTool || !stageRef.current) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    if (selectedTool === 'line' && lineStartPoint) {
      setTempLine({
        points: [lineStartPoint.x, lineStartPoint.y, pointer.x, pointer.y],
        color: '#FFA500',
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
        color: '#FFFF00',
        size: 2,
      });
    }
  };

  const handleMouseUp = () => {
    setTempLine(null);
    setTempSquare(null);
  };

  // Select object
  const handleSelectObject = (id) => {
    setSelectedObjectId(id);
    const stage = stageRef.current;
    if (!stage) return;
    const layer = stage.findOne('#objects-layer');
    if (!layer) return;
    const node = layer.findOne(`#object-${id}`);
    if (node) {
      setSelectedNode(node);
    }
  };

  // Drag object
  const handleDragObject = (e, id) => {
    const updated = objects.map((obj) => {
      if (obj.id === id) {
        return { ...obj, x: e.target.x(), y: e.target.y() };
      }
      return obj;
    });
    setObjects(updated);
  };

  // Start editing text
  const startEditing = (id) => {
    const obj = objects.find((o) => o.id === id);
    if (obj && (obj.type === 'text' || obj.type === 'paragraph')) {
      setEditingObjectId(id);
      setEditText(obj.text);
    }
  };

  // Save edited text
  const saveEdit = () => {
    if (editingObjectId !== null) {
      const updatedObjects = objects.map((obj) =>
        obj.id === editingObjectId ? { ...obj, text: editText } : obj
      );
      setObjects(updatedObjects);
      setEditingObjectId(null);
      setEditText('');
    }
  };

  // Render objects
  const renderObjects = () => {
    return objects.map((obj) => {
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
              draggable
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
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
              draggable
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
            >
              <Circle radius={obj.size / 2} fill={obj.color || '#000000'} />
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
              stroke={obj.color || '#FFA500'}
              strokeWidth={obj.size || 3}
              draggable
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
              stroke={obj.color || '#FFFF00'}
              strokeWidth={2}
              draggable
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
            />
          );
        case 'text':
          return (
            <Text
              key={obj.id}
              id={`object-${obj.id}`}
              x={obj.x}
              y={obj.y}
              text={obj.text}
              fontSize={obj.fontSize}
              fill={obj.fill || '#000000'}
              draggable
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDblClick={() => startEditing(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
            />
          );
        case 'paragraph':
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
              draggable
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDblClick={() => startEditing(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
            />
          );
        case 'pitch':
          return (
            <Group
              key={obj.id}
              id={`object-${obj.id}`}
              x={obj.x}
              y={obj.y}
              draggable
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
            >
              <KonvaImage
                image={obj.image}
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

  // Render edit field
  const renderEditField = () => {
    if (!editingObjectId) return null;

    const obj = objects.find((o) => o.id === editingObjectId);
    if (!obj) return null;

    const stage = stageRef.current;
    const scale = stageDimensions.scale || 1;
    const canvasRect = canvasAreaRef.current.getBoundingClientRect();

    // Convert Konva coordinates to screen coordinates
    const left = (obj.x * scale) + canvasRect.left - window.scrollX;
    const top = (obj.y * scale) + canvasRect.top - window.scrollY;
    const width = obj.type === 'paragraph' ? obj.width * scale : undefined;

    return (
      <TextField
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onBlur={saveEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            saveEdit();
          }
        }}
        multiline={obj.type === 'paragraph'}
        autoFocus
        sx={{
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          width: width ? `${width}px` : 'auto',
          backgroundColor: '#fff',
          '& .MuiInputBase-root': {
            fontSize: `${obj.fontSize * scale}px`,
            color: obj.fill || '#000000',
          },
        }}
      />
    );
  };

  // Handle orientation change
  const handleOrientationChange = (event, newOrientation) => {
    if (newOrientation) {
      setOrientation(newOrientation);
    }
  };

  // Drag-and-drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const tool = e.dataTransfer.getData('tool');
    if (!tool || ['line', 'square'].includes(tool)) return;

    const stage = stageRef.current;
    if (!stage) return;

    const canvas = stage.getContent();
    const rect = canvas.getBoundingClientRect();

    const stageX = e.clientX - rect.left;
    const stageY = e.clientY - rect.top;

    if (stageX < 0 || stageX > stage.width() || stageY < 0 || stageY > stage.height()) return;

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
          fill: '#000000',
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
          fill: '#000000',
          width: 200,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        break;
      case 'pitch':
        const pitchImage = {
          GAA: gaaPitchImage,
          Soccer: soccerPitchImage,
          Basketball: basketballCourtImage,
          AmericanFootball: amFootballPitchImage,
        }[sport] || gaaPitchImage;
        newObj = {
          id,
          type: 'pitch',
          subtype: sport,
          x: stageX,
          y: stageY,
          width: 200,
          height: 150,
          image: pitchImage,
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
          color: tool === 'player' ? '#000000' : null,
        };
    }

    setObjects([...objects, newObj]);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  // Render controls for selected object
  const renderControls = () => {
    if (!selectedNode || !selectedObjectId || editingObjectId) return null;

    const obj = objects.find((o) => o.id === selectedObjectId);
    if (!obj) return null;

    const boundingBox = selectedNode.getClientRect();
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;
    const offset = boundingBox.width / 2 + 20;

    return (
      <Group>
        <KonvaImage
          image={(() => {
            const img = new window.Image();
            img.src = 'data:image/svg+xml,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#5e2e8f" d="${FaArrowsAlt().props.children.props.d}"/></svg>`
            );
            return img;
          })()}
          x={centerX - 12}
          y={centerY - offset - 12}
          width={24}
          height={24}
          draggable
          onDragMove={(e) => {
            const newX = e.target.x() + 12;
            const newY = e.target.y() + offset + 12;
            selectedNode.position({ x: newX - boundingBox.width / 2, y: newY - boundingBox.height / 2 });
            selectedNode.getLayer().batchDraw();
          }}
          onDragEnd={(e) => {
            const newX = e.target.x() + 12;
            const newY = e.target.y() + offset + 12;
            const updated = objects.map((o) =>
              o.id === selectedObjectId
                ? { ...o, x: newX - boundingBox.width / 2, y: newY - boundingBox.height / 2 }
                : o
            );
            setObjects(updated);
            e.target.position({ x: centerX - 12, y: centerY - offset - 12 });
          }}
        />
        <KonvaImage
          image={(() => {
            const img = new window.Image();
            img.src = 'data:image/svg+xml,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#5e2e8f" d="${FaRedo().props.children.props.d}"/></svg>`
            );
            return img;
          })()}
          x={centerX + offset}
          y={centerY - 12}
          width={24}
          height={24}
          draggable
          onDragMove={(e) => {
            const dx = e.target.x() - centerX;
            const dy = e.target.y() - centerY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            selectedNode.rotation(angle);
            selectedNode.getLayer().batchDraw();
          }}
          onDragEnd={(e) => {
            const dx = e.target.x() - centerX;
            const dy = e.target.y() - centerY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const updated = objects.map((o) =>
              o.id === selectedObjectId ? { ...o, rotation: angle } : o
            );
            setObjects(updated);
            e.target.position({ x: centerX + offset, y: centerY - 12 });
          }}
        />
      </Group>
    );
  };

  // Save session
  const saveSession = async () => {
    if (!title.trim()) {
      Swal.fire('Error', 'Please enter a session title.', 'warning');
      return;
    }

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
      objects,
      orientation,
    };

    try {
      if (sessionId === 'new') {
        const docRef = await addDoc(collection(firestore, 'public_sessions'), sessionData);
        console.log('Session created with ID:', docRef.id);
        await Swal.fire('Success', 'Session saved!', 'success');
        navigate('/sessions');
      } else {
        const sessionRef = doc(firestore, 'public_sessions', sessionId);
        await updateDoc(sessionRef, sessionData);
        await Swal.fire('Success', 'Session updated!', 'success');
        navigate('/sessions');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      Swal.fire('Error', `Failed to save session: ${error.message}`, 'error');
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      const uri = stage.toDataURL({ pixelRatio: 2 });
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const baseDimensions = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
      const scale = Math.min(pdfWidth / (baseDimensions.width / 72), pdfHeight / (baseDimensions.height / 72));
      pdf.addImage(uri, 'PNG', 0, 0, baseDimensions.width * scale, baseDimensions.height * scale);
      pdf.save(`${title || 'session'}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Swal.fire('Error', 'Failed to export PDF.', 'error');
    }
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <EditorContainer>
      <Sidebar>
        <Typography variant="h6" sx={{ color: '#5e2e8f' }}>
          {sessionId === 'new' ? 'Create New Session' : `Edit Session: ${title}`}
        </Typography>

        <SidebarSection>
          <Typography variant="subtitle1" sx={{ color: '#fff' }}>Tools</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <ToolRow>
              <IconButton
                draggable
                onDragStart={(e) => e.dataTransfer.setData('tool', 'cone')}
                onClick={() => addObject('cone')}
                sx={{ color: '#fff', cursor: 'grab' }}
                title="Add Cone"
              >
                <img src={coneImg} alt="Cone" style={{ width: 24, height: 24 }} />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Cone</Typography>
            </ToolRow>
            <ToolRow>
              <IconButton
                draggable
                onDragStart={(e) => e.dataTransfer.setData('tool', 'ball')}
                onClick={() => addObject('ball')}
                sx={{ color: '#fff', cursor: 'grab' }}
                title="Add Ball"
              >
                <img src={ballImg} alt="Ball" style={{ width: 24, height: 24 }} />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Ball</Typography>
            </ToolRow>
            <ToolRow>
              <IconButton
                draggable
                onDragStart={(e) => e.dataTransfer.setData('tool', 'player')}
                onClick={() => addObject('player')}
                sx={{ color: '#fff', cursor: 'grab' }}
                title="Add Player"
              >
                <img src={playerImg} alt="Player" style={{ width: 24, height: 24 }} />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Player</Typography>
            </ToolRow>
            <ToolRow>
              <IconButton onClick={() => addObject('line')} sx={{ color: '#fff' }} title="Add Line">
                <FaPlus />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Line</Typography>
            </ToolRow>
            <ToolRow>
              <IconButton onClick={() => addObject('square')} sx={{ color: '#fff' }} title="Add Square">
                <FaSquare />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Square</Typography>
            </ToolRow>
            <ToolRow>
              <IconButton
                draggable
                onDragStart={(e) => e.dataTransfer.setData('tool', 'text')}
                onClick={() => addObject('text')}
                sx={{ color: '#fff', cursor: 'grab' }}
                title="Add Text"
              >
                <FaTextHeight />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Text</Typography>
            </ToolRow>
            <ToolRow>
              <IconButton
                draggable
                onDragStart={(e) => e.dataTransfer.setData('tool', 'paragraph')}
                onClick={() => addObject('paragraph')}
                sx={{ color: '#fff', cursor: 'grab' }}
                title="Add Paragraph"
              >
                <FaParagraph />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Paragraph</Typography>
            </ToolRow>
            <ToolRow>
              <IconButton
                draggable
                onDragStart={(e) => e.dataTransfer.setData('tool', 'pitch')}
                onClick={() => addObject('pitch')}
                sx={{ color: '#fff', cursor: 'grab' }}
                title="Add Pitch"
              >
                <FaImage />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Pitch</Typography>
            </ToolRow>
          </Box>
        </SidebarSection>

        <SidebarSection>
          <Typography variant="subtitle1" sx={{ color: '#fff' }}>Orientation</Typography>
          <ToggleButtonGroup
            value={orientation}
            exclusive
            onChange={handleOrientationChange}
            sx={{ alignSelf: 'flex-start' }}
          >
            <ToggleButton value="landscape" sx={{ color: '#fff' }}>
              Landscape
            </ToggleButton>
            <ToggleButton value="portrait" sx={{ color: '#fff' }}>
              Portrait
            </ToggleButton>
          </ToggleButtonGroup>
        </SidebarSection>

        <SidebarSection>
          <TextField
            label="Session Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            sx={{
              input: { color: '#fff' },
              label: { color: '#fff' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#5e2e8f' },
              },
            }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={4}
            fullWidth
            sx={{
              input: { color: '#fff' },
              label: { color: '#fff' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#5e2e8f' },
              },
            }}
          />
          <FormControl fullWidth>
            <InputLabel sx={{ color: '#ffffff' }}>Sport (for Pitch)</InputLabel>
            <Select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              label="Sport (for Pitch)"
              sx={{
                color: '#ffffff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#5e2e8f' },
              }}
            >
              <MenuItem value="GAA">GAA</MenuItem>
              <MenuItem value="Soccer">Soccer</MenuItem>
              <MenuItem value="Basketball">Basketball</MenuItem>
              <MenuItem value="AmericanFootball">American Football</MenuItem>
            </Select>
          </FormControl>
        </SidebarSection>

        <SidebarSection>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={saveSession}
              startIcon={<FaSave />}
              sx={{ flex: 1, backgroundColor: '#5e2e8f' }}
            >
              Save
            </Button>
            <Button
              variant="contained"
              onClick={exportToPDF}
              startIcon={<FaFileExport />}
              sx={{ flex: 1, backgroundColor: '#5e2e8f' }}
            >
              Export
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/sessions')}
              startIcon={<FaTrash />}
              sx={{ flex: 1, backgroundColor: '#5e2e8f' }}
            >
              Back
            </Button>
          </Box>
        </SidebarSection>
      </Sidebar>

      <CanvasArea
        ref={canvasAreaRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          border: isDraggingOver ? '2px dashed #5e2e8f' : 'none',
        }}
      >
        <Stage
          ref={stageRef}
          width={stageDimensions.width}
          height={stageDimensions.height}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={stageDimensions.width}
              height={stageDimensions.height}
              fill="#FFFFFF"
            />
          </Layer>
          <Layer id="objects-layer">
            {renderObjects()}
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
          <Layer>
            {renderControls()}
          </Layer>
        </Stage>
        {renderEditField()}
      </CanvasArea>
    </EditorContainer>
  );
};

export default SessionEditor;