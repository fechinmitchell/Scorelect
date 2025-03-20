import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { FaUpload } from 'react-icons/fa';
import { useAuth } from './AuthContext';
import { SavedGamesContext } from './components/SavedGamesContext';
import SportButton from './SportButton';
import Modal from 'react-modal';
import './Analysis.css';

// Styled Components for a dark-themed analysis page
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-color: #2e2e2e;
  min-height: 100vh;
  color: #fff;
  @media (max-width: 850px) {
    width: 100%;
    padding: 10px;
  }
`;

const InstructionText = styled.p`
  color: #fff;
  font-size: 1rem;
  margin-bottom: 15px;
`;

const SectionTitle = styled.h3`
  margin-bottom: 20px;
  font-size: 1.2rem;
  color: #fff;
`;

const SectionTitleUpload = styled.h3`
  margin-bottom: 20px;
  font-size: 1.2rem;
  color: #fff;
`;

const SavedDatasetsContainer = styled.div`
  background: #444;
  border-radius: 10px;
  padding: 20px;
  width: 800px;
  max-width: 90%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  margin-bottom: 40px;
  @media (max-width: 850px) {
    width: 100%;
  }
`;

const DropzoneContainer = styled.div`
  margin-top: 30px;
  width: 800px;
  height: 480px;
  border: 2px dashed #501387;
  border-radius: 10px;
  display: flex;
  flex-direction: column; 
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  background: #2e2e2e;
  transition: background 0.3s, opacity 0.3s;
  @media (max-width: 850px) {
    width: 100%;
    height: 300px;
  }
`;

const DropzoneContent = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  & > p {
    margin-top: 20px;
    font-size: 1.2rem;
  }
  & > svg {
    margin-top: 10px;
  }
`;

const ButtonGroup = styled.div`
  margin-top: 20px;
  display: flex;
  gap: 20px;
`;

const ContinueButton = styled.button`
  background-color: #28a745;
  color: #fff;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  &:hover {
    background-color: #218838;
  }
`;

const ResetButton = styled.button`
  background-color: #dc3545;
  color: #fff;
  border: none;
  padding: 10px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
  &:hover {
    background-color: #c82333;
  }
`;

const Select = styled.select`
  width: 100%;
  max-width: 300px;
  padding: 8px;
  margin-bottom: 15px;
  border-radius: 5px;
  border: 1px solid #ccc;
`;

Modal.setAppElement('#root');

