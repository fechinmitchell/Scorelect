// src/GaaLineup.js
import React, { useState } from 'react';
import './GaaLineup.css';
import defaultCrest from './images/gaa-logo.png'; // Ensure you have a default GAA logo image

const GaaLineup = () => {
  const [teamName, setTeamName] = useState('Team Name');
  const [managerName, setManagerName] = useState('');
  const [crest, setCrest] = useState(null);

  // Initialize players 1-15
  const initialPlayers = Array.from({ length: 15 }, (_, i) => ({
    number: i + 1,
    name: '',
    position: i + 1,
    notes: '',
  }));
  const [players, setPlayers] = useState(initialPlayers);

  // Initialize substitutes 16-24
  const initialSubs = Array.from({ length: 9 }, (_, i) => ({
    number: i + 16,
    name: '',
    position: i + 16,
  }));
  const [subs, setSubs] = useState(initialSubs);

  const handlePlayerChange = (index, field, value) => {
    const updatedPlayers = [...players];
    updatedPlayers[index][field] = value;
    setPlayers(updatedPlayers);
  };

  const handleSubChange = (index, field, value) => {
    const updatedSubs = [...subs];
    updatedSubs[index][field] = value;
    setSubs(updatedSubs);
  };

  const handleCrestUpload = (event) => {
    if (event.target.files && event.target.files[0]) {
      setCrest(URL.createObjectURL(event.target.files[0]));
    }
  };

  const handleDownload = () => {
    // Implement download functionality here (e.g., using html2canvas)
  };

  return (
    <div className="gaa-lineup-container">
      <div className="gaa-lineup-header">
        <input
          type="text"
          className="team-name-input"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <div className="crest-upload">
          <label htmlFor="crest-input">
            <img
              src={crest || defaultCrest}
              alt="Team Crest"
              className="team-crest"
            />
          </label>
          <input
            type="file"
            id="crest-input"
            accept="image/*"
            onChange={handleCrestUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Main pitch area now acts as a vertical stack */}
      <div className="gaa-pitch">
        {/* Goalkeeper (position 1) */}
        <div className="position-row">
          {players.slice(0, 1).map((player, index) => (
            <div className="player" key={player.position}>
              <input
                type="text"
                className="player-number"
                value={player.number}
                onChange={(e) =>
                  handlePlayerChange(index, 'number', e.target.value)
                }
              />
              <input
                type="text"
                className="player-name"
                placeholder="Player Name"
                value={player.name}
                onChange={(e) =>
                  handlePlayerChange(index, 'name', e.target.value)
                }
              />
              <input
                type="text"
                className="player-notes"
                placeholder="Notes"
                value={player.notes}
                onChange={(e) =>
                  handlePlayerChange(index, 'notes', e.target.value)
                }
              />
            </div>
          ))}
        </div>

        {/* Full Backs (positions 2-4) */}
        <div className="position-row">
          {players.slice(1, 4).map((player, i) => (
            <div className="player" key={player.position}>
              <input
                type="text"
                className="player-number"
                value={player.number}
                onChange={(e) =>
                  handlePlayerChange(i + 1, 'number', e.target.value)
                }
              />
              <input
                type="text"
                className="player-name"
                placeholder="Player Name"
                value={player.name}
                onChange={(e) =>
                  handlePlayerChange(i + 1, 'name', e.target.value)
                }
              />
              <input
                type="text"
                className="player-notes"
                placeholder="Notes"
                value={player.notes}
                onChange={(e) =>
                  handlePlayerChange(i + 1, 'notes', e.target.value)
                }
              />
            </div>
          ))}
        </div>

        {/* Half Backs (positions 5-7) */}
        <div className="position-row">
          {players.slice(4, 7).map((player, i) => (
            <div className="player" key={player.position}>
              <input
                type="text"
                className="player-number"
                value={player.number}
                onChange={(e) =>
                  handlePlayerChange(i + 4, 'number', e.target.value)
                }
              />
              <input
                type="text"
                className="player-name"
                placeholder="Player Name"
                value={player.name}
                onChange={(e) =>
                  handlePlayerChange(i + 4, 'name', e.target.value)
                }
              />
              <input
                type="text"
                className="player-notes"
                placeholder="Notes"
                value={player.notes}
                onChange={(e) =>
                  handlePlayerChange(i + 4, 'notes', e.target.value)
                }
              />
            </div>
          ))}
        </div>

        {/* Midfielders (positions 8-9) */}
        <div className="position-row">
          {players.slice(7, 9).map((player, i) => (
            <div className="player" key={player.position}>
              <input
                type="text"
                className="player-number"
                value={player.number}
                onChange={(e) =>
                  handlePlayerChange(i + 7, 'number', e.target.value)
                }
              />
              <input
                type="text"
                className="player-name"
                placeholder="Player Name"
                value={player.name}
                onChange={(e) =>
                  handlePlayerChange(i + 7, 'name', e.target.value)
                }
              />
              <input
                type="text"
                className="player-notes"
                placeholder="Notes"
                value={player.notes}
                onChange={(e) =>
                  handlePlayerChange(i + 7, 'notes', e.target.value)
                }
              />
            </div>
          ))}
        </div>

        {/* Half Forwards (positions 10-12) */}
        <div className="position-row">
          {players.slice(9, 12).map((player, i) => (
            <div className="player" key={player.position}>
              <input
                type="text"
                className="player-number"
                value={player.number}
                onChange={(e) =>
                  handlePlayerChange(i + 9, 'number', e.target.value)
                }
              />
              <input
                type="text"
                className="player-name"
                placeholder="Player Name"
                value={player.name}
                onChange={(e) =>
                  handlePlayerChange(i + 9, 'name', e.target.value)
                }
              />
              <input
                type="text"
                className="player-notes"
                placeholder="Notes"
                value={player.notes}
                onChange={(e) =>
                  handlePlayerChange(i + 9, 'notes', e.target.value)
                }
              />
            </div>
          ))}
        </div>

        {/* Full Forwards (positions 13-15) */}
        <div className="position-row">
          {players.slice(12, 15).map((player, i) => (
            <div className="player" key={player.position}>
              <input
                type="text"
                className="player-number"
                value={player.number}
                onChange={(e) =>
                  handlePlayerChange(i + 12, 'number', e.target.value)
                }
              />
              <input
                type="text"
                className="player-name"
                placeholder="Player Name"
                value={player.name}
                onChange={(e) =>
                  handlePlayerChange(i + 12, 'name', e.target.value)
                }
              />
              <input
                type="text"
                className="player-notes"
                placeholder="Notes"
                value={player.notes}
                onChange={(e) =>
                  handlePlayerChange(i + 12, 'notes', e.target.value)
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="manager-and-subs">
        <div className="manager-section">
          <label>Manager:</label>
          <input
            type="text"
            className="manager-name-input"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
          />
        </div>
        <div className="subs-section">
          <h3>Substitutes</h3>
          {subs.map((sub, index) => (
            <div className="substitute" key={sub.position}>
              <input
                type="text"
                className="sub-number"
                value={sub.number}
                onChange={(e) =>
                  handleSubChange(index, 'number', e.target.value)
                }
              />
              <input
                type="text"
                className="sub-name"
                placeholder="Substitute Name"
                value={sub.name}
                onChange={(e) =>
                  handleSubChange(index, 'name', e.target.value)
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="download-button-container">
        <button onClick={handleDownload}>Download Lineup</button>
      </div>
    </div>
  );
};

export default GaaLineup;
