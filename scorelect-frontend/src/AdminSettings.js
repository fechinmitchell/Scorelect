import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Added for navigation
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Button,
  IconButton,
  CssBaseline,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import Swal from 'sweetalert2';

// List the pages (or features) to control
const pages = [
  { id: 'analysis', name: 'Analysis Page' },
  { id: 'training', name: 'Training Page' },
  { id: 'savedGames', name: 'Saved Games' },
];

// Define slider marks
const marks = [
  { value: 0, label: 'All Users' },
  { value: 1, label: 'Free Users' },
  { value: 2, label: 'Premium Users' },
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
            boxShadow: mode === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
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
  const [permissions, setPermissions] = useState({});
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'dark'); // Default to dark
  const navigate = useNavigate();

  // Fetch current settings from Firestore on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      const settingsRef = doc(firestore, 'adminSettings', 'config');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        setPermissions(settingsSnap.data().permissions || {});
      } else {
        // Initialize default permissions (0 = All Users)
        const defaultPermissions = {};
        pages.forEach((page) => (defaultPermissions[page.id] = 0));
        setPermissions(defaultPermissions);
      }
    };
    fetchPermissions();
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

  const handleSliderChange = (pageId) => (event, value) => {
    setPermissions((prev) => ({ ...prev, [pageId]: value }));
  };

  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(firestore, 'adminSettings', 'config'), { permissions }, { merge: true });
      Swal.fire('Success', 'Settings updated successfully.', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

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
          background: mode === 'dark'
            ? 'linear-gradient(135deg, #1c1a1a, #333)' // Dark gradient
            : 'linear-gradient(135deg, #f5f5f5, #e0e0e0)', // Light gradient
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

        <Card sx={{ maxWidth: 600, width: '100%', p: 2 }}>
          <CardContent>
            <Typography
              variant="h4"
              align="center"
              gutterBottom
              sx={{
                fontWeight: 'bold',
                color: mode === 'dark' ? '#fff' : '#1a237e', // White in dark, blue in light
              }}
            >
              Admin Settings
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              gutterBottom
              sx={{ mb: 3 }}
            >
              Adjust access levels for each feature. Use the sliders to control who can access:
              <br />0 = All Users, 1 = Free Users, 2 = Premium Users
            </Typography>
            {pages.map((page) => (
              <Box key={page.id} sx={{ my: 3, px: 2 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ color: mode === 'dark' ? '#fff' : '#333', mb: 1 }}
                >
                  {page.name}
                </Typography>
                <Slider
                  value={permissions[page.id] ?? 0}
                  onChange={handleSliderChange(page.id)}
                  step={1}
                  marks={marks}
                  min={0}
                  max={2}
                  valueLabelDisplay="auto"
                  sx={{ maxWidth: 400, mx: 'auto', display: 'block' }}
                />
              </Box>
            ))}
            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Button
                variant="contained"
                onClick={handleSaveSettings}
                sx={{
                  backgroundColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple in dark, blue in light
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: mode === 'dark' ? '#9c27b0' : '#141b66', // Lighter purple in dark
                  },
                  padding: '12px 24px',
                }}
              >
                Save Settings
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  );
};

export default AdminSettings;