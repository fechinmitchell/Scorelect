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

/** 
 * If you want to keep the "translateShotToOneSide" logic:
 */
function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = (shot.x || 0) <= halfLineX ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters };
}

/** 
 * We'll identify "setplay" vs. "goal/miss/point" vs. "setplay-score" or "setplay-miss"
 * 1) If it's a setplay action
 *    - If it was a "score," we say "setplay-score"
 *    - Else if it was a "miss," we say "setplay-miss"
 * 2) Otherwise fallback to your existing categories: goal / miss / point / other
 */
function getShotCategory(actionStr) {
  const a = (actionStr || '').toLowerCase().trim();

  // We'll define a list of setplay actions
  const knownSetPlayActions = [
    'free', 'missed free', 'fortyfive', 'offensive mark', 'penalty goal',
    'pen miss', 'free short', 'free wide', 'fortyfive short', 'fortyfive wide',
    'offensive mark short', 'offensive mark wide', 'mark wide'
  ];

  // Among set plays, define which ones ended in a "score" and which ended in a "miss."
  // The simplest approach: if the action includes "wide", "short", "miss", we treat it as a miss.
  // Otherwise we treat it as a "score."  Adjust as needed.
  function isSetPlayScore(a) {
    // If it doesn't contain 'wide','short','miss' => treat as score
    // You can refine your logic more specifically if you prefer
    if (a.includes('wide') || a.includes('short') || a.includes('miss')) return false;
    return true;
  }

  // 1) If it's in setplay group:
  if (knownSetPlayActions.some((sp) => a === sp)) {
    return isSetPlayScore(a) ? 'setplay-score' : 'setplay-miss';
  }

  // 2) If not setplay, check standard categories:
  // Goals
  if (a === 'goal' || a === 'penalty goal') return 'goal';

  // Miss
  const knownMisses = ['wide', 'goal miss', 'miss', 'block', 'blocked', 'post', 'short', 'pen miss'];
  if (knownMisses.some((m) => a === m)) return 'miss';

  // Points
  if (a === 'point') return 'point';

  // else fallback
  return 'other';
}

/** 
 * Decide a color or shape style given the category.
 * We'll do:
 * - 'setplay-score' => green octagon
 * - 'setplay-miss'  => red octagon
 * - 'goal' => yellow circle
 * - 'point' => green circle
 * - 'miss' => red circle
 * - 'other' => orange circle
 */
function renderShapeForShot(category, x, y, onMouseEnter, onMouseLeave) {
  // If it's a setplay, we draw an octagon
  if (category === 'setplay-score' || category === 'setplay-miss') {
    // color depends on 'score' vs 'miss'
    const fillColor = category === 'setplay-score' ? 'green' : 'red';

    return (
      <RegularPolygon
        x={x}
        y={y}
        sides={6}           // Octagon
        radius={6}         // Adjust as you like for size
        fill={fillColor}
        opacity={0.85}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }

  // Otherwise default circle logic
  let fillColor = 'orange';
  if (category === 'goal')  fillColor = 'yellow';
  if (category === 'point') fillColor = 'green';
  if (category === 'miss')  fillColor = 'red';
  // 'other' => orange

  return (
    <Circle
      x={x}
      y={y}
      radius={5}
      fill={fillColor}
      opacity={0.85}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
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

export default function PlayerShotDataGAA() {
  const { playerName } = useParams();
  const navigate = useNavigate();

  const [shotsData, setShotsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const stageRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  const canvasSize = { width: 930, height: 530 };
  const pitchWidth = 145;  
  const pitchHeight = 88;  
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;

  const halfLineX = pitchWidth / 2;
  const goalXRight = pitchWidth;    
  const goalY = pitchHeight / 2;

  const pitchColor = '#006400';
  const lineColor = '#FFFFFF';
  const lightStripeColor = '#228B22';
  const darkStripeColor = '#006400';

  // Filter: 'All', 'goal', 'point', 'miss', 'setplay-score', 'setplay-miss'
  // but let's keep it simpler: we can handle 'setplay' as a single filter, or 2 filters. 
  // We'll do a single filter "setplay" if you like. 
  const [shotFilter, setShotFilter] = useState('All');

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

        // Translate if desired
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

  // We’ll interpret the user’s filter choice 
  // in the same function that obtains the category.
  function isShotVisible(shot) {
    const cat = getShotCategory(shot.action);
    if (shotFilter === 'All') return true;
    // If shotFilter === 'setplay' => match 'setplay-score' or 'setplay-miss'
    if (shotFilter === 'setplay') {
      return (cat === 'setplay-score' || cat === 'setplay-miss');
    }
    return cat === shotFilter;
  }

  const filteredShots = shotsData.filter(isShotVisible);

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

          return (
            <Group key={i}>
              {renderShapeForShot(cat, shotX, shotY, handleMouseEnter, handleMouseLeave)}
            </Group>
          );
        })}
      </Layer>
    );
  }

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

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (filteredShots.length === 0) {
    return <ErrorMessage message="No shots found for this filter or player." />;
  }

  return (
    <div style={{ position: 'relative' }}>
      <h1 style={{ textAlign: 'center', color: '#fff' }}>
        Shot Map for {playerName}
      </h1>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '1rem' }}>
        <button onClick={() => navigate(-1)}>&larr; Back</button>
        <button onClick={handleExport}>Export Shot Map</button>

        {/* Filter Shots */}
        <div>
          <label style={{ color: '#fff', marginRight: '6px' }}>Filter Shots:</label>
          <select
            value={shotFilter}
            onChange={(e) => setShotFilter(e.target.value)}
            style={{ fontSize: '1rem' }}
          >
            <option value="All">All</option>
            <option value="goal">Goals</option>
            <option value="point">Points</option>
            <option value="miss">Misses</option>
            <option value="setplay">SetPlays</option>
          </select>
        </div>
      </div>

      <div className="stage-container">
    <Stage width={930} height={530} ref={stageRef}>
      {renderGAAPitch()}
      {renderShotsLayer()}
    </Stage>
  </div>

      {renderTooltip()}
    </div>
  );
}
