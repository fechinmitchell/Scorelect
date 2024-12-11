// src/components/NewGameSetupModal.js

import React, { useState } from 'react';
import Modal from 'react-modal';
import Swal from 'sweetalert2';
import PlayerInput from './PlayerInput';
import './NewGameSetupModal.css';

const NewGameSetupModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialTeam1 = '',
  initialTeam2 = '',
  initialTeam1Color = { main: '#581830', secondary: '#FFFFFF' },
  initialTeam2Color = { main: '#008000', secondary: '#FF0000' },
}) => {
  const [team1, setTeam1] = useState(initialTeam1);
  const [team2, setTeam2] = useState(initialTeam2);
  const [team1Color, setTeam1Color] = useState(initialTeam1Color);
  const [team2Color, setTeam2Color] = useState(initialTeam2Color);
  const [matchDate, setMatchDate] = useState('');
  const [team1Players, setTeam1Players] = useState([{ name: '', number: '' }]);
  const [team2Players, setTeam2Players] = useState([{ name: '', number: '' }]);

  const handleSubmit = () => {
    if (!team1.trim() || !team2.trim()) {
      Swal.fire('Invalid Team Names', 'Please enter valid team names.', 'warning');
      return;
    }

    const gameSetupData = {
      team1,
      team2,
      team1Color,
      team2Color,
      matchDate,
      team1Players,
      team2Players,
    };

    onSubmit(gameSetupData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="New Game Setup"
      className="new-game-setup-modal"
      overlayClassName="new-game-setup-overlay"
    >
      <div className="modal-header">
        <h2 className="modal-title">New Game Setup</h2>
      </div>

      <div className="teams-wrapper">
        <div className="modal-section">
          <h3>Team 1</h3>
          <input
            type="text"
            value={team1}
            onChange={(e) => setTeam1(e.target.value)}
            placeholder="Enter Team 1 Name"
          />
          <div className="form-group">
            <label>Team 1 Main Color:</label>
            <input
              type="color"
              value={team1Color.main}
              onChange={(e) => setTeam1Color({ ...team1Color, main: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Team 1 Secondary Color:</label>
            <input
              type="color"
              value={team1Color.secondary}
              onChange={(e) => setTeam1Color({ ...team1Color, secondary: e.target.value })}
            />
          </div>
          <h4>Team 1 Players</h4>
          <PlayerInput players={team1Players} setPlayers={setTeam1Players} teamNumber={1} />
        </div>

        <div className="modal-section">
          <h3>Team 2</h3>
          <input
            type="text"
            value={team2}
            onChange={(e) => setTeam2(e.target.value)}
            placeholder="Enter Team 2 Name"
          />
          <div className="form-group">
            <label>Team 2 Main Color:</label>
            <input
              type="color"
              value={team2Color.main}
              onChange={(e) => setTeam2Color({ ...team2Color, main: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Team 2 Secondary Color:</label>
            <input
              type="color"
              value={team2Color.secondary}
              onChange={(e) => setTeam2Color({ ...team2Color, secondary: e.target.value })}
            />
          </div>
          <h4>Team 2 Players</h4>
          <PlayerInput players={team2Players} setPlayers={setTeam2Players} teamNumber={2} />
        </div>
      </div>

      <div className="modal-section">
        <label htmlFor="matchDate">Match Date:</label>
        <input
          type="date"
          id="matchDate"
          value={matchDate}
          onChange={(e) => setMatchDate(e.target.value)}
        />
      </div>

      <div className="modal-buttons">
        <button className="submit-button" onClick={handleSubmit}>
          Submit
        </button>
        <button className="cancel-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default NewGameSetupModal;
