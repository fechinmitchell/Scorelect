// src/components/Analysis.js

import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import SportButton from './SportButton';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  FaFootballBall,
  FaBasketballBall,
  FaVolleyballBall,
  FaFutbol,
  FaUpload,
} from 'react-icons/fa';
import { useAuth } from './AuthContext'; 
import { SavedGamesContext } from './components/SavedGamesContext'; 
import './Analysis.css'; 

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;

  @media (max-width: 850px) {
    width: 100%;
    padding: 10px;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 30px;
`;

const SectionTitle = styled.h3`
  margin-bottom: 20px;
  font-size: 1.2rem;
  color: #333;
`;

const SectionTitleUpload = styled.h3`
  margin-bottom: 20px;
  font-size: 1.2rem;
  color: #FFF;
`;

const SavedDatasetsContainer = styled.div`
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  width: 800px;
  max-width: 90%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
  color: #501387;
  font-size: 1.2rem;
  cursor: pointer;
  background: ${(props) => {
    switch (props.selectedSport) {
      case 'Soccer':
      case 'GAA':
      case 'Basketball':
      case 'AmericanFootball':
        return 'linear-gradient(135deg, #c7c3ca, #b486df)';
      default:
        return 'linear-gradient(135deg, #c7c3ca, #b486df)';
    }
  }};
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
`;

const ContinueButton = styled.button`
  background-color: #28a745;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s;
  margin-right: 10px;

  &:hover {
    background-color: #218838;
  }
`;

const ResetButton = styled.button`
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;

  &:hover {
    background-color: #c82333;
  }
`;

const IconWrapper = styled.div`
  margin-top: 20px;
  display: flex;
  justify-content: center;
`;

const UploadedFileText = styled.p`
  color: #c7c3ca;
  font-size: 1rem;
  margin-top: 10px;
`;

const Select = styled.select`
  width: 100%;
  max-width: 300px;
  padding: 8px;
  margin-bottom: 15px;
  border-radius: 5px;
  border: 1px solid #ccc;
`;

const AnalyzeButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
`;

const AnalyzeButton = styled.button`
  background-color: #501387;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: background 0.3s;

  &:hover {
    background: #3a0e66;
  }
`;

const Analysis = ({ onSportChange, selectedSport }) => {
  const [currentSport, setCurrentSport] = useState(selectedSport || null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [datasetType, setDatasetType] = useState(null);
  const navigate = useNavigate();
  const { currentUser, userData, loading } = useAuth();

  // From SavedGamesContext
  const { datasets, loading: savedLoading, fetchError } = useContext(SavedGamesContext);

  const [selectedUserDataset, setSelectedUserDataset] = useState('');
  const [selectedUserGameId, setSelectedUserGameId] = useState('');

  useEffect(() => {
    setCurrentSport(selectedSport);
  }, [selectedSport]);

  const handleSportClick = (sport) => {
    setCurrentSport(sport);
    if (onSportChange) {
      onSportChange(sport);
    }
  };

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        setParsedData(json);
        determineDatasetType(json);
        Swal.fire('File Uploaded', `${file.name} has been uploaded and parsed successfully.`, 'success');
      } catch (error) {
        console.error('Parsing Error:', error);
        Swal.fire('Invalid File', 'The uploaded file is not a valid JSON.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: '.json',
    multiple: false,
  });

  const determineDatasetType = (data) => {
    if (data.games && Array.isArray(data.games)) {
      if (data.games.length > 1) setDatasetType('aggregated');
      else if (data.games.length === 1) setDatasetType('single');
      else setDatasetType(null);
    } else {
      setDatasetType(null);
    }
  };

  const handleContinue = () => {
    if (!uploadedFile) {
      Swal.fire('No File Uploaded', 'Please upload your dataset before continuing.', 'warning');
      return;
    }

    if (!currentSport) {
      Swal.fire('No Sport Selected', 'Please select a sport before continuing.', 'warning');
      return;
    }

    if (!parsedData) {
      Swal.fire('No Data Parsed', 'The uploaded dataset could not be parsed.', 'error');
      return;
    }

    navigate('/analysis/filter', { state: { file: uploadedFile, sport: currentSport } });
  };

  const handleReset = () => {
    setCurrentSport(selectedSport || null);
    setUploadedFile(null);
    setParsedData(null);
    setDatasetType(null);
  };

  const getSportIcon = (sport) => {
    switch (sport) {
      case 'Soccer': return <FaFutbol size={50} color="#501387" />;
      case 'GAA': return <FaVolleyballBall size={50} color="#501387" />;
      case 'Basketball': return <FaBasketballBall size={50} color="#501387" />;
      case 'AmericanFootball': return <FaFootballBall size={50} color="#501387" />;
      default: return null;
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      Swal.fire('Authentication Required', 'Please sign in to access this page.', 'warning')
        .then(() => navigate('/signin'));
    } else if (userData && userData.role !== 'paid') {
      Swal.fire({
        title: 'Upgrade Required',
        text: 'This feature is available for premium users only. Please upgrade your account.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Upgrade Now',
        cancelButtonText: 'Cancel',
      }).then((result) => {
        if (result.isConfirmed) navigate('/upgrade');
        else navigate('/');
      });
    }
  }, [currentUser, userData, loading, navigate]);

  if (loading || savedLoading) {
    return <div>Loading...</div>;
  }

  if (fetchError) {
    return <div>Error fetching saved datasets: {fetchError}</div>;
  }

  const handleAnalyzeSavedDataset = (analyzeSingleGame = false) => {
    if (!selectedUserDataset) {
      Swal.fire('No Selection', 'Please select a dataset first.', 'warning');
      return;
    }

    const datasetInfo = datasets[selectedUserDataset];
    if (!datasetInfo) {
      Swal.fire('Error', 'Selected dataset not found.', 'error');
      return;
    }

    let jsonData;
    if (analyzeSingleGame) {
      if (!selectedUserGameId) {
        Swal.fire('No Game Selected', 'Please select a game to analyze, or choose to analyze the entire dataset.', 'warning');
        return;
      }
      const game = datasetInfo.games.find((g) => (g.gameId || g.gameName) === selectedUserGameId);
      if (!game || !game.gameData) {
        Swal.fire('Error', 'Selected game data not found or invalid.', 'error');
        return;
      }
      jsonData = {
        dataset: { name: selectedUserDataset },
        games: [game],
      };
      navigate('/analysis/filter', { state: { file: jsonData, sport: game.sport || currentSport } });
    } else {
      // Analyze entire dataset
      if (datasetInfo.games.length === 0) {
        Swal.fire('No Games', 'This dataset has no games to analyze.', 'warning');
        return;
      }
      jsonData = {
        dataset: { name: selectedUserDataset },
        games: datasetInfo.games,
      };
      // Use the first game's sport as the dataset sport or fallback to currentSport
      const datasetSport = datasetInfo.games[0].sport || currentSport;
      navigate('/analysis/filter', { state: { file: jsonData, sport: datasetSport } });
    }
  };

  return (
    <div className="analysis-page">
      <Container>
        {/* Sport Selection Buttons */}
        <ButtonRow>
          <SportButton sport="Soccer" onClick={handleSportClick} active={currentSport === 'Soccer'} />
          <SportButton sport="GAA" onClick={handleSportClick} active={currentSport === 'GAA'} />
          <SportButton sport="AmericanFootball" onClick={handleSportClick} active={currentSport === 'AmericanFootball'} />
          <SportButton sport="Basketball" onClick={handleSportClick} active={currentSport === 'Basketball'} />
        </ButtonRow>

        {userData && userData.role === 'paid' ? (
          Object.keys(datasets).length > 0 ? (
            <SavedDatasetsContainer>
              <SectionTitle>Analyze from Your Saved Datasets</SectionTitle>
              <p>Select one of your saved datasets, then optionally select a single game.</p>
              <Select
                value={selectedUserDataset}
                onChange={(e) => {
                  setSelectedUserDataset(e.target.value);
                  setSelectedUserGameId('');
                }}
              >
                <option value="">Select a Dataset</option>
                {Object.keys(datasets).map((datasetName) => (
                  <option key={datasetName} value={datasetName}>{datasetName}</option>
                ))}
              </Select>

              {selectedUserDataset && datasets[selectedUserDataset].games.length > 0 ? (
                <>
                  <Select
                    value={selectedUserGameId}
                    onChange={(e) => setSelectedUserGameId(e.target.value)}
                  >
                    <option value="">(Optional) Select a Single Game</option>
                    {datasets[selectedUserDataset].games.map((game) => {
                      const id = game.gameId || game.gameName;
                      const displayName = `${game.gameName} (${game.sport} - ${game.matchDate ? new Date(game.matchDate).toLocaleDateString() : 'N/A'})`;
                      return (
                        <option key={id} value={id}>{displayName}</option>
                      );
                    })}
                  </Select>

                  <AnalyzeButtonContainer>
                    {/* If no game selected, analyze entire dataset */}
                    {!selectedUserGameId && (
                      <AnalyzeButton onClick={() => handleAnalyzeSavedDataset(false)}>
                        Analyze Entire Dataset
                      </AnalyzeButton>
                    )}
                    {/* If a game is selected, option to analyze just that game */}
                    {selectedUserGameId && (
                      <AnalyzeButton onClick={() => handleAnalyzeSavedDataset(true)}>
                        Analyze Selected Game
                      </AnalyzeButton>
                    )}
                  </AnalyzeButtonContainer>
                </>
              ) : selectedUserDataset ? (
                <p>No games available in this dataset.</p>
              ) : null}
            </SavedDatasetsContainer>
          ) : (
            <SavedDatasetsContainer>
              <SectionTitle>Your Saved Datasets</SectionTitle>
              <p>No saved datasets available. Please upload and save some games first.</p>
            </SavedDatasetsContainer>
          )
        ) : (
          <SavedDatasetsContainer>
            <SectionTitle>Your Saved Datasets</SectionTitle>
            <p>Please upgrade to a premium plan to access and analyze your saved datasets.</p>
          </SavedDatasetsContainer>
        )}

        <SectionTitleUpload>Or Upload a New Dataset</SectionTitleUpload>
        <DropzoneContainer {...getRootProps()} selectedSport={currentSport}>
          <input {...getInputProps()} />
          <DropzoneContent>
            {isDragActive ? (
              <p>Drop the dataset here...</p>
            ) : currentSport ? (
              <p>Drag and drop your {currentSport} dataset here, or click to select a file</p>
            ) : (
              <p>Click on a Sport and drop a file in to analyze</p>
            )}
            {!currentSport && <FaUpload size={50} color="#501387" />}
            {currentSport && <IconWrapper>{getSportIcon(currentSport)}</IconWrapper>}
          </DropzoneContent>
        </DropzoneContainer>

        {uploadedFile && (
          <UploadedFileText>Uploaded File: {uploadedFile.name}</UploadedFileText>
        )}

        <ButtonGroup>
          <ContinueButton onClick={handleContinue}>Continue</ContinueButton>
          {currentSport && <ResetButton onClick={handleReset}>Reset</ResetButton>}
        </ButtonGroup>
      </Container>
    </div>
  );
};

Analysis.propTypes = {
  onSportChange: PropTypes.func.isRequired,
  selectedSport: PropTypes.string,
};

export default Analysis;
