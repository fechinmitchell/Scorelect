// src/Sidebar.js
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Sidebar.css';
import logo from './assests/logo/scorelectlogo-grey.jpeg';
import Swal from 'sweetalert2';
import { useUser } from './UserContext';
import { auth } from './firebase';  // Import Firebase auth

const API_URL = process.env.REACT_APP_API_URL;

const Sidebar = ({ onNavigate, onLogout, onSportChange }) => {
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 768);
  const { userRole, setUserRole } = useUser();

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Function to fetch user data and navigate to profile
  const fetchUserData = async () => {
    const user = auth.currentUser;  // Get the current authenticated user from Firebase Auth
    
    // Log the current user to see if it's returning the correct user
    console.log("Current authenticated user:", user);
    
    if (user) {
      const uid = user.uid;  // Get the user ID (UID)
      console.log("User UID:", uid);

      try {
        const response = await fetch(`${API_URL}/get-user-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid })  // Send the UID in the request body
        });

        const data = await response.json();
        
        // Log the fetched user data
        console.log('User data fetched from Firestore:', data);

        // Set the user role in the context
        setUserRole(data.role);

        // Navigate to the profile page after fetching the data
        onNavigate('/profile');
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    } else {
      console.error('No user is logged in.');
    }
  };

  const handleAnalysisAccess = () => {
    if (userRole === 'free') {
      Swal.fire({
        title: 'Upgrade Required',
        text: 'Access to "Analysis" is a premium feature. Please upgrade to unlock this functionality.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Upgrade Now',
        cancelButtonText: 'Cancel',
      }).then((result) => {
        if (result.isConfirmed) {
          onNavigate('/signup');
        }
      });
    } else {
      onNavigate('/analysis');
    }
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button className="toggle-button" onClick={toggleSidebar}>
        {collapsed ? '☰' : '☰'}
      </button>
      {!collapsed && (
        <>
          <div className="user-info">
            <img src={logo} alt="Scorelect Logo" className="logo" />
            {userRole !== 'free' && <p>Pro User</p>}
          </div>
          <nav>
            <ul>
              <li>
                <label>
                  Select Sport:
                  <select onChange={(e) => onSportChange(e.target.value)} defaultValue="Soccer">
                    <option value="Soccer">Soccer</option>
                    <option value="GAA">GAA</option>
                    <option value="Basketball">Basketball</option>
                    <option value="AmericanFootball">American Football</option>
                  </select>
                </label>
              </li>
              <li><button onClick={() => onNavigate('/')}>Home</button></li>
              <li><button onClick={() => onNavigate('/saved-games')}>Saved Games</button></li>
              <li><button onClick={() => onNavigate('/howto')}>How To</button></li>
              <li><button onClick={handleAnalysisAccess}>Analysis</button></li>
              {/* Fetch user data when "Profile" is clicked */}
              <li><button onClick={fetchUserData}>Scorelect Pro</button></li>
              <li><button onClick={onLogout}>{userRole === 'free' ? 'Sign In' : 'Logout'}</button></li>
            </ul>
          </nav>
        </>
      )}
    </div>
  );
};

Sidebar.propTypes = {
  onNavigate: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onSportChange: PropTypes.func.isRequired,
};

export default Sidebar;
