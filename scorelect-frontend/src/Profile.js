// src/Profile.js

import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { firestore } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // Added updateDoc for withdrawal
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { FaUserCircle } from 'react-icons/fa'; // Import a user avatar icon
import Swal from 'sweetalert2';

const Profile = ({ onLogout, apiUrl }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // State for user role
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [earnings, setEarnings] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (currentUser) {
      setUser(currentUser);
      // Fetch user role and earnings from Firestore
      fetchUserData(currentUser.uid);
    } else {
      console.log('User not authenticated, redirecting to sign-in page');
      // If user is not authenticated, redirect to sign-in page
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
        setUserRole(userData.role); // Set the user role (paid/free)
        setEarnings(userData.earnings || 0); // Set earnings, default to 0
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

  /**
   * Handles withdrawal of earnings.
   */
  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount) || Number(withdrawAmount) <= 0) {
      Swal.fire('Error', 'Please enter a valid withdrawal amount.', 'error');
      return;
    }

    if (Number(withdrawAmount) > earnings) {
      Swal.fire('Error', 'Withdrawal amount exceeds available earnings.', 'error');
      return;
    }

    try {
      const auth = getAuth();
      const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
      
      // Update earnings in Firestore
      await updateDoc(userDocRef, {
        earnings: earnings - Number(withdrawAmount),
      });

      setEarnings(earnings - Number(withdrawAmount));
      setWithdrawAmount('');
      Swal.fire('Success', `Successfully withdrew $${withdrawAmount}.`, 'success');
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      Swal.fire('Error', 'Failed to process withdrawal.', 'error');
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
    window.location.href = `https://buy.stripe.com/9AQcQEbrCdMJ5567ss`;
  };

  const handleLogoutInternal = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      if (onLogout) onLogout();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
      Swal.fire('Error', 'Error signing out: ' + error.message, 'error');
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
          <button onClick={handleLogoutInternal} className="logout-button">Logout</button>

          {userRole === 'premium' ? (
            <>
              <h3>Subscription Details</h3>
              <p>You are currently subscribed. Thank you for your support.</p>
              <button className="cancel-button" onClick={handleCancelSubscription}>Cancel Subscription</button>
            </>
          ) : (
            <>
              <p>You currently have no active subscription. Please subscribe to access premium features.</p>
              <button className="renew-button" onClick={handleRenewSubscription}>Subscribe</button>
            </>
          )}

          {/* Earnings Section */}
          <h3>Earnings</h3>
          <p><strong>Total Earnings:</strong> ${earnings.toFixed(2)}</p>
          <div className="withdraw-section">
            <input
              type="number"
              placeholder="Enter amount to withdraw"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              min="0.01"
              step="0.01"
            />
            <button onClick={handleWithdraw} className="withdraw-button">Withdraw</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Profile;
