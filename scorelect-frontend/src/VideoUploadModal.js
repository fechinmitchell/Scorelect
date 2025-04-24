import React, { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  IconButton,
  Button,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import YouTubeIcon from '@mui/icons-material/YouTube';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PropTypes from 'prop-types';

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`video-upload-tabpanel-${index}`}
      aria-labelledby={`video-upload-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

const StyledTab = styled(Tab)(({ theme }) => ({
  color: '#aaa',
  '&.Mui-selected': {
    color: '#5e2e8f',
    fontWeight: 'bold',
  },
}));

const StyledDropzone = styled(Box)(({ theme, isDragActive }) => ({
  backgroundColor: '#1a1a1a',
  border: isDragActive ? '2px dashed #5e2e8f' : '2px dashed #444',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(3),
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s ease',
  marginTop: theme.spacing(2),
  '&:hover': {
    borderColor: '#5e2e8f',
  },
}));

const VideoUploadModal = ({ 
  open, 
  onClose, 
  onVideoFileUpload, 
  onYoutubeUrlSubmit, 
  isLoading,
  title,
  defaultTab = 0
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setErrorMessage('');
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndUploadFile(file);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndUploadFile(file);
    }
  };

  const validateAndUploadFile = (file) => {
    setErrorMessage('');
    
    // Check file type
    const validExtensions = ['mp4'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setErrorMessage(`Unsupported video format (.${fileExtension}). Please upload an MP4 file.`);
      return;
    }
    
    // Check file size (limit to 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    if (file.size > maxSize) {
      setErrorMessage(`File size too large. Please upload a file smaller than 500MB.`);
      return;
    }
    
    onVideoFileUpload(file);
  };

  const handleYoutubeSubmit = () => {
    setErrorMessage('');
    
    // Simple YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!youtubeRegex.test(youtubeUrl)) {
      setErrorMessage('Please enter a valid YouTube URL.');
      return;
    }
    
    onYoutubeUrlSubmit(youtubeUrl);
  };

  const handleDropzoneClick = () => {
    fileInputRef.current.click();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      PaperProps={{ 
        sx: { 
          backgroundColor: '#222', 
          color: '#fff', 
          borderRadius: 2,
          width: '100%',
          maxWidth: 600
        } 
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #444' }}>
        {title || 'Upload Video'}
        <IconButton 
          onClick={onClose} 
          sx={{ position: 'absolute', right: 8, top: 8, color: '#aaa' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        {errorMessage && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            backgroundColor: 'rgba(220, 53, 69, 0.1)', 
            p: 2, 
            borderRadius: 1, 
            mb: 2,
            border: '1px solid rgba(220, 53, 69, 0.3)'
          }}>
            <ErrorOutlineIcon color="error" />
            <Typography color="error">{errorMessage}</Typography>
          </Box>
        )}
        
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: '1px solid #333',
            '& .MuiTabs-indicator': { backgroundColor: '#5e2e8f' }
          }}
        >
          <StyledTab icon={<CloudUploadIcon />} label="Upload File" />
          <StyledTab icon={<YouTubeIcon />} label="YouTube URL" />
        </Tabs>
        
        <TabPanel value={activeTab} index={0}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Upload your video file (MP4 format, max 500MB)
          </Typography>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
          
          <StyledDropzone
            isDragActive={dragActive}
            onClick={handleDropzoneClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isLoading ? (
              <CircularProgress color="secondary" size={40} />
            ) : (
              <>
                <CloudUploadIcon sx={{ fontSize: 48, color: '#5e2e8f', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Drag & Drop or Click to Browse
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supports MP4 video files
                </Typography>
              </>
            )}
          </StyledDropzone>
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Enter a YouTube video URL
          </Typography>
          
          <TextField
            fullWidth
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            sx={{
              backgroundColor: '#333',
              '.MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#5e2e8f' }
            }}
            InputProps={{
              startAdornment: <YouTubeIcon sx={{ mr: 1, color: '#aaa' }} />,
            }}
          />
        </TabPanel>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, borderTop: '1px solid #444' }}>
        <Button 
          onClick={onClose} 
          sx={{ color: '#aaa' }}
        >
          Cancel
        </Button>
        
        {activeTab === 1 && (
          <Button 
            onClick={handleYoutubeSubmit} 
            variant="contained"
            disabled={isLoading}
            sx={{ 
              backgroundColor: '#5e2e8f',
              '&:hover': { backgroundColor: '#7e4cb8' }
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Submit YouTube URL'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

VideoUploadModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onVideoFileUpload: PropTypes.func.isRequired,
  onYoutubeUrlSubmit: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  title: PropTypes.string,
  defaultTab: PropTypes.number
};

export default VideoUploadModal;