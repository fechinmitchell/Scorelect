// src/Sessions.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  IconButton,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { styled } from '@mui/material/styles';
import { firestore } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

// Styled Components
const PageContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  minHeight: '100vh',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
}));

const ViewSessionsContainer = styled(Box)(({ theme }) => ({
  backgroundColor: '#2c2c2c',
  color: '#ffffff',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
}));

const CreateSessionsContainer = styled(Box)(({ theme }) => ({
  backgroundColor: '#2c2c2c',
  color: '#ffffff',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
}));

const SportLabel = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  right: theme.spacing(2),
  backgroundColor: 'rgba(0,0,0,0.6)',
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.spacing(0.5),
  fontSize: '0.9rem',
}));

const SectionContainer = styled(Box)(({ theme }) => ({
  backgroundColor: '#3a3a3a',
  border: '2px solid #5e2e8f',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(3),
  marginTop: theme.spacing(4),
}));

const StyledTabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ flexGrow: 1 }}>{children}</Box>}
    </div>
  );
};

// SessionCard Component
const SessionCard = ({ session, isFavorited, onFavoriteToggle }) => {
  const navigate = useNavigate();

  return (
    <Card
      sx={{
        width: 300,
        backgroundColor: '#444',
        borderRadius: 2,
        boxShadow: 3,
        m: 1,
        transition: 'transform 0.2s, boxShadow 0.2s',
        '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 },
      }}
    >
      <CardMedia
        component="img"
        height="150"
        image={
          session.image ||
          'https://via.placeholder.com/300x150?text=Session+Image'
        }
        alt={session.title}
      />
      <CardContent>
        <Typography variant="h6" sx={{ color: '#5e2e8f' }}>
          {session.title}
        </Typography>
        <Typography variant="body2">Time: {session.time}</Typography>
        <Typography variant="body2">Type: {session.type}</Typography>
        <Typography variant="body2">Creator: {session.creator}</Typography>
        <Typography variant="body2">Price: {session.price}</Typography>
      </CardContent>
      <CardActions>
        <Button
          variant="contained"
          size="small"
          sx={{ backgroundColor: '#5e2e8f' }}
          onClick={() => navigate(`/session-detail/${session.id}`)}
        >
          View
        </Button>
        <IconButton onClick={() => onFavoriteToggle(session.id)}>
          {isFavorited ? (
            <FavoriteIcon sx={{ color: '#ff4444' }} />
          ) : (
            <FavoriteBorderIcon sx={{ color: '#ffffff' }} />
          )}
        </IconButton>
      </CardActions>
    </Card>
  );
};

