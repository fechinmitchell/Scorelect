// src/components/Profile.js

import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { firestore } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { FaUserCircle } from 'react-icons/fa'; // User avatar icon
import Swal from 'sweetalert2';

const Profile = ({ onLogout }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [earnings, setEarnings] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (currentUser) {
      setUser(currentUser);
      fetchUserData(currentUser.uid);
    } else {
      console.log('User not authenticated, redirecting to sign-in page');
      navigate('/signin');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchUserData = async (uid) => {
    setLoading(true);
    setError(null);
    console.log('Fetching user data for UID:', uid);
    try {
      const userDocRef = doc(firestore, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('User data retrieved from Firestore:', userData);
        setUserRole(userData.role);
        setEarnings(userData.earnings || 0);
      } else {
        console.log('User document not found');
        setError('User data not found.');
        setUserRole(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError(error.message);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    const subject = encodeURIComponent("Cancel Subscription Request");
    const body = encodeURIComponent(`Hello,\n\nI would like to cancel my subscription. My email is ${user.email}.\n\nThank you.`);
    const recipient = "scorelectapp@gmail.com";

    // Open the user's default email client with pre-filled subject and body
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const handleRenewSubscription = () => {
    // Redirect the user to the Stripe payment link with uid as query param
    window.location.href = `https://buy.stripe.com/your_payment_link_here`;
  };

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      if (onLogout) onLogout();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Error signing out: ' + error.message);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
      Swal.fire('Invalid Amount', 'Please enter a valid withdrawal amount.', 'warning');
      return;
    }

    if (withdrawAmount > earnings) {
      Swal.fire('Insufficient Funds', 'You do not have enough earnings to withdraw this amount.', 'error');
      return;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        Swal.fire('Error', 'User not authenticated.', 'error');
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/withdraw-earnings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: user.uid, amount: parseFloat(withdrawAmount) }),
      });

      const result = await response.json();

      if (response.ok) {
        Swal.fire('Success', `Successfully withdrew $${withdrawAmount}.`, 'success');
        setEarnings(result.newEarnings);
        setWithdrawAmount('');
      } else {
        throw new Error(result.error || 'Failed to withdraw earnings.');
      }
    } catch (error) {
      console.error('Error withdrawing earnings:', error);
      Swal.fire('Error', error.message || 'Failed to withdraw earnings.', 'error');
    }
  };

  const apiUrl = process.env.REACT_APP_API_URL;

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

          {userRole === 'premium' ? (
            <>
              <h3>Subscription Details</h3>
              <p>You are currently subscribed. Thank you for your support.</p>
              <button className="cancel-button" onClick={handleCancelSubscription}>Cancel Subscription</button>

              <h3>Earnings</h3>
              <p><strong>Total Earnings:</strong> ${earnings.toFixed(2)}</p>

              <div className="withdraw-section">
                <h4>Withdraw Earnings</h4>
                <input
                  type="number"
                  min="0"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount to withdraw"
                />
                <button onClick={handleWithdraw} className="withdraw-button">Withdraw</button>
              </div>
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

