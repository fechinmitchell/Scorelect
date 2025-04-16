import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from './firebase';
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
  Typography,
  CircularProgress,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import jsPDF from 'jspdf';
import { 
  FaFileExport, 
  FaArrowLeft, 
  FaArrowRight, 
  FaHome, 
  FaInfoCircle,
  FaChevronLeft,
  FaTrash
} from 'react-icons/fa';

// Import images (same as before)
import coneImg from './images/cone.png';
import ballImg from './images/ball.png';
import gaaPitchImg from './images/gaa-pitch.png';
import soccerPitchImg from './images/soccer_collect_main.png';
import basketballCourtImg from './images/basketball_collect_main.png';
import amFootballPitchImg from './images/amfootball_collect_main.png';

// Styled Components
const DetailContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  color: '#e0e0e0',
  backgroundColor: '#1a1a1a',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const HeaderSection = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(1),
  backgroundColor: '#5e2e8f',
  color: '#ffffff',
  boxShadow: '0 4px 20px rgba(94, 46, 143, 0.3)',
}));

const InfoCard = styled(Card)(({ theme }) => ({
  height: '100%',
  backgroundColor: '#2c2c2c',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
  borderRadius: theme.spacing(1),
  transition: 'transform 0.2s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 24px rgba(94, 46, 143, 0.3)',
  },
}));

const CanvasContainer = styled(Paper)(({ theme }) => ({
  flex: 1,
  backgroundColor: '#2c2c2c',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(2),
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minHeight: '500px',
}));

const CanvasArea = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  position: 'relative',
  border: '1px solid #3a3a3a',
  borderRadius: theme.spacing(1),
  backgroundColor: '#252525',
}));

const CanvasControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(2, 0),
}));

const PageIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  backgroundColor: '#333333',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(0.5, 2),
  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.25)',
  color: '#e0e0e0',
}));

const NavButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(3),
  padding: theme.spacing(1, 3),
  textTransform: 'none',
  fontWeight: 600,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  backgroundColor: '#3a3a3a',
  color: '#e0e0e0',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(94, 46, 143, 0.4)',
    backgroundColor: '#444444',
  },
}));

const ExportButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#5e2e8f',
  color: '#ffffff',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(1, 3),
  textTransform: 'none',
  fontWeight: 600,
  boxShadow: '0 2px 8px rgba(94, 46, 143, 0.3)',
  '&:hover': {
    backgroundColor: '#7a3db8',
    boxShadow: '0 4px 12px rgba(94, 46, 143, 0.5)',
  },
}));

const BackButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#333333',
  color: '#a67fcc',
  border: '2px solid #5e2e8f',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(1, 3),
  textTransform: 'none',
  fontWeight: 600,
  '&:hover': {
    backgroundColor: '#444444',
  },
}));