// ViewSessionsPage Component
const ViewSessionsPage = ({ selectedSport }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [sessions, setSessions] = useState([]);
  const [favoritedSessions, setFavoritedSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionsCollection = collection(firestore, 'public_sessions');
        const snapshot = await getDocs(sessionsCollection);
        const sessionsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const filteredSessions = selectedSport
          ? sessionsData.filter((session) => session.sport === selectedSport)
          : sessionsData;
        setSessions(filteredSessions);
        const storedFavorites =
          JSON.parse(localStorage.getItem('favoritedSessions')) || [];
        setFavoritedSessions(storedFavorites);
      } catch (error) {
        console.error('Error fetching sessions:', error);
        Swal.fire('Error', 'Failed to load sessions.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [selectedSport]);

  const handleFavoriteToggle = (sessionId) => {
    const isCurrentlyFavorited = favoritedSessions.includes(sessionId);
    let updatedFavorites;
    if (isCurrentlyFavorited) {
      updatedFavorites = favoritedSessions.filter((id) => id !== sessionId);
    } else {
      updatedFavorites = [...favoritedSessions, sessionId];
    }
    setFavoritedSessions(updatedFavorites);
    localStorage.setItem('favoritedSessions', JSON.stringify(updatedFavorites));
  };

  const filteredSessions = sessions.filter((session) => {
    let matches = true;
    if (filter !== 'all') {
      matches = session.type.toLowerCase().includes(filter.toLowerCase());
    }
    if (searchTerm) {
      matches =
        matches &&
        session.title.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return matches;
  });

  const favoriteSessionsList = sessions.filter((session) =>
    favoritedSessions.includes(session.id)
  );

  if (loading) {
    return <Typography>Loading sessions...</Typography>;
  }

  return (
    <ViewSessionsContainer>
      <Box sx={{ mt: 4, width: '100%' }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#5e2e8f' }}>
          Favorited Sessions
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'flex-start',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          {favoriteSessionsList.length > 0 ? (
            favoriteSessionsList.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isFavorited={favoritedSessions.includes(session.id)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))
          ) : (
            <Typography>No favorited sessions yet.</Typography>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          mt: 4,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <TextField
          label="Search Sessions"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            input: { color: '#ffffff' },
            label: { color: '#ffffff' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#5e2e8f' },
            },
            minWidth: 200,
          }}
        />
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(e, newFilter) => {
            if (newFilter !== null) setFilter(newFilter);
          }}
          aria-label="session filter"
        >
          <ToggleButton value="all" sx={{ color: '#ffffff', borderColor: '#5e2e8f' }}>
            All
          </ToggleButton>
          <ToggleButton value="preseason" sx={{ color: '#ffffff', borderColor: '#5e2e8f' }}>
            Preseason
          </ToggleButton>
          <ToggleButton value="in-season" sx={{ color: '#ffffff', borderColor: '#5e2e8f' }}>
            In-Season
          </ToggleButton>
          <ToggleButton value="recovery" sx={{ color: '#ffffff', borderColor: '#5e2e8f' }}>
            Recovery
          </ToggleButton>
          <ToggleButton value="pitch" sx={{ color: '#ffffff', borderColor: '#5e2e8f' }}>
            Pitch
          </ToggleButton>
          <ToggleButton value="gym" sx={{ color: '#ffffff', borderColor: '#5e2e8f' }}>
            Gym
          </ToggleButton>
          <ToggleButton value="food plan" sx={{ color: '#ffffff', borderColor: '#5e2e8f' }}>
            Food Plan
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ mt: 4, width: '100%', flexGrow: 1 }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#5e2e8f' }}>
          All Sessions
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'flex-start',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isFavorited={favoritedSessions.includes(session.id)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))
          ) : (
            <Typography>No sessions available.</Typography>
          )}
        </Box>
      </Box>
    </ViewSessionsContainer>
  );
};

// GenerateSessionForm Component
const GenerateSessionForm = ({ selectedSport }) => {
  const [season, setSeason] = useState('');
  const [length, setLength] = useState('');
  const [useCalendar, setUseCalendar] = useState(false);
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleGenerate = () => {
    if (!season || !length) {
      Swal.fire('Error', 'Please select a season and length.', 'warning');
      return;
    }

    const sessionData = {
      title: `${length} Min ${season} ${selectedSport} Session`,
      time: 'N/A',
      type: season,
      creator: 'Generated by User',
      price: 'Free',
      image: `https://via.placeholder.com/300x150?text=${length}+Min+${season}+${selectedSport}+Session`,
      description,
      sport: selectedSport,
    };

    navigate('/session-editor/new', { state: sessionData });
    setSeason('');
    setLength('');
    setUseCalendar(false);
    setDescription('');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        backgroundColor: '#3a3a3a',
        p: 3,
        borderRadius: 2,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <FormControl sx={{ minWidth: 150, backgroundColor: '#3a3a3a' }} size="small">
        <InputLabel sx={{ color: '#ffffff' }}>Season</InputLabel>
        <Select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          label="Season"
          sx={{ color: '#ffffff' }}
        >
          <MenuItem value="Preseason">Preseason</MenuItem>
          <MenuItem value="In-Season">In-Season</MenuItem>
          <MenuItem value="Postseason">Postseason</MenuItem>
        </Select>
      </FormControl>
      <FormControl sx={{ minWidth: 150, backgroundColor: '#3a3a3a' }} size="small">
        <InputLabel sx={{ color: '#ffffff' }}>Length</InputLabel>
        <Select
          value={length}
          onChange={(e) => setLength(e.target.value)}
          label="Session Length"
          sx={{ color: '#ffffff' }}
        >
          <MenuItem value="45">45 Min</MenuItem>
          <MenuItem value="60">60 Min</MenuItem>
          <MenuItem value="90">90 Min</MenuItem>
        </Select>
      </FormControl>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ mr: 1 }}>Scan Calendar?</Typography>
        <input
          type="checkbox"
          checked={useCalendar}
          onChange={(e) => setUseCalendar(e.target.checked)}
          style={{ accentColor: '#5e2e8f' }}
        />
      </Box>
      <TextField
        label="Comments"
        variant="outlined"
        multiline
        rows={1}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{
          input: { color: '#ffffff' },
          label: { color: '#ffffff' },
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: '#5e2e8f' },
          },
        }}
      />
      <Button
        variant="contained"
        startIcon={<AutoAwesomeIcon />}
        onClick={handleGenerate}
        sx={{ backgroundColor: '#5e2e8f' }}
      >
        Generate Session
      </Button>
    </Box>
  );
};

