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
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import Swal from 'sweetalert2';
import axios from 'axios';                                     // NEW

// NEW – backend root (works in dev & prod if you set REACT_APP_API_URL)
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// List the pages (or features) to control
const features = [
  { id: 'analysis', name: 'Analysis Page' },
  { id: 'training', name: 'Training Page' },
  { id: 'savedGames', name: 'Saved Games' },
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

// Theme configuration matching AdminLogin.js
const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: {
              default: '#1c1a1a', // Dark background
              paper: '#333', // Card background
            },
            text: {
              primary: '#fff', // White text
              secondary: '#ccc', // Subtle gray for labels
            },
            primary: {
              main: '#7b1fa2', // Purple for buttons in dark mode
            },
            action: {
              hover: '#444', // Hover effect for other elements
            },
          }
        : {
            background: {
              default: '#f5f5f5', // Light background
              paper: '#fff', // Card background
            },
            text: {
              primary: '#333', // Dark text
              secondary: '#666', // Subtle gray for labels
            },
            primary: {
              main: '#1a237e', // Dark blue for buttons in light mode
            },
            action: {
              hover: '#e0e0e0', // Hover effect for buttons
            },
          }),
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '16px', // Rounded corners
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
            borderRadius: '12px', // Rounded buttons
            textTransform: 'none', // No uppercase
            padding: '10px 20px',
            fontWeight: 500,
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: {
            color: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple in dark, blue in light
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
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'dark'); // Default to dark
  const [activeTab, setActiveTab] = useState(0);
  const [adminUsers, setAdminUsers] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // NEW: model recalculation local state
  const [datasetName, setDatasetName] = useState('GAA All Shots');
  const [isCalculating, setIsCalculating] = useState(false);
  const [modelSummary, setModelSummary] = useState(null);

  const navigate = useNavigate();

  // Fetch current settings from Firestore on mount
  useEffect(() => {
    const fetchSettings = async () => {
      // Feature permissions
      const featuresRef = doc(firestore, 'adminSettings', 'config');
      const featuresSnap = await getDoc(featuresRef);
      if (featuresSnap.exists()) {
        setFeaturePermissions(featuresSnap.data().permissions || {});
      } else {
        // Initialize default permissions (0 = All Users)
        const defaultPermissions = {};
        features.forEach((feature) => (defaultPermissions[feature.id] = 0));
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
        // Initialize default dataset permissions
        const defaultDatasetPerms = {
          datasetPublishing: 3, // Admin Only
          datasetViewing: 0, // All Users
        };
        setDatasetPerms(defaultDatasetPerms);

        // Initialize with current user as admin
        setAdminUsers([]);
      }
    };

    fetchSettings();
  }, []);

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
    setAdminUsers(adminUsers.filter((admin) => admin !== email));
  };

  const handleSaveSettings = async () => {
    try {
      // Save feature permissions
      await setDoc(
        doc(firestore, 'adminSettings', 'config'),
        { permissions: featurePermissions },
        { merge: true }
      );

      // Save dataset permissions and admin users
      await setDoc(
        doc(firestore, 'adminSettings', 'datasetConfig'),
        {
          permissions: datasetPerms,
          adminUsers: adminUsers,
        },
        { merge: true }
      );

      Swal.fire('Success', 'All settings updated successfully.', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  // NEW: Trigger backend recalculation
  const handleRecalculateModel = async () => {
    if (!datasetName) {
      Swal.fire('Error', 'Please enter a dataset name', 'error');
      return;
    }

    try {
      setIsCalculating(true);
      setModelSummary(null);

      //  use axios + BASE_API_URL so we never hit the React dev-server
      const response = await axios.post(
        `${BASE_API_URL}/recalculate-xpoints`,
        { dataset_name: datasetName }
      );

      if (response.status !== 200 || response.data.status !== 'success') {
        throw new Error(response.data.error || 'Failed to recalculate');
      }

      setModelSummary(response.data.model_summary);
      Swal.fire('Success', `Recalculation completed for ${datasetName}`, 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setIsCalculating(false);
    }
  };

  const metricsCard = (title, metrics) => (
    <Box
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: mode === 'dark' ? '#555' : '#e0e0e0',
        borderRadius: '8px',
        mb: 2,
      }}
    >
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {Object.entries(metrics).map(([key, value]) => (
        <Typography key={key} variant="body2">
          {key}: {value === null ? 'n/a' : value.toFixed(3)}
        </Typography>
      ))}
    </Box>
  );

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
                        }}
                      >
                        <Typography>{email}</Typography>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleRemoveAdmin(email)}
                        >
                          Remove
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}

            {/* Model Tab */}
            {activeTab === 3 && (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  align="center"
                  gutterBottom
                  sx={{ mb: 3 }}
                >
                  Recalculate xPoints and xGoals and evaluate model performance.
                </Typography>
                <Box sx={{ display: 'flex', mb: 3 }}>
                  <input
                    type="text"
                    placeholder="Dataset name"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px 0 0 8px',
                      border: '1px solid #ccc',
                      borderRight: 'none',
                    }}
                  />
                  <Button
                    onClick={handleRecalculateModel}
                    variant="contained"
                    sx={{ borderRadius: '0 8px 8px 0', height: '42px' }}
                    disabled={isCalculating}
                  >
                    Recalculate
                  </Button>
                </Box>

                {isCalculating && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                    <CircularProgress />
                  </Box>
                )}

                {modelSummary && (
                  <>
                    <Typography variant="h6" align="center" gutterBottom>
                      Model Metrics
                    </Typography>
                    {metricsCard('Points Model', modelSummary.points_model)}
                    {metricsCard('Goals Model', modelSummary.goals_model)}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      align="center"
                      sx={{ mt: 2 }}
                    >
                      Total Shots: {modelSummary.total_shots} | Games Processed: {modelSummary.games_processed}
                    </Typography>
                  </>
                )}
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
