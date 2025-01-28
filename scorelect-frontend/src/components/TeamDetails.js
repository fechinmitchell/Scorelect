// src/components/TeamShotDataGAA.js

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
import { Radar } from 'react-chartjs-2';  // Radar chart from react-chartjs-2
import 'chart.js/auto';                 // required for Chart.js v3+

import PropTypes from 'prop-types';      // Import PropTypes

import './TeamDetails.css';

// Make <Modal> accessible
Modal.setAppElement('#root');

// Default colors
const defaultPitchColor = '#006400';
const defaultLineColor = '#FFFFFF';
const defaultLightStripeColor = '#228B22';
const defaultDarkStripeColor = '#006400';
const canvasSize = { width: 930, height: 530 };

// InfoIcon Component for tooltips
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

InfoIcon.propTypes = {
  text: PropTypes.string.isRequired,
};

/**
 * Translates a shot to one side based on team orientation.
 * @param {Object} shot - The shot data.
 * @param {number} halfLineX - The x-coordinate of the half line.
 * @param {number} goalX - The x-coordinate of the goal.
 * @param {number} goalY - The y-coordinate of the goal.
 * @returns {Object} - Translated shot data with distance.
 */
function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = (shot.x || 0) <= halfLineX ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters };
}

/**
 * Categorizes a shot based on its action description.
 * @param {string} actionStr - The action description.
 * @returns {string} - The category of the shot.
 */
function getShotCategory(actionStr) {
  const a = (actionStr || '').toLowerCase().trim();

  // 1) Special-case penalty goal
  if (a === 'penalty goal') {
    return 'penaltyGoal';
  }
  if (a === 'pen miss') {
    return 'penaltyMiss'; // if you want to treat a missed penalty differently
  }

  // Then your normal logic...
  const knownSetPlayActions = [
    'free', 'missed free', 'fortyfive', 'offensive mark', 'penalty goal',
    'pen miss', 'free short', 'free wide', 'fortyfive short', 'fortyfive wide',
    'fortyfive post', 'free post', 'offensive mark short', 'offensive mark wide', 'mark wide'
  ];

  function isSetPlayScore(a) {
    if (a.includes('wide') || a.includes('short') || a.includes('miss') || a.includes('post')) return false;
    return true;
  }

  if (knownSetPlayActions.some(sp => a === sp)) {
    return isSetPlayScore(a) ? 'setplay-score' : 'setplay-miss';
  }
  if (a === 'goal') return 'goal';
  
  const knownMisses = ['wide','goal miss','miss','block','blocked','post','short','pen miss'];
  if (knownMisses.some(m => a === m)) return 'miss';
  if (a === 'point') return 'point';

  return 'other';
}

/**
 * Renders shapes on the pitch based on shot category.
 */
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
  if (category === 'goal') fillColor = colors.goal;
  if (category === 'point') fillColor = colors.point;
  if (category === 'miss') fillColor = colors.miss;
  
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

/**
 * Loading Indicator Component
 */
function LoadingIndicator() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading team data...</p>
    </div>
  );
}

/**
 * Error Message Component
 */
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

/**
 * Translates a shot to the left side for consistent visualization.
 */
function translateShotToLeftSide(shot, halfLineX) {
  // If shot is on the right half, mirror it to the left half
  let newX = shot.x;
  if (shot.x > halfLineX) {
    newX = 2 * halfLineX - shot.x;
  }
  return { ...shot, x: newX };
}


function renderOneSidePitchShots(shots, colors, xScale, yScale, onShotClick) {
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
        innerRadius={xScale * 40}    
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
        stroke="white" 
        strokeWidth={2} 
      />

      {/* Plot each translated shot on one side, now clickable */}
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

        if (category === 'penaltyGoal') {
          fillColor = 'yellow';      // 
          strokeColor = '#ffffff';    // white ring
          strokeWidth = 2;
        }
        

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
        } else if (category === 'miss') {
          fillColor = colors.miss || 'red';
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
            // Handle click to open the same modal as the main pitch
            onClick={() => onShotClick(shot)}
          />
        );
      })}
    </Layer>
  );
}