// ManualSessionForm Component
const ManualSessionForm = ({ selectedSport }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleCreate = () => {
    if (!title.trim()) {
      Swal.fire('Error', 'Please enter a session title.', 'warning');
      return;
    }

    const sessionData = {
      title,
      time: 'N/A',
      type: 'Custom',
      creator: 'User Created',
      price: 'Free',
      image: `https://via.placeholder.com/300x150?text=${title.replace(/\s+/g, '+')}`,
      description,
      sport: selectedSport,
    };

    navigate('/session-editor/new', { state: sessionData });
    setTitle('');
    setDescription('');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        backgroundColor: '#3a3a3a',
        p: 3,
        borderRadius: 2,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <TextField
        label="Session Title"
        variant="outlined"
        fullWidth
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        sx={{
          input: { color: '#ffffff' },
          label: { color: '#ffffff' },
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: '#5e2e8f' },
          },
        }}
      />
      <TextField
        label="Description"
        variant="outlined"
        multiline
        rows={4}
        fullWidth
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{
          input: { color: '#ffffff' },
          label: { color: '#ffffff' },
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: '#5e2e8f' },
          },
        }}
      />
      <Button
        variant="contained"
        onClick={handleCreate}
        sx={{ backgroundColor: '#5e2e8f' }}
      >
        Create Session
      </Button>
    </Box>
  );
};

// CreateSessionPage Component
const CreateSessionPage = ({ selectedSport }) => {
  return (
    <CreateSessionsContainer>
      <Typography variant="h6" sx={{ mb: 2, color: '#5e2e8f' }}>
        Generate Session
      </Typography>
      <GenerateSessionForm selectedSport={selectedSport} />
      <SectionContainer>
        <Typography variant="h6" sx={{ mb: 2, color: '#5e2e8f' }}>
          Manual Create Session
        </Typography>
        <ManualSessionForm selectedSport={selectedSport} />
      </SectionContainer>
    </CreateSessionsContainer>
  );
};

// Main Sessions Component
const Sessions = ({ selectedSport = 'GAA' }) => {
  const [tab, setTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  return (
    <PageContainer>
      <SportLabel>{selectedSport}</SportLabel>
      <Tabs
        value={tab}
        onChange={handleTabChange}
        centered
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { color: '#ffffff' },
          '& .MuiTabs-indicator': { backgroundColor: '#5e2e8f' },
        }}
      >
        <Tab label="View Sessions" />
        <Tab label="Create Session" />
      </Tabs>
      <StyledTabPanel value={tab} index={0}>
        <ViewSessionsPage selectedSport={selectedSport} />
      </StyledTabPanel>
      <StyledTabPanel value={tab} index={1}>
        <CreateSessionPage selectedSport={selectedSport} />
      </StyledTabPanel>
    </PageContainer>
  );
};

export default Sessions;