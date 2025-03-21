// src/components/GAAAnalysisDashboard.js

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

// Import pitch renderers, legend and the translation helper
import {
  renderGAAPitch,
  renderLegendOneSideShots,
  renderOneSidePitchShots,
} from './GAAPitchComponents';

// ----- Environment-based API URLs -----
const BASE_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// ---------- Default Colors & Pitch Size ----------
const defaultPitchColor = '#006400';
const defaultLineColor = '#FFFFFF';
const defaultLightStripeColor = '#228B22';
const defaultDarkStripeColor = '#006400';
const pitchWidth = 145;
const pitchHeight = 88;

// ---------- Styled Components ----------
const PageContainer = styled.div`
  background: #1c1a1a;
  min-height: 100vh;
  color: #ffc107;
  padding: 2rem;
  font-family: 'Roboto', sans-serif;
`;

const Header = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
  font-weight: 600;
  font-size: 2rem;
  letter-spacing: 1px;
`;

const RecalcButton = styled.button`
  background-color: #0069d9;
  border: none;
  border-radius: 5px;
  color: #fff;
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  margin-bottom: 1rem;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  transition: background-color 0.3s ease;
  &:hover {
    background-color: #005bb5;
  }
`;

const DownloadButton = styled.button`
  background-color: #4caf50;
  border: none;
  border-radius: 5px;
  color: #fff;
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  margin-left: 1rem;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  transition: background-color 0.3s ease;
  &:hover {
    background-color: #45a049;
  }
`;

const Section = styled.section`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
`;

const FiltersAndStatsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FiltersContainer = styled.div`
  background: #333;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
`;

const FilterSelect = styled.select`
  padding: 0.5rem;
  border-radius: 5px;
  border: 1px solid #777;
  background: #fff;
  color: #000;
  font-size: 1rem;
`;

const TilesContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
`;

const Tile = styled.div`
  background: #333;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  h5 {
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #fff;
    font-size: 1rem;
  }
  p {
    font-size: 1rem;
    font-weight: bold;
    margin: 0;
    color: #ffc107;
  }
`;

const PitchAndTeamStatsWrapper = styled.div`
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: nowrap;
`;

const PitchSection = styled.section`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
`;

const TeamStatsCard = styled.div`
  background: #333;
  border-radius: 8px;
  padding: 1rem;
  min-width: 220px;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  align-self: flex-start;
`;

// New styled components for PDF content
const PdfContentWrapper = styled.div`
  position: relative;
  background-color: #333;
  padding: 1rem;
`;

const Watermark = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.3;
  pointer-events: none;
  font-size: 3rem;
  color: #fff;
  z-index: 10;
