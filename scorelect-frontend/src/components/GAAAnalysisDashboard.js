import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import styled from 'styled-components';
import { Stage } from 'react-konva';
import Modal from 'react-modal';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Import pitch rendering functions
import { renderLegendOneSideShots, renderOneSidePitchShots } from './GAAPitchComponents';

// Environment-based API URLs
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Default Colors & Pitch Size
const defaultPitchColor = "#000000"; // Black background
const pitchWidth = 145;
const pitchHeight = 88;

// Default Mapping Configuration
const defaultMapping = {
  "free": "setplayscore",
  "free miss": "setplaymiss",
  "free wide": "setplaymiss",
  "free short": "setplaymiss",
  "fortyfive": "setplayscore",
  "fortyfive wide": "setplaymiss",
  "fortyfive short": "setplaymiss"
};

// Fallback Colors
const fallbackColors = {
  "goal": "#FFFF33",
  "point": "#39FF14",
  "miss": "red",
  "setplayscore": { fill: "39FF14", stroke: "white" },
  "setplaymiss": { fill: "red", stroke: "white" },
  "penalty goal": "#FF8C00",
  "blocked": "orange"
};

const fallbackLegendColors = {
  "goal": "#FFFF33",
  "point": "#39FF14",
  "miss": "red",
  "setplayscore": { fill: "#39FF14", stroke: "white" },
  "setplaymiss": { fill: "red", stroke: "white" },
  "penalty goal": "#FF8C00",
  "blocked": "orange"
};

// Styled Components (unchanged for brevity, same as original)
const PageContainer = styled.div`background: #1c1a1a; min-height: 100vh; color: #ffc107; padding: 2rem; font-family: 'Roboto', sans-serif;`;
const Header = styled.h1`text-align: center; margin-bottom: 2rem; font-weight: 600; font-size: 2rem; letter-spacing: 1px;`;
const ControlsBar = styled.div`display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding: 0.5rem; background: #333; border-radius: 8px;`;
const FiltersContainer = styled.div`display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap;`;
const FilterSelect = styled.select`padding: 0.5rem; border-radius: 5px; border: 1px solid #777; background: #fff; color: #000; font-size: 1rem;`;
const ButtonGroup = styled.div`display: flex; gap: 0.5rem; align-items: center;`;
const DownloadButton = styled.button`background-color: #4caf50; border: none; border-radius: 5px; color: #fff; padding: 0.5rem 0.75rem; font-size: 1rem; cursor: pointer; font-weight: 500; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: background-color 0.3s ease; &:hover { background-color: #45a049; }`;
const GearButton = styled.button`background: none; border: none; font-size: 1.5rem; color: #ffc107; cursor: pointer;`;
const GearBox = styled.div`border: 1px solid #444; border-radius: 8px; padding: 0.25rem; display: inline-flex; align-items: center;`;
const RecalcButton = styled.button`background-color: #0069d9; border: none; border-radius: 5px; color: #fff; padding: 0.75rem 1.25rem; font-size: 1rem; cursor: pointer; font-weight: 500; box-shadow: 0 3px 5px rgba(0,0,0,0.2); transition: background-color 0.3s ease; &:hover { background-color: #005bb5; }`;
const TilesContainer = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;`;
const Tile = styled.div`background: #333; border-radius: 8px; padding: 1rem; text-align: center; box-shadow: 0 3px 5px rgba(0,0,0,0.2); h5 { margin-bottom: 0.5rem; font-weight: 600; color: #fff; font-size: 1rem; } p { font-size: 1rem; font-weight: bold; margin: 0; color: #ffc107; }`;
const PitchAndTeamStatsWrapper = styled.div`display: flex; gap: 2rem; align-items: flex-start;`;
const PitchWrapper = styled.div`flex-shrink: 0;`;
const StatsScrollContainer = styled.div`display: flex; gap: 1rem; flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x mandatory; flex: 1;`;
const Section = styled.section`background: #2a2a2a; border-radius: 10px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 4px 8px rgba(0,0,0,0.3);`;
const PitchSection = styled.section`background: #2a2a2a; border-radius: 10px; padding: 1.5rem; box-shadow: 0 4px 8px rgba(0,0,0,0.3);`;
const TeamStatsCard = styled.div`background: #333; border-radius: 8px; padding: 1rem; min-width: 220px; box-shadow: 0 3px 5px rgba(0,0,0,0.2); align-self: flex-start;`;
const PdfContentWrapper = styled.div`position: relative; background-color: #333; padding: 1rem;`;
const Watermark = styled.div`position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; opacity: 0.3; pointer-events: none; font-size: 3rem; color: #fff; z-index: 10;`;

