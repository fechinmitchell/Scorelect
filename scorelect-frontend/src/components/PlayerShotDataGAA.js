// src/components/PlayerShotDataGAA.js

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import Swal from 'sweetalert2';
import { Stage, Layer, Rect, Circle, RegularPolygon, Text, Line, Group, Arc } from 'react-konva';
import Modal from 'react-modal';
import './PlayerShotDataGAA.css';

// Make <Modal> accessible
Modal.setAppElement('#root');

 // Coloring the pitch
 const pitchColor = '#006400';
 const lineColor = '#FFFFFF';
 const lightStripeColor = '#228B22';
 const darkStripeColor = '#006400';


// Translates the shot so it’s always relative to the nearest goal (optional).
function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = (shot.x || 0) <= halfLineX ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters };
}

// Distinguish categories (goal, miss, point, setplay, etc.)
function getShotCategory(actionStr) {
  const a = (actionStr || '').toLowerCase().trim();

  // Set-play actions
  const knownSetPlayActions = [
    'free', 'missed free', 'fortyfive', 'offensive mark', 'penalty goal',
    'pen miss', 'free short', 'free wide', 'fortyfive short', 'fortyfive wide',
    'offensive mark short', 'offensive mark wide', 'mark wide'
  ];

  // Check if set play ended in 'score' or 'miss'
  function isSetPlayScore(a) {
    if (a.includes('wide') || a.includes('short') || a.includes('miss')) return false;
    return true;
  }

  // 1) If setplay
  if (knownSetPlayActions.some((sp) => a === sp)) {
    return isSetPlayScore(a) ? 'setplay-score' : 'setplay-miss';
  }

  // 2) Goals
  if (a === 'goal' || a === 'penalty goal') return 'goal';

  // 3) Misses
  const knownMisses = ['wide', 'goal miss', 'miss', 'block', 'blocked', 'post', 'short', 'pen miss'];
  if (knownMisses.some((m) => a === m)) return 'miss';

  // 4) Points
  if (a === 'point') return 'point';

  // else
  return 'other';
}

/**
 * Renders a shape for each shot:
 * - setplay-score => green polygon
 * - setplay-miss  => red polygon
 * - goal => yellow circle
 * - point => green circle
 * - miss => red circle
 * - other => orange circle
 */
function renderShapeForShot(category, x, y, onMouseEnter, onMouseLeave, onClick) {
  if (category === 'setplay-score' || category === 'setplay-miss') {
    const fillColor = category === 'setplay-score' ? 'green' : 'red';
    return (
      <RegularPolygon
        x={x}
        y={y}
        sides={6} // hex (or 8 for an octagon)
        radius={6}
        fill={fillColor}
        opacity={0.85}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      />
    );
  }

  let fillColor = 'orange';
  if (category === 'goal')  fillColor = 'yellow';
  if (category === 'point') fillColor = 'green';
  if (category === 'miss')  fillColor = 'red';

  return (
    <Circle
      x={x}
      y={y}
      radius={5}
      fill={fillColor}
      opacity={0.85}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    />
  );
}

// A small info icon that can be hovered or clicked to show a tooltip.
const InfoIcon = ({ text }) => {
  return (
    <span style={{ marginLeft: '6px', position: 'relative' }}>
      <span
        style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          backgroundColor: '#666',
          color: '#fff',
          textAlign: 'center',
          fontSize: '10px',
          cursor: 'pointer',
          fontWeight: 'bold',
          lineHeight: '14px',
        }}
        title={text}
      >
        i
      </span>
    </span>
  );
};

function LoadingIndicator() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading player data...</p>
    </div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="error-container">
      <p>{message}</p>
    </div>
  );
}

