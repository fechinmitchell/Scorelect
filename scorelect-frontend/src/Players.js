// src/components/Players.js

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Snackbar,
  Alert,
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import Swal from 'sweetalert2';
import './Players.css';

const Players = () => {
  /**
   * Unique User Identification
   * Ensures each user has their own player roster.
   */
  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('userId', userId);
    }
    return userId;
  };

  const userId = getUserId();

  /**
   * State Variables
   */
  const [players, setPlayers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [currentPlayer, setCurrentPlayer] = useState({
    id: '',
    name: '',
    position: '',
    number: '',
    email: '',
    phone: '',
    injuryStatus: 'Healthy',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  /**
   * Load Players from localStorage on Component Mount
   */
  useEffect(() => {
    const storedPlayers = localStorage.getItem(`players_${userId}`);
    if (storedPlayers) {
      setPlayers(JSON.parse(storedPlayers));
    } else {
      // Initialize with default players if needed
      const defaultPlayers = [
        {
          id: uuidv4(),
          name: 'Player One',
          position: 'Forward',
          number: 9,
          email: 'playerone@example.com',
          phone: '123-456-7890',
          injuryStatus: 'Healthy',
        },
        {
          id: uuidv4(),
          name: 'Player Two',
          position: 'Midfielder',
          number: 8,
          email: 'playertwo@example.com',
          phone: '098-765-4321',
          injuryStatus: 'Injured',
        },
        // Add more default players if necessary
      ];
      setPlayers(defaultPlayers);
      localStorage.setItem(`players_${userId}`, JSON.stringify(defaultPlayers));
    }
  }, [userId]);

  /**
   * Save Players to localStorage whenever the players state changes
   */
  useEffect(() => {
    localStorage.setItem(`players_${userId}`, JSON.stringify(players));
  }, [players, userId]);

  /**
   * Handle Opening the Dialog for Adding or Editing a Player
   */
  const handleOpenDialog = (mode, player = null) => {
    setDialogMode(mode);
    if (mode === 'edit' && player) {
      setCurrentPlayer({
        id: player.id,
        name: player.name,
        position: player.position,
        number: player.number,
        email: player.email,
        phone: player.phone,
        injuryStatus: player.injuryStatus,
      });
    } else {
      setCurrentPlayer({
        id: '',
        name: '',
        position: '',
        number: '',
        email: '',
        phone: '',
        injuryStatus: 'Healthy',
      });
    }
    setOpenDialog(true);
  };

  /**
   * Handle Closing the Dialog
   */
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentPlayer({
      id: '',
      name: '',
      position: '',
      number: '',
      email: '',
      phone: '',
      injuryStatus: 'Healthy',
    });
  };

  /**
   * Validate Email Format
   */
  const validateEmail = (email) => {
    // Simple email regex
    const re =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return re.test(String(email).toLowerCase());
  };

  /**
   * Validate Phone Number Format
   */
  const validatePhone = (phone) => {
    // Simple phone number regex (allows digits, spaces, dashes, parentheses)
    const re = /^[0-9\s\-()+]+$/;
    return re.test(String(phone));
  };

  /**
   * Handle Adding a New Player
   */
  const handleAddPlayer = () => {
    // Validation
    const { name, position, number, email, phone, injuryStatus } = currentPlayer;

    if (!name || !position || !number || !email || !phone) {
      Swal.fire('Error', 'All fields are required.', 'error');
      return;
    }

    if (!validateEmail(email)) {
      Swal.fire('Error', 'Please enter a valid email address.', 'error');
      return;
    }

    if (!validatePhone(phone)) {
      Swal.fire('Error', 'Please enter a valid phone number.', 'error');
      return;
    }

    // Check for duplicate jersey number
    const duplicate = players.find(
      (player) => player.number === parseInt(number)
    );
    if (duplicate) {
      Swal.fire('Error', 'Jersey number must be unique.', 'error');
      return;
    }

    const newPlayer = {
      id: uuidv4(),
      name: name.trim(),
      position: position.trim(),
      number: parseInt(number),
      email: email.trim(),
      phone: phone.trim(),
      injuryStatus,
    };

    setPlayers([...players, newPlayer]);
    setSnackbar({ open: true, message: 'Player added successfully!', severity: 'success' });
    handleCloseDialog();
  };

  /**
   * Handle Editing an Existing Player
   */
  const handleEditPlayer = () => {
    // Validation
    const { id, name, position, number, email, phone, injuryStatus } = currentPlayer;

    if (!name || !position || !number || !email || !phone) {
      Swal.fire('Error', 'All fields are required.', 'error');
      return;
    }

    if (!validateEmail(email)) {
      Swal.fire('Error', 'Please enter a valid email address.', 'error');
      return;
    }

    if (!validatePhone(phone)) {
      Swal.fire('Error', 'Please enter a valid phone number.', 'error');
      return;
    }

    // Check for duplicate jersey number excluding the current player
    const duplicate = players.find(
      (player) =>
        player.number === parseInt(number) && player.id !== id
    );
    if (duplicate) {
      Swal.fire('Error', 'Jersey number must be unique.', 'error');
      return;
    }

    const updatedPlayers = players.map((player) =>
      player.id === id
        ? {
            ...player,
            name: name.trim(),
            position: position.trim(),
            number: parseInt(number),
            email: email.trim(),
            phone: phone.trim(),
            injuryStatus,
          }
        : player
    );

    setPlayers(updatedPlayers);
    setSnackbar({ open: true, message: 'Player updated successfully!', severity: 'success' });
    handleCloseDialog();
  };

  /**
   * Handle Deleting a Player
   */
  const handleDeletePlayer = (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this player?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        const updatedPlayers = players.filter((player) => player.id !== id);
        setPlayers(updatedPlayers);
        setSnackbar({ open: true, message: 'Player deleted successfully!', severity: 'success' });
      }
    });
  };

  /**
   * Handle Snackbar Close
   */
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  /**
   * Filtered and Searched Players
   */
  const displayedPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterPosition ? player.position === filterPosition : true;
    return matchesSearch && matchesFilter;
  });

  /**
   * Available Positions for Filtering and Selection
   */
  const positions = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'];

  return (
    <Container maxWidth="lg" className="players-page">
      {/* Team Roster Heading */}
      <Typography variant="h4" gutterBottom sx={{ color: '#ffffff' }}>
        Team Roster
      </Typography>

      {/* Search and Filter Section */}
      <Box className="search-filter-section">
        <TextField
          label="Search by Name"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            backgroundColor: '#3a3a3a',
            color: '#ffffff',
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: '#555555',
              },
              '&:hover fieldset': {
                borderColor: '#4caf50',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#4caf50',
              },
            },
            '& .MuiInputLabel-root': {
              color: '#ffffff',
            },
            '& .MuiInputBase-input': {
              color: '#ffffff',
            },
          }}
        />
        <FormControl variant="outlined" sx={{ minWidth: 200, backgroundColor: '#3a3a3a' }}>
          <InputLabel id="filter-position-label" sx={{ color: '#ffffff' }}>Filter by Position</InputLabel>
          <Select
            labelId="filter-position-label"
            label="Filter by Position"
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            sx={{
              color: '#ffffff',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#555555',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#4caf50',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#4caf50',
              },
              '& .MuiSvgIcon-root': {
                color: '#ffffff',
              },
            }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {positions.map((position) => (
              <MenuItem key={position} value={position}>
                {position}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog('add')}
          sx={{
            backgroundColor: '#4caf50',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#45a049',
            },
          }}
        >
          Add Player
        </Button>
      </Box>

      {/* Players Table */}
      <TableContainer component={Paper} sx={{ backgroundColor: '#2c2c2c' }}>
        <Table aria-label="players table">
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ color: '#ffffff' }}>Jersey Number</TableCell>
              <TableCell align="center" sx={{ color: '#ffffff' }}>Name</TableCell>
              <TableCell align="center" sx={{ color: '#ffffff' }}>Position</TableCell>
              <TableCell align="center" sx={{ color: '#ffffff' }}>Injury Status</TableCell>
              <TableCell align="center" sx={{ color: '#ffffff' }}>Email</TableCell>
              <TableCell align="center" sx={{ color: '#ffffff' }}>Phone Number</TableCell>
              <TableCell align="center" sx={{ color: '#ffffff' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedPlayers.length > 0 ? (
              displayedPlayers.map((player) => (
                <TableRow key={player.id}>
                  <TableCell align="center" sx={{ color: '#ffffff' }}>{player.number}</TableCell>
                  <TableCell align="center" sx={{ color: '#ffffff' }}>{player.name}</TableCell>
                  <TableCell align="center" sx={{ color: '#ffffff' }}>{player.position}</TableCell>
                  <TableCell align="center" sx={{ color: '#ffffff' }}>{player.injuryStatus}</TableCell>
                  <TableCell align="center">
                    <a href={`mailto:${player.email}`} style={{ color: '#4caf50' }}>
                      {player.email}
                    </a>
                  </TableCell>
                  <TableCell align="center">
                    <a href={`tel:${player.phone}`} style={{ color: '#4caf50' }}>
                      {player.phone}
                    </a>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="primary"
                      onClick={() => handleOpenDialog('edit', player)}
                      aria-label={`edit ${player.name}`}
                      sx={{
                        backgroundColor: '#2196f3',
                        color: '#ffffff',
                        '&:hover': {
                          backgroundColor: '#1976d2',
                        },
                        marginRight: '8px',
                      }}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDeletePlayer(player.id)}
                      aria-label={`delete ${player.name}`}
                      sx={{
                        backgroundColor: '#f44336',
                        color: '#ffffff',
                        '&:hover': {
                          backgroundColor: '#d32f2f',
                        },
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell align="center" colSpan={7} sx={{ color: '#ffffff' }}>
                  No players found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Player Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#3a3a3a', color: '#ffffff' }}>
          {dialogMode === 'add' ? 'Add New Player' : 'Edit Player'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#2c2c2c', color: '#ffffff' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
            <TextField
              label="Name"
              variant="outlined"
              value={currentPlayer.name}
              onChange={(e) => setCurrentPlayer({ ...currentPlayer, name: e.target.value })}
              required
              sx={{
                backgroundColor: '#3a3a3a',
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#555555',
                  },
                  '&:hover fieldset': {
                    borderColor: '#4caf50',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#4caf50',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#ffffff',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
                },
              }}
            />
            <FormControl variant="outlined" required sx={{ backgroundColor: '#3a3a3a' }}>
              <InputLabel id="position-label" sx={{ color: '#ffffff' }}>Position</InputLabel>
              <Select
                labelId="position-label"
                label="Position"
                value={currentPlayer.position}
                onChange={(e) => setCurrentPlayer({ ...currentPlayer, position: e.target.value })}
                sx={{
                  color: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#555555',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4caf50',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4caf50',
                  },
                  '& .MuiSvgIcon-root': {
                    color: '#ffffff',
                  },
                }}
              >
                {positions.map((position) => (
                  <MenuItem key={position} value={position}>
                    {position}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Jersey Number"
              type="number"
              variant="outlined"
              value={currentPlayer.number}
              onChange={(e) =>
                setCurrentPlayer({ ...currentPlayer, number: e.target.value })
              }
              required
              inputProps={{ min: 0 }}
              sx={{
                backgroundColor: '#3a3a3a',
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#555555',
                  },
                  '&:hover fieldset': {
                    borderColor: '#4caf50',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#4caf50',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#ffffff',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
                },
              }}
            />
            <TextField
              label="Email"
              type="email"
              variant="outlined"
              value={currentPlayer.email}
              onChange={(e) =>
                setCurrentPlayer({ ...currentPlayer, email: e.target.value })
              }
              required
              sx={{
                backgroundColor: '#3a3a3a',
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#555555',
                  },
                  '&:hover fieldset': {
                    borderColor: '#4caf50',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#4caf50',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#ffffff',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
                },
              }}
            />
            <TextField
              label="Phone Number"
              type="tel"
              variant="outlined"
              value={currentPlayer.phone}
              onChange={(e) =>
                setCurrentPlayer({ ...currentPlayer, phone: e.target.value })
              }
              required
              sx={{
                backgroundColor: '#3a3a3a',
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: '#555555',
                  },
                  '&:hover fieldset': {
                    borderColor: '#4caf50',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#4caf50',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#ffffff',
                },
                '& .MuiInputBase-input': {
                  color: '#ffffff',
                },
              }}
            />
            <FormControl variant="outlined" required sx={{ backgroundColor: '#3a3a3a' }}>
              <InputLabel id="injury-status-label" sx={{ color: '#ffffff' }}>Injury Status</InputLabel>
              <Select
                labelId="injury-status-label"
                label="Injury Status"
                value={currentPlayer.injuryStatus}
                onChange={(e) =>
                  setCurrentPlayer({ ...currentPlayer, injuryStatus: e.target.value })
                }
                sx={{
                  color: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#555555',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4caf50',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4caf50',
                  },
                  '& .MuiSvgIcon-root': {
                    color: '#ffffff',
                  },
                }}
              >
                <MenuItem value="Healthy">Healthy</MenuItem>
                <MenuItem value="Injured">Injured</MenuItem>
                <MenuItem value="Suspended">Suspended</MenuItem>
                <MenuItem value="Unknown">Unknown</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#2c2c2c' }}>
          <Button onClick={handleCloseDialog} color="secondary" sx={{ color: '#ffffff' }}>
            Cancel
          </Button>
          <Button
            onClick={dialogMode === 'add' ? handleAddPlayer : handleEditPlayer}
            variant="contained"
            color="primary"
            sx={{
              backgroundColor: '#4caf50',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#45a049',
              },
            }}
          >
            {dialogMode === 'add' ? 'Add Player' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Players;
