// src/Profile.js
import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { firestore } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { FaUserCircle } from 'react-icons/fa'; // Import a user avatar icon

const Profile = ({ onLogout }) => {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    // Extract 'session_id' and 'uid' from URL query parameters
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id');
    const urlUid = query.get('uid'); // 'uid' passed as query param in success_url

    if (currentUser) {
      setUser(currentUser);

      // Determine which UID to use: from URL or from auth
      const uidToUse = urlUid || currentUser.uid;

      if (sessionId && urlUid) {
        // If redirected from Stripe Checkout with session_id and uid in URL
        // Fetch and update subscription
        fetchUserSubscription(uidToUse, sessionId);
        // Optionally remove query params from URL
        navigate('/profile', { replace: true });
      } else {
        // Regular profile access
        fetchUserSubscription(uidToUse);
      }
    } else {
      // If user is not authenticated, redirect to sign-in page
      navigate('/signin');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchUserSubscription = async (uid, sessionId = null) => {
    setLoading(true);
    setError(null);
    try {
      const userDoc = await getDoc(doc(firestore, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.subscriptionId) {
          const payload = { subscriptionId: userData.subscriptionId };
          if (sessionId) {
            payload.session_id = sessionId;
          }

          const response = await fetch(`${process.env.REACT_APP_API_URL}/get-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const subscriptionData = await response.json();

          if (subscriptionData.error) {
            console.error('Subscription error:', subscriptionData.error);
            setError(subscriptionData.error);
          } else {
            console.log('Fetched subscription data:', subscriptionData);
            setSubscription(subscriptionData);
          }
        } else {
          setSubscription(null);
        }
      } else {
        console.log('User document not found');
        setError('User data not found.');
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !subscription.id) {
      alert('No active subscription to cancel.');
      return;
    }

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
        alert('Error canceling subscription: ' + result.error);
      } else {
        alert('Subscription canceled successfully.');
        // Fetch updated subscription data
        await fetchUserSubscription(user.uid);
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert('Error canceling subscription: ' + error.message);
    }
  };

  const handleRenewSubscription = () => {
    // Redirect the user to the Stripe payment link
    window.location.href = 'https://buy.stripe.com/9AQcQEbrCdMJ5567ss'; // Replace with your actual link
  };

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      onLogout();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Error signing out: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      {error && <div className="error-message">{error}</div>}
      {user && (
        <>
          <div className="user-info">
            <FaUserCircle className="avatar-icon" />
            <p><strong>Email:</strong> {user.email}</p>
          </div>
          <button onClick={handleLogout} className="logout-button">Logout</button>
          {subscription ? (
            <>
              <h3>Subscription Details</h3>
              <p><strong>Status:</strong> {subscription.status}</p>
              <p><strong>Next Billing Date:</strong> {new Date(subscription.current_period_end * 1000).toLocaleDateString()}</p>
              {subscription.status === 'active' ? (
                <button className="cancel-button" onClick={handleCancelSubscription}>Cancel Subscription</button>
              ) : (
                <button className="renew-button" onClick={handleRenewSubscription}>Renew Subscription</button>
              )}
            </>
          ) : (
            <>
              <p>You currently have no active subscription. Please subscribe to access premium features.</p>
              <button className="renew-button" onClick={handleRenewSubscription}>Subscribe</button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Profile;
