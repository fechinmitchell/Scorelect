import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Card, Typography, Slider, Button, IconButton, CssBaseline, Tabs, Tab, 
  CircularProgress, Grid, FormControl, InputLabel, Select, MenuItem, Radio, RadioGroup, 
  FormControlLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, 
  Chip, Switch, Accordion, AccordionSummary, AccordionDetails, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Tooltip, Pagination
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { 
  Brightness4, Brightness7, Refresh as RefreshIcon, ExpandMore as ExpandMoreIcon, 
  RestartAlt as ResetIcon, Science as ScienceIcon, Tune as TuneIcon, PlayArrow as PlayIcon,
  Visibility as ViewIcon, Search as SearchIcon, FilterList as FilterIcon,
  SportsSoccer as SportsIcon, Close as CloseIcon
} from '@mui/icons-material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import axios from 'axios';
import ModelLab from './ModelLab';

const BASE_API_URL = process.env.REACT_APP_API_URL || 'https://scorelect.onrender.com';

const features = [
  { id: 'analysis', name: 'Analysis Page' },
  { id: 'training', name: 'Training Page' },
  { id: 'savedGames', name: 'Saved Games' },
  { id: 'aiAnalysis', name: 'AI Analysis' },
];

const datasetPermissions = [
  { id: 'datasetPublishing', name: 'Dataset Publishing' },
  { id: 'datasetViewing', name: 'Dataset Viewing' },
];

const featureMarks = [{ value: 0, label: 'All Users' }, { value: 1, label: 'Free Users' }, { value: 2, label: 'Premium Users' }];
const datasetPublishingMarks = [{ value: 0, label: 'All Users' }, { value: 1, label: 'Free Users' }, { value: 2, label: 'Premium Users' }, { value: 3, label: 'Admin Only' }];

const getTheme = (mode) => createTheme({
  palette: {
    mode,
    ...(mode === 'dark'
      ? { background: { default: '#0f0f14', paper: '#1a1a24' }, text: { primary: '#fff', secondary: '#a0a0a0' }, primary: { main: '#7c3aed' }, secondary: { main: '#ec4899' } }
      : { background: { default: '#f8f9fc', paper: '#fff' }, text: { primary: '#1a1a2e', secondary: '#666' }, primary: { main: '#6366f1' } }),
  },
  typography: { fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' },
  components: {
    MuiCard: { styleOverrides: { root: { borderRadius: '20px', boxShadow: mode === 'dark' ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.08)', border: mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)' } } },
    MuiButton: { styleOverrides: { root: { borderRadius: '12px', textTransform: 'none', padding: '10px 24px', fontWeight: 600 } } },
    MuiSlider: { styleOverrides: { root: { color: mode === 'dark' ? '#7c3aed' : '#6366f1' }, markLabel: { color: mode === 'dark' ? '#888' : '#666', fontSize: '0.75rem' } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, fontSize: '0.95rem' } } },
  },
});

