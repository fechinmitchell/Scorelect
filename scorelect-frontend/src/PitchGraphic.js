import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Circle, Arc } from 'react-konva';
import Modal from 'react-modal';
import './PitchGraphic.css';

const PitchGraphic = () => {
  const [coords, setCoords] = useState([]);
  const [currentCoords, setCurrentCoords] = useState([]);
  const [actionType, setActionType] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openLineDialog, setOpenLineDialog] = useState(false);
  const [formData, setFormData] = useState({ action: '', team: '', playerName: '', player: '', position: '', pressure: '', foot: '', minute: '', from: null, to: null });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const stageRef = useRef();

  const pitchWidth = 145;
  const pitchHeight = 88;
  const canvasWidth = 800;
  const canvasHeight = 600;
  const xScale = canvasWidth / pitchWidth;
  const yScale = canvasHeight / pitchHeight;

  const actionCodes = [
    'point', 'wide', 'goal', 'goal miss', 'free', 'missed free', 'short', 'blocked', 'offensive mark', 'offensive mark wide', 'post',
    'free short', 'free wide', 'mark wide', 'missed 45', 'penalty goal', 'pen miss', 'successful pass', 'unsuccessful pass', 'successful kickout', 'unsuccessful kickout'
  ];

  const positions = [
    'forward', 'midfield', 'back', 'goalkeeper'
  ];

  const counties = [
    'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry',
    'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon',
    'Sligo', 'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
  ];

  const [recentActions, setRecentActions] = useState([]);
  const [recentTeams, setRecentTeams] = useState([]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'p') setActionType('pass');
      if (e.key === 'u') setActionType('badpass');
      if (e.key === 'k') setActionType('kickout');
      if (e.key === 'c') setActionType('badkickout');
      if (e.key === 'g') setActionType('action');
      if (e.key === 'b') setActionType('badaction');
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, []);

  const handleClick = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const newCoord = { x: point.x / xScale, y: point.y / yScale };

    if (actionType === 'pass' || actionType === 'badpass' || actionType === 'kickout' || actionType === 'badkickout') {
      setCurrentCoords([...currentCoords, newCoord]);
      if (currentCoords.length === 1) {
        setFormData({ ...formData, from: currentCoords[0], to: newCoord, type: actionType });
        setOpenLineDialog(true);
      }
    } else if (actionType === 'action' || actionType === 'badaction') {
      const actionTypeWithStatus = actionType === 'action' ? 'successful action' : 'unsuccessful action';
      setFormData({ ...formData, x: newCoord.x, y: newCoord.y, type: actionTypeWithStatus });
      setOpenDialog(true);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleCloseLineDialog = () => {
    setOpenLineDialog(false);
  };

  const handleFormSubmit = () => {
    const updatedFormData = {
      action: formData.action || actionCodes[0],
      team: formData.team || counties[0],
      playerName: formData.playerName || '',
      player: formData.player || '',
      position: formData.position || positions[0],
      pressure: formData.pressure || 'y',
      foot: formData.foot || 'r',
      minute: formData.minute || '',
      x: formData.x,
      y: formData.y,
      type: formData.type,
      from: formData.from,
      to: formData.to
    };
    setCoords([...coords, updatedFormData]);
    setOpenDialog(false);
    setOpenLineDialog(false);
    setRecentActions([formData.action, ...recentActions.filter(action => action !== formData.action)]);
    setRecentTeams([formData.team, ...recentTeams.filter(team => team !== formData.team)]);
    setFormData({ action: '', team: '', playerName: '', player: '', position: '', pressure: '', foot: '', minute: '', from: null, to: null });
    setCurrentCoords([]);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleClearMarkers = () => {
    setCoords([]);
  };

  const handleUndoLastMarker = () => {
    setCoords(coords.slice(0, -1));
  };

  const handleDownloadData = () => {
    const jsonData = JSON.stringify(coords, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coordinates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const renderGAAPitch = () => (
    <Layer>
      <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#90EE90" />
      {/* Side and goal lines */}
      <Line points={[0, 0, canvasWidth, 0, canvasWidth, canvasHeight, 0, canvasHeight, 0, 0]} stroke="#000" strokeWidth={2} />
      {/* Goals */}
      <Line points={[canvasWidth, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasWidth, yScale * 47.25]} stroke="#000" strokeWidth={2} />
      <Line points={[0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25]} stroke="#000" strokeWidth={2} />
      {/* 6 yard boxes */}
      <Line points={[canvasWidth, yScale * 37, xScale * 139, yScale * 37, xScale * 139, yScale * 51, canvasWidth, yScale * 51]} stroke="#000" strokeWidth={2} />
      <Line points={[0, yScale * 37, xScale * 6, yScale * 37, xScale * 6, yScale * 51, 0, yScale * 51]} stroke="#000" strokeWidth={2} />
      {/* Large rectangles */}
      <Line points={[0, yScale * 34.5, xScale * 14, yScale * 34.5, xScale * 14, yScale * 53.5, 0, yScale * 53.5]} stroke="#000" strokeWidth={2} />
      <Line points={[canvasWidth, yScale * 34.5, xScale * 131, yScale * 34.5, xScale * 131, yScale * 53.5, canvasWidth, yScale * 53.5]} stroke="#000" strokeWidth={2} />
      {/* Halfway small line */}
      <Line points={[xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49]} stroke="#000" strokeWidth={2} />
      {/* Peno lines */}
      <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke="#000" strokeWidth={2} />
      <Line points={[xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5]} stroke="#000" strokeWidth={2} />
      {/* Half Circles */}
      <Arc x={xScale * 124} y={yScale * 44} innerRadius={0} outerRadius={xScale * 12} angle={180} rotation={90} stroke="#000" strokeWidth={2} />
      <Arc x={xScale * 21} y={yScale * 44} innerRadius={0} outerRadius={xScale * 12} angle={180} rotation={270} stroke="#000" strokeWidth={2} />
      {/* 14 yard lines */}
      <Line points={[xScale * 14, 0, xScale * 14, canvasHeight]} stroke="#000" strokeWidth={2} />
      <Line points={[xScale * 131, 0, xScale * 131, canvasHeight]} stroke="#000" strokeWidth={2} />
      {/* 21 yard lines */}
      <Line points={[xScale * 21, 0, xScale * 21, canvasHeight]} stroke="#000" strokeWidth={2} />
      <Line points={[xScale * 124, 0, xScale * 124, canvasHeight]} stroke="#000" strokeWidth={2} />
      {/* 45 yard lines */}
      <Line points={[xScale * 45, 0, xScale * 45, canvasHeight]} stroke="#000" strokeWidth={2} />
      <Line points={[xScale * 100, 0, xScale * 100, canvasHeight]} stroke="#000" strokeWidth={2} />
      {/* 65 yard lines */}
      <Line points={[xScale * 65, 0, xScale * 65, canvasHeight]} stroke="#000" strokeWidth={2} />
      <Line points={[xScale * 80, 0, xScale * 80, canvasHeight]} stroke="#000" strokeWidth={2} />
    </Layer>
  );

  const getColor = (type) => {
    switch (type) {
      case 'pass':
      case 'successful pass':
        return 'blue';
      case 'badpass':
      case 'unsuccessful pass':
        return 'yellow';
      case 'kickout':
      case 'successful kickout':
        return 'purple';
      case 'badkickout':
      case 'unsuccessful kickout':
        return 'orange';
      case 'action':
      case 'successful action':
        return 'green';
      case 'badaction':
      case 'unsuccessful action':
        return 'red';
      default:
        return 'black';
    }
  };

  useEffect(() => {
    console.log('Coords updated:', coords);
  }, [coords]);

  return (
    <div className="pitch-container">
      <div className="content">
        <Stage width={canvasWidth} height={canvasHeight} onClick={handleClick} ref={stageRef}>
          {renderGAAPitch()}
          <Layer>
            {coords.map((coord, index) => {
              console.log('Rendering coord:', coord);
              if (coord.from && coord.to) {
                return (
                  <Line
                    key={index}
                    points={[
                      coord.from.x * xScale,
                      coord.from.y * yScale,
                      coord.to.x * xScale,
                      coord.to.y * yScale
                    ]}
                    stroke={getColor(coord.type)}
                    strokeWidth={2}
                  />
                );
              }
              return (
                <Circle
                  key={index}
                  x={coord.x * xScale}
                  y={coord.y * yScale}
                  radius={5}
                  fill={getColor(coord.type)}
                />
              );
            })}
          </Layer>
        </Stage>
        <div className="instructions-container">
          <h3>Instructions</h3>
          <div className="action-buttons">
            <button className="action-button pass" onClick={() => setActionType('pass')}>Successful Pass (p)</button>
            <button className="action-button badpass" onClick={() => setActionType('badpass')}>Unsuccessful Pass (u)</button>
            <button className="action-button kickout" onClick={() => setActionType('kickout')}>Successful Kickout (k)</button>
            <button className="action-button badkickout" onClick={() => setActionType('badkickout')}>Unsuccessful Kickout (c)</button>
            <button className="action-button action" onClick={() => setActionType('action')}>Successful Action (g)</button>
            <button className="action-button badaction" onClick={() => setActionType('badaction')}>Unsuccessful Action (b)</button>
          </div>
          <p>Click on the pitch to record an action at that location. Use the buttons above to specify the type of action. For actions (g, b), you will be prompted to enter additional details.</p>
          <div className="button-container">
            <button className="button" onClick={handleClearMarkers}>Clear Markers</button>
            <button className="button" onClick={handleUndoLastMarker}>Undo Last Marker</button>
            <button className="button" onClick={handleDownloadData}>Download Data</button>
            <button className="button" onClick={toggleModal}>View Coordinates</button>
          </div>
        </div>
      </div>
      {openDialog && (
        <div className="dialog-container">
          <h3>Enter Action Details</h3>
          <div className="form-group">
            <label>Action:</label>
            <select name="action" value={formData.action} onChange={handleChange}>
              {recentActions.map(action => <option key={action} value={action}>{action}</option>)}
              {actionCodes.map(action => <option key={action} value={action}>{action}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Team:</label>
            <select name="team" value={formData.team} onChange={handleChange}>
              {recentTeams.map(team => <option key={team} value={team}>{team}</option>)}
              {counties.map(county => <option key={county} value={county}>{county}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Player Name:</label>
            <input type="text" name="playerName" value={formData.playerName} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Player Number:</label>
            <input type="text" name="player" value={formData.player} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Position:</label>
            <select name="position" value={formData.position} onChange={handleChange}>
              {positions.map(position => <option key={position} value={position}>{position}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Pressure:</label>
            <select name="pressure" value={formData.pressure} onChange={handleChange}>
              <option value="y">Yes</option>
              <option value="n">No</option>
            </select>
          </div>
          <div className="form-group">
            <label>Foot:</label>
            <select name="foot" value={formData.foot} onChange={handleChange}>
              <option value="r">Right</option>
              <option value="l">Left</option>
              <option value="h">Hand</option>
            </select>
          </div>
          <div className="form-group">
            <label>Minute:</label>
            <input type="text" name="minute" value={formData.minute} onChange={handleChange} />
          </div>
          <div className="button-container">
            <button className="button" onClick={handleCloseDialog}>Cancel</button>
            <button className="button" onClick={handleFormSubmit}>Submit</button>
          </div>
        </div>
      )}
      {openLineDialog && (
        <div className="dialog-container">
          <h3>Enter Action Details for Line</h3>
          <div className="form-group">
            <label>Action:</label>
            <select name="action" value={formData.action} onChange={handleChange}>
              {recentActions.map(action => <option key={action} value={action}>{action}</option>)}
              {actionCodes.map(action => <option key={action} value={action}>{action}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Team:</label>
            <select name="team" value={formData.team} onChange={handleChange}>
              {recentTeams.map(team => <option key={team} value={team}>{team}</option>)}
              {counties.map(county => <option key={county} value={county}>{county}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Player Name:</label>
            <input type="text" name="playerName" value={formData.playerName} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Player Number:</label>
            <input type="text" name="player" value={formData.player} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Position:</label>
            <select name="position" value={formData.position} onChange={handleChange}>
              {positions.map(position => <option key={position} value={position}>{position}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Pressure:</label>
            <select name="pressure" value={formData.pressure} onChange={handleChange}>
              <option value="y">Yes</option>
              <option value="n">No</option>
            </select>
          </div>
          <div className="form-group">
            <label>Foot:</label>
            <select name="foot" value={formData.foot} onChange={handleChange}>
              <option value="r">Right</option>
              <option value="l">Left</option>
              <option value="h">Hand</option>
            </select>
          </div>
          <div className="form-group">
            <label>Minute:</label>
            <input type="text" name="minute" value={formData.minute} onChange={handleChange} />
          </div>
          <div className="button-container">
            <button className="button" onClick={handleCloseLineDialog}>Cancel</button>
            <button className="button" onClick={handleFormSubmit}>Submit</button>
          </div>
        </div>
      )}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={toggleModal}
        contentLabel="Coordinates Data"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxHeight: '60%', // Make the modal smaller
            overflowY: 'auto'
          }
        }}
      >
        <h2>Coordinates Data</h2>
        <button onClick={toggleModal}>Close</button>
        <div style={{ marginTop: '10px', backgroundColor: 'Grey', padding: '10px', border: '1px solid #ccc' }}>
          <ul style={{ listStyleType: 'none', padding: '0' }}>
            {coords.map((coord, index) => (
              <li key={index}>
                <strong>Action:</strong> {coord.action}<br />
                <strong>Team:</strong> {coord.team}<br />
                <strong>Player Number:</strong> {coord.player}<br />
                <strong>Player Name:</strong> {coord.playerName}<br />
                <strong>Position:</strong> {coord.position}<br />
                <strong>Pressure:</strong> {coord.pressure}<br />
                <strong>Foot:</strong> {coord.foot}<br />
                <strong>Minute:</strong> {coord.minute}<br />
                {coord.from && coord.to ? (
                  <>
                    <strong>From X:</strong> {coord.from.x.toFixed(2)}, <strong>From Y:</strong> {coord.from.y.toFixed(2)}<br />
                    <strong>To X:</strong> {coord.to.x.toFixed(2)}, <strong>To Y:</strong> {coord.to.y.toFixed(2)}
                  </>
                ) : (
                  <>
                    <strong>X:</strong> {coord.x.toFixed(2)}, <strong>Y:</strong> {coord.y.toFixed(2)}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default PitchGraphic;