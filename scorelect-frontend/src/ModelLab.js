import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Button, IconButton, Grid, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Switch, Alert, Tooltip, CircularProgress, LinearProgress, Slider, ToggleButton, ToggleButtonGroup, 
  Grow, Tabs, Tab, Skeleton, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon, PlayArrow as PlayIcon, Science as ScienceIcon, Tune as TuneIcon,
  EmojiEvents as TrophyIcon, CloudUpload as ApplyIcon, RestartAlt as ResetIcon,
  Speed as SpeedIcon, Analytics as AnalyticsIcon, Memory as MemoryIcon, AutoGraph as AutoGraphIcon,
  CheckCircle as CheckIcon, TrendingUp as TrendingUpIcon, DataObject as DataIcon, Hub as HubIcon,
  Code as CodeIcon, Terminal as TerminalIcon, Functions as FunctionsIcon,
  Storage as StorageIcon, ModelTraining as TrainIcon, DoubleArrow as TransferIcon,
  ContentCopy as CopyIcon, Info as InfoIcon,
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
  padding: '20px',
  position: 'relative',
  overflow: 'hidden',
  '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${color}, ${color}80)` },
});

const gradientButton = {
  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
  backgroundSize: '200% 200%',
  color: '#fff',
  fontWeight: 600,
  padding: '12px 32px',
  borderRadius: '14px',
  textTransform: 'none',
  fontSize: '1rem',
  boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
  transition: 'all 0.3s ease',
  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 30px rgba(124, 58, 237, 0.5)' },
  '&:disabled': { background: 'linear-gradient(135deg, #555 0%, #444 100%)', boxShadow: 'none' },
};

const ALGORITHMS = [
  { id: 'random_forest', name: 'Random Forest', icon: '🌲', description: 'Ensemble of decision trees. Great balance.', color: '#22c55e',
    params: [{ id: 'n_estimators', name: 'Trees', type: 'int', default: 100, min: 10, max: 500, step: 10 }, { id: 'max_depth', name: 'Max Depth', type: 'int', default: 10, min: 2, max: 50, step: 1 }] },
  { id: 'gradient_boosting', name: 'Gradient Boosting', icon: '🚀', description: 'Sequential ensemble. Best accuracy.', color: '#f59e0b',
    params: [{ id: 'n_estimators', name: 'Trees', type: 'int', default: 100, min: 10, max: 500, step: 10 }, { id: 'learning_rate', name: 'Learning Rate', type: 'float', default: 0.1, min: 0.01, max: 1.0, step: 0.01 }] },
  { id: 'logistic_regression', name: 'Logistic Regression', icon: '📈', description: 'Simple, fast, interpretable.', color: '#3b82f6',
    params: [{ id: 'C', name: 'Regularization', type: 'float', default: 1.0, min: 0.01, max: 100, step: 0.1 }] },
  { id: 'mlp', name: 'Neural Network', icon: '🧠', description: 'Multi-layer perceptron for complex patterns.', color: '#ec4899',
    params: [{ id: 'learning_rate_init', name: 'Learning Rate', type: 'float', default: 0.001, min: 0.0001, max: 0.1, step: 0.0001 }] },
  { id: 'knn', name: 'K-Nearest Neighbors', icon: '🎯', description: 'Instance-based learning.', color: '#06b6d4',
    params: [{ id: 'n_neighbors', name: 'Neighbors (K)', type: 'int', default: 5, min: 1, max: 50, step: 1 }] },
];

const FEATURE_GROUPS = {
  core: { name: 'Core Features', icon: '⚡', color: '#7c3aed', features: [
    { id: 'dist', name: 'Distance' }, { id: 'angle_abs', name: 'Angle' }, { id: 'pressure_value', name: 'Pressure' }, { id: 'position_value', name: 'Position' }] },
  setPlay: { name: 'Set Plays', icon: '🎯', color: '#f59e0b', features: [
    { id: 'is_setplay', name: 'Set Play' }, { id: 'is_penalty', name: 'Penalty' }, { id: 'is_free', name: 'Free Kick' }, { id: 'is_45', name: '45m Free' }] },
  spatial: { name: 'Spatial', icon: '📍', color: '#22c55e', features: [
    { id: 'is_central', name: 'Central' }, { id: 'is_long_shot', name: 'Long Shot' }, { id: 'is_very_close', name: 'Close Range' }, { id: 'is_extreme_angle', name: 'Extreme Angle' }] },
  advanced: { name: 'Advanced', icon: '🔬', color: '#ec4899', features: [
    { id: 'dist_squared', name: 'Dist²' }, { id: 'dist_log', name: 'Log Dist' }, { id: 'dist_angle_interaction', name: 'Dist×Angle' }] },
  existing: { name: 'Existing Model Values', icon: '📊', color: '#06b6d4', features: [
    { id: 'existing_xP', name: 'Existing xP' }, { id: 'existing_xG', name: 'Existing xG' }] },
};

