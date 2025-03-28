import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import Swal from 'sweetalert2';
import { Stage } from 'react-konva';
import Modal from 'react-modal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import './TeamDetails.css';
import { 
  renderGAAPitch, 
  renderOneSidePitchShots, 
  renderLegendOneSideShots,
  translateShotToOneSide, 
  getShotCategory 
} from './GAAPitchComponents';

Modal.setAppElement('#root');

/* ─── Styled Components ───────────────────────────────────────────── */
const PageContainer = styled.div`
  position: relative;
  color: #f0f0f0;
  background: #1c1c1c;
  min-height: 100vh;
  padding: 2rem;
`;
const Section = styled.section`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;
const Title = styled.h2`
  text-align: center;
  margin-bottom: 1rem;
  font-weight: 600;
  color: #ffc107;
`;
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
const FilterLabel = styled.label`
  color: #fff;
  font-weight: bold;
  margin-right: 0.5rem;
`;
const Select = styled.select`
  padding: 0.5rem;
  border-radius: 5px;
  border: 1px solid #777;
  background: #fff;
  color: #000;
  min-width: 150px;
  font-size: 0.9rem;
`;
const PitchAndStatsContainer = styled.div`
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
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
  margin: 0 0.5rem;
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
const pitchWidthConst = 145;
const pitchHeightConst = 88;
const canvasSizeMainConst = { width: 930, height: 530 };

const defaultPitchColor = "#000000";
const defaultLightStripeColor = "#228B22";
const defaultDarkStripeColor = "#006400";
const defaultLineColor = "#FFFFFF";

const defaultMapping = {
  "free": "setplayscore",
  "free miss": "setplaymiss",
  "free wide": "setplaymiss",
  "free short": "setplaymiss",
  "fortyfive": "setplayscore",
  "fortyfive wide": "setplaymiss",
  "fortyfive short": "setplaymiss"
};

const fallbackColors = {
  "goal": "#FFFF33",
  "point": "#39FF14",
  "miss": "red",
  "setplayscore": "#39FF14",
  "setplaymiss": "red",
  "penalty goal": "#FF8C00",
  "blocked": "red"
};

const fallbackLegendColors = {
  "goal": "#FFFF33",
  "point": "#39FF14",
  "miss": "red",
  "setplayscore": "#39FF14",
  "setplaymiss": "red",
  "penalty goal": "#FF8C00",
  "blocked": "red"
};

const customModalStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)',
    width: '600px',
    maxHeight: '80vh',
    padding: '30px',
    borderRadius: '10px',
    backgroundColor: '#2e2a2a',
    color: '#fff',
    overflow: 'auto'
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 9999
  }
};

/* ─── Helper: Compute renderType ─────────────────────────────────────── */
function getRenderType(rawAction, mapping) {
  const lowerAction = (rawAction || "").toLowerCase().trim();
  if (lowerAction === "offensive mark" || lowerAction === "free") return "setplayscore";
  if (mapping.hasOwnProperty(lowerAction)) return mapping[lowerAction];
  if (
    lowerAction === "miss" ||
    lowerAction === "wide" ||
    lowerAction === "short" ||
    lowerAction === "post" ||
    lowerAction.includes(" miss")
  ) {
    return "miss";
  }
  return lowerAction;
}

