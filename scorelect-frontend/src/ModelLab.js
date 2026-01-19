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
  Delete as DeleteIcon, Info as InfoIcon, Warning as WarningIcon,
  CloudOff as CloudOffIcon, HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import axios from 'axios';

const BASE_API_URL = process.env.REACT_APP_API_URL || 'https://scorelect.onrender.com';

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
  background: disabled ? 'linear-gradient(135deg, #555 0%, #444 100%)' : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
  color: '#fff', fontWeight: 600, padding: '12px 24px', borderRadius: '14px', textTransform: 'none',
  boxShadow: disabled ? 'none' : '0 4px 20px rgba(124, 58, 237, 0.4)',
  '&:hover': disabled ? {} : { transform: 'translateY(-2px)' },
  '&:disabled': { background: 'linear-gradient(135deg, #555 0%, #444 100%)', boxShadow: 'none' },
});

const MetricCard = ({ label, value, icon, color, mode, isLowerBetter = false, isRawNumber = false }) => (
  <Box sx={statCard(mode, color)}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="caption" sx={{ color: mode === 'dark' ? '#888' : '#666', fontWeight: 500, textTransform: 'uppercase', fontSize: '0.7rem' }}>
        {label} {isLowerBetter && <span style={{ fontSize: '0.65em', opacity: 0.7 }}>(lower=better)</span>}
      </Typography>
      {icon}
    </Box>
    <Typography variant="h5" sx={{ fontWeight: 700, color: color, fontFamily: 'monospace' }}>
      {typeof value === 'number' ? (isRawNumber ? value.toFixed(4) : `${(value * 100).toFixed(1)}%`) : value || 'N/A'}
    </Typography>
    <LinearProgress variant="determinate" value={typeof value === 'number' ? (isLowerBetter ? (1 - Math.min(value, 1)) * 100 : Math.min(value, 1) * 100) : 0}
      sx={{ mt: 1, height: 4, borderRadius: 2, backgroundColor: `${color}20`, '& .MuiLinearProgress-bar': { borderRadius: 2, background: `linear-gradient(90deg, ${color}, ${color}cc)` } }} />
  </Box>
);

