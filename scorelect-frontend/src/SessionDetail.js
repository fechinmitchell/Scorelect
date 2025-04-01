// SessionDetail.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Box, Typography, Card, CardMedia, CardContent, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

const db = getFirestore();

const DetailContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: '800px',
  margin: '0 auto',
  color: '#ffffff',
}));

const SessionDetail = () => {
  const { sessionId } = useParams(); // Get sessionId from URL
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionRef = doc(db, 'public_sessions', sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
          setSession({ id: sessionSnap.id, ...sessionSnap.data() });
        } else {
          console.error('Session not found');
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (!session) {
    return <Typography>Session not found.</Typography>;
  }

  return (
    <DetailContainer>
      <Button
        variant="contained"
        onClick={() => navigate('/')} // Navigate back to Sessions page
        sx={{ mb: 2, backgroundColor: '#5e2e8f' }}
      >
        Back to Sessions
      </Button>
      <Card sx={{ backgroundColor: '#444', color: '#ffffff' }}>
        <CardMedia
          component="img"
          height="200"
          image={session.image || 'https://via.placeholder.com/300x150?text=Session+Image'}
          alt={session.title}
        />
        <CardContent>
          <Typography variant="h4" sx={{ color: '#5e2e8f' }}>
            {session.title}
          </Typography>
          <Typography variant="body1">Time: {session.time}</Typography>
          <Typography variant="body1">Type: {session.type}</Typography>
          <Typography variant="body1">Creator: {session.creator}</Typography>
          <Typography variant="body1">Price: {session.price}</Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            Description: {session.description || 'No description provided.'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Created: {new Date(session.createdAt).toLocaleString()}
          </Typography>
        </CardContent>
      </Card>
    </DetailContainer>
  );
};

export default SessionDetail;