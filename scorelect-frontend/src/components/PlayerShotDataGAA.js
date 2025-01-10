// src/components/PlayerShotDataGAA.js

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';  // or '../firebase' if your structure differs
import Swal from 'sweetalert2';
import PropTypes from 'prop-types';
import { Stage, Layer, Rect, Line, Circle, Text, Group, Arc } from 'react-konva';
import Modal from 'react-modal';
import './PlayerShotDataGAA.css';

// Set the app element for accessibility (required by react-modal)
Modal.setAppElement('#root');

/**
 * Translate a shot to reference one goal based on half-line.
 * Adds a 'distMeters' property to the shot for distance from nearest goal.
 */
function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = (shot.x || 0) <= halfLineX ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters };
}

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

ErrorMessage.propTypes = {
  message: PropTypes.string.isRequired,
};

const PlayerShotDataGAA = () => {
  const { playerName } = useParams();  // e.g. "/player/David Clifford"
  const navigate = useNavigate();

  // Shots, loading/error states
  const [shotsData, setShotsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Konva / Canvas references
  const stageRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  // Canvas dimensions and pitch scaling
  const [canvasSize] = useState({ width: 930, height: 530 });
  const pitchWidthMeters = 145;  // GAA pitch width
  const pitchHeightMeters = 88;  // GAA pitch height
  const xScale = canvasSize.width / pitchWidthMeters;
  const yScale = canvasSize.height / pitchHeightMeters;

  // We consider the GAA pitch “center” at (goalX=145, goalY=44).
  const halfLineX = pitchWidthMeters / 2; // 72.5
  const goalXRight = pitchWidthMeters;    // 145
  const goalY = pitchHeightMeters / 2;    // 44

  // Pitch styling
  const pitchColor = '#006400';
  const lineColor = '#FFFFFF';
  const lightStripeColor = '#228B22';
  const darkStripeColor = '#006400';

  // Filter: "All", "point", "goal", "miss"
  const [shotFilter, setShotFilter] = useState('All');

  // -----------------------------
  // 1) On mount, fetch the All Shots doc for GAA, then filter for playerName
  // -----------------------------
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

        const { gameData } = docSnap.data();
        if (!gameData || !Array.isArray(gameData) || gameData.length === 0) {
          Swal.fire({
            title: 'No Data',
            text: 'No shots in "All Shots GAA".',
            icon: 'info',
            confirmButtonText: 'OK',
          });
          navigate('/');
          return;
        }

        // Filter only the shots for this player
        // Make sure you match the correct field: e.g., "playerName" 
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
          navigate(-1); // go back to the Leaderboard
          return;
        }

        // Translate them to one side if you want
        const translated = filtered.map((shot) =>
          translateShotToOneSide(shot, halfLineX, goalXRight, goalY)
        );

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

  // -----------------------------
  // 2) Export Shot Map as PNG
  // -----------------------------
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

  // -----------------------------
  // 3) Filter logic
  // -----------------------------
  const filteredShots = shotsData.filter((shot) => {
    const outcome = (shot.action || '').toLowerCase();
    if (shotFilter === 'All') return true;
    if (shotFilter === 'goal') return outcome === 'goal';
    if (shotFilter === 'point') return outcome === 'point';
    if (shotFilter === 'miss') return outcome === 'miss';
    return true;
  });

  // -----------------------------
  // 4) Colors
  // -----------------------------
  function getShotColor(action) {
    const a = (action || '').toLowerCase();
    if (a === 'goal') return 'yellow';
    if (a === 'point') return 'green';
    if (a === 'miss') return 'red';
    return 'orange'; // default
  }

  // -----------------------------
  // 5) Render pitch lines
  // -----------------------------
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
      <Line points={[canvasSize.width, yScale * 37, xScale * 139, yScale * 37, xScale * 139, yScale * 51, canvasSize.width, yScale * 51]} stroke={lineColor} strokeWidth={2} />
      <Line points={[0, yScale * 37, xScale * 6, yScale * 37, xScale * 6, yScale * 51, 0, yScale * 51]} stroke={lineColor} strokeWidth={2} />
      <Line points={[0, yScale * 34.5, xScale * 14, yScale * 34.5, xScale * 14, yScale * 53.5, 0, yScale * 53.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[canvasSize.width, yScale * 34.5, xScale * 131, yScale * 34.5, xScale * 131, yScale * 53.5, canvasSize.width, yScale * 53.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5]} stroke={lineColor} strokeWidth={2} />
      <Arc x={xScale * 124} y={yScale * 44} innerRadius={0} outerRadius={xScale * 12} angle={180} rotation={90} stroke={lineColor} strokeWidth={2} />
      <Arc x={xScale * 21} y={yScale * 44} innerRadius={0} outerRadius={xScale * 12} angle={180} rotation={270} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 14, 0, xScale * 14, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 131, 0, xScale * 131, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 21, 0, xScale * 21, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 124, 0, xScale * 124, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 45, 0, xScale * 45, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 100, 0, xScale * 100, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 65, 0, xScale * 65, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      <Line points={[xScale * 80, 0, xScale * 80, canvasSize.height]} stroke={lineColor} strokeWidth={2} />

      {/* "SCORELECT" in the end zones */}
      <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSize.height / 40.25} fontSize={canvasSize.width / 60} f  fill="#D3D3D3" opacity={0.7} rotation={0} align="center" />
      <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 22.5} y={canvasSize.height / 1.02} fontSize={canvasSize.width / 60} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />

      </Layer>
    );
  };

  // -----------------------------
  // 6) Render Shots
  // -----------------------------
  function renderShotsLayer() {
    return (
      <Layer>
        {filteredShots.map((shot, index) => {
          const shotX = (shot.x || 0) * xScale;
          const shotY = (shot.y || 0) * yScale;
          const fillColor = getShotColor(shot.action);

          return (
            <Group key={index}>
              <Circle
                x={shotX}
                y={shotY}
                radius={5}
                fill={fillColor}
                opacity={0.7}
                onMouseEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'pointer';
                  setTooltip({
                    visible: true,
                    x: e.evt.layerX,
                    y: e.evt.layerY,
                    content: `Action: ${shot.action}\nX: ${shot.x?.toFixed(1)}, Y: ${shot.y?.toFixed(1)}`,
                  });
                }}
                onMouseLeave={() => {
                  if (stageRef.current) {
                    stageRef.current.container().style.cursor = 'default';
                  }
                  setTooltip({ ...tooltip, visible: false });
                }}
              />
            </Group>
          );
        })}
      </Layer>
    );
  }

  // Tooltip for X, Y, action
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
          padding: '5px 10px',
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

  // -----------------------------
  // Rendering final
  // -----------------------------
  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (shotsData.length === 0) {
    return <ErrorMessage message="No shots found for this player." />;
  }

  return (
    <div className="player-shot-data-container" style={{ position: 'relative' }}>
      <h1 style={{ textAlign: 'center', color: '#fff' }}>Shots for {playerName}</h1>

      {/* Filter + Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '1rem' }}>
        <button onClick={() => navigate(-1)}>&larr; Back</button>
        <button onClick={handleExport}>Export Shot Map</button>

        {/* Filter Shots */}
        <div>
          <label style={{ color: '#fff', marginRight: '8px' }}>Filter Shots:</label>
          <select
            value={shotFilter}
            onChange={(e) => setShotFilter(e.target.value)}
            style={{ fontSize: '1rem', padding: '4px' }}
          >
            <option value="All">All</option>
            <option value="goal">Goals</option>
            <option value="point">Points</option>
            <option value="miss">Misses</option>
          </select>
        </div>
      </div>

      {/* The pitch */}
      <Stage width={canvasSize.width} height={canvasSize.height} ref={stageRef}>
        {renderGAAPitch()}
        {renderShotsLayer()}
      </Stage>
      {renderTooltip()}
    </div>
  );
};

export default PlayerShotDataGAA;
