// src/Sidebar.js
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Sidebar.css';
import logo from './assests/logo/scorelectlogo-grey.jpeg';

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

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button className="toggle-button" onClick={toggleSidebar}>
        {collapsed ? '☰' : '×'} {/* Changed symbols for better UX */}
      </button>
      {!collapsed && (
        <>
          <div className="user-info">
            <img src={logo} alt="Scorelect Logo" className="logo" />
            {/* {userType !== 'free' && <p>Pro User</p>} Display user type */}
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
              <li><button onClick={() => onNavigate('/analysis')}>Analysis</button></li>
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
