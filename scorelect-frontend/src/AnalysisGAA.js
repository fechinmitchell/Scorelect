import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  Paper,
  Container,
  Grid,
  TextField,
  Divider
} from '@mui/material';
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
import SportsIcon from '@mui/icons-material/Sports';
import AnalyticsIcon from '@mui/icons-material/Analytics';

// --- Styled Components ---
const PageContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  minHeight: '100vh',
  padding: theme.spacing(4, 0),
  display: 'flex',
  flexDirection: 'column'
}));

const TabButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'isActive'
})(({ theme, isActive }) => ({
  backgroundColor: isActive ? '#5e2e8f' : '#1f1f1f',
  color: '#fff',
  padding: theme.spacing(1.5, 3),
  borderRadius: theme.spacing(2.5),
  fontWeight: isActive ? 'bold' : 'normal',
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor: isActive ? '#6d3ca1' : '#2d2d2d',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
  },
  flex: 1,
  minWidth: 150,
  maxWidth: 200
}));

const SectionCard = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  color: '#fff',
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
  marginTop: theme.spacing(3),
  border: '1px solid #333'
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
    height: 3,
    background: 'linear-gradient(90deg, #5e2e8f 0%, rgba(94,46,143,0.1) 100%)',
    flexGrow: 1,
    marginLeft: theme.spacing(2)
  }
}));

const DropzoneContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isdragactive'
})(({ theme, isdragactive }) => ({
  padding: theme.spacing(4),
  border: `2px dashed ${isdragactive ? '#7e4cb8' : '#501387'}`,
  borderRadius: theme.spacing(2),
  textAlign: 'center',
  cursor: 'pointer',
  backgroundColor: '#232323',
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor: '#282828',
    borderColor: '#7e4cb8'
  },
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2)
}));

const FiltersContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
  backgroundColor: '#232323',
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  border: '1px solid #333'
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  backgroundColor: '#2c2c2c',
  color: '#fff',
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

const ActionButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'btncolor'
})(({ theme, btncolor }) => ({
  backgroundColor:
    btncolor === 'primary'
      ? '#5e2e8f'
      : btncolor === 'success'
      ? '#28a745'
      : '#dc3545',
  color: '#fff',
  padding: theme.spacing(1, 3),
  borderRadius: theme.spacing(1),
  textTransform: 'none',
  fontWeight: 600,
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor:
      btncolor === 'primary'
        ? '#7e4cb8'
        : btncolor === 'success'
        ? '#2fbc4e'
        : '#e04555',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
  }
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
  backgroundColor: 'rgba(94,46,143,0.1)',
  borderRadius: theme.spacing(1),
  marginTop: theme.spacing(2),
  border: '1px solid #5e2e8f'
}));

// --- TabPanel Helper ---
const TabPanel = ({ children, value, index }) =>
  value === index ? <Box sx={{ width: '100%' }}>{children}</Box> : null;

