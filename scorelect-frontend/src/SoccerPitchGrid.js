// src/components/SoccerPitchGrid.js
import React from 'react';
import styled from 'styled-components';

const PitchContainer = styled.div`
  position: relative;
  width: 800px;
  height: 480px;
  background-color: black;
  border: 2px solid white;
  display: grid;
  grid-template-columns: repeat(20, 1fr);
  grid-template-rows: repeat(12, 1fr);
  gap: 1px;
`;

const GridSquare = styled.div`
  background-color: transparent;
  border: 1px solid white;
`;

const SoccerPitchGrid = ({ animateHeatmaps }) => {
  return (
    <PitchContainer>
      {Array.from({ length: 20 * 12 }).map((_, index) => (
        <GridSquare key={index} style={{ backgroundColor: animateHeatmaps[index] ? 'red' : 'transparent' }} />
      ))}
    </PitchContainer>
  );
};

export default SoccerPitchGrid;
