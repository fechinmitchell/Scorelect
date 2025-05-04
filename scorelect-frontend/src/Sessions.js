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
  CircularProgress,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';
import { firestore } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

// Define theme colors to match SportsDataHub
const colors = {
  primary: '#733FAA',
  primaryLight: '#8C52CC',
  primaryDark: '#6030A0',
  secondary: '#9B66D9',
  accent: '#FF79C6',
  dark: '#0F0A1B',
  darkAlt: '#1A1232',
  darkCard: '#251943',
  light: '#E6E6FA',
  grayLight: '#465171',
  gray: '#738194',
  grayDark: '#9BAACB',
  success: '#50FA7B',
  warning: '#FFBF4D',
  danger: '#FF5555',
};

// Create a gradient background
const gradientBg = `linear-gradient(135deg, ${colors.dark} 0%, ${colors.darkAlt} 100%)`;
const cardGradientBg = `linear-gradient(145deg, ${colors.darkAlt}, ${colors.darkCard})`;
const buttonGradient = `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`;
const buttonHoverGradient = `linear-gradient(90deg, ${colors.primaryDark}, ${colors.primary})`;

// Styled Components
const PageContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  minHeight: '100vh',
  maxWidth: '1400px',
  margin: '0 auto',
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  background: gradientBg,
  color: colors.light,
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}));

const ViewSessionsContainer = styled(Box)(({ theme }) => ({
  backgroundColor: 'transparent',
  color: colors.light,
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
}));

const CreateSessionsContainer = styled(Box)(({ theme }) => ({
  backgroundColor: 'transparent',
  color: colors.light,
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
}));

