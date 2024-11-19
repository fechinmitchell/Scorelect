// src/Profile.js

import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { FaUserCircle } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext'; // Import useAuth

const Profile = ({ onLogout, apiUrl }) => {
  const { currentUser, userData } = useAuth(); // Get currentUser and userData from context
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      console.log('User not authenticated, redirecting to sign-in page');
      navigate('/signin');
    }
  }, [currentUser, navigate]);

  /**
   * Handles withdrawal of earnings.
   */
  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount) || Number(withdrawAmount) <= 0) {
      Swal.fire('Error', 'Please enter a valid withdrawal amount.', 'error');
      return;
    }

    if (Number(withdrawAmount) > (userData?.earnings || 0)) {
      Swal.fire('Error', 'Withdrawal amount exceeds available earnings.', 'error');
      return;
    }

    try {
      const userDocRef = doc(firestore, 'users', currentUser.uid);

      // Update earnings in Firestore
      await updateDoc(userDocRef, {
        earnings: (userData?.earnings || 0) - Number(withdrawAmount),
      });

      setWithdrawAmount('');
      Swal.fire('Success', `Successfully withdrew $${withdrawAmount}.`, 'success');
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      Swal.fire('Error', 'Failed to process withdrawal.', 'error');
    }
  };

  const handleCancelSubscription = () => {
    const subject = encodeURIComponent('Cancel Subscription Request');
    const body = encodeURIComponent(
      `Hello,\n\nI would like to cancel my subscription. My email is ${currentUser.email}.\n\nThank you.`
    );
    const recipient = 'scorelectapp@gmail.com';

    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const handleRenewSubscription = () => {
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

  if (!userData) {
    return (
      <div className="profile-container">
        <p>Loading user data...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      <div className="user-info">
        <FaUserCircle className="avatar-icon" />
        <p>
          <strong>Email:</strong> {currentUser.email}
        </p>
      </div>
      <button onClick={handleLogoutInternal} className="logout-button">
        Logout
      </button>

      {userData.role === 'paid' ? ( // Check for 'paid' instead of 'premium'
        <>
          <h3>Subscription Details</h3>
          <p>You are currently subscribed. Thank you for your support.</p>
          <button className="cancel-button" onClick={handleCancelSubscription}>
            Cancel Subscription
          </button>
        </>
      ) : (
        <>
          <p>You currently have no active subscription. Please subscribe to access premium features.</p>
          <button className="renew-button" onClick={handleRenewSubscription}>
            Subscribe
          </button>
        </>
      )}

      {/* Earnings Section */}
      <h3>Earnings</h3>
      <p>
        <strong>Total Earnings:</strong> ${userData.earnings ? userData.earnings.toFixed(2) : '0.00'}
      </p>
      <div className="withdraw-section">
        <input
          type="number"
          placeholder="Enter amount to withdraw"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          min="0.01"
          step="0.01"
        />
        <button onClick={handleWithdraw} className="withdraw-button">
          Withdraw
        </button>
      </div>
    </div>
  );
};

export default Profile;