`;

// ---------- Helper Functions ----------

function flattenShots(games = []) {
  return games.flatMap((game) => game.gameData || []);
}

/*
  translateShotToGoal() computes the Euclidean distance from a shot's (x,y) to the appropriate goal centre.
  - For shots with x < half the pitch (72.5 m), we assume the left goal centre is at (0, pitchHeight/2).
  - For shots with x ≥ 72.5 m, we assume the shot is aimed at the right goal (centre: [pitchWidth, pitchHeight/2]).
  The computed distance is stored in the property distMeters.
*/
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

/*
  downloadPDF() captures the content inside the element with id "pdf-content"
  and creates a landscape PDF with a dark grey background and watermark.
*/
const downloadPDF = async (setIsDownloading) => {
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

// ---------- Modular Components ----------

function FiltersBar({ appliedFilters, handleFilterChange, filterOptions }) {
  return (
    <FiltersContainer>
      <FilterSelect
        value={appliedFilters.match}
        onChange={(e) => handleFilterChange('match', e.target.value)}
      >
        <option value="">All Matches</option>
        {filterOptions.matches.map((match) => (
          <option key={match} value={match}>
            {match}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        value={appliedFilters.team}
        onChange={(e) => handleFilterChange('team', e.target.value)}
      >
        <option value="">All Teams</option>
        {filterOptions.teams.map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        value={appliedFilters.player}
        onChange={(e) => handleFilterChange('player', e.target.value)}
      >
        <option value="">All Players</option>
        {filterOptions.players.map((player) => (
          <option key={player} value={player}>
            {player}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        value={appliedFilters.action}
        onChange={(e) => handleFilterChange('action', e.target.value)}
      >
        <option value="">All Actions</option>
        {filterOptions.actions.map((action) => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </FilterSelect>
    </FiltersContainer>
  );
}

function SummaryTiles({ summary }) {
  return (
    <TilesContainer>
      <Tile>
        <h5>Total Shots</h5>
        <p>{summary.totalShots}</p>
      </Tile>
      <Tile>
        <h5>Total Goals</h5>
        <p>{summary.totalGoals}</p>
      </Tile>
      <Tile>
        <h5>Total Points</h5>
        <p>{summary.totalPoints}</p>
      </Tile>
      <Tile>
        <h5>Total Misses</h5>
        <p>{summary.totalMisses}</p>
      </Tile>
    </TilesContainer>
  );
}

function StatsCard({ teamName, stats, scorers, formatCategory }) {
  return (
    <TeamStatsCard>
      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>{teamName} Stats</h3>
      <p>Total Shots: {stats.totalShots}</p>
      <p>Successful Shots: {stats.successfulShots || 0}</p>
      <p>Points: {stats.points}</p>
      <p>Goals: {stats.goals}</p>
      <p>Misses: {stats.misses}</p>
      <p>Offensive Marks: {formatCategory(stats.offensiveMarkAttempts || 0, stats.offensiveMarkScored || 0)}</p>
      <p>Frees: {formatCategory(stats.freeAttempts || 0, stats.freeScored || 0)}</p>
      <p>45s: {formatCategory(stats.fortyFiveAttempts || 0, stats.fortyFiveScored || 0)}</p>
      <p>2-Pointers: {formatCategory(stats.twoPointerAttempts || 0, stats.twoPointerScored || 0)}</p>
      <p>Avg Distance from Goal (m): {stats.avgDistance}</p>
      <h4 style={{ marginTop: '1rem', color: '#fff' }}>Scorers</h4>
      {Object.keys(scorers).length === 0 ? (
        <p style={{ margin: 0 }}>No scorers found</p>
      ) : (
        Object.entries(scorers).map(([playerName, val]) => (
          <p key={playerName} style={{ margin: 0 }}>
            {playerName}: {val.goals > 0 && `${val.goals} goal(s)`} {val.points > 0 && `${val.points} point(s)`}
          </p>
        ))
      )}
    </TeamStatsCard>
  );
}

function PitchView({ allShots, xScale, yScale, halfLineX, goalX, goalY, onShotClick }) {
  return (
    <PitchSection>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Stage
          width={xScale * (pitchWidth / 2)}
          height={yScale * pitchHeight}
          style={{
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {renderOneSidePitchShots({
            shots: allShots,
            colors: {
              goal: '#FFFF33',
              point: '#39FF14',
              miss: 'red',
              setPlayScore: '#39FF14',
              setPlayMiss: '#39FF14',
            },
            xScale,
            yScale,
            onShotClick,
            halfLineX,
            goalX,
            goalY,
          })}
          {renderLegendOneSideShots(
            {
              goal: '#FFFF33',
              point: '#39FF14',
              miss: 'red',
              setPlayScore: '#39FF14',
              setPlayMiss: '#39FF14',
            },
            xScale * (pitchWidth / 2),
            yScale * pitchHeight
          )}
        </Stage>
      </div>
    </PitchSection>
  );
}

// ---------- Updated Modal Styling ----------
// Updated customModalStyles for a nicely styled and well-sized modal.
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
    backgroundColor: '#2e2e2e',
    color: '#fff',
    overflow: 'auto',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 9999,
  },
};

// ---------- ErrorBoundary Component ----------
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <h2 style={{ textAlign: 'center', color: 'red' }}>Something went wrong.</h2>;
    }
    return this.props.children;
  }
}

// ---------- Main Component: GAAAnalysisDashboard ----------
export default function GAAAnalysisDashboard() {
  const { state } = useLocation();
  const { file, sport, filters } = state || {};
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [appliedFilters, setAppliedFilters] = useState({
    team: filters?.team || '',
    player: filters?.player || '',
    action: filters?.action || '',
    match: filters?.match || '',
  });

  const [summary, setSummary] = useState({
    totalShots: 0,
    totalGoals: 0,
    totalPoints: 0,
    totalMisses: 0,
  });

  const [filterOptions, setFilterOptions] = useState({
    teams: [],
    players: [],
    actions: [],
    matches: [],
  });

  const [games, setGames] = useState([]);
  const [teamAggregatedData, setTeamAggregatedData] = useState({});
  const [teamScorers, setTeamScorers] = useState({});
  const [selectedShot, setSelectedShot] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const xScale = 6;
  const yScale = 6;
  const halfLineX = pitchWidth / 2; // 72.5 m
  const goalX = 0;
  const goalY = pitchHeight / 2; // 44

  function handleFilterChange(field, value) {
    setAppliedFilters((prev) => ({ ...prev, [field]: value }));
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
    (file.games || []).forEach((g) => {
      if (g.match) mSet.add(g.match);
      (g.gameData || []).forEach((sh) => {
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
    if (appliedFilters.match) {
      filteredGames = filteredGames.filter((g) => g.match === appliedFilters.match);
    }
    if (appliedFilters.team) {
      filteredGames = filteredGames.map((g) => ({
        ...g,
        gameData: (g.gameData || []).filter((sh) => sh.team === appliedFilters.team),
      }));
    }
    if (appliedFilters.player) {
      filteredGames = filteredGames.map((g) => ({
        ...g,
        gameData: (g.gameData || []).filter((sh) => sh.playerName === appliedFilters.player),
      }));
    }
    if (appliedFilters.action) {
      filteredGames = filteredGames.map((g) => ({
        ...g,
        gameData: (g.gameData || []).filter((sh) => sh.action === appliedFilters.action),
      }));
    }
    filteredGames = filteredGames.filter((g) => (g.gameData || []).length > 0);
    const shots = flattenShots(filteredGames);
    let totalShots = 0, totalGoals = 0, totalPoints = 0, totalMisses = 0;
    shots.forEach((sh) => {
      totalShots++;
      const a = (sh.action || '').toLowerCase().trim();
      if (a === 'goal' || a === 'penalty goal') totalGoals++;
      else if (a === 'point') totalPoints++;
      else if (a.includes('miss') || a.includes('wide') || a.includes('short'))
        totalMisses++;
    });
    setSummary({ totalShots, totalGoals, totalPoints, totalMisses });
    setGames(filteredGames);
  }, [file, appliedFilters]);

  const allShots = flattenShots(games);

  const eligibleFor2Pointer = ['point', 'free', 'offensive mark', '45', 'fortyfive'];

  const aggregatedData = useMemo(() => {
    const aggregator = {};
    const scorersMap = {};
    let teamDistance = {};
    allShots.forEach((shot) => {
      const tm = shot.team || 'Unknown';
      if (!aggregator[tm]) {
        aggregator[tm] = {
          totalShots: 0,
          successfulShots: 0,
          points: 0,
          goals: 0,
          misses: 0,
          freeAttempts: 0,
          freeScored: 0,
          offensiveMarkAttempts: 0,
          offensiveMarkScored: 0,
          fortyFiveAttempts: 0,
          fortyFiveScored: 0,
          twoPointerAttempts: 0,
          twoPointerScored: 0,
        };
        teamDistance[tm] = 0;
      }
      if (!scorersMap[tm]) {
        scorersMap[tm] = {};
      }
      aggregator[tm].totalShots++;

      const translated = translateShotToGoal(shot, pitchWidth, pitchHeight);
      teamDistance[tm] += translated.distMeters;

      const action = (shot.action || '').toLowerCase().trim();

      if (action === 'goal' || action === 'penalty goal') {
        aggregator[tm].goals++;
        aggregator[tm].successfulShots++;
        const pName = shot.playerName || 'NoName';
        if (!scorersMap[tm][pName]) {
          scorersMap[tm][pName] = { goals: 0, points: 0 };
        }
        scorersMap[tm][pName].goals++;
      } else if (action === 'point') {
        aggregator[tm].points++;
        aggregator[tm].successfulShots++;
        const pName = shot.playerName || 'NoName';
        if (!scorersMap[tm][pName]) {
          scorersMap[tm][pName] = { goals: 0, points: 0 };
        }
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
      if (
        action.includes('miss') ||
        action.includes('wide') ||
        action.includes('short') ||
        action.includes('post')
      ) {
        aggregator[tm].misses++;
      }
      if (eligibleFor2Pointer.includes(action)) {
        if (translated.distMeters >= 40) {
          aggregator[tm].twoPointerAttempts++;
          if (
            action === 'point' ||
            action === 'free' ||
            action === 'offensive mark' ||
            action === '45' ||
            action === 'fortyfive'
          ) {
            aggregator[tm].twoPointerScored++;
          }
        }
      }
    });

    Object.keys(aggregator).forEach((tm) => {
      const tStats = aggregator[tm];
      tStats.avgDistance = tStats.totalShots > 0 ? (teamDistance[tm] / tStats.totalShots).toFixed(2) : '0.00';
    });

    return { aggregator, scorersMap };
  }, [allShots, pitchWidth, pitchHeight]);

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
      const payload = {
        user_id: userId,
        training_dataset: trainingDataset,
        target_dataset: targetDataset,
      };
      const response = await axios.post(`${BASE_API_URL}/recalculate-target-xpoints`, payload);
      if (response.data.success) {
        Swal.fire('Recalculation Complete', `xP and xG values have been updated for ${targetDataset}`, 'success');
        if (response.data.summary) {
          setSummary(response.data.summary);
        }
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
      const filtered = allGames.filter((g) => g.datasetName === datasetName);
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
    const distance = selectedShot.distMeters !== undefined
      ? selectedShot.distMeters.toFixed(1)
      : 'N/A';
    const xPVal = typeof selectedShot.xPoints === 'number'
      ? selectedShot.xPoints.toFixed(2)
      : 'N/A';
    const xPAdvVal = typeof selectedShot.xP_adv === 'number'
      ? selectedShot.xP_adv.toFixed(2)
      : 'N/A';
    return (
      <div style={{ lineHeight: '1.6' }}>
        <h2 id="shot-details-title" style={{ marginTop: 0, marginBottom: '1rem', color: '#ffc107' }}>
          Shot Details
        </h2>
        <p><strong>Team:</strong> {selectedShot.team || 'N/A'}</p>
        <p><strong>Player:</strong> {selectedShot.playerName || 'N/A'}</p>
        <p><strong>Minute:</strong> {selectedShot.minute || 'N/A'}</p>
        <p><strong>Action:</strong> {selectedShot.action || 'N/A'}</p>
        <p>
          <strong>Distance (m):</strong>{' '}
          {selectedShot.distMeters !== undefined
            ? selectedShot.distMeters.toFixed(1)
            : 'N/A'}
        </p>
        <p><strong>Foot:</strong> {selectedShot.foot || 'N/A'}</p>
        <p><strong>Pressure:</strong> {selectedShot.pressure || 'N/A'}</p>
        <p><strong>Position:</strong> {selectedShot.position || 'N/A'}</p>
        <p>
          <strong>xP:</strong>{' '}
          {typeof selectedShot.xPoints === 'number'
            ? selectedShot.xPoints.toFixed(2)
            : 'N/A'}
        </p>
        <p>
          <strong>xP_ADV:</strong>{' '}
          {typeof selectedShot.xP_adv === 'number'
            ? selectedShot.xP_adv.toFixed(2)
            : 'N/A'}
        </p>
      </div>
    );
  }

  const formatCategory = (attempts, scored) => `${attempts} (${scored} Scored)`;

  return (
    <ErrorBoundary>
      <PageContainer>
        <Header>GAA Analysis Dashboard</Header>

        {/* Filters and Summary Section */}
        <Section>
          <FiltersAndStatsContainer>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <FiltersBar
                appliedFilters={appliedFilters}
                handleFilterChange={handleFilterChange}
                filterOptions={filterOptions}
              />
              <DownloadButton onClick={() => downloadPDF(setIsDownloading)}>
                {isDownloading ? 'Downloading...' : 'Download PDF'}
              </DownloadButton>
            </div>
            <SummaryTiles summary={summary} />
          </FiltersAndStatsContainer>
        </Section>

        {/* PDF Content: Half Pitch and Team Stats (landscape) */}
        <Section id="pdf-content">
          <PdfContentWrapper id="pdf-content">
            {/* <Watermark>scorelect.com</Watermark> */}
            <PitchAndTeamStatsWrapper>
              <PitchView
                allShots={allShots}
                xScale={xScale}
                yScale={yScale}
                halfLineX={halfLineX}
                goalX={goalX}
                goalY={goalY}
                onShotClick={handleShotClick}
              />
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap', justifyContent: 'center' }}>
                {Object.keys(teamAggregatedData).map((tmName) => {
                  const tStats = teamAggregatedData[tmName];
                  const scorersObj = teamScorers[tmName] || {};
                  return (
                    <StatsCard
                      key={tmName}
                      teamName={tmName}
                      stats={tStats}
                      scorers={scorersObj}
                      formatCategory={formatCategory}
                    />
                  );
                })}
              </div>
            </PitchAndTeamStatsWrapper>
          </PdfContentWrapper>
        </Section>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <RecalcButton onClick={handleRecalculate}>
            Recalculate xP/xG for Target Dataset
          </RecalcButton>
        </div>

        {/* Shot Details Modal */}
        <Modal
          isOpen={!!selectedShot}
          onRequestClose={() => setSelectedShot(null)}
          contentLabel="Shot Details Modal"
          aria={{
            labelledby: "shot-details-title",
            describedby: "shot-details-description",
          }}
          style={customModalStyles}
        >
          {selectedShot && (
            <div style={{ lineHeight: '1.6' }}>
              {renderSelectedShotDetails()}
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <RecalcButton onClick={() => setSelectedShot(null)} style={{ backgroundColor: '#444' }}>
              Close
            </RecalcButton>
          </div>
        </Modal>
      </PageContainer>
    </ErrorBoundary>
  );
}