// Modal Styling
const customModalStyles = {
  content: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', width: '600px', maxHeight: '80vh', padding: '30px', borderRadius: '10px', backgroundColor: '#2e2a2a', color: '#fff', overflow: 'auto' },
  overlay: { backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999 }
};

// Modal Subcomponents
const ModalContainer = styled.div`display: flex; flex-direction: column; gap: 1rem;`;
const MappingRow = styled.div`display: flex; align-items: center; justify-content: space-between;`;
const MappingLabel = styled.span`flex: 1;`;
const MappingSelect = styled.select`flex: 1; padding: 0.5rem; margin-left: 1rem;`;

// Gear Settings Modal
function GearSettingsModal({ isOpen, onRequestClose, actionMapping, setActionMapping, markerColors, setMarkerColors }) {
  const mappingKeys = Object.keys(actionMapping);
  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={customModalStyles} contentLabel="Gear Settings">
      <h2>Settings</h2>
      <div style={{ marginBottom: '1rem' }}>
        <h3>Action Mapping Settings</h3>
        <ModalContainer>
          {mappingKeys.map((key) => (
            <MappingRow key={key}>
              <MappingLabel>{key}</MappingLabel>
              <MappingSelect
                value={actionMapping[key]}
                onChange={(e) => setActionMapping((prev) => ({ ...prev, [key]: e.target.value }))}
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
              </MappingSelect>
            </MappingRow>
          ))}
        </ModalContainer>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <h3>Marker Color Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label>Point Marker Color: </label>
            <input
              type="color"
              value={markerColors.point}
              onChange={(e) => setMarkerColors((prev) => ({ ...prev, point: e.target.value }))}
            />
          </div>
          <div>
            <label>Free (setplayscore) Marker Color: </label>
            <input
              type="color"
              value={markerColors.setplayscore}
              onChange={(e) => setMarkerColors((prev) => ({ ...prev, setplayscore: e.target.value }))}
            />
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', marginTop: '1rem' }}>
        <RecalcButton
          onClick={() => {
            localStorage.setItem('actionMapping', JSON.stringify(actionMapping));
            localStorage.setItem('markerColors', JSON.stringify(markerColors));
            Swal.fire('Settings Saved', 'Your settings have been saved.', 'success');
            onRequestClose();
          }}
          style={{ backgroundColor: '#007bff' }}
        >
          Save Settings
        </RecalcButton>
        <RecalcButton onClick={onRequestClose} style={{ backgroundColor: '#444', marginLeft: '1rem' }}>
          Close
        </RecalcButton>
      </div>
    </Modal>
  );
}

// Helper Functions
function flattenShots(games = []) {
  return games.flatMap((game) => game.gameData || []);
}

function translateShotToGoal(shot, fullPitch, pitchHeight) {
  const leftGoalCentre = { x: 0, y: pitchHeight / 2 };
  const rightGoalCentre = { x: fullPitch, y: pitchHeight / 2 };
  const originalX = shot.x || 0;
  const originalY = shot.y || 0;
  const goalCentre = originalX < fullPitch / 2 ? leftGoalCentre : rightGoalCentre;
  const dx = originalX - goalCentre.x;
  const dy = originalY - goalCentre.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters: dist };
}

const getRenderType = (rawAction, mapping) => {
  const lowerAction = rawAction ? rawAction.toLowerCase().trim() : "";
  return mapping.hasOwnProperty(lowerAction) ? mapping[lowerAction] : lowerAction;
};

// Pitch Rendering
function PitchView({ allShots, xScale, yScale, halfLineX, goalX, goalY, onShotClick, colors, legendColors }) {
  return (
    <PitchSection>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Stage
          width={xScale * (pitchWidth / 2)}
          height={yScale * pitchHeight}
          style={{ background: defaultPitchColor, border: '1px solid #444', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
        >
          {renderOneSidePitchShots({ shots: allShots, colors, xScale, yScale, onShotClick, halfLineX, goalX, goalY })}
          {renderLegendOneSideShots(legendColors, xScale * (pitchWidth / 2), yScale * pitchHeight)}
        </Stage>
      </div>
    </PitchSection>
  );
}

// PDF Download Helper
const downloadPDFHandler = async (setIsDownloading) => {
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
    pdf.save('dashboard.pdf');
  } catch (error) {
    Swal.fire('Error', 'Failed to generate PDF.', 'error');
  }
  setIsDownloading(false);
};

// ErrorBoundary
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("ErrorBoundary caught an error", error, errorInfo); }
  render() {
    if (this.state.hasError) return <h2 style={{ textAlign: 'center', color: 'red' }}>Something went wrong.</h2>;
    return this.props.children;
  }
}

