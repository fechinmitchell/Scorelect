// src/components/PlayerShotDataGAA.js

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import Swal from 'sweetalert2';
import { Stage } from 'react-konva';
import Modal from 'react-modal';
import { Radar } from 'react-chartjs-2';
import 'chart.js/auto';
import styled from 'styled-components';
import './PlayerShotDataGAA.css';


// Import pitch renderers & helper from your GAAPitchComponents
import {
  renderGAAPitch,
  renderOneSidePitchShots,
  translateShotToOneSide,
  getShotCategory
} from './GAAPitchComponents';

// Or if it's not in GAAPitchComponents, define it here:
import { Layer, Group, Rect, Circle, Text } from 'react-konva';

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

/**
 * Renders a small legend box in the bottom-right of a Stage
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
  const legendWidth = 160; 
  const legendHeight = legendItems.length * itemHeight + 10;

  return (
    <Layer>
      <Group x={stageWidth - legendWidth - 10} y={stageHeight - legendHeight - 10}>
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
                stroke={item.hasWhiteBorder ? '#fff' : null}
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
    </Layer>
  );
}

// Some default color constants
const defaultPitchColor = '#006400';
const defaultLineColor = '#FFFFFF';
const defaultLightStripeColor = '#228B22';
const defaultDarkStripeColor = '#006400';
const canvasSize = { width: 930, height: 530 };

/** Styled Components for a nice layout */
const PageContainer = styled.div`
  min-height: 100vh;
  background: #1c1c1c;
  color: #f0f0f0;
  padding: 2rem;
`;

const Section = styled.div`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const Title = styled.h2`
  text-align: center;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #ffc107;  
`;

const FiltersContainer = styled.div`
  background: #3a3a3a;
  padding: 1rem;
  border-radius: 8px;
  max-width: 600px;
  margin: 0 auto 2rem auto;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
`;

const FilterLabel = styled.label`
  margin-right: 0.5rem;
  font-weight: bold;
`;

const FilterSelect = styled.select`
  padding: 0.5rem;
  border-radius: 5px;
  border: 1px solid #777;
  background: #fff;
  color: #000;
  min-width: 120px;
  font-size: 0.9rem;
`;

const PitchAndStatsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start;
`;

const StatsCard = styled.div`
  background: #333;
  padding: 1rem;
  border-radius: 8px;
  min-width: 250px;
  max-width: 350px;
`;

const StatsHeading = styled.h3`
  margin-top: 0;
  margin-bottom: 1rem;
  font-weight: 600;
  color: #ffc107;
`;

const StatItem = styled.p`
  margin: 0.25rem 0;
`;

const StyledButton = styled.button`
  background-color: #4f8ef7;
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 5px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  transition: background 0.3s ease;
  &:hover {
    background-color: #357ad2;
  }
`;