/* ─── Settings Modal Component ───────────────────────────────────────── */
function SettingsModal({ isOpen, onRequestClose, actionMapping, setActionMapping, markerColors, setMarkerColors }) {
  const mappingKeys = Object.keys(actionMapping);
  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={customModalStyles} contentLabel="Settings">
      <h2>Settings</h2>
      <div style={{ marginBottom: '1rem' }}>
        <h3>Action Mapping Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mappingKeys.map((key) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ flex: 1 }}>{key}</span>
              <Select
                value={actionMapping[key]}
                onChange={(e) => setActionMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                style={{ flex: 1, marginLeft: '1rem' }}
              >
                {[
                  { value: 'setplayscore', label: 'Set Play Score (scored)' },
                  { value: 'setplaymiss', label: 'Set Play Miss (miss)' },
                  { value: 'goal', label: 'Goal' },
                  { value: 'point', label: 'Point' },
                  { value: 'miss', label: 'Miss' },
                  { value: 'penalty goal', label: 'Penalty Goal' },
                  { value: 'blocked', label: 'Blocked' },
                ].map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <h3>Marker Color Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.keys(fallbackColors).map((key) => (
            <div key={key}>
              <label style={{ color: '#fff' }}>
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}:
              </label>
              <input
                type="color"
                value={markerColors[key]}
                onChange={(e) => setMarkerColors((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'right', marginTop: '1rem' }}>
        <StyledButton
          onClick={() => {
            localStorage.setItem('teamDetailsActionMapping', JSON.stringify(actionMapping));
            localStorage.setItem('teamDetailsMarkerColors', JSON.stringify(markerColors));
            Swal.fire('Settings Saved', 'Your settings have been saved.', 'success');
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

/* ─── PDF Download Helper ───────────────────────────────────────────── */
const downloadPDFHandler = async (setIsDownloading, teamName) => {
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
    pdf.save(`${teamName}_shot_map.pdf`);
  } catch (error) {
    Swal.fire('Error', 'Failed to generate PDF.', 'error');
  }
  setIsDownloading(false);
};

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function TeamDetails() {
  const { teamName } = useParams();
  const navigate = useNavigate();
  const stageRef = useRef(null);

  const [markerColors, setMarkerColors] = useState(() => {
    const saved = localStorage.getItem('teamDetailsMarkerColors');
    return saved ? JSON.parse(saved) : fallbackColors;
  });
  const [actionMapping, setActionMapping] = useState(() => {
    const saved = localStorage.getItem('teamDetailsActionMapping');
    return saved ? JSON.parse(saved) : defaultMapping;
  });
  const [shotsData, setShotsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedShot, setSelectedShot] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [allShots, setAllShots] = useState([]);
  const [aggregatedData, setAggregatedData] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({ player: '', action: '' });
  const [filterOptions, setFilterOptions] = useState({ players: [], actions: [] });
  const [isDownloading, setIsDownloading] = useState(false);

  const xScale = canvasSizeMainConst.width / pitchWidthConst;
  const yScale = canvasSizeMainConst.height / pitchHeightConst;
  const halfLineX = pitchWidthConst / 2;
  const goalX = 0;
  const goalY = pitchHeightConst / 2;

  const filteredShots = useMemo(() => {
    return shotsData.filter((shot) => {
      const playerMatch = appliedFilters.player
        ? (shot.playerName || '').toLowerCase().includes(appliedFilters.player.toLowerCase())
        : true;
      const actionMatch = appliedFilters.action
        ? (shot.action || '').toLowerCase().includes(appliedFilters.action.toLowerCase())
        : true;
      return playerMatch && actionMatch;
    });
  }, [shotsData, appliedFilters]);

  const dynamicColors = useMemo(() => ({
    "goal": markerColors.goal || "#FFFF33",
    "point": markerColors.point || "#39FF14",
    "miss": markerColors.miss || "red",
    "setplayscore": { 
      fill: markerColors.setplayscore || "#39FF14", 
      stroke: "white" 
    },
    "setplaymiss": { 
      fill: markerColors.setplaymiss || "red", 
      stroke: "white" 
    },
    "penalty goal": markerColors["penalty goal"] || "#FF8C00",
    "blocked": markerColors.blocked || "red",
  }), [markerColors]);

  const dynamicLegendColors = useMemo(() => ({
    "goal": markerColors.goal || "#FFFF33",
    "point": markerColors.point || "#39FF14",
    "miss": markerColors.miss || "red",
    "setplayscore": markerColors.setplayscore || "#39FF14",
    "setplaymiss": markerColors.setplaymiss || "red",
    "penalty goal": markerColors["penalty goal"] || "#FF8C00",
    "blocked": markerColors.blocked || "red",
  }), [markerColors]);

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

  useEffect(() => {
    async function fetchAllShots() {
      try {
        setLoading(true);
        const USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
        const DATASET_NAME = 'All Shots GAA';
        const docRef = doc(firestore, `savedGames/${USER_ID}/games`, DATASET_NAME);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          Swal.fire({ title: 'No Data', text: 'Could not find "All Shots GAA" dataset!', icon: 'info', confirmButtonText: 'OK' });
          navigate('/');
          return;
        }
        const { gameData } = docSnap.data() || {};
        if (!gameData || !Array.isArray(gameData)) {
          Swal.fire({ title: 'No Data', text: 'No shots in "All Shots GAA".', icon: 'info', confirmButtonText: 'OK' });
          navigate('/');
          return;
        }
        setAllShots(gameData);
        const teamShots = gameData.filter((s) => (s.team || '').toLowerCase() === teamName.toLowerCase());
        if (!teamShots.length) {
          Swal.fire({ title: 'No Data', text: `No shots found for team: ${teamName}`, icon: 'info', confirmButtonText: 'OK' });
          navigate(-1);
          return;
        }
        const translated = teamShots.map((shot) =>
          translateShotToOneSide(shot, halfLineX, goalX, goalY)
        );
        const shotsWithRenderType = translated.map((shot) => {
          const renderType = getRenderType(shot.action, actionMapping);
          console.log(`Action: ${shot.action}, RenderType: ${renderType}`);
          return { ...shot, renderType };
        });
        setShotsData(shotsWithRenderType);
      } catch (err) {
        setError(err.message);
        Swal.fire('Error', err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchAllShots();
  }, [teamName, navigate, halfLineX, goalX, goalY, actionMapping]);

  useEffect(() => {
    if (!allShots.length) return;
    const aggregator = {};
    allShots.forEach((s) => {
      const tmName = s.team || 'Unknown';
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
        const translatedShot = translateShotToOneSide(s, halfLineX, goalX, goalY);
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
      if (act.includes('offensive mark') && !act.includes('wide') && !act.includes('short') && !act.includes('miss')) {
        entry.offensiveMarks += 1;
        entry.successfulShots += 1;
      }
      if (act === 'free' || act === 'missed free' || act === 'free wide' || act === 'free short' || act === 'free post') {
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
  }, [allShots, halfLineX, goalX, goalY]);

  function handleShotClick(shot) {
    setSelectedShot(shot);
  }
  function closeModal() {
    setSelectedShot(null);
  }
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
    const advValue = typeof selectedShot.xP_adv === 'number' ? selectedShot.xP_adv.toFixed(2) : 'N/A';
    return (
      <div style={{ lineHeight: '1.6' }}>
        <p><strong>Action:</strong> {selectedShot.action}</p>
        <p><strong>Category:</strong> {cat}</p>
        <p><strong>Distance (m):</strong> {distMeters}</p>
        <p><strong>Foot:</strong> {foot}</p>
        <p><strong>Pressure:</strong> {pressure}</p>
        <p><strong>Position:</strong> {position}</p>
        <p><strong>{metricLabel}:</strong> {metricValue}</p>
        <p><strong>xP_ADV:</strong> {advValue}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading team data...</p>
      </div>
    );
  }
  if (error) return <div className="error-container"><p>{error}</p></div>;
  if (!filteredShots.length) return <div className="error-container"><p>No shots found for this filter or team.</p></div>;

  return (
    <PageContainer>
      <Title>{teamName} Shot Analysis</Title>
      <Section>
        <FiltersContainer>
          <div>
            <FilterLabel htmlFor="playerSelect">Player:</FilterLabel>
            <Select
              id="playerSelect"
              value={appliedFilters.player}
              onChange={(e) => setAppliedFilters((prev) => ({ ...prev, player: e.target.value }))}
            >
              <option value="">All Players</option>
              {filterOptions.players.map((player) => (
                <option key={player} value={player}>{player}</option>
              ))}
            </Select>
          </div>
          <div>
            <FilterLabel htmlFor="actionSelect">Action:</FilterLabel>
            <Select
              id="actionSelect"
              value={appliedFilters.action}
              onChange={(e) => setAppliedFilters((prev) => ({ ...prev, action: e.target.value }))}
            >
              <option value="">All Actions</option>
              {filterOptions.actions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </Select>
          </div>
          <StyledButton onClick={() => downloadPDFHandler(setIsDownloading, teamName)}>
            {isDownloading ? 'Downloading PDF...' : 'Download PDF'}
          </StyledButton>
          <GearBox>
            <GearButton onClick={() => setShowSettingsModal(true)} title="Settings">⚙️</GearButton>
          </GearBox>
        </FiltersContainer>
      </Section>
      <Section id="pdf-content">
        <PdfContentWrapper id="pdf-content">
          <PitchAndStatsContainer>
            <div style={{ textAlign: 'center' }}>
              <Stage
                ref={stageRef}
                width={xScale * (pitchWidthConst / 2)}
                height={yScale * pitchHeightConst}
                style={{ border: '2px solid #444', borderRadius: '8px', backgroundColor: '#111' }}
              >
                {renderGAAPitch({
                  canvasSizeMain: canvasSizeMainConst,
                  pitchColorState: defaultPitchColor,
                  lightStripeColorState: defaultLightStripeColor,
                  darkStripeColorState: defaultDarkStripeColor,
                  lineColorState: defaultLineColor,
                  xScale,
                  yScale,
                })}
                {renderOneSidePitchShots({
                  shots: filteredShots,
                  colors: dynamicColors,
                  xScale,
                  yScale,
                  onShotClick: handleShotClick,
                  halfLineX,
                  goalX,
                  goalY,
                  actionMapping
                })}
                {renderLegendOneSideShots(
                  dynamicLegendColors,
                  xScale * (pitchWidthConst / 2),
                  yScale * pitchHeightConst
                )}
              </Stage>
            </div>
            <StatsCard>
              <StatsHeading>{teamName} Stats</StatsHeading>
              <StatItem><strong>Total Shots:</strong> {aggregatedData[teamName]?.totalShots || 0}</StatItem>
              <StatItem><strong>Successful Shots:</strong> {aggregatedData[teamName]?.successfulShots || 0}</StatItem>
              <StatItem><strong>Points:</strong> {aggregatedData[teamName]?.points || 0}</StatItem>
              <StatItem><strong>Goals:</strong> {aggregatedData[teamName]?.goals || 0}</StatItem>
              <StatItem><strong>Misses:</strong> {aggregatedData[teamName]?.misses || 0}</StatItem>
              <StatItem><strong>Offensive Marks:</strong> {aggregatedData[teamName]?.offensiveMarks || 0}</StatItem>
              <StatItem><strong>Frees:</strong> {aggregatedData[teamName]?.frees || 0}</StatItem>
              <StatItem><strong>45s:</strong> {aggregatedData[teamName]?.fortyFives || 0}</StatItem>
              <StatItem><strong>2-Pointers:</strong> {aggregatedData[teamName]?.twoPointers || 0}</StatItem>
              <StatItem>
                <strong>Avg Success Rate:</strong>{' '}
                {((aggregatedData[teamName]?.totalShots || 0) > 0
                  ? (aggregatedData[teamName].successfulShots / aggregatedData[teamName].totalShots).toFixed(2)
                  : '0.00')}
              </StatItem>
            </StatsCard>
          </PitchAndStatsContainer>
        </PdfContentWrapper>
      </Section>
      {selectedShot && (
        <Modal
          isOpen={!!selectedShot}
          onRequestClose={closeModal}
          style={customModalStyles}
          contentLabel="Shot Details Modal"
        >
          <div style={{ lineHeight: '1.6' }}>
            {renderSelectedShotDetails()}
          </div>
          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <StyledButton onClick={closeModal} style={{ backgroundColor: '#607d8b' }}>Close</StyledButton>
          </div>
        </Modal>
      )}
      <SettingsModal
        isOpen={showSettingsModal}
        onRequestClose={() => setShowSettingsModal(false)}
        actionMapping={actionMapping}
        setActionMapping={setActionMapping}
        markerColors={markerColors}
        setMarkerColors={setMarkerColors}
      />
    </PageContainer>
  );
}

TeamDetails.propTypes = {};