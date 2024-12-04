// src/blogs/SoccerCollect.js

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
import step1SoccerCollect from '../images/step1_soccer_collect.png';
import step2SoccerCollect from '../images/step2_soccer_collect.png';
import step3SoccerCollect from '../images/step3_soccer_collect.png';
import step4SoccerCollect from '../images/step4_soccer_collect.png';
import step5SoccerCollect from '../images/step5_soccer_collect.png';

// If using react-lazy-load-image-component
// import { LazyLoadImage } from 'react-lazy-load-image-component';
// import 'react-lazy-load-image-component/src/effects/blur.css';

// Styled Components
const BlogContainer = styled(Container)`
  padding: 40px 0;
  background-color: #333333; /* Example grey background */

  @media (max-width: 850px) {
    padding: 20px 0;
  }
`;

const StepContent = styled(Box)`
  margin-top: 20px;
  margin-bottom: 20px;
  color: #FFFFFF; /* White text */
`;

const Image = styled.img.attrs(props => ({
  loading: 'lazy', // Enable lazy loading
}))`
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  margin-bottom: 20px;
`;

const TipsBox = styled(Box)`
  background-color: #5e2e8f;
  padding: 20px;
  border-left: 5px solid #17a2b8;
  margin: 20px 0;
  color: #FFFFFF; /* White text */
`;

const SoccerCollect = () => {
  const steps = [
    {
      label: '1. Collect Team Stats',
      description:
        'Seamlessly collect and manage your team\'s sports data to maximize performance.',
      image: step1SoccerCollect,
    },
    {
      label: '2. Create Training Sessions',
      description:
        'Design and organize effective training sessions tailored to your team\'s needs.',
      image: step2SoccerCollect,
    },
    {
      label: '3. Find Team Stats',
      description:
        'Access comprehensive team statistics to inform your coaching strategies.',
      image: step3SoccerCollect,
    },
    {
      label: '4. Scout and Analyze Players',
      description:
        'Evaluate and analyze player performance to make informed scouting decisions.',
      image: step4SoccerCollect,
    },
    {
      label: '5. Export Raw Data',
      description:
        'After the game, export the data for further analysis. Free users have a limit of one export per day, while Scorelect Pro users enjoy unlimited exports.',
      image: step5SoccerCollect,
    },
  ];

  const tips = [
    'Utilize the real-time analytics features to make informed decisions during the match.',
    'Regularly export and back up your data to prevent loss.',
    'Take advantage of customizable reports to focus on the metrics that matter most to your team.',
  ];

  return (
    <BlogContainer maxWidth="lg">
      <Typography variant="h3" gutterBottom style={{ color: '#FFFFFF' }}>
        Collecting Soccer Statistics on Amateur Games
      </Typography>
      <Typography variant="h6" color="#FFFFFF" paragraph>
        A comprehensive guide to collecting and analyzing soccer stats for non-professional & professional games using Scorelect.
      </Typography>

      <Typography variant="h5" gutterBottom style={{ color: '#FFFFFF' }}>
        Why Collect Soccer Statistics?
      </Typography>
      <Typography variant="body1" paragraph style={{ color: '#FFFFFF' }}>
        Collecting Soccer statistics is essential for understanding team performance, identifying strengths and weaknesses, and making informed decisions to improve gameplay. Whether you're a coach, player, or enthusiast, having access to accurate data can significantly enhance your strategic approach to the game.
      </Typography>

      <Box sx={{ width: '100%', marginTop: '40px' }}>
        <Stepper activeStep={-1} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={index}>
              <StepLabel>
                <Typography variant="h6" sx={{ color: '#FFFFFF' }}>
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body1" style={{ color: '#FFFFFF' }}>{step.description}</Typography>
                <Image src={step.image} alt={`Step ${index + 1}`} />
                {/* If using LazyLoadImage
                <LazyLoadImage
                  src={step.image}
                  alt={`Step ${index + 1}`}
                  effect="blur"
                />
                */}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Typography variant="h5" gutterBottom style={{ color: '#FFFFFF' }}>
        Best Practices for Data Collection
      </Typography>
      <Typography variant="body1" paragraph style={{ color: '#FFFFFF' }}>
        To ensure the effectiveness of your data collection process, consider the following best practices:
      </Typography>
      <TipsBox>
        <Typography variant="body1" component="ul">
          {tips.map((tip, index) => (
            <li key={index}>{tip}</li>
          ))}
        </Typography>
      </TipsBox>

      <Typography variant="h5" gutterBottom style={{ color: '#FFFFFF' }}>
        Getting Started with Scorelect
      </Typography>
      <Typography variant="body1" paragraph style={{ color: '#FFFFFF' }}>
        Scorelect offers an intuitive platform for collecting and analyzing Soccer statistics. Follow the steps outlined above to get started and make the most out of your data.
      </Typography>

      <Typography variant="h5" gutterBottom style={{ color: '#FFFFFF' }}>
        Additional Resources
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardMedia
              component="img"
              height="140"
              src="https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg" // Replace VIDEO_ID with actual ID
              alt="Tutorial Video"
              loading="lazy" // Enable lazy loading
            />
            <CardContent style={{ backgroundColor: '#FFFFFF' }}>
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
              src="/images/scorelect_documentation.jpg" // Ensure this image exists
              alt="Documentation"
              loading="lazy" // Enable lazy loading
            />
            <CardContent style={{ backgroundColor: '#FFFFFF' }}>
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

export default SoccerCollect;
