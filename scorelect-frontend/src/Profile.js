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

      // Check if redirected from Checkout
      const query = new URLSearchParams(window.location.search);
      const sessionId = query.get('session_id');
      if (sessionId) {
        // Handle successful subscription
        fetchUserSubscription(currentUser.uid);
        // Optionally remove session_id from URL
        navigate('/profile', { replace: true });
      }
    } else {
      navigate('/signin');
    }
  }, [navigate]);

  const fetchUserSubscription = async (uid) => {
    setLoading(true);
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
            console.log('Fetched subscription data:', subscriptionData);
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
        alert('Error canceling subscription: ' + result.error);
      } else {
        alert('Subscription canceled');
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
    window.location.href = 'https://buy.stripe.com/9AQcQEbrCdMJ5567ss';
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
              {console.log('Subscription status:', subscription.status)}
              {subscription.status === 'active' && (
                <button className="cancel-button" onClick={handleCancelSubscription}>Cancel Subscription</button>
              )}
              {(subscription.status === 'canceled' || subscription.status !== 'active') && (
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
