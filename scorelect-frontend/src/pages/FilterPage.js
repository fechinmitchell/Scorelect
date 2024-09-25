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
`;

const FilterContainer = styled.div`
  background-color: #ffffff;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 80%;
  max-width: 600px;
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

const Input = styled.input`
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
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

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
      if (file.type === 'text/csv') {
        readString(content, {
          header: true,
          complete: (results) => {
            setData(results.data);
            extractFilterOptions(results.data);
          },
        });
      } else if (file.type === 'application/json') {
        try {
          const jsonData = JSON.parse(content);
          setData(jsonData);
          extractFilterOptions(jsonData);
        } catch (error) {
          Swal.fire({
            title: 'Invalid JSON',
            text: 'Failed to parse JSON file.',
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

    reader.readAsText(file);
  }, [file, navigate, sport]);

  const extractFilterOptions = (dataset) => {
    const teams = new Set();
    const actions = new Set();

    dataset.forEach((entry) => {
      if (entry.team) teams.add(entry.team);
      if (entry.action) actions.add(entry.action);
    });

    setTeamOptions([...teams]);
    setActionOptions([...actions]);
  };

  const handleContinue = () => {
    // Validate filters or proceed with all data
    const filters = {
      team: selectedTeam || null,
      action: selectedAction || null,
    };

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
              <option key={index} value={team}>{team}</option>
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
              <option key={index} value={action}>{action}</option>
            ))}
          </Select>
        </FilterGroup>
        <ContinueButton onClick={handleContinue}>Continue</ContinueButton>
      </FilterContainer>
    </Container>
  );
};

export default FilterPage;
