// src/MatchDay.js
import React from 'react';
import SoccerLineup from './SoccerLineup';
import GaaLineup from './GaaLineup';
import BasketballLineup from './BasketballLineup';
import AmericanFootballLineup from './AmericanFootballLineup';
import './MatchDay.css';

const MatchDay = () => {
  // Retrieve selectedSport from localStorage (or another global state)
  const selectedSport = localStorage.getItem('selectedSport') || 'GAA';

  return (
    <div className="matchday-page">
      {/* Removed heading and sport selection buttons */}
      <div className="lineup-creator">
        {selectedSport === 'Soccer' && <SoccerLineup />}
        {selectedSport === 'GAA' && <GaaLineup />}
        {selectedSport === 'Basketball' && <BasketballLineup />}
        {selectedSport === 'American Football' && <AmericanFootballLineup />}
      </div>
    </div>
  );
};

export default MatchDay;
