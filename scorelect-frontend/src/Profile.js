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

      {/* Update the subscription section to show all features are available */}
      <div className="subscription-section">
        <div className="premium-badge">
          <FaCrown /> Full Access Account
        </div>
        <h3>Account Status</h3>
        <p>You have full access to all features. Enjoy using Scorelect!</p>
        <br/>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          All features are now available to all users including saved games, analysis tools, and more.
        </p>
      </div>

      <button onClick={handleLogoutInternal} className="logout-button">
        Logout
      </button>
    </div>
  );
};

export default Profile;