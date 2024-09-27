// src/pages/FilterPage.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Swal from 'sweetalert2';
import { readString } from 'react-papaparse'; // For CSV parsing

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;

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
  const [playerOptions, setPlayerOptions] = useState([]); // Added Player Options
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(''); // Added Selected Player

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
        readString(content, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length) {
              console.error('CSV Parsing Errors:', results.errors);
              Swal.fire({
                title: 'Parsing Error',
                text: 'There were errors parsing the CSV file.',
                icon: 'error',
                confirmButtonText: 'OK',
              });
              return;
            }
            console.log('Parsed CSV Data:', results.data); // Debugging log
            setData(results.data);
            extractFilterOptions(results.data);
          },
        });
      } else if (fileExtension === 'json') {
        try {
          const jsonData = JSON.parse(content);
          if (!Array.isArray(jsonData)) {
            throw new Error('JSON data is not an array.');
          }
          console.log('Parsed JSON Data:', jsonData); // Debugging log
          setData(jsonData);
          extractFilterOptions(jsonData);
        } catch (error) {
          console.error('JSON Parsing Error:', error);
          Swal.fire({
            title: 'Invalid JSON',
            text: 'Failed to parse JSON file. Ensure it is a valid JSON array.',
            icon: 'error',
            confirmButtonText: 'OK',
          });
        }
      } else {
        Swal.fire({
          title: 'Unsupported Format',
          text: 'Please upload a CSV or JSON file.',
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

  const extractFilterOptions = (dataset) => {
    const teams = new Set();
    const actions = new Set();
    const players = new Set(); // Added Players Set

    dataset.forEach((entry) => {
      // Handle case-insensitive keys
      const keys = Object.keys(entry).map((key) => key.toLowerCase());

      // Extract Team
      const teamKey = keys.find((key) => key === 'team' || key === 'teamname');
      if (teamKey && entry[teamKey]) {
        teams.add(entry[teamKey]);
      }

      // Extract Action
      const actionKey = keys.find((key) => key === 'action' || key === 'actiontype');
      if (actionKey && entry[actionKey]) {
        actions.add(entry[actionKey]);
      }

      // Extract Player Name
      const playerKey = keys.find(
        (key) => key === 'player' || key === 'playername' || key === 'player_name'
      );
      if (playerKey && entry[playerKey]) {
        players.add(entry[playerKey]);
      }
    });

    setTeamOptions([...teams]);
    setActionOptions([...actions]);
    setPlayerOptions([...players]); // Set Player Options
  };

  const handleContinue = () => {
    // Validate filters or proceed with all data
    const filters = {
      team: selectedTeam || null,
      action: selectedAction || null,
      player: selectedPlayer || null, // Include Player in Filters
    };

    // Debugging log
    console.log('Selected Filters:', filters);
    console.log('Filtered Data:', data); // Assuming data is already filtered

    // Navigate to the heatmap generation page with filters
    navigate('/analysis/heatmap', { state: { data, filters, sport } });
  };

  return (
    <Container>
      <FilterContainer>
        <h2>Filter Your Data</h2>
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
        <ContinueButton onClick={handleContinue}>Continue</ContinueButton>
      </FilterContainer>
    </Container>
  );
};

export default FilterPage;
