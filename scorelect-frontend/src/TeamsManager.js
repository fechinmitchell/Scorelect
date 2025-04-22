// TeamsManager.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
  Tabs,
  Tab,
  Alert,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from './firebase';
import { useAuth } from './AuthContext';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import GroupsIcon from '@mui/icons-material/Groups';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SportsIcon from '@mui/icons-material/Sports';
import DownloadIcon from '@mui/icons-material/Download';

// Add these to the imports section at the top of TeamsManager.js
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// Styled components for the team manager
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  color: '#fff',
  border: '1px solid #333',
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: '#1a1a1a',
  },
  '&:nth-of-type(even)': {
    backgroundColor: '#222',
  },
  '&:hover': {
    backgroundColor: '#2a2a2a',
  },
  '& > *': {
    borderBottom: 'unset',
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  color: '#aaa',
  '&.Mui-selected': {
    color: '#5e2e8f',
    fontWeight: 'bold',
  },
}));

const ImportBox = styled(Box)(({ theme }) => ({
  border: '2px dashed #444',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(3),
  textAlign: 'center',
  backgroundColor: '#1a1a1a',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    borderColor: '#5e2e8f',
    backgroundColor: '#2a2a2a',
  },
}));

// Default GAA positions
const GAA_POSITIONS = [
  'Goalkeeper',
  'Right Corner-Back',
  'Full-Back',
  'Left Corner-Back',
  'Right Half-Back',
  'Centre-Back',
  'Left Half-Back',
  'Midfielder',
  'Midfielder',
  'Right Half-Forward',
  'Centre-Forward',
  'Left Half-Forward',
  'Right Corner-Forward',
  'Full-Forward',
  'Left Corner-Forward',
  'Substitute',
];

// Default empty player template
const EMPTY_PLAYER = {
  id: '',
  number: '',
  name: '',
  position: 'Substitute'
};

// Generate default team structure
const generateEmptyTeam = (teamName) => {
  const players = [];
  
  // Create 30 empty player slots
  for (let i = 1; i <= 30; i++) {
    // First 15 with positions, rest as substitutes
    const position = i <= 15 ? GAA_POSITIONS[i-1] : 'Substitute';
    
    players.push({
      id: `${teamName.toLowerCase().replace(/\s+/g, '-')}-player-${i}`,
      number: i,
      name: '',
      position
    });
  }
  
  return {
    name: teamName,
    players
  };
};

// Parse imported team data from text file
const parseTeamData = (text) => {
  // Split by lines
  const lines = text.trim().split(/\r?\n/);
  const players = [];
  
  // Try to detect format - expect number, name, position (optional)
  lines.forEach((line, index) => {
    // Skip empty lines
    if (!line.trim()) return;
    
    // Try different delimiters (comma, tab, pipe)
    let parts = line.split(',');
    if (parts.length === 1) parts = line.split('\t');
    if (parts.length === 1) parts = line.split('|');
    
    // If we have at least 2 parts (number and name)
    if (parts.length >= 2) {
      const number = parseInt(parts[0].trim(), 10);
      const name = parts[1].trim();
      const position = parts.length > 2 ? parts[2].trim() : 'Substitute';
      
      if (!isNaN(number) && name) {
        players.push({
          id: `imported-player-${index}`,
          number,
          name,
          position: GAA_POSITIONS.includes(position) ? position : 'Substitute'
        });
      }
    }
  });
  
  return players;
};