const AnalysisGAA = () => {
  const navigate = useNavigate();
  const { currentUser, userData, loading } = useAuth();
  const { datasets } = useContext(SavedGamesContext);

  // Always set the current sport to "GAA"
  const [currentSport] = useState('GAA');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);

  // Saved dataset selection state (only one dropdown for dataset selection)
  const [selectedUserDataset, setSelectedUserDataset] = useState('');
  // New state: for match selection dropdown; default is "all" (i.e., all matches)
  const [selectedMatch, setSelectedMatch] = useState('all');

  // Additional filters – these dropdowns will be populated from the dataset data
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  // State to hold unique filter options extracted from the dataset
  const [filterOptions, setFilterOptions] = useState({ teams: [], players: [], actions: [] });

  // Dropzone file upload handler
  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (!json.games || !Array.isArray(json.games)) {
          Swal.fire('Invalid File', 'The uploaded file does not have the correct structure.', 'error');
          return;
        }
        setParsedData(json);
        Swal.fire('File Uploaded', `${file.name} has been uploaded and parsed successfully.`, 'success');
      } catch (error) {
        Swal.fire('Error', 'Failed to parse the file. Please check the file format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: '.json',
    multiple: false,
  });

  // Check authentication only; premium check removed so all signed-in users have access
  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      Swal.fire('Authentication Required', 'Please sign in to access this page.', 'warning')
        .then(() => navigate('/signin'));
    }
  }, [currentUser, loading, navigate]);

  // Extract unique filter options (teams, players, actions) from the dataset once available
  useEffect(() => {
    let dataset = parsedData || (selectedUserDataset && datasets[selectedUserDataset]);
    if (dataset && dataset.games && Array.isArray(dataset.games)) {
      const teamsSet = new Set();
      const playersSet = new Set();
      const actionsSet = new Set();
      dataset.games.forEach(game => {
        if (game.gameData && Array.isArray(game.gameData)) {
          game.gameData.forEach(entry => {
            if (entry.team) teamsSet.add(entry.team);
            if (entry.playerName) playersSet.add(entry.playerName);
            if (entry.action) actionsSet.add(entry.action);
          });
        }
      });
      setFilterOptions({
        teams: Array.from(teamsSet),
        players: Array.from(playersSet),
        actions: Array.from(actionsSet)
      });
    }
  }, [parsedData, selectedUserDataset, datasets]);

  // Handler for Continue button: Build the dataset and filters then navigate to the GAA analysis dashboard
  const handleContinue = () => {
    let dataset;
    if (parsedData) {
      dataset = parsedData;
    } else if (selectedUserDataset) {
      dataset = datasets[selectedUserDataset];
    } else {
      Swal.fire('No Dataset Selected', 'Please upload or select a saved dataset first.', 'warning');
      return;
    }

    // If a specific match is chosen (i.e. not "all"), filter the dataset's games accordingly
    if (selectedMatch !== 'all' && dataset.games) {
      dataset = {
        ...dataset,
        games: dataset.games.filter(
          (game) => (game.gameId || game.gameName) === selectedMatch
        )
      };
    }
    
    // Build filters object based on dropdown selections
    const filters = {
      team: selectedTeam || null,
      player: selectedPlayer || null,
      action: selectedAction || null,
    };

    // Navigate to your dedicated GAA analysis dashboard page
    navigate('/analysis/gaa-dashboard', { state: { file: dataset, sport: 'GAA', filters } });
  };

  // Handler for Reset button: Clear selections
  const handleReset = () => {
    setUploadedFile(null);
    setParsedData(null);
    setSelectedUserDataset('');
    setSelectedMatch('all');
    setSelectedTeam('');
    setSelectedPlayer('');
    setSelectedAction('');
    setFilterOptions({ teams: [], players: [], actions: [] });
  };

  return (
    <Container>
      <h2>GAA Analysis Dashboard</h2>
      <InstructionText>
        Select a saved dataset or upload a new one to analyze your GAA match data. Then use the filters below.
      </InstructionText>

      {/* Saved Datasets Section (accessible to all authenticated users) */}
      {Object.keys(datasets).length > 0 ? (
        <SavedDatasetsContainer>
          <SectionTitle>Analyze from Your Saved Datasets</SectionTitle>
          <InstructionText>Select one of your saved datasets.</InstructionText>
          <Select
            value={selectedUserDataset}
            onChange={(e) => {
              setSelectedUserDataset(e.target.value);
              // Reset match selection when dataset changes
              setSelectedMatch('all');
            }}
          >
            <option value="">Select a Dataset</option>
            {Object.keys(datasets).map((datasetName) => (
              <option key={datasetName} value={datasetName}>
                {datasetName}
              </option>
            ))}
          </Select>
          {selectedUserDataset &&
            datasets[selectedUserDataset]?.games &&
            datasets[selectedUserDataset].games.length > 0 && (
              <>
                <Select
                  value={selectedMatch}
                  onChange={(e) => setSelectedMatch(e.target.value)}
                >
                  <option value="all">All Matches</option>
                  {datasets[selectedUserDataset].games.map((game) => {
                    const id = game.gameId || game.gameName;
                    return (
                      <option key={id} value={id}>
                        {game.gameName} ({game.matchDate ? new Date(game.matchDate).toLocaleDateString() : 'N/A'})
                      </option>
                    );
                  })}
                </Select>
                <ButtonGroup>
                  <ContinueButton onClick={handleContinue}>
                    Continue Without Additional Filters
                  </ContinueButton>
                </ButtonGroup>
              </>
            )}
        </SavedDatasetsContainer>
      ) : (
        <SavedDatasetsContainer>
          <SectionTitle>Your Saved Datasets</SectionTitle>
          <p>No saved datasets available. Please upload and save some games first.</p>
        </SavedDatasetsContainer>
      )}

      {/* Upload New Dataset Section */}
      <SectionTitleUpload>Or Upload a New Dataset</SectionTitleUpload>
      <DropzoneContainer {...getRootProps()}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the dataset here...</p>
        ) : (
          <p>Drag and drop your GAA dataset here, or click to select a file</p>
        )}
      </DropzoneContainer>
      {uploadedFile && (
        <p style={{ color: '#501387' }}>Uploaded File: {uploadedFile.name}</p>
      )}

      {/* Additional Filters as Dropdowns */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', width: '800px', maxWidth: '90%', marginTop: '40px' }}>
        <SectionTitle style={{ color: '#501387' }}>Additional Filters</SectionTitle>
        <Select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
          <option value="">All Teams</option>
          {filterOptions.teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </Select>
        <Select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
          <option value="">All Players</option>
          {filterOptions.players.map((player) => (
            <option key={player} value={player}>
              {player}
            </option>
          ))}
        </Select>
        <Select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
          <option value="">All Actions</option>
          {filterOptions.actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </Select>
      </div>

      {/* Bottom Buttons Group */}
      <ButtonGroup>
        <ContinueButton onClick={handleContinue}>Continue</ContinueButton>
        <ResetButton onClick={handleReset}>Reset</ResetButton>
      </ButtonGroup>
    </Container>
  );
};

export default AnalysisGAA;
