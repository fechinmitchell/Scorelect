import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { firestore } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

const Profile = ({ onLogout }) => {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (currentUser) {
      setUser(currentUser);
      fetchUserSubscription(currentUser.uid);
    } else {
      navigate('/signin');
    }
  }, [navigate]);

  const fetchUserSubscription = async (uid) => {
    try {
      const userDoc = await getDoc(doc(firestore, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.subscriptionId) {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/get-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ subscriptionId: userData.subscriptionId }),
          });
  
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
  
          const subscriptionData = await response.json();
          if (subscriptionData.error) {
            console.error('Subscription error:', subscriptionData.error);
          } else {
            setSubscription(subscriptionData);
          }
        } else {
          setSubscription(null);
        }
      } else {
        console.log('User document not found');
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId: subscription.id, uid: user.uid }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        console.error(result.error);
      } else {
        alert('Subscription canceled');
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
    }
  };

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      onLogout();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      {user && (
        <>
          <p>Email: {user.email}</p>
          <button onClick={handleLogout} className="logout-button">Logout</button>
          {subscription ? (
            <>
              <h3>Subscription Details</h3>
              <p>Status: {subscription.status}</p>
              <p>Next Billing Date: {new Date(subscription.current_period_end * 1000).toLocaleDateString()}</p>
              <button className="cancel-button" onClick={handleCancelSubscription}>Cancel Subscription</button>
            </>
          ) : (
            <p>You currently have no active subscription. Please contact support for any issues.</p>
          )}
        </>
      )}
    </div>
  );
};

export default Profile;