const SportLabel = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  right: theme.spacing(2),
  backgroundColor: colors.darkCard,
  color: colors.light,
  padding: theme.spacing(0.5, 1.5),
  borderRadius: theme.spacing(2),
  fontSize: '0.9rem',
  border: `1px solid ${colors.primary}`,
  fontWeight: 600,
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.3)',
  transition: 'all 250ms ease-in-out',
  '&:hover': {
    backgroundColor: colors.primary,
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 16px rgba(0, 0, 0, 0.2), 0 0 15px rgba(115, 63, 170, 0.5)`,
  },
}));

const SectionContainer = styled(Box)(({ theme }) => ({
  backgroundColor: colors.darkCard,
  border: `1px solid rgba(115, 63, 170, 0.2)`,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(3),
  marginTop: theme.spacing(4),
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2), 0 0 15px rgba(115, 63, 170, 0.5)',
  },
}));

// Custom Styled Material UI Components
const StyledTabs = styled(Tabs)(({ theme }) => ({
  backgroundColor: colors.darkCard,
  borderRadius: '8px 8px 0 0',
  borderBottom: `1px solid rgba(115, 63, 170, 0.2)`,
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
  marginBottom: theme.spacing(3),
  '& .MuiTab-root': {
    color: colors.grayDark,
    fontSize: '1rem',
    fontWeight: 600,
    padding: '12px 24px',
    transition: 'all 250ms ease-in-out',
    '&:hover': {
      color: colors.light,
      backgroundColor: 'rgba(115, 63, 170, 0.1)',
    },
  },
  '& .Mui-selected': {
    color: `${colors.light} !important`,
    fontWeight: 600,
  },
  '& .MuiTabs-indicator': {
    backgroundColor: colors.accent,
    height: '3px',
    borderRadius: '3px 3px 0 0',
    boxShadow: '0 0 15px rgba(255, 121, 198, 0.5)',
  },
}));

const StyledTab = styled(Tab)({
  textTransform: 'none',
});

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-root': {
    backgroundColor: colors.darkAlt,
    borderRadius: theme.spacing(1),
    color: colors.light,
    transition: 'all 250ms ease-in-out',
  },
  '& .MuiInputLabel-root': {
    color: colors.grayDark,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: colors.primaryLight,
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(115, 63, 170, 0.3)',
      transition: 'all 250ms ease-in-out',
    },
    '&:hover fieldset': {
      borderColor: colors.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: colors.primary,
      boxShadow: '0 0 0 3px rgba(115, 63, 170, 0.25)',
    },
  },
  '& .MuiInputBase-input::placeholder': {
    color: colors.gray,
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  background: buttonGradient,
  color: colors.light,
  borderRadius: theme.spacing(1),
  padding: '10px 20px',
  fontWeight: 600,
  textTransform: 'none',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.3)',
  transition: 'all 250ms ease-in-out',
  '&:hover': {
    background: buttonHoverGradient,
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 0 15px rgba(115, 63, 170, 0.5)',
    transform: 'translateY(-2px)',
  },
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  backgroundColor: colors.darkAlt,
  color: colors.light,
  borderRadius: theme.spacing(1),
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'rgba(115, 63, 170, 0.3)',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: colors.primary,
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: colors.primary,
    boxShadow: '0 0 0 3px rgba(115, 63, 170, 0.25)',
  },
  '& .MuiSelect-select': {
    padding: '10px 32px 10px 14px',
  },
  '& .MuiSvgIcon-root': { // Dropdown arrow
    color: colors.grayDark,
  },
}));

const StyledInputLabel = styled(InputLabel)({
  color: colors.grayDark,
  '&.Mui-focused': {
    color: colors.primaryLight,
  },
});

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  gap: theme.spacing(1),
  background: 'transparent',
}));

const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  color: colors.grayDark,
  borderColor: 'rgba(115, 63, 170, 0.3)',
  borderRadius: theme.spacing(1),
  backgroundColor: colors.darkAlt,
  textTransform: 'none',
  padding: '6px 16px',
  transition: 'all 250ms ease-in-out',
  '&.Mui-selected': {
    color: colors.light,
    backgroundColor: colors.primary,
    boxShadow: '0 0 15px rgba(115, 63, 170, 0.5)',
  },
  '&:hover': {
    backgroundColor: 'rgba(115, 63, 170, 0.2)',
  },
}));

const StyledSessionCard = styled(Card)(({ theme }) => ({
  width: 300,
  backgroundColor: colors.darkCard,
  borderRadius: theme.spacing(1),
  overflow: 'hidden',
  border: '1px solid rgba(115, 63, 170, 0.2)',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  margin: theme.spacing(1),
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2), 0 0 15px rgba(115, 63, 170, 0.5)',
    border: '1px solid rgba(115, 63, 170, 0.4)',
    '& .card-header': {
      height: '4px',
      opacity: 1,
    },
  },
}));

const CardHeader = styled(Box)({
  height: '2px',
  width: '100%',
  background: buttonGradient,
  position: 'absolute',
  top: 0,
  left: 0,
  opacity: 0.7,
  transition: 'all 250ms ease-in-out',
});

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 600,
  color: colors.primaryLight,
  marginBottom: theme.spacing(2),
  position: 'relative',
  display: 'inline-block',
  paddingBottom: theme.spacing(1),
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '40px',
    height: '3px',
    background: colors.accent,
    borderRadius: '3px',
  },
}));

const SearchBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: colors.darkAlt,
  borderRadius: '50px',
  border: '1px solid rgba(115, 63, 170, 0.3)',
  padding: '4px 16px',
  marginRight: theme.spacing(2),
  transition: 'all 250ms ease-in-out',
  maxWidth: '300px',
  '&:focus-within': {
    borderColor: colors.primary,
    boxShadow: '0 0 0 3px rgba(115, 63, 170, 0.25), 0 0 15px rgba(115, 63, 170, 0.5)',
    transform: 'scale(1.02)',
  },
}));

const StyledSearchIcon = styled(SearchIcon)({
  color: colors.grayDark,
  marginRight: '8px',
});

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
    <StyledSessionCard>
      <CardHeader className="card-header" />
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
        <Typography variant="h6" sx={{ 
          color: colors.primaryLight, 
          fontWeight: 600,
          fontSize: '1.1rem',
          mb: 1,
        }}>
          {session.title}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="body2" sx={{ color: colors.grayDark }}>
            Time: <span style={{ color: colors.light }}>{session.time}</span>
          </Typography>
          <Typography variant="body2" sx={{ color: colors.grayDark }}>
            Type: <span style={{ color: colors.light }}>{session.type}</span>
          </Typography>
          <Typography variant="body2" sx={{ color: colors.grayDark }}>
            Creator: <span style={{ color: colors.light }}>{session.creator}</span>
          </Typography>
          <Typography variant="body2" sx={{ color: colors.grayDark }}>
            Price: <span style={{ color: colors.light }}>{session.price}</span>
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <StyledButton
          size="small"
          onClick={() => navigate(`/session-detail/${session.id}`)}
        >
          View Details
        </StyledButton>
        <IconButton 
          onClick={() => onFavoriteToggle(session.id)}
          sx={{ 
            color: isFavorited ? colors.danger : colors.light,
            transition: 'all 250ms ease-in-out',
            '&:hover': {
              transform: 'scale(1.1)',
            },
          }}
        >
          {isFavorited ? (
            <FavoriteIcon />
          ) : (
            <FavoriteBorderIcon />
          )}
        </IconButton>
      </CardActions>
    </StyledSessionCard>
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
        Swal.fire({
          title: 'Error',
          text: 'Failed to load sessions.',
          icon: 'error',
          background: colors.darkCard,
          confirmButtonColor: colors.primary,
        });
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
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '300px' 
      }}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  }

  return (
    <ViewSessionsContainer>
      {favoriteSessionsList.length > 0 && (
        <SectionContainer sx={{ mb: 4 }}>
          <SectionTitle>
            Favorited Sessions
          </SectionTitle>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              justifyContent: 'flex-start',
            }}
          >
            {favoriteSessionsList.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isFavorited={true}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </Box>
        </SectionContainer>
      )}

      <SectionContainer>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
            mb: 3,
          }}
        >
          <SearchBox>
            <StyledSearchIcon />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.light,
                outline: 'none',
                width: '100%',
                fontSize: '0.9rem',
              }}
            />
          </SearchBox>
          
          <StyledToggleButtonGroup
            value={filter}
            exclusive
            onChange={(e, newFilter) => {
              if (newFilter !== null) setFilter(newFilter);
            }}
            aria-label="session filter"
          >
            <StyledToggleButton value="all">All</StyledToggleButton>
            <StyledToggleButton value="preseason">Preseason</StyledToggleButton>
            <StyledToggleButton value="in-season">In-Season</StyledToggleButton>
            <StyledToggleButton value="recovery">Recovery</StyledToggleButton>
            <StyledToggleButton value="pitch">Pitch</StyledToggleButton>
            <StyledToggleButton value="gym">Gym</StyledToggleButton>
            <StyledToggleButton value="food plan">Food Plan</StyledToggleButton>
          </StyledToggleButtonGroup>
        </Box>

        <SectionTitle>
          All Sessions
        </SectionTitle>
        
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'flex-start',
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
            <Box
              sx={{
                width: '100%',
                py: 5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 2,
                borderStyle: 'dashed',
                borderColor: 'rgba(115, 63, 170, 0.3)',
                textAlign: 'center',
              }}
            >
              <Typography variant="body1" sx={{ color: colors.grayDark }}>
                No sessions available with the current filters.
              </Typography>
              <StyledButton 
                sx={{ mt: 2 }}
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
              >
                Clear Filters
              </StyledButton>
            </Box>
          )}
        </Box>
      </SectionContainer>
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
      Swal.fire({
        title: 'Error',
        text: 'Please select a season and length.',
        icon: 'warning',
        background: colors.darkCard,
        confirmButtonColor: colors.primary,
      });
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
    <SectionContainer
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <FormControl sx={{ minWidth: 150 }} size="small">
        <StyledInputLabel>Season</StyledInputLabel>
        <StyledSelect
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          label="Season"
        >
          <MenuItem value="Preseason">Preseason</MenuItem>
          <MenuItem value="In-Season">In-Season</MenuItem>
          <MenuItem value="Postseason">Postseason</MenuItem>
        </StyledSelect>
      </FormControl>
      
      <FormControl sx={{ minWidth: 150 }} size="small">
        <StyledInputLabel>Length</StyledInputLabel>
        <StyledSelect
          value={length}
          onChange={(e) => setLength(e.target.value)}
          label="Session Length"
        >
          <MenuItem value="45">45 Min</MenuItem>
          <MenuItem value="60">60 Min</MenuItem>
          <MenuItem value="90">90 Min</MenuItem>
        </StyledSelect>
      </FormControl>
      
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        backgroundColor: colors.darkAlt,
        borderRadius: '8px',
        padding: '4px 12px',
      }}>
        <Typography 
          variant="body2" 
          sx={{ 
            mr: 1,
            color: colors.grayDark
          }}
        >
          Scan Calendar?
        </Typography>
        <input
          type="checkbox"
          checked={useCalendar}
          onChange={(e) => setUseCalendar(e.target.checked)}
          style={{ 
            accentColor: colors.primary,
            width: '16px',
            height: '16px',
          }}
        />
      </Box>
      
      <StyledTextField
        label="Comments"
        variant="outlined"
        multiline
        size="small"
        rows={1}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{ flexGrow: 1, minWidth: 200 }}
      />
      
      <StyledButton
        startIcon={<AutoAwesomeIcon />}
        onClick={handleGenerate}
      >
        Generate Session
      </StyledButton>
    </SectionContainer>
  );
};

// ManualSessionForm Component
const ManualSessionForm = ({ selectedSport }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleCreate = () => {
    if (!title.trim()) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a session title.',
        icon: 'warning',
        background: colors.darkCard,
        confirmButtonColor: colors.primary,
      });
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
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <StyledTextField
        label="Session Title"
        variant="outlined"
        fullWidth
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <StyledTextField
        label="Description"
        variant="outlined"
        multiline
        rows={4}
        fullWidth
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <StyledButton
        onClick={handleCreate}
        sx={{ alignSelf: 'flex-start' }}
      >
        Create Session
      </StyledButton>
    </Box>
  );
};

// CreateSessionPage Component
const CreateSessionPage = ({ selectedSport }) => {
  return (
    <CreateSessionsContainer>
      <SectionTitle>
        Generate Session
      </SectionTitle>
      <GenerateSessionForm selectedSport={selectedSport} />
      
      <SectionContainer sx={{ mt: 4 }}>
        <SectionTitle>
          Manual Create Session
        </SectionTitle>
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
      <Box sx={{ position: 'relative', mb: 4, textAlign: 'center' }}>
        <Typography
          variant="h3"
          sx={{ 
            color: colors.primary,
            fontWeight: 700,
            letterSpacing: '0.5px',
            position: 'relative',
            display: 'inline-block',
            pb: 2,
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: 0,
              left: '25%',
              width: '50%',
              height: '4px',
              borderRadius: '2px',
              background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
            }
          }}
        >
          {selectedSport} Sessions
        </Typography>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            mt: 2, 
            color: colors.grayDark,
            fontWeight: 400,
            maxWidth: 700,
            mx: 'auto' 
          }}
        >
          Create or explore training sessions customized for {selectedSport}
        </Typography>
      </Box>
      
      <SportLabel>{selectedSport}</SportLabel>
      
      <StyledTabs
        value={tab}
        onChange={handleTabChange}
        variant="fullWidth"
      >
        <StyledTab label="View Sessions" />
        <StyledTab label="Create Session" />
      </StyledTabs>
      
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