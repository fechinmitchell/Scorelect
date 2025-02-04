// src/components/GAAAnalysisDashboard.js

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import styled from 'styled-components';
import {
  Stage,
  Layer,
  Rect,
  Circle,
  Line,
  Arc,
  Text,
  RegularPolygon,
  Group
} from 'react-konva';
import { Radar } from 'react-chartjs-2';
import axios from 'axios';
import { useAuth } from '../AuthContext'; // or wherever your Auth is

// ---------- Default Colors & Pitch Size ----------
const defaultPitchColor = '#006400';
const defaultLineColor = '#FFFFFF';
const defaultLightStripeColor = '#228B22';
const defaultDarkStripeColor = '#006400';
const canvasSize = { width: 930, height: 530 };

// ---------- Styled Components ----------
const Container = styled.div`
  background-color: #2e2e2e;
  padding: 20px;
  min-height: 100vh;
  color: #fff;
`;

const Header = styled.h1`
  text-align: center;
  margin-bottom: 20px;
`;

const FiltersContainer = styled.div`
  background: #444;
  padding: 15px;
  border-radius: 10px;
  margin: 0 auto 20px;
  max-width: 800px;
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  justify-content: center;
`;

const Select = styled.select`
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
  background: #fff;
  color: #000;
`;

const TilesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  margin-bottom: 30px;
`;

const Tile = styled.div`
  background: #444;
  border-radius: 8px;
  padding: 15px;
  min-width: 150px;
  text-align: center;
`;

const GraphContainer = styled.div`
  margin: 20px auto;
  max-width: 930px;
`;

const GraphTitle = styled.h2`
  text-align: center;
  margin-bottom: 10px;
