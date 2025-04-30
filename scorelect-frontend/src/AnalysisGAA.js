import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Select, MenuItem, Paper, Container, Grid, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useDropzone } from 'react-dropzone';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';
import { SavedGamesContext } from './components/SavedGamesContext';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';

// Icons
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import FilterListIcon from '@mui/icons-material/FilterList';
import StorageIcon from '@mui/icons-material/Storage';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';

// --- Custom Styled Components ---
const PageContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  minHeight: '100vh',
  padding: theme.spacing(4, 0),
  display: 'flex',
  flexDirection: 'column',
}));

const TabButton = styled(Button)(({ theme, active }) => ({
  backgroundColor: active ? '#5e2e8f' : '#1f1f1f',
  color: '#ffffff',
  padding: theme.spacing(1.5, 3),
  borderRadius: theme.spacing(2.5),
  fontWeight: active ? 'bold' : 'normal',
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor: active ? '#6d3ca1' : '#2d2d2d',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  },
  flex: 1,
  minWidth: '180px',
  maxWidth: '240px',
}));

const SectionCard = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
  flexGrow: 1,
  marginTop: theme.spacing(3),
  border: '1px solid #333',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: '#5e2e8f',
  marginBottom: theme.spacing(3),
  fontWeight: 600,
  letterSpacing: '0.5px',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '&::after': {
    content: '""',
    display: 'block',
    height: '3px',
    background: 'linear-gradient(90deg, #5e2e8f 0%, rgba(94, 46, 143, 0.1) 100%)',
    flexGrow: 1,
    marginLeft: theme.spacing(2),
  }
}));

const DropzoneContainer = styled(Box)(({ theme, isDragActive }) => ({
  padding: theme.spacing(4),
  border: `2px dashed ${isDragActive ? '#7e4cb8' : '#501387'}`,
  borderRadius: theme.spacing(2),
  textAlign: 'center',
  cursor: 'pointer',
  backgroundColor: '#232323',
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor: '#282828',
    borderColor: '#7e4cb8',
  },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const FiltersContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
  backgroundColor: '#232323',
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  border: '1px solid #333',
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  backgroundColor: '#2c2c2c',
  color: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#444'
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#5e2e8f'
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#5e2e8f'
  },
  '& .MuiSelect-icon': {
    color: '#5e2e8f'
  }
}));

const ActionButton = styled(Button)(({ theme, color }) => ({
  backgroundColor: color === 'primary' ? '#5e2e8f' : color === 'success' ? '#28a745' : '#dc3545',
  color: '#ffffff',
  padding: theme.spacing(1, 3),
  borderRadius: theme.spacing(1),
  textTransform: 'none',
  fontWeight: 600,
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor: color === 'primary' ? '#7e4cb8' : color === 'success' ? '#2fbc4e' : '#e04555',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  },
}));

const UploadIcon = styled(CloudUploadIcon)(({ theme }) => ({
  fontSize: 48,
  color: '#5e2e8f',
  marginBottom: theme.spacing(1)
}));

const FilePreview = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  backgroundColor: 'rgba(94, 46, 143, 0.1)',
  borderRadius: theme.spacing(1),
  marginTop: theme.spacing(2),
  border: '1px solid #5e2e8f',
}));

// --- TabPanel Component ---
const TabPanel = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index} style={{ width: '100%' }}>
    {value === index && <Box sx={{ width: '100%' }}>{children}</Box>}
  </div>
);

