// src/Sidebar.js

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Sidebar.css';
import logo from './assests/logo/scorelectlogo-grey.jpeg';
import Swal from 'sweetalert2';
import { useUser } from './UserContext';
import { auth } from './firebase';  // Import Firebase auth

const API_URL = process.env.REACT_APP_API_URL;

const Sidebar = ({ onNavigate, onLogout, onSportChange, selectedSport }) => { // Receive selectedSport as a prop
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 768);
  const { userRole, setUserRole } = useUser();
  const [loading, setLoading] = useState(false);  // Add loading state

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
    if (user) {
      setLoading(true);  // Set loading to true when fetching starts
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
        console.log('User data fetched from Firestore:', data);

        // Set the user role in the context
        setUserRole(data.role);

        // Check user role and navigate accordingly
        if (data.role === 'free') {
          onNavigate('/signup');  // Navigate to the signup page
        } else {
          onNavigate('/profile');  // Navigate to the profile page
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);  // Set loading to false after data fetching is done
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
      <>
        <div className="user-info">
          <img src={logo} alt="Scorelect Logo" className="logo" />
          {userRole !== 'free' && <p></p>}
        </div>
        <nav>
          <ul>
            <li>
              <label>
                Select Sport:
                <select 
                  value={selectedSport} // Make the select a controlled component
                  onChange={(e) => onSportChange(e.target.value)}
                >
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
            {/* <li><button onClick={() => onNavigate('/sports-datahub')}>Sports Data Hub</button></li> */}
            <li><button onClick={handleAnalysisAccess}>Analysis</button></li>
            {/* Fetch user data when "Profile" is clicked */}
            <li>
              <button onClick={fetchUserData} className={`scorelect-pro-button ${loading ? 'loading' : ''}`}>
                {loading ? 'Loading...' : 'Scorelect Pro'}
              </button>
            </li>
            <li><button onClick={onLogout}>{userRole === 'free' ? 'Sign In' : 'Logout'}</button></li>
          </ul>
        </nav>
      </>
    </div>
  );
};

Sidebar.propTypes = {
  onNavigate: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onSportChange: PropTypes.func.isRequired,
  selectedSport: PropTypes.string.isRequired, // Ensure selectedSport is passed as a string
};

export default Sidebar;