// Main Component
export default function GAAAnalysisDashboard() {
  const { state } = useLocation();
  const { file, sport, filters } = state || {};
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Action mapping state
  const [actionMapping, setActionMapping] = useState(() => {
    const saved = localStorage.getItem('actionMapping');
    return saved ? JSON.parse(saved) : defaultMapping;
  });

  // Marker colors state (persisted)
  const [markerColors, setMarkerColors] = useState(() => {
    const saved = localStorage.getItem('markerColors');
    return saved ? JSON.parse(saved) : { point: "#39FF14", setplayscore: "#39FF14" };
  });

  const [isGearModalOpen, setIsGearModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    team: filters?.team || '',
    player: filters?.player || '',
    action: filters?.action || '',
    match: filters?.match || '',
  });
  const [summary, setSummary] = useState({ totalShots: 0, totalGoals: 0, totalPoints: 0, totalMisses: 0 });
  const [filterOptions, setFilterOptions] = useState({ teams: [], players: [], actions: [], matches: [] });
  const [games, setGames] = useState([]);
  const [teamAggregatedData, setTeamAggregatedData] = useState({});
  const [teamScorers, setTeamScorers] = useState({});
  const [selectedShot, setSelectedShot] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const xScale = 6;
  const yScale = 6;
  const halfLineX = pitchWidth / 2;
  const goalX = 0;
  const goalY = pitchHeight / 2;

  // Dynamic colors
  const dynamicColors = useMemo(() => ({
    "goal": fallbackColors.goal,
    "point": markerColors.point,
    "miss": fallbackColors.miss,
    "setplayscore": { fill: markerColors.setplayscore, stroke: "white" }, // Fixed white stroke
    "setplaymiss": fallbackColors.setplaymiss,
    "penalty goal": fallbackColors["penalty goal"],
    "blocked": fallbackColors.blocked,
  }), [markerColors]);

  const dynamicLegendColors = useMemo(() => ({
    "goal": fallbackLegendColors.goal,
    "point": markerColors.point,
    "miss": fallbackLegendColors.miss,
    "setplayscore": markerColors.setplayscore,
    "setplaymiss": fallbackLegendColors.setplaymiss,
    "penalty goal": fallbackLegendColors["penalty goal"],
    "blocked": fallbackLegendColors.blocked,
  }), [markerColors]);

  // Debug state updates (optional)
  // useEffect(() => {
  //   console.log("markerColors updated:", markerColors);
  // }, [markerColors]);

  function handleFilterChange(field, value) {
    setAppliedFilters(prev => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    if (!file || sport !== 'GAA') {
      Swal.fire('No Data', 'Invalid or no GAA dataset found.', 'error').then(() => navigate('/analysis'));
      return;
    }
    setGames(file.games || []);
    const tSet = new Set();
    const pSet = new Set();
    const aSet = new Set();
    const mSet = new Set();
    (file.games || []).forEach(g => {
      if (g.match) mSet.add(g.match);
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
      matches: Array.from(mSet),
    });
  }, [file, sport, navigate]);

  useEffect(() => {
    let filteredGames = file?.games || [];
    if (appliedFilters.match) filteredGames = filteredGames.filter(g => g.match === appliedFilters.match);
    if (appliedFilters.team) filteredGames = filteredGames.map(g => ({ ...g, gameData: (g.gameData || []).filter(sh => sh.team === appliedFilters.team) }));
    if (appliedFilters.player) filteredGames = filteredGames.map(g => ({ ...g, gameData: (g.gameData || []).filter(sh => sh.playerName === appliedFilters.player) }));
    if (appliedFilters.action) filteredGames = filteredGames.map(g => ({ ...g, gameData: (g.gameData || []).filter(sh => sh.action === appliedFilters.action) }));
    filteredGames = filteredGames.filter(g => (g.gameData || []).length > 0);
    const shots = flattenShots(filteredGames);
    let totalShots = 0, totalGoals = 0, totalPoints = 0, totalMisses = 0;
    shots.forEach(sh => {
      totalShots++;
      const a = (sh.action || '').toLowerCase().trim();
      if (a === 'goal' || a === 'penalty goal') totalGoals++;
      else if (a === 'point') totalPoints++;
      else if (a.includes('miss') || a.includes('wide') || a.includes('short') || a.includes('blocked') || a.includes('post')) totalMisses++;
    });
    setSummary({ totalShots, totalGoals, totalPoints, totalMisses });
    setGames(filteredGames);
  }, [file, appliedFilters]);

  const shotsWithRenderType = useMemo(() => {
    return flattenShots(games).map(shot => ({
      ...shot,
      renderType: getRenderType(shot.action, actionMapping)
    }));
  }, [games, actionMapping]);

  const eligibleFor2Pointer = ['point', 'free', 'offensive mark', '45', 'fortyfive'];

  const aggregatedData = useMemo(() => {
    const aggregator = {};
    const scorersMap = {};
    let teamDistance = {};
    flattenShots(games).forEach(shot => {
      const tm = shot.team || 'Unknown';
      if (!aggregator[tm]) {
        aggregator[tm] = { totalShots: 0, successfulShots: 0, points: 0, goals: 0, misses: 0, freeAttempts: 0, freeScored: 0, offensiveMarkAttempts: 0, offensiveMarkScored: 0, fortyFiveAttempts: 0, fortyFiveScored: 0, twoPointerAttempts: 0, twoPointerScored: 0 };
        teamDistance[tm] = 0;
      }
      if (!scorersMap[tm]) scorersMap[tm] = {};
      aggregator[tm].totalShots++;
      const translated = translateShotToGoal(shot, pitchWidth, pitchHeight);
      teamDistance[tm] += translated.distMeters;
      const action = (shot.action || '').toLowerCase().trim();
      if (action === 'goal' || action === 'penalty goal') {
        aggregator[tm].goals++;
        aggregator[tm].successfulShots++;
        const pName = shot.playerName || 'NoName';
        if (!scorersMap[tm][pName]) scorersMap[tm][pName] = { goals: 0, points: 0 };
        scorersMap[tm][pName].goals++;
      } else if (action === 'point') {
        aggregator[tm].points++;
        aggregator[tm].successfulShots++;
        const pName = shot.playerName || 'NoName';
        if (!scorersMap[tm][pName]) scorersMap[tm][pName] = { goals: 0, points: 0 };
        scorersMap[tm][pName].points++;
      } else if (action === 'offensive mark') {
        aggregator[tm].offensiveMarkAttempts++;
        aggregator[tm].offensiveMarkScored++;
        aggregator[tm].successfulShots++;
      }
      if (action.startsWith('free')) {
        aggregator[tm].freeAttempts++;
        if (action === 'free') {
          aggregator[tm].freeScored++;
          aggregator[tm].successfulShots++;
        }
      }
      if (action.startsWith('45') || action.startsWith('forty')) {
        aggregator[tm].fortyFiveAttempts++;
        if (action === '45' || action === 'fortyfive') {
          aggregator[tm].fortyFiveScored++;
          aggregator[tm].successfulShots++;
        }
      }
      if (action.includes('miss') || action.includes('wide') || action.includes('free short') || action.includes('short') || action.includes('blocked') || action.includes('post')) {
        aggregator[tm].misses++;
      }
      if (eligibleFor2Pointer.includes(action)) {
        if (translated.distMeters >= 40) {
          aggregator[tm].twoPointerAttempts++;
          if (action === 'point' || action === 'free' || action === 'offensive mark' || action === '45' || action === 'fortyfive') {
            aggregator[tm].twoPointerScored++;
          }
        }
      }
    });
    Object.keys(aggregator).forEach(tm => {
      const tStats = aggregator[tm];
      tStats.avgDistance = tStats.totalShots > 0 ? (teamDistance[tm] / tStats.totalShots).toFixed(2) : '0.00';
    });
    return { aggregator, scorersMap };
  }, [games]);

  useEffect(() => {
    setTeamAggregatedData(aggregatedData.aggregator);
    setTeamScorers(aggregatedData.scorersMap);
  }, [aggregatedData]);

  const handleRecalculate = async () => {
    try {
      const userId = currentUser?.uid;
      if (!userId) {
        Swal.fire('Error', 'No authenticated user ID found', 'error');
        return;
      }
      const targetDataset = file?.datasetName || 'DefaultDataset';
      const trainingDataset = 'GAA All Shots';
      const payload = { user_id: userId, training_dataset: trainingDataset, target_dataset: targetDataset };
      const response = await axios.post(`${BASE_API_URL}/recalculate-target-xpoints`, payload);
      if (response.data.success) {
        Swal.fire('Recalculation Complete', `xP and xG values have been updated for ${targetDataset}`, 'success');
        if (response.data.summary) setSummary(response.data.summary);
        await fetchUpdatedDataset(userId, targetDataset);
      }
    } catch (error) {
      console.error('Recalculation error:', error);
      Swal.fire('Error', 'Recalculation failed. Check the console for details.', 'error');
    }
  };

  const fetchUpdatedDataset = async (uid, datasetName) => {
    try {
      const loadResp = await axios.post(`${BASE_API_URL}/load-games`, { uid });
      const allGames = loadResp.data || [];
      const filtered = allGames.filter(g => g.datasetName === datasetName);
      setGames(filtered);
    } catch (err) {
      console.error('Error fetching updated dataset:', err);
    }
  };

  const handleShotClick = (shot) => {
    const transformedShot = translateShotToGoal(shot, pitchWidth, pitchHeight);
    setSelectedShot(transformedShot);
  };

  function renderSelectedShotDetails() {
    if (!selectedShot) return null;
    return (
      <div style={{ lineHeight: '1.6' }}>
        <h2 id="shot-details-title" style={{ marginTop: 0, marginBottom: '1rem', color: '#ffc107' }}>Shot Details</h2>
        <p><strong>Team:</strong> {selectedShot.team || 'N/A'}</p>
        <p><strong>Player:</strong> {selectedShot.playerName || 'N/A'}</p>
        <p><strong>Minute:</strong> {selectedShot.minute || 'N/A'}</p>
        <p><strong>Action:</strong> {selectedShot.action || 'N/A'}</p>
        <p><strong>Distance (m):</strong> {selectedShot.distMeters !== undefined ? selectedShot.distMeters.toFixed(1) : 'N/A'}</p>
        <p><strong>Foot:</strong> {selectedShot.foot || 'N/A'}</p>
        <p><strong>Pressure:</strong> {selectedShot.pressure || 'N/A'}</p>
        <p><strong>Position:</strong> {selectedShot.position || 'N/A'}</p>
        <p><strong>xP:</strong> {typeof selectedShot.xPoints === 'number' ? selectedShot.xPoints.toFixed(2) : 'N/A'}</p>
        <p><strong>xP_ADV:</strong> {typeof selectedShot.xP_adv === 'number' ? selectedShot.xP_adv.toFixed(2) : 'N/A'}</p>
      </div>
    );
  }

  const formatCategory = (attempts, scored) => `${attempts} (${scored} Scored)`;

  return (
    <ErrorBoundary>
      <PageContainer>
        <Header>GAA Analysis Dashboard</Header>
        <ControlsBar style={{ justifyContent: 'center' }}>
          <div style={{ padding: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <FilterSelect value={appliedFilters.match} onChange={(e) => handleFilterChange('match', e.target.value)}>
              <option value="">All Matches</option>
              {filterOptions.matches.map((match) => <option key={match} value={match}>{match}</option>)}
            </FilterSelect>
            <FilterSelect value={appliedFilters.team} onChange={(e) => handleFilterChange('team', e.target.value)}>
              <option value="">All Teams</option>
              {filterOptions.teams.map((team) => <option key={team} value={team}>{team}</option>)}
            </FilterSelect>
            <FilterSelect value={appliedFilters.player} onChange={(e) => handleFilterChange('player', e.target.value)}>
              <option value="">All Players</option>
              {filterOptions.players.map((player) => <option key={player} value={player}>{player}</option>)}
            </FilterSelect>
            <FilterSelect value={appliedFilters.action} onChange={(e) => handleFilterChange('action', e.target.value)}>
              <option value="">All Actions</option>
              {filterOptions.actions.map((action) => <option key={action} value={action}>{action}</option>)}
            </FilterSelect>
          </div>
          <div style={{ padding: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DownloadButton onClick={() => downloadPDFHandler(setIsDownloading)}>
              {isDownloading ? 'Downloading PDF...' : 'Download PDF'}
            </DownloadButton>
            <GearBox>
              <GearButton onClick={() => setIsGearModalOpen(true)} title="Gear Settings">⚙️</GearButton>
            </GearBox>
          </div>
        </ControlsBar>
        <Section>
          <TilesContainer>
            <Tile><h5>Total Shots</h5><p>{summary.totalShots}</p></Tile>
            <Tile><h5>Total Goals</h5><p>{summary.totalGoals}</p></Tile>
            <Tile><h5>Total Points</h5><p>{summary.totalPoints}</p></Tile>
            <Tile><h5>Total Misses</h5><p>{summary.totalMisses}</p></Tile>
          </TilesContainer>
        </Section>
        <Section id="pdf-content">
          <PdfContentWrapper id="pdf-content">
            <PitchAndTeamStatsWrapper>
              <PitchWrapper>
                <PitchView
                  allShots={shotsWithRenderType}
                  xScale={xScale}
                  yScale={yScale}
                  halfLineX={halfLineX}
                  goalX={goalX}
                  goalY={goalY}
                  onShotClick={handleShotClick}
                  colors={dynamicColors}
                  legendColors={dynamicLegendColors}
                />
              </PitchWrapper>
              <StatsScrollContainer>
                {Object.keys(teamAggregatedData).map((tmName) => {
                  const tStats = teamAggregatedData[tmName];
                  const scorersObj = teamScorers[tmName] || {};
                  return (
                    <TeamStatsCard key={tmName}>
                      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>{tmName} Stats</h3>
                      <p>Total Shots: {tStats.totalShots}</p>
                      <p>Successful Shots: {tStats.successfulShots || 0}</p>
                      <p>Points: {tStats.points}</p>
                      <p>Goals: {tStats.goals}</p>
                      <p>Misses: {tStats.misses}</p>
                      <p>Offensive Marks: {formatCategory(tStats.offensiveMarkAttempts || 0, tStats.offensiveMarkScored || 0)}</p>
                      <p>Frees: {formatCategory(tStats.freeAttempts || 0, tStats.freeScored || 0)}</p>
                      <p>45s: {formatCategory(tStats.fortyFiveAttempts || 0, tStats.fortyFiveScored || 0)}</p>
                      <p>2-Pointers: {formatCategory(tStats.twoPointerAttempts || 0, tStats.twoPointerScored || 0)}</p>
                      <p>Avg Distance from Goal (m): {tStats.avgDistance}</p>
                      <h4 style={{ marginTop: '1rem', color: '#fff' }}>Scorers</h4>
                      {Object.keys(scorersObj).length === 0 ? (
                        <p style={{ margin: 0 }}>No scorers found</p>
                      ) : (
                        Object.entries(scorersObj).map(([playerName, val]) => (
                          <p key={playerName} style={{ margin: 0 }}>
                            {playerName}: {val.goals > 0 && `${val.goals} goal(s)`} {val.points > 0 && `${val.points} point(s)`}
                          </p>
                        ))
                      )}
                    </TeamStatsCard>
                  );
                })}
              </StatsScrollContainer>
            </PitchAndTeamStatsWrapper>
          </PdfContentWrapper>
        </Section>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <RecalcButton onClick={handleRecalculate}>Recalculate xP/xG for Target Dataset</RecalcButton>
        </div>
        <Modal
          isOpen={!!selectedShot}
          onRequestClose={() => setSelectedShot(null)}
          contentLabel="Shot Details Modal"
          aria={{ labelledby: "shot-details-title", describedby: "shot-details-description" }}
          style={customModalStyles}
        >
          {selectedShot && (
            <div style={{ lineHeight: '1.6' }}>
              {renderSelectedShotDetails()}
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <RecalcButton onClick={() => setSelectedShot(null)} style={{ backgroundColor: '#444' }}>Close</RecalcButton>
          </div>
        </Modal>
        <GearSettingsModal
          isOpen={isGearModalOpen}
          onRequestClose={() => setIsGearModalOpen(false)}
          actionMapping={actionMapping}
          setActionMapping={setActionMapping}
          markerColors={markerColors}
          setMarkerColors={setMarkerColors}
        />
      </PageContainer>
    </ErrorBoundary>
  );
}