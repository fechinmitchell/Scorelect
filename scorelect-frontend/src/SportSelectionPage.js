import React from 'react';
import { useNavigate } from 'react-router-dom';
import './SportSelectionPage.css'; // Style the page
import logo from './assests/logo/scorelectlogo.jpeg';


const SportSelectionPage = ({ onSportSelect }) => {
  const navigate = useNavigate();

  const handleSportSelection = (sport) => {
    onSportSelect(sport); // Update state in App
    navigate('/'); // Redirect to the main page
  };

  return (
    <div className="sport-selection-container">
      {/* Hero Section */}
      <div className="hero">
      <img src={logo} alt="Scorelect Logo" className="logo" />
        <h1 className="tagline">Elevate Your Game</h1>
        <p className="subtext">
          Choose a sport to start analyzing your tactics like never before.
        </p>
      </div>

      {/* Sport Selection Buttons */}
      <div className="sport-buttons">
        <button onClick={() => handleSportSelection('Soccer')}>Soccer</button>
        <button onClick={() => handleSportSelection('GAA')}>GAA</button>
        <button onClick={() => handleSportSelection('AmericanFootball')}>
          American Football
        </button>
        <button onClick={() => handleSportSelection('Basketball')}>Basketball</button>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>&copy; 2024 Scorelect. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default SportSelectionPage;