// Dataset Preview Component
const DatasetPreview = ({ mode, datasets, onRefresh }) => {
  const auth = getAuth();
  const [selectedDataset, setSelectedDataset] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  
  const rowsPerPage = 20;

  const fetchDatasetPreview = useCallback(async (datasetName) => {
    if (!datasetName) return;
    
    try {
      setLoading(true);
      setError(null);
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      const response = await axios.post(`${BASE_API_URL}/preview-dataset`, {
        uid: user.uid,
        datasetName: datasetName,
        limit: 500 // Get up to 500 events for preview
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      });
      
      setPreviewData(response.data);
      setPage(1);
    } catch (err) {
      console.error('Error fetching dataset preview:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load dataset');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (selectedDataset) {
      fetchDatasetPreview(selectedDataset);
    }
  }, [selectedDataset, fetchDatasetPreview]);

  // Filter and search logic
  const filteredEvents = previewData?.events?.filter(event => {
    const matchesSearch = searchTerm === '' || 
      (event.playerName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (event.team?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (event.action?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterAction === 'all' || event.action === filterAction;
    
    return matchesSearch && matchesFilter;
  }) || [];

  const paginatedEvents = filteredEvents.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalPages = Math.ceil(filteredEvents.length / rowsPerPage);

  // Get unique actions for filter
  const uniqueActions = [...new Set(previewData?.events?.map(e => e.action).filter(Boolean))];

  const handleViewGame = (gameId) => {
    const game = previewData?.games?.find(g => g.gameId === gameId);
    if (game) {
      setSelectedGame(game);
      setGameDialogOpen(true);
    }
  };

  const getActionColor = (action) => {
    const colors = {
      'point': '#22c55e',
      'goal': '#f59e0b',
      'wide': '#ef4444',
      'miss': '#ef4444',
      'block': '#3b82f6',
      'save': '#8b5cf6',
      'pass': '#06b6d4',
      'shot': '#ec4899',
    };
    return colors[action?.toLowerCase()] || '#888';
  };

  return (
    <Card sx={{ p: 4 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ViewIcon sx={{ color: '#7c3aed' }} />
        Dataset Preview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        View your dataset contents before running models
      </Typography>

      {/* Dataset Selection */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Select Dataset</InputLabel>
            <Select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              label="Select Dataset"
            >
              {datasets.map((ds) => (
                <MenuItem key={ds} value={ds}>{ds}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchDatasetPreview(selectedDataset)}
            disabled={!selectedDataset || loading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
          >
            Refresh Datasets
          </Button>
        </Grid>
      </Grid>

      {datasets.length === 0 && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }}>
          No datasets found. Create some games first.
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: '#7c3aed' }} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>
          {error}
        </Alert>
      )}

      {previewData && !loading && (
        <>
          {/* Stats Summary */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px', borderTop: '3px solid #7c3aed' }}>
                <Typography variant="caption" color="text.secondary">Games</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{previewData.gameCount || 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px', borderTop: '3px solid #22c55e' }}>
                <Typography variant="caption" color="text.secondary">Total Events</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{previewData.totalEvents || 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px', borderTop: '3px solid #f59e0b' }}>
                <Typography variant="caption" color="text.secondary">With xP</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{previewData.eventsWithXP || 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px', borderTop: '3px solid #ec4899' }}>
                <Typography variant="caption" color="text.secondary">Avg xP</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {previewData.avgXP ? previewData.avgXP.toFixed(3) : 'N/A'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Games List */}
          {previewData.games && previewData.games.length > 0 && (
            <Accordion sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SportsIcon /> Games in Dataset ({previewData.games.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Game Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Events</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.games.map((game) => (
                        <TableRow key={game.gameId} hover>
                          <TableCell>{game.gameName || game.gameId}</TableCell>
                          <TableCell>{game.matchDate ? new Date(game.matchDate).toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell align="right">{game.eventCount || 0}</TableCell>
                          <TableCell>
                            <Tooltip title="View Details">
                              <IconButton size="small" onClick={() => handleViewGame(game.gameId)}>
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Search and Filter */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search player, team, action..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: '#888', mr: 1 }} />,
              }}
              sx={{ minWidth: 250 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Action</InputLabel>
              <Select
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                label="Action"
              >
                <MenuItem value="all">All Actions</MenuItem>
                {uniqueActions.map(action => (
                  <MenuItem key={action} value={action}>{action}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" sx={{ alignSelf: 'center', color: '#888' }}>
              Showing {filteredEvents.length} of {previewData.events?.length || 0} events
            </Typography>
          </Box>

          {/* Events Table */}
          <TableContainer component={Paper} sx={{ borderRadius: '12px', maxHeight: 400, mb: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }}>Player</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }}>Team</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }} align="right">X</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }} align="right">Y</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }} align="right">xP</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }}>Outcome</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedEvents.map((event, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ color: '#888' }}>{(page - 1) * rowsPerPage + idx + 1}</TableCell>
                    <TableCell>
                      <Chip 
                        label={event.action || 'N/A'} 
                        size="small" 
                        sx={{ 
                          backgroundColor: `${getActionColor(event.action)}20`,
                          color: getActionColor(event.action),
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }} 
                      />
                    </TableCell>
                    <TableCell>{event.playerName || event.player || '-'}</TableCell>
                    <TableCell>{event.team || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{event.x?.toFixed(1) || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{event.y?.toFixed(1) || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600, color: event.xP ? '#22c55e' : '#888' }}>
                      {event.xP ? event.xP.toFixed(3) : '-'}
                    </TableCell>
                    <TableCell>
                      {event.outcome && (
                        <Chip 
                          label={event.outcome} 
                          size="small" 
                          sx={{ 
                            backgroundColor: event.outcome === 'score' ? '#22c55e20' : '#ef444420',
                            color: event.outcome === 'score' ? '#22c55e' : '#ef4444',
                            fontSize: '0.7rem'
                          }} 
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={(e, p) => setPage(p)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      {/* Game Details Dialog */}
      <Dialog open={gameDialogOpen} onClose={() => setGameDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SportsIcon sx={{ color: '#7c3aed' }} />
            Game Details
          </Box>
          <IconButton onClick={() => setGameDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedGame && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>{selectedGame.gameName || selectedGame.gameId}</Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2">{selectedGame.matchDate ? new Date(selectedGame.matchDate).toLocaleDateString() : 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Sport</Typography>
                  <Typography variant="body2">{selectedGame.sport || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Events</Typography>
                  <Typography variant="body2">{selectedGame.eventCount || 0}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Analysis Type</Typography>
                  <Typography variant="body2">{selectedGame.analysisType || 'pitch'}</Typography>
                </Grid>
              </Grid>

              {selectedGame.teamsData && (
                <Box sx={{ p: 2, backgroundColor: mode === 'dark' ? '#1a1a2e' : '#f5f5f5', borderRadius: '12px', mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Teams</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Home Team</Typography>
                      <Typography variant="body2">{selectedGame.teamsData.home?.name || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Away Team</Typography>
                      <Typography variant="body2">{selectedGame.teamsData.away?.name || 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGameDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

const AdminSettings = () => {
  const [featurePermissions, setFeaturePermissions] = useState({});
  const [datasetPerms, setDatasetPerms] = useState({});
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeTab, setActiveTab] = useState(0);
  const [adminUsers, setAdminUsers] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userDatasets, setUserDatasets] = useState([]);
  const [sourceDataset, setSourceDataset] = useState('');
  const [targetDataset, setTargetDataset] = useState('');
  const [selectedModel, setSelectedModel] = useState('random_forest');
  const [isCalculating, setIsCalculating] = useState(false);
  const [modelResult, setModelResult] = useState(null);
  const [modelHistory, setModelHistory] = useState([]);
  const [trainSize, setTrainSize] = useState(80);
  const [balanceClasses, setBalanceClasses] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  const navigate = useNavigate();
  const auth = getAuth();

  const toggleTheme = () => { const newMode = mode === 'dark' ? 'light' : 'dark'; setMode(newMode); localStorage.setItem('theme', newMode); };

  useEffect(() => { document.body.style.backgroundColor = mode === 'dark' ? '#0f0f14' : '#f8f9fc'; }, [mode]);

  const checkAdminStatus = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { Swal.fire({ title: 'Authentication Required', text: 'Please sign in.', icon: 'warning', confirmButtonColor: '#7c3aed' }).then(() => navigate('/signin')); return false; }
    setCurrentUserEmail(user.email);
    const datasetRef = doc(firestore, 'adminSettings', 'datasetConfig');
    const datasetSnap = await getDoc(datasetRef);
    if (datasetSnap.exists()) {
      const data = datasetSnap.data();
      const adminEmails = data.adminUsers || [];
      const isUserAdmin = adminEmails.includes(user.email);
      setIsAdmin(isUserAdmin);
      if (!isUserAdmin) { Swal.fire({ title: 'Access Denied', text: 'No admin privileges.', icon: 'error', confirmButtonColor: '#7c3aed' }).then(() => navigate('/')); return false; }
    } else { setIsAdmin(true); setAdminUsers([user.email]); }
    return true;
  }, [auth, navigate]);

  const fetchUserDatasets = useCallback(async () => {
    try {
      const user = auth.currentUser; if (!user) return;
      const token = await user.getIdToken();
      const response = await axios.post(`${BASE_API_URL}/get-user-datasets`, { uid: user.uid }, { headers: { Authorization: `Bearer ${token}` } });
      const datasets = response.data.datasets || [];
      setUserDatasets(datasets);
      if (datasets.length > 0) { setSourceDataset(datasets[0]); setTargetDataset(datasets[0]); }
    } catch (error) { console.error('Error fetching datasets:', error); }
  }, [auth]);

  const fetchModelHistory = useCallback(async () => {
    try {
      const user = auth.currentUser; if (!user) return;
      const token = await user.getIdToken();
      const response = await axios.post(`${BASE_API_URL}/get-model-history`, { uid: user.uid }, { headers: { Authorization: `Bearer ${token}` } });
      setModelHistory(response.data.history || []);
    } catch (error) { console.error('Error fetching model history:', error); }
  }, [auth]);

  useEffect(() => {
    const initializeAdmin = async () => {
      const hasAccess = await checkAdminStatus(); if (!hasAccess) return;
      const featuresRef = doc(firestore, 'adminSettings', 'config');
      const featuresSnap = await getDoc(featuresRef);
      if (featuresSnap.exists()) { setFeaturePermissions(featuresSnap.data().permissions || {}); }
      else { const defaultPermissions = {}; features.forEach((f) => { defaultPermissions[f.id] = f.id === 'aiAnalysis' ? 2 : 0; }); setFeaturePermissions(defaultPermissions); }
      const datasetRef = doc(firestore, 'adminSettings', 'datasetConfig');
      const datasetSnap = await getDoc(datasetRef);
      if (datasetSnap.exists()) { const data = datasetSnap.data(); setDatasetPerms(data.permissions || {}); setAdminUsers(data.adminUsers || []); }
      else { setDatasetPerms({ datasetPublishing: 3, datasetViewing: 0 }); if (auth.currentUser?.email) setAdminUsers([auth.currentUser.email]); }
      fetchUserDatasets(); fetchModelHistory();
    };
    initializeAdmin();
  }, [auth, checkAdminStatus, fetchUserDatasets, fetchModelHistory]);

  const handleSaveSettings = async () => {
    try {
      let finalAdminList = [...adminUsers];
      if (!finalAdminList.includes(currentUserEmail) && currentUserEmail) finalAdminList.push(currentUserEmail);
      await setDoc(doc(firestore, 'adminSettings', 'config'), { permissions: featurePermissions }, { merge: true });
      await setDoc(doc(firestore, 'adminSettings', 'datasetConfig'), { permissions: datasetPerms, adminUsers: finalAdminList }, { merge: true });
      Swal.fire({ title: 'Success', text: 'Settings updated.', icon: 'success', confirmButtonColor: '#7c3aed' });
    } catch (error) { Swal.fire({ title: 'Error', text: error.message, icon: 'error', confirmButtonColor: '#7c3aed' }); }
  };

  const handleResetXP = async () => {
    if (!targetDataset) { Swal.fire({ title: 'Error', text: 'Select a target dataset.', icon: 'error', confirmButtonColor: '#7c3aed' }); return; }
    const result = await Swal.fire({ title: 'Reset xP Values?', text: `This will set all xP to 0 in "${targetDataset}".`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Reset' });
    if (!result.isConfirmed) return;
    try {
      setIsCalculating(true);
      const user = auth.currentUser; if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const response = await axios.post(`${BASE_API_URL}/reset-xp-values`, { uid: user.uid, dataset_name: targetDataset }, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.data.success) throw new Error(response.data.error);
      Swal.fire({ title: 'Success', text: `Reset ${response.data.shots_reset} shots.`, icon: 'success', confirmButtonColor: '#7c3aed' });
      setModelResult(null);
    } catch (error) { Swal.fire({ title: 'Error', text: error.message, icon: 'error', confirmButtonColor: '#7c3aed' }); }
    finally { setIsCalculating(false); }
  };

  const handleRunModel = async () => {
    if (!sourceDataset || !targetDataset) { Swal.fire({ title: 'Error', text: 'Select both datasets.', icon: 'error', confirmButtonColor: '#7c3aed' }); return; }
    try {
      setIsCalculating(true); setModelResult(null);
      const user = auth.currentUser; if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const endpoint = advancedMode ? '/run-advanced-xp-model' : '/run-xp-model';
      const payload = { uid: user.uid, source_dataset: sourceDataset, target_dataset: targetDataset, model_type: selectedModel, ...(advancedMode && { train_size: trainSize / 100, balance_classes: balanceClasses }) };
      const response = await axios.post(`${BASE_API_URL}${endpoint}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setModelResult(response.data); await fetchModelHistory();
      Swal.fire({ title: 'Success', text: `Updated ${response.data.shots_updated || 0} shots with ${((response.data.metrics?.accuracy || 0) * 100).toFixed(1)}% accuracy`, icon: 'success', confirmButtonColor: '#7c3aed' });
    } catch (error) { Swal.fire({ title: 'Error', text: error.response?.data?.error || error.message, icon: 'error', confirmButtonColor: '#7c3aed' }); }
    finally { setIsCalculating(false); }
  };

  const getMetricColor = (v) => v >= 0.8 ? '#22c55e' : v >= 0.7 ? '#f59e0b' : '#ef4444';

  if (!isAdmin && currentUserEmail === '') {
    return (<ThemeProvider theme={getTheme(mode)}><CssBaseline /><Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: mode === 'dark' ? '#0f0f14' : '#f8f9fc' }}><CircularProgress sx={{ color: '#7c3aed' }} /></Box></ThemeProvider>);
  }

  return (
    <ThemeProvider theme={getTheme(mode)}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', p: 3, background: mode === 'dark' ? 'linear-gradient(135deg, #0f0f14 0%, #1a1a24 100%)' : 'linear-gradient(135deg, #f8f9fc 0%, #e8e9f0 100%)' }}>
        <IconButton onClick={toggleTheme} sx={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, backgroundColor: mode === 'dark' ? '#1a1a24' : '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>

        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          <Box sx={{ textAlign: 'center', mb: 4, pt: 2 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 1 }}>Admin Settings</Typography>
            {currentUserEmail && <Typography variant="body2" sx={{ color: mode === 'dark' ? '#666' : '#999' }}>Logged in as {currentUserEmail}</Typography>}
          </Box>

          <Card sx={{ mb: 3 }}>
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} centered sx={{ '& .MuiTabs-indicator': { background: 'linear-gradient(90deg, #7c3aed, #ec4899)', height: 3, borderRadius: '3px 3px 0 0' } }}>
              <Tab label="Features" />
              <Tab label="Datasets" />
              <Tab label="Admin Users" />
              <Tab label="Model Runner" />
              <Tab label="📊 Data Preview" />
              <Tab label="🧪 Model Lab" />
            </Tabs>
          </Card>

          {activeTab === 0 && (
            <Card sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>Feature Access Control</Typography>
              {features.map((feature) => (
                <Box key={feature.id} sx={{ my: 4, px: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{feature.name}</Typography>
                  <Slider value={featurePermissions[feature.id] ?? 0} onChange={(e, v) => setFeaturePermissions(p => ({ ...p, [feature.id]: v }))} step={1} marks={featureMarks} min={0} max={2} valueLabelDisplay="auto" sx={{ maxWidth: 500 }} />
                </Box>
              ))}
              <Box sx={{ mt: 4, textAlign: 'center' }}><Button variant="contained" onClick={handleSaveSettings} sx={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', px: 4, py: 1.5 }}>Save Settings</Button></Box>
            </Card>
          )}

          {activeTab === 1 && (
            <Card sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>Dataset Permissions</Typography>
              {datasetPermissions.map((perm) => (
                <Box key={perm.id} sx={{ my: 4, px: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>{perm.name}</Typography>
                  <Slider value={datasetPerms[perm.id] ?? (perm.id === 'datasetPublishing' ? 3 : 0)} onChange={(e, v) => setDatasetPerms(p => ({ ...p, [perm.id]: v }))} step={1} marks={perm.id === 'datasetPublishing' ? datasetPublishingMarks : featureMarks} min={0} max={perm.id === 'datasetPublishing' ? 3 : 2} valueLabelDisplay="auto" sx={{ maxWidth: 500 }} />
                </Box>
              ))}
              <Box sx={{ mt: 4, textAlign: 'center' }}><Button variant="contained" onClick={handleSaveSettings} sx={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', px: 4, py: 1.5 }}>Save Settings</Button></Box>
            </Card>
          )}

          {activeTab === 2 && (
            <Card sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>Manage Admin Users</Typography>
              <Box sx={{ display: 'flex', mb: 3, gap: 2 }}>
                <input type="email" placeholder="Enter admin email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: `1px solid ${mode === 'dark' ? '#333' : '#ddd'}`, backgroundColor: mode === 'dark' ? '#1a1a24' : '#fff', color: mode === 'dark' ? '#fff' : '#333', fontSize: '0.95rem' }} />
                <Button onClick={() => { if (newAdminEmail && newAdminEmail.includes('@') && !adminUsers.includes(newAdminEmail)) { setAdminUsers([...adminUsers, newAdminEmail]); setNewAdminEmail(''); } }} variant="contained" sx={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}>Add Admin</Button>
              </Box>
              <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
                {adminUsers.map((email) => (
                  <Box key={email} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, my: 1, borderRadius: '12px', backgroundColor: email === currentUserEmail ? (mode === 'dark' ? '#7c3aed20' : '#6366f120') : (mode === 'dark' ? '#1a1a24' : '#f5f5f5'), border: `1px solid ${mode === 'dark' ? '#333' : '#e0e0e0'}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography>{email}</Typography>{email === currentUserEmail && <Chip label="You" size="small" sx={{ backgroundColor: '#7c3aed', color: '#fff' }} />}</Box>
                    <Button variant="outlined" color="error" size="small" onClick={() => { if (email !== currentUserEmail && adminUsers.length > 1) setAdminUsers(adminUsers.filter(a => a !== email)); }} disabled={email === currentUserEmail || adminUsers.length <= 1}>Remove</Button>
                  </Box>
                ))}
              </Box>
              <Box sx={{ mt: 4, textAlign: 'center' }}><Button variant="contained" onClick={handleSaveSettings} sx={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', px: 4, py: 1.5 }}>Save Settings</Button></Box>
            </Card>
          )}

          {activeTab === 3 && (
            <Card sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Model Runner</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>Run xP models - updates Firestore directly.</Typography>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth><InputLabel>Training Dataset</InputLabel><Select value={sourceDataset} onChange={(e) => setSourceDataset(e.target.value)} label="Training Dataset" disabled={userDatasets.length === 0}>{userDatasets.map((ds) => <MenuItem key={ds} value={ds}>{ds}</MenuItem>)}</Select></FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth><InputLabel>Target Dataset</InputLabel><Select value={targetDataset} onChange={(e) => setTargetDataset(e.target.value)} label="Target Dataset" disabled={userDatasets.length === 0}>{userDatasets.map((ds) => <MenuItem key={ds} value={ds}>{ds}</MenuItem>)}</Select></FormControl>
                </Grid>
              </Grid>
              {userDatasets.length === 0 && <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }}>No datasets found. Create games first.</Alert>}
              {targetDataset && <Box sx={{ mb: 4, textAlign: 'center' }}><Button variant="outlined" color="error" startIcon={<ResetIcon />} onClick={handleResetXP} disabled={isCalculating}>Reset All xP to 0</Button></Box>}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Model Type</Typography>
              <RadioGroup value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} row sx={{ mb: 3 }}>
                {[{ value: 'random_forest', label: 'Random Forest' }, { value: 'logistic', label: 'Logistic' }, { value: 'gradient_boost', label: 'Gradient Boost' }, { value: 'knn', label: 'K-NN' }].map((m) => (
                  <FormControlLabel key={m.value} value={m.value} control={<Radio />} label={<Typography variant="body2" sx={{ fontWeight: 500 }}>{m.label}</Typography>} />
                ))}
              </RadioGroup>
              <FormControlLabel control={<Switch checked={advancedMode} onChange={(e) => setAdvancedMode(e.target.checked)} />} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><ScienceIcon /> Advanced Mode</Box>} sx={{ mb: 3 }} />
              {advancedMode && (
                <Accordion sx={{ mb: 3, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TuneIcon /> Advanced Settings</Typography></AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={3}>
                      <Grid item xs={12}><Typography variant="body2" sx={{ mb: 1 }}>Training Size: {trainSize}%</Typography><Slider value={trainSize} onChange={(e, v) => setTrainSize(v)} min={50} max={90} step={5} /></Grid>
                      <Grid item xs={12}><FormControlLabel control={<Switch checked={balanceClasses} onChange={(e) => setBalanceClasses(e.target.checked)} />} label="Balance Classes (SMOTE)" /></Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              )}
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Button variant="contained" size="large" onClick={handleRunModel} disabled={isCalculating || userDatasets.length === 0} startIcon={isCalculating ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />} sx={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)', px: 5, py: 1.5 }}>{isCalculating ? 'Running...' : 'Run Model'}</Button>
              </Box>
              {modelResult && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Results: {modelResult.model_type?.replace('_', ' ')}</Typography>
                  <Grid container spacing={2}>
                    {['accuracy', 'precision', 'recall', 'f1_score', 'auc_roc'].map((metric) => (
                      <Grid item xs={6} sm={4} md={2.4} key={metric}>
                        <Paper sx={{ p: 2, textAlign: 'center', borderRadius: '12px', borderTop: `3px solid ${getMetricColor(modelResult.metrics?.[metric] || 0)}` }}>
                          <Typography variant="caption" color="text.secondary">{metric.replace('_', ' ').toUpperCase()}</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{((modelResult.metrics?.[metric] || 0) * 100).toFixed(1)}%</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>🏆 Leaderboard<IconButton size="small" onClick={fetchModelHistory}><RefreshIcon /></IconButton></Typography>
              <TableContainer component={Paper} sx={{ borderRadius: '12px', maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell sx={{ fontWeight: 700 }}>Rank</TableCell><TableCell sx={{ fontWeight: 700 }}>Model</TableCell><TableCell sx={{ fontWeight: 700 }}>Dataset</TableCell><TableCell sx={{ fontWeight: 700 }} align="right">F1</TableCell><TableCell sx={{ fontWeight: 700 }} align="right">Accuracy</TableCell></TableRow></TableHead>
                  <TableBody>
                    {modelHistory.sort((a, b) => (b.metrics?.f1_score || 0) - (a.metrics?.f1_score || 0)).slice(0, 10).map((run, i) => (
                      <TableRow key={run.id} hover><TableCell>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</TableCell><TableCell><Chip label={run.model_type?.replace('_', ' ') || 'unknown'} size="small" /></TableCell><TableCell>{run.target_dataset || 'N/A'}</TableCell><TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{((run.metrics?.f1_score || 0) * 100).toFixed(1)}%</TableCell><TableCell align="right" sx={{ fontFamily: 'monospace' }}>{((run.metrics?.accuracy || 0) * 100).toFixed(1)}%</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {modelHistory.length === 0 && <Typography color="text.secondary" align="center" sx={{ py: 3 }}>No model runs yet.</Typography>}
            </Card>
          )}

          {activeTab === 4 && <DatasetPreview mode={mode} datasets={userDatasets} onRefresh={fetchUserDatasets} />}

          {activeTab === 5 && <ModelLab mode={mode} />}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default AdminSettings;