// Loading & Error Components
function LoadingIndicator() {
  return (
    <div className="loading-screen">
      {/* Text now appears above the spinner */}
      <h2 className="loading-text">Loading player data...</h2>
      <div className="spinner"></div>
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

Modal.setAppElement('#root');

export default function PlayerShotDataGAA() {
  const { playerName } = useParams();
  const navigate = useNavigate();
  const stageRef = useRef(null);

  // Pitch color states
  const [pitchColorState] = useState(defaultPitchColor);
  const [lineColorState] = useState(defaultLineColor);
  const [lightStripeColorState] = useState(defaultLightStripeColor);
  const [darkStripeColorState] = useState(defaultDarkStripeColor);

  // Shot color states
  const [colorGoal] = useState('#FFFF33');
  const [colorPoint] = useState('#39FF14');
  const [colorMiss] = useState('red');
  const [colorSetPlayScore] = useState('#39FF14');
  const [colorSetPlayMiss] = useState('red');

  // Shots data
  const [allShots, setAllShots] = useState([]);
  const [playerShots, setPlayerShots] = useState([]); // Shots for this single player
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Aggregated stats for "playerName"
  const [stats, setStats] = useState({
    team: 'N/A',
    totalShots: 0,
    successfulShots: 0,
    points: 0,
    goals: 0,
    misses: 0,
    offensiveMarks: 0,
    totalFrees: 0,
    successfulFrees: 0,
    total45s: 0,
    successful45s: 0,
    totalXP: 0,
    totalXG: 0,
    avgDist: 0
  });

  // **New** Filter for shot type
  const [shotTypeFilter, setShotTypeFilter] = useState('');

  // Scaling
  const pitchWidth = 145;
  const pitchHeight = 88;
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;
  const halfLineX = pitchWidth / 2;
  const goalXRight = pitchWidth;
  const goalY = pitchHeight / 2;

  // Shot details modal
  const [selectedShot, setSelectedShot] = useState(null);

  // ------------- Fetch Shots -------------
  useEffect(() => {
    async function fetchShots() {
      try {
        setLoading(true);
        const USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
        const DATASET_NAME = 'All Shots GAA';
        const docRef = doc(firestore, `savedGames/${USER_ID}/games`, DATASET_NAME);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          Swal.fire('No Data', 'Could not find "All Shots GAA" dataset!', 'info')
            .then(() => navigate('/'));
          return;
        }

        const { gameData } = docSnap.data() || {};
        if (!gameData || !Array.isArray(gameData)) {
          Swal.fire('No Shots', 'No shot data found in "All Shots GAA".', 'info')
            .then(() => navigate('/'));
          return;
        }

        setAllShots(gameData);

        // Filter for this player
        const theseShots = gameData.filter(
          (s) => (s.playerName || '').toLowerCase() === playerName.toLowerCase()
        );
        if (!theseShots.length) {
          Swal.fire('No Data', `No shots found for player: ${playerName}`, 'info')
            .then(() => navigate(-1));
          return;
        }

        // Translate to the left side for consistent distance measure
        const translated = theseShots.map((shot) =>
          translateShotToOneSide(shot, halfLineX, goalXRight, goalY)
        );
        setPlayerShots(translated);
      } catch (err) {
        setError(err.message);
        Swal.fire('Error', err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchShots();
  }, [playerName, navigate, halfLineX, goalXRight, goalY]);

  // ------------- Compute Aggregated Stats for This Player -------------
  useEffect(() => {
    if (!playerShots.length) return;

    let aggregator = {
      team: 'N/A',
      totalShots: 0,
      successfulShots: 0,
      points: 0,
      goals: 0,
      misses: 0,
      offensiveMarks: 0,
      totalFrees: 0,
      successfulFrees: 0,
      total45s: 0,
      successful45s: 0,
      totalXP: 0,
      totalXG: 0,
      totalDist: 0
    };

    playerShots.forEach((shot) => {
      if (shot.team && aggregator.team === 'N/A') {
        aggregator.team = shot.team;
      }
      aggregator.totalShots++;
      aggregator.totalXP += (shot.xPoints || 0);
      aggregator.totalXG += (shot.xGoals || 0);
      aggregator.totalDist += (typeof shot.distMeters === 'number' ? shot.distMeters : 0);

      const cat = getShotCategory(shot.action);

      // goals
      if (cat === 'goal' || cat === 'penaltyGoal') {
        aggregator.goals++;
        aggregator.successfulShots++;
      }
      // points
      else if (cat === 'point') {
        aggregator.points++;
        aggregator.successfulShots++;
      }
      // misses
      else if (cat === 'miss') {
        aggregator.misses++;
      }

      const act = (shot.action || '').toLowerCase();
      // offensive marks
      if (act.includes('offensive mark') && !act.includes('wide') && !act.includes('short') && !act.includes('miss')) {
        aggregator.offensiveMarks++;
        aggregator.successfulShots++;
      }
      // frees
      if (act.includes('free')) {
        aggregator.totalFrees++;
        if (act.trim() === 'free') {
          aggregator.successfulFrees++;
          aggregator.successfulShots++;
        }
      }
      // 45s
      if (act.includes('45') || act.includes('fortyfive')) {
        aggregator.total45s++;
        if (act.trim() === '45' || act.trim() === 'fortyfive') {
          aggregator.successful45s++;
          aggregator.successfulShots++;
        }
      }
    });

    let avgDist = 0;
    if (aggregator.totalShots > 0) {
      avgDist = aggregator.totalDist / aggregator.totalShots;
    }

    setStats({
      ...aggregator,
      avgDist
    });
  }, [playerShots]);

  // ========== FILTER the Shots by shotTypeFilter ==========
  // If shotTypeFilter is empty => show all. 
  // If shotTypeFilter is 'free', show only shots whose action includes "free".
  // etc.
  const filteredShots = playerShots.filter((shot) => {
    if (!shotTypeFilter) return true; 
    // check if shot.action includes the filter string
    const act = (shot.action || '').toLowerCase();
    return act.includes(shotTypeFilter.toLowerCase());
  });

  // ------------- Shot Modal -------------
  function handleShotClick(shot) {
    setSelectedShot(shot);
  }
  function closeModal() {
    setSelectedShot(null);
  }
  function renderSelectedShotDetails() {
    if (!selectedShot) return null;
    const cat = getShotCategory(selectedShot.action);
    const isGoal = cat === 'goal' || cat === 'penaltyGoal';

    const distVal = typeof selectedShot.distMeters === 'number'
      ? `${selectedShot.distMeters.toFixed(2)} m`
      : 'N/A';
    const metricLabel = isGoal ? 'xG' : 'xP';
    const metricValueRaw = isGoal ? selectedShot.xGoals : selectedShot.xPoints;
    const metricVal = typeof metricValueRaw === 'number'
      ? metricValueRaw.toFixed(2)
      : 'N/A';

    return (
      <div style={{ lineHeight: '1.6' }}>
        <p><strong>Action:</strong> {selectedShot.action}</p>
        <p><strong>Team:</strong> {selectedShot.team || 'N/A'}</p>
        <p><strong>Distance:</strong> {distVal}</p>
        <p><strong>{metricLabel}:</strong> {metricVal}</p>
      </div>
    );
  }

  // ------------- Export Full Pitch (optional) -------------
  function handleExport() {
    if (stageRef.current) {
      stageRef.current.toDataURL({
        pixelRatio: 2,
        callback: (dataUrl) => {
          const link = document.createElement('a');
          link.download = `${playerName}_full_pitch_map.png`;
          link.href = dataUrl;
          link.click();
        }
      });
    }
  }

  // ------------- Loading / Error / No Shots -------------
  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (!playerShots.length) {
    return <ErrorMessage message="No shots found for this player." />;
  }

  // ------------- Render -------------
  return (
    <PageContainer>
      <Title>{playerName}'s Shot Data</Title>

      {/* 
        Here is the new Filter. 
        Let's do a simple "Shot Type" filter above the pitch. 
        The user can choose: "All", "free", "45", "offensive mark", etc. 
      */}
      <FiltersContainer>
        <div>
          <FilterLabel htmlFor="shotTypeFilter">Shot Type:</FilterLabel>
          <FilterSelect
            id="shotTypeFilter"
            value={shotTypeFilter}
            onChange={(e) => setShotTypeFilter(e.target.value)}
          >
            <option value="">All Shots</option>
            <option value="free">Free</option>
            <option value="45">45</option>
            <option value="offensive mark">Offensive Mark</option>
            <option value="penalty goal">Penalty Goal</option>
            <option value="miss">Miss (Wide/Short/Post)</option>
            {/* Add any others you want. */}
          </FilterSelect>
        </div>
      </FiltersContainer>

      {/* PITCH + STATS */}
      <Section>
        <PitchAndStatsContainer>

          {/* One-Sided Pitch with Legend */}
          <div style={{ textAlign: 'center' }}>
            <Stage
              width={xScale * (pitchWidth / 2)}
              height={yScale * pitchHeight}
              style={{
                background: '#111',
                border: '2px solid #444',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
              }}
            >
              {renderOneSidePitchShots({
                shots: filteredShots,  // <---- use filteredShots
                colors: {
                  goal: colorGoal,
                  point: colorPoint,
                  miss: colorMiss,
                  setPlayScore: colorSetPlayScore,
                  setPlayMiss: colorSetPlayMiss
                },
                xScale,
                yScale,
                onShotClick: handleShotClick,
                halfLineX,
                goalX: goalXRight,
                goalY
              })}
              {renderLegendOneSideShots(
                {
                  goal: colorGoal,
                  point: colorPoint,
                  miss: colorMiss,
                  setPlayScore: colorSetPlayScore,
                  setPlayMiss: colorSetPlayMiss
                },
                xScale * (pitchWidth / 2),
                yScale * pitchHeight
              )}
            </Stage>
          </div>

          {/* Stats Card */}
          <StatsCard>
            <StatsHeading>{playerName}'s Stats</StatsHeading>
            <StatItem>
              <strong>Team:</strong> {stats.team}
            </StatItem>
            <StatItem>
              <strong>Shots:</strong> {stats.successfulShots}/{stats.totalShots}
            </StatItem>
            <StatItem>
              <strong>Points:</strong> {stats.points}
            </StatItem>
            <StatItem>
              <strong>Goals:</strong> {stats.goals}
            </StatItem>
            <StatItem>
              <strong>Misses:</strong> {stats.misses}
            </StatItem>
            <StatItem>
              <strong>Off. Marks:</strong> {stats.offensiveMarks}
            </StatItem>
            <StatItem>
              <strong>Frees:</strong> {stats.successfulFrees}/{stats.totalFrees}
            </StatItem>
            <StatItem>
              <strong>45s:</strong> {stats.successful45s}/{stats.total45s}
            </StatItem>
            <StatItem>
              <strong>Total xP:</strong> {stats.totalXP.toFixed(2)}
            </StatItem>
            <StatItem>
              <strong>Total xG:</strong> {stats.totalXG.toFixed(2)}
            </StatItem>
            <StatItem>
              <strong>Avg Dist:</strong> {stats.avgDist.toFixed(2)} m
            </StatItem>
          </StatsCard>

        </PitchAndStatsContainer>
      </Section>

      {/* Shot Details Modal */}
      {selectedShot && (
        <Modal
          isOpen={!!selectedShot}
          onRequestClose={closeModal}
          style={customModalStyles}
          contentLabel="Shot Details"
        >
          <h2 style={{ marginTop: 0 }}>Shot Details</h2>
          {renderSelectedShotDetails()}
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <StyledButton
              style={{ backgroundColor: '#607d8b' }}
              onClick={closeModal}
            >
              Close
            </StyledButton>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
