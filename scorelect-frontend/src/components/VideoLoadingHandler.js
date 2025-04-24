import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const VideoLoadingHandler = ({
  videoFile,
  youtubeUrl,
  videoLoading,
  videoError,
  videoReady,
  onVideoFileUpload,
  onYoutubeUrlSubmit,
  loadingTimeout = 10000,
  onShowHelp,
  onShowUploadModal
}) => {
  const [showTimeoutError, setShowTimeoutError] = useState(false);

  useEffect(() => {
    let timeoutId;
    
    if (videoLoading) {
      setShowTimeoutError(false);
      timeoutId = setTimeout(() => {
        if (!videoReady) {
          setShowTimeoutError(true);
        }
      }, loadingTimeout);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [videoLoading, videoReady, loadingTimeout]);

  if (!videoFile && !youtubeUrl) return null;

  if (videoLoading && !showTimeoutError) {
    return (
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
          <CircularProgress color="secondary" />
          <Typography>Loading video...</Typography>
        </Box>
      </Box>
    );
  }

  if (videoError || showTimeoutError) {
    return (
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2, p: 4, textAlign: 'center' }}>
          <ErrorOutlineIcon sx={{ fontSize: 48, color: '#dc3545' }} />
          <Typography variant="h6" color="error">
            {showTimeoutError ? 'Video Loading Timeout' : 'Video Error'}
          </Typography>
          <Typography>
            {showTimeoutError 
              ? 'The video is taking longer than expected to load. Would you like to try again?' 
              : videoError}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={onShowHelp}
              startIcon={<HelpOutlineIcon />}
            >
              Format Help
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={onShowUploadModal}
              startIcon={<CloudUploadIcon />}
            >
              Upload Video Again
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
};

export default VideoLoadingHandler; 