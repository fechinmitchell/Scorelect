// src/components/FilterPage.js

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Swal from 'sweetalert2';
import PropTypes from 'prop-types';
import { useAuth } from '../AuthContext'; // Import useAuth

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #000000;

  @media (max-width: 850px) {
    padding: 20px;
  }
`;

const FilterContainer = styled.div`
  background-color: #ffffff;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 80%;
  max-width: 600px;

  @media (max-width: 850px) {
    width: 100%;
  }
`;

const FilterGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #ccc;
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const CheckboxLabel = styled.label`
  margin-bottom: 8px;
  font-weight: normal;
`;

const ContinueButton = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s;

  &:hover {
    background-color: #0069d9;
  }
`;

const FilterPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { file, sport } = location.state || {};
  const [data, setData] = useState([]);
  const [teamOptions, setTeamOptions] = useState([]);
  const [actionOptions, setActionOptions] = useState([]);
  const [playerOptions, setPlayerOptions] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedCharts, setSelectedCharts] = useState({
    heatmap: true,
    xgChart: false,
    teamPerformance: true,
    playsDistribution: true,
  });
  const [selectedMatch, setSelectedMatch] = useState('all'); // New state for match selection
  const { currentUser, userData, loading } = useAuth(); // Get currentUser, userData, and loading from context

  // Check if user is logged in and if they are 'paid' user
  useEffect(() => {
    if (loading) {
      // Still loading user data, do nothing
      return;
    }
    if (!currentUser) {
      // User not authenticated, redirect to sign-in page
      Swal.fire({
        title: 'Authentication Required',
        text: 'Please sign in to access this page.',
        icon: 'warning',
        confirmButtonText: 'Sign In',
      }).then(() => {
        navigate('/signin');
      });
    } else if (userData && userData.role !== 'paid') {
      // User is authenticated but not a paid user
      Swal.fire({
        title: 'Upgrade Required',
        text: 'This feature is available for premium users only. Please upgrade your account.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Upgrade Now',
        cancelButtonText: 'Cancel',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/upgrade');
        } else {
          navigate('/');
        }
      });
    }
  }, [currentUser, userData, loading, navigate]);

  useEffect(() => {
    if (!file || !sport) {
      Swal.fire({
        title: 'Missing Data',
        text: 'No dataset found. Please upload a dataset first.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
      navigate('/analysis');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      const fileExtension = file.name.split('.').pop().toLowerCase();

      if (fileExtension === 'json') {
        try {
          const jsonData = JSON.parse(content);
          if (!jsonData.dataset || !jsonData.games || !Array.isArray(jsonData.games)) {
            throw new Error('Invalid dataset structure');
          }
          setData(jsonData.games);
          extractFilterOptions(jsonData.games);
          Swal.fire({
            title: 'Data Parsed',
            text: 'Your dataset has been successfully parsed.',
            icon: 'success',
            confirmButtonText: 'OK',
          });
        } catch (error) {
          console.error('JSON Parsing Error:', error);
          Swal.fire({
            title: 'Invalid JSON',
            text: 'Failed to parse JSON file. Ensure it has the correct structure.',
            icon: 'error',
            confirmButtonText: 'OK',
          });
        }
      } else {
        Swal.fire({
          title: 'Unsupported Format',
          text: 'Please upload a JSON file.',
          icon: 'warning',
          confirmButtonText: 'OK',
        });
      }
    };

    reader.onerror = () => {
      console.error('File Reading Error:', reader.error);
      Swal.fire({
        title: 'File Read Error',
        text: 'An error occurred while reading the file.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    };

    reader.readAsText(file);
  }, [file, navigate, sport]);

  const extractFilterOptions = (games) => {
    const teams = new Set();
    const actions = new Set();
    const players = new Set();

    games.forEach((game) => {
      game.gameData.forEach((entry) => {
        if (entry.team) teams.add(entry.team);
        if (entry.action) actions.add(entry.action);
        if (entry.playerName) players.add(entry.playerName);
      });
    });

    setTeamOptions([...teams]);
    setActionOptions([...actions]);
    setPlayerOptions([...players]);
  };

  const handleChartSelection = (e) => {
    const { name, checked } = e.target;
    setSelectedCharts((prev) => ({ ...prev, [name]: checked }));
  };

  const handleContinue = () => {
    const filters = {
      team: selectedTeam || null,
      action: selectedAction || null,
      player: selectedPlayer || null,
    };

    const charts = {
      heatmap: selectedCharts.heatmap,
      xgChart: selectedCharts.xgChart,
      teamPerformance: selectedCharts.teamPerformance,
      playsDistribution: selectedCharts.playsDistribution,
    };

    let filteredData;

    if (selectedMatch === 'all') {
      // Analyze all matches
      filteredData = data.filter((game) => {
        const filteredGameData = game.gameData.filter((entry) => {
          const teamMatch = filters.team ? entry.team === filters.team : true;
          const actionMatch = filters.action ? entry.action === filters.action : true;
          const playerMatch = filters.player ? entry.playerName === filters.player : true;
          return teamMatch && actionMatch && playerMatch;
        });
        return filteredGameData.length > 0;
      });
    } else {
      // Analyze selected match
      filteredData = data.filter((game) => game.gameName === selectedMatch);
    }

    const heatmapPage = {
      Soccer: '/analysis/heatmap',
      GAA: '/analysis/heatmap-gaa',
      AmericanFootball: '/analysis/heatmap-af',
      Basketball: '/analysis/heatmap-bball',
    }[sport] || '/analysis/heatmap';

    navigate(heatmapPage, { state: { data: filteredData, filters, charts, sport } });
  };

  // If loading, show a loading message or spinner
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Container>
      <FilterContainer>
        <h2>Filter Your Data</h2>

        {/* Match Selection */}
        <FilterGroup>
          <Label htmlFor="match">Select Match:</Label>
          <Select
            id="match"
            value={selectedMatch}
            onChange={(e) => setSelectedMatch(e.target.value)}
          >
            <option value="all">All Matches</option>
            {data.map((game) => (
              <option key={game.gameName} value={game.gameName}>
                {game.gameName}
              </option>
            ))}
          </Select>
        </FilterGroup>

        {/* Team Filter */}
        <FilterGroup>
          <Label htmlFor="team">Team:</Label>
          <Select
            id="team"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">All Teams</option>
            {teamOptions.map((team, index) => (
              <option key={index} value={team}>
                {team}
              </option>
            ))}
          </Select>
        </FilterGroup>

        {/* Action Filter */}
        <FilterGroup>
          <Label htmlFor="action">Action:</Label>
          <Select
            id="action"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
          >
            <option value="">All Actions</option>
            {actionOptions.map((action, index) => (
              <option key={index} value={action}>
                {action}
              </option>
            ))}
          </Select>
        </FilterGroup>

        {/* Player Filter */}
        <FilterGroup>
          <Label htmlFor="player">Player:</Label>
          <Select
            id="player"
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
          >
            <option value="">All Players</option>
            {playerOptions.map((player, index) => (
              <option key={index} value={player}>
                {player}
              </option>
            ))}
          </Select>
        </FilterGroup>

        {/* Chart Selection */}
        <FilterGroup>
          <CheckboxGroup>
            <CheckboxLabel>
              <input
                type="checkbox"
                name="heatmap"
                checked={selectedCharts.heatmap}
                onChange={handleChartSelection}
              />{' '}
              Heatmap
            </CheckboxLabel>
            {(sport === 'Soccer' || sport === 'Basketball') && (
              <CheckboxLabel>
                <input
                  type="checkbox"
                  name="xgChart"
                  checked={selectedCharts.xgChart}
                  onChange={handleChartSelection}
                />{' '}
                {sport === 'Soccer' ? 'Expected Goals (XG)' : 'Expected Points (xP)'}
              </CheckboxLabel>
            )}
          </CheckboxGroup>
        </FilterGroup>

        <ContinueButton onClick={handleContinue}>Continue</ContinueButton>
      </FilterContainer>
    </Container>
  );
};

FilterPage.propTypes = {};

export default FilterPage;
