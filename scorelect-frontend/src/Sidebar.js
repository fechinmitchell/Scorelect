// src/Sidebar.js
import React from 'react';
import './Sidebar.css';

const Sidebar = ({ onNavigate, onLogout, onSportChange }) => {
  return (
    <div className="sidebar">
      <div className="user-info">
        <h2>Scorelect</h2>
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
    </div>
  );
};

export default Sidebar;


