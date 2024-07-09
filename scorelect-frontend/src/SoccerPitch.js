// src/SoccerPitch.js
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

const SoccerPitch = ({ userType }) => {
  const [coords, setCoords] = useState([]);
  const [currentCoords, setCurrentCoords] = useState([]);
  const [actionType, setActionType] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openLineDialog, setOpenLineDialog] = useState(false);
  const [formData, setFormData] = useState({
    action: 'goal',
    team: 'Arsenal',
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

  const pitchWidth = 105;
  const pitchHeight = 68;
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 519.5 });
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
      const sportType = 'Soccer';
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
    'goal', 'assist', 'shot on target', 'shot off target', 'pass completed', 'pass incomplete'
  ]; 

  const initialPositions = [
    'forward', 'midfield', 'defense', 'goalkeeper'
  ];

  const premierLeagueTeams = [
    'Arsenal', 'Aston Villa', 'Brentford', 'Brighton', 'Burnley', 'Chelsea', 'Crystal Palace', 'Everton',
    'Fulham', 'Liverpool', 'Luton Town', 'Manchester City', 'Manchester United', 'Newcastle United', 'Nottingham Forest',
    'Sheffield United', 'Tottenham Hotspur', 'West Ham United', 'Wolverhampton Wanderers'
  ];

  const pressures = ['Yes', 'No'];
  const feet = ['Right', 'Left', 'Hand'];

  const [actionCodes, setActionCodes] = useState(initialActionCodes);
  const [positions, setPositions] = useState(initialPositions);
  const [teams, setTeams] = useState(premierLeagueTeams);
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

  const handleTap = (e) => {
    handleClick(e);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleCloseLineDialog = () => {
    setOpenLineDialog(false);
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
    setOpenLineDialog(false);
    setRecentActions([formData.action, ...recentActions.filter(action => action !== formData.action)]);
    setRecentTeams([formData.team, ...recentTeams.filter(team => team !== formData.team)]);
    setFormData({
      action: 'goal',
      team: 'Arsenal',
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

  const renderSoccerPitch = () => (
    <Layer>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill="#00A86B" />

      {/* Side and goal lines */}
      <Line points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} stroke="#000" strokeWidth={2} />

      {/* Goals */}
      <Line points={[canvasSize.width, yScale * 30.34, xScale * 105, yScale * 30.34, xScale * 105, yScale * 37.66, canvasSize.width, yScale * 37.66]} stroke="#000" strokeWidth={2} />
      <Line points={[0, yScale * 30.34, xScale * 0, yScale * 30.34, xScale * 0, yScale * 37.66, 0, yScale * 37.66]} stroke="#000" strokeWidth={2} />

      {/* 6-yard boxes */}
      <Line points={[0, yScale * 23.1, xScale * 5.5, yScale * 23.1, xScale * 5.5, yScale * 44.9, 0, yScale * 44.9]} stroke="#000" strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 23.1, xScale * 99.5, yScale * 23.1, xScale * 99.5, yScale * 44.9, canvasSize.width, yScale * 44.9]} stroke="#000" strokeWidth={2} />

      {/* Penalty areas */}
      <Line points={[0, yScale * 14, xScale * 16.5, yScale * 14, xScale * 16.5, yScale * 54, 0, yScale * 54]} stroke="#000" strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 14, xScale * 88.5, yScale * 14, xScale * 88.5, yScale * 54, canvasSize.width, yScale * 54]} stroke="#000" strokeWidth={2} />

      {/* Penalty spots */}
      <Circle x={xScale * 11} y={yScale * 34} radius={xScale * 0.4} fill="#000" />
      <Circle x={xScale * 94} y={yScale * 34} radius={xScale * 0.4} fill="#000" />

      {/* Halfway line */}
      <Line points={[xScale * 52.5, 0, xScale * 52.5, canvasSize.height]} stroke="#000" strokeWidth={2} />

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
            <button className="button" onClick={handleDownloadData}>{userType === 'free' ? `Download Data (${downloadsRemaining} left)` : 'Download Data (Unlimited)'}</button>
            <button className="button" onClick={toggleModal}>View Coordinates</button>
            <button className="button" onClick={() => setIsSaveModalOpen(true)}>Save Game</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <button className="button" onClick={() => handleResize(375, 243.5)}>iPhone</button>
              <button className="button" onClick={() => handleResize(600, 389.6)}>iPad</button>
              <button className="button" onClick={() => handleResize(800, 600)}>Computer</button>
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
          {renderSoccerPitch()}
          <Layer>
            {coords.map((coord, index) => {
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
      </div>
      {openDialog && (
        <div className="dialog-container">
          <h3>Enter Action Details</h3>
          <div className="form-group">
            <label>Action:</label>
            <select name="action" value={formData.action} onChange={handleChange}>
              <option value="custom">Add New Action</option>
              {recentActions.map(action => <option key={action} value={action}>{action}</option>)}
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
              {recentTeams.map(team => <option key={team} value={team}>{team}</option>)}
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
      {openLineDialog && (
        <div className="dialog-container">
          <h3>Enter Action Details for Line</h3>
          <div className="form-group">
            <label>Action:</label>
            <select name="action" value={formData.action} onChange={handleChange}>
              <option value="custom">Add New Action</option>
              {recentActions.map(action => <option key={action} value={action}>{action}</option>)}
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
              {recentTeams.map(team => <option key={team} value={team}>{team}</option>)}
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

export default SoccerPitch;
