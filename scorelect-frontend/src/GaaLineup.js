// src/GaaLineup.js
import React, { useState } from 'react';
import './GaaLineup.css';
import defaultCrest from './images/gaa-logo.png'; 
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const GaaLineup = () => {
  const [teamName, setTeamName] = useState('Team Name');
  const [managerName, setManagerName] = useState('');
  const [crest, setCrest] = useState(null);

  // Players: 15 total
  const initialPlayers = Array.from({ length: 15 }, (_, i) => ({
    number: i + 1,
    name: '',
    position: i + 1,
    notes: '',
  }));
  const [players, setPlayers] = useState(initialPlayers);

  // Substitutes: 9 total
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

  const handleDownload = async () => {
    const container = document.querySelector('.gaa-lineup-container');
    if (!container) return;

    // Reduced scale for html2canvas
    const canvas = await html2canvas(container, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${teamName.replace(/\s+/g, '_')}_lineup.pdf`);
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

      <div className="gaa-content">
        <div className="gaa-pitch">
          {/* One row per line: goalkeeper, full backs, half backs, midfield, half forwards, full forwards */}
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
                  placeholder="Name"
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
                  placeholder="Name"
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
                  placeholder="Name"
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
                  placeholder="Name"
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
                  placeholder="Name"
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
                  placeholder="Name"
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
            <h3>Subs</h3>
            <div className="subs-grid">
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
                    placeholder="Name"
                    value={sub.name}
                    onChange={(e) =>
                      handleSubChange(index, 'name', e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="download-button-container">
        <button onClick={handleDownload}>Download Lineup</button>
      </div>
    </div>
  );
};

export default GaaLineup;
