import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import Swal from 'sweetalert2';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Typography,
  Button,
  IconButton,
  CssBaseline,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Brightness4, Brightness7 } from '@mui/icons-material';

// Theme configuration
const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: {
              default: '#1c1a1a', // Matches sidebar's dark tone
              paper: '#333', // Card background
            },
            text: {
              primary: '#fff', // White text for dark mode
              secondary: '#ccc', // Subtle gray for labels
            },
            primary: {
              main: '#7b1fa2', // Purple for dark mode buttons
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
              primary: '#333', // Dark text for light mode
              secondary: '#666', // Subtle gray for labels
            },
            primary: {
              main: '#1a237e', // Dark blue for light mode buttons
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
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px', // Rounded input fields
            },
          },
        },
      },
    },
  });

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'dark'); // Default to dark
  const navigate = useNavigate();
  const auth = getAuth();
  const adminEmail = 'fetzmitchell@gmail.com';

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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (email !== adminEmail) {
      Swal.fire('Access Denied', 'You are not authorized to access the admin panel.', 'error');
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin-settings');
    } catch (error) {
      Swal.fire('Login Failed', error.message, 'error');
    }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        Swal.fire('Success', 'Password updated successfully!', 'success');
        navigate('/admin-settings');
      }
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
          p: 2,
          position: 'relative',
          background: mode === 'dark'
            ? 'linear-gradient(135deg, #1c1a1a, #333)'
            : 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
        }}
      >
        {/* Theme Toggle Button */}
        <IconButton
          onClick={toggleTheme}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: mode === 'dark' ? '#fff' : '#1a237e', // White in dark mode, blue in light
          }}
        >
          {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>

        <Card sx={{ minWidth: 350, p: 2 }}>
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
              Admin Login
            </Typography>
            {!isFirstLogin ? (
              <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 2 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Admin Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  InputLabelProps={{ style: { color: mode === 'dark' ? '#ccc' : '#666' } }}
                  InputProps={{ style: { color: mode === 'dark' ? '#fff' : '#333' } }}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: mode === 'dark' ? '#ccc' : '#999',
                      },
                      '&:hover fieldset': {
                        borderColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple hover in dark
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple focus in dark
                      },
                    },
                  }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputLabelProps={{ style: { color: mode === 'dark' ? '#ccc' : '#666' } }}
                  InputProps={{ style: { color: mode === 'dark' ? '#fff' : '#333' } }}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: mode === 'dark' ? '#ccc' : '#999',
                      },
                      '&:hover fieldset': {
                        borderColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple hover in dark
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple focus in dark
                      },
                    },
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{
                    mt: 3,
                    mb: 2,
                    backgroundColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple in dark, blue in light
                    color: mode === 'dark' ? '#fff' : '#fff', // White text in both modes
                    '&:hover': {
                      backgroundColor: mode === 'dark' ? '#9c27b0' : '#141b66', // Lighter purple hover in dark
                    },
                  }}
                >
                  Sign In
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSetNewPassword} noValidate sx={{ mt: 2 }}>
                <Typography
                  variant="body1"
                  align="center"
                  sx={{ mb: 2, color: mode === 'dark' ? '#ccc' : '#666' }}
                >
                  Please set your new password:
                </Typography>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  InputLabelProps={{ style: { color: mode === 'dark' ? '#ccc' : '#666' } }}
                  InputProps={{ style: { color: mode === 'dark' ? '#fff' : '#333' } }}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: mode === 'dark' ? '#ccc' : '#999',
                      },
                      '&:hover fieldset': {
                        borderColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple hover in dark
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple focus in dark
                      },
                    },
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{
                    mt: 3,
                    mb: 2,
                    backgroundColor: mode === 'dark' ? '#7b1fa2' : '#1a237e', // Purple in dark, blue in light
                    color: mode === 'dark' ? '#fff' : '#fff', // White text in both modes
                    '&:hover': {
                      backgroundColor: mode === 'dark' ? '#9c27b0' : '#141b66', // Lighter purple hover in dark
                    },
                  }}
                >
                  Set New Password
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  );
};

export default AdminLogin;