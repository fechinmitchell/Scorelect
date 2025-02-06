// src/components/TeamDetails.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import Swal from 'sweetalert2';
import { Stage, Layer, Group, Text } from 'react-konva';
import Modal from 'react-modal';
import { Radar } from 'react-chartjs-2';
import 'chart.js/auto';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import './TeamDetails.css';

// Import shared pitch components and helper functions
import { 
  renderGAAPitch, 
  renderOneSidePitchShots, 
  translateShotToOneSide, 
  getShotCategory 
} from './GAAPitchComponents';

// ------------------------
// STYLED COMPONENTS
// ------------------------

// 1) Top-level page container for a consistent background and spacing.
const PageContainer = styled.div`
  position: relative;
  color: #f0f0f0; 
  background: #1c1c1c; 
  min-height: 100vh;
  padding: 2rem;
`;

// 2) Section to group content (filters, pitch, stats, etc.).
const Section = styled.div`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

// 3) A universal title style (for page headings or sub-headings).
const Title = styled.h2`
  text-align: center;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #ffc107; /* bright accent color */
`;

// 4) Container for the filters.
const FiltersContainer = styled.div`
  background: #3a3a3a;
  padding: 1rem;
  border-radius: 8px;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
`;

// 5) Filter label (optional, if you want consistent label styling).
const FilterLabel = styled.label`
  color: #fff;
  font-weight: bold;
  margin-right: 0.5rem;
`;

// 6) Styled select for filter dropdowns.
const Select = styled.select`
  padding: 0.5rem;
  border-radius: 5px;
  border: 1px solid #777;
  background: #fff;
  color: #000;
  min-width: 150px;
  font-size: 0.9rem;
`;

// 7) A container to hold the pitch and the stats side-by-side.
const PitchAndStatsContainer = styled.div`
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap; /* allows wrapping on smaller screens */
`;

// 8) A container for the stats card / panel on the right.
const StatsCard = styled.div`
  background: #333;
  padding: 1rem;
  border-radius: 8px;
  min-width: 250px;
  max-width: 350px;
`;

// 9) Card heading for the stats panel.
const StatsHeading = styled.h3`
  margin-top: 0;
  margin-bottom: 1rem;
  font-weight: 600;
  color: #ffc107; /* bright accent color */
`;

// 10) Simple text for labels in the stats panel.
const StatItem = styled.p`
  margin: 0.25rem 0;
`;

// 11) A reusable styled button (optional).
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

// 12) GraphTitle is retained from your code, or replaced by the new Title styled component.
const GraphTitle = styled.h2`
  text-align: center;
  margin-bottom: 10px;
  color: #f0f0f0;
