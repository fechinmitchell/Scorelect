import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import YouTubeIcon from '@mui/icons-material/YouTube';
import CloseIcon from '@mui/icons-material/Close';

const VideoUploadModal = ({
  open,
  onClose,
  onVideoFileUpload,
  onYoutubeUrlSubmit,
  isLoading,
  title = "Upload Video",
  defaultTab = 0
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onVideoFileUpload(e.dataTransfer.files[0]);
      onClose();
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      onVideoFileUpload(e.target.files[0]);
      onClose();
    }
  };

  const handleYoutubeSubmit = () => {
    if (youtubeUrl) {
      onYoutubeUrlSubmit(youtubeUrl);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#222',
          color: '#fff',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #444' }}>
        {title}
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: '#aaa'
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            mb: 3,
            borderBottom: '1px solid #444',
            '& .MuiTabs-indicator': { backgroundColor: '#5e2e8f' }
          }}
        >
          <Tab 
            icon={<CloudUploadIcon />} 
            label="Upload File" 
            sx={{ color: '#fff' }}
          />
          <Tab 
            icon={<YouTubeIcon />} 
            label="YouTube URL" 
            sx={{ color: '#fff' }}
          />
        </Tabs>

        {activeTab === 0 ? (
          <Box
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            sx={{
              border: '2px dashed',
              borderColor: dragActive ? '#5e2e8f' : '#444',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              backgroundColor: dragActive ? 'rgba(94, 46, 143, 0.1)' : 'transparent',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="file"
              accept="video/*"
              onChange={handleFileInput}
              style={{ display: 'none' }}
              id="video-upload-input"
            />
            <label htmlFor="video-upload-input">
              <CloudUploadIcon sx={{ fontSize: 48, color: '#5e2e8f', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Drag & Drop or Click to Upload
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supported formats: MP4
              </Typography>
              <Button
                variant="contained"
                component="span"
                sx={{
                  mt: 2,
                  backgroundColor: '#5e2e8f',
                  '&:hover': { backgroundColor: '#7e4cb8' }
                }}
              >
                Select File
              </Button>
            </label>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <YouTubeIcon sx={{ fontSize: 48, color: '#5e2e8f', mb: 2 }} />
            <TextField
              fullWidth
              label="YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#444' },
                  '&:hover fieldset': { borderColor: '#666' },
                  '&.Mui-focused fieldset': { borderColor: '#5e2e8f' }
                },
                '& .MuiInputLabel-root': { color: '#aaa' }
              }}
            />
            <Button
              variant="contained"
              onClick={handleYoutubeSubmit}
              disabled={!youtubeUrl}
              sx={{
                mt: 2,
                backgroundColor: '#5e2e8f',
                '&:hover': { backgroundColor: '#7e4cb8' }
              }}
            >
              Load YouTube Video
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #444' }}>
        <Button onClick={onClose} sx={{ color: '#aaa' }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VideoUploadModal; 