// --- Dataset Analysis Tab ---
const DatasetAnalysis = () => {
  const { userRole } = useUser();
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const { datasets } = useContext(SavedGamesContext);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [selectedUserDataset, setSelectedUserDataset] = useState('');
  const [selectedMatch, setSelectedMatch] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [filterOptions, setFilterOptions] = useState({ teams: [], players: [], actions: [] });
  const [analysisPermission, setAnalysisPermission] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // file drop handler
  const onDrop = (acceptedFiles) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (!json.games || !Array.isArray(json.games)) {
          Swal.fire({
            title: 'Invalid File',
            text: 'The uploaded file does not have the correct structure.',
            icon: 'error',
            background: '#222',
            color: '#fff',
            confirmButtonColor: '#5e2e8f'
          });
          return;
        }
        setParsedData(json);
        Swal.fire({
          title: 'File Uploaded',
          text: `${file.name} has been uploaded and parsed successfully.`,
          icon: 'success',
          background: '#222',
          color: '#fff',
          confirmButtonColor: '#5e2e8f'
        });
      } catch {
        Swal.fire({
          title: 'Error',
          text: 'Failed to parse the file. Please check the file format.',
          icon: 'error',
          background: '#222',
          color: '#fff',
          confirmButtonColor: '#5e2e8f'
        });
      }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'application/json': ['.json'] }, 
    multiple: false 
  });

  // permissions check
  useEffect(() => {
    if (loading) return;
    (async () => {
      const settingsRef = doc(firestore, 'adminSettings', 'config');
      const settingsSnap = await getDoc(settingsRef);
      const perms = settingsSnap.exists() ? settingsSnap.data().permissions || {} : {};
      const perm = perms['analysis'] || 0;
      setAnalysisPermission(perm);
      
      if (perm > 0 && !currentUser) {
        await Swal.fire({
          title: 'Authentication Required',
          text: 'Please sign in to access this page.',
          icon: 'warning',
          background: '#222',
          color: '#fff',
          confirmButtonColor: '#5e2e8f'
        });
        navigate('/signin');
      } else if (currentUser) {
        if ((perm === 1 && userRole !== 'free') || (perm === 2 && userRole !== 'premium')) {
          await Swal.fire({
            title: 'Access Denied',
            text: 'You do not have permission to view this page.',
            icon: 'error',
            background: '#222',
            color: '#fff',
            confirmButtonColor: '#5e2e8f'
          });
          navigate('/');
        }
      }
    })();
  }, [currentUser, loading, userRole, navigate]);

  // build filter options
  useEffect(() => {
    const source = parsedData || (selectedUserDataset && datasets[selectedUserDataset]);
    if (source?.games) {
      const teams = new Set();
      const players = new Set();
      const actions = new Set();
      source.games.forEach(game =>
        game.gameData?.forEach(e => {
          if (e.team) teams.add(e.team);
          if (e.playerName) players.add(e.playerName);
          if (e.action) actions.add(e.action);
        })
      );
      setFilterOptions({ 
        teams: [...teams].sort(), 
        players: [...players].sort(), 
        actions: [...actions].sort() 
      });
    }
  }, [parsedData, selectedUserDataset, datasets]);

  // continue to dashboard
  const handleContinue = () => {
    let data = parsedData || (selectedUserDataset && datasets[selectedUserDataset]);
    if (!data) {
      Swal.fire({
        title: 'No Dataset Selected',
        text: 'Please upload or select a dataset.',
        icon: 'warning',
        background: '#222',
        color: '#fff',
        confirmButtonColor: '#5e2e8f'
      });
      return;
    }
    
    if (selectedMatch !== 'all') {
      data = {
        ...data,
        games: data.games.filter(g => (g.gameId || g.gameName) === selectedMatch)
      };
    }
    
    const filters = {
      team: selectedTeam || null,
      player: selectedPlayer || null,
      action: selectedAction || null,
    };
    
    navigate('/analysis/gaa-dashboard', { state: { file: data, sport: 'GAA', filters } });
  };

  // reset all selections
  const handleReset = () => {
    setUploadedFile(null);
    setParsedData(null);
    setSelectedUserDataset('');
    setSelectedMatch('all');
    setSelectedTeam('');
    setSelectedPlayer('');
    setSelectedAction('');
    setFilterOptions({ teams: [], players: [], actions: [] });
  };

  return (
    <SectionCard>
      <SectionTitle variant="h5">
        <SportsSoccerIcon /> Dataset Analysis
      </SectionTitle>

      {/* Saved Datasets */}
      {Object.keys(datasets).length > 0 ? (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon fontSize="small" color="primary" /> Select a saved dataset:
          </Typography>
          
          <StyledSelect
            fullWidth
            value={selectedUserDataset}
            onChange={e => {
              setSelectedUserDataset(e.target.value);
              setSelectedMatch('all');
              if (e.target.value) setShowFilters(true);
            }}
            displayEmpty
            sx={{ mb: 2 }}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {Object.keys(datasets).map(name => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </StyledSelect>

          {selectedUserDataset && (
            <StyledSelect
              fullWidth
              value={selectedMatch}
              onChange={e => setSelectedMatch(e.target.value)}
            >
              <MenuItem value="all">All Matches</MenuItem>
              {datasets[selectedUserDataset].games.map(g => {
                const id = g.gameId || g.gameName;
                return (
                  <MenuItem key={id} value={id}>
                    {g.gameName} ({g.matchDate ? new Date(g.matchDate).toLocaleDateString() : 'N/A'})
                  </MenuItem>
                );
              })}
            </StyledSelect>
          )}
        </Box>
      ) : (
        <Typography sx={{ mb: 4 }}>No saved datasets available.</Typography>
      )}

      {/* Upload JSON Dataset */}
      <DropzoneContainer {...getRootProps()} isDragActive={isDragActive}>
        <input {...getInputProps()} />
        <UploadIcon />
        {isDragActive ? (
          <Typography variant="h6">Drop the JSON here…</Typography>
        ) : (
          <>
            <Typography variant="h6">Drag & drop a dataset JSON</Typography>
            <Typography variant="body2" color="text.secondary">or click to select a file</Typography>
          </>
        )}
      </DropzoneContainer>

      {uploadedFile && (
        <FilePreview>
          <StorageIcon color="primary" />
          <Typography sx={{ color: '#fff' }}>
            <strong>Uploaded:</strong> {uploadedFile.name}
          </Typography>
        </FilePreview>
      )}

      {/* Additional Filters */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon fontSize="small" color="primary" /> Additional Filters
        </Typography>
        <Button 
          onClick={() => setShowFilters(!showFilters)}
          sx={{ color: '#5e2e8f', textTransform: 'none' }}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </Box>

      {showFilters && (
        <FiltersContainer>
          <Grid container spacing={2}>
            <Grid item xs={12} md= {4}>
              <Typography variant="body2" sx={{ mb: 1, color: '#aaa' }}>Team</Typography>
              <StyledSelect
                fullWidth
                value={selectedTeam}
                onChange={e => setSelectedTeam(e.target.value)}
                displayEmpty
              >
                <MenuItem value=""><em>All Teams</em></MenuItem>
                {filterOptions.teams.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </StyledSelect>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography variant="body2" sx={{ mb: 1, color: '#aaa' }}>Player</Typography>
              <StyledSelect
                fullWidth
                value={selectedPlayer}
                onChange={e => setSelectedPlayer(e.target.value)}
                displayEmpty
              >
                <MenuItem value=""><em>All Players</em></MenuItem>
                {filterOptions.players.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </StyledSelect>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography variant="body2" sx={{ mb: 1, color: '#aaa' }}>Action</Typography>
              <StyledSelect
                fullWidth
                value={selectedAction}
                onChange={e => setSelectedAction(e.target.value)}
                displayEmpty
              >
                <MenuItem value=""><em>All Actions</em></MenuItem>
                {filterOptions.actions.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </StyledSelect>
            </Grid>
          </Grid>
        </FiltersContainer>
      )}

      {/* Action Buttons */}
      <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
        <ActionButton
          color="success"
          onClick={handleContinue}
          startIcon={<PlayArrowIcon />}
        >
          Continue to Analysis
        </ActionButton>
        <ActionButton
          color="error"
          onClick={handleReset}
          startIcon={<RestartAltIcon />}
        >
          Reset
        </ActionButton>
      </Box>
    </SectionCard>
  );
};

// --- Video Analysis Tab ---
const VideoAnalysis = () => {
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const navigate = useNavigate();

  // Validate YouTube URL
  const validateYouTubeUrl = (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/;
    return youtubeRegex.test(url);
  };

  // Handle URL input change
  const handleUrlChange = (e) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    if (url) {
      if (validateYouTubeUrl(url)) {
        setUrlError('');
        setFile(null); // Clear file if URL is entered
      } else {
        setUrlError('Please enter a valid YouTube URL');
      }
    } else {
      setUrlError('');
    }
  };

  // File drop handler
  const onDrop = (acceptedFiles) => {
    if (!acceptedFiles.length) return;
    const f = acceptedFiles[0];
    setFile(f);
    setYoutubeUrl(''); // Clear URL if file is dropped
    setUrlError('');
    Swal.fire({
      title: 'Video Uploaded',
      text: `${f.name} has been successfully uploaded.`,
      icon: 'success',
      background: '#222',
      color: '#fff',
      confirmButtonColor: '#5e2e8f'
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/mp4': ['.mp4'] }, // Explicitly accept MP4
    multiple: false,
  });

  const handleReset = () => {
    setFile(null);
    setYoutubeUrl('');
    setUrlError('');
  };

  const handleContinue = () => {
    if (!file && !youtubeUrl) {
      Swal.fire({
        title: 'No Video Selected',
        text: 'Please upload a video file or enter a YouTube URL.',
        icon: 'warning',
        background: '#222',
        color: '#fff',
        confirmButtonColor: '#5e2e8f'
      });
      return;
    }
    if (youtubeUrl && !validateYouTubeUrl(youtubeUrl)) {
      Swal.fire({
        title: 'Invalid URL',
        text: 'Please enter a valid YouTube URL.',
        icon: 'error',
        background: '#222',
        color: '#fff',
        confirmButtonColor: '#5e2e8f'
      });
      return;
    }
    navigate('/tagging/manual', { 
      state: { 
        file: file || null, 
        youtubeUrl: youtubeUrl || null, 
        sport: 'GAA' 
      }
    });
  };

  return (
    <SectionCard>
      <SectionTitle variant="h5">
        <VideoLibraryIcon /> Video Analysis
      </SectionTitle>

      {/* YouTube URL Input */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, color: '#eee' }}>
          Enter YouTube Video URL
        </Typography>
        <TextField
          fullWidth
          value={youtubeUrl}
          onChange={handleUrlChange}
          placeholder="https://www.youtube.com/watch?v=..."
          error={!!urlError}
          helperText={urlError}
          sx={{
            backgroundColor: '#232323',
            borderRadius: 1,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': { borderColor: '#444' },
              '&:hover fieldset': { borderColor: '#666' },
              '&.Mui-focused fieldset': { borderColor: '#5e2e8f' },
            },
            '& .MuiInputLabel-root': { color: '#aaa' },
          }}
        />
      </Box>

      {/* Upload Video File */}
      <DropzoneContainer {...getRootProps()} isDragActive={isDragActive}>
        <input {...getInputProps()} />
        <UploadIcon />
        {isDragActive ? (
          <Typography variant="h6">Drop the MP4 video here…</Typography>
        ) : (
          <>
            <Typography variant="h6">Drag & drop an MP4 video file</Typography>
            <Typography variant="body2" color="text.secondary">or click to select</Typography>
          </>
        )}
      </DropzoneContainer>

      {(file || youtubeUrl) && (
        <>
          {file && (
            <FilePreview>
              <VideoLibraryIcon color="primary" />
              <Typography sx={{ color: '#fff' }}>
                <strong>Selected:</strong> {file.name}
              </Typography>
            </FilePreview>
          )}
          {youtubeUrl && (
            <FilePreview>
              <VideoLibraryIcon color="primary" />
              <Typography sx={{ color: '#fff' }}>
                <strong>YouTube URL:</strong> {youtubeUrl}
              </Typography>
            </FilePreview>
          )}

          {/* Tagging Mode Selection */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, color: '#eee' }}>
              Select tagging method:
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <ActionButton
                  color="primary"
                  fullWidth
                  onClick={handleContinue}
                  startIcon={<EditIcon />}
                >
                  Manual Tagging
                </ActionButton>
              </Grid>

              <Grid item xs={12} sm={6}>
                <ActionButton
                  color="primary"
                  fullWidth
                  disabled
                  sx={{ 
                    opacity: 0.5, 
                    cursor: 'not-allowed',
                    '&:hover': {
                      backgroundColor: '#5e2e8f',
                      transform: 'none',
                      boxShadow: 'none',
                    }
                  }}
                  title="AI-Assisted Tagging coming soon"
                  startIcon={<AutoAwesomeIcon />}
                >
                  AI-Assisted Tagging
                </ActionButton>
              </Grid>
            </Grid>
          </Box>
        </>
      )}

      <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
        <ActionButton
          color="error"
          onClick={handleReset}
          startIcon={<RestartAltIcon />}
        >
          Reset
        </ActionButton>
      </Box>
    </SectionCard>
  );
};

// --- Main AnalysisGAA Component ---
const AnalysisGAA = ({ defaultTab = 'dataset' }) => {
  const [tab, setTab] = useState(defaultTab === 'video' ? 1 : 0);
  
  return (
    <PageContainer maxWidth="lg">
      <Typography variant="h4" sx={{ 
        color: '#fff', 
        mb: 4, 
        textAlign: 'center',
        fontWeight: 700,
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        GAA Performance Analysis
      </Typography>
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: 2, 
        mb: 3,
        maxWidth: '600px',
        mx: 'auto'
      }}>
        <TabButton 
          active={tab === 0 ? 1 : 0} 
          onClick={() => setTab(0)}
          startIcon={<SportsSoccerIcon />}
        >
          Dataset Analysis
        </TabButton>
        <TabButton 
          active={tab === 1 ? 1 : 0} 
          onClick={() => setTab(1)}
          startIcon={<VideoLibraryIcon />}
        >
          Video Analysis
        </TabButton>
      </Box>

      <Box sx={{ position: 'relative', minHeight: '500px' }}>
        {[0, 1].map((index) => (
          <Box
            key={index}
            sx={{
              position: 'absolute',
              width: '100%',
              opacity: tab === index ? 1 : 0,
              transform: `translateX(${tab === index ? 0 : (tab < index ? '100px' : '-100px')})`,
              transition: 'all 0.4s ease',
              visibility: tab === index ? 'visible' : 'hidden',
            }}
          >
            {index === 0 ? <DatasetAnalysis /> : <VideoAnalysis />}
          </Box>
        ))}
      </Box>
    </PageContainer>
  );
};

export default AnalysisGAA;