// Main TeamsManager component
const TeamsManager = ({ open, onClose, onSaveTeams }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [homeTeam, setHomeTeam] = useState(generateEmptyTeam('Home Team'));
  const [awayTeam, setAwayTeam] = useState(generateEmptyTeam('Away Team'));
  const [savedTeams, setSavedTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [savingTeams, setSavingTeams] = useState(false);
  const [teamConfig, setTeamConfig] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Fetch saved teams on component mount
  useEffect(() => {
    if (open && currentUser) {
      fetchSavedTeams();
    }
  }, [open, currentUser]);
  
  // Fetch teams from Firestore
  const fetchSavedTeams = async () => {
    if (!currentUser) return;
    
    setLoadingTeams(true);
    try {
      const teamsRef = collection(firestore, 'users', currentUser.uid, 'teams');
      const snapshot = await getDocs(teamsRef);
      
      const teams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSavedTeams(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      setError("Failed to load saved teams.");
    } finally {
      setLoadingTeams(false);
    }
  };
  
  // Save teams to Firestore
  const saveTeamsToFirestore = async () => {
    if (!currentUser) {
      setError("You must be logged in to save teams.");
      return;
    }
    
    if (!teamConfig.trim()) {
      setError("Please enter a name for this team configuration.");
      return;
    }
    
    setSavingTeams(true);
    try {
      const teamData = {
        name: teamConfig,
        createdAt: new Date().toISOString(),
        homeTeam,
        awayTeam
      };
      
      const docRef = doc(collection(firestore, 'users', currentUser.uid, 'teams'), teamConfig);
      await setDoc(docRef, teamData);
      
      setSavedTeams([...savedTeams, { ...teamData, id: teamConfig }]);
      setSuccess(`Team configuration "${teamConfig}" saved successfully!`);
      
      // Clear after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error("Error saving teams:", error);
      setError("Failed to save team configuration.");
    } finally {
      setSavingTeams(false);
    }
  };
  
  // Save teams to local storage
  const saveTeamsToLocalStorage = () => {
    if (!teamConfig.trim()) {
      setError("Please enter a name for this team configuration.");
      return;
    }
    
    try {
      const teamData = {
        id: `local-${Date.now()}`,
        name: teamConfig,
        createdAt: new Date().toISOString(),
        homeTeam,
        awayTeam
      };
      
      // Get existing saved teams
      const existingTeams = JSON.parse(localStorage.getItem('savedTeams') || '[]');
      existingTeams.push(teamData);
      
      // Save back to localStorage
      localStorage.setItem('savedTeams', JSON.stringify(existingTeams));
      
      // Update state
      setSavedTeams([...savedTeams, teamData]);
      setSuccess(`Team configuration "${teamConfig}" saved locally!`);
      
      // Clear after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error("Error saving teams locally:", error);
      setError("Failed to save team configuration locally.");
    }
  };
  
  // Load teams from localStorage
  const loadTeamsFromLocalStorage = useCallback(() => {
    try {
      const localTeams = JSON.parse(localStorage.getItem('savedTeams') || '[]');
      if (localTeams.length > 0) {
        setSavedTeams(prev => {
          // Merge with Firestore teams, avoiding duplicates
          const existingIds = prev.map(team => team.id);
          const newTeams = localTeams.filter(team => !existingIds.includes(team.id));
          return [...prev, ...newTeams];
        });
      }
    } catch (error) {
      console.error("Error loading local teams:", error);
    }
  }, []);
  
  // Load saved team configuration
  const loadTeamConfiguration = (team) => {
    setHomeTeam(team.homeTeam);
    setAwayTeam(team.awayTeam);
    setTeamConfig(team.name);
    setSuccess(`Loaded team configuration: ${team.name}`);
    setTimeout(() => setSuccess(''), 3000);
  };
  
  // Update player data
  const updatePlayer = (teamType, playerIndex, field, value) => {
    if (teamType === 'home') {
      const updatedPlayers = [...homeTeam.players];
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        [field]: value
      };
      setHomeTeam({
        ...homeTeam,
        players: updatedPlayers
      });
    } else {
      const updatedPlayers = [...awayTeam.players];
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        [field]: value
      };
      setAwayTeam({
        ...awayTeam,
        players: updatedPlayers
      });
    }
  };
  
  // Add new player to team
  const addPlayer = (teamType) => {
    if (teamType === 'home' && homeTeam.players.length >= 30) {
      setError("Maximum 30 players allowed per team");
      return;
    }
    
    if (teamType === 'away' && awayTeam.players.length >= 30) {
      setError("Maximum 30 players allowed per team");
      return;
    }
    
    const newPlayer = {
      ...EMPTY_PLAYER,
      id: `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number: teamType === 'home' ? homeTeam.players.length + 1 : awayTeam.players.length + 1
    };
    
    if (teamType === 'home') {
      setHomeTeam({
        ...homeTeam,
        players: [...homeTeam.players, newPlayer]
      });
    } else {
      setAwayTeam({
        ...awayTeam,
        players: [...awayTeam.players, newPlayer]
      });
    }
  };
  
  // Remove player
  const removePlayer = (teamType, playerIndex) => {
    if (teamType === 'home') {
      const updatedPlayers = [...homeTeam.players];
      updatedPlayers.splice(playerIndex, 1);
      setHomeTeam({
        ...homeTeam,
        players: updatedPlayers
      });
    } else {
      const updatedPlayers = [...awayTeam.players];
      updatedPlayers.splice(playerIndex, 1);
      setAwayTeam({
        ...awayTeam,
        players: updatedPlayers
      });
    }
  };
  
  // Handle import file change
  const handleFileImport = (teamType, event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const importedPlayers = parseTeamData(text);
        
        if (importedPlayers.length === 0) {
          setError("No valid player data found in file. Expected format: Number, Name, Position (optional)");
          return;
        }
        
        // Limit to 30 players
        const limitedPlayers = importedPlayers.slice(0, 30);
        
        if (teamType === 'home') {
          setHomeTeam({
            ...homeTeam,
            players: limitedPlayers
          });
        } else {
          setAwayTeam({
            ...awayTeam,
            players: limitedPlayers
          });
        }
        
        setSuccess(`Successfully imported ${limitedPlayers.length} players for ${teamType === 'home' ? 'home' : 'away'} team.`);
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        console.error("Error parsing file:", error);
        setError("Failed to parse file. Please check format.");
      }
    };
    
    reader.readAsText(file);
  };
  
  // Generate sample data file
  const generateSampleFile = () => {
    const sampleData = [
      "1,John Doyle,Goalkeeper",
      "2,Michael Murphy,Right Corner-Back",
      "3,Neil McGee,Full-Back",
      "4,Paddy McGrath,Left Corner-Back",
      "5,Ryan McHugh,Right Half-Back",
      "6,Karl Lacey,Centre-Back",
      "7,Frank McGlynn,Left Half-Back",
      "8,Neil Gallagher,Midfielder",
      "9,Rory Kavanagh,Midfielder",
      "10,Leo McLoone,Right Half-Forward",
      "11,Colm McFadden,Centre-Forward",
      "12,Anthony Thompson,Left Half-Forward",
      "13,Patrick McBrearty,Right Corner-Forward",
      "14,Michael Murphy,Full-Forward",
      "15,Ryan Bradley,Left Corner-Forward",
      "16,Paul Durcan,Substitute",
      "17,Declan Walsh,Substitute",
      "18,Eamon McGee,Substitute",
      "19,Mark McHugh,Substitute",
      "20,David Walsh,Substitute"
    ].join("\n");
    
    const blob = new Blob([sampleData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_team_data.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Save and close
  const handleSaveAndClose = () => {
    // Prepare team data in the format expected by the parent component
    const teams = {
      home: homeTeam,
      away: awayTeam
    };
    
    // Call the onSaveTeams prop to pass data back to parent
    onSaveTeams(teams);
    onClose();
  };
  
  // Render player table for a team
  const renderPlayerTable = (teamType, team) => (
    <TableContainer component={Paper} sx={{ backgroundColor: '#1a1a1a', mb: 2 }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextField
          label="Team Name"
          value={team.name}
          onChange={(e) => {
            if (teamType === 'home') {
              setHomeTeam({ ...homeTeam, name: e.target.value });
            } else {
              setAwayTeam({ ...awayTeam, name: e.target.value });
            }
          }}
          sx={{
            backgroundColor: '#2a2a2a',
            input: { color: '#fff' },
            label: { color: '#aaa' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#444' },
              '&:hover fieldset': { borderColor: '#666' },
              '&.Mui-focused fieldset': { borderColor: '#5e2e8f' },
            }
          }}
        />
        <Box>
          <input
            type="file"
            accept=".txt,.csv"
            id={`${teamType}-file-import`}
            style={{ display: 'none' }}
            onChange={(e) => handleFileImport(teamType, e)}
          />
          <label htmlFor={`${teamType}-file-import`}>
            <Button
              component="span"
              startIcon={<UploadFileIcon />}
              sx={{
                mr: 1,
                backgroundColor: '#2a2a2a',
                color: '#fff',
                '&:hover': { backgroundColor: '#3a3a3a' }
              }}
            >
              Import
            </Button>
          </label>
          <Button
            onClick={() => addPlayer(teamType)}
            startIcon={<AddIcon />}
            disabled={team.players.length >= 30}
            sx={{
              backgroundColor: '#5e2e8f',
              color: '#fff',
              '&:hover': { backgroundColor: '#7e4cb8' }
            }}
          >
            Add Player
          </Button>
        </Box>
      </Box>
      
      <Table size="small">
        <TableHead>
          <TableRow>
            <StyledTableCell width="10%">#</StyledTableCell>
            <StyledTableCell width="40%">Name</StyledTableCell>
            <StyledTableCell width="30%">Position</StyledTableCell>
            <StyledTableCell width="20%">Actions</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {team.players.map((player, index) => (
            <StyledTableRow key={player.id || index}>
              <StyledTableCell>
                <TextField
                  type="number"
                  value={player.number}
                  onChange={(e) => updatePlayer(teamType, index, 'number', parseInt(e.target.value, 10) || '')}
                  inputProps={{ min: 1, max: 99 }}
                  size="small"
                  sx={{
                    width: '100%',
                    backgroundColor: '#2a2a2a',
                    input: { color: '#fff' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#666' },
                      '&.Mui-focused fieldset': { borderColor: '#5e2e8f' },
                    }
                  }}
                />
              </StyledTableCell>
              <StyledTableCell>
                <TextField
                  value={player.name}
                  onChange={(e) => updatePlayer(teamType, index, 'name', e.target.value)}
                  placeholder="Player name"
                  size="small"
                  fullWidth
                  sx={{
                    backgroundColor: '#2a2a2a',
                    input: { color: '#fff' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#666' },
                      '&.Mui-focused fieldset': { borderColor: '#5e2e8f' },
                    }
                  }}
                />
              </StyledTableCell>
              <StyledTableCell>
                <FormControl fullWidth size="small" sx={{ backgroundColor: '#2a2a2a' }}>
                  <Select
                    value={player.position}
                    onChange={(e) => updatePlayer(teamType, index, 'position', e.target.value)}
                    sx={{
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#5e2e8f' }
                    }}
                  >
                    {GAA_POSITIONS.map((pos) => (
                      <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </StyledTableCell>
              <StyledTableCell>
                <IconButton
                  onClick={() => removePlayer(teamType, index)}
                  size="small"
                  sx={{ color: '#dc3545' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
                {index > 0 && (
                  <IconButton 
                    onClick={() => {
                      if (index > 0) {
                        const updatedPlayers = [...(teamType === 'home' ? homeTeam.players : awayTeam.players)];
                        [updatedPlayers[index-1], updatedPlayers[index]] = [updatedPlayers[index], updatedPlayers[index-1]];
                        
                        if (teamType === 'home') {
                          setHomeTeam({ ...homeTeam, players: updatedPlayers });
                        } else {
                          setAwayTeam({ ...awayTeam, players: updatedPlayers });
                        }
                      }
                    }}
                    size="small"
                    sx={{ color: '#5e2e8f' }}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                )}
                {index < team.players.length - 1 && (
                  <IconButton
                    onClick={() => {
                      if (index < team.players.length - 1) {
                        const updatedPlayers = [...(teamType === 'home' ? homeTeam.players : awayTeam.players)];
                        [updatedPlayers[index], updatedPlayers[index+1]] = [updatedPlayers[index+1], updatedPlayers[index]];
                        
                        if (teamType === 'home') {
                          setHomeTeam({ ...homeTeam, players: updatedPlayers });
                        } else {
                          setAwayTeam({ ...awayTeam, players: updatedPlayers });
                        }
                      }
                    }}
                    size="small"
                    sx={{ color: '#5e2e8f' }}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                )}
              </StyledTableCell>
            </StyledTableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#121212',
          color: '#fff',
          borderRadius: 2,
          minHeight: '80vh',
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupsIcon fontSize="large" sx={{ color: '#5e2e8f' }} />
          <Typography variant="h5">GAA Team Management</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#aaa' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {/* Success/Error Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, backgroundColor: 'rgba(220, 53, 69, 0.2)', color: '#e57373' }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2, backgroundColor: 'rgba(40, 167, 69, 0.2)', color: '#81c784' }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}
        
        {/* Tabs for Team Setup / Saved Teams */}
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            mb: 3,
            borderBottom: '1px solid #333',
            '& .MuiTabs-indicator': { backgroundColor: '#5e2e8f' }
          }}
        >
          <StyledTab label="Team Setup" icon={<SportsIcon />} iconPosition="start" />
          <StyledTab label="Saved Teams" icon={<SaveIcon />} iconPosition="start" />
          <StyledTab label="Import Help" icon={<HelpOutlineIcon />} iconPosition="start" />
        </Tabs>
        
        {/* Team Setup Tab */}
        {activeTab === 0 && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>Home Team</Typography>
            {renderPlayerTable('home', homeTeam)}
            
            <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>Away Team</Typography>
            {renderPlayerTable('away', awayTeam)}
            
            <Divider sx={{ my: 3, borderColor: '#333' }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                label="Save Configuration As"
                value={teamConfig}
                onChange={(e) => setTeamConfig(e.target.value)}
                placeholder="e.g., County Finals 2025"
                sx={{
                  flex: 1,
                  backgroundColor: '#2a2a2a',
                  input: { color: '#fff' },
                  label: { color: '#aaa' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#666' },
                    '&.Mui-focused fieldset': { borderColor: '#5e2e8f' },
                  }
                }}
              />
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={currentUser ? saveTeamsToFirestore : saveTeamsToLocalStorage}
                disabled={savingTeams || !teamConfig.trim()}
                sx={{
                  backgroundColor: '#5e2e8f',
                  color: '#fff',
                  '&:hover': { backgroundColor: '#7e4cb8' }
                }}
              >
                {savingTeams ? 'Saving...' : currentUser ? 'Save to Account' : 'Save Locally'}
              </Button>
            </Box>
          </>
        )}
        
        {/* Saved Teams Tab */}
        {activeTab === 1 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Saved Team Configurations</Typography>
              <Button
                onClick={loadTeamsFromLocalStorage}
                startIcon={<RefreshIcon />}
                sx={{ color: '#5e2e8f' }}
              >
                Refresh
              </Button>
            </Box>
            
            {loadingTeams ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress color="secondary" />
              </Box>
            ) : savedTeams.length === 0 ? (
              <Typography sx={{ textAlign: 'center', p: 4, color: '#aaa' }}>
                No saved team configurations found. Set up teams and save them first.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: '#1a1a1a' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <StyledTableCell>Name</StyledTableCell>
                      <StyledTableCell>Home Team</StyledTableCell>
                      <StyledTableCell>Away Team</StyledTableCell>
                      <StyledTableCell>Created</StyledTableCell>
                      <StyledTableCell>Actions</StyledTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {savedTeams.map((team) => (
                      <StyledTableRow key={team.id}>
                        <StyledTableCell>{team.name}</StyledTableCell>
                        <StyledTableCell>
                          {team.homeTeam?.name} ({team.homeTeam?.players.filter(p => p.name).length} players)
                        </StyledTableCell>
                        <StyledTableCell>
                          {team.awayTeam?.name} ({team.awayTeam?.players.filter(p => p.name).length} players)
                        </StyledTableCell>
                        <StyledTableCell>
                          {new Date(team.createdAt).toLocaleDateString()}
                        </StyledTableCell>
                        <StyledTableCell>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => loadTeamConfiguration(team)}
                            sx={{
                              backgroundColor: '#5e2e8f',
                              color: '#fff',
                              '&:hover': { backgroundColor: '#7e4cb8' }
                            }}
                          >
                            Load
                          </Button>
                        </StyledTableCell>
                      </StyledTableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
        
        {/* Import Help Tab */}
        {activeTab === 2 && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>File Import Instructions</Typography>
            <Typography sx={{ mb: 2 }}>
              Import player data from a text file (.txt or .csv) using the following format:
            </Typography>
            
            <Box sx={{ backgroundColor: '#1a1a1a', p: 2, borderRadius: 1, mb: 3 }}>
              <Typography fontFamily="monospace" sx={{ whiteSpace: 'pre-line' }}>
                1,Player Name,Position
                2,Player Name,Position
                ...
              </Typography>
            </Box>
            
            <Typography variant="subtitle1" sx={{ mb: 2 }}>Format Notes:</Typography>
            <ul style={{ paddingLeft: '20px', color: '#ddd' }}>
              <li>Each line represents one player</li>
              <li>Format: Number, Name, Position (comma separated)</li>
              <li>Position is optional - will default to "Substitute" if not provided</li>
              <li>Maximum 30 players per team</li>
              <li>File can use comma, tab, or pipe (|) as separators</li>
              <li>Empty lines are ignored</li>
            </ul>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={generateSampleFile}
                sx={{
                  borderColor: '#5e2e8f',
                  color: '#5e2e8f',
                  '&:hover': {
                    borderColor: '#7e4cb8',
                    backgroundColor: 'rgba(94, 46, 143, 0.1)'
                  }
                }}
              >
                Download Sample File
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 3, borderTop: '1px solid #333' }}>
        <Button
          onClick={onClose}
          sx={{ color: '#aaa' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSaveAndClose}
          variant="contained"
          startIcon={<SaveIcon />}
          sx={{
            backgroundColor: '#5e2e8f',
            color: '#fff',
            '&:hover': { backgroundColor: '#7e4cb8' }
          }}
        >
          Save Teams & Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Helper Functions
// These can be exported to be used elsewhere in your app

// Export functions to use in other components
export const exportTeamsToFile = (teams) => {
  try {
    const teamData = {
      exportDate: new Date().toISOString(),
      home: teams.home,
      away: teams.away
    };
    
    const jsonData = JSON.stringify(teamData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${teams.home.name}-vs-${teams.away.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    return true;
  } catch (error) {
    console.error("Error exporting teams:", error);
    return false;
  }
};

// Import teams from a JSON file
export const importTeamsFromJson = (jsonData) => {
  try {
    const parsed = JSON.parse(jsonData);
    
    // Validate the expected format
    if (!parsed.home || !parsed.away) {
      throw new Error("Invalid team data format");
    }
    
    return {
      home: parsed.home,
      away: parsed.away
    };
  } catch (error) {
    console.error("Error importing teams:", error);
    return null;
  }
};

// Get formatted player label (for dropdowns)
export const getPlayerLabel = (player) => {
  if (!player || !player.name) return "No player";
  return `${player.number}. ${player.name} (${player.position})`;
};

// Get player by ID
export const getPlayerById = (teams, teamId, playerId) => {
  if (!teams || !teams[teamId]) return null;
  return teams[teamId].players.find(p => p.id === playerId) || null;
};

export default TeamsManager;