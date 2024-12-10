// src/SportSelectionPage.js

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './SportSelectionPage.css'; // Import the updated CSS
import logo from './images/scorelectlogo-2.png';
import backgroundImage from './images/scorlect-bg-2.jpg'; // Import the background image

const SportSelectionPage = ({ onSportSelect }) => {
  const navigate = useNavigate();

  const handleSportSelection = (sport) => {
    onSportSelect(sport); // Update state in App
    navigate('/'); // Redirect to the main page
  };

  return (
    <div
      className="sport-selection-container"
      style={{ backgroundImage: `url(${backgroundImage})` }} // Set background image inline
    >
      {/* Overlay to ensure readability */}
      <div className="overlay"></div>

      {/* Hero Section */}
      <div className="hero-content">
        <img src={logo} alt="Scorelect Logo" className="hero-logo" />
        <p className="hero-subtext">
          Select a sport to begin your professional analysis.
        </p>
      </div>

      {/* Sport Selection Grid */}
      <div className="sports-grid">
        <button onClick={() => handleSportSelection('Soccer')} aria-label="Select Soccer">
          Soccer
        </button>
        <button onClick={() => handleSportSelection('GAA')} aria-label="Select GAA">
          GAA
        </button>
        <button onClick={() => handleSportSelection('AmericanFootball')} aria-label="Select American Football">
          American Football
        </button>
        <button onClick={() => handleSportSelection('Basketball')} aria-label="Select Basketball">
          Basketball
        </button>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>&copy; 2024 Scorelect. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default SportSelectionPage;
