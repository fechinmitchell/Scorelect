// src/MatchDay.js
import React, { useState } from 'react';
import SoccerLineup from './SoccerLineup';
import GaaLineup from './GaaLineup';
import BasketballLineup from './BasketballLineup';
import AmericanFootballLineup from './AmericanFootballLineup';
import './MatchDay.css';

const MatchDay = () => {
  const [selectedSport, setSelectedSport] = useState('');

  const sports = ['Soccer', 'GAA', 'Basketball', 'American Football'];

  return (
    <div className="matchday-page">
      <h1 className="matchday-title">Create Match Day Lineup</h1>
      <div className="sport-selection">
        {sports.map((sport) => (
          <button
            key={sport}
            className={`sport-button${selectedSport === sport ? ' active' : ''}`}
            onClick={() => setSelectedSport(sport)}
          >
            {sport}
          </button>
        ))}
      </div>
      {selectedSport && (
        <div className="lineup-creator">
          {/* Render the lineup creation interface based on the selected sport */}
          {selectedSport === 'Soccer' && <SoccerLineup />}
          {selectedSport === 'GAA' && <GaaLineup />}
          {selectedSport === 'Basketball' && <BasketballLineup />}
          {selectedSport === 'American Football' && <AmericanFootballLineup/>}
        </div>
      )}
    </div>
  );
};

export default MatchDay;
