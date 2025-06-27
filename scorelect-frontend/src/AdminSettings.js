import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Button,
  IconButton,
  CssBaseline,
  Divider,
  Tabs,
  Tab,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tooltip,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { 
  Brightness4, 
  Brightness7, 
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  RestartAlt as ResetIcon,
  Science as ScienceIcon,
  Tune as TuneIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import axios from 'axios';

// Backend root URL
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// List the pages (or features) to control
const features = [
  { id: 'analysis', name: 'Analysis Page' },
  { id: 'training', name: 'Training Page' },
  { id: 'savedGames', name: 'Saved Games' },
  { id: 'aiAnalysis', name: 'AI Analysis' },
];

// Dataset-specific permissions
const datasetPermissions = [
  { id: 'datasetPublishing', name: 'Dataset Publishing' },
  { id: 'datasetViewing', name: 'Dataset Viewing' },
];

// Define slider marks for features
const featureMarks = [
  { value: 0, label: 'All Users' },
  { value: 1, label: 'Free Users' },
  { value: 2, label: 'Premium Users' },
];

// Define slider marks for dataset publishing
const datasetPublishingMarks = [
  { value: 0, label: 'All Users' },
  { value: 1, label: 'Free Users' },
  { value: 2, label: 'Premium Users' },
  { value: 3, label: 'Admin Only' },
];

// Theme configuration
const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: {
              default: '#1c1a1a',
              paper: '#333',
            },
            text: {
              primary: '#fff',
              secondary: '#ccc',
            },
            primary: {
              main: '#7b1fa2',
            },
            action: {
              hover: '#444',
            },
          }
        : {
            background: {
              default: '#f5f5f5',
              paper: '#fff',
            },
            text: {
              primary: '#333',
              secondary: '#666',
            },
            primary: {
              main: '#1a237e',
            },
            action: {
              hover: '#e0e0e0',
            },
          }),
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '16px',
            boxShadow:
              mode === 'dark'
                ? '0 4px 12px rgba(0, 0, 0, 0.5)'
                : '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            textTransform: 'none',
            padding: '10px 20px',
            fontWeight: 500,
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: {
            color: mode === 'dark' ? '#7b1fa2' : '#1a237e',
          },
          thumb: {
            width: 16,
            height: 16,
            backgroundColor: mode === 'dark' ? '#fff' : '#333',
          },
          markLabel: {
            color: mode === 'dark' ? '#ccc' : '#666',
          },
        },
      },
    },
  });

