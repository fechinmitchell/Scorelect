// src/components/SoccerAnalysisDashboard.js

import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLocation } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import Draggable from 'react-draggable';

const Container = styled.div`
  background: #f0f2f5;
  min-height: 100vh;
  padding: 20px;
  color: #333;
  font-family: Arial, sans-serif;
`;

const Header = styled.div`
  margin-bottom: 30px;
  text-align: center;
`;

const FiltersBar = styled.div`
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 40px;
`;

const Select = styled.select`
  width: 200px;
  padding: 8px;
  border-radius: 5px;
  border: 1px solid #ccc;
`;

const TilesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 40px;
  justify-content: center;
`;

const Tile = styled.div`
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  width: 200px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
`;

const TileTitle = styled.h3`
  margin-bottom: 10px;
  font-size: 1rem;
  color: #666;
`;

const TileValue = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(370px, 1fr));
  grid-gap: 20px;
  margin-bottom: 40px;
`;

// A styled container for each chart, making it draggable and able to hide
const ChartWrapper = styled.div`
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: relative;
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const ChartTitle = styled.h2`
  font-size: 1.1rem;
  color: #333;
  margin: 0;
`;

const ChartButtons = styled.div`
  display: flex;
  gap: 10px;
`;

const ChartButton = styled.button`
  background: #501387;
  color: white;
  border: none;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9rem;
  &:hover {
    background: #3a0e66;
  }
