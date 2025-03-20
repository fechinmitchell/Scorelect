// src/components/GAAAnalysisDashboard.js

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import styled from 'styled-components';
import { Stage } from 'react-konva';
import Modal from 'react-modal';
import axios from 'axios';
import { useAuth } from '../AuthContext';

// Import pitch renderers, legend and the translation helper
import {
  renderGAAPitch,
  renderLegendOneSideShots,
  renderOneSidePitchShots,
  // We'll replace the built‐in translation with our custom one below.
  // translateShotToOneSide,
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
  background: #1c1c1c;
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
  flex-wrap: nowrap; /* Ensure two team details are side by side */
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

// Helper to flatten shots from games
function flattenShots(games = []) {
  return games.flatMap((game) => game.gameData || []);
}

// Our custom translation function:
// If the shot's x is greater than half the pitch (72.5m), we mirror it: new x = pitchWidth - shot.x.
// Otherwise, we keep shot.x.
function translateShotCustom(shot, halfLineX, fullPitch) {
  const originalX = shot.x || 0;
  const translatedX = originalX > halfLineX ? fullPitch - originalX : originalX;
  return { ...shot, translatedX, distMeters: translatedX };
}

// For React Modal styling
Modal.setAppElement('#root');
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

// ---------- MAIN COMPONENT ----------
export default function GAAAnalysisDashboard() {
  const { state } = useLocation();
  const { file, sport, filters } = state || {};
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Filter state (including match)
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

  // For displaying shot details in a modal
  const [selectedShot, setSelectedShot] = useState(null);

  // Use a translation scale for the pitch calculations
  const xScale = 6;
  const yScale = 6;
  const halfLineX = pitchWidth / 2; // 72.5m
  const goalX = 0;
  const goalY = pitchHeight / 2; // 44

  function handleFilterChange(field, value) {
    setAppliedFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // On mount, set up filter options from the file
  useEffect(() => {
    if (!file || sport !== 'GAA') {
      Swal.fire('No Data', 'Invalid or no GAA dataset found.', 'error')
        .then(() => navigate('/analysis'));
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

  // Recompute summary when filters change
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

  // Flatten all shots from current games
  const allShots = flattenShots(games);

  // Aggregator for team stats
  // • Every shot is translated:
  //    If shot.x > halfLineX, then translated.x = pitchWidth – shot.x;
  //    Otherwise, translated.x = shot.x.
  // • Average distance is computed as the average of translated.x (which will be in [0, 72.5]).
  // • For categories (Offensive Marks, Frees, 45s, 2-Pointers), we display the count
  //   and in brackets the total attempts (here attempts equal the count, as no separate conversion data exists).
  useEffect(() => {
    const aggregator = {};
    const scorersMap = {};
    let teamDistance = {}; // Sum of translated.x for each team
    allShots.forEach((shot) => {
      const tm = shot.team || 'Unknown';
      if (!aggregator[tm]) {
        aggregator[tm] = {
          totalShots: 0,
          successfulShots: 0,
          points: 0,
          goals: 0,
          misses: 0,
          offensiveMarks: 0,
          frees: 0,
          fortyFives: 0,
          twoPointers: 0,
        };
        teamDistance[tm] = 0;
      }
      if (!scorersMap[tm]) {
        scorersMap[tm] = {};
      }
      aggregator[tm].totalShots++;

      // Use our custom translation:
      const translated = translateShotCustom(shot, halfLineX, pitchWidth);
      // translated.translatedX is now in [0, 72.5]
      teamDistance[tm] += translated.translatedX;

      // Normalize action string
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
        // Count as 2-Pointer if translated distance is at least 40m
        if (translated.translatedX >= 40) {
          aggregator[tm].twoPointers++;
        }
        const pName = shot.playerName || 'NoName';
        if (!scorersMap[tm][pName]) {
          scorersMap[tm][pName] = { goals: 0, points: 0 };
        }
        scorersMap[tm][pName].points++;
      } else if (action === 'offensive mark') {
        aggregator[tm].offensiveMarks++;
        aggregator[tm].successfulShots++;
      } else if (action === 'free') {
        aggregator[tm].frees++;
        aggregator[tm].successfulShots++;
      } else if (
        action === '45' ||
        action === 'forty five' ||
        action === 'forty-five' ||
        action === 'fortyfive'
      ) {
        aggregator[tm].fortyFives++;
        aggregator[tm].successfulShots++;
      } else if (
        action.includes('miss') ||
        action.includes('wide') ||
        action.includes('short') ||
        action.includes('post')
      ) {
        aggregator[tm].misses++;
      }
    });

    // Compute average translated distance for each team (will be between 0 and 72.5)
    Object.keys(aggregator).forEach((tm) => {
      const tStats = aggregator[tm];
      if (tStats.totalShots > 0) {
        tStats.avgDistance = (teamDistance[tm] / tStats.totalShots).toFixed(2);
      } else {
        tStats.avgDistance = '0.00';
      }
    });

    setTeamAggregatedData(aggregator);
    setTeamScorers(scorersMap);
  }, [allShots, halfLineX, pitchWidth]);

  // Handle Recalculate button click
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

      const response = await axios.post(
        `${BASE_API_URL}/recalculate-target-xpoints`,
        payload
      );

      if (response.data.success) {
        Swal.fire(
          'Recalculation Complete',
          'xP and xG values have been updated for ' + targetDataset,
          'success'
        );
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

  // Reload updated dataset from Firestore
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

  // When a shot is clicked, translate it and open the modal
  const handleShotClick = (shot) => {
    const transformedShot = translateShotCustom(shot, halfLineX, pitchWidth);
    setSelectedShot(transformedShot);
  };

  // Render shot details in a modal (using the translated value)
  function renderSelectedShotDetails() {
    if (!selectedShot) return null;
    const distance = selectedShot.translatedX !== undefined
      ? selectedShot.translatedX.toFixed(1)
      : 'N/A';
    const xPVal = typeof selectedShot.xPoints === 'number'
      ? selectedShot.xPoints.toFixed(2)
      : 'N/A';
    const xPAdvVal = typeof selectedShot.xP_adv === 'number'
      ? selectedShot.xP_adv.toFixed(2)
      : 'N/A';

    return (
      <div style={{ lineHeight: '1.6' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#ffc107' }}>Shot Details</h2>
        <p><strong>Team:</strong> {selectedShot.team || 'N/A'}</p>
        <p><strong>Player:</strong> {selectedShot.playerName || 'N/A'}</p>
        <p><strong>Minute:</strong> {selectedShot.minute || 'N/A'}</p>
        <p><strong>Action:</strong> {selectedShot.action || 'N/A'}</p>
        <p><strong>Distance (m):</strong> {distance}</p>
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

  // Helper to format stat with attempts (here attempts equal the count, since no extra attempt data is provided)
  const formatStat = (count) => `${count} (${count} attempts)`;

  return (
    <PageContainer>
      <Header>GAA Analysis Dashboard</Header>

      {/* Filters and Summary Section */}
      <Section>
        <FiltersAndStatsContainer>
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
        </FiltersAndStatsContainer>
      </Section>

      {/* Pitch and Team Stats Section */}
      <Section>
        <PitchAndTeamStatsWrapper>
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
                    setPlayMiss: 'red',
                  },
                  xScale,
                  yScale,
                  onShotClick: handleShotClick,
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
                    setPlayMiss: 'red',
                  },
                  xScale * (pitchWidth / 2),
                  yScale * pitchHeight
                )}
              </Stage>
            </div>
          </PitchSection>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap', justifyContent: 'center' }}>
            {Object.keys(teamAggregatedData).map((tmName) => {
              const tStats = teamAggregatedData[tmName];
              const scorersObj = teamScorers[tmName] || {};
              return (
                <TeamStatsCard key={tmName}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>
                    {tmName} Stats
                  </h3>
                  <p>Total Shots: {tStats.totalShots}</p>
                  <p>Successful Shots: {tStats.successfulShots}</p>
                  <p>Points: {tStats.points}</p>
                  <p>Goals: {tStats.goals}</p>
                  <p>Misses: {tStats.misses}</p>
                  <p>Offensive Marks: {formatStat(tStats.offensiveMarks)}</p>
                  <p>Frees: {formatStat(tStats.frees)}</p>
                  <p>45s: {formatStat(tStats.fortyFives)}</p>
                  <p>2-Pointers: {formatStat(tStats.twoPointers)}</p>
                  <p>Avg Distance Above Half (m): {tStats.avgDistance}</p>
                  <h4 style={{ marginTop: '1rem', color: '#fff' }}>Scorers</h4>
                  {Object.keys(scorersObj).length === 0 && (
                    <p style={{ margin: 0 }}>No scorers found</p>
                  )}
                  {Object.entries(scorersObj).map(([playerName, val]) => (
                    <p key={playerName} style={{ margin: 0 }}>
                      {playerName}:
                      {val.goals > 0 && ` ${val.goals} goal(s)`}
                      {val.points > 0 && ` ${val.points} point(s)`}
                    </p>
                  ))}
                </TeamStatsCard>
              );
            })}
          </div>
        </PitchAndTeamStatsWrapper>
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
        style={customModalStyles}
        contentLabel="Shot Details Modal"
      >
        {selectedShot && (
          <div style={{ lineHeight: '1.6' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#ffc107' }}>Shot Details</h2>
            <p><strong>Team:</strong> {selectedShot.team || 'N/A'}</p>
            <p><strong>Player:</strong> {selectedShot.playerName || 'N/A'}</p>
            <p><strong>Minute:</strong> {selectedShot.minute || 'N/A'}</p>
            <p><strong>Action:</strong> {selectedShot.action || 'N/A'}</p>
            <p>
              <strong>Distance (m):</strong>{' '}
              {selectedShot.translatedX !== undefined
                ? selectedShot.translatedX.toFixed(1)
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
        )}
        <div style={{ textAlign: 'right', marginTop: '1rem' }}>
          <RecalcButton onClick={() => setSelectedShot(null)} style={{ backgroundColor: '#444' }}>
            Close
          </RecalcButton>
        </div>
      </Modal>
    </PageContainer>
  );
}
