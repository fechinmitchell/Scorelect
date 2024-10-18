// src/blogs/AmericanFootballCollect.js

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
  background-color: #5e2e8f;
  padding: 20px;
  border-left: 5px solid #17a2b8;
  margin: 20px 0;
`;

const AmericanFootballCollect = () => {
  const steps = [
    {
      label: '1. Select the Sport',
      description:
        'Navigate to the sidebar and choose American Football from the drop-down menu.',
      image: "", // Add your image path here
    },
    {
      label: '2. Click on Action Button then on the Field to Record Event',
      description:
        'In the instructions section, click on an action button like "Touchdown" or "Interception". Then, click on the specific location on the field where the event occurred.',
      image: "", // Add your image path here
    },
    {
      label: '3. Fill in Action Details',
      description:
        'A popup will appear after clicking the field. Enter the necessary details in the popup and click "Submit" to record the event.',
      image: "", // Add your image path here
    },
    {
      label: '4. Wrong Action/Location?',
      description:
        'If you need to remove an incorrect marker, use the "Undo Last Marker" button located at the bottom of the sidebar.',
      image: "", // Add your image path here
    },
    {
      label: '5. Export Raw Data',
      description:
        'After the game, export your data for further analysis. Free users are limited to one export per day, while Scorelect Pro users enjoy unlimited exports.',
      image: "", // Add your image path here
    },
  ];

  const tips = [
    'Leverage real-time analytics to make strategic decisions during the game.',
    'Regularly export and back up your data to prevent any loss of information.',
    'Utilize customizable reports to focus on the most relevant metrics for your team’s performance.',
  ];

  return (
    <BlogContainer maxWidth="lg">
      <Typography variant="h3" gutterBottom>
        Collecting American Football Statistics on Amateur Games
      </Typography>
      <Typography variant="subtitle1" color="#5E2E8F" paragraph>
        A comprehensive guide to collecting and analyzing American Football stats for non-professional games using Scorelect.
      </Typography>

      <Image src="/images/american_football_stats_banner.jpg" alt="American Football Statistics" />

      <Typography variant="h5" gutterBottom>
        Why Collect American Football Statistics?
      </Typography>
      <Typography variant="body1" paragraph>
        Collecting American Football statistics is crucial for understanding team performance, identifying strengths and weaknesses, and making informed decisions to enhance gameplay. Whether you're a coach, player, or enthusiast, access to accurate data can significantly improve your strategic approach to the game.
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
                <Typography variant="body1">{step.description}</Typography>
                {step.image && <Image src={step.image} alt={`Step ${index + 1}`} />}
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
        <Typography variant="body1" component="ul" sx={{ color: '#FFFFFF' }}>
          {tips.map((tip, index) => (
            <li key={index}>{tip}</li>
          ))}
        </Typography>
      </TipsBox>

      <Typography variant="h5" gutterBottom>
        Getting Started with Scorelect
      </Typography>
      <Typography variant="body1" paragraph>
        Scorelect offers an intuitive platform for collecting and analyzing American Football statistics. Follow the steps outlined above to get started and maximize your data insights.
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

export default AmericanFootballCollect;
