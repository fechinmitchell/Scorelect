import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Sidebar.css';
import logo from './assests/logo/scorelectlogo-grey.jpeg';
import Swal from 'sweetalert2';
import { useUser } from './UserContext';
import { auth } from './firebase';
import {
  FaHome,
  FaSave,
  FaQuestionCircle,
  FaDatabase,
  FaChartBar,
  FaChalkboardTeacher,
  FaSignOutAlt,
  FaSignInAlt,
  FaUserCircle,
  FaChevronLeft,
  FaChevronRight,
  FaChartLine,
} from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL;

const Sidebar = ({ onNavigate, onLogout, onSportChange, selectedSport }) => {
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 768);
  const { userRole, setUserRole } = useUser();
  const [loading, setLoading] = useState(false);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Fetch user data and go to profile
  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (user) {
      setLoading(true);
      const uid = user.uid;
      console.log('User UID:', uid);

      try {
        const response = await fetch(`${API_URL}/get-user-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid }),
        });

        const data = await response.json();
        console.log('User data fetched from Firestore:', data);

        // Set the user role in the context
        setUserRole(data.role);

        // Navigate to profile page
        onNavigate('/profile');
      } catch (error) {
        console.error('Error fetching user data:', error);
        Swal.fire('Error', 'Could not fetch user data. Please try again later.', 'error');
      } finally {
        setLoading(false);
      }
    } else {
      console.error('No user is logged in.');
      onNavigate('/signin');
    }
  };

  // Updated handleAnalysisAccess without premium check
  const handleAnalysisAccess = () => {
    if (selectedSport && selectedSport.toUpperCase() === 'SOCCER') {
      onNavigate('/analysis'); // Regular analysis for Soccer
    } else if (selectedSport && selectedSport.toUpperCase() === 'GAA') {
      onNavigate('/analysis-gaa'); // Navigate to AnalysisGAA page for GAA
    } else {
      Swal.fire(
        'Sport Not Supported',
        'The advanced analysis dashboard is currently available only for Soccer and GAA. Please select one of these sports.',
        'info'
      );
    }
  };

  const handleTrainingClick = () => {
    // Navigate directly to the training page
    onNavigate('/training');
  };

  const handleScoutingClick = () => {
    Swal.fire({
      title: 'Coming Soon!',
      text: 'The Scouting feature is under development and will be available soon.',
      icon: 'info',
      confirmButtonText: 'OK',
    });
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button className="toggle-button" onClick={toggleSidebar}>
        {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
      </button>
      {!collapsed && (
        <div className="user-info">
          <img
            src={logo}
            alt="Scorelect Logo"
            className="logo"
            onClick={() => onNavigate('/select-sport')}
            style={{ cursor: 'pointer' }}
          />
        </div>
      )}
      <nav>
        <ul>
          <li>
            <div className="sport-select-label">
              {!collapsed && (
                <>
                  <div className="select-sport-text">Select Sport:</div>
                  <select
                    value={selectedSport}
                    onChange={(e) => onSportChange(e.target.value)}
                  >
                    <option value="Soccer">Soccer</option>
                    <option value="GAA">GAA</option>
                    <option value="Basketball">Basketball</option>
                    <option value="AmericanFootball">American Football</option>
                  </select>
                </>
              )}
            </div>
          </li>
          <li>
            <button onClick={() => onNavigate('/')}>
              <FaHome className="icon" size={16} />
              {!collapsed && 'Home'}
            </button>
          </li>
          <li>
            <button onClick={() => onNavigate('/saved-games')}>
              <FaSave className="icon" size={16} />
              {!collapsed && 'Saved Games'}
            </button>
          </li>
          <li>
            <button onClick={() => onNavigate('/howto')}>
              <FaQuestionCircle className="icon" size={16} />
              {!collapsed && 'How To'}
            </button>
          </li>
          <li className="separator">{!collapsed && 'Analytics'}</li>
          <li>
            <button onClick={handleTrainingClick}>
              <FaChalkboardTeacher className="icon" size={16} />
              {!collapsed && 'Training'}
            </button>
          </li>
          <li>
            {selectedSport === 'GAA' ? (
              <button onClick={() => onNavigate('/player-data-gaa')}>
                <FaChartLine className="icon" size={16} />
                {!collapsed && 'Player Data'}
              </button>
            ) : (
              <button onClick={handleScoutingClick}>
                <FaChartLine className="icon" size={16} />
                {!collapsed && 'Scouting'}
              </button>
            )}
          </li>
          
          <li>
            <button onClick={() => onNavigate('/team-data-gaa')}>
              <FaDatabase className="icon" size={16} />
              {!collapsed && 'Team Data'}
            </button>
          </li>
          <li>
            <button onClick={handleAnalysisAccess}>
              <FaChartBar className="icon" size={16} />
              {!collapsed && 'Analysis'}
            </button>
          </li>
          <li className="separator">{!collapsed && 'Account'}</li>
          <li>
            <button
              onClick={fetchUserData}
              className={`profile-button ${loading ? 'loading' : ''}`}
            >
              <FaUserCircle className="icon" size={16} />
              {!collapsed && (loading ? 'Loading...' : 'Profile')}
            </button>
          </li>
          <li>
            <button onClick={onLogout}>
              {userRole === 'free' ? (
                <FaSignInAlt className="icon" size={16} />
              ) : (
                <FaSignOutAlt className="icon" size={16} />
              )}
              {!collapsed && (userRole === 'free' ? 'Sign In' : 'Logout')}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

Sidebar.propTypes = {
  onNavigate: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onSportChange: PropTypes.func.isRequired,
  selectedSport: PropTypes.string.isRequired,
};

export default Sidebar;