const MetricCard = ({ label, value, icon, color, mode }) => (
  <Box sx={statCard(mode, color)}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="caption" sx={{ color: mode === 'dark' ? '#888' : '#666', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Typography>
      {icon}
    </Box>
    <Typography variant="h4" sx={{ fontWeight: 700, color: color, fontFamily: 'monospace' }}>
      {typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value}
    </Typography>
    <LinearProgress variant="determinate" value={typeof value === 'number' ? value * 100 : 0}
      sx={{ mt: 1.5, height: 6, borderRadius: 3, backgroundColor: `${color}20`, '& .MuiLinearProgress-bar': { borderRadius: 3, background: `linear-gradient(90deg, ${color}, ${color}cc)` } }} />
  </Box>
);

// Loading skeleton for datasets
const DatasetSkeleton = ({ mode }) => (
  <Box sx={{ p: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
      <CircularProgress size={20} sx={{ color: '#7c3aed' }} />
      <Typography variant="body2" sx={{ color: mode === 'dark' ? '#888' : '#666' }}>
        Loading datasets... This may take a moment for large collections.
      </Typography>
    </Box>
    <Skeleton variant="text" width="60%" height={30} sx={{ bgcolor: mode === 'dark' ? '#333' : '#e0e0e0' }} />
    <Skeleton variant="rectangular" height={56} sx={{ mt: 2, borderRadius: '12px', bgcolor: mode === 'dark' ? '#333' : '#e0e0e0' }} />
    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
      <Skeleton variant="rounded" width={80} height={32} sx={{ bgcolor: mode === 'dark' ? '#333' : '#e0e0e0' }} />
      <Skeleton variant="rounded" width={100} height={32} sx={{ bgcolor: mode === 'dark' ? '#333' : '#e0e0e0' }} />
    </Box>
  </Box>
);

// Default Python code template
const DEFAULT_PYTHON_CODE = `# Custom Model Lab Code
# This code runs on the server with access to your dataset
# Available variables: df (pandas DataFrame with shot data)
# Required: return a dictionary with 'predictions' array

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

def custom_model(df):
    """
    Custom model function - modify this to create your own xP/xG model
    
    Parameters:
    - df: pandas DataFrame with columns like 'dist', 'angle_abs', 'pressure_value', etc.
    
    Returns:
    - dict with 'predictions' (array of probabilities) and 'metrics' (dict of scores)
    """
    
    # Define features to use
    features = ['dist', 'angle_abs', 'pressure_value', 'is_setplay']
    X = df[features].fillna(0)
    y = df['scored']  # Binary target: 1 if scored, 0 if not
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train model
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Get predictions for ALL data
    X_all_scaled = scaler.transform(X)
    predictions = model.predict_proba(X_all_scaled)[:, 1]
    
    # Calculate metrics on test set
    from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]
    
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'f1_score': f1_score(y_test, y_pred),
        'auc_roc': roc_auc_score(y_test, y_proba) if len(set(y_test)) > 1 else 0.5,
    }
    
    return {
        'predictions': predictions.tolist(),
        'metrics': metrics
    }

# Run the model
result = custom_model(df)
`;

const ModelLab = ({ mode = 'dark' }) => {
  const auth = getAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // Dataset states
  const [datasets, setDatasets] = useState([]);
  const [trainingDataset, setTrainingDataset] = useState('');
  const [targetDataset, setTargetDataset] = useState('');
  const [datasetInfo, setDatasetInfo] = useState({});
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [useSameDataset, setUseSameDataset] = useState(true);
  
  // Algorithm states
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('random_forest');
  const [algorithmParams, setAlgorithmParams] = useState({});
  const [selectedFeatures, setSelectedFeatures] = useState(['dist', 'angle_abs', 'pressure_value', 'is_setplay']);
  const [trainSize, setTrainSize] = useState(80);
  const [balanceClasses, setBalanceClasses] = useState(false);
  const [useCrossValidation, setUseCrossValidation] = useState(true);
  const [targetField, setTargetField] = useState('xP');
  
  // Training states
  const [isTraining, setIsTraining] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [trainingResult, setTrainingResult] = useState(null);
  const [modelHistory, setModelHistory] = useState([]);
  const [trainingProgress, setTrainingProgress] = useState(0);
  
  // Code editor states
  const [customCode, setCustomCode] = useState(DEFAULT_PYTHON_CODE);
  const [codeOutput, setCodeOutput] = useState('');
  const [isRunningCode, setIsRunningCode] = useState(false);
  
  // Function discovery states
  const [availableFunctions, setAvailableFunctions] = useState([]);
  const [loadingFunctions, setLoadingFunctions] = useState(false);
  const [functionDialogOpen, setFunctionDialogOpen] = useState(false);

  // Fetch datasets - uses quick endpoint first, then falls back to main endpoint
  const fetchDatasets = useCallback(async (showErrorOnFail = false) => {
    try {
      setLoadingDatasets(true);
      const user = auth.currentUser;
      if (!user) {
        setLoadingDatasets(false);
        return;
      }
      const token = await user.getIdToken();
      
      // First, try the quick endpoint (just names, much faster)
      try {
        const quickResponse = await axios.get(
          `${BASE_API_URL}/api/model-lab/datasets-quick`, 
          { 
            params: { uid: user.uid },
            timeout: 10000
          }
        );
        const datasetNames = quickResponse.data.datasets || [];
        setDatasets(datasetNames);
        
        if (datasetNames.length > 0) {
          if (!trainingDataset) setTrainingDataset(datasetNames[0]);
          if (!targetDataset) setTargetDataset(datasetNames[0]);
        }
        setLoadingDatasets(false);
        
        // Fetch detailed info in background
        fetchDatasetDetails(user.uid);
        return;
      } catch (quickError) {
        // Quick endpoint not available - this is expected if backend isn't updated
        console.log('Quick endpoint not available, using fallback');
      }
      
      // Fallback to the original endpoint with retry
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await axios.post(
            `${BASE_API_URL}/get-user-datasets`, 
            { uid: user.uid }, 
            { 
              headers: { Authorization: `Bearer ${token}` },
              timeout: attempt === 1 ? 15000 : 45000 // Longer timeout on retry
            }
          );
          const datasetList = response.data.datasets || [];
          setDatasets(datasetList);
          
          if (datasetList.length > 0) {
            if (!trainingDataset) setTrainingDataset(datasetList[0]);
            if (!targetDataset) setTargetDataset(datasetList[0]);
          }
          return; // Success - exit the function
        } catch (err) {
          lastError = err;
          if (attempt === 1) {
            console.log('First attempt failed, retrying...');
            await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds before retry
          }
        }
      }
      
      // Both attempts failed
      throw lastError;
      
    } catch (error) { 
      console.error('Error fetching datasets:', error);
      // Only show error popup if user explicitly clicked refresh
      if (showErrorOnFail) {
        Swal.fire({
          title: 'Connection Issue',
          text: 'Failed to load datasets. The server may be starting up (this can take 30+ seconds on free tier). Please wait and try again.',
          icon: 'warning',
          confirmButtonColor: '#7c3aed'
        });
      }
    } finally { 
      setLoadingDatasets(false); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, trainingDataset, targetDataset]);

  // Fetch detailed dataset info (shot counts) in the background
  const fetchDatasetDetails = useCallback(async (uid) => {
    try {
      const response = await axios.get(`${BASE_API_URL}/api/model-lab/datasets`, { 
        params: { uid },
        timeout: 60000 // 60 seconds for detailed fetch
      });
      
      const detailedDatasets = response.data.datasets || [];
      // Update datasetInfo with the detailed data
      const infoMap = {};
      detailedDatasets.forEach(ds => {
        infoMap[ds.name] = ds;
      });
      setDatasetInfo(infoMap);
    } catch (error) { 
      console.error('Error fetching dataset details:', error); 
    }
  }, []);

  // Fetch model history
  const fetchModelHistory = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const response = await axios.post(
        `${BASE_API_URL}/get-model-history`, 
        { uid: user.uid }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setModelHistory(response.data.history || []);
    } catch (error) { 
      console.error('Error fetching model history:', error); 
    }
  }, [auth]);

  // Scan modelbuilder.py for available functions
  const fetchAvailableFunctions = useCallback(async () => {
    try {
      setLoadingFunctions(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      
      const response = await axios.get(
        `${BASE_API_URL}/api/model-lab/functions`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAvailableFunctions(response.data.functions || []);
    } catch (error) { 
      console.error('Error fetching functions:', error);
      // Set some defaults if endpoint doesn't exist yet
      setAvailableFunctions([
        { name: 'engineer_features', description: 'Generate engineered features from raw shot data', params: ['df'] },
        { name: 'create_model', description: 'Create a model instance', params: ['algorithm', 'params'] },
        { name: 'load_dataset', description: 'Load dataset from Firestore', params: ['uid', 'dataset_name'] },
      ]);
    } finally {
      setLoadingFunctions(false);
    }
  }, [auth]);

  useEffect(() => { 
    fetchDatasets(); 
    fetchModelHistory(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulate training progress
  useEffect(() => {
    let interval;
    if (isTraining && trainingProgress < 95) {
      interval = setInterval(() => {
        setTrainingProgress(prev => Math.min(prev + Math.random() * 15, 95));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isTraining, trainingProgress]);

  const handleTrainModel = async () => {
    const dataset = useSameDataset ? trainingDataset : trainingDataset;
    if (!dataset) { 
      Swal.fire('No Dataset', 'Please select a dataset first.', 'warning'); 
      return; 
    }
    if (selectedFeatures.length === 0) { 
      Swal.fire('No Features', 'Please select at least one feature.', 'warning'); 
      return; 
    }
    
    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingResult(null);
    
    try {
      const user = auth.currentUser;
      const config = { 
        algorithm: selectedAlgorithm, 
        features: selectedFeatures, 
        train_size: trainSize / 100, 
        balance_classes: balanceClasses, 
        use_cross_validation: useCrossValidation, 
        algorithm_params: algorithmParams,
        use_existing_values: selectedFeatures.some(f => f.startsWith('existing_')),
      };
      
      const response = await axios.post(
        `${BASE_API_URL}/api/model-lab/run-visual`, 
        { uid: user.uid, config, dataset_name: dataset }
      );
      
      setTrainingProgress(100);
      
      if (response.data.success) {
        setTrainingResult(response.data);
        Swal.fire({ 
          title: '✨ Training Complete!', 
          html: `
            <p><strong>F1 Score:</strong> ${((response.data.metrics?.f1_score || 0) * 100).toFixed(1)}%</p>
            <p><strong>AUC-ROC:</strong> ${((response.data.metrics?.auc_roc || 0) * 100).toFixed(1)}%</p>
            <p><strong>Time:</strong> ${response.data.execution_time}s</p>
          `, 
          icon: 'success', 
          confirmButtonColor: '#7c3aed' 
        });
      } else {
        throw new Error(response.data.error || 'Training failed');
      }
    } catch (error) { 
      Swal.fire('Error', error.response?.data?.error || error.message, 'error'); 
    } finally { 
      setIsTraining(false);
      setTrainingProgress(0);
    }
  };

  const handleApplyModel = async () => {
    const sourceDataset = trainingDataset;
    const destDataset = useSameDataset ? trainingDataset : targetDataset;
    
    if (!sourceDataset || selectedFeatures.length === 0) { 
      Swal.fire('Invalid Configuration', 'Please select a dataset and features.', 'warning'); 
      return; 
    }
    
    const result = await Swal.fire({ 
      title: `Apply Model to ${targetField}?`, 
      html: `
        <p>Training on: <strong>${sourceDataset}</strong></p>
        <p>Applying to: <strong>${destDataset}</strong></p>
        <p>This will <strong>permanently update</strong> all ${targetField} values.</p>
      `, 
      icon: 'question', 
      showCancelButton: true, 
      confirmButtonColor: '#7c3aed', 
      confirmButtonText: `Apply to ${targetField}` 
    });
    
    if (!result.isConfirmed) return;
    
    setIsApplying(true);
    setTrainingProgress(0);
    
    try {
      const user = auth.currentUser;
      const config = { 
        algorithm: selectedAlgorithm, 
        features: selectedFeatures, 
        train_size: trainSize / 100, 
        balance_classes: balanceClasses, 
        algorithm_params: algorithmParams 
      };
      
      const response = await axios.post(
        `${BASE_API_URL}/api/model-lab/apply-model`, 
        { 
          uid: user.uid, 
          config, 
          dataset_name: sourceDataset,
          target_dataset: destDataset,
          target_field: targetField 
        }
      );
      
      if (response.data.success) {
        await fetchModelHistory();
        Swal.fire({ 
          title: '🎉 Model Applied!', 
          html: `
            <p><strong>Shots Updated:</strong> ${response.data.shots_updated}</p>
            <p><strong>Games Updated:</strong> ${response.data.games_updated}</p>
            <p><strong>F1:</strong> ${((response.data.metrics?.f1_score || 0) * 100).toFixed(1)}%</p>
          `, 
          icon: 'success', 
          confirmButtonColor: '#7c3aed' 
        });
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) { 
      Swal.fire('Error', error.response?.data?.error || error.message, 'error'); 
    } finally { 
      setIsApplying(false); 
    }
  };

  const handleResetValues = async () => {
    const dataset = useSameDataset ? trainingDataset : targetDataset;
    if (!dataset) { 
      Swal.fire('No Dataset', 'Please select a dataset first.', 'warning'); 
      return; 
    }
    
    const result = await Swal.fire({ 
      title: `Reset all ${targetField} values?`, 
      text: `This will set all ${targetField} values to 0 in "${dataset}". Cannot be undone.`, 
      icon: 'warning', 
      showCancelButton: true, 
      confirmButtonColor: '#ef4444', 
      confirmButtonText: 'Reset All' 
    });
    
    if (!result.isConfirmed) return;
    
    try {
      const user = auth.currentUser;
      const response = await axios.post(
        `${BASE_API_URL}/api/model-lab/reset-values`, 
        { uid: user.uid, dataset_name: dataset, target_field: targetField }
      );
      if (response.data.success) {
        Swal.fire({ 
          title: 'Reset Complete', 
          text: `Reset ${response.data.shots_reset} shots.`, 
          icon: 'success', 
          confirmButtonColor: '#7c3aed' 
        });
      }
    } catch (error) { 
      Swal.fire('Error', error.response?.data?.error || error.message, 'error'); 
    }
  };

  const handleRunCustomCode = async () => {
    if (!trainingDataset) {
      Swal.fire('No Dataset', 'Please select a dataset first.', 'warning');
      return;
    }
    
    setIsRunningCode(true);
    setCodeOutput('Running code...\n');
    
    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      
      const response = await axios.post(
        `${BASE_API_URL}/api/model-lab/run-custom-code`,
        { 
          uid: user.uid, 
          code: customCode, 
          dataset_name: trainingDataset,
          target_field: targetField,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setCodeOutput(prev => prev + `\n✅ Success!\n\nMetrics:\n${JSON.stringify(response.data.metrics, null, 2)}\n\nShots updated: ${response.data.shots_updated || 0}`);
        if (response.data.metrics) {
          setTrainingResult({ metrics: response.data.metrics, execution_time: response.data.execution_time });
        }
      } else {
        setCodeOutput(prev => prev + `\n❌ Error: ${response.data.error}\n\n${response.data.traceback || ''}`);
      }
    } catch (error) {
      setCodeOutput(prev => prev + `\n❌ Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsRunningCode(false);
    }
  };

  const toggleFeature = (featureId) => setSelectedFeatures(prev => 
    prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]
  );
  const selectAllFeatures = () => setSelectedFeatures(
    Object.values(FEATURE_GROUPS).flatMap(g => g.features.map(f => f.id))
  );
  const clearAllFeatures = () => setSelectedFeatures([]);
  const currentAlgorithm = ALGORITHMS.find(a => a.id === selectedAlgorithm);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ 
          fontWeight: 800, 
          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent', 
          mb: 1 
        }}>
          🧪 Model Lab
        </Typography>
        <Typography variant="body1" sx={{ color: mode === 'dark' ? '#888' : '#666', maxWidth: 600, mx: 'auto' }}>
          Build, test, and deploy xP/xG models with advanced ML algorithms
        </Typography>
      </Box>

      {/* Tabs */}
      <Card sx={{ ...glassCard(mode), mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, v) => setActiveTab(v)} 
          centered
          sx={{ 
            '& .MuiTabs-indicator': { 
              background: 'linear-gradient(90deg, #7c3aed, #ec4899)', 
              height: 3, 
              borderRadius: '3px 3px 0 0' 
            } 
          }}
        >
          <Tab icon={<ScienceIcon />} label="Visual Builder" iconPosition="start" />
          <Tab icon={<CodeIcon />} label="Code Editor" iconPosition="start" />
          <Tab icon={<TrophyIcon />} label="Leaderboard" iconPosition="start" />
        </Tabs>
      </Card>

      {/* Visual Builder Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            {/* Dataset Selection */}
            <Card sx={{ ...glassCard(mode), mb: 3, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <DataIcon sx={{ color: '#7c3aed', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
                  Dataset Configuration
                </Typography>
                <IconButton size="small" onClick={() => fetchDatasets(true)} sx={{ ml: 'auto' }} disabled={loadingDatasets}>
                  {loadingDatasets ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
              </Box>

              {loadingDatasets ? (
                <DatasetSkeleton mode={mode} />
              ) : (
                <>
                  {/* Training Dataset */}
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={useSameDataset ? 6 : 5}>
                      <FormControl fullWidth>
                        <InputLabel>
                          <TrainIcon sx={{ mr: 1, fontSize: 18, verticalAlign: 'middle' }} />
                          Training Dataset
                        </InputLabel>
                        <Select 
                          value={trainingDataset} 
                          onChange={(e) => {
                            setTrainingDataset(e.target.value);
                            if (useSameDataset) setTargetDataset(e.target.value);
                          }} 
                          label="Training Dataset"
                        >
                          {datasets.map((ds) => (
                            <MenuItem key={ds} value={ds}>
                              {ds}
                              {datasetInfo[ds] && (
                                <Chip 
                                  size="small" 
                                  label={`${datasetInfo[ds].shots} shots`} 
                                  sx={{ ml: 1, height: 20 }} 
                                />
                              )}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {datasetInfo[trainingDataset] && (
                        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                          <Chip 
                            icon={<StorageIcon />} 
                            label={`${datasetInfo[trainingDataset].games} games`} 
                            size="small" 
                            sx={{ backgroundColor: '#7c3aed20', color: '#a855f7' }} 
                          />
                          <Chip 
                            icon={<AnalyticsIcon />} 
                            label={`${datasetInfo[trainingDataset].shots} shots`} 
                            size="small" 
                            sx={{ backgroundColor: '#22c55e20', color: '#22c55e' }} 
                          />
                        </Box>
                      )}
                    </Grid>

                    {/* Toggle for same/different dataset */}
                    <Grid item xs={12} md={useSameDataset ? 3 : 2}>
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={!useSameDataset} 
                            onChange={(e) => setUseSameDataset(!e.target.checked)}
                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#f59e0b' } }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TransferIcon sx={{ fontSize: 16 }} />
                            Transfer
                          </Typography>
                        }
                      />
                    </Grid>

                    {/* Target Dataset (when different) */}
                    {!useSameDataset && (
                      <Grid item xs={12} md={5}>
                        <FormControl fullWidth>
                          <InputLabel>
                            <ApplyIcon sx={{ mr: 1, fontSize: 18, verticalAlign: 'middle' }} />
                            Target Dataset
                          </InputLabel>
                          <Select 
                            value={targetDataset} 
                            onChange={(e) => setTargetDataset(e.target.value)} 
                            label="Target Dataset"
                          >
                            {datasets.map((ds) => (
                              <MenuItem key={ds} value={ds}>
                                {ds}
                                {datasetInfo[ds] && (
                                  <Chip 
                                    size="small" 
                                    label={`${datasetInfo[ds].shots} shots`} 
                                    sx={{ ml: 1, height: 20 }} 
                                  />
                                )}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}

                    {/* xP/xG Toggle */}
                    <Grid item xs={12} md={useSameDataset ? 3 : 12}>
                      <ToggleButtonGroup 
                        value={targetField} 
                        exclusive 
                        onChange={(e, v) => v && setTargetField(v)} 
                        fullWidth 
                        size="small"
                      >
                        <ToggleButton value="xP" sx={{ fontWeight: 600 }}>xP (Score)</ToggleButton>
                        <ToggleButton value="xG" sx={{ fontWeight: 600 }}>xG (Goal)</ToggleButton>
                      </ToggleButtonGroup>
                    </Grid>
                  </Grid>

                  {datasets.length === 0 && (
                    <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
                      No datasets found. Create and save some games first.
                    </Alert>
                  )}
                </>
              )}
            </Card>

            {/* Algorithm Selection */}
            <Card sx={{ ...glassCard(mode), mb: 3, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <HubIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
                  Algorithm
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {ALGORITHMS.map((algo) => (
                  <Grid item xs={6} sm={4} key={algo.id}>
                    <Paper 
                      onClick={() => { setSelectedAlgorithm(algo.id); setAlgorithmParams({}); }}
                      sx={{ 
                        p: 2, 
                        cursor: 'pointer', 
                        borderRadius: '14px', 
                        border: selectedAlgorithm === algo.id 
                          ? `2px solid ${algo.color}` 
                          : `1px solid ${mode === 'dark' ? '#333' : '#e0e0e0'}`,
                        background: selectedAlgorithm === algo.id ? `${algo.color}15` : 'transparent', 
                        transition: 'all 0.2s ease', 
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 4px 15px ${algo.color}30` } 
                      }}
                    >
                      <Typography variant="h5" sx={{ mb: 0.5 }}>{algo.icon}</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: mode === 'dark' ? '#fff' : '#333' }}>
                        {algo.name}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              {currentAlgorithm && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" sx={{ color: mode === 'dark' ? '#888' : '#666', mb: 2 }}>
                    {currentAlgorithm.description}
                  </Typography>
                  {currentAlgorithm.params?.map((param) => (
                    <Box key={param.id} sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: mode === 'dark' ? '#aaa' : '#555', fontWeight: 500 }}>
                        {param.name}: {algorithmParams[param.id] ?? param.default}
                      </Typography>
                      <Slider 
                        value={algorithmParams[param.id] ?? param.default} 
                        onChange={(e, v) => setAlgorithmParams(prev => ({ ...prev, [param.id]: v }))} 
                        min={param.min} 
                        max={param.max} 
                        step={param.step} 
                        sx={{ color: currentAlgorithm.color }} 
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Card>

            {/* Feature Selection */}
            <Card sx={{ ...glassCard(mode), mb: 3, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TuneIcon sx={{ color: '#22c55e', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
                  Features
                </Typography>
                <Chip 
                  label={`${selectedFeatures.length} selected`} 
                  size="small" 
                  sx={{ ml: 'auto', backgroundColor: '#22c55e20', color: '#22c55e', fontWeight: 600 }} 
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button size="small" onClick={selectAllFeatures}>Select All</Button>
                <Button size="small" onClick={clearAllFeatures}>Clear All</Button>
              </Box>
              {Object.entries(FEATURE_GROUPS).map(([key, group]) => (
                <Box key={key} sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: group.color, fontWeight: 600, mb: 1, display: 'block' }}>
                    {group.icon} {group.name}
                    {key === 'existing' && (
                      <Tooltip title="Use existing xP/xG values from another model as input features">
                        <InfoIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', opacity: 0.7 }} />
                      </Tooltip>
                    )}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {group.features.map((feature) => (
                      <Chip 
                        key={feature.id} 
                        label={feature.name} 
                        size="small" 
                        onClick={() => toggleFeature(feature.id)}
                        sx={{ 
                          m: '2px', 
                          borderRadius: '10px', 
                          fontWeight: 500, 
                          transition: 'all 0.2s ease',
                          background: selectedFeatures.includes(feature.id) 
                            ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' 
                            : 'transparent',
                          color: selectedFeatures.includes(feature.id) 
                            ? '#fff' 
                            : (mode === 'dark' ? '#a0a0a0' : '#666'),
                          border: selectedFeatures.includes(feature.id) 
                            ? 'none' 
                            : `1px solid ${mode === 'dark' ? '#444' : '#ddd'}`,
                          '&:hover': { transform: 'scale(1.05)' } 
                        }} 
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Card>

            {/* Training Settings */}
            <Card sx={{ ...glassCard(mode), mb: 3, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <ScienceIcon sx={{ color: '#ec4899', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
                  Training Settings
                </Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" sx={{ color: mode === 'dark' ? '#888' : '#666' }}>
                    Train/Test: {trainSize}% / {100 - trainSize}%
                  </Typography>
                  <Slider 
                    value={trainSize} 
                    onChange={(e, v) => setTrainSize(v)} 
                    min={50} 
                    max={90} 
                    step={5} 
                    sx={{ color: '#ec4899' }} 
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <FormControlLabel 
                    control={
                      <Switch 
                        checked={balanceClasses} 
                        onChange={(e) => setBalanceClasses(e.target.checked)} 
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#ec4899' } }} 
                      />
                    } 
                    label={<Typography variant="body2">Balance Classes (SMOTE)</Typography>} 
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <FormControlLabel 
                    control={
                      <Switch 
                        checked={useCrossValidation} 
                        onChange={(e) => setUseCrossValidation(e.target.checked)} 
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#ec4899' } }} 
                      />
                    } 
                    label={<Typography variant="body2">Cross-Validation</Typography>} 
                  />
                </Grid>
              </Grid>
            </Card>

            {/* Training Progress */}
            {(isTraining || isApplying) && (
              <Card sx={{ ...glassCard(mode), mb: 3, p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <CircularProgress size={24} sx={{ color: '#7c3aed' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: mode === 'dark' ? '#fff' : '#333' }}>
                    {isTraining ? 'Training Model...' : 'Applying Model...'}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={trainingProgress}
                  sx={{ 
                    height: 8, 
                    borderRadius: 4,
                    backgroundColor: mode === 'dark' ? '#333' : '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                    }
                  }}
                />
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: mode === 'dark' ? '#888' : '#666' }}>
                  {Math.round(trainingProgress)}% complete
                </Typography>
              </Card>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="contained" 
                size="large" 
                onClick={handleTrainModel} 
                disabled={isTraining || !trainingDataset || selectedFeatures.length === 0}
                startIcon={isTraining ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />} 
                sx={gradientButton}
              >
                {isTraining ? 'Training...' : 'Train Model (Test)'}
              </Button>
              <Button 
                variant="contained" 
                size="large" 
                onClick={handleApplyModel} 
                disabled={isApplying || !trainingDataset || selectedFeatures.length === 0}
                startIcon={isApplying ? <CircularProgress size={20} color="inherit" /> : <ApplyIcon />}
                sx={{ 
                  ...gradientButton, 
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)' 
                }}
              >
                {isApplying ? 'Applying...' : `Apply to ${targetField}`}
              </Button>
              <Button 
                variant="outlined" 
                size="large" 
                onClick={handleResetValues} 
                startIcon={<ResetIcon />}
                sx={{ 
                  borderColor: '#ef4444', 
                  color: '#ef4444', 
                  borderRadius: '14px', 
                  '&:hover': { backgroundColor: '#ef444415', borderColor: '#ef4444' } 
                }}
              >
                Reset {targetField}
              </Button>
            </Box>
          </Grid>

          {/* Results Column */}
          <Grid item xs={12} lg={5}>
            {trainingResult && (
              <Grow in={true}>
                <Card sx={{ ...glassCard(mode), mb: 3, p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <AutoGraphIcon sx={{ color: '#22c55e', fontSize: 28 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
                      Training Results
                    </Typography>
                    <Chip 
                      icon={<CheckIcon />} 
                      label={`${trainingResult.execution_time}s`} 
                      size="small" 
                      sx={{ ml: 'auto', backgroundColor: '#22c55e20', color: '#22c55e' }} 
                    />
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <MetricCard 
                        label="F1 Score" 
                        value={trainingResult.metrics?.f1_score} 
                        icon={<TrendingUpIcon sx={{ color: '#7c3aed', fontSize: 20 }} />} 
                        color="#7c3aed" 
                        mode={mode} 
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <MetricCard 
                        label="AUC-ROC" 
                        value={trainingResult.metrics?.auc_roc} 
                        icon={<AnalyticsIcon sx={{ color: '#f59e0b', fontSize: 20 }} />} 
                        color="#f59e0b" 
                        mode={mode} 
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <MetricCard 
                        label="Accuracy" 
                        value={trainingResult.metrics?.accuracy} 
                        icon={<CheckIcon sx={{ color: '#22c55e', fontSize: 20 }} />} 
                        color="#22c55e" 
                        mode={mode} 
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <MetricCard 
                        label="Precision" 
                        value={trainingResult.metrics?.precision} 
                        icon={<SpeedIcon sx={{ color: '#06b6d4', fontSize: 20 }} />} 
                        color="#06b6d4" 
                        mode={mode} 
                      />
                    </Grid>
                  </Grid>
                </Card>
              </Grow>
            )}

            {/* Quick Stats */}
            <Card sx={{ ...glassCard(mode), mb: 3, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <InfoIcon sx={{ color: '#06b6d4', fontSize: 24 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: mode === 'dark' ? '#fff' : '#333' }}>
                  Configuration Summary
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label={`Algorithm: ${currentAlgorithm?.name || 'None'}`} size="small" variant="outlined" />
                <Chip label={`Features: ${selectedFeatures.length}`} size="small" variant="outlined" />
                <Chip label={`Train: ${trainSize}%`} size="small" variant="outlined" />
                <Chip label={`Target: ${targetField}`} size="small" variant="outlined" />
                {!useSameDataset && <Chip label="Transfer Learning" size="small" color="warning" />}
                {balanceClasses && <Chip label="SMOTE" size="small" color="secondary" />}
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Code Editor Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card sx={{ ...glassCard(mode), p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <TerminalIcon sx={{ color: '#22c55e', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
                  Python Code Editor
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  <Tooltip title="View Available Functions">
                    <IconButton 
                      size="small" 
                      onClick={() => { setFunctionDialogOpen(true); fetchAvailableFunctions(); }}
                    >
                      <FunctionsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset to Default">
                    <IconButton size="small" onClick={() => setCustomCode(DEFAULT_PYTHON_CODE)}>
                      <ResetIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
                Write custom Python code to create your own xP/xG model. Your code has access to the <code>df</code> DataFrame with all shot data.
              </Alert>

              <TextField
                multiline
                fullWidth
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                sx={{
                  '& .MuiInputBase-root': {
                    fontFamily: '"Fira Code", "Monaco", "Consolas", monospace',
                    fontSize: '13px',
                    backgroundColor: mode === 'dark' ? '#0d0d12' : '#f8f9fc',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: mode === 'dark' ? '#333' : '#ddd',
                    borderRadius: '12px',
                  },
                }}
                minRows={20}
                maxRows={40}
              />

              <Box sx={{ mt: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Dataset</InputLabel>
                  <Select 
                    value={trainingDataset} 
                    onChange={(e) => setTrainingDataset(e.target.value)} 
                    label="Dataset"
                    disabled={loadingDatasets}
                  >
                    {datasets.map((ds) => <MenuItem key={ds} value={ds}>{ds}</MenuItem>)}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  onClick={handleRunCustomCode}
                  disabled={isRunningCode || !trainingDataset}
                  startIcon={isRunningCode ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
                  sx={gradientButton}
                >
                  {isRunningCode ? 'Running...' : 'Run Code'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<ApplyIcon />}
                  disabled={isRunningCode || !trainingDataset}
                  sx={{ borderRadius: '14px' }}
                >
                  Run & Apply
                </Button>
              </Box>
            </Card>

            {/* Code Output */}
            {codeOutput && (
              <Card sx={{ ...glassCard(mode), mt: 3, p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <TerminalIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: mode === 'dark' ? '#fff' : '#333' }}>
                    Output
                  </Typography>
                  <IconButton size="small" sx={{ ml: 'auto' }} onClick={() => navigator.clipboard.writeText(codeOutput)}>
                    <CopyIcon />
                  </IconButton>
                </Box>
                <Box
                  component="pre"
                  sx={{
                    fontFamily: '"Fira Code", monospace',
                    fontSize: '12px',
                    backgroundColor: mode === 'dark' ? '#0d0d12' : '#1a1a24',
                    color: '#22c55e',
                    p: 2,
                    borderRadius: '12px',
                    overflow: 'auto',
                    maxHeight: 300,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {codeOutput}
                </Box>
              </Card>
            )}
          </Grid>

          <Grid item xs={12} lg={4}>
            {/* Available Features Reference */}
            <Card sx={{ ...glassCard(mode), p: 3, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: mode === 'dark' ? '#fff' : '#333' }}>
                📚 Available DataFrame Columns
              </Typography>
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {[
                  { name: 'x, y', desc: 'Shot coordinates' },
                  { name: 'dist', desc: 'Distance to goal' },
                  { name: 'angle_abs', desc: 'Absolute angle' },
                  { name: 'pressure_value', desc: 'Defensive pressure (0-1)' },
                  { name: 'position_value', desc: 'Player position encoded' },
                  { name: 'is_setplay', desc: 'Set play flag' },
                  { name: 'is_penalty', desc: 'Penalty flag' },
                  { name: 'is_goal', desc: 'Goal scored (target for xG)' },
                  { name: 'scored', desc: 'Point or goal (target for xP)' },
                  { name: 'xP, xG', desc: 'Existing model values' },
                ].map((item, i) => (
                  <Box key={i} sx={{ py: 1, borderBottom: `1px solid ${mode === 'dark' ? '#333' : '#eee'}` }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#7c3aed' }}>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: mode === 'dark' ? '#888' : '#666' }}>
                      {item.desc}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Card>

            {/* Code Templates */}
            <Card sx={{ ...glassCard(mode), p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: mode === 'dark' ? '#fff' : '#333' }}>
                📝 Code Templates
              </Typography>
              {[
                { name: 'Basic Random Forest', desc: 'Simple RF model with default features' },
                { name: 'Neural Network', desc: 'MLP with feature scaling' },
                { name: 'Ensemble Model', desc: 'Combine multiple algorithms' },
                { name: 'Feature Engineering', desc: 'Custom feature creation' },
              ].map((template, i) => (
                <Button
                  key={i}
                  fullWidth
                  variant="outlined"
                  sx={{ 
                    justifyContent: 'flex-start', 
                    mb: 1, 
                    borderRadius: '10px',
                    textAlign: 'left',
                  }}
                  onClick={() => {
                    Swal.fire('Coming Soon', 'Code templates will be available in a future update.', 'info');
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{template.name}</Typography>
                    <Typography variant="caption" sx={{ color: mode === 'dark' ? '#888' : '#666' }}>
                      {template.desc}
                    </Typography>
                  </Box>
                </Button>
              ))}
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 2 && (
        <Card sx={{ ...glassCard(mode), p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <TrophyIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: mode === 'dark' ? '#fff' : '#333' }}>
              Model Leaderboard
            </Typography>
            <IconButton size="small" onClick={fetchModelHistory} sx={{ ml: 'auto' }}>
              <RefreshIcon />
            </IconButton>
          </Box>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a35' : '#f5f5f5' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a35' : '#f5f5f5' }}>Model</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a35' : '#f5f5f5' }}>Dataset</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a35' : '#f5f5f5' }} align="right">F1</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a35' : '#f5f5f5' }} align="right">AUC</TableCell>
                  <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#2a2a35' : '#f5f5f5' }} align="right">Accuracy</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modelHistory
                  .sort((a, b) => (b.metrics?.f1_score || 0) - (a.metrics?.f1_score || 0))
                  .slice(0, 20)
                  .map((run, index) => (
                    <TableRow key={run.id} hover>
                      <TableCell>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={run.model_type?.replace('_', ' ') || 'Unknown'} 
                          size="small" 
                          sx={{ 
                            backgroundColor: `${ALGORITHMS.find(a => a.id === run.model_type)?.color || '#666'}20`, 
                            color: ALGORITHMS.find(a => a.id === run.model_type)?.color || '#666', 
                            fontWeight: 500 
                          }} 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: mode === 'dark' ? '#aaa' : '#666' }}>
                          {run.target_dataset || run.dataset_name || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {((run.metrics?.f1_score || 0) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {((run.metrics?.auc_roc || 0) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {((run.metrics?.accuracy || 0) * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          {modelHistory.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <MemoryIcon sx={{ fontSize: 64, color: mode === 'dark' ? '#444' : '#ccc', mb: 2 }} />
              <Typography variant="h6" sx={{ color: mode === 'dark' ? '#666' : '#999', mb: 1 }}>
                No models trained yet
              </Typography>
              <Typography variant="body2" sx={{ color: mode === 'dark' ? '#555' : '#aaa' }}>
                Train your first model to see it on the leaderboard!
              </Typography>
            </Box>
          )}
        </Card>
      )}

      {/* Functions Dialog */}
      <Dialog 
        open={functionDialogOpen} 
        onClose={() => setFunctionDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FunctionsIcon sx={{ color: '#7c3aed' }} />
          Available Functions from modelbuilder.py
        </DialogTitle>
        <DialogContent>
          {loadingFunctions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {availableFunctions.map((func, index) => (
                <React.Fragment key={func.name}>
                  <ListItem>
                    <ListItemIcon>
                      <CodeIcon sx={{ color: '#7c3aed' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {func.name}({func.params?.join(', ') || ''})
                        </Typography>
                      }
                      secondary={func.description}
                    />
                    <Button 
                      size="small" 
                      onClick={() => {
                        const snippet = `# ${func.description}\nresult = ${func.name}(${func.params?.join(', ') || ''})`;
                        setCustomCode(prev => prev + '\n\n' + snippet);
                        setFunctionDialogOpen(false);
                        setActiveTab(1);
                      }}
                    >
                      Insert
                    </Button>
                  </ListItem>
                  {index < availableFunctions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => fetchAvailableFunctions()}>Refresh</Button>
          <Button onClick={() => setFunctionDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </Box>
  );
};

export default ModelLab;