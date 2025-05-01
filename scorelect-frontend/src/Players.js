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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Edit, Delete, Add, Email, Search, Clear } from '@mui/icons-material';
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
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

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
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return re.test(String(email).toLowerCase());
  };

  /**
   * Validate Phone Number Format
   */
  const validatePhone = (phone) => {
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
      Swal.fire({
        title: 'Error',
        text: 'All fields are required.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
      return;
    }

    if (!validateEmail(email)) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a valid email address.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
      return;
    }

    if (!validatePhone(phone)) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a valid phone number.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
      return;
    }

    // Check for duplicate jersey number
    const duplicate = players.find(
      (player) => player.number === parseInt(number)
    );
    if (duplicate) {
      Swal.fire({
        title: 'Error',
        text: 'Jersey number must be unique.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
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
      Swal.fire({
        title: 'Error',
        text: 'All fields are required.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
      return;
    }

    if (!validateEmail(email)) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a valid email address.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
      return;
    }

    if (!validatePhone(phone)) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a valid phone number.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
      return;
    }

    // Check for duplicate jersey number excluding the current player
    const duplicate = players.find(
      (player) =>
        player.number === parseInt(number) && player.id !== id
    );
    if (duplicate) {
      Swal.fire({
        title: 'Error',
        text: 'Jersey number must be unique.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
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
      background: '#251943',
      color: '#E6E6FA',
      confirmButtonColor: '#FF5555',
      cancelButtonColor: '#1A1232',
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
   * Handle Checkbox Change for Multiple Selection
   */
  const handleCheckboxChange = (id) => {
    if (selectedPlayers.includes(id)) {
      setSelectedPlayers(selectedPlayers.filter(playerId => playerId !== id));
    } else {
      setSelectedPlayers([...selectedPlayers, id]);
    }
  };

  /**
   * Handle Select All Checkboxes
   */
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers(displayedPlayers.map(player => player.id));
    }
    setSelectAll(!selectAll);
  };

  /**
   * Send Email to Selected Players
   */
  const handleSendEmail = () => {
    if (selectedPlayers.length === 0) {
      Swal.fire({
        title: 'No Players Selected',
        text: 'Please select at least one player to send an email.',
        icon: 'warning',
        confirmButtonText: 'OK',
        background: '#251943',
        color: '#E6E6FA',
        confirmButtonColor: '#733FAA',
      });
      return;
    }

    // Get emails of selected players
    const selectedEmails = players
      .filter(player => selectedPlayers.includes(player.id))
      .map(player => player.email);

    // Create mailto link with all emails
    const mailtoLink = `mailto:${selectedEmails.join(',')}?subject=Team Schedule Update&body=Here is the updated team schedule for the upcoming period.`;
    
    // Open email client
    window.location.href = mailtoLink;
  };

  /**
   * Clear Search and Filters
   */
  const handleClearSearch = () => {
    setSearchTerm('');
    setFilterPosition('');
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
      <Typography variant="h4" gutterBottom className="page-title">
        Team Roster
      </Typography>

      {/* Search and Filter Section */}
      <Box className="search-filter-section">
        <div className="search-container">
          <TextField
            label="Search by Name"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search className="search-icon" />,
              endAdornment: searchTerm && (
                <IconButton size="small" onClick={handleClearSearch}>
                  <Clear />
                </IconButton>
              ),
            }}
            className="search-field"
          />
        </div>
        
        <FormControl variant="outlined" className="position-filter">
          <InputLabel id="filter-position-label">Filter by Position</InputLabel>
          <Select
            labelId="filter-position-label"
            label="Filter by Position"
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
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
        
        <div className="action-buttons-container">
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog('add')}
            className="add-button"
          >
            Add Player
          </Button>
          
          <Button
            variant="contained"
            startIcon={<Email />}
            onClick={handleSendEmail}
            className="email-button"
            disabled={selectedPlayers.length === 0}
          >
            Email Selected
          </Button>
        </div>
      </Box>

      {/* Players Table */}
      <TableContainer component={Paper} className="players-table-container">
        <Table aria-label="players table" className="players-table">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="player-checkbox"
                />
              </TableCell>
              <TableCell align="center">Jersey Number</TableCell>
              <TableCell align="center">Name</TableCell>
              <TableCell align="center">Position</TableCell>
              <TableCell align="center">Injury Status</TableCell>
              <TableCell align="center">Email</TableCell>
              <TableCell align="center">Phone Number</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedPlayers.length > 0 ? (
              displayedPlayers.map((player) => (
                <TableRow key={player.id} className={selectedPlayers.includes(player.id) ? 'selected-row' : ''}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedPlayers.includes(player.id)}
                      onChange={() => handleCheckboxChange(player.id)}
                      className="player-checkbox"
                    />
                  </TableCell>
                  <TableCell align="center" className="jersey-number">
                    {player.number}
                  </TableCell>
                  <TableCell align="center">{player.name}</TableCell>
                  <TableCell align="center">{player.position}</TableCell>
                  <TableCell align="center">
                    <span className={`status-badge status-${player.injuryStatus.toLowerCase()}`}>
                      {player.injuryStatus}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <a href={`mailto:${player.email}`} className="player-email">
                      {player.email}
                    </a>
                  </TableCell>
                  <TableCell align="center">
                    <a href={`tel:${player.phone}`} className="player-phone">
                      {player.phone}
                    </a>
                  </TableCell>
                  <TableCell align="center">
                    <div className="table-actions">
                      <IconButton
                        onClick={() => handleOpenDialog('edit', player)}
                        aria-label={`edit ${player.name}`}
                        className="edit-button"
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDeletePlayer(player.id)}
                        aria-label={`delete ${player.name}`}
                        className="delete-button"
                      >
                        <Delete />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell align="center" colSpan={8} className="no-players">
                  No players found. Add a player to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Player Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        fullWidth 
        maxWidth="sm"
        className="player-dialog"
      >
        <DialogTitle className="dialog-title">
          {dialogMode === 'add' ? 'Add New Player' : 'Edit Player'}
        </DialogTitle>
        <DialogContent className="dialog-content">
          <Box className="dialog-form">
            <TextField
              label="Name"
              variant="outlined"
              value={currentPlayer.name}
              onChange={(e) => setCurrentPlayer({ ...currentPlayer, name: e.target.value })}
              required
              fullWidth
              className="form-field"
            />
            
            <FormControl variant="outlined" required fullWidth className="form-field">
              <InputLabel id="position-label">Position</InputLabel>
              <Select
                labelId="position-label"
                label="Position"
                value={currentPlayer.position}
                onChange={(e) => setCurrentPlayer({ ...currentPlayer, position: e.target.value })}
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
              fullWidth
              inputProps={{ min: 0 }}
              className="form-field"
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
              fullWidth
              className="form-field"
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
              fullWidth
              className="form-field"
            />
            
            <FormControl variant="outlined" required fullWidth className="form-field">
              <InputLabel id="injury-status-label">Injury Status</InputLabel>
              <Select
                labelId="injury-status-label"
                label="Injury Status"
                value={currentPlayer.injuryStatus}
                onChange={(e) =>
                  setCurrentPlayer({ ...currentPlayer, injuryStatus: e.target.value })
                }
              >
                <MenuItem value="Healthy">Healthy</MenuItem>
                <MenuItem value="Injured">Injured</MenuItem>
                <MenuItem value="Suspended">Suspended</MenuItem>
                <MenuItem value="Unknown">Unknown</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button onClick={handleCloseDialog} className="cancel-button">
            Cancel
          </Button>
          <Button
            onClick={dialogMode === 'add' ? handleAddPlayer : handleEditPlayer}
            variant="contained"
            className="save-button"
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
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
          className={`snackbar-alert snackbar-${snackbar.severity}`}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Players;