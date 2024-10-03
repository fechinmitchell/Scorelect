// src/blogs/BballCollect.js

import React from 'react';
import styled from 'styled-components';
import {
  Container,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
} from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';

// Styled Components
const BlogContainer = styled(Container)`
  padding: 40px 0;

  @media (max-width: 850px) {
    padding: 20px 0;
  }
`;

const StepContent = styled(Box)`
  margin-top: 20px;
  margin-bottom: 20px;
`;

const Image = styled.img`
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  margin-bottom: 20px;
`;

const TipsBox = styled(Box)`
  background-color: #f9f9f9;
  padding: 20px;
  border-left: 5px solid #17a2b8;
  margin: 20px 0;
`;

const BballCollect = () => {
  const steps = [
    {
      label: '1. Create Your Scorelect Account',
      description:
        'Start by signing up for a free account on Scorelect. Navigate to the Sign-Up page and provide the necessary information to create your profile.',
      image: '/images/step1_signup.jpg', // Ensure this image exists in the public/images directory
    },
    {
      label: '2. Navigate to the Basketball Statistics Section',
      description:
        'Once logged in, access the dashboard and select the "Basketball Statistics" option from the main menu. This section is specifically designed for collecting and analyzing basketball data.',
      image: '/images/step2_navigation.jpg',
    },
    {
      label: '3. Start a New Game Session',
      description:
        'Click on the "Start New Game" button to begin recording statistics for a new basketball match. Enter relevant details such as team names, date, and location.',
      image: '/images/step3_new_game.jpg',
    },
    {
      label: '4. Record Player Actions',
      description:
        'During the game, use the intuitive interface to log various player actions. This includes shots made/missed, rebounds, assists, turnovers, and more. Each action is categorized for easy analysis.',
      image: '/images/step4_record_actions.jpg',
    },
    {
      label: '5. Analyze and Export Data',
      description:
        'After the game, utilize Scorelect’s powerful analytics tools to review the collected data. Generate reports, visualize statistics, and export the data for further use or sharing with your team.',
      image: '/images/step5_analyze_export.jpg',
    },
  ];

  const tips = [
    'Ensure accurate data entry by having a dedicated statistician during the game.',
    'Utilize the real-time analytics features to make informed decisions during the match.',
    'Regularly export and back up your data to prevent loss.',
    'Take advantage of customizable reports to focus on the metrics that matter most to your team.',
  ];

  return (
    <BlogContainer maxWidth="lg">
      <Typography variant="h3" gutterBottom>
        Collecting Basketball Statistics on Amateur Games
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" paragraph>
        A comprehensive guide to collecting and analyzing basketball stats for non-professional games using Scorelect.
      </Typography>

      <Image src="/images/basketball_stats_banner.jpg" alt="Basketball Statistics" />

      <Typography variant="h5" gutterBottom>
        Why Collect Basketball Statistics?
      </Typography>
      <Typography variant="body1" paragraph>
        Collecting basketball statistics is essential for understanding team performance, identifying strengths and weaknesses, and making informed decisions to improve gameplay. Whether you're a coach, player, or enthusiast, having access to accurate data can significantly enhance your strategic approach to the game.
      </Typography>

      <Box sx={{ width: '100%', marginTop: '40px' }}>
        <Stepper activeStep={-1} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={index}>
              <StepLabel>
                <Typography variant="h6">{step.label}</Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body1">{step.description}</Typography>
                <Image src={step.image} alt={`Step ${index + 1}`} />
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Typography variant="h5" gutterBottom>
        Best Practices for Data Collection
      </Typography>
      <Typography variant="body1" paragraph>
        To ensure the effectiveness of your data collection process, consider the following best practices:
      </Typography>
      <TipsBox>
        <Typography variant="body1" component="ul">
          {tips.map((tip, index) => (
            <li key={index}>{tip}</li>
          ))}
        </Typography>
      </TipsBox>

      <Typography variant="h5" gutterBottom>
        Getting Started with Scorelect
      </Typography>
      <Typography variant="body1" paragraph>
        Scorelect offers an intuitive platform for collecting and analyzing basketball statistics. Follow the steps outlined above to get started and make the most out of your data.
      </Typography>

      <Typography variant="h5" gutterBottom>
        Additional Resources
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardMedia
              component="img"
              height="140"
              image="https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg" // Replace VIDEO_ID with actual ID
              alt="Tutorial Video"
            />
            <CardContent>
              <Typography variant="h6">Watch Our Tutorial Video</Typography>
              <Typography variant="body2" color="textSecondary">
                Learn how to use Scorelect with our step-by-step video guide.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                size="small"
                color="primary"
                href="https://www.youtube.com/watch?v=VIDEO_ID" // Replace with actual video link
                target="_blank"
                startIcon={<PlayCircleOutlineIcon />}
              >
                Watch Video
              </Button>
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardMedia
              component="img"
              height="140"
              image="/images/scorelect_documentation.jpg" // Ensure this image exists
              alt="Documentation"
            />
            <CardContent>
              <Typography variant="h6">Read Our Detailed Documentation</Typography>
              <Typography variant="body2" color="textSecondary">
                Dive deeper into Scorelect’s features with our comprehensive documentation.
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                size="small"
                color="primary"
                href="/documentation" // Replace with actual documentation link
                target="_blank"
                startIcon={<DescriptionIcon />}
              >
                Read Documentation
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ marginTop: '40px', textAlign: 'center' }}>
        <Button variant="contained" color="primary" href="/how-to">
          Back to How-To Guides
        </Button>
      </Box>
    </BlogContainer>
  );
};

export default BballCollect;
