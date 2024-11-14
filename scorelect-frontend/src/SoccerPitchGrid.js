// src/components/SoccerPitchGrid.js

import React from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import { Stage, Layer, Circle, Arrow, Text } from 'react-konva';
import AggregatedData from './AggregatedData';

const PitchContainer = styled.div`
  position: relative;
  width: 800px;
  height: 480px;
  background-color: #00A86B; /* Green pitch */
  border: 2px solid white;
  border-radius: 10px;
  overflow: hidden;

  @media (max-width: 850px) {
    width: 100%;
    height: 300px;
  }
`;

const SoccerPitchGrid = ({ gameData }) => {
  // Define scaling factors based on pitch dimensions
  const pitchWidth = 105; // meters
  const pitchHeight = 68; // meters
  const containerWidth = 800; // pixels
  const containerHeight = 480; // pixels

  const xScale = containerWidth / pitchWidth;
  const yScale = containerHeight / pitchHeight;

  // Function to get color based on action type
  const getColor = (type) => {
    const actionColorMap = {
      'goal': '#009900', // Green
      'assist': '#ffa500', // Orange
      'shot on target': '#3eb9c7', // Blue
      'shot off target': '#ff0000', // Red
      // Add more action types and colors as needed
      'pass completed': '#fff400', // Yellow
      'pass incomplete': '#000080', // Navy
    };
    return actionColorMap[type] || 'black'; // Default color
  };

  // Aggregate data by team and action (for optional additional features)
  const aggregateData = gameData.reduce((acc, curr) => {
    const { team, action } = curr;
    if (!acc[team]) {
      acc[team] = {};
    }
    if (!acc[team][action]) {
      acc[team][action] = 0;
    }
    acc[team][action]++;
    return acc;
  }, {});

  return (
    <PitchContainer>
      <Stage width={containerWidth} height={containerHeight}>
        <Layer>
          {/* Render pitch lines */}
          {/* You can add Konva shapes here to render the pitch lines as per your existing soccer pitch rendering logic */}
          {/* For simplicity, we'll assume the background color represents the pitch */}
        </Layer>
        <Layer>
          {/* Render actions */}
          {gameData.map((coord, index) => {
            if (coord.from && coord.to) {
              // Render Arrow for line-type actions (e.g., passes)
              return (
                <Arrow
                  key={index}
                  points={[
                    coord.from.x * xScale,
                    coord.from.y * yScale,
                    coord.to.x * xScale,
                    coord.to.y * yScale,
                  ]}
                  stroke={getColor(coord.type)}
                  strokeWidth={2}
                  pointerLength={10}
                  pointerWidth={10}
                  fill={getColor(coord.type)}
                />
              );
            } else {
              // Render Circle for marker-type actions (e.g., goals, assists)
              return (
                <Circle
                  key={index}
                  x={coord.x * xScale}
                  y={coord.y * yScale}
                  radius={6}
                  fill={getColor(coord.type)}
                />
              );
            }
          })}
        </Layer>
        <Layer>
          {/* Optional: Render tooltips or labels */}
          {gameData.map((coord, index) => {
            if (coord.x && coord.y && coord.playerName && coord.action) {
              return (
                <Text
                  key={`text-${index}`}
                  x={coord.x * xScale + 8}
                  y={coord.y * yScale - 8}
                  text={`${coord.action} by ${coord.playerName}`}
                  fontSize={12}
                  fill="white"
                />
              );
            }
            return null;
          })}
        </Layer>
      </Stage>
      {/* Render Aggregated Data Below the Pitch */}
      <AggregatedData data={aggregateData} />
    </PitchContainer>
  );
};

SoccerPitchGrid.propTypes = {
  gameData: PropTypes.arrayOf(
    PropTypes.shape({
      action: PropTypes.string.isRequired,
      team: PropTypes.string.isRequired,
      playerName: PropTypes.string.isRequired,
      x: PropTypes.number.isRequired,
      y: PropTypes.number.isRequired,
      type: PropTypes.string.isRequired,
      // Include other fields as needed
      from: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
      }),
      to: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
      }),
    })
  ).isRequired,
};

export default SoccerPitchGrid;
