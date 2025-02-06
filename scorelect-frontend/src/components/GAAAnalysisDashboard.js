// src/components/GAAAnalysisDashboard.js

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import styled from 'styled-components';
import { Stage } from 'react-konva';
import axios from 'axios';
import { useAuth } from '../AuthContext';

// Import your pitch functions from GAAPitchComponents (adjust path as needed)
import { renderGAAPitch, renderOneSidePitchShots } from './GAAPitchComponents';

// ---------- Default Colors & Pitch Size ----------
const defaultPitchColor = '#006400';
const defaultLineColor = '#FFFFFF';
const defaultLightStripeColor = '#228B22';
const defaultDarkStripeColor = '#006400';

// Usually your pitch is 145x88m, but we can scale it
const pitchWidth = 145;
const pitchHeight = 88;

// ---------- Styled Components ----------

// A dark page container
const PageContainer = styled.div`
  background: #1c1c1c;
  min-height: 100vh;
  color: #ffc107; /* bright accent color */
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

// A single "card" or "section"
const Section = styled.section`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
`;

// The filters & summary tiles in the same container
const FiltersAndStatsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

// Filters area
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

// Summary tiles container
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
    color: #ffc107; /* bright accent color */
  }
`;

// Container for the half-pitch + Team Stats side by side
const PitchAndTeamStatsWrapper = styled.div`
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start;
`;

// The pitch card
const PitchSection = styled.section`
  background: #2a2a2a;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
`;

// The teams stats card
const TeamStatsCard = styled.div`
  background: #333;
  border-radius: 8px;
  padding: 1rem;
  min-width: 220px;
  box-shadow: 0 3px 5px rgba(0,0,0,0.2);
  align-self: flex-start; /* so it aligns at the top with the pitch */
`;

// ---------- Helper to flatten shots ----------
function flattenShots(games = []) {
  return games.flatMap((game) => game.gameData || []);
}

