// src/Sidebar.js
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Sidebar.css';
import logo from './assests/logo/scorelectlogo-grey.jpeg';
import Swal from 'sweetalert2';

const Sidebar = ({ onNavigate, onLogout, onSportChange, userType }) => {
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 768);

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

  const handleAnalysisAccess = () => {
    if (userType === 'free') {
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
        {collapsed ? '☰' : '☰'} {/* Changed symbols for better UX */}
      </button>
      {!collapsed && (
        <>
          <div className="user-info">
            <img src={logo} alt="Scorelect Logo" className="logo" />
            {/* Display user type */}
            {userType !== 'free' && <p>Pro User</p>}
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
              {/* Render Analysis button based on user type */}
              <li>
                <button onClick={handleAnalysisAccess}>Analysis</button>
              </li>
              <li><button onClick={() => onNavigate('/profile')}>Scorelect Pro</button></li>
              {/* Add more navigation buttons as needed */}
              <li><button onClick={onLogout}>{userType === 'free' ? 'Sign In' : 'Logout'}</button></li>
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
  userType: PropTypes.string.isRequired,
};

export default Sidebar;
