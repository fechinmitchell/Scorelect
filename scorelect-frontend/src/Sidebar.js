// Sidebar.js
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Sidebar.css';
import logo from './assests/logo/scorelectlogo-grey.jpeg';
import Swal from 'sweetalert2';
import { useUser } from './UserContext';
import { useAuth } from './AuthContext';
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
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';

const API_URL = process.env.REACT_APP_API_URL;

const Sidebar = ({ onNavigate, onLogout, onSportChange, selectedSport }) => {
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 768);
  const { userRole, setUserRole } = useUser();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [permissions, setPermissions] = useState({});

  // Fetch permission settings (including "analysis") from Firestore
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const settingsRef = doc(firestore, 'adminSettings', 'config');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setPermissions(settingsSnap.data().permissions || {});
        } else {
          console.log('No settings found; defaulting analysis permission to 0 (all users)');
          setPermissions({ analysis: 0 });
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      }
    };
    fetchPermissions();
  }, []);

  // Handle logo clicks: triple-click triggers admin login, single-click navigates to sport selection.
  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);
    setTimeout(() => setLogoClickCount(0), 1500);
    if (newCount >= 3) {
      onNavigate('/admin-login');
    } else {
      onNavigate('/select-sport');
    }
  };

  const toggleSidebar = () => setCollapsed(!collapsed);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (user) {
      setLoading(true);
      const uid = user.uid;
      try {
        const response = await fetch(`${API_URL}/get-user-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid }),
        });
        const data = await response.json();
        setUserRole(data.role);
        onNavigate('/profile');
      } catch (error) {
        console.error('Error fetching user data:', error);
        Swal.fire('Error', 'Could not fetch user data.', 'error');
      } finally {
        setLoading(false);
      }
    } else {
      onNavigate('/signin');
    }
  };

  // Check whether the current user is allowed to access Analysis.
  // Permission levels:
  //   0 = All users (including non-logged-in),
  //   1 = Only free users (logged in as "free"),
  //   2 = Only premium users.
  const hasAnalysisAccess = () => {
    const analysisPermission = permissions['analysis'] || 0;
    if (analysisPermission === 0) return true;
    if (analysisPermission > 0 && !currentUser) return false;
    if (analysisPermission === 1 && userRole === 'free') return true;
    if (analysisPermission === 2 && userRole === 'premium') return true;
    return false;
  };

  const handleAnalysisAccess = () => {
    if (!hasAnalysisAccess()) {
      Swal.fire('Authentication Required', 'Please sign in to access the Analysis page.', 'warning')
        .then(() => onNavigate('/signin'));
      return;
    }
    if (selectedSport) {
      if (selectedSport.toUpperCase() === 'SOCCER') {
        onNavigate('/analysis');
      } else if (selectedSport.toUpperCase() === 'GAA') {
        onNavigate('/analysis-gaa');
      } else {
        Swal.fire('Sport Not Supported', 'Analysis is available only for Soccer and GAA.', 'info');
      }
    } else {
      Swal.fire('Select Sport', 'Please select a sport from the dropdown.', 'warning');
    }
  };

  const handleTrainingClick = () => onNavigate('/training');

  const handleScoutingClick = () => {
    Swal.fire({
      title: 'Coming Soon!',
      text: 'Scouting is under development.',
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
            onClick={handleLogoClick}
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
                  <select value={selectedSport} onChange={(e) => onSportChange(e.target.value)}>
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
            <button onClick={fetchUserData} className={`profile-button ${loading ? 'loading' : ''}`}>
              <FaUserCircle className="icon" size={16} />
              {!collapsed && (loading ? 'Loading...' : 'Profile')}
            </button>
          </li>
          <li>
            <button onClick={onLogout}>
              {userRole === 'free' ? <FaSignInAlt className="icon" size={16} /> : <FaSignOutAlt className="icon" size={16} />}
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