// ---------- Main Component ----------
export default function GAAAnalysisDashboard() {
  const { state } = useLocation();
  const { file, sport, filters } = state || {};
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [appliedFilters, setAppliedFilters] = useState({
    team: filters?.team || '',
    player: filters?.player || '',
    action: filters?.action || ''
  });

  // Summaries for the "All Shots" tile row
  const [summary, setSummary] = useState({
    totalShots: 0, 
    totalGoals: 0, 
    totalPoints: 0, 
    totalMisses: 0,
  });

  // Options for filters
  const [filterOptions, setFilterOptions] = useState({
    teams: [],
    players: [],
    actions: [],
  });

  // Data from Firestore
  const [games, setGames] = useState([]);

  // For aggregator
  const [teamAggregatedData, setTeamAggregatedData] = useState({});
  const [teamScorers, setTeamScorers] = useState({});

  // Pitch colors
  const [pitchColorState] = useState(defaultPitchColor);
  const [lineColorState] = useState(defaultLineColor);
  const [lightStripeColorState] = useState(defaultLightStripeColor);
  const [darkStripeColorState] = useState(defaultDarkStripeColor);

  // The standard GAA pitch is 145 x 88
  // We'll pick a bigger scale so the half-pitch is decent size
  const xScale = 6;
  const yScale = 6;

  // For half-pitch
  const halfLineX = pitchWidth / 2; 
  const goalX = 0;
  const goalY = pitchHeight / 2;

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

    // Build high-level summary for the "tiles"
    let totalShots = 0, totalGoals = 0, totalPoints = 0, totalMisses = 0;
    shots.forEach(sh => {
      totalShots++;
      const a = (sh.action || '').toLowerCase();
      if (a === 'goal' || a === 'penalty goal') totalGoals++;
      else if (a === 'point') totalPoints++;
      else if (a.includes('miss') || a.includes('wide') || a.includes('short'))
        totalMisses++;
    });
    setSummary({ totalShots, totalGoals, totalPoints, totalMisses });
    setGames(filteredGames);
  }, [file, appliedFilters]);

  // Flatten allShots (the filtered version)
  const allShots = flattenShots(games);

  // ----- AGGREGATOR for Each Team & Scorers -----
  useEffect(() => {
    const aggregator = {};
    const scorersMap = {};

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
          avgDistance: 0, // accumulate total distance, then we'll divide
        };
      }
      if (!scorersMap[tm]) {
        scorersMap[tm] = {}; // { 'Player X': { goals, points } }
      }

      aggregator[tm].totalShots++;
      const dist = shot.distMeters || 0;
      aggregator[tm].avgDistance += dist;

      const action = (shot.action || '').toLowerCase();
      if (action === 'goal' || action === 'penalty goal') {
        aggregator[tm].goals++;
        aggregator[tm].successfulShots++;
        // track scorer
        const pName = shot.playerName || 'NoName';
        if (!scorersMap[tm][pName]) {
          scorersMap[tm][pName] = { goals: 0, points: 0 };
        }
        scorersMap[tm][pName].goals++;
      } else if (action === 'point') {
        aggregator[tm].points++;
        aggregator[tm].successfulShots++;
        if (dist >= 40) {
          aggregator[tm].twoPointers++;
        }
        // track scorer
        const pName = shot.playerName || 'NoName';
        if (!scorersMap[tm][pName]) {
          scorersMap[tm][pName] = { goals: 0, points: 0 };
        }
        scorersMap[tm][pName].points++;
      } else if (
        action.includes('miss') ||
        action.includes('wide') ||
        action.includes('short') ||
        action.includes('post')
      ) {
        aggregator[tm].misses++;
      }
      // you can do frees, 45, etc. similarly
    });

    // finalize avgDistance
    Object.keys(aggregator).forEach((tm) => {
      const tStats = aggregator[tm];
      if (tStats.totalShots > 0) {
        tStats.avgDistance = (tStats.avgDistance / tStats.totalShots).toFixed(2);
      } else {
        tStats.avgDistance = '0.00';
      }
    });

    setTeamAggregatedData(aggregator);
    setTeamScorers(scorersMap);
  }, [allShots]);

  // ----- Recalc Handler -----
  const handleRecalculate = async () => {
    try {
      const userId = currentUser?.uid;
      if (!userId) {
        Swal.fire("Error", "No authenticated user ID found", "error");
        return;
      }
      const targetDataset = file?.datasetName || "DefaultDataset";
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
        // If the server returns updated summary, you can set it:
        if (response.data.summary) {
          setSummary(response.data.summary);
        }
        // Optionally refetch from Firestore
        await fetchUpdatedDataset(userId, targetDataset);
      }
    } catch (error) {
      console.error('Recalculation error:', error);
      Swal.fire('Error', 'Recalculation failed. Check the console for details.', 'error');
    }
  };

  // ----- Firestore reload (if needed) -----
  const fetchUpdatedDataset = async (uid, datasetName) => {
    try {
      const loadResp = await axios.post('http://localhost:5001/load-games', {
        uid: uid,
      });
      const allGames = loadResp.data || [];
      // filter for the specific dataset
      const filtered = allGames.filter(g => g.datasetName === datasetName);
      setGames(filtered);
    } catch (err) {
      console.error("Error fetching updated dataset:", err);
    }
  };

  // Filter change handler
  const handleFilterChange = (field, value) => {
    setAppliedFilters((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <PageContainer>
      <Header>GAA Analysis Dashboard</Header>

      {/* Filters + Summary */}
      <Section>
        <FiltersAndStatsContainer>
          {/* Filters */}
          <FiltersContainer>
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

          {/* Summary Tiles */}
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

      {/* Pitch + Team Stats side by side */}
      <Section>
        <PitchAndTeamStatsWrapper>

          {/* One-Sided Pitch on the left */}
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
                  onShotClick: (shot) => {
                    Swal.fire(
                      'Shot Details',
                      `Action: ${shot.action}\nTeam: ${shot.team}`,
                      'info'
                    );
                  },
                  halfLineX: pitchWidth / 2,
                  goalX: 0,
                  goalY: pitchHeight / 2,
                })}
              </Stage>
            </div>
          </PitchSection>

          {/* Team Stats on the right */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
                  <p>Offensive Marks: {tStats.offensiveMarks}</p>
                  <p>Frees: {tStats.frees}</p>
                  <p>45s: {tStats.fortyFives}</p>
                  <p>2-Pointers: {tStats.twoPointers}</p>
                  <p>Avg Distance (m): {tStats.avgDistance}</p>

                  {/* Scorers list */}
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

      {/* Recalc Button at bottom */}
      <div style={{ textAlign: 'center', marginTop: '20px'}}>
        <RecalcButton onClick={handleRecalculate}>
          Recalculate xP/xG for Target Dataset
        </RecalcButton>
      </div>
    </PageContainer>
  );
}