const StatusBanner = ({ type, message, onRetry, mode }) => {
  const configs = {
    loading: { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)' },
    error: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  };
  const config = configs[type] || configs.loading;
  return (
    <Alert severity={type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'}
      sx={{ mb: 2, borderRadius: '12px', backgroundColor: config.bg }}
      action={onRetry && <Button color="inherit" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>Retry</Button>}>
      {message}
    </Alert>
  );
};

const ModelLab = ({ mode = 'dark' }) => {
  const auth = getAuth();
  const [datasets, setDatasets] = useState([]);
  const [customModels, setCustomModels] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [trainingDataset, setTrainingDataset] = useState('');
  const [targetDataset, setTargetDataset] = useState('');
  const [useSameDataset, setUseSameDataset] = useState(true);
  const [targetField, setTargetField] = useState('xP');
  const [runName, setRunName] = useState('');
  const [leaderboardYear, setLeaderboardYear] = useState('2026');
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [datasetsError, setDatasetsError] = useState(null);
  const [modelsError, setModelsError] = useState(null);
  const [runError, setRunError] = useState(null);
  const [result, setResult] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchDatasets = useCallback(async () => {
    try {
      setLoadingDatasets(true);
      setDatasetsError(null);
      const user = auth.currentUser;
      if (!user) { setLoadingDatasets(false); return; }
      const response = await axios.get(`${BASE_API_URL}/api/model-lab/datasets-quick`, { params: { uid: user.uid }, timeout: 30000 });
      const datasetNames = response.data.datasets || [];
      setDatasets(datasetNames);
      setRetryCount(0);
      if (datasetNames.length > 0 && !trainingDataset) {
        setTrainingDataset(datasetNames[0]);
        setTargetDataset(datasetNames[0]);
      }
    } catch (error) {
      console.error('Error fetching datasets:', error);
      const isWaking = error.code === 'ECONNABORTED' || error.response?.status === 503 || error.response?.status === 502;
      if (isWaking && retryCount < 3) {
        setDatasetsError('⏳ Backend starting up... auto-retrying in 5s');
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchDatasets(), 5000);
      } else if (error.response?.status === 500) {
        setDatasetsError('⚠️ Server ran out of memory. Wait 1-2 mins and click Retry.');
      } else {
        setDatasetsError(isWaking ? '⏳ Backend waking up (free tier). Wait 30-60s and click Retry.' : '❌ Could not load datasets. Click Retry.');
      }
    } finally {
      setLoadingDatasets(false);
    }
  }, [auth, trainingDataset, retryCount]);

  const fetchCustomModels = useCallback(async () => {
    try {
      setLoadingModels(true);
      setModelsError(null);
      const response = await axios.get(`${BASE_API_URL}/api/model-lab/custom-models`, { timeout: 30000 });
      const models = response.data.models || [];
      setCustomModels(models);
      if (models.length > 0 && !selectedModel) setSelectedModel(models[0].key);
    } catch (error) {
      console.error('Error fetching models:', error);
      const isWaking = error.code === 'ECONNABORTED' || error.response?.status === 503 || error.response?.status === 502;
      if (error.response?.status === 500) {
        setModelsError('⚠️ Server ran out of memory. Wait 1-2 mins and click Retry.');
      } else {
        setModelsError(isWaking ? '⏳ Backend waking up. Wait 30-60s and click Retry.' : '❌ Could not load models. Click Retry.');
      }
    } finally {
      setLoadingModels(false);
    }
  }, [selectedModel]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoadingLeaderboard(true);
      const user = auth.currentUser;
      if (!user) return;
      const response = await axios.get(`${BASE_API_URL}/api/model-lab/leaderboard`, { params: { uid: user.uid, year: leaderboardYear }, timeout: 15000 });
      setLeaderboard(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [auth, leaderboardYear]);

  useEffect(() => { fetchDatasets(); fetchCustomModels(); }, []);
  useEffect(() => { fetchLeaderboard(); }, [leaderboardYear]);

  const handleTestRun = async () => {
    const user = auth.currentUser;
    if (!user || !selectedModel || !trainingDataset) {
      Swal.fire('Error', 'Please select a model and dataset', 'error');
      return;
    }
    setIsRunning(true); setResult(null); setRunError(null);
    Swal.fire({ title: 'Running Model...', html: '<p>Training on <strong>' + trainingDataset + '</strong></p><p style="color:#888">This may take 30-60 seconds</p>', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
      const response = await axios.post(`${BASE_API_URL}/api/model-lab/test-model`, {
        uid: user.uid, model_key: selectedModel, training_dataset: trainingDataset,
        target_dataset: useSameDataset ? trainingDataset : targetDataset, target_field: targetField,
      }, { timeout: 120000 });
      if (response.data.success) {
        setResult(response.data);
        Swal.fire({ title: 'Test Complete! ✅', html: `<p><strong>Brier Score:</strong> ${response.data.metrics.brier_score?.toFixed(4) || 'N/A'}</p><p><strong>AUC-ROC:</strong> ${((response.data.metrics.auc_roc || 0) * 100).toFixed(1)}%</p>`, icon: 'success' });
      } else throw new Error(response.data.error);
    } catch (error) {
      let msg = error.response?.data?.error || error.message;
      if (error.code === 'ECONNABORTED') msg = 'Timeout - server busy. Try again in a minute.';
      else if (error.response?.status === 502 || error.response?.status === 503 || error.response?.status === 500) msg = 'Server restarting (memory). Wait 1-2 mins and retry.';
      setRunError(msg);
      Swal.fire({ title: 'Error', text: msg, icon: 'error', footer: '<small>💡 Wait 1-2 mins if this keeps happening</small>' });
    } finally { setIsRunning(false); }
  };

  const handleRunAndApply = async () => {
    const user = auth.currentUser;
    if (!user || !selectedModel || !trainingDataset) return;
    const confirm = await Swal.fire({ title: 'Run & Apply?', html: `<p>Train on <strong>${trainingDataset}</strong>, update ${targetField}, save to ${leaderboardYear} leaderboard</p><p style="color:#f59e0b">⚠️ May take 1-2 minutes</p>`, showCancelButton: true, confirmButtonText: 'Run & Apply', confirmButtonColor: '#7c3aed' });
    if (!confirm.isConfirmed) return;
    setIsRunning(true); setResult(null); setRunError(null);
    Swal.fire({ title: 'Running & Applying...', html: '<p>Please wait...</p>', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
      const response = await axios.post(`${BASE_API_URL}/api/model-lab/run-model`, {
        uid: user.uid, model_key: selectedModel, training_dataset: trainingDataset,
        target_dataset: useSameDataset ? trainingDataset : targetDataset, target_field: targetField,
        run_name: runName, leaderboard_year: leaderboardYear,
      }, { timeout: 180000 });
      if (response.data.success) {
        setResult(response.data); setRunName(''); fetchLeaderboard();
        Swal.fire({ title: 'Success! 🎉', html: `<p>✅ Updated ${response.data.shots_updated} shots</p><p>📊 Brier: ${response.data.metrics.brier_score?.toFixed(4)}</p>`, icon: 'success' });
      } else throw new Error(response.data.error);
    } catch (error) {
      let msg = error.response?.data?.error || error.message;
      if (error.response?.status >= 500) msg = 'Server error. Wait 1-2 mins and retry.';
      setRunError(msg);
      Swal.fire({ title: 'Error', text: msg, icon: 'error' });
    } finally { setIsRunning(false); }
  };

  const handleDeleteEntry = async (entryId) => {
    const user = auth.currentUser;
    if (!user) return;
    const confirm = await Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (!confirm.isConfirmed) return;
    try {
      await axios.delete(`${BASE_API_URL}/api/model-lab/leaderboard/${entryId}`, { params: { uid: user.uid } });
      fetchLeaderboard();
    } catch (e) { Swal.fire('Error', 'Could not delete', 'error'); }
  };

  const selectedModelInfo = customModels.find(m => m.key === selectedModel);
  const isBackendLoading = (loadingDatasets || loadingModels) && datasets.length === 0 && customModels.length === 0;

  return (
    <Box sx={{ p: 3, minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ScienceIcon sx={{ fontSize: 40, color: '#7c3aed' }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: mode === 'dark' ? '#fff' : '#1a1a2e' }}>Model Lab</Typography>
            <Typography variant="body2" sx={{ color: mode === 'dark' ? '#888' : '#666' }}>Train and evaluate custom xP/xG models</Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh"><IconButton onClick={() => { setRetryCount(0); fetchDatasets(); fetchCustomModels(); fetchLeaderboard(); }} sx={{ color: '#888' }}><RefreshIcon /></IconButton></Tooltip>
      </Box>

      {isBackendLoading && <StatusBanner type="loading" message="⏳ Connecting to backend... May take 30-60s if server is waking up (free tier)" mode={mode} />}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <Card sx={{ ...glassCard(mode), p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: mode === 'dark' ? '#fff' : '#333' }}><ScienceIcon sx={{ color: '#7c3aed', mr: 1 }} />Model Configuration</Typography>
            
            {modelsError && <StatusBanner type="error" message={modelsError} onRetry={fetchCustomModels} mode={mode} />}
            {datasetsError && <StatusBanner type="error" message={datasetsError} onRetry={() => { setRetryCount(0); fetchDatasets(); }} mode={mode} />}
            {runError && <StatusBanner type="warning" message={runError} mode={mode} />}

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Model</InputLabel>
                  <Select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} label="Select Model" disabled={loadingModels || !customModels.length}>
                    {loadingModels ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} />Loading models...</MenuItem>
                      : !customModels.length ? <MenuItem disabled>No models available</MenuItem>
                      : customModels.map((m) => <MenuItem key={m.key} value={m.key}><Box><Typography sx={{ fontWeight: 600 }}>{m.name}</Typography><Typography variant="caption" sx={{ color: '#888' }}>{m.description}</Typography></Box></MenuItem>)}
                  </Select>
                </FormControl>
                {loadingModels && !modelsError && <Typography variant="caption" sx={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}><CircularProgress size={12} />Loading models...</Typography>}
              </Grid>

              {selectedModelInfo && (
                <Grid item xs={12}>
                  <Alert severity="info" icon={<InfoIcon />} sx={{ borderRadius: '12px' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{selectedModelInfo.name}</Typography>
                    <Typography variant="body2">{selectedModelInfo.description}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {selectedModelInfo.features?.slice(0, 6).map((f, i) => <Chip key={i} label={f} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />)}
                      {selectedModelInfo.features?.length > 6 && <Chip label={`+${selectedModelInfo.features.length - 6}`} size="small" />}
                    </Box>
                  </Alert>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Training Dataset</InputLabel>
                  <Select value={trainingDataset} onChange={(e) => { setTrainingDataset(e.target.value); if (useSameDataset) setTargetDataset(e.target.value); }} label="Training Dataset" disabled={loadingDatasets || !datasets.length}>
                    {loadingDatasets ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} />Loading...</MenuItem>
                      : !datasets.length ? <MenuItem disabled>No datasets</MenuItem>
                      : datasets.map((ds) => <MenuItem key={ds} value={ds}>{ds}</MenuItem>)}
                  </Select>
                </FormControl>
                {loadingDatasets && !datasetsError && <Typography variant="caption" sx={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}><CircularProgress size={12} />Loading datasets...</Typography>}
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth><InputLabel>Target Field</InputLabel>
                  <Select value={targetField} onChange={(e) => setTargetField(e.target.value)} label="Target Field">
                    <MenuItem value="xP">xP (Expected Points)</MenuItem><MenuItem value="xG">xG (Expected Goals)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}><FormControlLabel control={<Switch checked={useSameDataset} onChange={(e) => { setUseSameDataset(e.target.checked); if (e.target.checked) setTargetDataset(trainingDataset); }} />} label="Apply predictions to same dataset" /></Grid>
              {!useSameDataset && <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Target Dataset</InputLabel><Select value={targetDataset} onChange={(e) => setTargetDataset(e.target.value)} label="Target Dataset">{datasets.map((ds) => <MenuItem key={ds} value={ds}>{ds}</MenuItem>)}</Select></FormControl></Grid>}
              <Grid item xs={12} md={6}><TextField fullWidth label="Run Name (optional)" value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="e.g., My Model v2" helperText="Shows on leaderboard" /></Grid>
              <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Leaderboard Year</InputLabel><Select value={leaderboardYear} onChange={(e) => setLeaderboardYear(e.target.value)} label="Leaderboard Year"><MenuItem value="2026">2026 (Current)</MenuItem><MenuItem value="2025">2025 (Archive)</MenuItem></Select></FormControl></Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 2, mt: 4, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={handleTestRun} disabled={isRunning || !selectedModel || !trainingDataset || loadingModels || loadingDatasets} startIcon={isRunning ? <CircularProgress size={20} /> : <PlayIcon />} sx={{ borderRadius: '12px', borderColor: '#7c3aed', color: '#7c3aed', px: 3 }}>{isRunning ? 'Running...' : 'Test Run'}</Button>
              <Button variant="contained" onClick={handleRunAndApply} disabled={isRunning || !selectedModel || !trainingDataset || loadingModels || loadingDatasets} startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <ApplyIcon />} sx={gradientButton(isRunning || !selectedModel || !trainingDataset)}>{isRunning ? 'Running...' : 'Run & Apply'}</Button>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#666' }}>💡 <strong>Test Run</strong> = evaluate only. <strong>Run & Apply</strong> = update dataset + save to leaderboard.</Typography>
            {(loadingModels || loadingDatasets) && !modelsError && !datasetsError && <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }} icon={<HourglassIcon />}>⏳ Waiting for server... Click refresh if this takes &gt;60s</Alert>}
          </Card>

          {result && (
            <Card sx={{ ...glassCard(mode), p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <AutoGraphIcon sx={{ color: '#22c55e', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>Results: {result.model_name}</Typography>
                <Chip icon={result.test_run ? <PlayIcon /> : <CheckIcon />} label={result.test_run ? 'Test Run' : `Applied - ${result.execution_time}s`} size="small" sx={{ ml: 'auto', backgroundColor: result.test_run ? '#f59e0b20' : '#22c55e20', color: result.test_run ? '#f59e0b' : '#22c55e' }} />
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}><MetricCard label="Brier Score ⭐" value={result.metrics?.brier_score} icon={<CheckIcon sx={{ color: '#22c55e', fontSize: 18 }} />} color="#22c55e" mode={mode} isLowerBetter isRawNumber /></Grid>
                <Grid item xs={6} sm={3}><MetricCard label="Calibration" value={result.metrics?.calibration_error} icon={<TrendingUpIcon sx={{ color: '#f59e0b', fontSize: 18 }} />} color="#f59e0b" mode={mode} isLowerBetter /></Grid>
                <Grid item xs={6} sm={3}><MetricCard label="AUC-ROC" value={result.metrics?.auc_roc} icon={<AnalyticsIcon sx={{ color: '#7c3aed', fontSize: 18 }} />} color="#7c3aed" mode={mode} /></Grid>
                <Grid item xs={6} sm={3}><MetricCard label="F1 Score" value={result.metrics?.f1_score} icon={<SpeedIcon sx={{ color: '#06b6d4', fontSize: 18 }} />} color="#06b6d4" mode={mode} /></Grid>
              </Grid>
              {!result.test_run && result.shots_updated > 0 && <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '12px' }}><Typography variant="body2" sx={{ color: '#22c55e', fontWeight: 600 }}>✓ Updated {result.shots_updated} shots in {result.games_updated} games</Typography></Box>}
            </Card>
          )}
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card sx={{ ...glassCard(mode), p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><TrophyIcon sx={{ color: '#f59e0b', fontSize: 28 }} /><Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>Leaderboard</Typography></Box>
              <FormControl size="small" sx={{ minWidth: 100 }}><Select value={leaderboardYear} onChange={(e) => setLeaderboardYear(e.target.value)} sx={{ borderRadius: '8px' }}><MenuItem value="2026">2026</MenuItem><MenuItem value="2025">2025</MenuItem></Select></FormControl>
            </Box>
            {loadingLeaderboard ? <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}><CircularProgress sx={{ color: '#7c3aed', mb: 2 }} /><Typography variant="body2" sx={{ color: '#888' }}>Loading...</Typography></Box>
              : !leaderboard.length ? <Box sx={{ textAlign: 'center', py: 6 }}><TrophyIcon sx={{ fontSize: 60, color: '#444', mb: 2 }} /><Typography variant="h6" sx={{ color: '#666' }}>No entries for {leaderboardYear}</Typography><Typography variant="body2" sx={{ color: '#555' }}>Use "Run & Apply" to add entries!</Typography></Box>
              : <TableContainer sx={{ maxHeight: 400 }}><Table size="small" stickyHeader>
                  <TableHead><TableRow>
                    <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5', fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5', fontWeight: 700 }}>Model</TableCell>
                    <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5', fontWeight: 700 }} align="right">Brier</TableCell>
                    <TableCell sx={{ backgroundColor: mode === 'dark' ? '#2a2a3a' : '#f5f5f5' }}></TableCell>
                  </TableRow></TableHead>
                  <TableBody>{leaderboard.sort((a, b) => (a.metrics?.brier_score || 1) - (b.metrics?.brier_score || 1)).map((entry, i) => (
                    <TableRow key={entry.id} hover>
                      <TableCell>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</TableCell>
                      <TableCell><Tooltip title={`${entry.training_dataset} • ${entry.target_field}`}><Box><Typography variant="body2" sx={{ fontWeight: 600, color: mode === 'dark' ? '#fff' : '#333' }}>{entry.run_name || entry.model_name}</Typography><Typography variant="caption" sx={{ color: '#666' }}>{entry.model_name}</Typography></Box></Tooltip></TableCell>
                      <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#22c55e', fontWeight: 600 }}>{entry.metrics?.brier_score?.toFixed(4) || 'N/A'}</Typography></TableCell>
                      <TableCell><IconButton size="small" onClick={() => handleDeleteEntry(entry.id)} sx={{ color: '#ef4444', opacity: 0.6, '&:hover': { opacity: 1 } }}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table></TableContainer>}
          </Card>

          <Card sx={{ ...glassCard(mode), p: 3, mt: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: mode === 'dark' ? '#fff' : '#333' }}>📖 Create Custom Models</Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>Edit <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>custom_models.py</code>:</Typography>
            <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: '10px', backgroundColor: '#0d0d12', color: '#e0e0e0', p: 2, borderRadius: '8px', overflow: 'auto', maxHeight: 150 }}>
{`class MyModel(BaseCustomModel):
    name = "My Model"
    def get_feature_list(self):
        return ['dist', 'angle_abs']
    def train(self, X, y):
        model = RandomForestClassifier()
        model.fit(X, y)
        return model

# Add to AVAILABLE_MODELS`}</Box>
            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#666' }}>Push to GitHub, wait ~5 mins for deploy, then refresh.</Typography>
          </Card>

          <Card sx={{ ...glassCard(mode), p: 2, mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#888' }}>⚡ Server Tips</Typography>
            <Typography variant="caption" sx={{ color: '#666' }}>• Free tier sleeps after 15 mins<br/>• First request takes 30-60s<br/>• Memory errors = wait 1-2 mins<br/>• Large datasets may timeout</Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ModelLab;