`;

// ---------- Helper Functions ----------

/**
 * Flatten all shots in an array of games.
 * @param {Array} games - Array of game objects (with gameData).
 * @returns {Array} - Flattened array of all shots.
 */
function flattenShots(games = []) {
    return games.flatMap((game) => game.gameData || []);
  }

/**
 * Translate a shot for consistent 'one-goal' analysis.
 */
function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = (shot.x || 0) <= halfLineX
    ? { x: 0, y: goalY }
    : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters };
}

/**
 * Translate shot if on right side, mirroring to left side.
 */
function translateShotToLeftSide(shot, halfLineX) {
  if (shot.x > halfLineX) {
    const mirroredX = 2 * halfLineX - shot.x;
    return { ...shot, x: mirroredX };
  }
  return shot;
}

/**
 * Determine shot category (goal, point, miss, etc.)
 */
function getShotCategory(actionStr) {
  const a = (actionStr || '').toLowerCase().trim();
  // Special cases
  if (a === 'penalty goal') return 'penaltyGoal';
  if (a === 'pen miss') return 'penaltyMiss';

  // Known set-play actions
  const knownSetPlayActions = [
    'free', 'missed free', 'fortyfive', 'offensive mark', 'pen miss',
    'free short', 'free wide', 'fortyfive short', 'fortyfive wide',
    'fortyfive post', 'free post', 'offensive mark short',
    'offensive mark wide', 'mark wide'
  ];
  function isSetPlayScore(str) {
    return !str.includes('wide') && !str.includes('short') && !str.includes('miss') && !str.includes('post');
  }
  if (knownSetPlayActions.some(sp => a === sp || a.includes(sp))) {
    return isSetPlayScore(a) ? 'setplay-score' : 'setplay-miss';
  }

  if (a === 'goal') return 'goal';
  const knownMisses = ['wide', 'goal miss', 'miss', 'block', 'blocked', 'post', 'short', 'pen miss'];
  if (knownMisses.some(m => a === m || a.includes(m))) return 'miss';
  if (a === 'point') return 'point';

  return 'other';
}

/**
 * Render the shape for a single shot (circle or polygon).
 */
function renderShapeForShot(category, x, y, onMouseEnter, onMouseLeave, onClick, colors) {
  // If it's a set-play, we use a hexagon
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

  // Otherwise, circle
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
 * Render a one-sided pitch with the shots mirrored onto it.
 */
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
        <Rect
          x={0}
          y={0}
          width={halfPitchWidthPx}
          height={pitchHeightPx}
          fill="black"
        />
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
        <Line
          points={[xScale * 13, 0, xScale * 13, pitchHeightPx]}
          stroke="white"
          strokeWidth={2}
        />
        <Line
          points={[xScale * 20, 0, xScale * 20, pitchHeightPx]}
          stroke="white"
          strokeWidth={2}
        />
        <Line
          points={[xScale * 45, 0, xScale * 45, pitchHeightPx]}
          stroke="white"
          strokeWidth={2}
        />
        <Line
          points={[xScale * 65, 0, xScale * 65, pitchHeightPx]}
          stroke="white"
          strokeWidth={2}
        />
        <Arc
          x={xScale * 20}
          y={yScale * 44}
          innerRadius={0}
          outerRadius={xScale * 13}
          angle={180}
          rotation={270}
          stroke="white"
          strokeWidth={2}
        />
        <Line
          points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]}
          stroke="white"
          strokeWidth={2}
        />
        <Line
          points={[
            0, yScale * 37,
            xScale * 4.5, yScale * 37,
            xScale * 4.5, yScale * 51,
            0, yScale * 51
          ]}
          stroke="white"
          strokeWidth={2}
        />
        <Line
          points={[
            0, yScale * 34.5,
            xScale * 13, yScale * 34.5,
            xScale * 13, yScale * 53.5,
            0, yScale * 53.5
          ]}
          stroke="white"
          strokeWidth={2}
        />
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
        <Line
          points={[
            0, 0,
            halfPitchWidthPx, 0,
            halfPitchWidthPx, pitchHeightPx,
            0, pitchHeightPx,
            0, 0
          ]}
          stroke="white"
          strokeWidth={2}
        />
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
            fillColor = 'yellow';
            strokeColor = '#ffffff';
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
              onClick={() => onShotClick(shot)}
            />
          );
        })}
      </Layer>
    );
  }
  
/**
 * Build data for the radar chart using goals & points by team.
 */
function buildRadarChart(games) {
  const teamStats = {};

  games.forEach((game) => {
    (game.gameData || []).forEach((sh) => {
      const tm = sh.team || 'Unknown';
      if (!teamStats[tm]) {
        teamStats[tm] = { goals: 0, points: 0, shots: 0 };
      }
      teamStats[tm].shots++;
      const a = (sh.action || '').toLowerCase();
      if (a === 'goal' || a === 'penalty goal') teamStats[tm].goals++;
      if (a === 'point') teamStats[tm].points++;
    });
  });

  const dataArray = Object.entries(teamStats).map(([team, stats]) => ({
    team,
    ...stats,
  }));

  return {
    labels: dataArray.map(d => d.team),
    datasets: [
      {
        label: 'Goals',
        data: dataArray.map(d => d.goals),
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        borderColor: 'rgba(255, 215, 0, 1)',
        borderWidth: 2,
      },
      {
        label: 'Points',
        data: dataArray.map(d => d.points),
        backgroundColor: 'rgba(57, 255, 20, 0.2)',
        borderColor: 'rgba(57, 255, 20, 1)',
        borderWidth: 2,
      },
    ],
  };
}

function radarOptions() {
  return {
    scales: {
      r: {
        ticks: {
          beginAtZero: true,
          color: '#fff'
        },
        pointLabels: {
          color: '#fff'
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: '#fff'
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
  };
}

/**
 * Render a full GAA pitch in the background, then shots on top (if desired).
 */
function renderFullGAAPitch(games, xScale, yScale, pitchColorState, lineColorState, lightStripeColorState, darkStripeColorState) {
  // Dimensions
  const pitchWidth = 145;
  const pitchHeight = 88;
  const numStripes = 10;
  const stripeWidth = canvasSize.width / numStripes;

  // Shots to be plotted:
  const allShots = flattenShots(games);
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
        points={[
          0, 0,
          canvasSize.width, 0,
          canvasSize.width, canvasSize.height,
          0, canvasSize.height,
          0, 0
        ]}
        stroke={lineColorState}
        strokeWidth={2}
      />
      <Line
        points={[
          canvasSize.width, yScale * 40.75,
          xScale * 145.2, yScale * 40.75,
          xScale * 145.2, yScale * 47.25,
          canvasSize.width, yScale * 47.25
        ]}
        stroke={lineColorState}
        strokeWidth={2}
      />
      <Line
        points={[
          0, yScale * 40.75,
          xScale * -0.2, yScale * 40.75,
          xScale * -0.2, yScale * 47.25,
          0, yScale * 47.25
        ]}
        stroke={lineColorState}
        strokeWidth={2}
      />
      <Line
        points={[
          canvasSize.width, yScale * 37,
          xScale * 140.5, yScale * 37,
          xScale * 140.5, yScale * 51,
          canvasSize.width, yScale * 51
        ]}
        stroke={lineColorState}
        strokeWidth={2}
      />
      <Line
        points={[
          0, yScale * 37,
          xScale * 4.5, yScale * 37,
          xScale * 4.5, yScale * 51,
          0, yScale * 51
        ]}
        stroke={lineColorState}
        strokeWidth={2}
      />
      <Line
        points={[
          0, yScale * 34.5,
          xScale * 13, yScale * 34.5,
          xScale * 13, yScale * 53.5,
          0, yScale * 53.5
        ]}
        stroke={lineColorState}
        strokeWidth={2}
      />
      <Line
        points={[
          canvasSize.width, yScale * 34.5,
          xScale * 132, yScale * 34.5,
          xScale * 132, yScale * 53.5,
          canvasSize.width, yScale * 53.5
        ]}
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

// ---------- Main Component ----------
export default function GAAAnalysisDashboard() {
    const { state } = useLocation();
    const { file, sport, filters } = state || {};
    const { currentUser } = useAuth();  
    const navigate = useNavigate(); 


  // Filter states
  const [appliedFilters, setAppliedFilters] = useState({
    team: filters?.team || '',
    player: filters?.player || '',
    action: filters?.action || ''
  });

  // Summaries
  const [summary, setSummary] = useState({
    totalShots: 0, 
    totalGoals: 0, 
    totalPoints: 0, 
    totalMisses: 0,
  });

  // Options for dropdown filters
  const [filterOptions, setFilterOptions] = useState({
    teams: [],
    players: [],
    actions: [],
  });

  // Data from file
  const [games, setGames] = useState([]);

  // Pitch colors
  const [pitchColorState] = useState(defaultPitchColor);
  const [lineColorState] = useState(defaultLineColor);
  const [lightStripeColorState] = useState(defaultLightStripeColor);
  const [darkStripeColorState] = useState(defaultDarkStripeColor);

  // Scaling
  const pitchWidth = 145;
  const pitchHeight = 88;
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;

  // On mount, validate & parse dataset
  // On mount, validate & parse dataset
  useEffect(() => {
    if (!file || sport !== 'GAA') {
      Swal.fire('No Data', 'Invalid or no GAA dataset found.', 'error')
        .then(() => navigate('/analysis'));
      return;
    }
    setGames(file.games || []);

    // Build filter dropdown options
    const tSet = new Set();
    const pSet = new Set();
    const aSet = new Set();
    (file.games || []).forEach(g => {
      (g.gameData || []).forEach(sh => {
        if (sh.team) tSet.add(sh.team);
        if (sh.playerName) pSet.add(sh.playerName);
        if (sh.action) aSet.add(sh.action);
      });
    });
    setFilterOptions({
      teams: Array.from(tSet),
      players: Array.from(pSet),
      actions: Array.from(aSet),
    });
  }, [file, sport, navigate]);

  // Recompute summary each time filters change
  useEffect(() => {
    let filteredGames = file?.games || [];
    if (appliedFilters.team) {
      filteredGames = filteredGames.map(g => ({
        ...g,
        gameData: (g.gameData || []).filter(sh => sh.team === appliedFilters.team)
      }));
    }
    if (appliedFilters.player) {
      filteredGames = filteredGames.map(g => ({
        ...g,
        gameData: (g.gameData || []).filter(sh => sh.playerName === appliedFilters.player)
      }));
    }
    if (appliedFilters.action) {
      filteredGames = filteredGames.map(g => ({
        ...g,
        gameData: (g.gameData || []).filter(sh => sh.action === appliedFilters.action)
      }));
    }
    filteredGames = filteredGames.filter(g => (g.gameData || []).length > 0);
    const shots = flattenShots(filteredGames);
    let totalShots = 0, totalGoals = 0, totalPoints = 0, totalMisses = 0;
    shots.forEach(sh => {
      totalShots++;
      const a = (sh.action || '').toLowerCase();
      if (a === 'goal' || a === 'penalty goal') totalGoals++;
      else if (a === 'point') totalPoints++;
      else if (a.includes('miss') || a.includes('wide') || a.includes('short')) totalMisses++;
    });
    setSummary({ totalShots, totalGoals, totalPoints, totalMisses });
    setGames(filteredGames);
  }, [file, appliedFilters]);

  const allShots = flattenShots(games);
  
    const handleRecalculate = async () => {
      try {
        // 1. The actual user ID
        const userId = currentUser?.uid;  
        if (!userId) {
          Swal.fire("Error", "No authenticated user ID found", "error");
          return;
        }
  
        // 2. The dataset name the user actually wants to recalc
        const targetDataset = file?.datasetName || "DefaultDataset";
        
        // 3. The training dataset (whatever name you store it as)
        const trainingDataset = "GAA All Shots";
  
        const payload = {
          user_id: userId,
          training_dataset: trainingDataset,
          target_dataset: targetDataset,
        };
  
        const response = await axios.post(
          'http://localhost:5001/recalculate-target-xpoints',
          payload
        );
  
        if (response.data.success) {
          Swal.fire(
            'Recalculation Complete',
            'xP and xG values have been updated for ' + targetDataset,
            'success'
          );
          // 4. If you want to show the new summary from the server:
          setSummary(response.data.summary);
  
          // 5. REFRESH from Firestore so you see new xPoints/xGoals in your UI
          await fetchUpdatedDataset(userId, targetDataset);
        }
      } catch (error) {
        console.error('Recalculation error:', error);
        Swal.fire('Error', 'Recalculation failed. Check the console for details.', 'error');
      }
    };
  
    // Example function to load from Firestore again
    const fetchUpdatedDataset = async (uid, datasetName) => {
      try {
        const loadResp = await axios.post('http://localhost:5001/load-games', {
          uid: uid,
        });
        const allGames = loadResp.data || [];
  
        // filter for the specific dataset name
        const filtered = allGames.filter(g => g.datasetName === datasetName);
  
        // Now update local state
        setGames(filtered);
      } catch (err) {
        console.error("Error fetching updated dataset:", err);
      }
    };  

  // Handlers
  const handleFilterChange = (field, value) => {
    setAppliedFilters((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Container>
      <Header>GAA Analysis Dashboard</Header>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <button
                onClick={handleRecalculate}
                style={{
                backgroundColor: '#0069d9',
                border: 'none',
                borderRadius: '5px',
                color: '#fff',
                padding: '10px 20px',
                fontSize: '1rem',
                cursor: 'pointer'
                }}
            >
                Recalculate xP/xG for Target Dataset
            </button>
        </div>

      {/* Filters */}
      <FiltersContainer>
        <Select
          value={appliedFilters.team}
          onChange={(e) => handleFilterChange('team', e.target.value)}
        >
          <option value="">All Teams</option>
          {filterOptions.teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </Select>

        <Select
          value={appliedFilters.player}
          onChange={(e) => handleFilterChange('player', e.target.value)}
        >
          <option value="">All Players</option>
          {filterOptions.players.map((player) => (
            <option key={player} value={player}>
              {player}
            </option>
          ))}
        </Select>

        <Select
          value={appliedFilters.action}
          onChange={(e) => handleFilterChange('action', e.target.value)}
        >
          <option value="">All Actions</option>
          {filterOptions.actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </Select>
      </FiltersContainer>

      {/* Summary Tiles */}
      <TilesContainer>
        <Tile>
          <h4>Total Shots</h4>
          <p>{summary.totalShots}</p>
        </Tile>
        <Tile>
          <h4>Total Goals</h4>
          <p>{summary.totalGoals}</p>
        </Tile>
        <Tile>
          <h4>Total Points</h4>
          <p>{summary.totalPoints}</p>
        </Tile>
        <Tile>
          <h4>Total Misses</h4>
          <p>{summary.totalMisses}</p>
        </Tile>
      </TilesContainer>

      {/* One-Sided Pitch Graph */}
      <GraphContainer>
        <GraphTitle>One-Sided Pitch Graph</GraphTitle>
        <Stage width={xScale * (pitchWidth / 2)} height={yScale * pitchHeight}>
          {renderOneSidePitchShots(
            allShots,
            {
              goal: '#FFFF33',
              point: '#39FF14',
              miss: 'red',
              setPlayScore: '#39FF14',
              setPlayMiss: 'red',
            },
            xScale,
            yScale,
            (shot) => {
              Swal.fire(
                'Shot Details',
                `Action: ${shot.action}\nTeam: ${shot.team}`,
                'info'
              );
            }
          )}
        </Stage>
      </GraphContainer>

      {/* Radar Chart */}
      <GraphContainer>
        <GraphTitle>Radar Chart</GraphTitle>
        <div
          style={{
            width: '500px',
            height: '450px',
            margin: '0 auto',
            background: '#444',
            borderRadius: '8px',
            padding: '10px'
          }}
        >
          <Radar
            data={buildRadarChart(games)}
            options={radarOptions()}
          />
        </div>
      </GraphContainer>

      {/* Full Pitch Graph */}
      <GraphContainer>
        <GraphTitle>Full Pitch Graph</GraphTitle>
        <Stage width={canvasSize.width} height={canvasSize.height}>
          {renderFullGAAPitch(
            games,
            xScale,
            yScale,
            pitchColorState,
            lineColorState,
            lightStripeColorState,
            darkStripeColorState
          )}
        </Stage>
      </GraphContainer>
    </Container>
  );
}