`;

// Make Modal accessible
Modal.setAppElement('#root');

// Default colors and canvas size
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

// Loading and Error Components
function LoadingIndicator() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading team data...</p>
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

// Custom modal styles
const customModalStyles = {
  content: {
    maxWidth: '500px',
    margin: 'auto',
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: '#2e2e2e',
    color: '#fff',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 9999,
  },
};

export default function TeamDetails() {
  const { teamName } = useParams();
  const navigate = useNavigate();
  const stageRef = useRef(null);

  // State declarations
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
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const [selectedShot, setSelectedShot] = useState(null);
  const [shotFilter, setShotFilter] = useState('All');
  const [showXP, setShowXP] = useState(false);
  const [allShots, setAllShots] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [playersInTeam, setPlayersInTeam] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [aggregatedData, setAggregatedData] = useState({});
  const [showColorModal, setShowColorModal] = useState(false);
  const [primaryTeam, setPrimaryTeam] = useState(teamName);

  // Filter state
  const [appliedFilters, setAppliedFilters] = useState({
    player: '',
    action: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    players: [],
    actions: []
  });

  // Dimensions
  const canvasSizeMain = { width: 930, height: 530 };
  const pitchWidth = 145;
  const pitchHeight = 88;
  const xScale = canvasSizeMain.width / pitchWidth;
  const yScale = canvasSizeMain.height / pitchHeight;
  const halfLineX = pitchWidth / 2;
  const goalXRight = pitchWidth;
  const goalY = pitchHeight / 2;

  // Compute filtered shots from shotsData based on applied filters
  const filteredShots = shotsData.filter((shot) => {
    const playerMatch = appliedFilters.player
      ? (shot.playerName || '').toLowerCase().includes(appliedFilters.player.toLowerCase())
      : true;
    const actionMatch = appliedFilters.action
      ? (shot.action || '').toLowerCase().includes(appliedFilters.action.toLowerCase())
      : true;
    return playerMatch && actionMatch;
  });

  // Build filter options from shotsData
  useEffect(() => {
    if (shotsData.length === 0) return;
    const playersSet = new Set();
    const actionsSet = new Set();
    shotsData.forEach((shot) => {
      if (shot.playerName) playersSet.add(shot.playerName);
      if (shot.action) actionsSet.add(shot.action);
    });
    setFilterOptions({
      players: Array.from(playersSet),
      actions: Array.from(actionsSet)
    });
  }, [shotsData]);

  // Fetch shots data from Firestore
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
            confirmButtonText: 'OK'
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
            confirmButtonText: 'OK'
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
            confirmButtonText: 'OK'
          });
          navigate(-1);
          return;
        }
        // Translate to one side
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

  // Aggregate data for stats
  useEffect(() => {
    if (!allShots.length) return;
    const aggregator = {};
    const uniqueTeams = new Set();
    allShots.forEach((s) => {
      const tmName = s.team || 'Unknown Team';
      uniqueTeams.add(tmName);
      if (!aggregator[tmName]) {
        aggregator[tmName] = {
          team: tmName,
          points: 0,
          twoPointers: 0,
          goals: 0,
          offensiveMarks: 0,
          frees: 0,
          fortyFives: 0,
          totalShots: 0,
          successfulShots: 0,
          totalFrees: 0,
          successfulFrees: 0,
          total45s: 0,
          successful45s: 0,
          misses: 0
        };
      }
      const entry = aggregator[tmName];
      const act = (s.action || '').toLowerCase().trim();
      entry.totalShots += 1;
      if (act === 'point') {
        entry.points += 1;
        entry.successfulShots += 1;
        const translatedShot = translateShotToOneSide(s, halfLineX, goalXRight, goalY);
        if (typeof translatedShot.distMeters === 'number' && translatedShot.distMeters >= 40) {
          entry.twoPointers += 1;
        }
      }
      if (act === 'goal' || act === 'penalty goal') {
        entry.goals += 1;
        entry.successfulShots += 1;
      }
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
      if (
        act.includes('offensive mark') &&
        !act.includes('wide') &&
        !act.includes('short') &&
        !act.includes('miss')
      ) {
        entry.offensiveMarks += 1;
        entry.successfulShots += 1;
      }
      if (
        act === 'free' ||
        act === 'missed free' ||
        act === 'free wide' ||
        act === 'free short' ||
        act === 'free post'
      ) {
        entry.frees += 1;
        entry.totalFrees += 1;
        if (act === 'free') {
          entry.successfulShots += 1;
          entry.successfulFrees += 1;
        }
      }
      if (act.includes('fortyfive') || act.includes('45')) {
        entry.fortyFives += 1;
        entry.total45s += 1;
        if (act === 'fortyfive' || act === '45') {
          entry.successfulShots += 1;
          entry.successful45s += 1;
        }
      }
    });
    setAggregatedData(aggregator);
    setTeams([...uniqueTeams]);
  }, [allShots, halfLineX, goalXRight, goalY]);

  // (Optional) Update players based on selectedTeam
  useEffect(() => {
    if (!selectedTeam || !aggregatedData) {
      setPlayersInTeam([]);
      return;
    }
    const result = Object.entries(aggregatedData)
      .filter(([tmName]) => tmName === selectedTeam)
      .map(([tmName]) => tmName);
    setPlayersInTeam(result);
  }, [selectedTeam, aggregatedData]);

  // Handler for shot click and modal
  function handleShotClick(shot) {
    setSelectedShot(shot);
  }
  function closeModal() {
    setSelectedShot(null);
  }

  // For export
  function renderShotsLayer() {
    return (
      <Layer>
        {filteredShots.map((shot, i) => {
          const handleMouseEnter = (e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
            const cat = getShotCategory(shot.action);
            const isGoal = cat === 'goal';
            const label = isGoal ? 'xG' : 'xP';
            const xpOrXg = isGoal
              ? (typeof shot.xGoals === 'number' ? shot.xGoals.toFixed(2) : 'N/A')
              : (typeof shot.xPoints === 'number' ? shot.xPoints.toFixed(2) : 'N/A');
            const distVal =
              typeof shot.distMeters === 'number'
                ? `${shot.distMeters.toFixed(1)}m`
                : 'N/A';
            const pressureVal = shot.pressure || 'N/A';
            setTooltip({
              visible: true,
              x: e.evt.layerX,
              y: e.evt.layerY,
              content: `${label}: ${xpOrXg}\nDistance: ${distVal}\nPressure: ${pressureVal}`
            });
          };
          const handleMouseLeave = () => {
            if (stageRef.current) stageRef.current.container().style.cursor = 'default';
            setTooltip((prev) => ({ ...prev, visible: false }));
          };
          const handleClick = () => {
            handleShotClick(shot);
          };
          const shotX = (shot.x || 0) * xScale;
          const shotY = (shot.y || 0) * yScale;
          return (
            <Group key={i}>
              <Text
                x={shotX}
                y={shotY - 14}
                text={`xP: ${
                  typeof shot.xPoints === 'number' ? shot.xPoints.toFixed(2) : 'N/A'
                }`}
                fontSize={12}
                fill="#fff"
                offsetX={15}
                shadowColor="#000"
                shadowBlur={2}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
              />
            </Group>
          );
        })}
      </Layer>
    );
  }

  // Tooltip
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

  // Modal shot details
  function renderSelectedShotDetails() {
    if (!selectedShot) return null;
    const cat = getShotCategory(selectedShot.action);
    const isGoal = cat === 'goal';
    const distMeters =
      typeof selectedShot.distMeters === 'number'
        ? selectedShot.distMeters.toFixed(1)
        : 'N/A';
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
    const advValue =
      typeof selectedShot.xP_adv === 'number'
        ? selectedShot.xP_adv.toFixed(2)
        : 'N/A';
    return (
      <div style={{ lineHeight: '1.6' }}>
        <p>
          <strong>Action:</strong> {selectedShot.action}
        </p>
        <p>
          <strong>Distance (m):</strong> {distMeters}
        </p>
        <p>
          <strong>Foot:</strong> {foot}
        </p>
        <p>
          <strong>Pressure:</strong> {pressure}
        </p>
        <p>
          <strong>Position:</strong> {position}
        </p>
        <p>
          <strong>{metricLabel}:</strong> {metricValue}
        </p>
        <p>
          <strong>xP_ADV:</strong> {advValue}
        </p>
      </div>
    );
  }

  // Team toggling (optional)
  function toggleTeam(team) {
    if (selectedTeams.includes(team)) {
      setSelectedTeams(selectedTeams.filter((x) => x !== team));
    } else {
      setSelectedTeams([...selectedTeams, team]);
    }
  }

  // Export pitch as image
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

  if (loading) return <LoadingIndicator />;
  if (error) return <ErrorMessage message={error} />;
  if (!filteredShots.length)
    return <ErrorMessage message="No shots found for this filter or team." />;

  return (
    <PageContainer>
      {/* Main Title */}
      <Title>{teamName} Shot Analysis</Title>

      {/* FILTERS SECTION */}
      <Section>
        <FiltersContainer>
          {/* Example label, if you want a label for each select */}
          <div>
            <FilterLabel htmlFor="playerSelect">Player:</FilterLabel>
            <Select
              id="playerSelect"
              value={appliedFilters.player}
              onChange={(e) =>
                setAppliedFilters((prev) => ({ ...prev, player: e.target.value }))
              }
            >
              <option value="">All Players</option>
              {filterOptions.players.map((player) => (
                <option key={player} value={player}>
                  {player}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FilterLabel htmlFor="actionSelect">Action:</FilterLabel>
            <Select
              id="actionSelect"
              value={appliedFilters.action}
              onChange={(e) =>
                setAppliedFilters((prev) => ({ ...prev, action: e.target.value }))
              }
            >
              <option value="">All Actions</option>
              {filterOptions.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
          </div>
        </FiltersContainer>
      </Section>

      {/* PITCH + STATS SECTION */}
      <Section>
        <PitchAndStatsContainer>
          {/* PITCH */}
          <div style={{ textAlign: 'center' }}>
            <Stage
              width={xScale * (pitchWidth / 2)}
              height={yScale * pitchHeight}
              style={{
                border: '2px solid #444',
                borderRadius: '8px',
                backgroundColor: '#111',
              }}
            >
              {renderGAAPitch({
                canvasSizeMain,
                pitchColorState,
                lightStripeColorState,
                darkStripeColorState,
                lineColorState,
                xScale,
                yScale,
              })}
              {renderOneSidePitchShots({
                shots: filteredShots,
                colors: {
                  goal: colorGoal,
                  point: colorPoint,
                  miss: colorMiss,
                  setPlayScore: colorSetPlayScore,
                  setPlayMiss: colorSetPlayMiss,
                },
                xScale,
                yScale,
                onShotClick: handleShotClick,
                halfLineX: pitchWidth / 2,
                goalX: goalXRight,
                goalY: goalY,
              })}
            </Stage>
          </div>

          {/* STATS CARD */}
          <StatsCard>
            <StatsHeading>{teamName} Stats</StatsHeading>
            <StatItem>
              <strong>Total Shots:</strong> {aggregatedData[teamName]?.totalShots || 0}
            </StatItem>
            <StatItem>
              <strong>Successful Shots:</strong>{' '}
              {aggregatedData[teamName]?.successfulShots || 0}
            </StatItem>
            <StatItem>
              <strong>Points:</strong> {aggregatedData[teamName]?.points || 0}
            </StatItem>
            <StatItem>
              <strong>Goals:</strong> {aggregatedData[teamName]?.goals || 0}
            </StatItem>
            <StatItem>
              <strong>Misses:</strong> {aggregatedData[teamName]?.misses || 0}
            </StatItem>
            <StatItem>
              <strong>Offensive Marks:</strong>{' '}
              {aggregatedData[teamName]?.offensiveMarks || 0}
            </StatItem>
            <StatItem>
              <strong>Frees:</strong> {aggregatedData[teamName]?.frees || 0}
            </StatItem>
            <StatItem>
              <strong>45s:</strong> {aggregatedData[teamName]?.fortyFives || 0}
            </StatItem>
            <StatItem>
              <strong>2-Pointers:</strong> {aggregatedData[teamName]?.twoPointers || 0}
            </StatItem>
            <StatItem>
              <strong>Avg Distance (m):</strong>{' '}
              {((aggregatedData[teamName]?.totalShots || 0) > 0
                ? aggregatedData[teamName].successfulShots &&
                  aggregatedData[teamName].totalShots
                  ? (
                      aggregatedData[teamName].successfulShots /
                      aggregatedData[teamName].totalShots
                    ).toFixed(2)
                  : '0.00'
                : '0.00')}
            </StatItem>
            {/* Example button to export or open color modal */}
            {/* <div style={{ marginTop: '1rem' }}>
              <StyledButton onClick={handleExport}>Export Shot Map</StyledButton>
              <StyledButton
                style={{ marginLeft: '0.5rem', backgroundColor: '#555' }}
                onClick={() => setShowColorModal(true)}
              >
                Customize Colors
              </StyledButton>
            </div> */}
          </StatsCard>
        </PitchAndStatsContainer>
      </Section>

      {/* (Optional) Additional sections, e.g., Radar chart */}
      {/* 
      <Section>
        <Title>Radar Analysis</Title>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Radar data={...} options={...} />
        </div>
      </Section>
      */}

      {renderTooltip()}

      {/* Shot Details Modal */}
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
            <StyledButton
              onClick={closeModal}
              style={{ backgroundColor: '#607d8b', marginLeft: 'auto' }}
            >
              Close
            </StyledButton>
          </div>
        </Modal>
      )}

      {/* Color Modal */}
      {showColorModal && (
        <Modal
          isOpen={showColorModal}
          onRequestClose={() => setShowColorModal(false)}
          style={customModalStyles}
          contentLabel="Customize Colors"
        >
          <h2 className="color-modal-header">Customize Colors</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            <div>
              <label style={{ color: '#fff' }}>Pitch Color:</label>
              <input
                type="color"
                value={pitchColorState}
                onChange={(e) => setPitchColorState(e.target.value)}
              />
            </div>
            <div>
              <label style={{ color: '#fff' }}>Line Color:</label>
              <input
                type="color"
                value={lineColorState}
                onChange={(e) => setLineColorState(e.target.value)}
              />
            </div>
            <div>
              <label style={{ color: '#fff' }}>Light Stripe Color:</label>
              <input
                type="color"
                value={lightStripeColorState}
                onChange={(e) => setLightStripeColorState(e.target.value)}
              />
            </div>
            <div>
              <label style={{ color: '#fff' }}>Dark Stripe Color:</label>
              <input
                type="color"
                value={darkStripeColorState}
                onChange={(e) => setDarkStripeColorState(e.target.value)}
              />
            </div>
            <div>
              <label style={{ color: '#fff' }}>Goal Color:</label>
              <input
                type="color"
                value={colorGoal}
                onChange={(e) => setColorGoal(e.target.value)}
              />
            </div>
            <div>
              <label style={{ color: '#fff' }}>Point Color:</label>
              <input
                type="color"
                value={colorPoint}
                onChange={(e) => setColorPoint(e.target.value)}
              />
            </div>
            <div>
              <label style={{ color: '#fff' }}>Miss Color:</label>
              <input
                type="color"
                value={colorMiss}
                onChange={(e) => setColorMiss(e.target.value)}
              />
            </div>
            <div>
              <label style={{ color: '#fff' }}>SetPlay Score Color:</label>
              <input
                type="color"
                value={colorSetPlayScore}
                onChange={(e) => setColorSetPlayScore(e.target.value)}
              />
            </div>
            <div>
              <label style={{ color: '#fff' }}>SetPlay Miss Color:</label>
              <input
                type="color"
                value={colorSetPlayMiss}
                onChange={(e) => setColorSetPlayMiss(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <StyledButton
              onClick={() => setShowColorModal(false)}
              style={{ backgroundColor: '#607d8b' }}
            >
              Save
            </StyledButton>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}

TeamDetails.propTypes = {
  // No props expected at this time.
};
