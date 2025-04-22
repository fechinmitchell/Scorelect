import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Select,
  MenuItem,
  Grid,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Divider,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import VideocamIcon from '@mui/icons-material/Videocam';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandLessIcon  from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon  from '@mui/icons-material/ExpandMore';


const AdvancedClipManager = ({ 
  open, 
  onClose, 
  tags, 
  teams, 
  tagCategories, 
  tagOutcomes, 
  videoRef, 
  currentTime, 
  duration, 
  formatTime, 
  waitForSeek,
  datasetName = 'game'
}) => {
  // State
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [creatingMontage, setCreatingMontage] = useState(false);
  const [montageProgress, setMontageProgress] = useState(0);
  const [filterOptions, setFilterOptions] = useState({
    player: '',
    team: '',
    category: '',
    action: '',
    outcome: ''
  });
  
  // Video format state
  const [videoFormat, setVideoFormat] = useState('mp4');
  const [compressionQuality, setCompressionQuality] = useState('high');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Available formats
  const availableFormats = [
    { value: 'mp4', label: 'MP4 (H.264)', mimeType: 'video/mp4' },
    { value: 'webm', label: 'WebM (VP9)', mimeType: 'video/webm' }
  ];

  // Quality options
  const qualityOptions = [
    { value: 'high', label: 'High Quality (Larger File)' },
    { value: 'medium', label: 'Medium Quality' },
    { value: 'low', label: 'Low Quality (Smaller File)' }
  ];

  // Reset filter options when dialog opens
  useEffect(() => {
    if (open) {
      setFilterOptions({
        player: '',
        team: '',
        category: '',
        action: '',
        outcome: ''
      });
    }
  }, [open]);

  // Get filtered tags based on current filter options
  const getFilteredTags = () => {
    return tags.filter(tag => {
      if (filterOptions.player && tag.player !== filterOptions.player) return false;
      if (filterOptions.team && tag.team !== filterOptions.team) return false;
      if (filterOptions.category && tag.category !== filterOptions.category) return false;
      if (filterOptions.action && tag.action !== filterOptions.action) return false;
      if (filterOptions.outcome && tag.outcome !== filterOptions.outcome) return false;
      return true;
    });
  };
  
  // Get MIME type and extension based on format selection
  const getVideoConfig = () => {
    const format = availableFormats.find(f => f.value === videoFormat) || availableFormats[0];
    
    // Define bit rates based on quality and format
    let videoBitrate = 0;
    switch(compressionQuality) {
      case 'high':
        videoBitrate = 5000000; // 5 Mbps
        break;
      case 'medium':
        videoBitrate = 2500000; // 2.5 Mbps
        break;
      case 'low':
        videoBitrate = 1000000; // 1 Mbps
        break;
      default:
        videoBitrate = 2500000;
    }
    
    return {
      mimeType: format.mimeType,
      extension: format.value,
      codecOptions: {
        videoBitsPerSecond: videoBitrate
      }
    };
  };

  // Enhanced clip download function with filtering options
  const enhancedDownloadClip = async () => {
    if (!videoRef || !videoRef.current || !tags.length) {
      alert("No video available or no tags to download");
      return;
    }
    
    const filteredTags = getFilteredTags();
    
    if (filteredTags.length === 0) {
      alert("No clips match the selected criteria");
      return;
    }
    
    // Sort tags by timestamp
    filteredTags.sort((a, b) => a.timestamp - b.timestamp);
    
    // Get video configuration
    const { mimeType, extension, codecOptions } = getVideoConfig();
    
    // Create filter description for filename
    const filterDesc = Object.entries(filterOptions)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}-${value.replace(/\s+/g, '_')}`)
      .join('_');
    
    const filename = filterDesc 
      ? `${datasetName}_${filterDesc}_clips.${extension}`
      : `${datasetName}_selected_clips.${extension}`;
    
    // Process each clip
    setSavingInProgress(true);
    
    try {
      for (let i = 0; i < filteredTags.length; i++) {
        const tag = filteredTags[i];
        const clipStart = Math.max(0, tag.timestamp - 2);
        const clipEnd = Math.min(duration, tag.timestamp + 2);
        
        // Skip to this time point
        videoRef.current.currentTime = clipStart;
        await waitForSeek(videoRef.current);
        
        // Capture stream
        const stream = videoRef.current.captureStream();
        let recorder;
        
        try {
          // Try with the specified format and options
          recorder = new MediaRecorder(stream, { 
            mimeType, 
            videoBitsPerSecond: codecOptions.videoBitsPerSecond 
          });
        } catch (error) {
          console.warn(`Could not create recorder with mime type ${mimeType}. Falling back to default.`);
          // Fall back to default format if the browser doesn't support the requested one
          recorder = new MediaRecorder(stream);
        }
        
        const chunks = [];
        
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.start();
        
        // Wait for clip duration
        await new Promise(resolve => setTimeout(resolve, (clipEnd - clipStart) * 1000));
        
        // Stop recording
        recorder.stop();
        
        // Process the recorded data
        await new Promise(resolve => {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const fn = `${datasetName || 'game'}/clips/clip_${i+1}_${tag.category}_${tag.action}_${formatTime(tag.timestamp)}.${extension}`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fn;
            a.click();
            
            URL.revokeObjectURL(url);
            resolve();
          };
        });
      }
      
      alert(`Successfully downloaded ${filteredTags.length} clips in ${extension.toUpperCase()} format!`);
      videoRef.current.currentTime = currentTime;
    } catch (error) {
      console.error("Error downloading clips:", error);
      alert("Error downloading clips: " + error.message);
    } finally {
      setSavingInProgress(false);
    }
  };

  // Create a montage of clips based on filter criteria
  const createMontage = async () => {
    if (!videoRef || !videoRef.current || !tags.length) {
      alert("No video available or no tags to create montage from");
      return;
    }
    
    const filteredTags = getFilteredTags();
    
    if (filteredTags.length === 0) {
      alert("No clips match the selected criteria for montage");
      return;
    }
    
    // Sort by timestamp
    filteredTags.sort((a, b) => a.timestamp - b.timestamp);
    
    setSavingInProgress(true);
    setMontageProgress(0);
    setCreatingMontage(true);
    
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // Get video configuration
      const { mimeType, extension, codecOptions } = getVideoConfig();
      
      // We'll use MediaRecorder for the montage
      const montageStream = canvas.captureStream();
      let montageRecorder;
      
      try {
        montageRecorder = new MediaRecorder(montageStream, { 
          mimeType, 
          videoBitsPerSecond: codecOptions.videoBitsPerSecond 
        });
      } catch (error) {
        console.warn(`Could not create recorder with mime type ${mimeType}. Falling back to default.`);
        montageRecorder = new MediaRecorder(montageStream);
      }
      
      const montageChunks = [];
      
      montageRecorder.ondataavailable = e => montageChunks.push(e.data);
      montageRecorder.start();
      
      // Process each clip for the montage
      for (let i = 0; i < filteredTags.length; i++) {
        const tag = filteredTags[i];
        const clipStart = Math.max(0, tag.timestamp - 2);
        const clipEnd = Math.min(duration, tag.timestamp + 2);
        const clipDuration = clipEnd - clipStart;
        
        // Update progress
        setMontageProgress(Math.round((i / filteredTags.length) * 100));
        
        // Seek to start of clip
        video.currentTime = clipStart;
        await waitForSeek(video);
        
        // Create title card for this clip
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw title text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        
        const titleText = `${tag.category}: ${tag.action}`;
        const subtitleText = `${teams[tag.team].name} - ${tag.player || 'No player'}`;
        const timeText = `Time: ${formatTime(tag.timestamp)}`;
        
        ctx.fillText(titleText, canvas.width/2, canvas.height/2 - 40);
        ctx.font = '24px Arial';
        ctx.fillText(subtitleText, canvas.width/2, canvas.height/2);
        ctx.fillText(timeText, canvas.width/2, canvas.height/2 + 30);
        
        // Wait a moment for title card
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Play the clip for its duration
        video.play();
        
        // Capture frames from video to canvas during clip playback
        const captureInterval = setInterval(() => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }, 1000/30); // 30fps
        
        // Wait for clip duration
        await new Promise(resolve => setTimeout(resolve, clipDuration * 1000));
        
        // Stop capturing frames
        clearInterval(captureInterval);
        video.pause();
        
        // Add transition effect
        for (let fade = 1.0; fade >= 0; fade -= 0.1) {
          ctx.globalAlpha = fade;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1 - fade;
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        ctx.globalAlpha = 1.0;
      }
      
      // Create end card
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 36px Arial';
      
      // Filter description for title
      const filterDesc = Object.entries(filterOptions)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      
      const montageTitle = filterDesc 
        ? `Montage: ${filterDesc}`
        : "Clip Montage";
      
      ctx.fillText(montageTitle, canvas.width/2, canvas.height/2 - 20);
      ctx.font = '24px Arial';
      ctx.fillText(`${filteredTags.length} clips`, canvas.width/2, canvas.height/2 + 20);
      
      // Wait for end card
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Stop recording and export
      montageRecorder.stop();
      await new Promise(resolve => {
        montageRecorder.onstop = () => {
          const montageBlob = new Blob(montageChunks, { type: mimeType });
          const montageUrl = URL.createObjectURL(montageBlob);
          
          // Create descriptive filename
          const montageDesc = Object.entries(filterOptions)
            .filter(([_, value]) => value)
            .map(([key, value]) => `${key}-${value.replace(/\s+/g, '_')}`)
            .join('_');
          
          const montageFilename = montageDesc 
            ? `${datasetName || 'game'}_montage_${montageDesc}.${extension}`
            : `${datasetName || 'game'}_montage.${extension}`;
          
          const downloadLink = document.createElement('a');
          downloadLink.href = montageUrl;
          downloadLink.download = montageFilename;
          downloadLink.click();
          
          URL.revokeObjectURL(montageUrl);
          resolve();
        };
      });
      
      // Reset video to current time
      video.currentTime = currentTime;
      await waitForSeek(video);
      
      alert("Montage created successfully!");
    } catch (error) {
      console.error("Error creating montage:", error);
      alert("Error creating montage: " + error.message);
    } finally {
      setCreatingMontage(false);
      setSavingInProgress(false);
      setMontageProgress(0);
    }
  };

  // Calculate number of matching clips
  const matchingClipsCount = getFilteredTags().length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { backgroundColor:'#222', color:'#fff', borderRadius:2, maxWidth:'600px', width:'100%' } }}
    >
      <DialogTitle sx={{ borderBottom:'1px solid #444' }}>
        Advanced Clip Download & Montage
        <IconButton onClick={onClose} sx={{ position:'absolute', right:8, top:8, color:'#aaa' }}>
          <CloseIcon/>
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ mt:2 }}>
        <Typography variant="h6" sx={{ mb:2 }}>Filter Clips</Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" sx={{ mb:1 }}>Team</Typography>
            <Select
              value={filterOptions.team}
              onChange={e => setFilterOptions({...filterOptions, team: e.target.value})}
              fullWidth
              sx={{
                backgroundColor:'#333', color:'#fff',
                '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
              }}
            >
              <MenuItem value=""><em>All Teams</em></MenuItem>
              <MenuItem value="home">{teams.home.name}</MenuItem>
              <MenuItem value="away">{teams.away.name}</MenuItem>
            </Select>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" sx={{ mb:1 }}>Player</Typography>
            <Select
              value={filterOptions.player}
              onChange={e => setFilterOptions({...filterOptions, player: e.target.value})}
              fullWidth
              sx={{
                backgroundColor:'#333', color:'#fff',
                '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
              }}
            >
              <MenuItem value=""><em>All Players</em></MenuItem>
              {filterOptions.team ? (
                teams[filterOptions.team]?.players
                  .filter(player => player.name)
                  .sort((a, b) => a.number - b.number)
                  .map(player => (
                    <MenuItem key={player.id} value={player.name}>
                      {player.number}. {player.name} ({player.position})
                    </MenuItem>
                  ))
              ) : (
                // Show all players from both teams if no team selected
                [...teams.home.players, ...teams.away.players]
                  .filter(player => player.name)
                  .sort((a, b) => a.number - b.number)
                  .map(player => (
                    <MenuItem key={player.id} value={player.name}>
                      {player.number}. {player.name}
                    </MenuItem>
                  ))
              )}
            </Select>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" sx={{ mb:1 }}>Category</Typography>
            <Select
              value={filterOptions.category}
              onChange={e => {
                const newCategory = e.target.value;
                setFilterOptions({
                  ...filterOptions, 
                  category: newCategory,
                  action: '' // Reset action when category changes
                });
              }}
              fullWidth
              sx={{
                backgroundColor:'#333', color:'#fff',
                '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
              }}
            >
              <MenuItem value=""><em>All Categories</em></MenuItem>
              {tagCategories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" sx={{ mb:1 }}>Action</Typography>
            <Select
              value={filterOptions.action}
              onChange={e => setFilterOptions({...filterOptions, action: e.target.value})}
              fullWidth
              disabled={!filterOptions.category}
              sx={{
                backgroundColor:'#333', color:'#fff',
                '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
              }}
            >
              <MenuItem value=""><em>All Actions</em></MenuItem>
              {filterOptions.category && tagCategories
                .find(cat => cat.id === filterOptions.category)?.actions
                .map(action => (
                  <MenuItem key={action.id} value={action.name}>{action.name}</MenuItem>
                ))}
            </Select>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ mb:1 }}>Outcome</Typography>
            <Select
              value={filterOptions.outcome}
              onChange={e => setFilterOptions({...filterOptions, outcome: e.target.value})}
              fullWidth
              sx={{
                backgroundColor:'#333', color:'#fff',
                '.MuiOutlinedInput-notchedOutline':{borderColor:'#444'},
                '&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'#666'},
                '&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#5e2e8f'}
              }}
            >
              <MenuItem value=""><em>All Outcomes</em></MenuItem>
              {tagOutcomes.map(outcome => (
                <MenuItem key={outcome.id} value={outcome.name}>{outcome.name}</MenuItem>
              ))}
            </Select>
          </Grid>
        </Grid>
        
        {/* Video format settings */}
        <Box sx={{ mt: 3 }}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              mb: 2
            }}
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <SettingsIcon sx={{ mr: 1 }} /> 
              Export Settings
            </Typography>
            <IconButton size="small">
              {showAdvancedSettings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          {showAdvancedSettings && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                  Video Format
                  <Tooltip title="Choose the output format for your clips and montage">
                    <HelpOutlineIcon sx={{ ml: 1, fontSize: 16, opacity: 0.7 }} />
                  </Tooltip>
                </Typography>
                <Select
                  value={videoFormat}
                  onChange={e => setVideoFormat(e.target.value)}
                  fullWidth
                  sx={{
                    backgroundColor: '#333',
                    color: '#fff',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#5e2e8f' }
                  }}
                >
                  {availableFormats.map(format => (
                    <MenuItem key={format.value} value={format.value}>
                      {format.label}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                  Quality
                  <Tooltip title="Higher quality creates larger files but with better visual quality">
                    <HelpOutlineIcon sx={{ ml: 1, fontSize: 16, opacity: 0.7 }} />
                  </Tooltip>
                </Typography>
                <Select
                  value={compressionQuality}
                  onChange={e => setCompressionQuality(e.target.value)}
                  fullWidth
                  sx={{
                    backgroundColor: '#333',
                    color: '#fff',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#5e2e8f' }
                  }}
                >
                  {qualityOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
            </Grid>
          )}
        </Box>
        
        <Divider sx={{ my: 3, borderColor: '#444' }} />
        
        {/* Montage progress bar */}
        {creatingMontage && (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Creating montage: {montageProgress}%</Typography>
            <LinearProgress 
              variant="determinate" 
              value={montageProgress}
              sx={{ 
                height: 10, 
                borderRadius: 5,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#5e2e8f',
                }
              }} 
            />
          </Box>
        )}
        
        {/* Display stats for filtered clips */}
        <Box sx={{ p: 2, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Matching Clips: {matchingClipsCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Object.entries(filterOptions)
              .filter(([_, value]) => value)
              .map(([key, value]) => `${key}: ${value}`)
              .join(' • ')}
          </Typography>
          
          {/* Format summary */}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Format: {availableFormats.find(f => f.value === videoFormat)?.label} • 
            Quality: {qualityOptions.find(q => q.value === compressionQuality)?.label}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #444', flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose} sx={{ color: '#aaa' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={enhancedDownloadClip}
          disabled={savingInProgress || matchingClipsCount === 0}
          sx={{ backgroundColor: '#5e2e8f', '&:hover': { backgroundColor: '#7e4cb8' } }}
        >
          Download Selected
        </Button>
        <Button
          variant="contained"
          startIcon={<VideocamIcon />}
          onClick={createMontage}
          disabled={savingInProgress || creatingMontage || matchingClipsCount === 0}
          sx={{ backgroundColor: '#28a745', '&:hover': { backgroundColor: '#2fbc4e' } }}
        >
          Create Montage
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdvancedClipManager;