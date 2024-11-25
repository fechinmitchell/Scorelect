// Players.js
import React, { useState } from 'react';
import './Players.css';

const Players = () => {
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player One', position: 'Forward', number: 9 },
    { id: 2, name: 'Player Two', position: 'Midfielder', number: 8 },
    // Add more players as needed
  ]);

  const [newPlayer, setNewPlayer] = useState({ name: '', position: '', number: '' });

  const handleAddPlayer = () => {
    if (newPlayer.name && newPlayer.position && newPlayer.number) {
      setPlayers([
        ...players,
        { ...newPlayer, id: players.length + 1, number: parseInt(newPlayer.number) },
      ]);
      setNewPlayer({ name: '', position: '', number: '' });
    }
  };

  return (
    <div className="players-page">
      <h2>Team Roster</h2>
      <table className="players-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Name</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td>{player.number}</td>
              <td>{player.name}</td>
              <td>{player.position}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Add New Player</h3>
      <div className="add-player-form">
        <input
          type="text"
          placeholder="Name"
          value={newPlayer.name}
          onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Position"
          value={newPlayer.position}
          onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
        />
        <input
          type="number"
          placeholder="Number"
          value={newPlayer.number}
          onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
        />
        <button onClick={handleAddPlayer}>Add Player</button>
      </div>
    </div>
  );
};

export default Players;
