import React, { useEffect, useState, useRef, useMemo } from 'react';
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

// Import missing libraries:
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Import pitch renderers & helpers
import {
  renderGAAPitch,
  renderOneSidePitchShots,
  renderLegendOneSideShots,
  translateShotToOneSide,
  getShotCategory
} from './GAAPitchComponents';
import { Layer, Group, Rect, Circle, Text } from 'react-konva';

Modal.setAppElement('#root');

/* ─── Styled Components ───────────────────────────────────────────── */
const PageContainer = styled.div`
  min-height: 100vh;
  background: #1c1c1c;
  color: #f0f0f0;
  padding: 2rem;
`;
const Section = styled.div`
  background: #2a2e2a;
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
const GearButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #ffc107;
  cursor: pointer;
`;
const GearBox = styled.div`
  border: 1px solid #444;
  border-radius: 8px;
  padding: 0.25rem;
  display: inline-flex;
  align-items: center;
`;
const PdfContentWrapper = styled.div`
  position: relative;
  background-color: #333;
  padding: 1rem;
`;

/* ─── Constants ───────────────────────────────────────────────────────── */
const canvasSize = { width: 930, height: 530 };
const pitchWidth = 145;
const pitchHeight = 88;

const defaultPitchColor = '#006400';
const defaultLineColor = '#FFFFFF';
const defaultLightStripeColor = '#228B22';
const defaultDarkStripeColor = '#006400';

// Default marker colors; note that for set play markers we use objects with a fill and a white stroke.
const defaultMarkerColors = {
  goal: '#FFFF33',
  point: '#39FF14',
  miss: 'red',
  setPlayScore: { fill: '#39FF14', stroke: 'white' },
  setPlayMiss: { fill: 'red', stroke: 'white' }
};

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

/* ─── Helper: Compute renderType ─────────────────────────────────────── */
// Force "offensive mark" and "free" to be rendered as setPlayScore.
function getRenderType(rawAction, mapping) {
  const lowerAction = (rawAction || "").toLowerCase().trim();
  if (lowerAction === "offensive mark" || lowerAction === "free") return "setPlayScore";
  if (mapping.hasOwnProperty(lowerAction)) return mapping[lowerAction];
  if (
    lowerAction.includes("wide") ||
    lowerAction.includes("short") ||
    lowerAction.includes("miss") ||
    lowerAction.includes("post")
  ) {
    return "miss";
  }
  return lowerAction;
}

