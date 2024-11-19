import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { FaUserCircle } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext'; // Import useAuth

const Profile = ({ onLogout }) => {
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
  const handleWithdraw = () => {
    // Show a popup indicating the feature is coming soon
    Swal.fire('Coming Soon', 'We are working on this feature. It will be available soon!', 'info');
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

      {userData.role === 'paid' ? (
        <>
          <h3>Subscription Details</h3>
          <p>You are currently subscribed. Thank you for your support.</p>
          <button className="cancel-button" onClick={handleCancelSubscription}>
            Cancel Subscription
          </button>
        </>
      ) : (
        <>
          <p>
            You currently have no active subscription. Please subscribe to access premium features.
          </p>
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
