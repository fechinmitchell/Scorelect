import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { FaUserCircle, FaCrown } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext'; // Import useAuth

const Profile = ({ onLogout }) => {
  const { currentUser, userData } = useAuth(); // Get currentUser and userData from context
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false); // State for loading indicator
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      console.log('User not authenticated, redirecting to sign-in page');
      navigate('/signin');
    }
    
    // Handle sidebar profile button interaction if it exists
    const sidebarProfileBtn = document.querySelector('.sidebar-profile-btn');
    if (sidebarProfileBtn) {
      sidebarProfileBtn.addEventListener('click', () => {
        navigate('/profile');
      });
      
      // Clean up event listener
      return () => {
        sidebarProfileBtn.removeEventListener('click', () => {
          navigate('/profile');
        });
      };
    }
  }, [currentUser, navigate]);

  /**
   * Handles withdrawal of earnings.
   */
  const handleWithdraw = () => {
    // Show a popup indicating the feature is coming soon
    Swal.fire('Coming Soon', 'We are working on this feature. It will be available soon!', 'info');
  };

  // Force refresh subscription status
  const forceRefreshSubscription = async () => {
    try {
      setIsLoading(true);
      
      // Prepare request data - include stripe customer ID if available
      const requestData = {
        uid: currentUser.uid,
        email: currentUser.email
      };
      
      // Add stripeCustomerId if present
      if (userData && userData.stripeCustomerId) {
        requestData.stripeCustomerId = userData.stripeCustomerId;
      }
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/refresh-subscription-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (response.ok) {
        Swal.fire({
          title: 'Success', 
          text: 'Subscription status refreshed.', 
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          // Force reload user data from context
          window.location.reload();
        });
      } else {
        // Try to get more detailed error message
        try {
          const errorData = await response.json();
          Swal.fire('Error', errorData.error || 'Failed to refresh subscription status.', 'error');
        } catch (e) {
          Swal.fire('Error', 'Failed to refresh subscription status.', 'error');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      Swal.fire('Error', 'An error occurred while refreshing your subscription status.', 'error');
    } finally {
      setIsLoading(false);
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

  // Update sidebar profile button if it exists
  const updateSidebarProfileButton = () => {
    const sidebarProfileBtn = document.querySelector('.sidebar-profile-btn');
    const profileNameElement = sidebarProfileBtn ? sidebarProfileBtn.querySelector('.profile-name') : null;
    
    if (profileNameElement && currentUser && currentUser.displayName) {
      profileNameElement.textContent = currentUser.displayName;
    } else if (profileNameElement && currentUser) {
      // If no display name, use email or UID
      profileNameElement.textContent = currentUser.email || currentUser.uid.substring(0, 8);
    }
  };

  // Call the update function when component mounts
  useEffect(() => {
    if (currentUser) {
      updateSidebarProfileButton();
    }
  }, [currentUser]);

  if (!userData) {
    return (
      <div className="profile-container">
        <div className="spinner"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      <div className="profile-user-info">
        <FaUserCircle className="avatar-icon" />
        <p>
          <strong>Email:</strong> {currentUser.email}
        </p>
      </div>

      {userData.role === 'paid' ? (
        <div className="subscription-section">
          <div className="premium-badge">
            <FaCrown /> Premium Account
          </div>
          <h3>Subscription Details</h3>
          <p>You are currently subscribed. Thank you for your support.</p>
          <button className="cancel-button" onClick={handleCancelSubscription}>
            Cancel Subscription
          </button>
        </div>
      ) : (
        <div className="subscription-section">
          <h3>Subscription Details</h3>
          <p>
            You currently have no active subscription. Please subscribe to access premium features.
          </p>
          <button className="renew-button" onClick={handleRenewSubscription}>
            Subscribe
          </button>
        </div>
      )}

      {/* <button 
        onClick={forceRefreshSubscription} 
        className="refresh-button"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <div className="spinner"></div> Refreshing...
          </>
        ) : (
          'Refresh Status'
        )}
      </button> */}

      <button onClick={handleLogoutInternal} className="logout-button">
        Logout
      </button>

      {/* Debug Information - Uncomment for troubleshooting */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <h4>Debug Information</h4>
          <pre>{JSON.stringify({
            uid: currentUser?.uid,
            stripeCustomerId: userData?.stripeCustomerId || 'Not set',
            role: userData?.role || 'Not set',
            email: currentUser?.email
          }, null, 2)}</pre>
        </div>
      )} */}
    </div>
  );
};

export default Profile;