`;

const SoccerAnalysisDashboard = () => {
  const location = useLocation();
  const { data, filters, charts, sport } = location.state || {};

  // Hooks must be called unconditionally
  const [dashboardTeam, setDashboardTeam] = useState('All');
  const [dashboardPlayer, setDashboardPlayer] = useState('All');
  const [dashboardEvent, setDashboardEvent] = useState('All');
  const [hiddenCharts, setHiddenCharts] = useState({ xgChart: false, shotDistribution: false, passCompletion: false, goalsOverTime: false, playerShots: false, teamPossession: false });

  // If no data or not soccer, handle after hooks
  if (!data || !sport) {
    return <Container>No data available. Please go back and select a dataset.</Container>;
  }

  if (sport !== 'Soccer') {
    return <Container>This dashboard is only available for Soccer. Please select Soccer from the sidebar.</Container>;
  }

  const allGames = data.games || [];
  const allEvents = allGames.flatMap((game) => game.gameData || []);

  const uniqueTeams = Array.from(new Set(allEvents.map(e => e.team))).filter(Boolean);
  const uniquePlayers = Array.from(new Set(allEvents.map(e => e.playerName))).filter(Boolean);
  const uniqueActions = Array.from(new Set(allEvents.map(e => e.action))).filter(Boolean);

  // Filter events
  const filteredEvents = allEvents.filter(event => {
    const teamMatch = dashboardTeam === 'All' ? true : event.team === dashboardTeam;
    const playerMatch = dashboardPlayer === 'All' ? true : event.playerName === dashboardPlayer;
    const actionMatch = dashboardEvent === 'All' ? true : event.action === dashboardEvent;
    return teamMatch && playerMatch && actionMatch;
  });

  // Summary metrics
  const totalGoals = filteredEvents.filter(e => e.action === 'goal').length;
  const totalShots = filteredEvents.filter(e => (e.action || '').includes('shot')).length;
  const totalAssists = filteredEvents.filter(e => e.action === 'assist').length;
  const totalMatches = new Set(filteredEvents.map(e => e.gameName)).size;

  // Mock XG calculations (just for demonstration)
  const processedEvents = filteredEvents.map(e => {
    let xg = 0;
    if (e.action === 'goal') xg = 0.3;
    else if (e.action === 'shot on target') xg = 0.15;
    else if (e.action === 'shot off target') xg = 0.05;
    return { ...e, xg };
  });

  // XG by team
  const xgByTeamMap = {};
  processedEvents.forEach(e => {
    if (!xgByTeamMap[e.team]) xgByTeamMap[e.team] = 0;
    xgByTeamMap[e.team] += e.xg;
  });
  const xgData = Object.entries(xgByTeamMap).map(([teamName, xg]) => ({ name: teamName, xg }));

  // Another sample chart: shot distribution by action
  const actionCountMap = {};
  filteredEvents.forEach(e => {
    const a = e.action || 'Unknown';
    if (!actionCountMap[a]) actionCountMap[a] = 0;
    actionCountMap[a]++;
  });
  const shotDistributionData = Object.entries(actionCountMap).map(([action, count]) => ({ action, count }));

  // Example chart: passes completion (mock)
  // Counting "assist" as successful pass, "missed pass" if any
  const passCompletionData = [
    { team: 'Arsenal', completed: 40, missed: 20 },
    { team: 'Opponent', completed: 30, missed: 25 },
  ];

  // Example chart: goals over time (mock)
  const goalsOverTimeData = [
    { minute: '0-15', goals: filteredEvents.filter(e => e.action === 'goal' && parseInt(e.minute,10) <= 15).length },
    { minute: '16-30', goals: filteredEvents.filter(e => e.action === 'goal' && parseInt(e.minute,10) > 15 && parseInt(e.minute,10) <= 30).length },
    { minute: '31-45', goals: filteredEvents.filter(e => e.action === 'goal' && parseInt(e.minute,10) > 30 && parseInt(e.minute,10) <= 45).length },
    { minute: '46-60', goals: filteredEvents.filter(e => e.action === 'goal' && parseInt(e.minute,10) > 45 && parseInt(e.minute,10) <= 60).length },
    { minute: '61-75', goals: filteredEvents.filter(e => e.action === 'goal' && parseInt(e.minute,10) > 60 && parseInt(e.minute,10) <= 75).length },
    { minute: '76-90+', goals: filteredEvents.filter(e => e.action === 'goal' && parseInt(e.minute,10) > 75).length },
  ];

  // Example playerShotsData (mock)
  const playerShotsData = uniquePlayers.map(player => {
    const playerShots = filteredEvents.filter(e => e.playerName === player && e.action && e.action.includes('shot')).length;
    return { player, shots: playerShots };
  });

  // Example teamPossessionData (mock)
  const teamPossessionData = [
    { name: 'Arsenal', possession: 60 },
    { name: 'Opponent', possession: 40 }
  ];

  const handleHideChart = (chartKey) => {
    setHiddenCharts(prev => ({ ...prev, [chartKey]: true }));
  };

  const handleShowChart = (chartKey) => {
    setHiddenCharts(prev => ({ ...prev, [chartKey]: false }));
  };

  return (
    <Container>
      <Header>
        <h1>Soccer Analysis Dashboard</h1>
        <p>Analyze performance metrics, expected goals, and event distributions for your soccer matches.</p>
      </Header>

      {/* Filters */}
      <FiltersBar>
        <Select value={dashboardTeam} onChange={(e) => setDashboardTeam(e.target.value)}>
          <option value="All">All Teams</option>
          {uniqueTeams.map((team, i) => (
            <option key={i} value={team}>{team}</option>
          ))}
        </Select>

        <Select value={dashboardPlayer} onChange={(e) => setDashboardPlayer(e.target.value)}>
          <option value="All">All Players</option>
          {uniquePlayers.map((player, i) => (
            <option key={i} value={player}>{player}</option>
          ))}
        </Select>

        <Select value={dashboardEvent} onChange={(e) => setDashboardEvent(e.target.value)}>
          <option value="All">All Events</option>
          {uniqueActions.map((action, i) => (
            <option key={i} value={action}>{action}</option>
          ))}
        </Select>
      </FiltersBar>

      {/* Summary Tiles */}
      <TilesContainer>
        <Tile>
          <TileTitle>Total Matches</TileTitle>
          <TileValue>{totalMatches}</TileValue>
        </Tile>
        <Tile>
          <TileTitle>Total Goals</TileTitle>
          <TileValue>{totalGoals}</TileValue>
        </Tile>
        <Tile>
          <TileTitle>Total Shots</TileTitle>
          <TileValue>{totalShots}</TileValue>
        </Tile>
        <Tile>
          <TileTitle>Total Assists</TileTitle>
          <TileValue>{totalAssists}</TileValue>
        </Tile>
      </TilesContainer>

      {/* Chart Grid */}
      <GridContainer>
        {!hiddenCharts.xgChart && charts && charts.xgChart && (
          <Draggable>
            <ChartWrapper>
              <ChartHeader>
                <ChartTitle>Expected Goals (XG) by Team</ChartTitle>
                <ChartButtons>
                  <ChartButton onClick={() => handleHideChart('xgChart')}>Hide</ChartButton>
                </ChartButtons>
              </ChartHeader>
              {xgData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={xgData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'XG', angle: -90, position: 'insideLeft' }}/>
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="xg" fill="#501387" name="XG" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p>No data for XG chart.</p>
              )}
            </ChartWrapper>
          </Draggable>
        )}

        {!hiddenCharts.shotDistribution && (
          <Draggable>
            <ChartWrapper>
              <ChartHeader>
                <ChartTitle>Shot Distribution</ChartTitle>
                <ChartButtons>
                  <ChartButton onClick={() => handleHideChart('shotDistribution')}>Hide</ChartButton>
                </ChartButtons>
              </ChartHeader>
              {shotDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={shotDistributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="action" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p>No data for shot distribution.</p>
              )}
            </ChartWrapper>
          </Draggable>
        )}

        {!hiddenCharts.passCompletion && (
          <Draggable>
            <ChartWrapper>
              <ChartHeader>
                <ChartTitle>Pass Completion (Mock)</ChartTitle>
                <ChartButtons>
                  <ChartButton onClick={() => handleHideChart('passCompletion')}>Hide</ChartButton>
                </ChartButtons>
              </ChartHeader>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={passCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="team" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill="#82ca9d" name="Completed" />
                  <Bar dataKey="missed" stackId="a" fill="#ff9999" name="Missed" />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Draggable>
        )}

        {!hiddenCharts.goalsOverTime && (
          <Draggable>
            <ChartWrapper>
              <ChartHeader>
                <ChartTitle>Goals Over Time</ChartTitle>
                <ChartButtons>
                  <ChartButton onClick={() => handleHideChart('goalsOverTime')}>Hide</ChartButton>
                </ChartButtons>
              </ChartHeader>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={goalsOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="minute" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="goals" fill="#ffc658" name="Goals" />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Draggable>
        )}

        {!hiddenCharts.playerShots && (
          <Draggable>
            <ChartWrapper>
              <ChartHeader>
                <ChartTitle>Player Shots</ChartTitle>
                <ChartButtons>
                  <ChartButton onClick={() => handleHideChart('playerShots')}>Hide</ChartButton>
                </ChartButtons>
              </ChartHeader>
              {playerShotsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={playerShotsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="player" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="shots" fill="#a83232" name="Shots" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p>No data for player shots.</p>
              )}
            </ChartWrapper>
          </Draggable>
        )}

        {!hiddenCharts.teamPossession && (
          <Draggable>
            <ChartWrapper>
              <ChartHeader>
                <ChartTitle>Team Possession (Mock)</ChartTitle>
                <ChartButtons>
                  <ChartButton onClick={() => handleHideChart('teamPossession')}>Hide</ChartButton>
                </ChartButtons>
              </ChartHeader>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamPossessionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }}/>
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="possession" fill="#501387" name="Possession (%)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </Draggable>
        )}
      </GridContainer>

      {/* Buttons to show hidden charts again */}
      <div style={{ textAlign: 'center' }}>
        <p>Show Hidden Charts:</p>
        {Object.keys(hiddenCharts).map(chartKey => hiddenCharts[chartKey] && (
          <ChartButton key={chartKey} onClick={() => handleShowChart(chartKey)}>
            Show {chartKey}
          </ChartButton>
        ))}
      </div>
    </Container>
  );
};

export default SoccerAnalysisDashboard;