const AdminSettings = () => {
  const [featurePermissions, setFeaturePermissions] = useState({});
  const [datasetPerms, setDatasetPerms] = useState({});
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeTab, setActiveTab] = useState(0);
  const [adminUsers, setAdminUsers] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Model tab state
  const [userDatasets, setUserDatasets] = useState([]);
  const [sourceDataset, setSourceDataset] = useState('');
  const [targetDataset, setTargetDataset] = useState('');
  const [selectedModel, setSelectedModel] = useState('random_forest');
  const [isCalculating, setIsCalculating] = useState(false);
  const [modelResult, setModelResult] = useState(null);
  const [modelHistory, setModelHistory] = useState([]);

  // Advanced model settings
  const [trainSize, setTrainSize] = useState(80);
  const [useFeatureSelection, setUseFeatureSelection] = useState(false);
  const [useGridSearch, setUseGridSearch] = useState(false);
  const [balanceClasses, setBalanceClasses] = useState(false);
  const [addInteractionFeatures, setAddInteractionFeatures] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  const navigate = useNavigate();
  const auth = getAuth();

  // Check if current user is admin
  const checkAdminStatus = async () => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire({
        title: 'Authentication Required',
        text: 'Please sign in to access admin settings.',
        icon: 'warning',
        confirmButtonColor: '#7b1fa2',
      }).then(() => {
        navigate('/signin');
      });
      return false;
    }

    setCurrentUserEmail(user.email);

    // Get admin settings from Firestore
    const datasetRef = doc(firestore, 'adminSettings', 'datasetConfig');
    const datasetSnap = await getDoc(datasetRef);
    
    if (datasetSnap.exists()) {
      const data = datasetSnap.data();
      const adminEmails = data.adminUsers || [];
      const isUserAdmin = adminEmails.includes(user.email);
      setIsAdmin(isUserAdmin);
      
      if (!isUserAdmin) {
        Swal.fire({
          title: 'Access Denied',
          text: 'You do not have admin privileges.',
          icon: 'error',
          confirmButtonColor: '#7b1fa2',
        }).then(() => {
          navigate('/');
        });
        return false;
      }
    } else {
      // If no admin config exists, the first user becomes admin
      setIsAdmin(true);
      setAdminUsers([user.email]);
    }
    
    return true;
  };

  // Fetch current settings from Firestore on mount
  useEffect(() => {
    const initializeAdmin = async () => {
      const hasAccess = await checkAdminStatus();
      if (!hasAccess) return;

      // Feature permissions
      const featuresRef = doc(firestore, 'adminSettings', 'config');
      const featuresSnap = await getDoc(featuresRef);
      if (featuresSnap.exists()) {
        setFeaturePermissions(featuresSnap.data().permissions || {});
      } else {
        // Initialize default permissions
        const defaultPermissions = {};
        features.forEach((feature) => {
          defaultPermissions[feature.id] = feature.id === 'aiAnalysis' ? 2 : 0;
        });
        setFeaturePermissions(defaultPermissions);
      }

      // Dataset permissions
      const datasetRef = doc(firestore, 'adminSettings', 'datasetConfig');
      const datasetSnap = await getDoc(datasetRef);
      if (datasetSnap.exists()) {
        const data = datasetSnap.data();
        setDatasetPerms(data.permissions || {});
        setAdminUsers(data.adminUsers || []);
      } else {
        const defaultDatasetPerms = {
          datasetPublishing: 3,
          datasetViewing: 0,
        };
        setDatasetPerms(defaultDatasetPerms);
        
        // Set current user as first admin if no admins exist
        if (auth.currentUser?.email) {
          setAdminUsers([auth.currentUser.email]);
        }
      }

      // Fetch datasets and model history
      fetchUserDatasets();
      fetchModelHistory();
    };

    initializeAdmin();
  }, []);

  // Fetch user datasets for model tab
  const fetchUserDatasets = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const response = await axios.post(
        `${BASE_API_URL}/get-user-datasets`,
        { uid: user.uid },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const datasets = response.data.datasets || [];
      setUserDatasets(datasets);
      if (datasets.length > 0) {
        setSourceDataset(datasets[0]);
        setTargetDataset(datasets[0]);
      }
    } catch (error) {
      console.error('Error fetching datasets:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to load datasets. Please try again.',
        icon: 'error',
        confirmButtonColor: '#7b1fa2',
      });
    }
  };

  // Fetch model history for leaderboard
  const fetchModelHistory = async () => {
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
  };

  // Toggle theme and save to localStorage
  const toggleTheme = () => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    localStorage.setItem('theme', newMode);
  };

  // Apply theme changes on mode switch
  useEffect(() => {
    document.body.style.backgroundColor = mode === 'dark' ? '#1c1a1a' : '#f5f5f5';
  }, [mode]);

  const handleFeatureSliderChange = (featureId) => (event, value) => {
    setFeaturePermissions((prev) => ({ ...prev, [featureId]: value }));
  };

  const handleDatasetSliderChange = (permId) => (event, value) => {
    setDatasetPerms((prev) => ({ ...prev, [permId]: value }));
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleAddAdmin = () => {
    if (!newAdminEmail || !newAdminEmail.includes('@')) {
      Swal.fire('Error', 'Please enter a valid email address', 'error');
      return;
    }

    if (adminUsers.includes(newAdminEmail)) {
      Swal.fire('Info', 'This user is already an admin', 'info');
      return;
    }

    setAdminUsers([...adminUsers, newAdminEmail]);
    setNewAdminEmail('');
  };

  const handleRemoveAdmin = (email) => {
    // Prevent removing yourself
    if (email === currentUserEmail) {
      Swal.fire({
        title: 'Cannot Remove',
        text: 'You cannot remove yourself as admin.',
        icon: 'warning',
        confirmButtonColor: '#7b1fa2',
      });
      return;
    }

    // Ensure at least one admin remains
    if (adminUsers.length <= 1) {
      Swal.fire({
        title: 'Cannot Remove',
        text: 'At least one admin must remain.',
        icon: 'warning',
        confirmButtonColor: '#7b1fa2',
      });
      return;
    }

    setAdminUsers(adminUsers.filter((admin) => admin !== email));
  };

  const handleSaveSettings = async () => {
    try {
      // Ensure current user remains in admin list
      let finalAdminList = [...adminUsers];
      if (!finalAdminList.includes(currentUserEmail) && currentUserEmail) {
        finalAdminList.push(currentUserEmail);
      }

      await setDoc(
        doc(firestore, 'adminSettings', 'config'),
        { permissions: featurePermissions },
        { merge: true }
      );

      await setDoc(
        doc(firestore, 'adminSettings', 'datasetConfig'),
        {
          permissions: datasetPerms,
          adminUsers: finalAdminList,
        },
        { merge: true }
      );

      Swal.fire({
        title: 'Success',
        text: 'All settings updated successfully.',
        icon: 'success',
        confirmButtonColor: '#7b1fa2',
      });
    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: error.message,
        icon: 'error',
        confirmButtonColor: '#7b1fa2',
      });
    }
  };

  // Reset xP values function
  const handleResetXP = async () => {
    if (!targetDataset) {
      Swal.fire({
        title: 'Error',
        text: 'Please select a target dataset to reset',
        icon: 'error',
        confirmButtonColor: '#7b1fa2',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Reset xP Values?',
      text: `This will set all xP values to 0 in the "${targetDataset}" dataset. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d32f2f',
      cancelButtonColor: '#666',
      confirmButtonText: 'Yes, reset all xP',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      setIsCalculating(true);
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      const response = await axios.post(
        `${BASE_API_URL}/reset-xp-values`,
        {
          uid: user.uid,
          dataset_name: targetDataset,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;
      
      if (!response.data.success) throw new Error(data.error || 'Failed to reset xP values');

      Swal.fire({
        title: 'Success',
        text: `Reset xP values for ${data.shots_reset} shots in ${data.games_updated} games`,
        icon: 'success',
        confirmButtonColor: '#7b1fa2',
      });

      // Clear model result to reflect the reset
      setModelResult(null);
    } catch (error) {
      console.error('Reset error:', error);
      Swal.fire({
        title: 'Error',
        text: error.message || 'Failed to reset xP values',
        icon: 'error',
        confirmButtonColor: '#7b1fa2',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Run simple xP model
  const handleRunSimpleModel = async () => {
    if (!sourceDataset || !targetDataset) {
      Swal.fire({
        title: 'Error',
        text: 'Please select both source and target datasets',
        icon: 'error',
        confirmButtonColor: '#7b1fa2',
      });
      return;
    }

    try {
      setIsCalculating(true);
      setModelResult(null);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();
      
      // Use CMC endpoint if CMC model is selected
      const endpoint = selectedModel === 'cmc' ? '/run-cmc-model' : '/run-xp-model';
      
      const response = await axios.post(
        `${BASE_API_URL}${endpoint}`,
        {
          uid: user.uid,
          source_dataset: sourceDataset,
          target_dataset: targetDataset,
          model_type: selectedModel,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setModelResult(response.data);
      await fetchModelHistory();
      
      const modelName = selectedModel === 'cmc' ? 'CMC Model' : 'Model';
      Swal.fire({
        title: 'Success',
        text: `${modelName} completed! Updated ${response.data.shots_updated} shots with ${(response.data.metrics.accuracy * 100).toFixed(1)}% accuracy`,
        icon: 'success',
        confirmButtonColor: '#7b1fa2',
      });
    } catch (error) {
      console.error('Model run error:', error);
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.error || 'Failed to run model',
        icon: 'error',
        confirmButtonColor: '#7b1fa2',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Run advanced model
  const handleRunAdvancedModel = async () => {
    if (!sourceDataset || !targetDataset) {
      Swal.fire({
        title: 'Error',
        text: 'Please select both source and target datasets',
        icon: 'error',
        confirmButtonColor: '#7b1fa2',
      });
      return;
    }

    try {
      setIsCalculating(true);
      setModelResult(null);

      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const token = await user.getIdToken();
      
      // CMC model doesn't support advanced mode, run standard CMC instead
      if (selectedModel === 'cmc') {
        const response = await axios.post(
          `${BASE_API_URL}/run-cmc-model`,
          {
            uid: user.uid,
            source_dataset: sourceDataset,
            target_dataset: targetDataset,
            model_type: 'cmc',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        setModelResult(response.data);
        await fetchModelHistory();
        
        Swal.fire({
          title: 'Success',
          text: `CMC Model completed! Updated ${response.data.shots_updated} shots with ${(response.data.metrics.accuracy * 100).toFixed(1)}% accuracy`,
          icon: 'success',
          confirmButtonColor: '#7b1fa2',
        });
      } else {
        const response = await axios.post(
          `${BASE_API_URL}/run-advanced-xp-model`,
          {
            uid: user.uid,
            source_dataset: sourceDataset,
            target_dataset: targetDataset,
            model_type: selectedModel,
            train_size: trainSize / 100,
            use_feature_selection: useFeatureSelection,
            use_grid_search: useGridSearch,
            balance_classes: balanceClasses,
            add_interaction_features: addInteractionFeatures,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const data = response.data;
        
        setModelResult(data);
        await fetchModelHistory();
        
        Swal.fire({
          title: 'Success',
          text: `Advanced model completed! Updated ${data.shots_updated} shots with ${(data.metrics.accuracy * 100).toFixed(1)}% accuracy`,
          icon: 'success',
          confirmButtonColor: '#7b1fa2',
        });
      }
    } catch (error) {
      console.error('Model run error:', error);
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.error || 'Failed to run model',
        icon: 'error',
        confirmButtonColor: '#7b1fa2',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const getMetricColor = (value) => {
    if (value >= 0.8) return '#4caf50';
    if (value >= 0.7) return '#ff9800';
    return '#f44336';
  };

  // Show loading if checking admin status
  if (!isAdmin && currentUserEmail === '') {
    return (
      <ThemeProvider theme={getTheme(mode)}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: mode === 'dark'
              ? 'linear-gradient(135deg, #1c1a1a, #333)'
              : 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={getTheme(mode)}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          background:
            mode === 'dark'
              ? 'linear-gradient(135deg, #1c1a1a, #333)'
              : 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
          position: 'relative',
        }}
      >
        {/* Theme Toggle Button */}
        <IconButton
          onClick={toggleTheme}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: mode === 'dark' ? '#fff' : '#1a237e',
          }}
        >
          {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>

        <Card sx={{ maxWidth: 700, width: '100%', p: 2 }}>
          <CardContent>
            <Typography
              variant="h4"
              align="center"
              gutterBottom
              sx={{
                fontWeight: 'bold',
                color: mode === 'dark' ? '#fff' : '#1a237e',
              }}
            >
              Admin Settings
            </Typography>
            
            {currentUserEmail && (
              <Typography
                variant="caption"
                align="center"
                display="block"
                sx={{ mb: 2, color: 'text.secondary' }}
              >
                Logged in as: {currentUserEmail}
              </Typography>
            )}

            <Tabs value={activeTab} onChange={handleTabChange} centered sx={{ mb: 3 }}>
              <Tab label="Features" />
              <Tab label="Datasets" />
              <Tab label="Admin Users" />
              <Tab label="Model" />
            </Tabs>

            {/* Features Tab */}
            {activeTab === 0 && (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  align="center"
                  gutterBottom
                  sx={{ mb: 3 }}
                >
                  Adjust access levels for each feature. 0 = All Users, 1 = Free Users, 2 = Premium Users
                </Typography>
                {features.map((feature) => (
                  <Box key={feature.id} sx={{ my: 3, px: 2 }}>
                    <Typography variant="subtitle1" sx={{ color: mode === 'dark' ? '#fff' : '#333', mb: 1 }}>
                      {feature.name}
                    </Typography>
                    <Slider
                      value={featurePermissions[feature.id] ?? 0}
                      onChange={handleFeatureSliderChange(feature.id)}
                      step={1}
                      marks={featureMarks}
                      min={0}
                      max={2}
                      valueLabelDisplay="auto"
                      sx={{ maxWidth: 400, mx: 'auto', display: 'block' }}
                    />
                  </Box>
                ))}
              </>
            )}

            {/* Datasets Tab */}
            {activeTab === 1 && (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  align="center"
                  gutterBottom
                  sx={{ mb: 3 }}
                >
                  Control who can publish and view datasets. 0 = All Users, 1 = Free Users, 2 = Premium Users, 3 = Admin Only
                </Typography>
                {datasetPermissions.map((perm) => (
                  <Box key={perm.id} sx={{ my: 3, px: 2 }}>
                    <Typography variant="subtitle1" sx={{ color: mode === 'dark' ? '#fff' : '#333', mb: 1 }}>
                      {perm.name}
                    </Typography>
                    <Slider
                      value={datasetPerms[perm.id] ?? (perm.id === 'datasetPublishing' ? 3 : 0)}
                      onChange={handleDatasetSliderChange(perm.id)}
                      step={1}
                      marks={perm.id === 'datasetPublishing' ? datasetPublishingMarks : featureMarks}
                      min={0}
                      max={perm.id === 'datasetPublishing' ? 3 : 2}
                      valueLabelDisplay="auto"
                      sx={{ maxWidth: 400, mx: 'auto', display: 'block' }}
                    />
                  </Box>
                ))}
              </>
            )}

            {/* Admin Users Tab */}
            {activeTab === 2 && (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  align="center"
                  gutterBottom
                  sx={{ mb: 3 }}
                >
                  Manage users with admin privileges.
                </Typography>
                <Box sx={{ display: 'flex', mb: 3 }}>
                  <input
                    type="email"
                    placeholder="Enter admin email address"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px 0 0 8px',
                      border: '1px solid #ccc',
                      borderRight: 'none',
                      backgroundColor: mode === 'dark' ? '#424242' : '#fff',
                      color: mode === 'dark' ? '#fff' : '#333',
                    }}
                  />
                  <Button
                    onClick={handleAddAdmin}
                    variant="contained"
                    sx={{ borderRadius: '0 8px 8px 0', height: '42px' }}
                  >
                    Add Admin
                  </Button>
                </Box>
                <Typography variant="subtitle1" gutterBottom>
                  Current Admin Users:
                </Typography>
                {adminUsers.length === 0 ? (
                  <Typography color="text.secondary" align="center">
                    No admin users defined. Add yourself as the first admin.
                  </Typography>
                ) : (
                  <Box sx={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {adminUsers.map((email) => (
                      <Box
                        key={email}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1,
                          my: 1,
                          border: '1px solid',
                          borderColor: mode === 'dark' ? '#555' : '#e0e0e0',
                          borderRadius: '8px',
                          backgroundColor: email === currentUserEmail 
                            ? (mode === 'dark' ? '#4a4a4a' : '#f0f0f0')
                            : 'transparent',
                        }}
                      >
                        <Typography>
                          {email}
                          {email === currentUserEmail && (
                            <Chip 
                              label="You" 
                              size="small" 
                              sx={{ ml: 1 }} 
                              color="primary"
                            />
                          )}
                        </Typography>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleRemoveAdmin(email)}
                          disabled={email === currentUserEmail || adminUsers.length <= 1}
                        >
                          Remove
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}

            {/* Model Tab - Enhanced Version */}
            {activeTab === 3 && (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  align="center"
                  gutterBottom
                  sx={{ mb: 3 }}
                >
                  Run xP models on your datasets with simple or advanced configurations
                </Typography>

                {/* Dataset Selection */}
                <Box sx={{ mb: 3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Training Dataset</InputLabel>
                        <Select
                          value={sourceDataset}
                          onChange={(e) => setSourceDataset(e.target.value)}
                          label="Training Dataset"
                          disabled={userDatasets.length === 0 || isCalculating}
                        >
                          {userDatasets.map((dataset) => (
                            <MenuItem key={dataset} value={dataset}>
                              {dataset}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Target Dataset</InputLabel>
                        <Select
                          value={targetDataset}
                          onChange={(e) => setTargetDataset(e.target.value)}
                          label="Target Dataset"
                          disabled={userDatasets.length === 0 || isCalculating}
                        >
                          {userDatasets.map((dataset) => (
                            <MenuItem key={dataset} value={dataset}>
                              {dataset}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  
                  {userDatasets.length === 0 && (
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      display="block" 
                      sx={{ mt: 1, textAlign: 'center' }}
                    >
                      No datasets found. Please create and save some games first.
                    </Typography>
                  )}
                </Box>

                {/* Reset xP Button */}
                {targetDataset && (
                  <Box sx={{ mb: 3, textAlign: 'center' }}>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<ResetIcon />}
                      onClick={handleResetXP}
                      disabled={isCalculating}
                      sx={{ borderRadius: '8px' }}
                    >
                      Reset All xP Values to 0 in Target Dataset
                    </Button>
                  </Box>
                )}

                {/* Model Type Selection */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Select Model Type
                  </Typography>
                  <RadioGroup
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    row
                  >
                    <FormControlLabel 
                      value="random_forest" 
                      control={<Radio />} 
                      label={
                        <Box>
                          <Typography variant="body2">Random Forest</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Balanced accuracy
                          </Typography>
                        </Box>
                      } 
                    />
                    <FormControlLabel 
                      value="logistic" 
                      control={<Radio />} 
                      label={
                        <Box>
                          <Typography variant="body2">Logistic</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Fast & simple
                          </Typography>
                        </Box>
                      } 
                    />
                    <FormControlLabel 
                      value="gradient_boost" 
                      control={<Radio />} 
                      label={
                        <Box>
                          <Typography variant="body2">Gradient Boost</Typography>
                          <Typography variant="caption" color="text.secondary">
                            High accuracy
                          </Typography>
                        </Box>
                      } 
                    />
                    <FormControlLabel 
                      value="knn" 
                      control={<Radio />} 
                      label={
                        <Box>
                          <Typography variant="body2">K-NN</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Similar shots
                          </Typography>
                        </Box>
                      } 
                    />
                    <FormControlLabel 
                      value="cmc" 
                      control={<Radio />} 
                      label={
                        <Box>
                          <Typography variant="body2">CMC Model</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Preferred side & placed balls
                          </Typography>
                        </Box>
                      } 
                    />
                  </RadioGroup>
                </Box>

                {/* Mode Toggle */}
                <Box sx={{ mb: 3, textAlign: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={advancedMode}
                        onChange={(e) => setAdvancedMode(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ScienceIcon sx={{ mr: 1 }} />
                        Advanced Mode
                      </Box>
                    }
                  />
                </Box>

                {/* Advanced Settings */}
                {advancedMode && (
                  <Accordion sx={{ mb: 3 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                        <TuneIcon sx={{ mr: 1 }} />
                        Advanced Model Settings
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={3}>
                        {/* Training Size Slider */}
                        <Grid item xs={12}>
                          <Typography gutterBottom>
                            Training Data Size: {trainSize}%
                            <Tooltip title="Percentage of data used for training vs testing">
                              <IconButton size="small">
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Typography>
                          <Slider
                            value={trainSize}
                            onChange={(e, value) => setTrainSize(value)}
                            min={50}
                            max={90}
                            step={5}
                            marks={[
                              { value: 50, label: '50%' },
                              { value: 70, label: '70%' },
                              { value: 80, label: '80%' },
                              { value: 90, label: '90%' },
                            ]}
                            valueLabelDisplay="auto"
                            disabled={isCalculating}
                          />
                        </Grid>

                        {/* Feature Toggles */}
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={useFeatureSelection}
                                onChange={(e) => setUseFeatureSelection(e.target.checked)}
                                disabled={isCalculating}
                              />
                            }
                            label="Automatic Feature Selection"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={useGridSearch}
                                onChange={(e) => setUseGridSearch(e.target.checked)}
                                disabled={isCalculating || !['random_forest', 'gradient_boost'].includes(selectedModel)}
                              />
                            }
                            label="Grid Search Optimization"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={balanceClasses}
                                onChange={(e) => setBalanceClasses(e.target.checked)}
                                disabled={isCalculating || selectedModel === 'knn'}
                              />
                            }
                            label="Balance Classes"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={addInteractionFeatures}
                                onChange={(e) => setAddInteractionFeatures(e.target.checked)}
                                disabled={isCalculating}
                              />
                            }
                            label="Add Interaction Features"
                          />
                        </Grid>
                      </Grid>

                      <Alert severity="info" sx={{ mt: 2 }}>
                        <Typography variant="caption">
                          <strong>Tips for better accuracy:</strong>
                          <br />• Use 70-80% training data for optimal balance
                          <br />• Enable Grid Search for automatic hyperparameter tuning (slower but more accurate)
                          <br />• Balance Classes helps when you have uneven success/fail ratios
                          <br />• Interaction Features capture relationships between variables
                        </Typography>
                      </Alert>
                    </AccordionDetails>
                  </Accordion>
                )}

                {/* Run Buttons */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={advancedMode ? 6 : 12}>
                    <Button
                      onClick={handleRunSimpleModel}
                      variant={advancedMode ? "outlined" : "contained"}
                      fullWidth
                      size="large"
                      disabled={isCalculating || userDatasets.length === 0}
                    >
                      {isCalculating && !advancedMode ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          Running Simple Model...
                        </>
                      ) : (
                        'Run Simple Model'
                      )}
                    </Button>
                  </Grid>
                  
                  {advancedMode && (
                    <Grid item xs={12} md={6}>
                      <Button
                        onClick={handleRunAdvancedModel}
                        variant="contained"
                        fullWidth
                        size="large"
                        disabled={isCalculating || userDatasets.length === 0}
                        sx={{
                          background: 'linear-gradient(45deg, #7b1fa2 30%, #9c27b0 90%)',
                        }}
                      >
                        {isCalculating ? (
                          <>
                            <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                            Running Advanced Model...
                          </>
                        ) : (
                          <>
                            <ScienceIcon sx={{ mr: 1 }} />
                            Run Advanced Model
                          </>
                        )}
                      </Button>
                    </Grid>
                  )}
                </Grid>

                {/* Current Results */}
                {modelResult && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Results: {modelResult.model_type.replace('_', ' ')}
                      {modelResult.parameters && (
                        <Chip 
                          label="Advanced" 
                          size="small" 
                          color="primary" 
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                    <Grid container spacing={2}>
                      {['accuracy', 'precision', 'recall', 'f1_score', 'auc_roc'].map((metric) => (
                        <Grid item xs={6} sm={4} md={2.4} key={metric}>
                          <Box
                            sx={{
                              p: 2,
                              border: '1px solid',
                              borderColor: mode === 'dark' ? '#555' : '#e0e0e0',
                              borderRadius: '8px',
                              textAlign: 'center',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {metric.replace('_', ' ').toUpperCase()}
                            </Typography>
                            <Typography variant="h5">
                              {(modelResult.metrics[metric] * 100).toFixed(1)}%
                            </Typography>
                            <Box
                              sx={{
                                height: 4,
                                bgcolor: getMetricColor(modelResult.metrics[metric]),
                                borderRadius: 2,
                                mt: 1,
                              }}
                            />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Updated {modelResult.shots_updated} shots in {modelResult.execution_time}s
                    </Typography>
                    
                    {/* Show advanced parameters if used */}
                    {modelResult.parameters && (
                      <Box sx={{ mt: 2, p: 1, bgcolor: mode === 'dark' ? '#424242' : '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Advanced settings used: Train size {(modelResult.parameters.train_size * 100).toFixed(0)}%
                          {modelResult.parameters.use_feature_selection && ', Feature selection'}
                          {modelResult.parameters.use_grid_search && ', Grid search'}
                          {modelResult.parameters.balance_classes && ', Balanced classes'}
                          {modelResult.parameters.add_interaction_features && ', Interaction features'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Model History Leaderboard */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    🏆 Model Leaderboard
                    <IconButton size="small" onClick={fetchModelHistory} sx={{ ml: 1 }}>
                      <RefreshIcon />
                    </IconButton>
                  </Typography>
                  <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>Model</TableCell>
                          <TableCell>Dataset</TableCell>
                          <TableCell align="right">F1 Score</TableCell>
                          <TableCell align="right">Accuracy</TableCell>
                          <TableCell align="right">Shots</TableCell>
                          <TableCell>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {modelHistory
                          .sort((a, b) => (b.metrics?.f1_score || 0) - (a.metrics?.f1_score || 0))
                          .map((run, index) => (
                            <TableRow key={run.id} hover>
                              <TableCell>
                                {index === 0 && '🥇'}
                                {index === 1 && '🥈'}
                                {index === 2 && '🥉'}
                                {index > 2 && index + 1}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={run.model_type?.replace('_', ' ')}
                                  size="small"
                                  color={run.model_type === selectedModel ? 'primary' : 'default'}
                                />
                                {run.is_advanced && (
                                  <Chip
                                    label="ADV"
                                    size="small"
                                    color="secondary"
                                    sx={{ ml: 0.5 }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>{run.target_dataset}</TableCell>
                              <TableCell align="right">
                                <strong>{((run.metrics?.f1_score || 0) * 100).toFixed(1)}%</strong>
                              </TableCell>
                              <TableCell align="right">
                                {((run.metrics?.accuracy || 0) * 100).toFixed(1)}%
                              </TableCell>
                              <TableCell align="right">{run.total_shots_updated || 0}</TableCell>
                              <TableCell>
                                {run.timestamp ? new Date(run.timestamp).toLocaleDateString() : 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {modelHistory.length === 0 && (
                    <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                      No model runs yet. Run your first model to see results!
                    </Typography>
                  )}
                </Box>

                {/* Info Box */}
                <Box
                  sx={{
                    mt: 3,
                    p: 2,
                    bgcolor: mode === 'dark' ? '#424242' : '#f5f5f5',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    ℹ️ {advancedMode ? 
                      'Advanced xP model uses additional features, parameter tuning, and sophisticated techniques for improved accuracy.' :
                      selectedModel === 'cmc' ?
                      'CMC model specializes in analyzing preferred shooting sides and placed ball situations for unique insights.' :
                      'Simple xP model predicts shot success using distance, angle, player position, pressure, and historical player performance.'}
                  </Typography>
                </Box>
              </>
            )}

            <Divider sx={{ my: 3 }} />
            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Button
                variant="contained"
                onClick={handleSaveSettings}
                sx={{
                  backgroundColor: mode === 'dark' ? '#7b1fa2' : '#1a237e',
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: mode === 'dark' ? '#9c27b0' : '#141b66',
                  },
                  padding: '12px 24px',
                }}
              >
                Save All Settings
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  );
};

export default AdminSettings;