// --- DatasetAnalysis ---
const DatasetAnalysis = () => {
  const { datasets } = useContext(SavedGamesContext);
  const { currentUser, loading } = useAuth();
  const { userRole } = useUser();
  const navigate = useNavigate();

  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [selectedUserDataset, setSelectedUserDataset] = useState('');
  const [selectedMatch, setSelectedMatch] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    teams: [],
    players: [],
    actions: []
  });
  const [analysisPermission, setAnalysisPermission] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const onDrop = (files) => {
    if (!files.length) return;
    const file = files[0];
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (!json.games || !Array.isArray(json.games)) {
          throw new Error('Invalid structure');
        }
        setParsedData(json);
        Swal.fire({
          title: 'File Uploaded',
          text: `${file.name} parsed successfully.`,
          icon: 'success',
          background: '#222',
          color: '#fff',
          confirmButtonColor: '#5e2e8f'
        });
      } catch {
        Swal.fire({
          title: 'Error',
          text: 'Invalid JSON format.',
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

  useEffect(() => {
    if (loading) return;
    (async () => {
      const ref = doc(firestore, 'adminSettings', 'config');
      const snap = await getDoc(ref);
      const perms = snap.exists() ? snap.data().permissions || {} : {};
      const perm = perms.analysis || 0;
      setAnalysisPermission(perm);

      if (perm > 0 && !currentUser) {
        await Swal.fire({
          title: 'Sign In Required',
          text: 'Please sign in to continue.',
          icon: 'warning',
          background: '#222',
          color: '#fff',
          confirmButtonColor: '#5e2e8f'
        });
        return navigate('/signin');
      }
      if (
        (perm === 1 && userRole !== 'free') ||
        (perm === 2 && userRole !== 'premium')
      ) {
        await Swal.fire({
          title: 'Access Denied',
          text: 'Insufficient permissions.',
          icon: 'error',
          background: '#222',
          color: '#fff',
          confirmButtonColor: '#5e2e8f'
        });
        return navigate('/');
      }
    })();
  }, [currentUser, loading, userRole, navigate]);

  useEffect(() => {
    const source =
      parsedData || (selectedUserDataset && datasets[selectedUserDataset]);
    if (!source?.games) return;

    const teams = new Set(),
      players = new Set(),
      actions = new Set();

    source.games.forEach((g) =>
      g.gameData?.forEach((e) => {
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
  }, [parsedData, selectedUserDataset, datasets]);

  const handleContinue = () => {
    let data = parsedData || datasets[selectedUserDataset];
    if (!data) {
      Swal.fire({
        title: 'No Dataset',
        text: 'Upload or select a dataset first.',
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
        games: data.games.filter(
          (g) => (g.gameId || g.gameName) === selectedMatch
        )
      };
    }
    navigate('/analysis/gaa-dashboard', {
      state: {
        file: data,
        sport: 'GAA',
        filters: {
          team: selectedTeam || null,
          player: selectedPlayer || null,
          action: selectedAction || null
        }
      }
    });
  };

  const handleReset = () => {
    setUploadedFile(null);
    setParsedData(null);
    setSelectedUserDataset('');
    setSelectedMatch('all');
    setSelectedTeam('');
    setSelectedPlayer('');
    setSelectedAction('');
    setFilterOptions({ teams: [], players: [], actions: [] });
    setShowFilters(false);
  };

  return (
    <SectionCard>
      <SectionTitle variant="h5">
        <SportsSoccerIcon /> Dataset Analysis
      </SectionTitle>

      {/* Saved Datasets */}
      {Object.keys(datasets).length ? (
        <Box mb={4}>
          <Typography
            variant="subtitle1"
            mb={1}
            display="flex"
            alignItems="center"
            gap={1}
          >
            <StorageIcon fontSize="small" /> Select a saved dataset:
          </Typography>
          <StyledSelect
            fullWidth
            value={selectedUserDataset}
            onChange={(e) => {
              setSelectedUserDataset(e.target.value);
              setSelectedMatch('all');
              setShowFilters(!!e.target.value);
            }}
            displayEmpty
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {Object.keys(datasets).map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </StyledSelect>
          {selectedUserDataset && (
            <StyledSelect
              fullWidth
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
            >
              <MenuItem value="all">All Matches</MenuItem>
              {datasets[selectedUserDataset].games.map((g) => {
                const id = g.gameId || g.gameName;
                return (
                  <MenuItem key={id} value={id}>
                    {g.gameName}{' '}
                    {g.matchDate
                      ? `(${new Date(g.matchDate).toLocaleDateString()})`
                      : '(N/A)'}
                  </MenuItem>
                );
              })}
            </StyledSelect>
          )}
        </Box>
      ) : (
        <Typography mb={4}>No saved datasets available.</Typography>
      )}

      {/* Upload JSON */}
      <DropzoneContainer
        {...getRootProps()}
        isdragactive={isDragActive.toString()}
      >
        <input {...getInputProps()} />
        <UploadIcon />
        {isDragActive ? (
          <Typography variant="h6">Drop the JSON here…</Typography>
        ) : (
          <>
            <Typography variant="h6">
              Drag & drop a dataset JSON
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to select
            </Typography>
          </>
        )}
      </DropzoneContainer>

      {uploadedFile && (
        <FilePreview>
          <StorageIcon color="primary" />
          <Typography>
            <strong>Uploaded:</strong> {uploadedFile.name}
          </Typography>
        </FilePreview>
      )}

      {/* Filters Toggle */}
      <Box
        mt={4}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography variant="subtitle1" display="flex" alignItems="center" gap={1}>
          <FilterListIcon fontSize="small" /> Additional Filters
        </Typography>
        <Button
          onClick={() => setShowFilters((s) => !s)}
          sx={{ color: '#5e2e8f', textTransform: 'none' }}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </Box>

      {/* Filters Panel */}
      {showFilters && (
        <FiltersContainer>
          <Grid container spacing={2}>
            {[
              { label: 'Team', value: selectedTeam, setter: setSelectedTeam, options: filterOptions.teams },
              { label: 'Player', value: selectedPlayer, setter: setSelectedPlayer, options: filterOptions.players },
              { label: 'Action', value: selectedAction, setter: setSelectedAction, options: filterOptions.actions }
            ].map(({ label, value, setter, options }) => (
              <Grid item xs={12} md={4} key={label}>
                <Typography variant="body2" mb={1} color="#aaa">
                  {label}
                </Typography>
                <StyledSelect
                  fullWidth
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>All {label}s</em>
                  </MenuItem>
                  {options.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </StyledSelect>
              </Grid>
            ))}
          </Grid>
        </FiltersContainer>
      )}

      {/* Actions */}
      <Box mt={4} display="flex" gap={2}>
        <ActionButton btncolor="success" onClick={handleContinue} startIcon={<PlayArrowIcon />}>
          Continue to Analysis
        </ActionButton>
        <ActionButton btncolor="error" onClick={handleReset} startIcon={<RestartAltIcon />}>
          Reset
        </ActionButton>
      </Box>
    </SectionCard>
  );
};

// --- VideoAnalysis ---
const VideoAnalysis = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const validateYouTubeUrl = (url) =>
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/.test(
      url
    );

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setYoutubeUrl(val);
    if (val && !validateYouTubeUrl(val)) {
      setUrlError('Please enter a valid YouTube URL');
    } else {
      setUrlError('');
    }
    if (val) setFile(null);
  };

  const onDrop = (files) => {
    if (!files.length) return;
    setFile(files[0]);
    setYoutubeUrl('');
    setUrlError('');
    Swal.fire({
      title: 'Video Uploaded',
      text: `${files[0].name} uploaded.`,
      icon: 'success',
      background: '#222',
      color: '#fff',
      confirmButtonColor: '#5e2e8f'
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/mp4': ['.mp4'] },
    multiple: false
  });

  const handleContinue = () => {
    if (!file && !youtubeUrl) {
      return Swal.fire({
        title: 'No Video Selected',
        text: 'Upload a file or enter a URL.',
        icon: 'warning',
        background: '#222',
        color: '#fff',
        confirmButtonColor: '#5e2e8f'
      });
    }
    if (youtubeUrl && urlError) {
      return Swal.fire({
        title: 'Invalid URL',
        text: 'Correct the YouTube URL.',
        icon: 'error',
        background: '#222',
        color: '#fff',
        confirmButtonColor: '#5e2e8f'
      });
    }
    navigate('/tagging/manual', {
      state: { file: file || null, youtubeUrl: youtubeUrl || null, sport: 'GAA' }
    });
  };

  const handleReset = () => {
    setFile(null);
    setYoutubeUrl('');
    setUrlError('');
  };

  return (
    <SectionCard>
      <SectionTitle variant="h5">
        <VideoLibraryIcon /> Video Analysis
      </SectionTitle>

      {/* YouTube URL */}
      <Box mb={3}>
        <Typography variant="subtitle1" mb={1} color="#eee">
          Enter YouTube URL
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
              '&.Mui-focused fieldset': { borderColor: '#5e2e8f' }
            },
            '& .MuiInputLabel-root': { color: '#aaa' }
          }}
        />
      </Box>

      {/* File Drop */}
      <DropzoneContainer
        {...getRootProps()}
        isdragactive={isDragActive.toString()}
      >
        <input {...getInputProps()} />
        <UploadIcon />
        {isDragActive ? (
          <Typography variant="h6">Drop the MP4 here…</Typography>
        ) : (
          <>
            <Typography variant="h6">Drag & drop an MP4</Typography>
            <Typography variant="body2" color="text.secondary">
              or click to select
            </Typography>
          </>
        )}
      </DropzoneContainer>

      {/* Preview */}
      {(file || youtubeUrl) && (
        <>
          {file && (
            <FilePreview>
              <VideoLibraryIcon color="primary" />
              <Typography>
                <strong>Selected:</strong> {file.name}
              </Typography>
            </FilePreview>
          )}
          {youtubeUrl && (
            <FilePreview>
              <VideoLibraryIcon color="primary" />
              <Typography>
                <strong>URL:</strong> {youtubeUrl}
              </Typography>
            </FilePreview>
          )}

          {/* Tagging Options */}
          <Box mt={3}>
            <Typography variant="subtitle1" mb={2} color="#eee">
              Select tagging method:
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <ActionButton
                  btncolor="primary"
                  fullWidth
                  startIcon={<EditIcon />}
                  onClick={handleContinue}
                >
                  Manual Tagging
                </ActionButton>
              </Grid>
              <Grid item xs={12} sm={6}>
                <ActionButton
                  btncolor="primary"
                  fullWidth
                  disabled
                  sx={{
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    '&:hover': { transform: 'none', boxShadow: 'none' }
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

      <Box mt={4} display="flex" gap={2}>
        <ActionButton btncolor="error" onClick={handleReset} startIcon={<RestartAltIcon />}>
          Reset
        </ActionButton>
      </Box>
    </SectionCard>
  );
};

// --- PitchAnalysis with simplified setup/skip options ---
const PitchAnalysis = () => {
  const { currentUser } = useAuth();
  const { userRole } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      Swal.fire({
        title: 'Sign In Required',
        text: 'Please sign in to use the Pitch Analysis tool.',
        icon: 'warning',
        background: '#222',
        color: '#fff',
        confirmButtonColor: '#5e2e8f'
      }).then(() => navigate('/signin'));
    }
  }, [currentUser, navigate]);

  const pitchOptions = [
    {
      id: 'setup-team',
      title: 'Setup Team',
      description: 'Configure team details before analysis.',
      icon: <SportsSoccerIcon sx={{ fontSize: 42, color: '#5e2e8f' }} />,
      onClick: () =>
        navigate('/pitch', {
          state: { newSession: true, setupTeam: true }
        })
    },
    {
      id: 'skip-setup',
      title: 'Skip Setup',
      description: 'Jump straight into analysis.',
      icon: <SportsIcon sx={{ fontSize: 42, color: '#5e2e8f' }} />,
      onClick: () =>
        navigate('/pitch', {
          state: { newSession: true, skipSetup: true }
        })
    }
  ];

  const premiumFeatures =
    userRole === 'premium'
      ? [
          {
            id: 'load-template',
            title: 'Load Template',
            description: 'Use a saved template to set up quickly.',
            icon: <StorageIcon sx={{ fontSize: 36, color: '#5e2e8f' }} />,
            onClick: () =>
              navigate('/pitch', {
                state: { newSession: true, loadTemplate: true }
              })
          }
        ]
      : [
          {
            id: 'premium-templates',
            title: 'Premium Templates',
            description: 'Upgrade to access and save templates.',
            icon: <AutoAwesomeIcon sx={{ fontSize: 36, color: '#5e2e8f' }} />,
            isPremium: true,
            onClick: () => {
              Swal.fire({
                title: 'Premium Feature',
                html:
                  'Templates are available with a premium subscription.',
                icon: 'info',
                background: '#222',
                color: '#fff',
                confirmButtonColor: '#5e2e8f',
                confirmButtonText: 'Upgrade',
                showCancelButton: true,
                cancelButtonColor: '#444'
              }).then((result) => {
                if (result.isConfirmed) navigate('/upgrade');
              });
            }
          }
        ];

  return (
    <SectionCard>
      <SectionTitle variant="h5">
        <SportsIcon /> Pitch Analysis
      </SectionTitle>

      <Typography variant="body1" sx={{ mb: 4, color: '#ccc' }}>
        Choose how you want to start your pitch analysis session
      </Typography>

      {/* Main Options */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {pitchOptions.map((opt) => (
          <Grid item xs={12} sm={6} key={opt.id}>
            <Paper
              onClick={opt.onClick}
              sx={{
                p: 4,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                backgroundColor: '#232323',
                cursor: 'pointer',
                height: '100%',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: '#2a2a2a',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 6px 12px rgba(0,0,0,0.3)'
                }
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(94,46,143,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2
                }}
              >
                {opt.icon}
              </Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1.5 }}>
                {opt.title}
              </Typography>
              <Typography variant="body2" color="#aaa" sx={{ mb: 3 }}>
                {opt.description}
              </Typography>
              <Button
                variant="contained"
                onClick={opt.onClick}
                sx={{
                  backgroundColor: '#5e2e8f',
                  width: '100%',
                  py: 1.2,
                  textTransform: 'none',
                  '&:hover': { backgroundColor: '#7e4cb8' }
                }}
              >
                Start
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Premium Features */}
      {premiumFeatures.length > 0 && (
        <>
         <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 3,
            mt: 10
          }}
        >
          <Typography variant="h6" sx={{ color: '#ddd', fontWeight: 600 }}>
            Additional Options
          </Typography>
          {premiumFeatures[0].isPremium && (
            <Box
              component="span"
              sx={{
                px: 1.5,
                py: 0.3,
                bgcolor: '#5e2e8f',
                color: '#fff',
                borderRadius: 1,
                fontSize: '0.7rem'
              }}
            >
              PREMIUM
            </Box>
          )}
          <Divider sx={{ flexGrow: 1, borderColor: '#444' }} />
        </Box>


          <Grid container spacing={3}>
            {premiumFeatures.map((feat) => (
              <Grid item xs={12} sm={6} key={feat.id}>
                <Paper
                  onClick={feat.onClick}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    backgroundColor: '#232323',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#2a2a2a' }
                  }}
                >
                  <Box>{feat.icon}</Box>
                  <Box>
                    <Typography variant="h6">{feat.title}</Typography>
                    <Typography variant="body2" color="#aaa">
                      {feat.description}
                    </Typography>
                    {feat.isPremium && (
                      <Typography variant="caption" color="#888">
                        Premium
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </SectionCard>
  );
};

// --- Main Page with Centered Tabs & Title ---
const AnalysisGAA = () => {
  const [activeTab, setActiveTab] = useState(0);
  const tabItems = [
    { label: 'Dataset', icon: <StorageIcon sx={{ mr: 1 }} /> },
    { label: 'Video',   icon: <VideoLibraryIcon sx={{ mr: 1 }} /> },
    { label: 'Pitch',   icon: <AnalyticsIcon sx={{ mr: 1 }} /> },
  ];

  return (
    <PageContainer maxWidth="lg">
      {/* Title */}
      <Typography
        variant="h4"
        align="center"
        gutterBottom
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#5e2e8f',
          fontWeight: 600,
          mb: 2
        }}
      >
        <AnalyticsIcon fontSize="large" sx={{ mr: 1 }} />
        GAA Analysis
      </Typography>

      {/* Centered Tabs */}
      <Box display="flex" justifyContent="center" gap={2} mb={3}>
        {tabItems.map((tab, idx) => (
          <TabButton
            key={tab.label}
            isActive={activeTab === idx}
            onClick={() => setActiveTab(idx)}
          >
            {tab.icon}
            {tab.label} Analysis
          </TabButton>
        ))}
      </Box>

      {/* Panels */}
      <Box flexGrow={1}>
        <TabPanel value={activeTab} index={0}>
          <DatasetAnalysis />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <VideoAnalysis />
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          <PitchAnalysis />
        </TabPanel>
      </Box>
    </PageContainer>
  );
};

export default AnalysisGAA;
