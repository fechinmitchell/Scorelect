// src/SoccerPitch.js
import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Arc, Circle } from 'react-konva';
import Modal from 'react-modal';
import './PitchGraphic.css'; // Assuming you want to use the same CSS file for both

const SoccerPitch = () => {
  const [coords, setCoords] = useState([]);
  const [currentCoords, setCurrentCoords] = useState([]);
  const [actionType, setActionType] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({ action: '', team: '', player: '', position: '', pressure: '', foot: '', minute: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const stageRef = useRef();

  const pitchLength = 105;
  const pitchWidth = 68;
  const canvasWidth = 800;
  const canvasHeight = 600;
  const xScale = canvasWidth / pitchLength;
  const yScale = canvasHeight / pitchWidth;

  const actionCodes = [
    'goal', 'assist', 'shot on target', 'shot off target', 'pass completed', 'pass incomplete'
  ];

  const positions = [
    'forward', 'midfield', 'defense', 'goalkeeper'
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
        let newCoords = [...coords];
        if (actionType === 'pass') newCoords.push({ from: currentCoords[0], to: newCoord, type: 'successful pass' });
        if (actionType === 'badpass') newCoords.push({ from: currentCoords[0], to: newCoord, type: 'unsuccessful pass' });
        if (actionType === 'kickout') newCoords.push({ from: currentCoords[0], to: newCoord, type: 'successful kickout' });
        if (actionType === 'badkickout') newCoords.push({ from: currentCoords[0], to: newCoord, type: 'unsuccessful kickout' });
        setCoords(newCoords);
        setCurrentCoords([]);
      }
    } else if (actionType === 'action' || actionType === 'badaction') {
      setFormData({ ...formData, x: newCoord.x, y: newCoord.y, type: actionType });
      setOpenDialog(true);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleFormSubmit = () => {
    // Ensure all form data is captured
    const updatedFormData = {
      action: formData.action || actionCodes[0],
      team: formData.team || counties[0],
      player: formData.player || '',
      position: formData.position || positions[0],
      pressure: formData.pressure || 'y',
      foot: formData.foot || 'r',
      minute: formData.minute || '',
      x: formData.x,
      y: formData.y,
      type: formData.type,
    };
    setCoords([...coords, updatedFormData]);
    setOpenDialog(false);
    setRecentActions([formData.action, ...recentActions.filter(action => action !== formData.action)]);
    setRecentTeams([formData.team, ...recentTeams.filter(team => team !== formData.team)]);
    setFormData({ action: '', team: '', player: '', position: '', pressure: '', foot: '', minute: '' });
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

  const renderSoccerPitch = () => (
    <Layer>
      <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#90EE90" />

      {/* Side and goal lines */}
      <Line points={[0, 0, canvasWidth, 0, canvasWidth, canvasHeight, 0, canvasHeight, 0, 0]} stroke="#000" strokeWidth={2} />

      {/* Goals */}
      <Line points={[canvasWidth, yScale * 30.34, xScale * 105, yScale * 30.34, xScale * 105, yScale * 37.66, canvasWidth, yScale * 37.66]} stroke="#000" strokeWidth={2} />
      <Line points={[0, yScale * 30.34, xScale * 0, yScale * 30.34, xScale * 0, yScale * 37.66, 0, yScale * 37.66]} stroke="#000" strokeWidth={2} />

      {/* 6-yard boxes */}
      <Line points={[0, yScale * 23.1, xScale * 5.5, yScale * 23.1, xScale * 5.5, yScale * 44.9, 0, yScale * 44.9]} stroke="#000" strokeWidth={2} />
      <Line points={[canvasWidth, yScale * 23.1, xScale * 99.5, yScale * 23.1, xScale * 99.5, yScale * 44.9, canvasWidth, yScale * 44.9]} stroke="#000" strokeWidth={2} />

      {/* Penalty areas */}
      <Line points={[0, yScale * 14, xScale * 16.5, yScale * 14, xScale * 16.5, yScale * 54, 0, yScale * 54]} stroke="#000" strokeWidth={2} />
      <Line points={[canvasWidth, yScale * 14, xScale * 88.5, yScale * 14, xScale * 88.5, yScale * 54, canvasWidth, yScale * 54]} stroke="#000" strokeWidth={2} />

      {/* Penalty spots */}
      <Circle x={xScale * 11} y={yScale * 34} radius={xScale * 0.4} fill="#000" />
      <Circle x={xScale * 94} y={yScale * 34} radius={xScale * 0.4} fill="#000" />

      {/* Halfway line */}
      <Line points={[xScale * 52.5, 0, xScale * 52.5, canvasHeight]} stroke="#000" strokeWidth={2} />

      {/* Center circle */}
      <Circle x={xScale * 52.5} y={yScale * 34} radius={xScale * 9.15} stroke="#000" strokeWidth={2} />

      {/* Corner arcs */}
      <Arc x={xScale * 0} y={yScale * 0} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={0} stroke="#000" strokeWidth={2} />
      <Arc x={xScale * 0} y={yScale * 68} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={270} stroke="#000" strokeWidth={2} />
      <Arc x={xScale * 105} y={yScale * 0} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={90} stroke="#000" strokeWidth={2} />
      <Arc x={xScale * 105} y={yScale * 68} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={180} stroke="#000" strokeWidth={2} />

      {/* Penalty arc */}
      <Arc x={xScale * 94} y={yScale * 34} innerRadius={xScale * 9.15} outerRadius={xScale * 9.15} angle={105} rotation={127.5} stroke="#000" strokeWidth={2} />
      <Arc x={xScale * 11} y={yScale * 34} innerRadius={xScale * 9.15} outerRadius={xScale * 9.15} angle={105} rotation={307.5} stroke="#000" strokeWidth={2} />

    </Layer>
  );

  return (
    <div className="pitch-container">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex' }}>
          <Stage width={canvasWidth} height={canvasHeight} onClick={handleClick} ref={stageRef}>
            {renderSoccerPitch()}
            <Layer>
              {coords.map((coord, index) => {
                if (coord.type.includes('pass') || coord.type.includes('kickout')) {
                  return (
                    <Line
                      key={index}
                      points={[
                        coord.from.x * xScale,
                        coord.from.y * yScale,
                        coord.to.x * xScale,
                        coord.to.y * yScale
                      ]}
                      stroke={coord.type.includes('unsuccessful') ? 'red' : 'yellow'}
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
                    fill={coord.type.includes('unsuccessful') ? 'red' : 'blue'}
                  />
                );
              })}
            </Layer>
          </Stage>
          <div className="instructions-container">
            <h3>Instructions</h3>
            <p>Action Codes:</p>
            <ul>
              <li><b>p</b>: Successful Pass</li>
              <li><b>u</b>: Unsuccessful Pass</li>
              <li><b>k</b>: Successful Kickout</li>
              <li><b>c</b>: Unsuccessful Kickout</li>
              <li><b>g</b>: Successful Action</li>
              <li><b>b</b>: Unsuccessful Action</li>
            </ul>
            <p>Click on the pitch to record an action at that location. Use the keys above to specify the type of action. For actions (g, b), you will be prompted to enter additional details.</p>
            <div className="button-container">
              <button className="button" onClick={handleClearMarkers}>Clear Markers</button>
              <button className="button" onClick={handleUndoLastMarker}>Undo Last Marker</button>
              <button className="button" onClick={handleDownloadData}>Download Data</button>
              <button className="button" onClick={toggleModal}>View Coordinates</button>
            </div>
          </div>
        </div>
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
              maxHeight: '80%',
              overflowY: 'auto'
            }
          }}
        >
          <h2>Coordinates Data</h2>
          <button onClick={toggleModal}>Close</button>
          <div style={{ marginTop: '10px', backgroundColor: 'Grey', padding: '10px', border: '1px solid #ccc' }}>
            <ul style={{ listStyleType: 'none', padding: '0' }}>
              {coords.map((coord, index) => (
                <li key={index} style={{ marginBottom: '10px' }}>
                  <strong>Action:</strong> {coord.action}<br />
                  <strong>Team:</strong> {coord.team}<br />
                  <strong>Player:</strong> {coord.player}<br />
                  <strong>Position:</strong> {coord.position}<br />
                  <strong>Pressure:</strong> {coord.pressure}<br />
                  <strong>Foot:</strong> {coord.foot}<br />
                  <strong>Minute:</strong> {coord.minute}<br />
                  <strong>X:</strong> {coord.x.toFixed(2)}, <strong>Y:</strong> {coord.y.toFixed(2)}
                </li>
              ))}
            </ul>
          </div>
        </Modal>
        {openDialog && (
          <div className="dialog-container">
            <h3>Enter Action Details</h3>
            <div>
              <label>
                Action:
                <select name="action" value={formData.action} onChange={handleChange}>
                  {recentActions.map(action => <option key={action} value={action}>{action}</option>)}
                  {actionCodes.map(action => <option key={action} value={action}>{action}</option>)}
                </select>
              </label>
            </div>
            <div>
              <label>
                Team:
                <select name="team" value={formData.team} onChange={handleChange}>
                  {recentTeams.map(team => <option key={team} value={team}>{team}</option>)}
                  {counties.map(county => <option key={county} value={county}>{county}</option>)}
                </select>
              </label>
            </div>
            <div>
              <label>
                Player Number:
                <input type="text" name="player" value={formData.player} onChange={handleChange} />
              </label>
            </div>
            <div>
              <label>
                Position:
                <select name="position" value={formData.position} onChange={handleChange}>
                  {positions.map(position => <option key={position} value={position}>{position}</option>)}
                </select>
              </label>
            </div>
            <div>
              <label>
                Pressure:
                <select name="pressure" value={formData.pressure} onChange={handleChange}>
                  <option value="y">Yes</option>
                  <option value="n">No</option>
                </select>
              </label>
            </div>
            <div>
              <label>
                Foot:
                <select name="foot" value={formData.foot} onChange={handleChange}>
                  <option value="r">Right</option>
                  <option value="l">Left</option>
                  <option value="h">Hand</option>
                </select>
              </label>
            </div>
            <div>
              <label>
                Minute:
                <input type="text" name="minute" value={formData.minute} onChange={handleChange} />
              </label>
            </div>
            <div className="button-container">
              <button className="button" onClick={handleCloseDialog}>Cancel</button>
              <button className="button" onClick={handleFormSubmit}>Submit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoccerPitch;