/* ─── Settings Modal Component for PlayerShotDataGAA ─────────────────── */
function SettingsModalPlayer({ isOpen, onRequestClose, markerColors, setMarkerColors }) {
  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={customModalStyles} contentLabel="Settings">
      <h2>Settings</h2>
      <div style={{ marginBottom: '1rem' }}>
        <h3>Marker Color Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.keys(defaultMarkerColors).map((key) => (
            <div key={key}>
              <label style={{ color: '#fff' }}>
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}:
              </label>
              <input
                type="color"
                value={
                  typeof markerColors[key] === 'object'
                    ? markerColors[key].fill
                    : markerColors[key]
                }
                onChange={(e) =>
                  setMarkerColors((prev) => ({
                    ...prev,
                    [key]:
                      key === 'setPlayScore' || key === 'setPlayMiss'
                        ? { fill: e.target.value, stroke: 'white' }
                        : e.target.value
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'right', marginTop: '1rem' }}>
        <StyledButton
          onClick={() => {
            localStorage.setItem('playerShotMarkerColors', JSON.stringify(markerColors));
            Swal.fire('Settings Saved', 'Your marker settings have been saved.', 'success');
            onRequestClose();
          }}
          style={{ backgroundColor: '#007bff' }}
        >
          Save Settings
        </StyledButton>
        <StyledButton onClick={onRequestClose} style={{ backgroundColor: '#607d8b', marginLeft: '1rem' }}>
          Close
        </StyledButton>
      </div>
    </Modal>
  );
}

/* ─── Download PDF Helper ───────────────────────────────────────────── */
const downloadPDFHandler = async (setIsDownloading, playerName) => {
  setIsDownloading(true);
  const input = document.getElementById('pdf-content');
  if (!input) {
    Swal.fire('Error', 'Could not find content to export.', 'error');
    setIsDownloading(false);
    return;
  }
  try {
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.setFillColor(50, 50, 50);
    pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pdfWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    const marginTop = (pdfHeight - imgHeight) / 2;
    pdf.addImage(imgData, 'PNG', 0, marginTop, imgWidth, imgHeight);
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text("scorelect.com", pdfWidth - 40, pdfHeight - 10);
    pdf.save(`${playerName}_shot_map.pdf`);
  } catch (error) {
    Swal.fire('Error', 'Failed to generate PDF.', 'error');
  }
  setIsDownloading(false);
};

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function PlayerShotDataGAA() {
  const { playerName } = useParams();
  const navigate = useNavigate();
  const stageRef = useRef(null);

  // Pitch states
  const [pitchColorState] = useState(defaultPitchColor);
  const [lineColorState] = useState(defaultLineColor);
  const [lightStripeColorState] = useState(defaultLightStripeColor);
  const [darkStripeColorState] = useState(defaultDarkStripeColor);

  // Marker colors state
  const [markerColors, setMarkerColors] = useState(() => {
    const saved = localStorage.getItem('playerShotMarkerColors');
    return saved ? JSON.parse(saved) : defaultMarkerColors;
  });

  // Shots data
  const [allShots, setAllShots] = useState([]);
  const [playerShots, setPlayerShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Aggregated stats for the player
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
    totalDist: 0
  });

  // Shot type filter
  const [shotTypeFilter, setShotTypeFilter] = useState('');

  // Modal states
  const [selectedShot, setSelectedShot] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Konva canvas configuration
  const xScale = canvasSize.width / pitchWidth;
  const yScale = canvasSize.height / pitchHeight;
  const halfLineX = pitchWidth / 2;
  const goalXRight = pitchWidth;
  const goalY = pitchHeight / 2;

  // Fetch shots from Firestore
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
        const theseShots = gameData.filter(
          (s) => (s.playerName || '').toLowerCase() === playerName.toLowerCase()
        );
        if (!theseShots.length) {
          Swal.fire('No Data', `No shots found for player: ${playerName}`, 'info')
            .then(() => navigate(-1));
          return;
        }
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

  // Compute aggregated stats
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

      if (cat === 'goal' || cat === 'penaltyGoal') {
        aggregator.goals++;
        aggregator.successfulShots++;
      } else if (cat === 'point') {
        aggregator.points++;
        aggregator.successfulShots++;
      } else if (cat === 'miss') {
        aggregator.misses++;
      }

      const act = (shot.action || '').toLowerCase();
      if (act.includes('offensive mark') && !act.includes('wide') && !act.includes('short') && !act.includes('miss')) {
        aggregator.offensiveMarks++;
        aggregator.successfulShots++;
      }
      if (act.includes('free')) {
        aggregator.totalFrees++;
        if (act.trim() === 'free') {
          aggregator.successfulFrees++;
          aggregator.successfulShots++;
        }
      }
      if (act.includes('45') || act.includes('fortyfive')) {
        aggregator.total45s++;
        if (act.trim() === '45' || act.trim() === 'fortyfive') {
          aggregator.successful45s++;
          aggregator.successfulShots++;
        }
      }
    });

    let avgDist = aggregator.totalShots > 0 ? aggregator.totalDist / aggregator.totalShots : 0;
    setStats({
      ...aggregator,
      avgDist
    });
  }, [playerShots]);

  // Filter shots by shotTypeFilter
  const filteredShots = playerShots.filter((shot) => {
    if (!shotTypeFilter) return true;
    const act = (shot.action || '').toLowerCase();
    return act.includes(shotTypeFilter.toLowerCase());
  });

  // Modal handlers
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

  // Download full pitch export
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

  // Early returns
  if (loading)
    return (
      <div className="loading-screen">
        <h2 className="loading-text">Loading player data...</h2>
        <div className="spinner"></div>
      </div>
    );
  if (error)
    return (
      <div className="error-container">
        <p>{error}</p>
      </div>
    );
  if (!playerShots.length)
    return (
      <div className="error-container">
        <p>No shots found for this player.</p>
      </div>
    );

  // Define dynamic marker colors (ensuring setPlay markers are objects with a white stroke)
  const dynamicColors = {
    goal: markerColors.goal,
    point: markerColors.point,
    miss: markerColors.miss,
    setPlayScore: typeof markerColors.setPlayScore === 'object'
      ? markerColors.setPlayScore
      : { fill: markerColors.setPlayScore, stroke: 'white' },
    setPlayMiss: typeof markerColors.setPlayMiss === 'object'
      ? markerColors.setPlayMiss
      : { fill: markerColors.setPlayMiss, stroke: 'white' }
  };

  return (
    <PageContainer>
      <Title>{playerName}'s Shot Data</Title>

      {/* Shot Type Filter */}
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
          </FilterSelect>
        </div>
      </FiltersContainer>

      {/* Pitch and Stats */}
      <Section>
        <PitchAndStatsContainer>
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
              ref={stageRef}
            >
              {renderOneSidePitchShots({
                shots: filteredShots,
                colors: dynamicColors,
                xScale,
                yScale,
                onShotClick: handleShotClick,
                halfLineX,
                goalX: goalXRight,
                goalY
              })}
              {renderLegendOneSideShots(
                {
                  goal: dynamicColors.goal,
                  point: dynamicColors.point,
                  miss: dynamicColors.miss,
                  setPlayScore: dynamicColors.setPlayScore,
                  setPlayMiss: dynamicColors.setPlayMiss
                },
                xScale * (pitchWidth / 2),
                yScale * pitchHeight
              )}
            </Stage>
          </div>
          <StatsCard>
            <StatsHeading>{playerName}'s Stats</StatsHeading>
            <StatItem><strong>Team:</strong> {stats.team}</StatItem>
            <StatItem><strong>Shots:</strong> {stats.successfulShots}/{stats.totalShots}</StatItem>
            <StatItem><strong>Points:</strong> {stats.points}</StatItem>
            <StatItem><strong>Goals:</strong> {stats.goals}</StatItem>
            <StatItem><strong>Misses:</strong> {stats.misses}</StatItem>
            <StatItem><strong>Off. Marks:</strong> {stats.offensiveMarks}</StatItem>
            <StatItem><strong>Frees:</strong> {stats.successfulFrees}/{stats.totalFrees}</StatItem>
            <StatItem><strong>45s:</strong> {stats.successful45s}/{stats.total45s}</StatItem>
            <StatItem>
              <strong>Total xP:</strong> {(stats.totalXP || 0).toFixed(2)}
            </StatItem>
            <StatItem>
              <strong>Total xG:</strong> {(stats.totalXG || 0).toFixed(2)}
            </StatItem>
            <StatItem>
              <strong>Avg Dist:</strong> {(stats.avgDist || 0).toFixed(2)} m
            </StatItem>
          </StatsCard>
        </PitchAndStatsContainer>
      </Section>

      {/* Download & Settings Buttons */}
      <Section>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <StyledButton onClick={() => downloadPDFHandler(setIsDownloading, playerName)}>
            {isDownloading ? 'Downloading PDF...' : 'Download PDF'}
          </StyledButton>
          <GearBox>
            <GearButton onClick={() => setShowSettingsModal(true)} title="Settings">
              ⚙️
            </GearButton>
          </GearBox>
          <StyledButton onClick={handleExport}>Export Pitch</StyledButton>
        </div>
      </Section>

      {/* Shot Details Modal */}
      {selectedShot && (
        <Modal isOpen={!!selectedShot} onRequestClose={closeModal} style={customModalStyles} contentLabel="Shot Details">
          <h2 style={{ marginTop: 0 }}>Shot Details</h2>
          {renderSelectedShotDetails()}
          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <StyledButton onClick={closeModal} style={{ backgroundColor: '#607d8b' }}>
              Close
            </StyledButton>
          </div>
        </Modal>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModalPlayer
          isOpen={showSettingsModal}
          onRequestClose={() => setShowSettingsModal(false)}
          markerColors={markerColors}
          setMarkerColors={setMarkerColors}
        />
      )}
    </PageContainer>
  );
}
