// src/SportSelectionPage.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SportSelectionPage.css'; // Import the updated CSS
import logo from './images/scorelectlogo-2.png';
import backgroundImage from './images/scorlect-bg-2.jpg'; // Import the background image

const SportSelectionPage = ({ onSportSelect }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true); // Initialize loading state
  const [fadeOut, setFadeOut] = useState(false); // State to handle fade-out animation

  const handleSportSelection = (sport) => {
    onSportSelect(sport); // Update state in App
    navigate('/'); // Redirect to the main page
  };

  useEffect(() => {
    // Preload the background image
    const img = new Image();
    img.src = backgroundImage;

    // Create a promise that resolves when the image is loaded or fails to load
    const imageLoaded = new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // Resolve even on error to avoid infinite loading
    });

    // Create a promise that resolves after 1 second
    const timer = new Promise((resolve) => setTimeout(resolve, 1000));

    // Wait for both the image to load and the timer to complete
    Promise.all([imageLoaded, timer]).then(() => {
      setFadeOut(true); // Start fade-out animation
      // Wait for fade-out animation to complete before hiding the loading screen
      setTimeout(() => {
        setLoading(false);
      }, 500); // Duration matches the fadeOut animation (0.5s)
    });
  }, [backgroundImage]);

  return (
    <div
      className="sport-selection-container"
      style={{ backgroundImage: `url(${backgroundImage})` }} // Set background image inline
    >
      {/* Loading Screen */}
      {loading && (
        <div className={`loading-overlay ${fadeOut ? 'fade-out' : ''}`} aria-live="assertive">
          <img src={logo} alt="Scorelect Logo" className="loading-logo" />
          <div className="loading-spinner" aria-hidden="true"></div>
          <p className="loading-text">Loading...</p>
        </div>
      )}

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