export default function PlayerShotDataGAA() {
  const { playerName } = useParams();
  const navigate = useNavigate();

  const [shotsData, setShotsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const stageRef = useRef(null);

  // Tooltip for hover
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  // Additional: Selected shot state => for the onClick details
  const [selectedShot, setSelectedShot] = useState(null);

  // Whether to show xPoints label
  const [showXP, setShowXP] = useState(false);

  // Canvas & pitch sizes
  const canvasSize = { width: 930, height: 530 };
  const pitchWidth = 145;
  const pitchHeight = 88;
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;

  // For "translateShotToOneSide"
  const halfLineX = pitchWidth / 2;
  const goalXRight = pitchWidth;
  const goalY = pitchHeight / 2;

  // Filter states: All, goal, point, miss, setplay => (setplay-score or setplay-miss)
  const [shotFilter, setShotFilter] = useState('All');

  // React Modal style
  const customModalStyles = {
    content: {
      maxWidth: '500px',
      margin: 'auto',
      padding: '20px',
      borderRadius: '8px',
      backgroundColor: '#2e2e2e', // darker background
      color: '#fff',              // white text
    },
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 9999,
    },
  };

  // Fetch shots from Firestore
  useEffect(() => {
    async function fetchShotsForPlayer() {
      try {
        setLoading(true);
        const USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
        const DATASET_NAME = 'All Shots GAA';
        const docRef = doc(firestore, `savedGames/${USER_ID}/games`, DATASET_NAME);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          Swal.fire({
            title: 'No Data',
            text: 'Could not find "All Shots GAA" dataset!',
            icon: 'info',
            confirmButtonText: 'OK',
          });
          navigate('/');
          return;
        }

        const { gameData } = docSnap.data() || {};
        if (!gameData || !Array.isArray(gameData)) {
          Swal.fire({
            title: 'No Data',
            text: 'No shots in "All Shots GAA".',
            icon: 'info',
            confirmButtonText: 'OK',
          });
          navigate('/');
          return;
        }

        // Filter by this player
        const filtered = gameData.filter(
          (s) => (s.playerName || '').toLowerCase() === playerName.toLowerCase()
        );

        if (filtered.length === 0) {
          Swal.fire({
            title: 'No Data',
            text: `No shots found for player: ${playerName}`,
            icon: 'info',
            confirmButtonText: 'OK',
          });
          navigate(-1);
          return;
        }

        // Optionally translate each shot
        const translated = filtered.map((shot) => translateShotToOneSide(shot, halfLineX, goalXRight, goalY));
        setShotsData(translated);
      } catch (err) {
        setError(err.message);
        Swal.fire('Error', err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchShotsForPlayer();
  }, [playerName, navigate]);

  // Export the pitch as a PNG
  function handleExport() {
    if (stageRef.current) {
      stageRef.current.toDataURL({
        pixelRatio: 2,
        callback: (dataUrl) => {
          const link = document.createElement('a');
          link.download = `${playerName}_shot_map.png`;
          link.href = dataUrl;
          link.click();
        },
      });
    }
  }

  // Filter function
  function getShotCategory(action) {
    const a = (action || '').toLowerCase().trim();
    const knownSetPlayActions = [
      'free', 'missed free', 'fortyfive', 'offensive mark', 'penalty goal',
      'pen miss', 'free short', 'free wide', 'fortyfive short', 'fortyfive wide',
      'offensive mark short', 'offensive mark wide', 'mark wide'
    ];
    function isSetPlayScore(a) {
      if (a.includes('wide') || a.includes('short') || a.includes('miss')) return false;
      return true;
    }
    if (knownSetPlayActions.some((sp) => a === sp)) {
      return isSetPlayScore(a) ? 'setplay-score' : 'setplay-miss';
    }

    const knownMisses = ['wide', 'goal miss', 'miss', 'block', 'blocked', 'post', 'short', 'pen miss'];
    if (a === 'goal' || a === 'penalty goal') return 'goal';
    if (knownMisses.some((m) => a === m)) return 'miss';
    if (a === 'point') return 'point';
    return 'other';
  }

  function isShotVisible(shot) {
    const cat = getShotCategory(shot.action);
    if (shotFilter === 'All') return true;
    if (shotFilter === 'setplay') {
      return cat === 'setplay-score' || cat === 'setplay-miss';
    }
    return cat === shotFilter;
  }

  const filteredShots = shotsData.filter(isShotVisible);

  // On shape click => open a modal with shot info
  function handleShotClick(shot) {
    setSelectedShot(shot);
  }

  // Close the shot info modal
  function closeModal() {
    setSelectedShot(null);
  }

  // Decide shape & color
  function renderShapeForShot(category, x, y, onMouseEnter, onMouseLeave, onClick) {
    if (category === 'setplay-score' || category === 'setplay-miss') {
      const fillColor = category === 'setplay-score' ? 'green' : 'red';
      return (
        <RegularPolygon
          x={x}
          y={y}
          sides={6}
          radius={6}
          fill={fillColor}
          opacity={0.85}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
        />
      );
    }

    let fillColor = 'orange';
    if (category === 'goal')  fillColor = 'yellow';
    if (category === 'point') fillColor = 'green';
    if (category === 'miss')  fillColor = 'red';

    return (
      <Circle
        x={x}
        y={y}
        radius={5}
        fill={fillColor}
        opacity={0.85}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      />
    );
  }

  // Render pitch lines
  function renderGAAPitch() {
    const numStripes = 10;
    const stripeWidth = canvasSize.width / numStripes;
    

    return (
      <Layer>
        {/* Pitch Background */}
        <Rect
          x={0}
          y={0}
          width={canvasSize.width}
          height={canvasSize.height}
          fill={pitchColor}
        />

        {/* Stripes */}
        {Array.from({ length: numStripes }, (_, i) => (
          <Rect
            key={i}
            x={i * stripeWidth}
            y={0}
            width={stripeWidth}
            height={canvasSize.height}
            fill={i % 2 === 0 ? lightStripeColor : darkStripeColor}
            opacity={0.3} // Adjust opacity for subtlety
          />
        ))}
      <Line points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} stroke={lineColor} strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasSize.width, yScale * 47.25]} stroke={lineColor} strokeWidth={2} />
      <Line points={[0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25]} stroke={lineColor} strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 37, xScale * 140.5, yScale * 37, xScale * 140.5, yScale * 51, canvasSize.width, yScale * 51]} stroke={lineColor} strokeWidth={2} />
      <Line points={[0, yScale * 37, xScale * 4.5, yScale * 37, xScale * 4.5, yScale * 51, 0, yScale * 51]} stroke={lineColor} strokeWidth={2} />
      <Line points={[0, yScale * 34.5, xScale * 13, yScale * 34.5, xScale * 13, yScale * 53.5, 0, yScale * 53.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 34.5, xScale * 132, yScale * 34.5, xScale * 132, yScale * 53.5, canvasSize.width, yScale * 53.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5]} stroke={lineColor} strokeWidth={2} />
      <Arc x={xScale * 125} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={90} stroke={lineColor} strokeWidth={2} />
      <Arc x={xScale * 20} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={270} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 13, 0, xScale * 13, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 132, 0, xScale * 132, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 20, 0, xScale * 20, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 125, 0, xScale * 125, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 45, 0, xScale * 45, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 100, 0, xScale * 100, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 65, 0, xScale * 65, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 80, 0, xScale * 80, canvasSize.height]} stroke={lineColor} strokeWidth={2} />

      <Arc
        x={xScale * 0}
        y={yScale * 44}
        innerRadius={xScale * 40}    // Set equal to outerRadius
        outerRadius={xScale * 40}
        angle={120}
        rotation={300}
        stroke={lineColor}
        strokeWidth={2}
        closed={false}
        lineCap="round"
        />

        <Arc
        x={xScale * 145}
        y={yScale * 44}
        innerRadius={xScale * 40}    // Set equal to outerRadius
        outerRadius={xScale * 40}
        angle={120}
        rotation={120}
        stroke={lineColor}
        strokeWidth={2}
        closed={false}
        lineCap="round"
        />

      {/* "SCORELECT" in the end zones */}
      <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSize.height / 40.25} fontSize={canvasSize.width / 60} f  fill="#D3D3D3" opacity={0.7} rotation={0} align="center" />
      <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 22.5} y={canvasSize.height / 1.02} fontSize={canvasSize.width / 60} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />

      </Layer>
    );
  };

  // Render the shots layer
  function renderShotsLayer() {
    return (
      <Layer>
        {filteredShots.map((shot, i) => {
          const cat = getShotCategory(shot.action);
          const shotX = (shot.x || 0) * xScale;
          const shotY = (shot.y || 0) * yScale;

          const handleMouseEnter = (e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
            setTooltip({
              visible: true,
              x: e.evt.layerX,
              y: e.evt.layerY,
              content: `Action: ${shot.action}\nX: ${shot.x?.toFixed(1)}, Y: ${shot.y?.toFixed(1)}`,
            });
          };

          const handleMouseLeave = () => {
            if (stageRef.current) {
              stageRef.current.container().style.cursor = 'default';
            }
            setTooltip((t) => ({ ...t, visible: false }));
          };

          // On click => show shot info
          const handleClick = () => handleShotClick(shot);

          return (
            <Group key={i}>
              {renderShapeForShot(cat, shotX, shotY, handleMouseEnter, handleMouseLeave, handleClick)}

              {/* If showXP is checked and shot.xPoints is a number => label xP */}
              {showXP && typeof shot.xPoints === 'number' && (
                <Text
                  x={shotX}
                  y={shotY - 14}
                  text={`xP: ${shot.xPoints.toFixed(2)}`}
                  fontSize={12}
                  fill="#fff"
                  offsetX={15}
                  shadowColor="#000"
                  shadowBlur={2}
                />
              )}
            </Group>
          );
        })}
      </Layer>
    );
  }

  // Render tooltip for hovers
  function renderTooltip() {
    if (!tooltip.visible) return null;
    return (
      <div
        className="tooltip"
        style={{
          position: 'absolute',
          top: tooltip.y,
          left: tooltip.x,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '6px 8px',
          borderRadius: '4px',
          pointerEvents: 'none',
          whiteSpace: 'pre-line',
          zIndex: 10,
        }}
      >
        {tooltip.content}
      </div>
    );
  }

  // If loading or no data
  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (!filteredShots.length) {
    return <ErrorMessage message="No shots found for this filter or player." />;
  }

  // Format shot details for the modal.
  // We decide if this shot was a "goal" => xG, else => xP. 
  // Also handle if shot has "xP_ADV" or "distMeters", etc.
  function renderSelectedShotDetails() {
    if (!selectedShot) return null;

    // Decide if it's goal or point => show xG or xP
    const shotCat = getShotCategory(selectedShot.action);
    const isGoalShot = shotCat === 'goal' || shotCat === 'setplay-score' && selectedShot.action?.toLowerCase().includes('penalty goal');

    // We'll do a simple fallback if isGoalShot => show xGoals,
    // else show xPoints. You can refine the logic if you like.
    let metricLabel = '';
    let metricValue = '';
    if (isGoalShot) {
      metricLabel = 'xG';
      metricValue = (typeof selectedShot.xGoals === 'number') 
        ? selectedShot.xGoals.toFixed(2) 
        : 'N/A';
    } else {
      metricLabel = 'xP';
      metricValue = (typeof selectedShot.xPoints === 'number')
        ? selectedShot.xPoints.toFixed(2)
        : 'N/A';
    }

    // If shot.xP_ADV is available
    const xPAdv = (typeof selectedShot.xP_adv === 'number')
      ? selectedShot.xP_adv.toFixed(2)
      : 'N/A';

    // Distance in meters from center
    const distMeters = (typeof selectedShot.distMeters === 'number')
      ? selectedShot.distMeters.toFixed(1)
      : 'N/A';

    return (
      <div style={{ lineHeight: '1.6' }}>
        <p><strong>Action:</strong> {selectedShot.action}</p>
        <p><strong>Position:</strong> {selectedShot.position || 'N/A'}</p>
        <p><strong>Foot:</strong> {selectedShot.foot || 'N/A'}</p>
        <p><strong>Pressure:</strong> {selectedShot.pressure || 'N/A'}</p>
        <p><strong>Distance (m):</strong> {distMeters}</p>

        <p>
          <strong>{metricLabel}:</strong> {metricValue}
          <InfoIcon text={`A brief explanation of ${metricLabel}. e.g., "Expected ${isGoalShot ? 'Goals' : 'Points'}..."`} />
        </p>

        <p>
          <strong>xP_Adv:</strong> {xPAdv}
          <InfoIcon text="xP_adv is an advanced measure of the shot's estimated contribution beyond baseline." />
        </p>
      </div>
    );
  }

  // Render the shot detail modal
  function renderShotDetailModal() {
    return (
      <Modal
        isOpen={!!selectedShot}
        onRequestClose={closeModal}
        style={customModalStyles}
        contentLabel="Shot Details"
      >
        <h2 style={{ marginTop: 0 }}>Shot Details</h2>
        {renderSelectedShotDetails()}
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <button 
            onClick={closeModal}
            style={{
              backgroundColor: '#607d8b',
              color: '#fff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '5px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <h1 style={{ textAlign: 'center', color: '#fff' }}>
        Shot Map for {playerName}
      </h1>

      {/* Button row: back, export, filter, xp checkbox */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '15px', 
          marginBottom: '1rem' 
        }}
      >
        <button 
          onClick={() => navigate(-1)} 
          style={{
            backgroundColor: '#ff7043',
            color: '#fff',
            border: 'none',
            padding: '0.2rem 0.7rem',
            borderRadius: '5px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'background 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f4511e'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff7043'}
        >
          &larr; Back
        </button>
        
        <button 
          onClick={handleExport}
          style={{
            backgroundColor: '#42a5f5',
            color: '#fff',
            border: 'none',
            padding: '0.2rem 0.7rem',
            borderRadius: '5px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'background 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#42a5f5'}
        >
          Export Shot Map
        </button>

        {/* Filter Shots + xP Checkbox */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)', 
            padding: '1rem', 
            borderRadius: '8px',
            display: 'inline-flex', 
            alignItems: 'center'
          }}
        >
          <label 
            htmlFor="shotFilter" 
            style={{ 
              color: '#fff', 
              marginRight: '0.5rem', 
              fontWeight: 'bold',
              fontSize: '1.0rem'
            }}
          >
            Filter Shots:
          </label>
          <select
            id="shotFilter"
            value={shotFilter}
            onChange={(e) => setShotFilter(e.target.value)}
            style={{ 
              fontSize: '1rem', 
              padding: '0.1rem', 
              borderRadius: '4px',
              border: 'none',
              outline: 'none'
            }}
          >
            <option value="All">All</option>
            <option value="goal">Goals</option>
            <option value="point">Points</option>
            <option value="miss">Misses</option>
            <option value="setplay">SetPlays</option>
          </select>

          <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              id="xpCheckbox"
              checked={showXP}
              onChange={() => setShowXP(!showXP)}
              style={{ cursor: 'pointer' }}
            />
            <label 
              htmlFor="xpCheckbox" 
              style={{ 
                color: '#fff', 
                marginLeft: '4px', 
                fontWeight: 'bold',
                fontSize: '1.0rem',
                cursor: 'pointer'
              }}
            >
              xP
            </label>
            <InfoIcon text="xP stands for 'expected points' – the probability of scoring 1 point from this shot." />
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="stage-container">
        <Stage width={canvasSize.width} height={canvasSize.height} ref={stageRef}>
          {renderGAAPitch()}
          {renderShotsLayer()}
        </Stage>
      </div>

      {renderTooltip()}
      {renderShotDetailModal()}
    </div>
  );
}