renderOneSidePitchShots.propTypes = {
  shots: PropTypes.array.isRequired,
  colors: PropTypes.object.isRequired,
  xScale: PropTypes.number.isRequired,
  yScale: PropTypes.number.isRequired,
  onShotClick: PropTypes.func.isRequired,
};

/**
 * RadarChartGAA Component for Comparative Analysis
 */
function RadarChartGAA({ aggregatedData, selectedTeams, primaryTeam }) {
  const labels = ['Points','2 Pointers','Goals','Offensive Marks','Frees','45s'];
  const datasets = [];

  if (primaryTeam) {
    const stats = aggregatedData[primaryTeam] || {};
    datasets.push({
      label: primaryTeam,
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

  selectedTeams.forEach((tm) => {
    if(tm === primaryTeam) return;
    const stats = aggregatedData[tm] || {};
    datasets.push({
      label: tm,
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
    scales: {
      r: {
        ticks: {
          beginAtZero: true,
          stepSize: 30,
          color: '#fff',  // tick numbers white
          callback: function(value) {
            const allData = this.chart.data.datasets.flatMap(ds => ds.data);
            const max = Math.max(...allData);
            return value === max ? value : '';
          },
        },
        pointLabels: {
          color: '#fff',  // category labels white
          font: {
            size: 14
          },
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: '#fff', // legend label color
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
  };  

  return (
    <div style={{ width: '500px', height: '450px', margin: '1rem auto', backgroundColor:'rgba(0,0,0,0.2)', borderRadius:'8px', padding:'1rem' }}>
      <h3 style={{ color:'#fff', textAlign:'center' }}>
        Radar Chart Comparison <InfoIcon text="Compare teams across selected categories." />
      </h3>
      {datasets.length > 0 ? (
        <div style={{ width:'100%', height:'400px' }}>
          <Radar data={chartData} options={chartOptions} />
        </div>
      ) : (
        <p style={{ color:'#ddd', textAlign:'center' }}>No teams selected yet.</p>
      )}
    </div>
  );
}

RadarChartGAA.propTypes = {
  aggregatedData: PropTypes.object.isRequired,
  selectedTeams: PropTypes.array.isRequired,
  primaryTeam: PropTypes.string
};

/**
 * Legend Component for Shot Categories
 */
function renderLegendOneSideShots(colors, stageWidth, stageHeight) {
  const legendItems = [
    { label: 'Penalty Goal', color: '#FFFF00', hasWhiteBorder: true },
    { label: 'Goal', color: colors.goal, hasWhiteBorder: false },
    { label: 'Point', color: colors.point, hasWhiteBorder: false },
    { label: 'Miss', color: colors.miss, hasWhiteBorder: false },
    { label: 'SetPlay Score', color: colors.setPlayScore, hasWhiteBorder: true },
    { label: 'SetPlay Miss', color: colors.setPlayMiss, hasWhiteBorder: true },
  ];

  const itemHeight = 20;
  const legendWidth = 160; // Adjust width as needed
  const legendHeight = legendItems.length * itemHeight + 10;

  return (
    <Group>
      <Group x={stageWidth - legendWidth - 10} y={stageHeight - legendHeight - 10}>
        {/* Background for the legend box */}
        <Rect
          x={0}
          y={0}
          width={legendWidth}
          height={legendHeight}
          fill="rgba(0, 0, 0, 0.5)" 
          cornerRadius={5}
        />
        {legendItems.map((item, i) => {
          const yPos = i * itemHeight + 10;

          return (
            <Group key={i}>
              <Circle
                x={15}
                y={yPos}
                radius={5}
                fill={item.color}
                stroke={item.hasWhiteBorder ? '#fff' : null}  // Apply white border if specified
                strokeWidth={item.hasWhiteBorder ? 2 : 0}
              />
              <Text
                x={30}
                y={yPos - 6}
                text={item.label}
                fontSize={12}
                fill="#fff"
              />
            </Group>
          );
        })}
      </Group>
    </Group>
  );
}

renderLegendOneSideShots.propTypes = {
  colors: PropTypes.object.isRequired,
  stageWidth: PropTypes.number.isRequired,
  stageHeight: PropTypes.number.isRequired,
};

/**
 * TeamShotDataGAA Component
 */
export default function TeamShotDataGAA() {
  const { teamName } = useParams();
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

  const canvasSizeMain = { width: 930, height: 530 };
  const pitchWidth = 145;
  const pitchHeight = 88;
  const xScale = canvasSizeMain.width / pitchWidth;
  const yScale = canvasSizeMain.height / pitchHeight;

  const halfLineX = pitchWidth / 2;
  const goalXRight = pitchWidth;
  const goalY = pitchHeight / 2;

  const [allShots, setAllShots] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [playersInTeam, setPlayersInTeam] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]); // Correctly define selectedTeams

  const [aggregatedData, setAggregatedData] = useState({});

  const [showColorModal, setShowColorModal] = useState(false);

  const [primaryTeam, setPrimaryTeam] = useState(teamName); // Primary team from URL

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

  /**
   * Fetch all shots and filter by team
   */
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
        const teamShots = gameData.filter(
          (s) => (s.team || '').toLowerCase() === teamName.toLowerCase()
        );
        if (!teamShots.length) {
          Swal.fire({
            title: 'No Data',
            text: `No shots found for team: ${teamName}`,
            icon: 'info',
            confirmButtonText: 'OK',
          });
          navigate(-1);
          return;
        }
        const translated = teamShots.map((shot) =>
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
  }, [teamName, navigate, halfLineX, goalXRight, goalY]);

  /**
   * Aggregate data for radar charts and statistics
   */
  useEffect(() => {
    if (!allShots.length) return;
    
    const aggregator = {};
    const uniqueTeams = new Set();

    allShots.forEach((s) => {
      const tmName = s.team || 'Unknown Team';
      uniqueTeams.add(tmName);

      // Initialize team stats if not present
      if (!aggregator[tmName]) {
        aggregator[tmName] = {
          team: tmName,

          // Existing fields
          points: 0,
          twoPointers: 0,
          goals: 0,
          offensiveMarks: 0,
          frees: 0,
          fortyFives: 0,

          // New fields for Shots/Frees/45s success vs. total
          totalShots: 0,
          successfulShots: 0,

          totalFrees: 0,
          successfulFrees: 0,

          total45s: 0,
          successful45s: 0,

          misses: 0, // optional if you want to store misses here
        };
      }

      const entry = aggregator[tmName];
      const act = (s.action || '').toLowerCase().trim();

      // 1) Every record is a "shot"
      entry.totalShots += 1;

      // 2) If it's a point => +1 point, +1 successfulShots
      if (act === 'point') {
        entry.points += 1;
        entry.successfulShots += 1;

        // Count 2p if >=40m
        const translatedShot = translateShotToOneSide(
          s,
          halfLineX,  // halfLineX
          goalXRight,      // goalX
          goalY    // goalY
        );
        if (
          typeof translatedShot.distMeters === 'number' &&
          translatedShot.distMeters >= 40
        ) {
          entry.twoPointers += 1;
        }
      }

      // 3) If it's a goal => +1 goal, +1 successfulShots
      if (act === 'goal' || act === 'penalty goal') {
        entry.goals += 1;
        entry.successfulShots += 1;
      }

      // 4) Miss logic (wide, post, short, blocked, etc.)
      if (
        act === 'miss' ||
        act === 'wide' ||
        act === 'short' ||
        act.includes('miss') ||
        act.includes('wide') ||
        act.includes('short') ||
        act.includes('post') ||
        act === 'goal miss' ||
        act === 'pen miss'
      ) {
        entry.misses += 1;
      }

      // 5) Offensive Mark (if not missed)
      if (
        act.includes('offensive mark') &&
        !act.includes('wide') &&
        !act.includes('short') &&
        !act.includes('miss')
      ) {
        entry.offensiveMarks += 1;
        // If it scored from that mark, also +1 successfulShots.
        // If "offensive mark" always implies a point:
        entry.successfulShots += 1;
      }

      // 6) Count frees => totalFrees++ for all free attempts
      if (
        act === 'free' ||
        act === 'missed free' ||
        act === 'free wide' ||
        act === 'free short' ||
        act === 'free post'
      ) {
        entry.frees += 1;        // existing logic
        entry.totalFrees += 1;   // new
        // If exactly "free" => that usually means a successful free
        if (act === 'free') {
          entry.successfulShots += 1;
          entry.successfulFrees += 1;
        }
      }

      // 7) Count 45s => total45s++ for all 45 attempts
      // If exactly "fortyfive" => that typically means a successful 45 (scored a point)
      if (
        act.includes('fortyfive') ||
        act.includes('45')
      ) {
        entry.fortyFives += 1;   // existing logic
        entry.total45s += 1;     // new
        // Check if it’s exactly "fortyfive" or "45" with no "wide"/"short"/"miss"
        if (
          act === 'fortyfive' ||
          act === '45'
        ) {
          entry.successfulShots += 1;
          entry.successful45s += 1;
        }
      }
    });

    setAggregatedData(aggregator);
    setTeams([...uniqueTeams]);
  }, [allShots, halfLineX, goalXRight, goalY]);

  /**
   * Update players in the team based on selectedTeam
   */
  useEffect(() => {
    if (!selectedTeam || !aggregatedData) {
      setPlayersInTeam([]);
      return;
    }
    const result = Object.entries(aggregatedData)
      .filter(([tmName, stats]) => tmName === selectedTeam)
      .map(([tmName]) => tmName);
    setPlayersInTeam(result);
  }, [selectedTeam, aggregatedData]);

  /**
   * Handle shot click to open modal with details
   */
  function handleShotClick(shot) {
    setSelectedShot(shot);
  }
  function closeModal() {
    setSelectedShot(null);
  }

  /**
   * Determine if a shot should be visible based on filter
   */
  function isShotVisible(shot) {
    const cat = getShotCategory(shot.action);
    if (shotFilter === 'All') return true;
    if (shotFilter === 'setplay') {
      return (cat === 'setplay-score' || cat === 'setplay-miss');
    }
    return cat === shotFilter;
  }
  const filteredShots = shotsData.filter(isShotVisible);
  
 
  function renderGAAPitch() {
    const numStripes = 10;
    const stripeWidth = canvasSizeMain.width / numStripes;
  
    return (
      <Layer>
        <Rect
          x={0}
          y={0}
          width={canvasSizeMain.width}
          height={canvasSizeMain.height}
          fill={pitchColorState}
        />

        {Array.from({ length: numStripes }, (_, i) => (
          <Rect
            key={i}
            x={i * stripeWidth}
            y={0}
            width={stripeWidth}
            height={canvasSizeMain.height}
            fill={i % 2 === 0 ? lightStripeColorState : darkStripeColorState}
            opacity={0.3}
          />
        ))}

        <Line 
          points={[0, 0, canvasSizeMain.width, 0, canvasSizeMain.width, canvasSizeMain.height, 0, canvasSizeMain.height, 0, 0]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[canvasSizeMain.width, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasSizeMain.width, yScale * 47.25]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[canvasSizeMain.width, yScale * 37, xScale * 140.5, yScale * 37, xScale * 140.5, yScale * 51, canvasSizeMain.width, yScale * 51]} 
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
          points={[canvasSizeMain.width, yScale * 34.5, xScale * 132, yScale * 34.5, xScale * 132, yScale * 53.5, canvasSizeMain.width, yScale * 53.5]} 
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
          points={[xScale * 13, 0, xScale * 13, canvasSizeMain.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 132, 0, xScale * 132, canvasSizeMain.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 20, 0, xScale * 20, canvasSizeMain.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 125, 0, xScale * 125, canvasSizeMain.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 45, 0, xScale * 45, canvasSizeMain.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 100, 0, xScale * 100, canvasSizeMain.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 65, 0, xScale * 65, canvasSizeMain.height]} 
          stroke={lineColorState} 
          strokeWidth={2} 
        />
        <Line 
          points={[xScale * 80, 0, xScale * 80, canvasSizeMain.height]} 
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
          y={canvasSizeMain.height / 40.25} 
          fontSize={canvasSizeMain.width / 60} 
          fill="#D3D3D3" 
          opacity={0.7} 
          rotation={0} 
          align="center" 
        />
        <Text 
          text="SCORELECT.COM" 
          x={canvasSizeMain.width - xScale * 22.5} 
          y={canvasSizeMain.height / 1.02} 
          fontSize={canvasSizeMain.width / 60} 
          fill="#D3D3D3" 
          opacity={0.7} 
          rotation={180} 
          align="center" 
        />
      </Layer>
    );
  }
  
  /**
   * Render shots on the pitch
   */
  function renderShotsLayer() {
    return (
      <Layer>
        {filteredShots.map((shot, i) => {

          const handleMouseEnter = (e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';

            // Decide xG or xP:
            const cat = getShotCategory(shot.action);
            const isGoal = cat === 'goal';
            const label = isGoal ? 'xG' : 'xP';
            const xpOrXg = isGoal
              ? (typeof shot.xGoals === 'number' ? shot.xGoals.toFixed(2) : 'N/A')
              : (typeof shot.xPoints === 'number' ? shot.xPoints.toFixed(2) : 'N/A');
          
            // Distance:
            const distVal = (typeof shot.distMeters === 'number')
              ? `${shot.distMeters.toFixed(1)}m`
              : 'N/A';
          
            // Pressure:
            const pressureVal = shot.pressure || 'N/A';
          
            // Show tooltip with multiline info:
            setTooltip({
              visible: true,
              x: e.evt.layerX,
              y: e.evt.layerY,
              content: `${label}: ${xpOrXg}\nDistance: ${distVal}\nPressure: ${pressureVal}`,
            });
          };

          const handleMouseLeave = () => {
            const stage = stageRef.current;
            if (stage) stage.container().style.cursor = 'default';
            setTooltip(prev => ({ ...prev, visible: false }));
          };

          const handleClick = () => {
            handleShotClick(shot);
          };

          const cat = getShotCategory(shot.action);
          const shotX = (shot.x || 0) * xScale;
          const shotY = (shot.y || 0) * yScale;
          
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

  /**
   * Radar Chart Component
   */
  // (Already defined above as RadarChartGAA)

  /**
   * Legend for the pitch
   */
  // (Already defined above as renderLegendOneSideShots)

  /**
   * Aggregated Team Stats and Radar Chart
   */
  // (Already handled in RadarChartGAA)

  /**
   * Handle Exporting the Pitch as an Image
   */
  function handleExport() {
    if (stageRef.current) {
      stageRef.current.toDataURL({
        pixelRatio: 2,
        callback: (dataUrl) => {
          const link = document.createElement('a');
          link.download = `${teamName}_shot_map.png`;
          link.href = dataUrl;
          link.click();
        },
      });
    }
  }

  /**
   * Render Tooltip
   */
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

  /**
   * Render Selected Shot Details in Modal
   */
  function renderSelectedShotDetails() {
    if (!selectedShot) return null;
    const cat = getShotCategory(selectedShot.action);
    const isGoal = cat === 'goal';
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

  /**
   * Handle Team Selection Toggle
   */
  function toggleTeam(team) {
    if (selectedTeams.includes(team)) {
      setSelectedTeams(selectedTeams.filter(x => x !== team));
    } else {
      setSelectedTeams([...selectedTeams, team]);
    }
  }

  /**
   * Handle Exporting the Pitch as an Image
   */
  // Already handled in handleExport()

  /**
   * Render Component
   */
  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (!filteredShots.length) {
    return <ErrorMessage message="No shots found for this filter or team." />;
  }

  return (
    <div style={{ position:'relative', color:'#fff' }}>
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

      {/* Pitch and Stats Section */}
      <div 
        style={{ 
          marginTop: '3rem',
          padding: '1rem',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          gap: '2rem',
          justifyContent: 'center', 
          alignItems: 'flex-start'
        }}
      >
        {/* Column 1: The pitch */}
        <div style={{ textAlign: 'center' }}>
          <div className="stage-container">
            <Stage width={xScale * (pitchWidth / 2)} height={yScale * pitchHeight}>
              {renderGAAPitch()}
              {renderOneSidePitchShots(
                filteredShots,
                {
                  goal: colorGoal,
                  point: colorPoint,
                  miss: colorMiss,
                  setPlayScore: colorSetPlayScore,
                  setPlayMiss: colorSetPlayMiss
                },
                xScale,
                yScale,
                handleShotClick
              )}
            </Stage>
          </div>
        </div>

        {/* Column 2: Team Stats */}
        <div 
          style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '1rem',
            borderRadius: '8px',
            marginTop: '20px',
            minWidth: '200px',
            color: '#fff'
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
            {teamName}'s Stats
          </h3>

          {/* Display aggregated team stats */}
          <p><strong>Total Shots:</strong> {aggregatedData[teamName]?.totalShots || 0}</p>
          <p><strong>Successful Shots:</strong> {aggregatedData[teamName]?.successfulShots || 0}</p>
          <p><strong>Points:</strong> {aggregatedData[teamName]?.points || 0}</p>
          <p><strong>Goals:</strong> {aggregatedData[teamName]?.goals || 0}</p>
          <p><strong>Misses:</strong> {aggregatedData[teamName]?.misses || 0}</p>
          <p><strong>Offensive Marks:</strong> {aggregatedData[teamName]?.offensiveMarks || 0}</p>
          <p><strong>Frees:</strong> {aggregatedData[teamName]?.frees || 0}</p>
          <p><strong>45s:</strong> {aggregatedData[teamName]?.fortyFives || 0}</p>
          <p><strong>2-Pointers:</strong> {aggregatedData[teamName]?.twoPointers || 0}</p>
          <p><strong>Avg Distance:</strong> {((aggregatedData[teamName]?.totalShots || 0) > 0
            ? (aggregatedData[teamName].totalShots && aggregatedData[teamName].successfulShots
                ? (aggregatedData[teamName].successfulShots / aggregatedData[teamName].totalShots).toFixed(2)
                : '0.00')
            : '0.00')} m</p>
        </div>
      </div>

      {/* Radar Chart Section */}
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: '2rem' }}>
        <RadarChartGAA 
          aggregatedData={aggregatedData}
          selectedTeams={selectedTeams}
          primaryTeam={primaryTeam}
        />
      </div>

      {/* Buttons */}
      <div style={{ display:'flex', justifyContent:'center', gap:'15px', marginTop: '20px', marginBottom:'1rem' }}>
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
              padding: '0.75rem 1.5rem',
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
      </div>

      {/* The Main Full Pitch */}
      <div className="stage-container">
        <Stage width={canvasSizeMain.width} height={canvasSizeMain.height} ref={stageRef}>
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
    </div>
  );
}

TeamShotDataGAA.propTypes = {
  // Since this component uses hooks and doesn't receive props directly, you can omit this.
  // Alternatively, if you plan to pass props in the future, define them accordingly.
};
