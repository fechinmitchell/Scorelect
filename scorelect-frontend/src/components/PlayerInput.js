// src/components/PlayerInput.js

import React from 'react';
import Swal from 'sweetalert2';

const PlayerInput = ({ players, setPlayers, teamNumber }) => {
  const addPlayer = () => {
    setPlayers([...players, { name: '', number: '' }]);
  };

  const updatePlayer = (index, field, value) => {
    const updatedPlayers = players.map((player, i) =>
      i === index ? { ...player, [field]: value } : player
    );
    setPlayers(updatedPlayers);
  };

  const removePlayer = (index) => {
    if (players.length === 1) {
      Swal.fire('Cannot Remove', 'At least one player is required.', 'warning');
      return;
    }
    const updatedPlayers = players.filter((_, i) => i !== index);
    setPlayers(updatedPlayers);
  };

  return (
    <div>
      {players.map((player, index) => (
        <div
          key={index}
          className="player-input"
        >
          <input
            type="text"
            value={player.name}
            onChange={(e) => updatePlayer(index, 'name', e.target.value)}
            placeholder={`Player ${index + 1} Name`}
          />
          <input
            type="text"
            value={player.number}
            onChange={(e) => updatePlayer(index, 'number', e.target.value)}
            placeholder="Number"
          />
          <button onClick={() => removePlayer(index)}>Remove</button>
        </div>
      ))}
      <button className="add-player-button" onClick={addPlayer}>
        Add Player to Team {teamNumber}
      </button>
    </div>
  );
};

export default PlayerInput;
