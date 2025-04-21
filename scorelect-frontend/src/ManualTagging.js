import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  IconButton,
  Slider,
  Select,
  MenuItem,
  TextField,
  Chip,
  Divider,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { doc, setDoc, collection } from 'firebase/firestore';
import { firestore } from './firebase';
import { useAuth } from './AuthContext';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import FlagIcon from '@mui/icons-material/Flag';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import DownloadIcon from '@mui/icons-material/Download';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import VideocamIcon from '@mui/icons-material/Videocam';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// Styled Components
const PageContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  minHeight: '100vh',
  padding: theme.spacing(4, 0),
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#121212',
  color: '#ffffff',
}));

const VideoContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  backgroundColor: '#000',
  borderRadius: theme.spacing(1),
  overflow: 'hidden',
  aspectRatio: '16/9',
  width: '100%',
  boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
}));

const VideoControlsContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: theme.spacing(1),
  background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const ControlsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
}));

const ProgressBar = styled(Slider)(({ theme }) => ({
  color: '#5e2e8f',
  height: 4,
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
    '&:hover': {
      boxShadow: '0 0 0 8px rgba(94, 46, 143, 0.16)'
    }
  },
  '& .MuiSlider-rail': {
    opacity: 0.5,
    backgroundColor: '#bfbfbf',
  },
  padding: '15px 0',
}));

const SectionCard = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
  marginTop: theme.spacing(2),
  border: '1px solid #333',
  height: '100%',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: '#5e2e8f',
  marginBottom: theme.spacing(2),
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const TagButton = styled(Button)(({ theme, colorscheme = 'primary' }) => ({
  backgroundColor: colorscheme === 'primary' ? '#5e2e8f' :
                colorscheme === 'success' ? '#28a745' :
                colorscheme === 'error' ? '#dc3545' :
                colorscheme === 'warning' ? '#ffc107' : '#1f1f1f',
  color: '#ffffff',
  padding: theme.spacing(1),
  borderRadius: theme.spacing(1),
  fontWeight: 'normal',
  transition: 'all 0.2s ease',
  textTransform: 'none',
  margin: theme.spacing(0.5),
  '&:hover': {
    backgroundColor: colorscheme === 'primary' ? '#6d3ca1' :
                   colorscheme === 'success' ? '#2fbc4e' :
                   colorscheme === 'error' ? '#e04555' :
                   colorscheme === 'warning' ? '#ffcb2d' : '#2d2d2d',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  color: '#aaa',
  '&.Mui-selected': {
    color: '#5e2e8f',
    fontWeight: 'bold',
  },
}));

const TagChip = styled(Chip)(({ theme, type }) => ({
  margin: theme.spacing(0.5),
  backgroundColor:
    type === 'Possession' ? 'rgba(94, 46, 143, 0.2)' :
    type === 'Defense'    ? 'rgba(220, 53, 69, 0.2)' :
    type === 'Scoring'    ? 'rgba(40, 167, 69, 0.2)' :
    type === 'Set Pieces' ? 'rgba(255, 193, 7, 0.2)' :
    type === 'Turnovers'  ? 'rgba(255, 140, 0, 0.2)' :
                            'rgba(150, 150, 150, 0.2)',
  color:
    type === 'Possession' ? '#9b7cb7' :
    type === 'Defense'    ? '#e57373' :
    type === 'Scoring'    ? '#81c784' :
    type === 'Set Pieces' ? '#fff176' :
    type === 'Turnovers'  ? '#ffb74d' :
                            '#fff',
  borderRadius: '16px',
  '& .MuiChip-deleteIcon': {
    color: 'rgba(255, 255, 255, 0.7)',
    '&:hover': {
      color: '#fff',
    },
  },
}));

const TimelineContainer = styled(Box)(({ theme }) => ({
  height: 80,
  position: 'relative',
  backgroundColor: '#1a1a1a',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1),
  marginTop: theme.spacing(2),
  border: '1px solid #444',
  overflow: 'hidden',
}));

const TimelineMark = styled(Box)(({ theme, category, active }) => ({
  position: 'absolute',
  width: 6,
  height: active === 'true' ? 50 : 40,
  backgroundColor:
    category === 'Possession' ? '#5e2e8f' :
    category === 'Defense'    ? '#dc3545' :
    category === 'Scoring'    ? '#28a745' :
    category === 'Set Pieces' ? '#ffc107' :
    category === 'Turnovers'  ? '#ff8c00' : '#999',
  borderRadius: '2px',
  top: active === 'true' ? 15 : 20,
  transform: 'translateX(-3px)',
  cursor: 'pointer',
  transition: 'height 0.2s ease, top 0.2s ease',
  zIndex: active === 'true' ? 2 : 1,
  '&:hover': {
    height: 50,
    top: 15,
    zIndex: 2,
  },  
}));

const PitchContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '300px',
  backgroundColor: '#1D6E1D',
  borderRadius: theme.spacing(1),
  position: 'relative',
  border: '2px solid white',
  margin: '20px 0',
  backgroundImage: 'linear-gradient(0deg, rgba(29,110,29,1) 0%, rgba(39,130,39,1) 100%)',
}));

const PitchMarker = styled(Box)(({ theme, left, top, team }) => ({
  position: 'absolute',
  width: 20,
  height: 20,
  borderRadius: '50%',
  backgroundColor: team === 'home' ? '#5e2e8f' : '#dc3545',
  border: '2px solid white',
  left: `${left}%`,
  top: `${top}%`,
  transform: 'translate(-50%, -50%)',
  cursor: 'pointer',
  zIndex: 10,
  '&:hover': {
    transform: 'translate(-50%, -50%) scale(1.2)',
  },
}));

