import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Button, IconButton, Grid, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Alert, Tooltip, CircularProgress, LinearProgress, TextField,
  Switch, FormControlLabel, Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon, PlayArrow as PlayIcon, Science as ScienceIcon,
  EmojiEvents as TrophyIcon, CloudUpload as ApplyIcon,
  Speed as SpeedIcon, Analytics as AnalyticsIcon, AutoGraph as AutoGraphIcon,
  CheckCircle as CheckIcon, TrendingUp as TrendingUpIcon,
  Delete as DeleteIcon, Info as InfoIcon,
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import axios from 'axios';

const BASE_API_URL = process.env.REACT_APP_API_URL || 'https://scorelect.onrender.com';

// Styles
const glassCard = (mode) => ({
  background: mode === 'dark' 
    ? 'linear-gradient(135deg, rgba(40, 40, 50, 0.9) 0%, rgba(30, 30, 40, 0.95) 100%)'
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(245, 245, 250, 0.9) 100%)',
  backdropFilter: 'blur(20px)',
  border: mode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
  borderRadius: '20px',
  boxShadow: mode === 'dark' 
    ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
    : '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
});

const statCard = (mode, color) => ({
  background: mode === 'dark' ? `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)` : `linear-gradient(135deg, ${color}12 0%, ${color}05 100%)`,
  border: `1px solid ${color}30`,
  borderRadius: '16px',
  padding: '16px',
  position: 'relative',
  overflow: 'hidden',
  '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${color}, ${color}80)` },
});

const gradientButton = (disabled = false) => ({
  background: disabled 
    ? 'linear-gradient(135deg, #555 0%, #444 100%)'
    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
  backgroundSize: '200% 200%',
  color: '#fff',
  fontWeight: 600,
  padding: '12px 24px',
  borderRadius: '14px',
  textTransform: 'none',
  fontSize: '0.95rem',
  boxShadow: disabled ? 'none' : '0 4px 20px rgba(124, 58, 237, 0.4)',
  transition: 'all 0.3s ease',
  '&:hover': disabled ? {} : { transform: 'translateY(-2px)', boxShadow: '0 6px 30px rgba(124, 58, 237, 0.5)' },
  '&:disabled': { background: 'linear-gradient(135deg, #555 0%, #444 100%)', boxShadow: 'none' },
});

