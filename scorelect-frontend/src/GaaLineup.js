// src/GaaLineup.js
import React, { useState, useRef } from 'react';
import './GaaLineup.css';
import defaultCrest from './images/gaa-logo.png';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const GaaLineup = () => {
  const [teamName, setTeamName] = useState('Team Name');
  const [managerName, setManagerName] = useState('');
  const [crest, setCrest] = useState(null);
  const [textColor, setTextColor] = useState('#000000');
  const [isLoading, setIsLoading] = useState(false);

  // Formation: 1-3-3-2-3-3
  const formationLines = [1, 3, 3, 2, 3, 3]; // totals 15 players
  // Positioning parameters
  const centerX = 150; // Adjusted centerX for more central placement
  const startY = 5;
  const ySpacing = 90;
  // Increased xSpacing for more horizontal space between players
  const xSpacing = 120;

  const initialPlayers = [];
  let playerIndex = 0;
  formationLines.forEach((count, lineIndex) => {
    const lineY = startY + lineIndex * ySpacing;
    const totalWidth = (count - 1) * xSpacing; 
    const startXLine = centerX - totalWidth / 2;
    for (let i = 0; i < count; i++) {
      const playerX = startXLine + i * xSpacing;
      initialPlayers.push({
        number: playerIndex + 1,
        name: '',
        position: playerIndex + 1,
        notes: '',
        locked: false,
        removed: false,
        posX: playerX,
        posY: lineY
      });
      playerIndex++;
    }
  });

  const [players, setPlayers] = useState(initialPlayers);

  const initialSubs = Array.from({ length: 9 }, (_, i) => ({
    number: i + 16,
    name: '',
    position: i + 16,
    locked: false,
    removed: false
  }));
  const [subs, setSubs] = useState(initialSubs);

  const containerRef = useRef(null);
  const pitchRef = useRef(null);
  const dragDataRef = useRef(null);

  const handleCrestUpload = (event) => {
    if (event.target.files && event.target.files[0]) {
      setCrest(URL.createObjectURL(event.target.files[0]));
    }
  };

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

  const handleLockPlayer = (index, isPlayer = true) => {
    if (isPlayer) {
      const updated = [...players];
      updated[index].locked = true;
      setPlayers(updated);
    } else {
      const updated = [...subs];
      updated[index].locked = true;
      setSubs(updated);
    }
  };

  const handleRemovePlayer = (index, isPlayer = true) => {
    if (isPlayer) {
      const updated = [...players];
      updated[index].removed = true;
      setPlayers(updated);
    } else {
      const updated = [...subs];
      updated[index].removed = true;
      setSubs(updated);
    }
  };

  const handleResetLineup = () => {
    // Reset players to initial formation again
    setPlayers(initialPlayers);
    setSubs(initialSubs);
    setTeamName('Team Name');
    setManagerName('');
    setCrest(null);
  };

  const handleDownload = async () => {
    if (!containerRef.current) return;
    setIsLoading(true);
    const container = containerRef.current;

    const containerWidth = container.scrollWidth;
    const containerHeight = container.scrollHeight;

    await new Promise((res) => setTimeout(res, 500));

    const canvas = await html2canvas(container, {
      scale: 2,
      windowWidth: containerWidth,
      windowHeight: containerHeight
    });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${teamName.replace(/\s+/g, '_')}_lineup.pdf`);

    setIsLoading(false);
  };

  const handleDragStart = (e, index) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    dragDataRef.current = { index, offsetX, offsetY };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!dragDataRef.current || !pitchRef.current) return;

    const { index, offsetX, offsetY } = dragDataRef.current;
    const pitchRect = pitchRef.current.getBoundingClientRect();

    const newX = e.clientX - pitchRect.left - offsetX;
    const newY = e.clientY - pitchRect.top - offsetY;

    const updatedPlayers = [...players];
    updatedPlayers[index].posX = Math.max(0, Math.min(newX, pitchRect.width - 100));
    updatedPlayers[index].posY = Math.max(0, Math.min(newY, pitchRect.height - 85));
    setPlayers(updatedPlayers);

    dragDataRef.current = null;
  };

  const renderPlayerFields = (obj, index, isPlayer = true) => {
    if (obj.removed) return null;

    const locked = obj.locked;
    const positionStyle = isPlayer
      ? { left: obj.posX, top: obj.posY, color: textColor, position: 'absolute' }
      : { color: textColor };

    if (locked) {
      return (
        <div
          className={`player-locked-slot${!isPlayer ? ' sub-locked-slot' : ''}`}
          style={positionStyle}
        >
          {obj.number && <div className="locked-number">{obj.number}</div>}
          {obj.name && <div className="locked-name">{obj.name}</div>}
          {'notes' in obj && obj.notes && (
            <div className="locked-notes">{obj.notes}</div>
          )}
        </div>
      );
    }

    const xButton = (
      <button
        type="button"
        className="remove-button"
        onClick={() => handleRemovePlayer(index, isPlayer)}
        title="Remove this player"
      >
        ✖
      </button>
    );

    const checkButton = (
      <button
        type="button"
        className="lock-button"
        onClick={() => handleLockPlayer(index, isPlayer)}
        title="Lock this player"
      >
        ✓
      </button>
    );

    const slotClass = isPlayer ? 'player-slot' : 'player-slot sub-slot';

    return (
      <div
        className={slotClass}
        style={positionStyle}
        {...(isPlayer
          ? {
              draggable: true,
              onDragStart: (e) => handleDragStart(e, index),
            }
          : {})}
      >
        {isPlayer && <div className="drag-handle" title="Drag to move player">⋮⋮</div>}
        <div className="action-buttons">
          {xButton}
          {checkButton}
        </div>
        <input
          type="text"
          className="player-number"
          placeholder="No."
          value={obj.number}
          onChange={(e) =>
            isPlayer
              ? handlePlayerChange(index, 'number', e.target.value)
              : handleSubChange(index, 'number', e.target.value)
          }
        />
        <input
          type="text"
          className="player-name"
          placeholder="Name"
          value={obj.name}
          onChange={(e) =>
            isPlayer
              ? handlePlayerChange(index, 'name', e.target.value)
              : handleSubChange(index, 'name', e.target.value)
          }
        />
        {'notes' in obj && (
          <input
            type="text"
            className="player-notes"
            placeholder="Notes"
            value={obj.notes}
            onChange={(e) =>
              handlePlayerChange(index, 'notes', e.target.value)
            }
          />
        )}
      </div>
    );
  };

  return (
    <>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      <div className="gaa-lineup-container" ref={containerRef}>
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
          <div
            className="gaa-pitch"
            ref={pitchRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {players.map((player, i) =>
              renderPlayerFields(player, i, true)
            )}
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
                    {renderPlayerFields(sub, index, false)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bottom-controls">
          <button className="reset-button" onClick={handleResetLineup}>Reset Lineup</button>
          <div className="download-button-container">
            <button className="download-button" onClick={handleDownload}>Download Lineup</button>
          </div>
          <div className="color-picker">
            <label>Text Color: </label>
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default GaaLineup;