const ActionButton = styled(Button)(({ theme, color }) => ({
  backgroundColor:
    color === 'primary' ? '#5e2e8f' :
    color === 'success' ? '#28a745':
                         '#dc3545',
  color: '#ffffff',
  padding: theme.spacing(1, 2),
  borderRadius: theme.spacing(1),
  textTransform: 'none',
  fontWeight: 600,
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor:
      color === 'primary' ? '#7e4cb8' :
      color === 'success' ? '#2fbc4e' :
                            '#e04555',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  },
}));

// Main Manual Tagging Component
const ManualTagging = () => {
  // Router & Location
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Get video file or YouTube URL from location state
  const videoFile = location.state?.file;
  const youtubeUrl = location.state?.youtubeUrl;
  const sport     = location.state?.sport || 'GAA';
  
  // Video loading & error state
  const [videoUrl, setVideoUrl]         = useState(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError]     = useState(null);
  const [videoReady, setVideoReady]     = useState(false);
  const [helpDialogOpen, setHelpDialogOpen]     = useState(false);
  const [supportedFormats, setSupportedFormats] = useState([]);
  
  // YouTube player state
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  
  // Validate YouTube URL and extract video ID
  const getYouTubeVideoId = url => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url?.match(regex);
    return match ? match[1] : null;
  };

  // Initial setup
  useEffect(() => {
    if (!videoFile && !youtubeUrl) {
      navigate('/analysis');
      return;
    }

    // Check browser video format support
    checkFormatSupport();

    if (videoFile) {
      // Handle local video file
      const validExtensions = ['mp4'];
      const fileExtension = videoFile.name.split('.').pop().toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
        setVideoError(`Unsupported video format (.${fileExtension}). Please upload an MP4 file.`);
        setVideoLoading(false);
        setHelpDialogOpen(true);
        return;
      }
      try {
        const url = URL.createObjectURL(videoFile);
        setVideoUrl(url);
        setVideoLoading(false);
        return () => URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error creating object URL:", error);
        setVideoError("Could not load video: " + error.message);
        setVideoLoading(false);
        setHelpDialogOpen(true);
      }
    } else if (youtubeUrl) {
      const videoId = getYouTubeVideoId(youtubeUrl);
      if (!videoId) {
        setVideoError("Invalid YouTube URL.");
        setVideoLoading(false);
        setHelpDialogOpen(true);
        return;
      }
      setVideoLoading(false);
      setVideoReady(true);
    }
  }, [videoFile, youtubeUrl, navigate]);

  // Check format support
  const checkFormatSupport = () => {
    const videoTest = document.createElement('video');
    const formats = [];
    if (videoTest.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"').replace('no','')) {
      formats.push({ format:'mp4', codec:'H.264', support:'supported' });
    } else {
      formats.push({ format:'mp4', codec:'H.264', support:'not supported' });
    }
    setSupportedFormats(formats);
  };

  // Refs
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const pitchRef  = useRef(null);
  
  // Video state
  const [playing, setPlaying]       = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume]         = useState(1.0);
  
  // Tagging state
  const [activeTab, setActiveTab]       = useState(0);
  const [tags, setTags]                 = useState([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [currentPosition, setCurrentPosition] = useState({ x:50, y:50 });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAction, setSelectedAction]     = useState('');
  const [selectedTeam, setSelectedTeam]         = useState('home');
  const [selectedPlayer, setSelectedPlayer]     = useState('');
  const [selectedOutcome, setSelectedOutcome]   = useState('');
  const [notes, setNotes]                       = useState('');
  const [currentFrameData, setCurrentFrameData] = useState(null);
  const [currentClipData, setCurrentClipData]   = useState(null);

  // Saving state
  const [datasetName, setDatasetName]       = useState('');
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen]   = useState(false);

  // Mock data
  const teams = {
    home: {
      name: 'Home Team',
      players: [
        { id: 1, number: 1, name: 'Player 1', position: 'Goalkeeper' },
        { id: 2, number: 2, name: 'Player 2', position: 'Back' },
        { id: 3, number: 3, name: 'Player 3', position: 'Back' },
        { id: 4, number: 4, name: 'Player 4', position: 'Back' },
        { id: 5, number: 5, name: 'Player 5', position: 'Midfielder' },
        { id: 6, number: 6, name: 'Player 6', position: 'Midfielder' },
        { id: 7, number: 7, name: 'Player 7', position: 'Forward' },
      ]
    },
    away: {
      name: 'Away Team',
      players: [
        { id: 8, number: 1, name: 'Player 8', position: 'Goalkeeper' },
        { id: 9, number: 2, name: 'Player 9', position: 'Back' },
        { id: 10, number: 3, name: 'Player 10', position: 'Back' },
        { id: 11, number: 4, name: 'Player 11', position: 'Back' },
        { id: 12, number: 5, name: 'Player 12', position: 'Midfielder' },
        { id: 13, number: 6, name: 'Player 13', position: 'Midfielder' },
        { id: 14, number: 7, name: 'Player 14', position: 'Forward' },
      ]
    }
  };

  const tagCategories = [
    {
      id: 'Possession', name: 'Possession', actions: [
        { id: 'kick_pass', name: 'Kick Pass' },
        { id: 'hand_pass', name: 'Hand Pass' },
        { id: 'solo', name: 'Solo Run' },
        { id: 'pickup', name: 'Ball Pickup' },
        { id: 'carry', name: 'Carrying Ball' }
      ]
    },
    {
      id: 'Defense', name: 'Defense', actions: [
        { id: 'tackle', name: 'Tackle' },
        { id: 'block', name: 'Block' },
        { id: 'interception', name: 'Interception' },
        { id: 'pressure', name: 'Pressure Applied' }
      ]
    },
    {
      id: 'Scoring', name: 'Scoring', actions: [
        { id: 'point', name: 'Point' },
        { id: 'goal', name: 'Goal' },
        { id: 'shot_wide', name: 'Shot Wide' },
        { id: 'shot_saved', name: 'Shot Saved' },
        { id: 'shot_blocked', name: 'Shot Blocked' }
      ]
    },
    {
      id: 'Set Pieces', name: 'Set Pieces', actions: [
        { id: 'kickout', name: 'Kickout' },
        { id: 'free_kick', name: 'Free Kick' },
        { id: '45', name: '45m Kick' },
        { id: 'penalty', name: 'Penalty' },
        { id: 'sideline', name: 'Sideline Kick' },
        { id: 'mark', name: 'Mark' }
      ]
    },
    {
      id: 'Turnovers', name: 'Turnovers', actions: [
        { id: 'foul_committed', name: 'Foul Committed' },
        { id: 'foul_won', name: 'Foul Won' },
        { id: 'dispossessed', name: 'Dispossessed' },
        { id: 'offside', name: 'Offside' }
      ]
    }
  ];

  const tagOutcomes = [
    { id: 'success', name: 'Success', color: 'success' },
    { id: 'fail',    name: 'Fail',    color: 'error'   },
    { id: 'neutral', name: 'Neutral', color: 'warning' }
  ];

  // Error handler
  const handleVideoError = e => {
    console.error("Video error:", e);
    const supportedFormatsList = supportedFormats
      .filter(f => f.support === 'supported')
      .map(f => f.format.toUpperCase())
      .join(', ');
    let msg = "Error loading video: The format may not be supported by your browser.";
    if (supportedFormatsList) {
      msg += ` Please upload or convert to ${supportedFormatsList}.`;
    } else {
      msg += " Your browser may not support HTML5 video.";
    }
    setVideoError(msg);
    setVideoReady(false);
    setHelpDialogOpen(true);
  };

  // Metadata loaded
  const handleLoadedMetadata = () => {
    setDuration(videoRef.current.duration);
    setVideoReady(true);
    setVideoLoading(false);
    videoRef.current.volume = volume;
    videoRef.current.playbackRate = playbackRate;
  };

  // YouTube ready
  const onYouTubeReady = event => {
    setYoutubePlayer(event.target);
    setDuration(event.target.getDuration());
    setVideoReady(true);
    setVideoLoading(false);
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (!videoReady) return;
    if (videoFile && videoRef.current) {
      playing ? videoRef.current.pause() : videoRef.current.play();
    } else if (youtubePlayer) {
      playing ? youtubePlayer.pauseVideo() : youtubePlayer.playVideo();
    }
    setPlaying(!playing);
  };

  // Seek bar
  const handleVideoProgress = (e, newValue) => {
    if (!videoReady) return;
    const seekTime = (newValue / 100) * duration;
    if (videoFile && videoRef.current) {
      videoRef.current.currentTime = seekTime;
    } else if (youtubePlayer) {
      youtubePlayer.seekTo(seekTime, true);
    }
    setCurrentTime(seekTime);
  };

  // Skip
  const skip = seconds => {
    if (!videoReady) return;
    let newTime;
    if (videoFile && videoRef.current) {
      newTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration);
      videoRef.current.currentTime = newTime;
    } else if (youtubePlayer) {
      newTime = Math.min(Math.max(currentTime + seconds, 0), duration);
      youtubePlayer.seekTo(newTime, true);
    }
    setCurrentTime(newTime);
  };

  // Rate change
  const handlePlaybackRateChange = e => {
    const newRate = parseFloat(e.target.value);
    setPlaybackRate(newRate);
    if (videoFile && videoRef.current) {
      videoRef.current.playbackRate = newRate;
    } else if (youtubePlayer) {
      youtubePlayer.setPlaybackRate(newRate);
    }
  };

  // Time update
  const handleTimeUpdate = () => {
    if (videoFile && videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // YouTube state
  const handleYouTubeStateChange = event => {
    if (event.data === YouTube.PlayerState.PLAYING) {
      setPlaying(true);
      const interval = setInterval(() => {
        if (youtubePlayer && youtubePlayer.getCurrentTime) {
          setCurrentTime(youtubePlayer.getCurrentTime());
        }
      }, 500);
      return () => clearInterval(interval);
    } else if (event.data === YouTube.PlayerState.PAUSED) {
      setPlaying(false);
    }
  };

  // Format mm:ss
  const formatTime = time => {
    if (time == null) return '00:00';
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  // Pitch click
  const handlePitchClick = e => {
    const rect = pitchRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentPosition({ x, y });
  };

  // Capture frame
  const captureFrame = () => {
    if (videoFile && videoRef.current && canvasRef.current && videoReady) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCurrentFrameData(dataUrl);
        return dataUrl;
      } catch {
        return null;
      }
    }
    setCurrentFrameData(null);
    return null;
  };

  // Record 2s clip
  const recordClip = () => {
    const clipStart = Math.max(0, currentTime - 2);
    const clipEnd   = Math.min(duration, currentTime + 2);
    const info = {
      startTime: clipStart,
      endTime:   clipEnd,
      duration:  clipEnd - clipStart,
      recordedAt: new Date().toISOString()
    };
    setCurrentClipData(info);
    return info;
  };

  // Wait for seek
  const waitForSeek = (videoEl) =>
    new Promise(res => {
      const handler = () => { videoEl.removeEventListener('seeked', handler); res(); };
      videoEl.addEventListener('seeked', handler);
    });

  // Convert base64 to blob
  const base64ToBlob = (base64, type) => {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type });
  };

  // Download one frame at currentTime
  const downloadFrame = () => {
    if (!videoFile || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current, canvas = canvasRef.current;
    const ts = video.currentTime.toFixed(2);
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      const filename = `${datasetName || 'game'}/frames/action_${ts}s.png`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };

  // Download one 4s clip around currentTime (with MP4 option)
  const downloadClip = async () => {
    if (!videoFile || !videoRef.current) return;
    const video = videoRef.current;
    const center = video.currentTime;
    const start = Math.max(0, center - 2);
    const clipDuration = 4; // 4 seconds
    video.currentTime = start;
    await waitForSeek(video);
    const stream = video.captureStream();
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();
    setTimeout(() => recorder.stop(), clipDuration * 1000);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const fn = `${datasetName || 'game'}/clips/clip_${center.toFixed(2)}s.webm`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fn;
      a.click();
      URL.revokeObjectURL(a.href);
      video.currentTime = center;
    };
  };

  // Save frames and clips locally
  const handleLocalSave = async () => {
    if (!tags.length) return alert("No tags to save locally");
    if (!videoFile) return alert("Local save is only available for local video files");

    setSavingInProgress(true);
    const video = videoRef.current;
    const gameName = videoFile.name.replace(/\.[^/.]+$/, "");
    const folderPrefix = datasetName || gameName;

    try {
      const supportsFileSystem = 'showDirectoryPicker' in window;
      let directoryHandle;
      if (supportsFileSystem) {
        try {
          directoryHandle = await window.showDirectoryPicker();
        } catch (err) {
          console.warn("Directory picker canceled or failed:", err);
        }
      }

      let framesFolderHandle, clipsFolderHandle;
      if (directoryHandle) {
        framesFolderHandle = await directoryHandle.getDirectoryHandle(`frames_${folderPrefix}`, { create: true });
        clipsFolderHandle = await directoryHandle.getDirectoryHandle(`clips_${folderPrefix}`, { create: true });
      }

      for (const tag of tags) {
        const timeInVideo = tag.timestamp.toFixed(2);

        // Save frame
        if (tag.frameData) {
          try {
            const frameBlob = base64ToBlob(tag.frameData, 'image/jpeg');
            const frameFileName = `action_${timeInVideo}s.jpg`;

            if (framesFolderHandle) {
              const fileHandle = await framesFolderHandle.getFileHandle(frameFileName, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(frameBlob);
              await writable.close();
              console.log(`Saved frame: ${frameFileName}`);
            } else {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(frameBlob);
              a.download = `frames_${folderPrefix}/${frameFileName}`;
              a.click();
              URL.revokeObjectURL(a.href);
              console.log(`Downloaded frame: ${frameFileName}`);
            }
          } catch (err) {
            console.error(`Failed to save frame at ${timeInVideo}s:`, err);
          }
        }

        // Save clip
        if (tag.clipData) {
          try {
            const clipStart = Math.max(0, tag.timestamp - 2);
            const clipEnd = Math.min(duration, tag.timestamp + 2);
            video.currentTime = clipStart;
            await waitForSeek(video);

            const stream = video.captureStream();
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            const chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.start();

            await new Promise(resolve => setTimeout(resolve, (clipEnd - clipStart) * 1000));
            recorder.stop();

            const clipBlob = await new Promise(resolve => {
              recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
            });

            const clipFileName = `clip_${timeInVideo}s.webm`;

            if (clipsFolderHandle) {
              const fileHandle = await clipsFolderHandle.getFileHandle(clipFileName, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(clipBlob);
              await writable.close();
              console.log(`Saved clip: ${clipFileName}`);
            } else {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(clipBlob);
              a.download = `clips_${folderPrefix}/${clipFileName}`;
              a.click();
              URL.revokeObjectURL(a.href);
              console.log(`Downloaded clip: ${clipFileName}`);
            }

            video.currentTime = tag.timestamp;
            await waitForSeek(video);
          } catch (err) {
            console.error(`Failed to save clip at ${timeInVideo}s:`, err);
          }
        }
      }

      alert("Local save completed successfully!");
    } catch (error) {
      console.error("Error during local save:", error);
      alert("Error during local save: " + error.message);
    } finally {
      setSavingInProgress(false);
    }
  };

  // Open tag
  const handleOpenTagDialog = () => {
    if (!videoReady) return;
    if (videoFile && videoRef.current && playing) {
      videoRef.current.pause(); setPlaying(false);
    } else if (youtubePlayer && playing) {
      youtubePlayer.pauseVideo(); setPlaying(false);
    }
    captureFrame();
    recordClip();
    setTagDialogOpen(true);
  };

  // Close tag
  const handleCloseTagDialog = () => {
    setTagDialogOpen(false);
    setSelectedCategory('');
    setSelectedAction('');
    setSelectedOutcome('');
    setNotes('');
    setSelectedPlayer('');
  };

  // Add tag
  const handleAddTag = () => {
    if (!selectedCategory || !selectedAction) return;
    const newTag = {
      id: `tag-${Date.now()}`,
      timestamp: currentTime,
      category: selectedCategory,
      action: selectedAction,
      team: selectedTeam,
      player: selectedPlayer,
      outcome: selectedOutcome,
      position: { ...currentPosition },
      notes,
      frameData: currentFrameData,
      clipData: currentClipData,
    };
    setTags([...tags, newTag]);
    handleCloseTagDialog();
  };

  // Delete tag
  const handleDeleteTag = tagId => {
    setTags(tags.filter(t => t.id !== tagId));
  };

  // Jump to tag timestamp
  const handleJumpToTag = time => {
    if (!videoReady) return;
    if (videoFile && videoRef.current) {
      videoRef.current.currentTime = time;
    } else if (youtubePlayer) {
      youtubePlayer.seekTo(time, true);
    }
    setCurrentTime(time);
  };

  // Save tags to Firestore
  const handleSave = () => {
    if (!currentUser) return alert("Please sign in to save your tags");
    if (!tags.length) return alert("No tags to save");
    setSaveDialogOpen(true);
  };

  // Confirm and save dataset to Firestore
  const confirmSave = async () => {
    if (!datasetName) return alert("Please enter a dataset name");
    setSavingInProgress(true);
    try {
      const gameName = youtubeUrl
        ? `YouTube-${getYouTubeVideoId(youtubeUrl)}`
        : videoFile.name.replace(/\.[^/.]+$/, "");
      const gameData = {
        gameName,
        sport,
        matchDate: new Date().toISOString(),
        datasetName,
        youtubeUrl: youtubeUrl || null,
        gameData: tags.map(tag => ({
          action: tag.action,
          category: tag.category,
          team: tag.team,
          playerName: tag.player,
          outcome: tag.outcome,
          timestamp: tag.timestamp,
          x: tag.position.x,
          y: tag.position.y,
          notes: tag.notes,
        })),
      };
      const gameDocRef = doc(
        collection(firestore, 'savedGames', currentUser.uid, 'games'),
        gameData.gameName
      );
      await setDoc(gameDocRef, gameData);
      setSavingInProgress(false);
      setSaveDialogOpen(false);
      alert("Game data saved successfully!");
      navigate('/analysis');
    } catch (error) {
      console.error("Error saving data:", error);
      setSavingInProgress(false);
      alert("Error saving data: " + error.message);
    }
  };

  // Export tags JSON
  const handleExport = () => {
    if (!tags.length) return alert("No tags to export");
    const fileName = youtubeUrl
      ? `YouTube-${getYouTubeVideoId(youtubeUrl)}`
      : videoFile.name;
    const gameData = {
      fileName,
      sport,
      exportDate: new Date().toISOString(),
      youtubeUrl: youtubeUrl || null,
      tags: tags.map(tag => ({
        timestamp: tag.timestamp,
        formattedTime: formatTime(tag.timestamp),
        category: tag.category,
        action: tag.action,
        team: tag.team,
        player: tag.player,
        outcome: tag.outcome,
        position: tag.position,
        notes: tag.notes,
      })),
    };
    const jsonData = JSON.stringify(gameData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}-tags.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Go back
  const handleGoBack = () => navigate('/analysis');

  return (
    <PageContainer maxWidth="xl">
      {/* Header */}
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:3 }}>
        <Button startIcon={<ArrowBackIcon/>} onClick={handleGoBack} sx={{ color:'#fff' }}>
          Back to Analysis
        </Button>
        <Typography variant="h4" sx={{ color:'#fff', fontWeight:600, textShadow:'0 2px 4px rgba(0,0,0,0.3)' }}>
          Manual Video Tagging
        </Typography>
        <IconButton onClick={()=>setHelpDialogOpen(true)} sx={{ color:'#fff' }}>
          <HelpOutlineIcon/>
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {/* Video Player Section */}
        <Grid item xs={12} lg={8}>
          <VideoContainer>
            {videoLoading ? (
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:2 }}>
                <CircularProgress color="secondary"/>
                <Typography>Loading video...</Typography>
              </Box>
            ) : videoError ? (
              <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:2, p:4, textAlign:'center' }}>
                <ErrorOutlineIcon sx={{ fontSize:48, color:'#dc3545' }}/>
                <Typography variant="h6" color="error">Video Error</Typography>
                <Typography>{videoError}</Typography>
                <Button variant="contained" color="primary" onClick={()=>setHelpDialogOpen(true)} startIcon={<HelpOutlineIcon/>} sx={{ mt:2 }}>
                  Format Help
                </Button>
              </Box>
            ) : (
              <>
                {videoFile ? (
                  <video
                    ref={videoRef}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onError={handleVideoError}
                    style={{ width:'100%', height:'100%' }}
                    onClick={togglePlay}
                    playsInline
                    controls={false}
                  >
                    <source src={videoUrl} type="video/mp4"/>
                    Your browser does not support HTML5 video.
                  </video>
                ) : (
                  <YouTube
                    videoId={getYouTubeVideoId(youtubeUrl)}
                    opts={{ width:'100%', height:'100%', playerVars:{ autoplay:0, controls:0, modestbranding:1, rel:0 } }}
                    onReady={onYouTubeReady}
                    onStateChange={handleYouTubeStateChange}
                    style={{ width:'100%', height:'100%' }}
                  />
                )}

                <VideoControlsContainer>
                  <ControlsRow>
                    <Typography variant="body2">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Typography>
                    <Select
                      value={playbackRate}
                      onChange={handlePlaybackRateChange}
                      size="small"
                      sx={{
                        backgroundColor:'rgba(0,0,0,0.5)',
                        color:'#fff',
                        height:30,
                        '& .MuiSelect-select': { p:'2px 8px' }
                      }}
                    >
                      {[0.25,0.5,0.75,1,1.5,2].map(r=>(
                        <MenuItem key={r} value={r}>{r}x</MenuItem>
                      ))}
                    </Select>
                  </ControlsRow>

                  <ProgressBar value={(currentTime/duration)*100 || 0} onChange={handleVideoProgress}/>

                  <ControlsRow>
                    <Box sx={{ display:'flex', gap:1 }}>
                      <IconButton size="small" onClick={()=>skip(-10)} sx={{color:'#fff'}}><FastRewindIcon/></IconButton>
                      <IconButton size="small" onClick={()=>skip(-5)}  sx={{color:'#fff'}}><SkipPreviousIcon/></IconButton>
                      <IconButton size="small" onClick={togglePlay} sx={{color:'#fff'}}>
                        {playing ? <PauseIcon/> : <PlayArrowIcon/>}
                      </IconButton>
                      <IconButton size="small" onClick={()=>skip(5)}   sx={{color:'#fff'}}><SkipNextIcon/></IconButton>
                      <IconButton size="small" onClick={()=>skip(10)}  sx={{color:'#fff'}}><FastForwardIcon/></IconButton>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<FlagIcon/>}
                      onClick={handleOpenTagDialog}
                      sx={{ backgroundColor:'#5e2e8f','&:hover':{backgroundColor:'#7e4cb8'} }}
                    >
                      Tag Event
                    </Button>
                  </ControlsRow>
                </VideoControlsContainer>
              </>
            )}
          </VideoContainer>

          <TimelineContainer>
            {tags.map((tag,i)=>(
              <TimelineMark
                key={i}
                category={tag.category}
                active={(Math.abs(tag.timestamp-currentTime) < 0.5).toString()}
                style={{ left:`${(tag.timestamp/duration)*100}%` }}
                onClick={()=>handleJumpToTag(tag.timestamp)}
                title={`${tag.category}: ${tag.action} (${formatTime(tag.timestamp)})`}
              />
            ))}
          </TimelineContainer>

          <canvas ref={canvasRef} style={{ display:'none' }}/>

          <PitchContainer ref={pitchRef} onClick={handlePitchClick}>
            <PitchMarker left={currentPosition.x} top={currentPosition.y} team={selectedTeam}/>
            {tags.map((tag,i)=>(
              <PitchMarker key={i} left={tag.position.x} top={tag.position.y} team={tag.team} sx={{ opacity:0.6, width:16, height:16 }}/>
            ))}
          </PitchContainer>
        </Grid>

        {/* Tagging & Download Controls */}
        <Grid item xs={12} lg={4}>
          <Tabs
            value={activeTab}
            onChange={(e,v)=>setActiveTab(v)}
            variant="fullWidth"
            sx={{
              backgroundColor:'#1a1a1a',
              borderRadius:'8px 8px 0 0',
              '& .MuiTabs-indicator':{backgroundColor:'#5e2e8f'}
            }}
          >
            <StyledTab label="Tagged Events"/>
            <StyledTab label="Quick Tags"/>
          </Tabs>

          <SectionCard sx={{ borderRadius:'0 0 8px 8px', maxHeight:600, overflowY:'auto' }}>
            {activeTab === 0 ? (
              <>
                <SectionTitle variant="h6"><FlagIcon fontSize="small"/> Tags ({tags.length})</SectionTitle>
                {tags.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign:'center', py:2 }}>
                    No tags yet. Click "Tag Event" to add one.
                  </Typography>
                ) : (
                  tags.map((tag,i)=>(
                    <Box key={i} sx={{ p:1, mb:1, borderRadius:1, backgroundColor:'rgba(25,25,25,0.5)', border:'1px solid #333' }}>
                      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <Typography sx={{ fontWeight:'bold', color:'#fff' }}>{formatTime(tag.timestamp)}</Typography>
                        <Box>
                          <IconButton size="small" onClick={()=>handleJumpToTag(tag.timestamp)} sx={{color:'#5e2e8f'}}>
                            <PlayArrowIcon fontSize="small"/>
                          </IconButton>
                          <IconButton size="small" onClick={()=>handleDeleteTag(tag.id)} sx={{color:'#dc3545'}}>
                            <DeleteIcon fontSize="small"/>
                          </IconButton>
                        </Box>
                      </Box>
                      <TagChip label={tag.category} type={tag.category} size="small"/>
                      <TagChip label={tag.action} type={tag.category} size="small"/>
                      {tag.outcome && <TagChip label={tag.outcome} type={tag.category} size="small"/>}
                      <Typography variant="body2" sx={{ mt:1, color:'#aaa' }}>
                        {tag.team}: {tag.player||'No player'}
                      </Typography>
                      {tag.notes && (
                        <Typography variant="body2" sx={{ mt:0.5, color:'#ddd', fontSize:'0.8rem' }}>
                          {tag.notes}
                        </Typography>
                      )}
                    </Box>
                  ))
                )}
              </>
            ) : (
              <>
                <SectionTitle variant="h6"><SportsSoccerIcon fontSize="small"/> Quick Tags</SectionTitle>
                {tagCategories.map(cat=>(
                  <Box key={cat.id} sx={{ mb:2 }}>
                    <Typography sx={{
                      fontWeight:'bold',
                      color:
                        cat.id==='Possession'? '#9b7cb7':
                        cat.id==='Defense'? '#e57373':
                        cat.id==='Scoring'? '#81c784':
                        cat.id==='Set Pieces'? '#fff176':
                        cat.id==='Turnovers'? '#ffb74d':'#fff',
                      mb:1
                    }}>{cat.name}</Typography>
                    <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.5 }}>
                      {cat.actions.map(act=>(
                        <TagButton
                          key={act.id}
                          size="small"
                          colorscheme={
                            cat.id==='Possession'? 'primary':
                            cat.id==='Defense'? 'error':
                            cat.id==='Scoring'? 'success':
                            cat.id==='Set Pieces'? 'warning':'primary'
                          }
                          onClick={()=>{
                            setSelectedCategory(cat.id);
                            setSelectedAction(act.name);
                            captureFrame();
                            recordClip();
                            setTagDialogOpen(true);
                          }}
                        >
                          {act.name}
                        </TagButton>
                      ))}
                    </Box>
                  </Box>
                ))}
              </>
            )}
          </SectionCard>

          {/* Action & Download Buttons */}
          <Box sx={{ mt:2, display:'grid', gridTemplateColumns:'1fr 1fr', gap:2 }}>
            <ActionButton color="success" onClick={handleSave} startIcon={<SaveIcon/>} fullWidth disabled={savingInProgress}>
              {savingInProgress ? 'Saving...' : 'Save Dataset'}
            </ActionButton>
            <ActionButton color="primary" onClick={handleExport} startIcon={<DownloadIcon/>} fullWidth>
              Export Tags
            </ActionButton>
            <ActionButton color="primary" onClick={downloadFrame} startIcon={<ScreenshotMonitorIcon/>} fullWidth>
              Download Frame
            </ActionButton>
            <ActionButton color="primary" onClick={downloadClip} startIcon={<VideocamIcon/>} fullWidth>
              Download Clip
            </ActionButton>
            <ActionButton color="primary" onClick={handleLocalSave} startIcon={<SaveIcon/>} fullWidth disabled={savingInProgress}>
              {savingInProgress ? 'Saving...' : 'Local Save'}
            </ActionButton>
          </Box>

          {/* Capture Data Preview */}
          <Grid container spacing={2} sx={{ mt:2 }}>
            <Grid item xs={6}>
              <SectionCard>
                <SectionTitle variant="subtitle1"><ScreenshotMonitorIcon fontSize="small"/> Frame</SectionTitle>
                {currentFrameData ? (
                  <Box component="img" src={currentFrameData} sx={{ width:'100%', borderRadius:1, border:'1px solid #444' }}/>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign:'center', py:2 }}>
                    {youtubeUrl ? 'Frame capture not available for YouTube videos' : 'No frame captured'}
                  </Typography>
                )}
              </SectionCard>
            </Grid>
            <Grid item xs={6}>
              <SectionCard>
                <SectionTitle variant="subtitle1"><VideocamIcon fontSize="small"/> Clip</SectionTitle>
                {currentClipData ? (
                  <Box sx={{ color:'#aaa', fontSize:'0.9rem' }}>
                    <Typography>Start: {formatTime(currentClipData.startTime)}</Typography>
                    <Typography>End: {formatTime(currentClipData.endTime)}</Typography>
                    <Typography>Duration: {currentClipData.duration.toFixed(2)}s</Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign:'center', py:2 }}>
                    No clip recorded
                  </Typography>
                )}
              </SectionCard>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Tag Dialog */}
      <Dialog
        open={tagDialogOpen}
        onClose={handleCloseTagDialog}
        PaperProps={{ sx: { backgroundColor:'#222', color:'#fff', borderRadius:2, maxWidth:'600px', width:'100%' } }}
      >
        <DialogTitle sx={{ borderBottom:'1px solid #444' }}>
          Tag Event at {formatTime(currentTime)}
          <IconButton onClick={handleCloseTagDialog} sx={{ position:'absolute', right:8, top:8, color:'#aaa' }}>
            <CloseIcon/>
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt:2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Category</Typography>
              <Select
                value={selectedCategory}
                onChange={e=>setSelectedCategory(e.target.value)}
                fullWidth
                sx={{
                  backgroundColor:'#333', color:'#fff',
                  '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                  '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
                }}
              >
                <MenuItem value=""><em>Select Category</em></MenuItem>
                {tagCategories.map(cat=>(
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Action</Typography>
              <Select
                value={selectedAction}
                onChange={e=>setSelectedAction(e.target.value)}
                fullWidth
                disabled={!selectedCategory}
                sx={{
                  backgroundColor:'#333', color:'#fff',
                  '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                  '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
                }}
              >
                <MenuItem value=""><em>Select Action</em></MenuItem>
                {selectedCategory && tagCategories.find(cat=>cat.id===selectedCategory)?.actions.map(action=>(
                  <MenuItem key={action.id} value={action.name}>{action.name}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Team</Typography>
              <Select
                value={selectedTeam}
                onChange={e=>setSelectedTeam(e.target.value)}
                fullWidth
                sx={{
                  backgroundColor:'#333', color:'#fff',
                  '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                  '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
                }}
              >
                <MenuItem value="home">{teams.home.name}</MenuItem>
                <MenuItem value="away">{teams.away.name}</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Player</Typography>
              <Select
                value={selectedPlayer}
                onChange={e=>setSelectedPlayer(e.target.value)}
                fullWidth
                sx={{
                  backgroundColor:'#333', color:'#fff',
                  '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                  '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
                }}
              >
                <MenuItem value=""><em>No Player</em></MenuItem>
                {teams[selectedTeam]?.players.map(player=>(
                  <MenuItem key={player.id} value={player.name}>
                    {player.number}. {player.name} ({player.position})
                  </MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Outcome</Typography>
              <Select
                value={selectedOutcome}
                onChange={e=>setSelectedOutcome(e.target.value)}
                fullWidth
                sx={{
                  backgroundColor:'#333', color:'#fff',
                  '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                  '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
                }}
              >
                <MenuItem value=""><em>Select Outcome</em></MenuItem>
                {tagOutcomes.map(outcome=>(
                  <MenuItem key={outcome.id} value={outcome.name}>{outcome.name}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb:1 }}>Notes</Typography>
              <TextField
                value={notes}
                onChange={e=>setNotes(e.target.value)}
                fullWidth
                multiline
                rows={3}
                sx={{
                  backgroundColor:'#333', color:'#fff',
                  '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                  '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p:2, borderTop:'1px solid #444' }}>
          <Button onClick={handleCloseTagDialog} sx={{ color:'#aaa' }}>Cancel</Button>
          <Button onClick={handleAddTag} variant="contained" startIcon={<AddIcon/>} sx={{ backgroundColor:'#5e2e8f','&:hover':{backgroundColor:'#7e4cb8'} }}>
            Add Tag
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={()=>setSaveDialogOpen(false)}
        PaperProps={{ sx:{ backgroundColor:'#222', color:'#fff', borderRadius:2, maxWidth:'400px', width:'100%' } }}
      >
        <DialogTitle sx={{ borderBottom:'1px solid #444' }}>
          Save Dataset
          <IconButton onClick={()=>setSaveDialogOpen(false)} sx={{ position:'absolute', right:8, top:8, color:'#aaa' }}>
            <CloseIcon/>
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt:2 }}>
          <Typography variant="subtitle2" sx={{ mb:1 }}>Dataset Name</Typography>
          <TextField
            value={datasetName}
            onChange={e=>setDatasetName(e.target.value)}
            fullWidth
            placeholder="Enter a name for your dataset"
            sx={{
              backgroundColor:'#333', color:'#fff',
              '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
              '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
              '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p:2, borderTop:'1px solid #444' }}>
          <Button onClick={()=>setSaveDialogOpen(false)} sx={{ color:'#aaa' }}>Cancel</Button>
          <Button onClick={confirmSave} variant="contained" disabled={savingInProgress} startIcon={<SaveIcon/>} sx={{ backgroundColor:'#5e2e8f','&:hover':{backgroundColor:'#7e4cb8'} }}>
            {savingInProgress ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog */}
      <Dialog
        open={helpDialogOpen}
        onClose={()=>setHelpDialogOpen(false)}
        PaperProps={{ sx:{ backgroundColor:'#222', color:'#fff', borderRadius:2, maxWidth:'500px', width:'100%' } }}
      >
        <DialogTitle sx={{ borderBottom:'1px solid #444' }}>
          Video Format Help
          <IconButton onClick={()=>setHelpDialogOpen(false)} sx={{ position:'absolute', right:8, top:8, color:'#aaa' }}>
            <CloseIcon/>
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt:2 }}>
          <Typography variant="h6" sx={{ mb:2 }}>Supported Video Formats</Typography>
          {supportedFormats.length > 0 ? (
            supportedFormats.map((format, idx) => (
              <Typography key={idx} sx={{ mb:1 }}>
                <strong>{format.format.toUpperCase()}</strong> ({format.codec}): {format.support}
              </Typography>
            ))
          ) : (
            <Typography>Unable to detect supported formats. Please ensure your browser supports HTML5 video.</Typography>
          )}
          <Divider sx={{ my:2, borderColor:'#444' }}/>
          <Typography variant="h6" sx={{ mb:2 }}>YouTube Videos</Typography>
          <Typography>Enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=...). Note that frame capture is not available for YouTube videos due to streaming restrictions.</Typography>
          <Divider sx={{ my:2, borderColor:'#444' }}/>
          <Typography variant="h6" sx={{ mb:2 }}>Troubleshooting</Typography>
          <Typography sx={{ mb:1 }}>- Ensure your video is in MP4 format with H.264 codec.</Typography>
          <Typography sx={{ mb:1 }}>- For YouTube videos, verify the URL is correct and the video is publicly accessible.</Typography>
          <Typography>- Try a different browser if you encounter issues (Chrome, Firefox, Safari recommended).</Typography>
        </DialogContent>
        <DialogActions sx={{ p:2, borderTop:'1px solid #444' }}>
          <Button onClick={()=>setHelpDialogOpen(false)} variant="contained" sx={{ backgroundColor:'#5e2e8f','&:hover':{backgroundColor:'#7e4cb8'} }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default ManualTagging;