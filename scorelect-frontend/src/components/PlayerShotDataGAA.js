// src/components/PlayerShotDataGAA.js

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import Swal from 'sweetalert2';
import {
  Stage, Layer, Rect, Circle, RegularPolygon, Text,
  Line, Group, Arc
} from 'react-konva';
import Modal from 'react-modal';
import { Radar } from 'react-chartjs-2';  // <-- Radar chart from react-chartjs-2
import 'chart.js/auto';                 // <-- required for Chart.js v3+

import './PlayerShotDataGAA.css';

// Make <Modal> accessible
Modal.setAppElement('#root');

// Default colors
const defaultPitchColor = '#006400';
const defaultLineColor = '#FFFFFF';
const defaultLightStripeColor = '#228B22';
const defaultDarkStripeColor = '#006400';
const canvasSize = { width: 930, height: 530 };



const InfoIcon = ({ text }) => (
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

function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = (shot.x || 0) <= halfLineX ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx*dx + dy*dy);
  return { ...shot, distMeters };
}

function getShotCategory(actionStr) {
  const a = (actionStr || '').toLowerCase().trim();
  const knownSetPlayActions = [
    'free', 'missed free', 'fortyfive', 'offensive mark', 'penalty goal',
    'pen miss', 'free short', 'free wide', 'fortyfive short', 'fortyfive wide', 'fortyfive post', 'free post',
    'offensive mark short', 'offensive mark wide', 'mark wide'
  ];
  function isSetPlayScore(a) {
    if (a.includes('wide') || a.includes('short') || a.includes('miss') || a.includes('post')) return false;
    return true;
  }
  if (knownSetPlayActions.some((sp) => a === sp)) {
    return isSetPlayScore(a) ? 'setplay-score' : 'setplay-miss';
  }
  if (a === 'goal' || a === 'penalty goal') return 'goal';
  const knownMisses = ['wide','goal miss','miss','block','blocked','post','short','pen miss'];
  if (knownMisses.some((m) => a === m)) return 'miss';
  if (a === 'point') return 'point';
  return 'other';
}

