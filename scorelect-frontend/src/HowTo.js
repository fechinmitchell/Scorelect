import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Tabs,
  Tab,
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import BballCollectMain from './images/basketball_collect_main.png';
import SoccerCollectMain from './images/soccer_collect_main.png';
import GAACollectMain from './images/gaa_collect_main.png';
import AMFCollectMain from './images/amfootball_collect_main.png';

// Styled Components
const Container = styled.div`
  padding: 40px;
  @media (max-width: 850px) {
    padding: 20px;
  }
`;

const SearchContainer = styled.div`
  margin-bottom: 20px;
`;

const TutorialCard = styled(Card)`
  max-width: 345px;
  margin: 20px;
`;

const categories = [
  { label: 'All', value: 'all' },
  { label: 'Soccer', value: 'soccer' },
  { label: 'Basketball', value: 'basketball' },
  { label: 'American Football', value: 'american_football' },
  { label: 'GAA', value: 'gaa' },
];

const tutorialsData = [
  // Sample data for tutorials
  {
    id: 1,
    title: 'How to Collect Soccer Data for Free',
    description: 'Learn how to gather soccer match data without any cost using free tools.',
    category: 'soccer',
    type: 'video',
    thumbnail: 'https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg',
    link: 'https://www.youtube.com/watch?v=VIDEO_ID',
  },
  {
    id: 2,
    title: 'Collecting Basketball Statistics on Amateur Games',
    description: 'A guide to collecting and analyzing basketball stats for non-professional games.',
    category: 'basketball',
    type: 'blog',
    thumbnail: BballCollectMain,
    link: '/blog/basketball-statistics',
  },
  {
    id: 3,
    title: 'How to Collect Soccer Statistics on Games',
    description: 'A guide to collecting and analyzing Soccer stats for non-professional and professional games.',
    category: 'soccer',
    type: 'blog',
    thumbnail: SoccerCollectMain,
    link: '/blog/SoccerCollect',
  },
  {
    id: 4,
    title: 'How to Simply Collect GAA Statistics',
    description: 'A guide to collecting and analyzing GAA stats for any game.',
    category: 'gaa',
    type: 'blog',
    thumbnail: GAACollectMain,
    link: '/blog/GAACollect',
  },
  {
    id: 5,
    title: 'How to Simply Collect American Football Statistics',
    description: 'A guide to collecting and analyzing American Football stats for any game.',
    category: 'american_football',
    type: 'blog',
    thumbnail: AMFCollectMain,
    link: '/blog/AmericanFootballCollect',
  },
  // Add more tutorial objects here
];

const HowTo = () => {
  const [value, setValue] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTutorials, setFilteredTutorials] = useState(tutorialsData);

  useEffect(() => {
    filterTutorials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, searchTerm]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const filterTutorials = () => {
    let tutorials = tutorialsData;
    if (value !== 'all') {
      tutorials = tutorials.filter((tutorial) => tutorial.category === value);
    }
    if (searchTerm) {
      tutorials = tutorials.filter(
        (tutorial) =>
          tutorial.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tutorial.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredTutorials(tutorials);
  };

  return (
    <Container>
      {/* Title in purple */}
      <Typography variant="h4" gutterBottom sx={{ color: 'white' }}>
        How-To Guides and Tutorials
      </Typography>
      <Box sx={{ width: '100%', bgcolor: 'background.paper', marginBottom: '20px' }}>
        <Tabs
          value={value}
          onChange={handleChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Tutorial Categories"
        >
          {categories.map((category) => (
            <Tab key={category.value} label={category.label} value={category.value} />
          ))}
        </Tabs>
      </Box>
      <SearchContainer>
        <TextField
          variant="outlined"
          fullWidth
          placeholder="Search tutorials..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          // Here we override the MUI styles for a purple search box:
          sx={{
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: 'white' },
              "&:hover fieldset": { borderColor: 'white' },
              "&.Mui-focused fieldset": { borderColor: 'white' },
            },
            "& .MuiInputBase-input": {
              color: 'white'
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={filterTutorials} aria-label="search" sx={{ color: 'white' }}>
                  <SearchIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </SearchContainer>
      <Grid container spacing={2}>
        {filteredTutorials.length > 0 ? (
          filteredTutorials.map((tutorial) => (
            <Grid item xs={12} sm={6} md={4} key={tutorial.id}>
              <TutorialCard>
                <CardMedia
                  component="img"
                  height="140"
                  image={tutorial.thumbnail}
                  alt={tutorial.title}
                />
                <CardContent>
                  <Typography gutterBottom variant="h6" component="div">
                    {tutorial.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tutorial.description}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    color="primary"
                    href={tutorial.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={
                      tutorial.type === 'video' ? (
                        <PlayCircleOutlineIcon />
                      ) : (
                        <DescriptionIcon />
                      )
                    }
                  >
                    {tutorial.type === 'video' ? 'Watch Video' : 'Read Blog'}
                  </Button>
                </CardActions>
              </TutorialCard>
            </Grid>
          ))
        ) : (
          <Typography variant="h6" sx={{ margin: '20px' }}>
            No tutorials found.
          </Typography>
        )}
      </Grid>
    </Container>
  );
};

export default HowTo;
