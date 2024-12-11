// src/components/InitialSetupModal.js

import React from 'react';
import Modal from 'react-modal';
import './InitialSetupModal.css';

const InitialSetupModal = ({ isOpen, onStartNewGame, onSkipSetup }) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onSkipSetup}
      contentLabel="Initial Setup"
      className="initial-setup-modal"
      overlayClassName="initial-setup-overlay"
    >
      <div className="modal-header">
        <h2 className="modal-title">Welcome to Scorelect</h2>
      </div>
      <p className="modal-description">
        Start a new game or skip the setup to begin collecting match data.
      </p>
      <div className="modal-buttons">
        <button
          onClick={onStartNewGame}
          className="modal-button modal-button-new-game"
        >
          New Game
        </button>
        <button
          onClick={onSkipSetup}
          className="modal-button modal-button-skip-setup"
        >
          Skip Setup
        </button>
      </div>
    </Modal>
  );
};

export default InitialSetupModal;
