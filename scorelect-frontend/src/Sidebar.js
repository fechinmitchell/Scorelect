import React, { useState, useEffect } from 'react';
import './Sidebar.css';
import logo from './assests/logo/scorelectlogo-grey.jpeg';

const Sidebar = ({ onNavigate, onLogout, onSportChange }) => {
  const [collapsed, setCollapsed] = useState(window.innerWidth <= 768);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  // Automatically collapse sidebar on window resize
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
        {collapsed ? '=' : '='}
      </button>
      {!collapsed && (
        <>
          <div className="user-info">
            <img src={logo} alt="Scorelect Logo" className="logo" />
          </div>
          <nav>
            <ul>
              <li>
                <label>
                  Select Sport:
                  <select onChange={(e) => onSportChange(e.target.value)}>
                    <option value="GAA">GAA</option>
                    <option value="Soccer">Soccer</option>
                  </select>
                </label>
              </li>
              <li><button onClick={() => onNavigate('home')}>Home</button></li>
              <li><button onClick={() => onNavigate('saved-games')}>Saved Games</button></li>
              <li><button onClick={onLogout}>Logout</button></li>
            </ul>
          </nav>
        </>
      )}
    </div>
  );
};

export default Sidebar;