// Metric Card Component
const MetricCard = ({ label, value, icon, color, mode, isLowerBetter = false, isRawNumber = false }) => (
  <Box sx={statCard(mode, color)}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="caption" sx={{ color: mode === 'dark' ? '#888' : '#666', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>
        {label} {isLowerBetter && <span style={{ fontSize: '0.65em', opacity: 0.7 }}>(lower=better)</span>}
      </Typography>
      {icon}
    </Box>
    <Typography variant="h5" sx={{ fontWeight: 700, color: color, fontFamily: 'monospace' }}>
      {typeof value === 'number' ? (isRawNumber ? value.toFixed(4) : `${(value * 100).toFixed(1)}%`) : value || 'N/A'}
    </Typography>
    <LinearProgress 
      variant="determinate" 
      value={typeof value === 'number' ? (isLowerBetter ? (1 - Math.min(value, 1)) * 100 : Math.min(value, 1) * 100) : 0}
      sx={{ mt: 1, height: 4, borderRadius: 2, backgroundColor: `${color}20`, '& .MuiLinearProgress-bar': { borderRadius: 2, background: `linear-gradient(90deg, ${color}, ${color}cc)` } }} 
    />
  </Box>
);


const ModelLab = ({ mode = 'dark' }) => {
  const auth = getAuth();
  
  // Data states
  const [datasets, setDatasets] = useState([]);
  const [customModels, setCustomModels] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Selection states
  const [selectedModel, setSelectedModel] = useState('');
  const [trainingDataset, setTrainingDataset] = useState('');
  const [targetDataset, setTargetDataset] = useState('');
  const [useSameDataset, setUseSameDataset] = useState(true);
  const [targetField, setTargetField] = useState('xP');
  const [runName, setRunName] = useState('');
  const [leaderboardYear, setLeaderboardYear] = useState('2026');
  
  // Loading states
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Results
  const [result, setResult] = useState(null);
  
  // Fetch datasets
  const fetchDatasets = useCallback(async () => {
    try {
      setLoadingDatasets(true);
      const user = auth.currentUser;
      if (!user) return;
      
      const response = await axios.get(`${BASE_API_URL}/api/model-lab/datasets-quick`, {
        params: { uid: user.uid },
        timeout: 15000
      });
      
      const datasetNames = response.data.datasets || [];
      setDatasets(datasetNames);
      
      if (datasetNames.length > 0 && !trainingDataset) {
        setTrainingDataset(datasetNames[0]);
        setTargetDataset(datasetNames[0]);
      }
    } catch (error) {
      console.error('Error fetching datasets:', error);
    } finally {
      setLoadingDatasets(false);
    }
  }, [auth, trainingDataset]);
  
  // Fetch custom models
  const fetchCustomModels = useCallback(async () => {
    try {
      setLoadingModels(true);
      const response = await axios.get(`${BASE_API_URL}/api/model-lab/custom-models`);
      const models = response.data.models || [];
      setCustomModels(models);
      
      if (models.length > 0 && !selectedModel) {
        setSelectedModel(models[0].key);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoadingModels(false);
    }
  }, [selectedModel]);
  
  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoadingLeaderboard(true);
      const user = auth.currentUser;
      if (!user) return;
      
      const response = await axios.get(`${BASE_API_URL}/api/model-lab/leaderboard`, {
        params: { uid: user.uid, year: leaderboardYear }
      });
      
      setLeaderboard(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [auth, leaderboardYear]);
  
  // Initial load
  useEffect(() => {
    fetchDatasets();
    fetchCustomModels();
  }, [fetchDatasets, fetchCustomModels]);
  
  // Load leaderboard when year changes
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard, leaderboardYear]);
  
  // Test Run (no DB updates)
  const handleTestRun = async () => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire('Error', 'Please sign in to use Model Lab', 'error');
      return;
    }
    
    if (!selectedModel || !trainingDataset) {
      Swal.fire('Error', 'Please select a model and dataset', 'error');
      return;
    }
    
    setIsRunning(true);
    setResult(null);
    
    try {
      const response = await axios.post(`${BASE_API_URL}/api/model-lab/test-model`, {
        uid: user.uid,
        model_key: selectedModel,
        training_dataset: trainingDataset,
        target_dataset: useSameDataset ? trainingDataset : targetDataset,
        target_field: targetField,
      });
      
      if (response.data.success) {
        setResult(response.data);
        Swal.fire({
          title: 'Test Complete!',
          text: `Brier Score: ${response.data.metrics.brier_score?.toFixed(4) || 'N/A'} (lower is better)`,
          icon: 'success',
        });
      } else {
        throw new Error(response.data.error || 'Test failed');
      }
    } catch (error) {
      console.error('Test run error:', error);
      Swal.fire('Error', error.response?.data?.error || error.message, 'error');
    } finally {
      setIsRunning(false);
    }
  };
  
  // Run & Apply (updates DB and leaderboard)
  const handleRunAndApply = async () => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire('Error', 'Please sign in to use Model Lab', 'error');
      return;
    }
    
    if (!selectedModel || !trainingDataset) {
      Swal.fire('Error', 'Please select a model and dataset', 'error');
      return;
    }
    
    // Confirm action
    const confirmResult = await Swal.fire({
      title: 'Run & Apply Model?',
      html: `
        <p>This will:</p>
        <ul style="text-align: left;">
          <li>Train the model on <strong>${trainingDataset}</strong></li>
          <li>Update ${targetField} values in <strong>${useSameDataset ? trainingDataset : targetDataset}</strong></li>
          <li>Save results to the <strong>${leaderboardYear}</strong> leaderboard</li>
        </ul>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Run & Apply',
      confirmButtonColor: '#7c3aed',
    });
    
    if (!confirmResult.isConfirmed) return;
    
    setIsRunning(true);
    setResult(null);
    
    try {
      const response = await axios.post(`${BASE_API_URL}/api/model-lab/run-model`, {
        uid: user.uid,
        model_key: selectedModel,
        training_dataset: trainingDataset,
        target_dataset: useSameDataset ? trainingDataset : targetDataset,
        target_field: targetField,
        run_name: runName,
        leaderboard_year: leaderboardYear,
      });
      
      if (response.data.success) {
        setResult(response.data);
        setRunName(''); // Clear run name
        fetchLeaderboard(); // Refresh leaderboard
        
        Swal.fire({
          title: 'Success!',
          html: `
            <p><strong>${response.data.model_name}</strong></p>
            <p>Updated ${response.data.shots_updated} shots in ${response.data.games_updated} games</p>
            <p>Brier Score: ${response.data.metrics.brier_score?.toFixed(4) || 'N/A'}</p>
          `,
          icon: 'success',
        });
      } else {
        throw new Error(response.data.error || 'Run failed');
      }
    } catch (error) {
      console.error('Run error:', error);
      Swal.fire('Error', error.response?.data?.error || error.message, 'error');
    } finally {
      setIsRunning(false);
    }
  };
  
  // Delete leaderboard entry
  const handleDeleteEntry = async (entryId) => {
    const user = auth.currentUser;
    if (!user) return;
    
    const confirmResult = await Swal.fire({
      title: 'Delete Entry?',
      text: 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444',
    });
    
    if (!confirmResult.isConfirmed) return;
    
    try {
      await axios.delete(`${BASE_API_URL}/api/model-lab/leaderboard/${entryId}`, {
        params: { uid: user.uid }
      });
      fetchLeaderboard();
      Swal.fire('Deleted', 'Entry removed from leaderboard', 'success');
    } catch (error) {
      Swal.fire('Error', 'Could not delete entry', 'error');
    }
  };
  
  // Get selected model info
  const selectedModelInfo = customModels.find(m => m.key === selectedModel);

  return (
    <Box sx={{ p: 3, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ScienceIcon sx={{ fontSize: 40, color: '#7c3aed' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: mode === 'dark' ? '#fff' : '#1a1a2e' }}>
              Model Lab
            </Typography>
            <Typography variant="body2" sx={{ color: mode === 'dark' ? '#888' : '#666' }}>
              Train and evaluate custom xP/xG models
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={() => { fetchDatasets(); fetchCustomModels(); fetchLeaderboard(); }} sx={{ color: mode === 'dark' ? '#888' : '#666' }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column: Configuration */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ ...glassCard(mode), p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: mode === 'dark' ? '#fff' : '#333', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScienceIcon sx={{ color: '#7c3aed' }} />
              Model Configuration
            </Typography>

            <Grid container spacing={3}>
              {/* Model Selection */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Model</InputLabel>
                  <Select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    label="Select Model"
                    disabled={loadingModels}
                  >
                    {customModels.map((model) => (
                      <MenuItem key={model.key} value={model.key}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>{model.name}</Typography>
                          <Typography variant="caption" sx={{ color: '#888' }}>{model.description}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Selected Model Info */}
              {selectedModelInfo && (
                <Grid item xs={12}>
                  <Alert severity="info" icon={<InfoIcon />} sx={{ borderRadius: '12px' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{selectedModelInfo.name}</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>{selectedModelInfo.description}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {selectedModelInfo.features?.slice(0, 8).map((f, i) => (
                        <Chip key={i} label={f} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                      ))}
                      {selectedModelInfo.features?.length > 8 && (
                        <Chip label={`+${selectedModelInfo.features.length - 8} more`} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                      )}
                    </Box>
                  </Alert>
                </Grid>
              )}

              {/* Training Dataset */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Training Dataset</InputLabel>
                  <Select
                    value={trainingDataset}
                    onChange={(e) => {
                      setTrainingDataset(e.target.value);
                      if (useSameDataset) setTargetDataset(e.target.value);
                    }}
                    label="Training Dataset"
                    disabled={loadingDatasets}
                  >
                    {datasets.map((ds) => (
                      <MenuItem key={ds} value={ds}>{ds}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Target Field */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Target Field</InputLabel>
                  <Select
                    value={targetField}
                    onChange={(e) => setTargetField(e.target.value)}
                    label="Target Field"
                  >
                    <MenuItem value="xP">xP (Expected Points)</MenuItem>
                    <MenuItem value="xG">xG (Expected Goals)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Same Dataset Toggle */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={useSameDataset}
                      onChange={(e) => {
                        setUseSameDataset(e.target.checked);
                        if (e.target.checked) setTargetDataset(trainingDataset);
                      }}
                      color="primary"
                    />
                  }
                  label="Apply predictions to same dataset"
                />
              </Grid>

              {/* Target Dataset (if different) */}
              {!useSameDataset && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Target Dataset</InputLabel>
                    <Select
                      value={targetDataset}
                      onChange={(e) => setTargetDataset(e.target.value)}
                      label="Target Dataset"
                    >
                      {datasets.map((ds) => (
                        <MenuItem key={ds} value={ds}>{ds}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {/* Run Name (optional) */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Run Name (optional)"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  placeholder="e.g., My Best Model v2"
                  helperText="Shows on leaderboard"
                />
              </Grid>

              {/* Leaderboard Year */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Leaderboard Year</InputLabel>
                  <Select
                    value={leaderboardYear}
                    onChange={(e) => setLeaderboardYear(e.target.value)}
                    label="Leaderboard Year"
                  >
                    <MenuItem value="2026">2026 (Current)</MenuItem>
                    <MenuItem value="2025">2025 (Archive)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 4, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={handleTestRun}
                disabled={isRunning || !selectedModel || !trainingDataset}
                startIcon={isRunning ? <CircularProgress size={20} /> : <PlayIcon />}
                sx={{ 
                  borderRadius: '12px', 
                  borderColor: '#7c3aed', 
                  color: '#7c3aed',
                  px: 3,
                  '&:hover': { borderColor: '#9333ea', backgroundColor: 'rgba(124, 58, 237, 0.1)' }
                }}
              >
                Test Run
              </Button>
              
              <Button
                variant="contained"
                onClick={handleRunAndApply}
                disabled={isRunning || !selectedModel || !trainingDataset}
                startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <ApplyIcon />}
                sx={gradientButton(isRunning || !selectedModel || !trainingDataset)}
              >
                Run & Apply
              </Button>
            </Box>

            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: mode === 'dark' ? '#666' : '#888' }}>
              💡 <strong>Test Run</strong> evaluates without saving. <strong>Run & Apply</strong> updates your dataset and saves to leaderboard.
            </Typography>
          </Card>

          {/* Results Card */}
          {result && (
            <Card sx={{ ...glassCard(mode), p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <AutoGraphIcon sx={{ color: '#22c55e', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
                  Results: {result.model_name}
                </Typography>
                <Chip
                  icon={result.test_run ? <PlayIcon /> : <CheckIcon />}
                  label={result.test_run ? 'Test Run' : `Applied - ${result.execution_time}s`}
                  size="small"
                  sx={{ 
                    ml: 'auto', 
                    backgroundColor: result.test_run ? '#f59e0b20' : '#22c55e20', 
                    color: result.test_run ? '#f59e0b' : '#22c55e' 
                  }}
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <MetricCard
                    label="Brier Score ⭐"
                    value={result.metrics?.brier_score}
                    icon={<CheckIcon sx={{ color: '#22c55e', fontSize: 18 }} />}
                    color="#22c55e"
                    mode={mode}
                    isLowerBetter={true}
                    isRawNumber={true}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MetricCard
                    label="Calibration"
                    value={result.metrics?.calibration_error}
                    icon={<TrendingUpIcon sx={{ color: '#f59e0b', fontSize: 18 }} />}
                    color="#f59e0b"
                    mode={mode}
                    isLowerBetter={true}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MetricCard
                    label="AUC-ROC"
                    value={result.metrics?.auc_roc}
                    icon={<AnalyticsIcon sx={{ color: '#7c3aed', fontSize: 18 }} />}
                    color="#7c3aed"
                    mode={mode}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MetricCard
                    label="F1 Score"
                    value={result.metrics?.f1_score}
                    icon={<SpeedIcon sx={{ color: '#06b6d4', fontSize: 18 }} />}
                    color="#06b6d4"
                    mode={mode}
                  />
                </Grid>
              </Grid>

              {!result.test_run && result.shots_updated > 0 && (
                <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px' }}>
                  <Typography variant="body2" sx={{ color: '#22c55e', fontWeight: 600 }}>
                    ✓ Updated {result.shots_updated} shots in {result.games_updated} games
                  </Typography>
                </Box>
              )}
            </Card>
          )}
        </Grid>

        {/* Right Column: Leaderboard */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ ...glassCard(mode), p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TrophyIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
                  Leaderboard
                </Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={leaderboardYear}
                  onChange={(e) => setLeaderboardYear(e.target.value)}
                  sx={{ borderRadius: '8px' }}
                >
                  <MenuItem value="2026">2026</MenuItem>
                  <MenuItem value="2025">2025</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {loadingLeaderboard ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress sx={{ color: '#7c3aed' }} />
              </Box>
            ) : leaderboard.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <TrophyIcon sx={{ fontSize: 60, color: mode === 'dark' ? '#444' : '#ddd', mb: 2 }} />
                <Typography variant="h6" sx={{ color: mode === 'dark' ? '#666' : '#999', mb: 1 }}>
                  No entries yet for {leaderboardYear}
                </Typography>
                <Typography variant="body2" sx={{ color: mode === 'dark' ? '#555' : '#aaa' }}>
                  Run a model with "Run & Apply" to add your first entry!
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none', maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5', fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5', fontWeight: 700 }}>Model</TableCell>
                      <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5', fontWeight: 700 }} align="right">Brier</TableCell>
                      <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5', fontWeight: 700 }} align="right">AUC</TableCell>
                      <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaderboard
                      .sort((a, b) => (a.metrics?.brier_score || 1) - (b.metrics?.brier_score || 1))
                      .map((entry, index) => (
                        <TableRow key={entry.id} hover>
                          <TableCell>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </TableCell>
                          <TableCell>
                            <Tooltip title={`${entry.training_dataset} • ${entry.target_field}`}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: mode === 'dark' ? '#fff' : '#333' }}>
                                  {entry.run_name || entry.model_name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: mode === 'dark' ? '#666' : '#888' }}>
                                  {entry.model_name}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#22c55e', fontWeight: 600 }}>
                              {entry.metrics?.brier_score?.toFixed(4) || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#7c3aed' }}>
                              {entry.metrics?.auc_roc ? `${(entry.metrics.auc_roc * 100).toFixed(1)}%` : 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => handleDeleteEntry(entry.id)} sx={{ color: '#ef4444', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>

          {/* Instructions Card */}
          <Card sx={{ ...glassCard(mode), p: 3, mt: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: mode === 'dark' ? '#fff' : '#333', display: 'flex', alignItems: 'center', gap: 1 }}>
              📖 How to Create Custom Models
            </Typography>
            
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" sx={{ color: mode === 'dark' ? '#aaa' : '#555', mb: 2 }}>
              Edit <code style={{ backgroundColor: mode === 'dark' ? '#333' : '#e0e0e0', padding: '2px 6px', borderRadius: '4px' }}>custom_models.py</code> on your backend:
            </Typography>
            
            <Box component="pre" sx={{ 
              fontFamily: 'monospace', 
              fontSize: '11px', 
              backgroundColor: mode === 'dark' ? '#0d0d12' : '#f5f5f5',
              color: mode === 'dark' ? '#e0e0e0' : '#333',
              p: 2, 
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: 200,
            }}>
{`class MyModel(BaseCustomModel):
    name = "My Model"
    description = "My custom xP model"
    
    def get_feature_list(self):
        return ['dist', 'angle_abs', 
                'pressure_value', 'is_setplay']
    
    def train(self, X, y):
        model = RandomForestClassifier(
            n_estimators=100
        )
        model.fit(X, y)
        return model

# Add to AVAILABLE_MODELS:
AVAILABLE_MODELS = {
    ...
    'my_model': MyModel,
}`}
            </Box>
            
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: mode === 'dark' ? '#666' : '#888' }}>
              After adding your model, restart the server and it will appear in the dropdown above.
            </Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ModelLab;