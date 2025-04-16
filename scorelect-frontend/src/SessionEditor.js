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
import { FaPlus, FaTrash, FaSave, FaFileExport, FaTextHeight, FaSquare, FaImage, FaParagraph, FaArrowRight } from 'react-icons/fa';

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

// Styled Components
const EditorContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  color: '#ffffff',
  backgroundColor: '#2c2c2c',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'row',
  gap: theme.spacing(4),
  position: 'relative',
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
  position: 'relative',
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
  position: 'relative',
}));

const ColorSquare = styled(Box)(({ color }) => ({
  width: 20,
  height: 20,
  backgroundColor: color,
  border: '1px solid #fff',
  cursor: 'pointer',
}));

const ColorPickerWrapper = styled(Box)({
  position: 'relative',
  '& input[type="color"]': {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: '20px',
    height: '20px',
    opacity: 0,
  },
});

const SessionEditor = ({ selectedSport = 'GAA' }) => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState(selectedSport);
  const [pages, setPages] = useState([{ objects: [], canvasColor: '#FFFFFF' }]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedTool, setSelectedTool] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orientation, setOrientation] = useState('landscape');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingObjectId, setEditingObjectId] = useState(null);
  const [editText, setEditText] = useState('');

  const [toolColors, setToolColors] = useState({
    player: '#000000',
    line: '#FFA500',
    square: '#FFFF00',
    text: '#000000',
    paragraph: '#000000',
  });

  const A4_LANDSCAPE = { width: 842, height: 595 };
  const A4_PORTRAIT = { width: 595, height: 842 };

  const canvasAreaRef = useRef(null);
  const stageRef = useRef(null);

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

  useEffect(() => {
    const updateDimensions = () => {
      setStageDimensions(getStageDimensions());
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [orientation]);

  const [lineStartPoint, setLineStartPoint] = useState(null);
  const [tempLine, setTempLine] = useState(null);
  const [squareStartPoint, setSquareStartPoint] = useState(null);
  const [tempSquare, setTempSquare] = useState(null);

  const [coneImage] = useImage(coneImg);
  const [ballImage] = useImage(ballImg);
  const [playerImage] = useImage(playerImg);
  const [gaaPitchImage] = useImage(gaaPitchImg);
  const [soccerPitchImage] = useImage(soccerPitchImg);
  const [basketballCourtImage] = useImage(basketballCourtImg);
  const [amFootballPitchImage] = useImage(amFootballPitchImg);
  const [moveImage] = useImage(moveIcon);
  const [rotateImage] = useImage(rotateIcon);
  const [resizeImage] = useImage(resizeIcon);
  const [deleteImage] = useImage(deleteIcon);

  useEffect(() => {
    const fetchOrInitSession = async () => {
      if (sessionId === 'new' && location.state) {
        const { title, description, sport, type, creator, price, image, orientation } = location.state;
        setTitle(title || '');
        setDescription(description || '');
        setSport(sport || selectedSport);
        setOrientation(orientation || 'landscape');
        setPages([{ objects: [], canvasColor: '#FFFFFF' }]);
      } else if (sessionId !== 'new') {
        try {
          const sessionRef = doc(firestore, 'public_sessions', sessionId);
          const sessionSnap = await getDoc(sessionRef);
          if (sessionSnap.exists()) {
            const data = sessionSnap.data();
            setTitle(data.title || '');
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

  const addObject = (type) => {
    setSelectedTool(type);
  };

  const handleCanvasClick = (e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const id = Date.now();

    const clickedObject = stage.getIntersection(pointer);
    if (!clickedObject || !clickedObject.getParent()?.id().startsWith('object-')) {
      setSelectedObjectId(null);
      setSelectedNode(null);
      setEditingObjectId(null);
    }

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
          color: toolColors.square,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        updatePageObjects([...pages[currentPage].objects, newSquare]);
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
        fill: toolColors.text,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      updatePageObjects([...pages[currentPage].objects, newText]);
      setSelectedTool(null);
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
      setSelectedTool(null);
    } else if (selectedTool === 'pitch') {
      const newPitch = {
        id,
        type: 'pitch',
        subtype: sport,
        x: pointer.x,
        y: pointer.y,
        width: 150,
        height: 200,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      updatePageObjects([...pages[currentPage].objects, newPitch]);
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
        color: selectedTool === 'player' ? toolColors.player : null,
      };
      updatePageObjects([...pages[currentPage].objects, newObj]);
      setSelectedTool(null);
    }
  };

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

  const handleMouseUp = () => {
    setTempLine(null);
    setTempSquare(null);
  };

  const handleSelectObject = (id) => {
    setSelectedObjectId(id);
    const stage = stageRef.current;
    if (!stage) return;
    const layer = stage.findOne('#objects-layer');
    if (!layer) return;
    const node = layer.findOne(`#object-${id}`);
    if (node) {
      setSelectedNode(node);
    } else {
      setSelectedObjectId(null);
      setSelectedNode(null);
    }
  };

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

  const startEditing = (id) => {
    const obj = pages[currentPage].objects.find((o) => o.id === id);
    if (obj && (obj.type === 'text' || obj.type === 'paragraph')) {
      setEditingObjectId(id);
      setEditText(obj.text);
      setSelectedObjectId(null);
      setSelectedNode(null);
    }
  };

  const saveEdit = () => {
    if (editingObjectId !== null) {
      const updatedObjects = pages[currentPage].objects.map((obj) =>
        obj.id === editingObjectId ? { ...obj, text: editText } : obj
      );
      updatePageObjects(updatedObjects);
      setEditingObjectId(null);
      setEditText('');
    }
  };

  const updatePageObjects = (newObjects) => {
    const updatedPages = [...pages];
    updatedPages[currentPage] = { ...updatedPages[currentPage], objects: newObjects };
    setPages(updatedPages);
  };

  const renderObjects = () => {
    const pitchImageMap = {
      GAA: gaaPitchImage,
      Soccer: soccerPitchImage,
      Basketball: basketballCourtImage,
      AmericanFootball: amFootballPitchImage,
    };

    return pages[currentPage].objects.map((obj) => {
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
              rotation={obj.rotation}
              scaleX={obj.scaleX}
              scaleY={obj.scaleY}
              onClick={() => handleSelectObject(obj.id)}
              onTap={() => handleSelectObject(obj.id)}
              onDragEnd={(e) => handleDragObject(e, obj.id)}
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
          const pitchImage = pitchImageMap[obj.subtype] || gaaPitchImage;
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

  const renderEditField = () => {
    if (!editingObjectId) return null;

    const obj = pages[currentPage].objects.find((o) => o.id === editingObjectId);
    if (!obj) return null;

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
          top: '50px',
          left: '60%',
          transform: 'translateX(-50%)',
          width: obj.type === 'paragraph' ? '400px' : '200px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          '& .MuiInputBase-root': {
            fontSize: `${obj.fontSize}px`,
            color: obj.fill || '#000000',
            padding: '8px',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            border: '1px solid #5e2e8f',
          },
          zIndex: 10,
        }}
      />
    );
  };

  const handleOrientationChange = (event, newOrientation) => {
    if (newOrientation) {
      setOrientation(newOrientation);
    }
  };

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
          x: stageX,
          y: stageY,
          width: 150,
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
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const renderControls = () => {
    if (!selectedNode || !selectedObjectId || editingObjectId) return null;

    const obj = pages[currentPage].objects.find((o) => o.id === selectedObjectId);
    if (!obj) return null;

    const boundingBox = selectedNode.getClientRect();
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;
    const offset = Math.max(boundingBox.width, boundingBox.height) / 2 + 20;

    return (
      <Group>
        <KonvaImage
          image={moveImage}
          x={centerX - 12}
          y={centerY - offset - 12}
          width={24}
          height={24}
          draggable
          onDragMove={(e) => {
            const newX = e.target.x() + 12;
            const newY = e.target.y() + 12 + offset;
            selectedNode.position({ x: newX - boundingBox.width / 2, y: newY - boundingBox.height / 2 });
            selectedNode.getLayer().batchDraw();
          }}
          onDragEnd={(e) => {
            const newX = e.target.x() + 12;
            const newY = e.target.y() + 12 + offset;
            const updated = pages[currentPage].objects.map((o) => {
              if (o.id === selectedObjectId) {
                if (o.type === 'line') {
                  const centerX = (o.points[0] + o.points[2]) / 2;
                  const centerY = (o.points[1] + o.points[3]) / 2;
                  const dx = newX - boundingBox.width / 2 - centerX;
                  const dy = newY - boundingBox.height / 2 - centerY;
                  return {
                    ...o,
                    points: o.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy)),
                  };
                }
                return { ...o, x: newX - boundingBox.width / 2, y: newY - boundingBox.height / 2 };
              }
              return o;
            });
            updatePageObjects(updated);
            e.target.position({ x: centerX - 12, y: centerY - offset - 12 });
          }}
        />
        <KonvaImage
          image={rotateImage}
          x={centerX + offset}
          y={centerY - 12}
          width={14}
          height={14}
          draggable
          onDragMove={(e) => {
            const dx = e.target.x() + 7 - centerX;
            const dy = e.target.y() + 7 - centerY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            selectedNode.rotation(angle);
            selectedNode.getLayer().batchDraw();
          }}
          onDragEnd={(e) => {
            const dx = e.target.x() + 7 - centerX;
            const dy = e.target.y() + 7 - centerY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const updated = pages[currentPage].objects.map((o) =>
              o.id === selectedObjectId ? { ...o, rotation: angle } : o
            );
            updatePageObjects(updated);
            e.target.position({ x: centerX + offset, y: centerY - 12 });
          }}
        />
        <KonvaImage
          image={resizeImage}
          x={centerX + offset}
          y={centerY + offset - 12}
          width={14}
          height={14}
          draggable
          onDragMove={(e) => {
            const dx = e.target.x() + 7 - centerX;
            const dy = e.target.y() + 7 - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const originalDistance = offset;
            const newScale = Math.max(0.1, distance / originalDistance);
            selectedNode.scaleX(newScale);
            selectedNode.scaleY(newScale);
            selectedNode.getLayer().batchDraw();
          }}
          onDragEnd={(e) => {
            const dx = e.target.x() + 7 - centerX;
            const dy = e.target.y() + 7 - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const originalDistance = offset;
            const newScale = Math.max(0.1, distance / originalDistance);
            const updated = pages[currentPage].objects.map((o) =>
              o.id === selectedObjectId ? { ...o, scaleX: newScale, scaleY: newScale } : o
            );
            updatePageObjects(updated);
            e.target.position({ x: centerX + offset, y: centerY + offset - 12 });
          }}
        />
        <KonvaImage
          image={deleteImage}
          x={centerX - offset - 12}
          y={centerY - 12}
          width={14}
          height={14}
          onClick={() => {
            const updatedObjects = pages[currentPage].objects.filter((o) => o.id !== selectedObjectId);
            updatePageObjects(updatedObjects);
            setSelectedObjectId(null);
            setSelectedNode(null);
          }}
          onTap={() => {
            const updatedObjects = pages[currentPage].objects.filter((o) => o.id !== selectedObjectId);
            updatePageObjects(updatedObjects);
            setSelectedObjectId(null);
            setSelectedNode(null);
          }}
        />
      </Group>
    );
  };

  const addNewPage = () => {
    setPages([...pages, { objects: [], canvasColor: '#FFFFFF' }]);
    setCurrentPage(pages.length);
  };

  const deletePage = () => {
    if (pages.length <= 1) {
      Swal.fire('Warning', 'Cannot delete the last page.', 'warning');
      return;
    }
    const updatedPages = pages.filter((_, index) => index !== currentPage);
    setPages(updatedPages);
    setCurrentPage(currentPage >= updatedPages.length ? updatedPages.length - 1 : currentPage);
    setSelectedObjectId(null);
    setSelectedNode(null);
    setEditingObjectId(null);
  };

  const nextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedObjectId(null);
      setSelectedNode(null);
      setEditingObjectId(null);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedObjectId(null);
      setSelectedNode(null);
      setEditingObjectId(null);
    }
  };

  const setPageCanvasColor = (color) => {
    const updatedPages = [...pages];
    updatedPages[currentPage] = { ...updatedPages[currentPage], canvasColor: color };
    setPages(updatedPages);
  };

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
      await Swal.fire('Success', 'Session saved!', 'success');
      // Delay navigation to ensure Firestore write propagates
      await new Promise((resolve) => setTimeout(resolve, 500));
      navigate(`/session-detail/${savedSessionId}`);
    } catch (error) {
      console.error('Error saving session:', error, { sessionData, sessionId });
      Swal.fire('Error', `Failed to save session: ${error.message}`, 'error');
    }
  };

  const exportToPDF = async () => {
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const baseDimensions = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
    const scale = Math.min(pdfWidth / (baseDimensions.width / 72), pdfHeight / (baseDimensions.height / 72));

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) pdf.addPage();
      const stage = stageRef.current;
      setCurrentPage(i);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const uri = stage.toDataURL({ pixelRatio: 2 });
      pdf.addImage(uri, 'PNG', 0, 0, baseDimensions.width * scale, baseDimensions.height * scale);
    }

    pdf.save(`${title || 'session'}.pdf`);
    setCurrentPage(0);
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
              <ColorPickerWrapper>
                <ColorSquare
                  color={toolColors.player}
                  onClick={() => document.getElementById('color-player').click()}
                />
                <input
                  type="color"
                  id="color-player"
                  value={toolColors.player}
                  onChange={(e) => setToolColors({ ...toolColors, player: e.target.value })}
                />
              </ColorPickerWrapper>
            </ToolRow>
            <ToolRow>
              <IconButton onClick={() => addObject('line')} sx={{ color: '#fff' }} title="Add Line">
                <FaPlus />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Line</Typography>
              <ColorPickerWrapper>
                <ColorSquare
                  color={toolColors.line}
                  onClick={() => document.getElementById('color-line').click()}
                />
                <input
                  type="color"
                  id="color-line"
                  value={toolColors.line}
                  onChange={(e) => setToolColors({ ...toolColors, line: e.target.value })}
                />
              </ColorPickerWrapper>
            </ToolRow>
            <ToolRow>
              <IconButton onClick={() => addObject('square')} sx={{ color: '#fff' }} title="Add Square">
                <FaSquare />
              </IconButton>
              <Typography sx={{ color: '#fff' }}>Square</Typography>
              <ColorPickerWrapper>
                <ColorSquare
                  color={toolColors.square}
                  onClick={() => document.getElementById('color-square').click()}
                />
                <input
                  type="color"
                  id="color-square"
                  value={toolColors.square}
                  onChange={(e) => setToolColors({ ...toolColors, square: e.target.value })}
                />
              </ColorPickerWrapper>
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
              <ColorPickerWrapper>
                <ColorSquare
                  color={toolColors.text}
                  onClick={() => document.getElementById('color-text').click()}
                />
                <input
                  type="color"
                  id="color-text"
                  value={toolColors.text}
                  onChange={(e) => setToolColors({ ...toolColors, text: e.target.value })}
                />
              </ColorPickerWrapper>
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
              <ColorPickerWrapper>
                <ColorSquare
                  color={toolColors.paragraph}
                  onClick={() => document.getElementById('color-paragraph').click()}
                />
                <input
                  type="color"
                  id="color-paragraph"
                  value={toolColors.paragraph}
                  onChange={(e) => setToolColors({ ...toolColors, paragraph: e.target.value })}
                />
              </ColorPickerWrapper>
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
          <Typography variant="subtitle1" sx={{ color: '#fff' }}>Canvas</Typography>
          <ToolRow>
            <Typography sx={{ color: '#fff' }}>Background Color</Typography>
            <ColorPickerWrapper>
              <ColorSquare
                color={pages[currentPage].canvasColor}
                onClick={() => document.getElementById('color-canvas').click()}
              />
              <input
                type="color"
                id="color-canvas"
                value={pages[currentPage].canvasColor}
                onChange={(e) => setPageCanvasColor(e.target.value)}
              />
            </ColorPickerWrapper>
          </ToolRow>
        </SidebarSection>

        <SidebarSection>
          <Typography variant="subtitle1" sx={{ color: '#fff' }}>Pages</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={addNewPage}
              sx={{ backgroundColor: '#5e2e8f' }}
            >
              Add Page
            </Button>
            <Button
              variant="contained"
              onClick={deletePage}
              sx={{ backgroundColor: '#5e2e8f' }}
            >
              Delete Page
            </Button>
            <Button
              variant="contained"
              onClick={prevPage}
              disabled={currentPage === 0}
              sx={{ backgroundColor: '#5e2e8f' }}
            >
            </Button>
            <Button
              variant="contained"
              onClick={nextPage}
              disabled={currentPage === pages.length - 1}
              sx={{ backgroundColor: '#5e2e8f' }}
            >
              <FaArrowRight />
            </Button>
            <Typography sx={{ color: '#fff' }}>
              Page {currentPage + 1} of {pages.length}
            </Typography>
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
              fill={pages[currentPage].canvasColor}
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
      </CanvasArea>
      {renderEditField()}
    </EditorContainer>
  );
};

export default SessionEditor;