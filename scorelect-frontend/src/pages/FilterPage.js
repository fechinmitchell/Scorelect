// src/pages/FilterPage.js

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Swal from 'sweetalert2';
import PropTypes from 'prop-types';

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

      if (fileExtension === 'csv') {
        // Handle CSV parsing if needed in the future
        // Currently, datasets are in JSON format
        Swal.fire({
          title: 'Unsupported Format',
          text: 'Please upload a JSON file.',
          icon: 'warning',
          confirmButtonText: 'OK',
        });
      } else if (fileExtension === 'json') {
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
        // Extract Teams
        if (entry.team) {
          teams.add(entry.team);
        }

        // Extract Actions
        if (entry.action) {
          actions.add(entry.action);
        }

        // Extract Players
        if (entry.playerName) {
          players.add(entry.playerName);
        }
      });
    });

    setTeamOptions([...teams]);
    setActionOptions([...actions]);
    setPlayerOptions([...players]);
  };

  const handleChartSelection = (e) => {
    const { name, checked } = e.target;
    setSelectedCharts((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleContinue = () => {
    // Validate filters or proceed with all data
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

    // Filter data based on selected filters
    const filteredData = data.filter((game) => {
      const filteredGameData = game.gameData.filter((entry) => {
        const teamMatch = filters.team ? entry.team === filters.team : true;
        const actionMatch = filters.action ? entry.action === filters.action : true;
        const playerMatch = filters.player ? entry.playerName === filters.player : true;
        return teamMatch && actionMatch && playerMatch;
      });
      return filteredGameData.length > 0;
    });

    // Determine the heatmap page to navigate to based on the selected sport
    let heatmapPage = '/analysis/heatmap';

    if (sport === 'GAA') {
      heatmapPage = '/analysis/heatmap-gaa';
    } else if (sport === 'AmericanFootball') {
      heatmapPage = '/analysis/heatmap-af';
    } else if (sport === 'Basketball') {
      heatmapPage = '/analysis/heatmap-bball'; // Added for basketball
    }

    // Navigate to the appropriate heatmap page with the filtered data
    navigate(heatmapPage, {
      state: { data: filteredData, filters, charts, sport },
    });
  };

  return (
    <Container>
      <FilterContainer>
        <h2>Filter Your Data</h2>

        {/* Headings for Filters */}
        <h3>Choose Filters</h3>

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

        {/* Headings for Chart Selection */}
        <h3>Select Charts to Generate</h3>

        {/* Chart Type Selection */}
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
            {/* Show XG/xP Chart option for Soccer and Basketball */}
            {(sport === 'Soccer' || sport === 'Basketball') && (
              <CheckboxLabel>
                <input
                  type="checkbox"
                  name="xgChart"
                  checked={selectedCharts.xgChart}
                  onChange={handleChartSelection}
                />{' '}
                {sport === 'Soccer' ? 'Expected Goals (XG) Chart' : 'Expected Points (xP) Chart'}
              </CheckboxLabel>
            )}
            {/* Additional charts for American Football */}
            {sport === 'AmericanFootball' && (
              <>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    name="teamPerformance"
                    checked={selectedCharts.teamPerformance}
                    onChange={handleChartSelection}
                  />{' '}
                  Team Performance Chart
                </CheckboxLabel>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    name="playsDistribution"
                    checked={selectedCharts.playsDistribution}
                    onChange={handleChartSelection}
                  />{' '}
                  Plays Distribution Chart
                </CheckboxLabel>
              </>
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
