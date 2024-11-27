// src/SoccerLineup.js
import React, { useState } from 'react';
import './SoccerLineup.css';

const SoccerLineup = () => {
  const [team, setTeam] = useState([]);
  const [opponent, setOpponent] = useState([]);
  const positions = [
    'GK', // Goalkeeper
    'LB', 'CB', 'CB', 'RB', // Defenders
    'LM', 'CM', 'CM', 'RM', // Midfielders
    'ST', 'ST', // Forwards
  ];

  const handleAddPlayer = (teamType) => {
    // Logic to add a player to the team or opponent
  };

  return (
    <div className="soccer-lineup">
      <h2>Soccer Lineup</h2>
      <div className="lineup-container">
        <div className="team-side">
          <h3>Your Team</h3>
          <div className="field">
            {positions.map((position, index) => (
              <div key={index} className="player-position">
                <span>{position}</span>
                {/* Render player name if assigned */}
              </div>
            ))}
          </div>
          <button onClick={() => handleAddPlayer('team')}>Add Player</button>
        </div>
        <div className="opponent-side">
          <h3>Opponent Team</h3>
          <div className="field">
            {positions.map((position, index) => (
              <div key={index} className="player-position">
                <span>{position}</span>
                {/* Render opponent player name if assigned */}
              </div>
            ))}
          </div>
          <button onClick={() => handleAddPlayer('opponent')}>Add Player</button>
        </div>
      </div>
    </div>
  );
};

export default SoccerLineup;