const SessionDetail = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showInfo, setShowInfo] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canvasAreaRef = useRef(null);

  const A4_LANDSCAPE = { width: 842, height: 595 };
  const A4_PORTRAIT = { width: 595, height: 842 };

  const [coneImage] = useImage(coneImg);
  const [ballImage] = useImage(ballImg);
  const [gaaPitchImage] = useImage(gaaPitchImg);
  const [soccerPitchImage] = useImage(soccerPitchImg);
  const [basketballCourtImage] = useImage(basketballCourtImg);
  const [amFootballPitchImage] = useImage(amFootballPitchImg);

  const getStageDimensions = () => {
    if (!canvasAreaRef.current) {
      return session?.orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
    }

    const containerWidth = canvasAreaRef.current.offsetWidth;
    const containerHeight = canvasAreaRef.current.offsetHeight;
    const baseDimensions = session?.orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;

    const scaleX = containerWidth / baseDimensions.width;
    const scaleY = containerHeight / baseDimensions.height;
    const scale = Math.min(scaleX, scaleY);

    return {
      width: baseDimensions.width * scale,
      height: baseDimensions.height * scale,
      scale,
    };
  };

  const [stageDimensions, setStageDimensions] = useState({ width: 842, height: 595 });

  useEffect(() => {
    const updateDimensions = () => {
      setStageDimensions(getStageDimensions());
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [session?.orientation]);

  const stageRef = useRef(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionRef = doc(firestore, 'public_sessions', sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
          const sessionData = sessionSnap.data();
          setSession(sessionData);
          
          // Check if current user is the creator
          // Assuming you have some auth context or service to get current user
          // This is a placeholder - replace with your actual auth implementation
          const currentUser = getCurrentUser(); // Replace with your auth method
          if (currentUser && sessionData.createdBy === currentUser.uid) {
            setIsCreator(true);
          }
        } else {
          console.error('Session not found:', sessionId);
          navigate('/sessions');
        }
      } catch (error) {
        console.error('Error fetching session:', error);
        navigate('/sessions');
      }
      setLoading(false);
    };
    
    // Placeholder function - replace with your actual auth implementation
    const getCurrentUser = () => {
      // This is just a placeholder, replace with your actual auth logic
      // For example, if using Firebase Auth:
      // return auth.currentUser;
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    };
    
    fetchSession();
  }, [sessionId, navigate]);

  const renderObjects = () => {
    if (!session || !session.pages || !session.pages[currentPage]) {
      return null;
    }

    const pitchImageMap = {
      GAA: gaaPitchImage,
      Soccer: soccerPitchImage,
      Basketball: basketballCourtImage,
      AmericanFootball: amFootballPitchImage,
    };

    return session.pages[currentPage].objects.map((obj) => {
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
              rotation={obj.rotation || 0}
              scaleX={obj.scaleX || 1}
              scaleY={obj.scaleY || 1}
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
              rotation={obj.rotation || 0}
              scaleX={obj.scaleX || 1}
              scaleY={obj.scaleY || 1}
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
              rotation={obj.rotation || 0}
              scaleX={obj.scaleX || 1}
              scaleY={obj.scaleY || 1}
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
              rotation={obj.rotation || 0}
              scaleX={obj.scaleX || 1}
              scaleY={obj.scaleY || 1}
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
              rotation={obj.rotation || 0}
              scaleX={obj.scaleX || 1}
              scaleY={obj.scaleY || 1}
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
              rotation={obj.rotation || 0}
              scaleX={obj.scaleX || 1}
              scaleY={obj.scaleY || 1}
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

  if (loading) {
    return (
      <DetailContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress sx={{ color: '#a67fcc' }} size={60} thickness={4} />
        </Box>
      </DetailContainer>
    );
  }

  const handleDeleteSession = async () => {
    try {
      setDeleteLoading(true);
      await deleteDoc(doc(firestore, 'public_sessions', sessionId));
      setDeleteLoading(false);
      setOpenDeleteDialog(false);
      navigate('/sessions', { state: { message: 'Session deleted successfully!' } });
    } catch (error) {
      console.error('Error deleting session:', error);
      setDeleteLoading(false);
      setOpenDeleteDialog(false);
      // Consider adding a toast or notification here to show the error
    }
  };
  
  const openDeleteConfirmation = () => {
    setOpenDeleteDialog(true);
  };
  
  const closeDeleteConfirmation = () => {
    setOpenDeleteDialog(false);
  };
  
  const exportToPDF = async () => {
    if (!session || !session.pages) return;

    const pdf = new jsPDF({
      orientation: session.orientation || 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const baseDimensions = session.orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
    const scale = Math.min(pdfWidth / (baseDimensions.width / 72), pdfHeight / (baseDimensions.height / 72));

    for (let i = 0; i < session.pages.length; i++) {
      if (i > 0) pdf.addPage();
      setCurrentPage(i);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
      pdf.addImage(uri, 'PNG', 0, 0, baseDimensions.width * scale, baseDimensions.height * scale);
    }

    pdf.save(`${session.title || 'session'}.pdf`);
    setCurrentPage(0);
  };

  if (!session) {
    return (
      <DetailContainer>
        <Box sx={{ textAlign: 'center', padding: 4 }}>
          <Typography variant="h5" sx={{ color: '#a67fcc' }}>No session data available.</Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/sessions')}
            sx={{ mt: 3, backgroundColor: '#5e2e8f' }}
            startIcon={<FaHome />}
          >
            Return to Sessions
          </Button>
        </Box>
      </DetailContainer>
    );
  }

  return (
    <DetailContainer>
      {/* Header Section */}
      <HeaderSection>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {session.title}
            </Typography>
            <Typography variant="subtitle1" sx={{ mt: 1, opacity: 0.9 }}>
              {session.description}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {isCreator && (
              <Button
                variant="contained"
                startIcon={<FaTrash />}
                onClick={openDeleteConfirmation}
                sx={{ 
                  backgroundColor: '#c53030', 
                  '&:hover': { backgroundColor: '#e53e3e' }
                }}
              >
                Delete
              </Button>
            )}
            <BackButton
              startIcon={<FaChevronLeft />}
              onClick={() => navigate('/sessions')}
            >
              Back to Sessions
            </BackButton>
          </Box>
        </Box>
      </HeaderSection>

      {/* Info Cards */}
      {showInfo && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <InfoCard>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#a67fcc', mb: 1 }}>
                  Sport Type
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip 
                    label={session.sport} 
                    sx={{ 
                      backgroundColor: '#5e2e8f40', 
                      color: '#a67fcc',
                      fontWeight: 600,
                      fontSize: '1rem',
                      padding: '16px 6px'
                    }} 
                  />
                </Box>
              </CardContent>
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={4}>
            <InfoCard>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#a67fcc', mb: 1 }}>
                  Pages
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip 
                    label={`${session.pages?.length || 1} ${session.pages?.length === 1 ? 'Page' : 'Pages'}`}
                    sx={{ 
                      backgroundColor: '#5e2e8f40', 
                      color: '#a67fcc',
                      fontWeight: 600,
                      fontSize: '1rem',
                      padding: '16px 6px'
                    }} 
                  />
                </Box>
              </CardContent>
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={4}>
            <InfoCard>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#a67fcc', mb: 1 }}>
                  Layout
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip 
                    label={session.orientation?.charAt(0).toUpperCase() + session.orientation?.slice(1) || 'Landscape'}
                    sx={{ 
                      backgroundColor: '#5e2e8f40', 
                      color: '#a67fcc',
                      fontWeight: 600,
                      fontSize: '1rem',
                      padding: '16px 6px'
                    }} 
                  />
                </Box>
              </CardContent>
            </InfoCard>
          </Grid>
        </Grid>
      )}

      {/* Canvas Section */}
      <CanvasContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#e0e0e0' }}>
            Session Diagram
          </Typography>
          <Tooltip title={showInfo ? "Hide session info" : "Show session info"}>
            <IconButton onClick={() => setShowInfo(!showInfo)} size="small">
              <FaInfoCircle color="#a67fcc" />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider sx={{ mb: 2, backgroundColor: '#3a3a3a' }} />
        
        <CanvasArea ref={canvasAreaRef}>
          <Stage
            ref={stageRef}
            width={stageDimensions.width}
            height={stageDimensions.height}
          >
            <Layer>
              <Rect
                x={0}
                y={0}
                width={stageDimensions.width}
                height={stageDimensions.height}
                fill={session.pages?.[currentPage]?.canvasColor || '#FFFFFF'}
              />
            </Layer>
            <Layer id="objects-layer">{renderObjects()}</Layer>
          </Stage>
        </CanvasArea>

        <CanvasControls>
          <NavButton
            startIcon={<FaArrowLeft />}
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            sx={{ 
              backgroundColor: currentPage === 0 ? '#222222' : '#3a3a3a',
              color: currentPage === 0 ? '#555555' : '#a67fcc'
            }}
          >
            Previous
          </NavButton>

          <PageIndicator>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              Page {currentPage + 1} of {session.pages?.length || 1}
            </Typography>
          </PageIndicator>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <ExportButton
              onClick={exportToPDF}
              startIcon={<FaFileExport />}
            >
              Export PDF
            </ExportButton>
            
            <NavButton
              endIcon={<FaArrowRight />}
              onClick={() => setCurrentPage((prev) => Math.min(session.pages.length - 1, prev + 1))}
              disabled={currentPage === session.pages.length - 1}
              sx={{ 
                backgroundColor: currentPage === session.pages.length - 1 ? '#222222' : '#3a3a3a',
                color: currentPage === session.pages.length - 1 ? '#555555' : '#a67fcc'
              }}
            >
              Next
            </NavButton>
          </Box>
        </CanvasControls>
      </CanvasContainer>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={closeDeleteConfirmation}
        PaperProps={{
          sx: {
            backgroundColor: '#2c2c2c',
            color: '#e0e0e0',
            borderRadius: '8px',
            maxWidth: '500px'
          }
        }}
      >
        <DialogTitle sx={{ color: '#e53e3e', fontWeight: 600 }}>
          Delete Session
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#e0e0e0' }}>
            Are you sure you want to delete this training session? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button 
            onClick={closeDeleteConfirmation} 
            sx={{ 
              color: '#a67fcc',
              '&:hover': { backgroundColor: 'rgba(166, 127, 204, 0.1)' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSession}
            disabled={deleteLoading}
            sx={{ 
              backgroundColor: '#c53030', 
              color: 'white',
              '&:hover': { backgroundColor: '#e53e3e' }
            }}
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : <FaTrash />}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </DetailContainer>
  );
};

export default SessionDetail;