function renderShapeForShot(category, x, y, onMouseEnter, onMouseLeave, onClick, colors) {
  if (category === 'setplay-score' || category === 'setplay-miss') {
    const fillColor = category === 'setplay-score' ? colors.setPlayScore : colors.setPlayMiss;
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
  if (category==='goal')  fillColor = colors.goal;
  if (category==='point') fillColor = colors.point;
  if (category==='miss')  fillColor = colors.miss;
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

function translateShotToLeftSide(shot, halfLineX) {
    // If shot is on the right half, mirror it to the left half
    let newX = shot.x;
    if (shot.x > halfLineX) {
      newX = 2 * halfLineX - shot.x;
    }
    return { ...shot, x: newX };
  }  

  function renderOneSidePitchShots(shots, colors, xScale, yScale) {
    const pitchWidth = 145;
    const pitchHeight = 88;
    const halfLineX = pitchWidth / 2;
    const goalX = 0;
    const goalY = pitchHeight / 2;
  
    const numStripes = 10;
    const halfPitchWidthPx = xScale * halfLineX;
    const pitchHeightPx = yScale * pitchHeight;
    const stripeWidthPx = halfPitchWidthPx / numStripes;
  
    return (
      <Layer>
        {/* Black background for half pitch */}
        <Rect 
          x={0} 
          y={0} 
          width={halfPitchWidthPx} 
          height={pitchHeightPx} 
          fill="black" 
        />
  
        {/* White outer boundary and half-line markings */}
        <Rect 
          x={0} 
          y={0} 
          width={halfPitchWidthPx} 
          height={pitchHeightPx} 
          stroke="white" 
          strokeWidth={2} 
          fill="transparent" 
        />
        <Line 
          points={[halfPitchWidthPx, 0, halfPitchWidthPx, pitchHeightPx]} 
          stroke="white" 
          strokeWidth={2} 
        />
  
        <Line points={[xScale * 13, 0, xScale * 13, pitchHeightPx]} stroke="white" strokeWidth={2} />

        <Line points={[xScale * 20, 0, xScale * 20, pitchHeightPx]} stroke="white" strokeWidth={2} />

        <Line points={[xScale * 45, 0, xScale * 45, pitchHeightPx]} stroke="white" strokeWidth={2} />

        <Line points={[xScale * 65, 0, xScale * 65, pitchHeightPx]} stroke="white" strokeWidth={2} />

        <Arc x={xScale * 20} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={270} stroke="white" strokeWidth={2} />

        <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke="white" strokeWidth={2} />

        <Line points={[0, yScale * 37, xScale * 4.5, yScale * 37, xScale * 4.5, yScale * 51, 0, yScale * 51]} stroke="white" strokeWidth={2} />

        <Line points={[0, yScale * 34.5, xScale * 13, yScale * 34.5, xScale * 13, yScale * 53.5, 0, yScale * 53.5]} stroke="white" strokeWidth={2} />

        <Arc
        x={xScale * 0}
        y={yScale * 44}
        innerRadius={xScale * 40}    // Set equal to outerRadius
        outerRadius={xScale * 40}
        angle={120}
        rotation={300}
        stroke="white"
        strokeWidth={2}
        closed={false}
        lineCap="round"
        />

        {/* Outer boundary around half pitch */}
        <Line 
          points={[0, 0, halfPitchWidthPx, 0, halfPitchWidthPx, pitchHeightPx, 0, pitchHeightPx, 0, 0]} 
          stroke={defaultLineColor} 
          strokeWidth={2} 
        />
  
        {/* Plot each translated shot on one side */}
        {shots.map((shot, i) => {
          const mirroredShot = translateShotToLeftSide(shot, halfLineX);
          const translated = translateShotToOneSide(mirroredShot, halfLineX, goalX, goalY);
          const shotX = translated.x * xScale;
          const shotY = translated.y * yScale;
          const baseRadius = 5;
          const radius = baseRadius + (translated.xPoints ? translated.xPoints * 0.5 : 0);
  
          const category = getShotCategory(shot.action);
          let fillColor = 'black';
          let strokeColor = 'white';
          let strokeWidth = 2;
  
          if (category === 'goal') {
            fillColor = colors.goal || 'orange';
            strokeColor = null;
          } else if (category === 'point') {
            fillColor = colors.point || 'green';
            strokeColor = null;
          } else if (category === 'setplay-score') {
            fillColor = colors.setPlayScore || 'green';
          } else if (category === 'setplay-miss') {
            fillColor = colors.setPlayMiss || 'red';
          }
  
          return (
            <Circle
              key={i}
              x={shotX}
              y={shotY}
              radius={radius}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeColor ? strokeWidth : 0}
              opacity={0.85}
            />
          );
        })}
      </Layer>
    );
  }
  
  

function RadarChartGAA({ aggregatedData, selectedPlayers, primaryPlayer }) {
  const labels = ['Points','2 Pointers','Goals','Offensive Marks','Frees','45s'];
  const datasets = [];

  if (primaryPlayer) {
    const stats = aggregatedData[primaryPlayer] || {};
    datasets.push({
      label: primaryPlayer,
      data: [
        stats.points || 0,
        stats.twoPointers || 0,
        stats.goals || 0,
        stats.offensiveMarks || 0,
        stats.frees || 0,
        stats.fortyFives || 0
      ],
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2
    });
  }

  selectedPlayers.forEach((p) => {
    if(p === primaryPlayer) return;
    const stats = aggregatedData[p] || {};
    datasets.push({
      label: p,
      data: [
        stats.points || 0,
        stats.twoPointers || 0,
        stats.goals || 0,
        stats.offensiveMarks || 0,
        stats.frees || 0,
        stats.fortyFives || 0
      ],
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 2
    });
  });

  const chartData = { labels, datasets };

  const chartOptions = {
    scale: {
      ticks: {
        beginAtZero: true,
        stepSize: 30,
        callback: function(value) {
          const allData = this.chart.data.datasets.flatMap(ds => ds.data);
          const max = Math.max(...allData);
          return value === max ? value : '';
        }
      },
      pointLabels: { fontSize: 14, fontColor: '#fff' }
    },
    plugins: {
      legend: { labels: { color: '#fff' } }
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div style={{ width: '500px', height: '450px', margin: '1rem auto', backgroundColor:'rgba(0,0,0,0.2)', borderRadius:'8px', padding:'1rem' }}>
      <h3 style={{ color:'#fff', textAlign:'center' }}>
        Radar Chart Comparison <InfoIcon text="Compare players across selected categories." />
      </h3>
      {datasets.length > 0 ? (
        <div style={{ width:'100%', height:'400px' }}>
          <Radar data={chartData} options={chartOptions} />
        </div>
      ) : (
        <p style={{ color:'#ddd', textAlign:'center' }}>No players selected yet.</p>
      )}
    </div>
  );
}

export default function PlayerShotDataGAA() {
  const { playerName } = useParams();
  const navigate = useNavigate();

  const [pitchColorState, setPitchColorState] = useState(defaultPitchColor);
  const [lineColorState, setLineColorState] = useState(defaultLineColor);
  const [lightStripeColorState, setLightStripeColorState] = useState(defaultLightStripeColor);
  const [darkStripeColorState, setDarkStripeColorState] = useState(defaultDarkStripeColor);

  const [colorGoal, setColorGoal] = useState('#FFFF33');
  const [colorPoint, setColorPoint] = useState('#39FF14');
  const [colorMiss, setColorMiss] = useState('red');
  const [colorSetPlayScore, setColorSetPlayScore] = useState('#39FF14');
  const [colorSetPlayMiss, setColorSetPlayMiss] = useState('red');

  const [shotsData, setShotsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const stageRef = useRef(null);

  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const [selectedShot, setSelectedShot] = useState(null);

  const [shotFilter, setShotFilter] = useState('All');
  const [showXP, setShowXP] = useState(false);

  const canvasSize = { width: 930, height: 530 };
  const pitchWidth = 145;
  const pitchHeight = 88;
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;

  const halfLineX = pitchWidth/2;
  const goalXRight = pitchWidth;
  const goalY = pitchHeight/2;

  const [allShots, setAllShots] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [playersInTeam, setPlayersInTeam] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  const [aggregatedData, setAggregatedData] = useState({});

  const [showColorModal, setShowColorModal] = useState(false);

  const customModalStyles = {
    content: {
      maxWidth: '500px',
      margin: 'auto',
      padding: '20px',
      borderRadius: '8px',
      backgroundColor: '#2e2e2e',
      color: '#fff'
    },
    overlay: {
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 9999
    }
  };
  Modal.setAppElement('#root');

  useEffect(() => {
    async function fetchAllShots() {
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
        setAllShots(gameData);
        const thisPlayerShots = gameData.filter(
          (s) => (s.playerName || '').toLowerCase() === playerName.toLowerCase()
        );
        if (!thisPlayerShots.length) {
          Swal.fire({
            title: 'No Data',
            text: `No shots found for player: ${playerName}`,
            icon: 'info',
            confirmButtonText: 'OK',
          });
          navigate(-1);
          return;
        }
        const translated = thisPlayerShots.map((shot) =>
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
    fetchAllShots();
  }, [playerName, navigate, halfLineX, goalXRight, goalY]);

  useEffect(() => {
    if (!allShots.length) return;
    
    const aggregator = {};
    const uniqueTeams = new Set();

    allShots.forEach((s) => {
      const pName = s.playerName || 'Unknown';
      const teamName = s.team || 'Unknown';
      uniqueTeams.add(teamName);

      if (!aggregator[pName]) {
        aggregator[pName] = {
          team: teamName,
          points: 0,
          twoPointers: 0,
          goals: 0,
          offensiveMarks: 0,
          frees: 0,
          fortyFives: 0,
        };
      }

      const entry = aggregator[pName];
      const act = (s.action || '').toLowerCase().trim();

      if (act === 'point') {
        entry.points += 1;
        const translatedShot = translateShotToOneSide(s, halfLineX, goalXRight, goalY);
        if (
          typeof translatedShot.x === 'number' &&
          typeof translatedShot.y === 'number' &&
          translatedShot.distMeters >= 40
        ) {
          entry.twoPointers += 1;
        }
      }

      if (act === 'goal' || act === 'penalty goal') {
        entry.goals += 1;
      }

      if (
        act.includes('offensive mark') &&
        !act.includes('wide') &&
        !act.includes('short') &&
        !act.includes('miss')
      ) {
        entry.offensiveMarks += 1;
      }

      if (
        act === 'free' ||
        act === 'missed free' ||
        act === 'free wide' ||
        act === 'free short'
      ) {
        entry.frees += 1;
      }

      if (act.includes('fortyfive')) {
        entry.fortyFives += 1;
      }
    });

    setAggregatedData(aggregator);
    setTeams([...uniqueTeams]);
  }, [allShots, halfLineX, goalXRight, goalY]);

  useEffect(() => {
    if (!selectedTeam || !aggregatedData) {
      setPlayersInTeam([]);
      return;
    }
    const result = Object.entries(aggregatedData)
      .filter(([pName, stats]) => stats.team === selectedTeam)
      .map(([pName]) => pName);
    setPlayersInTeam(result);
  }, [selectedTeam, aggregatedData]);

  function handleShotClick(shot) {
    setSelectedShot(shot);
  }
  function closeModal() {
    setSelectedShot(null);
  }

  function isShotVisible(shot) {
    const cat = getShotCategory(shot.action);
    if (shotFilter === 'All') return true;
    if (shotFilter === 'setplay') {
      return (cat === 'setplay-score' || cat === 'setplay-miss');
    }
    return cat === shotFilter;
  }
  const filteredShots = shotsData.filter(isShotVisible);
  
  function renderHalfPitch() {
    const numStripes = 10;
    const halfWidth = canvasSize.width / 2;
    const stripeWidth = halfWidth / numStripes;
    
    return (
      <Layer>
        <Rect
          x={0}
          y={0}
          width={halfWidth}
          height={canvasSize.height}
          fill={pitchColorState}
        />
        {Array.from({ length: numStripes }, (_, i) => (
          <Rect
            key={i}
            x={i * stripeWidth}
            y={0}
            width={stripeWidth}
            height={canvasSize.height}
            fill={i % 2 === 0 ? lightStripeColorState : darkStripeColorState}
            opacity={0.3}
          />
        ))}
        <Line 
          points={[0, 0, halfWidth, 0, halfWidth, canvasSize.height, 0, canvasSize.height, 0, 0]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[
            halfWidth, yScale * 40.75,
            halfWidth, yScale * 47.25
          ]}
          stroke={lineColorState}
          strokeWidth={2}
        />
        <Line 
          points={[
            0, yScale * 40.75,
            0, yScale * 47.25
          ]}
          stroke={lineColorState}
          strokeWidth={2}
        />
        <Line 
          points={[
            halfWidth, yScale * 37,
            halfWidth, yScale * 51
          ]}
          stroke={lineColorState}
          strokeWidth={2}
        />
        <Line 
          points={[
            0, yScale * 37,
            0, yScale * 51
          ]}
          stroke={lineColorState}
          strokeWidth={2}
        />
        <Line 
          points={[
            0, yScale * 34.5,
            0, yScale * 53.5
          ]}
          stroke={lineColorState}
          strokeWidth={2}
        />
        <Line 
          points={[
            halfWidth, yScale * 34.5,
            halfWidth, yScale * 53.5
          ]}
          stroke={lineColorState}
          strokeWidth={2}
        />
        <Line 
          points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[Math.min(xScale * 134, halfWidth), yScale * 43.5, Math.min(xScale * 134, halfWidth), yScale * 44.5]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Arc 
          x={Math.min(xScale * 125, halfWidth)} 
          y={yScale * 44} 
          innerRadius={0} 
          outerRadius={xScale * 13} 
          angle={180} 
          rotation={90} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Arc 
          x={Math.min(xScale * 20, halfWidth)} 
          y={yScale * 44} 
          innerRadius={0} 
          outerRadius={xScale * 13} 
          angle={180} 
          rotation={270} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 13, 0, xScale * 13, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[Math.min(xScale * 132, halfWidth), 0, Math.min(xScale * 132, halfWidth), canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[Math.min(xScale * 20, halfWidth), 0, Math.min(xScale * 20, halfWidth), canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[Math.min(xScale * 125, halfWidth), 0, Math.min(xScale * 125, halfWidth), canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[Math.min(xScale * 45, halfWidth), 0, Math.min(xScale * 45, halfWidth), canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[Math.min(xScale * 100, halfWidth), 0, Math.min(xScale * 100, halfWidth), canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[Math.min(xScale * 65, halfWidth), 0, Math.min(xScale * 65, halfWidth), canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[Math.min(xScale * 80, halfWidth), 0, Math.min(xScale * 80, halfWidth), canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Arc
          x={xScale * 0}
          y={yScale * 44}
          innerRadius={xScale * 40}
          outerRadius={xScale * 40}
          angle={120}
          rotation={300}
          stroke={lineColorState}
          strokeWidth={2}
          closed={false}
          lineCap="round"
        />
        <Arc
          x={Math.min(xScale * 145, halfWidth)}
          y={yScale * 44}
          innerRadius={xScale * 40}
          outerRadius={xScale * 40}
          angle={120}
          rotation={120}
          stroke={lineColorState}
          strokeWidth={2}
          closed={false}
          lineCap="round"
        />
        <Text 
          text="SCORELECT.COM" 
          x={xScale * 22.5} 
          y={canvasSize.height / 40.25} 
          fontSize={canvasSize.width / 60} 
          fill="#D3D3D3" 
          opacity={0.7} 
          rotation={0} 
          align="center" 
        />
        <Text 
          text="SCORELECT.COM" 
          x={halfWidth - xScale * 22.5} 
          y={canvasSize.height / 1.02} 
          fontSize={canvasSize.width / 60} 
          fill="#D3D3D3" 
          opacity={0.7} 
          rotation={180} 
          align="center" 
        />
      </Layer>
    );
  }
  

  function renderGAAPitch() {
    const numStripes = 10;
    const stripeWidth = canvasSize.width / numStripes;
  
    return (
      <Layer>
        <Rect
          x={0}
          y={0}
          width={canvasSize.width}
          height={canvasSize.height}
          fill={pitchColorState}
        />
  
        {Array.from({ length: numStripes }, (_, i) => (
          <Rect
            key={i}
            x={i * stripeWidth}
            y={0}
            width={stripeWidth}
            height={canvasSize.height}
            fill={i % 2 === 0 ? lightStripeColorState : darkStripeColorState}
            opacity={0.3}
          />
        ))}
  
        <Line 
          points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[canvasSize.width, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasSize.width, yScale * 47.25]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[canvasSize.width, yScale * 37, xScale * 140.5, yScale * 37, xScale * 140.5, yScale * 51, canvasSize.width, yScale * 51]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[0, yScale * 37, xScale * 4.5, yScale * 37, xScale * 4.5, yScale * 51, 0, yScale * 51]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[0, yScale * 34.5, xScale * 13, yScale * 34.5, xScale * 13, yScale * 53.5, 0, yScale * 53.5]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[canvasSize.width, yScale * 34.5, xScale * 132, yScale * 34.5, xScale * 132, yScale * 53.5, canvasSize.width, yScale * 53.5]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Arc 
          x={xScale * 125} 
          y={yScale * 44} 
          innerRadius={0} 
          outerRadius={xScale * 13} 
          angle={180} 
          rotation={90} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Arc 
          x={xScale * 20} 
          y={yScale * 44} 
          innerRadius={0} 
          outerRadius={xScale * 13} 
          angle={180} 
          rotation={270} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 13, 0, xScale * 13, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 132, 0, xScale * 132, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 20, 0, xScale * 20, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 125, 0, xScale * 125, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 45, 0, xScale * 45, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 100, 0, xScale * 100, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 65, 0, xScale * 65, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 80, 0, xScale * 80, canvasSize.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
  
        <Arc
          x={xScale * 0}
          y={yScale * 44}
          innerRadius={xScale * 40}
          outerRadius={xScale * 40}
          angle={120}
          rotation={300}
          stroke={lineColorState}
          strokeWidth={2}
          closed={false}
          lineCap="round"
        />
  
        <Arc
          x={xScale * 145}
          y={yScale * 44}
          innerRadius={xScale * 40}
          outerRadius={xScale * 40}
          angle={120}
          rotation={120}
          stroke={lineColorState}
          strokeWidth={2}
          closed={false}
          lineCap="round"
        />
  
        <Text 
          text="SCORELECT.COM" 
          x={xScale * 22.5} 
          y={canvasSize.height / 40.25} 
          fontSize={canvasSize.width / 60} 
          fill="#D3D3D3" 
          opacity={0.7} 
          rotation={0} 
          align="center" 
        />
        <Text 
          text="SCORELECT.COM" 
          x={canvasSize.width - xScale * 22.5} 
          y={canvasSize.height / 1.02} 
          fontSize={canvasSize.width / 60} 
          fill="#D3D3D3" 
          opacity={0.7} 
          rotation={180} 
          align="center" 
        />
      </Layer>
    );
  }
  

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
              content: `Action: ${shot.action}\nX:${shot.x?.toFixed(1)}, Y:${shot.y?.toFixed(1)}`
            });
          };
          const handleMouseLeave = () => {
            if (stageRef.current) stageRef.current.container().style.cursor = 'default';
            setTooltip(t => ({ ...t, visible: false }));
          };
          const handleClick = () => handleShotClick(shot);

          return (
            <Group key={i}>
              {renderShapeForShot(cat, shotX, shotY, handleMouseEnter, handleMouseLeave, handleClick, {
                goal: colorGoal,
                point: colorPoint,
                miss: colorMiss,
                setPlayScore: colorSetPlayScore,
                setPlayMiss: colorSetPlayMiss
                })}

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
          zIndex: 10
        }}
      >
        {tooltip.content}
      </div>
    );
  }

  function renderSelectedShotDetails() {
    if (!selectedShot) return null;
    const cat = getShotCategory(selectedShot.action);
    const isGoal = (cat === 'goal');
    const distMeters = typeof selectedShot.distMeters === 'number' ? selectedShot.distMeters.toFixed(1) : 'N/A';
    const foot = selectedShot.foot || 'N/A';
    const pressure = selectedShot.pressure || 'N/A';
    const position = selectedShot.position || 'N/A';

    let metricLabel = isGoal ? 'xG' : 'xP';
    let metricValue = isGoal ? selectedShot.xGoals : selectedShot.xPoints;
    if (typeof metricValue === 'number') {
      metricValue = metricValue.toFixed(2);
    } else {
      metricValue = 'N/A';
    }

    const advValue = typeof selectedShot.xP_adv === 'number'
      ? selectedShot.xP_adv.toFixed(2)
      : 'N/A';

    return (
      <div style={{ lineHeight: '1.6' }}>
        <p><strong>Action:</strong> {selectedShot.action}</p>
        <p><strong>Distance (m):</strong> {distMeters}</p>
        <p><strong>Foot:</strong> {foot}</p>
        <p><strong>Pressure:</strong> {pressure}</p>
        <p><strong>Position:</strong> {position}</p>
        <p><strong>{metricLabel}:</strong> {metricValue}</p>
        <p><strong>xP_ADV:</strong> {advValue}</p>
      </div>
    );
  }

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

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (!filteredShots.length) {
    return <ErrorMessage message="No shots found for this filter or player." />;
  }

  function togglePlayer(pName) {
    if (selectedPlayers.includes(pName)) {
      setSelectedPlayers(selectedPlayers.filter(x => x !== pName));
    } else {
      setSelectedPlayers([...selectedPlayers, pName]);
    }
  }

  return (
    <div style={{ position:'relative', color:'#fff' }}>
      <h1 style={{ textAlign:'center', color:'#fff' }}>Shot Map for {playerName}</h1>

      {/* Buttons */}
      <div style={{ display:'flex', justifyContent:'center', gap:'15px', marginBottom:'1rem' }}>
        <button 
          onClick={()=>navigate(-1)}
          style={{
            backgroundColor: '#ff7043',
            color: '#fff',
            border:'none',
            padding:'0.2rem 0.7rem',
            borderRadius:'5px',
            fontSize:'1rem',
            fontWeight:'bold',
            cursor:'pointer',
            boxShadow:'0 4px 6px rgba(0,0,0,0.1)',
            transition:'background 0.3s ease'
          }}
          onMouseEnter={(e)=> e.currentTarget.style.backgroundColor='#f4511e'}
          onMouseLeave={(e)=> e.currentTarget.style.backgroundColor='#ff7043'}
        >
          &larr; Back
        </button>

        <button
          onClick={handleExport}
          style={{
            backgroundColor: '#42a5f5',
            color:'#fff',
            border:'none',
            padding:'0.2rem 0.7rem',
            borderRadius:'5px',
            fontSize:'1rem',
            fontWeight:'bold',
            cursor:'pointer',
            boxShadow:'0 4px 6px rgba(0,0,0,0.1)',
            transition:'background 0.3s ease'
          }}
          onMouseEnter={(e)=> e.currentTarget.style.backgroundColor='#1e88e5'}
          onMouseLeave={(e)=> e.currentTarget.style.backgroundColor='#42a5f5'}
        >
          Export Shot Map
        </button>

        {/* Filter */}
        <div
          style={{
            background:'rgba(0,0,0,0.3)',
            padding:'1rem',
            borderRadius:'8px',
            display:'inline-flex',
            alignItems:'center'
          }}
        >
          <label
            htmlFor="shotFilter"
            style={{
              color:'#fff',
              marginRight:'0.5rem',
              fontWeight:'bold',
              fontSize:'1.0rem'
            }}
          >
            Filter Shots:
          </label>
          <select
            id="shotFilter"
            value={shotFilter}
            onChange={(e)=> setShotFilter(e.target.value)}
            style={{
              fontSize:'1rem',
              padding:'0.1rem',
              borderRadius:'4px',
              border:'none',
              outline:'none'
            }}
          >
            <option value="All">All</option>
            <option value="goal">Goals</option>
            <option value="point">Points</option>
            <option value="miss">Misses</option>
            <option value="setplay">SetPlays</option>
          </select>

          <div style={{ marginLeft:'1rem', display:'flex', alignItems:'center' }}>
            <input
              type="checkbox"
              id="xpCheckbox"
              checked={showXP}
              onChange={()=> setShowXP(!showXP)}
              style={{ cursor:'pointer' }}
            />
            <label
              htmlFor="xpCheckbox"
              style={{
                color:'#fff',
                marginLeft:'4px',
                fontWeight:'bold',
                fontSize:'1.0rem',
                cursor:'pointer'
              }}
            >
              xP
            </label>
            <InfoIcon text="Expected Points: Probability of scoring 1 point from this shot." />
          </div>
        </div>

        {/* Custom Color Button */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <button 
            onClick={() => setShowColorModal(true)}
            style={{
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 1.5rem',    // increased padding
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
            transition: 'background 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#444'} 
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#333'}
        >
            Custom Color
        </button>
        </div>


      {/* Color Modal */}
      {showColorModal && (
        <Modal
        isOpen={showColorModal}
        onRequestClose={() => setShowColorModal(false)}
        style={customModalStyles}
        contentLabel="Customize Colors"
      >
        <h2 className="color-modal-header">Customize Colors</h2>
        <div className="color-modal-grid">
            <div>
                <label style={{ color: '#fff' }}>Pitch Color:</label>
                <input type="color" value={pitchColorState} onChange={(e) => setPitchColorState(e.target.value)} />
            </div>
            <div>
                <label style={{ color: '#fff' }}>Line Color:</label>
                <input type="color" value={lineColorState} onChange={(e) => setLineColorState(e.target.value)} />
            </div>
            <div>
                <label style={{ color: '#fff' }}>Light Stripe Color:</label>
                <input type="color" value={lightStripeColorState} onChange={(e) => setLightStripeColorState(e.target.value)} />
            </div>
            <div>
                <label style={{ color: '#fff' }}>Dark Stripe Color:</label>
                <input type="color" value={darkStripeColorState} onChange={(e) => setDarkStripeColorState(e.target.value)} />
            </div>
            <div>
                <label style={{ color: '#fff' }}>Goal Color:</label>
                <input type="color" value={colorGoal} onChange={(e) => setColorGoal(e.target.value)} />
            </div>
            <div>
                <label style={{ color: '#fff' }}>Point Color:</label>
                <input type="color" value={colorPoint} onChange={(e) => setColorPoint(e.target.value)} />
            </div>
            <div>
                <label style={{ color: '#fff' }}>Miss Color:</label>
                <input type="color" value={colorMiss} onChange={(e) => setColorMiss(e.target.value)} />
            </div>
            <div>
                <label style={{ color: '#fff' }}>SetPlay Score Color:</label>
                <input type="color" value={colorSetPlayScore} onChange={(e) => setColorSetPlayScore(e.target.value)} />
            </div>
            <div>
                <label style={{ color: '#fff' }}>SetPlay Miss Color:</label>
                <input type="color" value={colorSetPlayMiss} onChange={(e) => setColorSetPlayMiss(e.target.value)} />
            </div>
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <button 
                onClick={() => setShowColorModal(false)}
                style={{
                backgroundColor:'#607d8b',
                color:'#fff',
                border:'none',
                padding:'0.5rem 1rem',
                borderRadius:'5px',
                fontSize:'0.9rem',
                fontWeight:'bold',
                cursor:'pointer'
                }}
            >
                Set as Default
            </button>
            </div>
        </Modal>
        )}

      </div>


      {/* The Pitch */}
      <div className="stage-container">
        <Stage width={canvasSize.width} height={canvasSize.height} ref={stageRef}>
          {renderGAAPitch()}
          {renderShotsLayer()}
        </Stage>
      </div>
      {renderTooltip()}
      {selectedShot && (
        <Modal
          isOpen={!!selectedShot}
          onRequestClose={() => setSelectedShot(null)}
          style={customModalStyles}
          contentLabel="Shot Details"
        >
          <h2 style={{ marginTop: 0 }}>Shot Details</h2>
          {renderSelectedShotDetails()}
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <button
              onClick={closeModal}
              style={{
                backgroundColor:'#607d8b',
                color:'#fff',
                border:'none',
                padding:'0.5rem 1rem',
                borderRadius:'5px',
                fontSize:'0.9rem',
                fontWeight:'bold',
                cursor:'pointer',
                boxShadow:'0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      <div style={{ marginTop:'3rem', padding:'1rem', background:'rgba(0,0,0,0.2)' }}>
        <h2 style={{ color:'#fff', textAlign:'center' }}>Compare Players on Radar Chart</h2>


        {/* Team Dropdown */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'1rem', gap:'1rem' }}>
          <div>
            <label htmlFor="teamSelect" style={{ color:'#fff', marginRight:'8px' }}>Select Team:</label>
            <select
              id="teamSelect"
              value={selectedTeam}
              onChange={(e)=> setSelectedTeam(e.target.value)}
              style={{ padding:'6px', borderRadius:'4px' }}
            >
              <option value="">-- Choose a Team --</option>
              {teams.map((tm,i)=>(
                <option key={i} value={tm}>{tm}</option>
              ))}
            </select>
          </div>

          {selectedTeam && playersInTeam.length>0 && (
            <div>
              <label htmlFor="playerSelect" style={{ color:'#fff', marginRight:'8px' }}>Select Player:</label>
              <select
                id="playerSelect"
                onChange={(e)=> {
                  const pName=e.target.value;
                  if(pName) togglePlayer(pName);
                }}
                style={{ padding:'6px', borderRadius:'4px' }}
              >
                <option value="">-- Choose Player --</option>
                {playersInTeam.map((pName,i)=>(
                  <option key={i} value={pName}>{pName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ textAlign:'center', marginBottom:'1rem' }}>
          {selectedPlayers.map((pName)=>(
            <span
              key={pName}
              style={{
                display:'inline-block',
                backgroundColor:'#f44336',
                color:'#fff',
                padding:'0.2rem 0.6rem',
                borderRadius:'4px',
                margin:'0 6px',
                cursor:'pointer'
              }}
              onClick={()=> togglePlayer(pName)}
            >
              {pName} &times;
            </span>
          ))}
        </div>


        <RadarChartGAA 
          aggregatedData={aggregatedData}
          selectedPlayers={selectedPlayers}
          primaryPlayer={playerName}
        />

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <h3 style={{ color: '#fff' }}>One-Sided Pitch Shots</h3>
        <div className="stage-container">
            <Stage width={xScale * (pitchWidth / 2)} height={yScale * pitchHeight}>
            {renderHalfPitch()}
            {renderOneSidePitchShots(shotsData, {
                goal: colorGoal,
                point: colorPoint,
                miss: colorMiss,
                setPlayScore: colorSetPlayScore,
                setPlayMiss: colorSetPlayMiss
            }, xScale, yScale)}
            </Stage>
        </div>
        </div>

      </div>
    </div>
  );
}
