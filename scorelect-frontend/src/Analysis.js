// src/components/Analysis.js

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import SportButton from './SportButton';
import SoccerPitchGrid from './SoccerPitchGrid';
import { useSpring, animated } from 'react-spring';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  FaFootballBall,
  FaBasketballBall,
  FaVolleyballBall,
  FaFutbol,
} from 'react-icons/fa';

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

const PitchAnimation = styled(animated.div)`
  margin-top: 30px;
`;

const DropzoneContainer = styled.div`
  margin-top: 30px;
  width: 800px;
  height: 480px;
  border: 2px dashed #501387;
  border-radius: 10px;
  display: flex;
  flex-direction: column; /* Changed to column to accommodate icon */
  align-items: center;
  justify-content: center;
  color: #501387;
  font-size: 1.2rem;
  cursor: pointer;
  background-color: #f9f9f9;

  @media (max-width: 850px) {
    width: 100%;
    height: 300px;
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

const Analysis = ({ onSportSelect }) => {
  const [selectedSport, setSelectedSport] = useState(null);
  const [animateHeatmaps, setAnimateHeatmaps] = useState(Array(20 * 12).fill(false));
  const [uploadedFile, setUploadedFile] = useState(null);
  const navigate = useNavigate();

  const handleSportClick = (sport) => {
    setSelectedSport(sport);
    onSportSelect(sport);
  };

  // Animation for heatmaps
  useEffect(() => {
    if (selectedSport) return; // Stop animation once a sport is selected

    const interval = setInterval(() => {
      setAnimateHeatmaps((prev) => {
        const newAnimate = [...prev];
        const randomIndex = Math.floor(Math.random() * newAnimate.length);
        newAnimate[randomIndex] = !newAnimate[randomIndex];
        return newAnimate;
      });
    }, 1000); // Change heatmap every 1 second

    return () => clearInterval(interval);
  }, [selectedSport]);

  const animationProps = useSpring({
    opacity: selectedSport ? 0 : 1,
    transform: selectedSport ? 'scale(0.8)' : 'scale(1)',
    config: { duration: 500 },
  });

  // Dropzone setup
  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedFile(file);

    Swal.fire({
      title: 'File Uploaded',
      text: `${file.name} has been uploaded successfully.`,
      icon: 'success',
      confirmButtonText: 'OK',
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: '.csv, application/json',
    multiple: false,
  });

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

    // Navigate to the filter page with the uploaded file and selected sport
    navigate('/analysis/filter', {
      state: { file: uploadedFile, sport: selectedSport },
    });
  };

  const handleReset = () => {
    setSelectedSport(null);
    setUploadedFile(null);
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
      {/* Always display the Sport Buttons */}
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

      {/* Conditionally render the grid or the dropzone */}
      {!selectedSport ? (
        <PitchAnimation style={animationProps}>
          <SoccerPitchGrid animateHeatmaps={animateHeatmaps} />
        </PitchAnimation>
      ) : (
        <>
          <DropzoneContainer {...getRootProps()}>
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the dataset here...</p>
            ) : (
              <p>Drop your dataset here or click to select a file</p>
            )}
            <IconWrapper>{getSportIcon(selectedSport)}</IconWrapper>
          </DropzoneContainer>
          {uploadedFile && <p>Uploaded File: {uploadedFile.name}</p>}
          <ContinueButton onClick={handleContinue}>Continue</ContinueButton>
          <ResetButton onClick={handleReset}>Reset Selection</ResetButton>
        </>
      )}
    </Container>
  );
};

Analysis.propTypes = {
  onSportSelect: PropTypes.func.isRequired,
};

export default Analysis;
