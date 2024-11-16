// src/components/Analysis.js

import React, { useState, useEffect } from 'react';
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
`;

const DropzoneContainer = styled.div`
  margin-top: 30px;
  width: 800px;
  height: 480px;
  border: 2px dashed #501387;
  border-radius: 10px;
  display: flex;
  flex-direction: column; /* Align items vertically */
  align-items: center;
  justify-content: center;
  color: #501387;
  font-size: 1.2rem;
  cursor: pointer;
  background: ${(props) => {
    switch (props.selectedSport) {
      case 'Soccer':
        return 'linear-gradient(135deg, #c7c3ca, #b486df)'; // Light blue gradient
      case 'GAA':
        return 'linear-gradient(135deg, #c7c3ca, #b486df)'; // Light pink gradient
      case 'Basketball':
        return 'linear-gradient(135deg, #c7c3ca, #b486df)'; // Light green gradient
      case 'AmericanFootball':
        return 'linear-gradient(135deg, #c7c3ca, #b486df)'; // Light yellow gradient
      default:
        return 'linear-gradient(135deg, #c7c3ca, #b486df)'; // Light gray gradient
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

const ContinueButton = styled.button`
  margin-top: 20px;
  background-color: #28a745;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s;

  &:hover {
    background-color: #218838;
  }
`;

const ResetButton = styled.button`
  margin-top: 10px;
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.3s;

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


const Analysis = ({ onSportSelect }) => {
  const [selectedSport, setSelectedSport] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null); // Store parsed JSON data
  const [datasetType, setDatasetType] = useState(null); // 'aggregated' or 'single'
  const navigate = useNavigate();

  // Handle Sport Button Click
  const handleSportClick = (sport) => {
    setSelectedSport(sport);
    onSportSelect(sport);
  };

  // Dropzone setup
  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedFile(file);

    // Read the file content
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        setParsedData(json);
        determineDatasetType(json);
        Swal.fire({
          title: 'File Uploaded',
          text: `${file.name} has been uploaded and parsed successfully.`,
          icon: 'success',
          confirmButtonText: 'OK',
        });
      } catch (error) {
        console.error('Error parsing JSON:', error);
        Swal.fire({
          title: 'Invalid File',
          text: 'The uploaded file is not a valid JSON.',
          icon: 'error',
          confirmButtonText: 'OK',
        });
      }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: '.json',
    multiple: false,
  });

  // Determine Dataset Type
  const determineDatasetType = (data) => {
    if (data.games && Array.isArray(data.games)) {
      if (data.games.length > 1) {
        setDatasetType('aggregated');
      } else if (data.games.length === 1) {
        setDatasetType('single');
      } else {
        setDatasetType(null);
      }
    } else {
      setDatasetType(null);
    }
  };

  // Handle Continue Button Click
  const handleContinue = () => {
    if (!uploadedFile) {
      Swal.fire({
        title: 'No File Uploaded',
        text: 'Please upload your dataset before continuing.',
        icon: 'warning',
        confirmButtonText: 'OK',
      });
      return;
    }

    if (!selectedSport) {
      Swal.fire({
        title: 'No Sport Selected',
        text: 'Please select a sport before continuing.',
        icon: 'warning',
        confirmButtonText: 'OK',
      });
      return;
    }

    if (!parsedData) {
      Swal.fire({
        title: 'No Data Parsed',
        text: 'The uploaded dataset could not be parsed.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }

    // Navigate to the filter page with the uploaded file and selected sport
    navigate('/analysis/filter', {
      state: { file: uploadedFile, sport: selectedSport },
    });
  };

  // Handle Reset Button Click
  const handleReset = () => {
    setSelectedSport(null);
    setUploadedFile(null);
    setParsedData(null);
    setDatasetType(null);
  };

  // Function to get sport-specific icons
  const getSportIcon = (sport) => {
    switch (sport) {
      case 'Soccer':
        return <FaFutbol size={50} color="#501387" />;
      case 'GAA':
        return <FaVolleyballBall size={50} color="#501387" />;
      case 'Basketball':
        return <FaBasketballBall size={50} color="#501387" />;
      case 'AmericanFootball':
        return <FaFootballBall size={50} color="#501387" />;
      default:
        return null;
    }
  };

  return (
    <Container>
      {/* Sport Selection Buttons */}
      <ButtonRow>
        <SportButton
          sport="Soccer"
          onClick={handleSportClick}
          active={selectedSport === 'Soccer'}
        />
        <SportButton
          sport="GAA"
          onClick={handleSportClick}
          active={selectedSport === 'GAA'}
        />
        <SportButton
          sport="AmericanFootball"
          onClick={handleSportClick}
          active={selectedSport === 'AmericanFootball'}
        />
        <SportButton
          sport="Basketball"
          onClick={handleSportClick}
          active={selectedSport === 'Basketball'}
        />
      </ButtonRow>

      {/* Dropzone is always visible */}
      <DropzoneContainer
        {...getRootProps()}
        selectedSport={selectedSport}
      >
        <input {...getInputProps()} />
        <DropzoneContent>
          {isDragActive ? (
            <p>Drop the dataset here...</p>
          ) : selectedSport ? (
            <p>Drag and drop your {selectedSport} dataset here, or click to select a file</p>
          ) : (
            <p>
              Click on a Sport and drop a file in to analyze
            </p>
          )}
          {!selectedSport && <FaUpload size={50} color="#501387" />}
          {selectedSport && <IconWrapper>{getSportIcon(selectedSport)}</IconWrapper>}
        </DropzoneContent>
      </DropzoneContainer>

      {uploadedFile && <UploadedFileText>Uploaded File: {uploadedFile.name}</UploadedFileText>}

      {/* Continue and Reset Buttons */}
      <ContinueButton onClick={handleContinue}>Continue</ContinueButton>
      {selectedSport && (
        <ResetButton onClick={handleReset}>Reset Selection</ResetButton>
      )}
    </Container>
  );
};

Analysis.propTypes = {
  onSportSelect: PropTypes.func.isRequired,
};

export default Analysis;
