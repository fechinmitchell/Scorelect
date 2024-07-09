// src/BasketballCourt.js
import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Circle, Arc } from 'react-konva';
import Modal from 'react-modal';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import './PitchGraphic.css';
import './SavedGames.css';

const BasketballCourt = ({ userType }) => {
  const [coords, setCoords] = useState([]);
  const [currentCoords, setCurrentCoords] = useState([]);
  const [actionType, setActionType] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    action: 'shot',
    team: 'Lakers',
    playerName: '',
    player: '',
    position: 'forward',
    pressure: 'Yes',
    foot: 'Right',
    minute: '',
    from: null,
    to: null
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customInput, setCustomInput] = useState({ action: '', team: '', position: '', pressure: '', foot: '' });
  const stageRef = useRef();
  const [downloadsRemaining, setDownloadsRemaining] = useState(1);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const pitchWidth = 94; // Full length of a basketball court in feet
  const pitchHeight = 50; // Full width of a basketball court in feet
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 425 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [gameName, setGameName] = useState('');

  useEffect(() => {
    if (location.state && location.state.loadedCoords) {
      setCoords(location.state.loadedCoords);
    }
  }, [location.state]);

  const handleSaveGame = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user && userType === 'paid') {
      const sportType = 'Basketball';
      await setDoc(doc(firestore, 'savedGames', user.uid, 'games', gameName), {
        gameData: coords,
        name: gameName,
        date: new Date().toISOString(),
        sport: sportType
      });
      setIsSaveModalOpen(false);
    } else {
      Swal.fire('Please upgrade to save games.');
    }
  };

  const initialActionCodes = [
    'shot', 'miss', 'pass', 'turnover', 'rebound', 'assist'
  ];

  const initialPositions = [
    'forward', 'center', 'guard'
  ];

  const nbaTeams = [
    'Lakers', 'Warriors', 'Nets', 'Bucks', 'Clippers', 'Suns', '76ers', 'Jazz', 'Heat', 'Mavericks'
  ];

  const pressures = ['Yes', 'No'];
  const feet = ['Right', 'Left', 'Hand'];

  const [actionCodes, setActionCodes] = useState(initialActionCodes);
  const [positions, setPositions] = useState(initialPositions);
  const [teams, setTeams] = useState(nbaTeams);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 's') setActionType('shot');
      if (e.key === 'm') setActionType('miss');
      if (e.key === 'p') setActionType('pass');
      if (e.key === 't') setActionType('turnover');
      if (e.key === 'r') setActionType('rebound');
      if (e.key === 'a') setActionType('assist');
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, []);

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const docRef = doc(firestore, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          const lastDownloadDate = userData.lastDownloadDate;
          const today = new Date().toLocaleDateString();
          if (lastDownloadDate === today) {
            setDownloadsRemaining(userData.downloadsRemaining);
          } else {
            await setDoc(docRef, { lastDownloadDate: today, downloadsRemaining: 1 }, { merge: true });
            setDownloadsRemaining(1);
          }
        } else {
          await setDoc(docRef, { lastDownloadDate: new Date().toLocaleDateString(), downloadsRemaining: 1 });
          setDownloadsRemaining(1);
        }
      } else {
        const storedDownloadCount = localStorage.getItem('downloadCount');
        const lastDownloadDate = localStorage.getItem('lastDownloadDate');
        const today = new Date().toLocaleDateString();
        if (lastDownloadDate === today) {
          setDownloadsRemaining(parseInt(storedDownloadCount, 10) || 0);
        } else {
          localStorage.setItem('lastDownloadDate', today);
          localStorage.setItem('downloadCount', '1');
          setDownloadsRemaining(1);
        }
      }
    });
  }, []);

  const handleClick = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const adjustedCoord = {
      x: (point.x / canvasSize.width) * pitchWidth,
      y: (point.y / canvasSize.height) * pitchHeight,
    };

    // Ensure the adjusted coordinates are within the playable area
    if (adjustedCoord.x < 0 || adjustedCoord.x > pitchWidth || adjustedCoord.y < 0 || adjustedCoord.y > pitchHeight) {
      return;
    }

    if (actionType === 'pass' || actionType === 'assist') {
      setCurrentCoords([...currentCoords, adjustedCoord]);
      if (currentCoords.length === 1) {
        setFormData({ ...formData, from: currentCoords[0], to: adjustedCoord, type: actionType });
      }
    } else if (actionType) {
      setFormData({ ...formData, x: adjustedCoord.x, y: adjustedCoord.y, type: actionType });
      setOpenDialog(true);
    }
  };

  const handleTap = (e) => {
    handleClick(e);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleFormSubmit = async () => {
    if (customInput.action) {
      setActionCodes([...actionCodes, customInput.action]);
      formData.action = customInput.action;
    }
    if (customInput.team) {
      setTeams([...teams, customInput.team]);
      formData.team = customInput.team;
    }
    if (customInput.position) {
      setPositions([...positions, customInput.position]);
      formData.position = customInput.position;
    }
    if (customInput.pressure) {
      pressures.push(customInput.pressure);
      formData.pressure = customInput.pressure;
    }
    if (customInput.foot) {
      feet.push(customInput.foot);
      formData.foot = customInput.foot;
    }

    const updatedFormData = {
      action: formData.action || actionCodes[0],
      team: formData.team || teams[0],
      playerName: formData.playerName || '',
      player: formData.player || '',
      position: formData.position || positions[0],
      pressure: formData.pressure || pressures[0],
      foot: formData.foot || feet[0],
      minute: formData.minute || '',
      x: formData.x,
      y: formData.y,
      type: formData.type,
      from: formData.from,
      to: formData.to
    };
    setCoords([...coords, updatedFormData]);
    setOpenDialog(false);
    setFormData({
      action: 'shot',
      team: 'Lakers',
      playerName: '',
      player: '',
      position: 'forward',
      pressure: 'Yes',
      foot: 'Right',
      minute: '',
      from: null,
      to: null
    });
    setCurrentCoords([]);
    setCustomInput({ action: '', team: '', position: '', pressure: '', foot: '' });
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

  const handleDownloadData = async () => {
    if (userType === 'free' && downloadsRemaining <= 0) {
      Swal.fire({
        title: 'Download Limit Reached',
        text: 'You have reached your download limit for today. Please upgrade for more downloads.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Upgrade Now',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/signup');
        }
      });
      return;
    }

    const jsonData = JSON.stringify(coords, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coordinates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const today = new Date().toLocaleDateString();

    if (userType === 'free') {
      const newDownloadsRemaining = downloadsRemaining - 1;
      setDownloadsRemaining(newDownloadsRemaining);
      if (user) {
        const docRef = doc(firestore, 'users', user.uid);
        await setDoc(docRef, { downloadsRemaining: newDownloadsRemaining, lastDownloadDate: today }, { merge: true });
      } else {
        localStorage.setItem('downloadCount', newDownloadsRemaining.toString());
      }
    }
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const handleResize = (width, height) => {
    setCanvasSize({ width, height });
  };

  const renderBasketballCourt = () => (
    <Layer>
      {/* Court background */}
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill="#D2B48C" />

      {/* Playing surface outline */}
      <Line points={[
        0, 0,
        canvasSize.width, 0,
        canvasSize.width, canvasSize.height,
        0, canvasSize.height,
        0, 0
      ]} stroke="#000" strokeWidth={2} />

      {/* Center circle */}
      <Circle 
        x={canvasSize.width / 2} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke="#000" 
        strokeWidth={2} 
      />

      {/* Center line */}
      <Line points={[
        canvasSize.width / 2, 0,
        canvasSize.width / 2, canvasSize.height
      ]} stroke="#000" strokeWidth={2} />

      {/* Three-point arcs */}
      <Arc
        x={xScale * 4.92}
        y={canvasSize.height / 2}
        innerRadius={xScale * 23.75}
        outerRadius={xScale * 23.75}
        angle={135}
        rotation={292.5}
        stroke="#000"
        strokeWidth={2}
      />
      <Arc
        x={canvasSize.width - (xScale * 4.92)}
        y={canvasSize.height / 2}
        innerRadius={xScale * 23.75}
        outerRadius={xScale * 23.75}
        angle={135}
        rotation={112.5}
        stroke="#000"
        strokeWidth={2}
      />

      {/* Free throw circles */}
      <Circle 
        x={xScale * 19} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke="#000" 
        strokeWidth={2} 
      />
      <Circle 
        x={canvasSize.width - (xScale * 19)} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke="#000" 
        strokeWidth={2} 
      />

      {/* Free throw lanes */}
      <Line points={[
        0, yScale * 19,
        xScale * 19, yScale * 19,
        xScale * 19, canvasSize.height - (yScale * 19),
        0, canvasSize.height - (yScale * 19),
        0, yScale * 19
      ]} stroke="#000" strokeWidth={2} />
      <Line points={[
        canvasSize.width, yScale * 19,
        canvasSize.width - (xScale * 19), yScale * 19,
        canvasSize.width - (xScale * 19), canvasSize.height - (yScale * 19),
        canvasSize.width, canvasSize.height - (yScale * 19),
        canvasSize.width, yScale * 19
      ]} stroke="#000" strokeWidth={2} />

      {/* Outside Free throw lanes */}
      <Line points={[
        0, yScale * 17,
        xScale * 19, yScale * 17,
        xScale * 19, canvasSize.height - (yScale * 17),
        0, canvasSize.height - (yScale * 17),
        0, yScale * 17
      ]} stroke="#000" strokeWidth={2} />
      <Line points={[
        canvasSize.width, yScale * 17,
        canvasSize.width - (xScale * 19), yScale * 17,
        canvasSize.width - (xScale * 19), canvasSize.height - (yScale * 17),
        canvasSize.width, canvasSize.height - (yScale * 17),
        canvasSize.width, yScale * 17
      ]} stroke="#000" strokeWidth={2} />

      {/* Baselines */}
      <Line points={[
        xScale * 14, yScale * 3,
        0, yScale * 3
      ]} stroke="#000" strokeWidth={2} />
      <Line points={[
        xScale * 14, canvasSize.height - (yScale * 3),
        0, canvasSize.height - (yScale * 3)
      ]} stroke="#000" strokeWidth={2} />
      <Line points={[
        canvasSize.width - (xScale * 14), yScale * 3,
        canvasSize.width, yScale * 3
      ]} stroke="#000" strokeWidth={2} />
      <Line points={[
        canvasSize.width - (xScale * 14), canvasSize.height - (yScale * 3),
        canvasSize.width, canvasSize.height - (yScale * 3)
      ]} stroke="#000" strokeWidth={2} />

    </Layer>
  );

  const getColor = (type) => {
    switch (type) {
      case 'pass':
      case 'assist':
        return 'blue';
      case 'shot':
        return 'green';
      case 'miss':
        return 'red';
      case 'turnover':
        return 'yellow';
      case 'rebound':
        return 'purple';
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
        <div className="instructions-container">
          <h3>Instructions</h3>
          <div className="action-buttons">
            <button className="action-button pass" onClick={() => setActionType('pass')}>Pass (p)</button>
            <button className="action-button assist" onClick={() => setActionType('assist')}>Assist (a)</button>
            <button className="action-button shot" onClick={() => setActionType('shot')}>Shot (s)</button>
            <button className="action-button miss" onClick={() => setActionType('miss')}>Miss (m)</button>
            <button className="action-button turnover" onClick={() => setActionType('turnover')}>Turnover (t)</button>
            <button className="action-button rebound" onClick={() => setActionType('rebound')}>Rebound (r)</button>
          </div>
          <p>Click on the court to record an action at that location. Use the buttons above to specify the type of action. For passes and assists, you will be prompted to enter additional details.</p>
          <div className="button-container">
            <button className="button" onClick={handleClearMarkers}>Clear Markers</button>
            <button className="button" onClick={handleUndoLastMarker}>Undo Last Marker</button>
            <button className="button" onClick={handleDownloadData}>{userType === 'free' ? `Download Data (${downloadsRemaining} left)` : 'Download Data (Unlimited)'}</button>
            <button className="button" onClick={toggleModal}>View Coordinates</button>
            <button className="button" onClick={() => setIsSaveModalOpen(true)}>Save Game</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <button className="button" onClick={() => handleResize(375, 199.5)}>iPhone</button>
              <button className="button" onClick={() => handleResize(600, 319)}>iPad</button>
              <button className="button" onClick={() => handleResize(800, 425)}>Computer</button>
            </div>
            <div className="custom-slider-container">
              <label htmlFor="customZoom">Custom:</label>
              <input
                type="range"
                id="customZoom"
                min="0.5"
                max="2"
                step="0.1"
                value={zoomLevel}
                onChange={(e) => {
                  setZoomLevel(e.target.value);
                  handleResize(canvasSize.width * e.target.value, canvasSize.height * e.target.value);
                }}
              />
            </div>
          </div>
        </div>
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleClick}
          onTap={handleTap}
          ref={stageRef}
          scaleX={zoomLevel}
          scaleY={zoomLevel}
        >
          {renderBasketballCourt()}
          <Layer>
            {coords.map((coord, index) => {
              if (coord.from && coord.to) {
                return (
                  <Line
                    key={index}
                    points={[
                      coord.from.x * (canvasSize.width / pitchWidth),
                      coord.from.y * (canvasSize.height / pitchHeight),
                      coord.to.x * (canvasSize.width / pitchWidth),
                      coord.to.y * (canvasSize.height / pitchHeight)
                    ]}
                    stroke={getColor(coord.type)}
                    strokeWidth={2}
                  />
                );
              }
              return (
                <Circle
                  key={index}
                  x={coord.x * (canvasSize.width / pitchWidth)}
                  y={coord.y * (canvasSize.height / pitchHeight)}
                  radius={5}
                  fill={getColor(coord.type)}
                />
              );
            })}
          </Layer>
        </Stage>
      </div>
      {openDialog && (
        <div className="dialog-container">
          <h3>Enter Action Details</h3>
          <div className="form-group">
            <label>Action:</label>
            <select name="action" value={formData.action} onChange={handleChange}>
              <option value="custom">Add New Action</option>
              {actionCodes.map(action => <option key={action} value={action}>{action}</option>)}
            </select>
            {formData.action === 'custom' && (
              <div className="form-group">
                <label>New Action:</label>
                <input type="text" name="customAction" value={customInput.action} onChange={(e) => setCustomInput({ ...customInput, action: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Team:</label>
            <select name="team" value={formData.team} onChange={handleChange}>
              <option value="custom">Add New Team</option>
              {teams.map(team => <option key={team} value={team}>{team}</option>)}
            </select>
            {formData.team === 'custom' && (
              <div className="form-group">
                <label>New Team Name:</label>
                <input type="text" name="customTeam" value={customInput.team} onChange={(e) => setCustomInput({ ...customInput, team: e.target.value })} />
              </div>
            )}
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
              <option value="custom">Add New Position</option>
              {positions.map(position => <option key={position} value={position}>{position}</option>)}
            </select>
            {formData.position === 'custom' && (
              <div className="form-group">
                <label>New Position:</label>
                <input type="text" name="customPosition" value={customInput.position} onChange={(e) => setCustomInput({ ...customInput, position: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Pressure:</label>
            <select name="pressure" value={formData.pressure} onChange={handleChange}>
              <option value="custom">Add New Pressure</option>
              {pressures.map(pressure => <option key={pressure} value={pressure}>{pressure}</option>)}
            </select>
            {formData.pressure === 'custom' && (
              <div className="form-group">
                <label>New Pressure:</label>
                <input type="text" name="customPressure" value={customInput.pressure} onChange={(e) => setCustomInput({ ...customInput, pressure: e.target.value })} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Foot:</label>
            <select name="foot" value={formData.foot} onChange={handleChange}>
              <option value="custom">Add New Foot</option>
              {feet.map(foot => <option key={foot} value={foot}>{foot}</option>)}
            </select>
            {formData.foot === 'custom' && (
              <div className="form-group">
                <label>New Foot:</label>
                <input type="text" name="customFoot" value={customInput.foot} onChange={(e) => setCustomInput({ ...customInput, foot: e.target.value })} />
              </div>
            )}
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
      <Modal
        isOpen={isSaveModalOpen}
        onRequestClose={() => setIsSaveModalOpen(false)}
        contentLabel="Save Game"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            width: '50%',
            maxHeight: '60%', // Make the modal smaller
            overflowY: 'auto',
            background: '#2e2e2e',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
          }
        }}
      >
        <h2>Save Game</h2>
            <input
            type="text"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="Enter game name"
            style={{
                width: '97%',
                padding: '10px',
                margin: '5px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                marginRight: '20px'  // Added this line to move the element to the left by 20px
            }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button 
            onClick={handleSaveGame} 
            style={{
              background: '#007bff',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
          >
            Save
          </button>
          <button 
            onClick={() => setIsSaveModalOpen(false)}
            style={{
              background: '#6c757d',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default BasketballCourt;
