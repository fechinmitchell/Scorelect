import React from 'react';
import { Stage, Layer, Line, Circle, Rect, Arc, Text } from 'react-konva';

// Soccer pitch dimensions (in meters)
const PITCH_WIDTH = 105;  // meters
const PITCH_HEIGHT = 68;  // meters
const GOAL_WIDTH = 7.32;  // meters
const GOAL_HEIGHT = 2.44; // meters
const PENALTY_AREA_WIDTH = 40.32;  // meters (from goal line)
const PENALTY_AREA_HEIGHT = 16.5;  // meters (from each side)
const GOAL_AREA_WIDTH = 18.32;     // meters (from goal line)
const GOAL_AREA_HEIGHT = 5.5;      // meters (from each side)
const CENTER_CIRCLE_RADIUS = 9.15; // meters
const PENALTY_SPOT_DISTANCE = 11;  // meters from goal line
const CORNER_ARC_RADIUS = 1;       // meters

// Enhanced function that returns just the pitch elements (without Stage wrapper)
export const renderSoccerPitchElements = ({ 
  canvasSizeMain, 
  pitchColorState, 
  lightStripeColorState, 
  darkStripeColorState, 
  lineColorState, 
  xScale, 
  yScale 
}) => {
  const width = canvasSizeMain.width;
  const height = canvasSizeMain.height;
  
  // Create stripe pattern matching your SoccerPitch.js implementation
  const numStripes = Math.floor(width / (8 * xScale)); // Adjust stripe frequency
  const stripeWidth = width / numStripes;

  return (
    <>
      {/* Pitch Background */}
      <Rect 
        x={0} 
        y={0} 
        width={width} 
        height={height} 
        fill={pitchColorState} 
      />

      {/* Grass Stripes - exactly like in SoccerPitch.js */}
      {Array.from({ length: numStripes }, (_, i) => (
        <Rect
          key={`stripe-${i}`}
          x={i * stripeWidth}
          y={0}
          width={stripeWidth}
          height={height}
          fill={i % 2 === 0 ? lightStripeColorState : darkStripeColorState}
          opacity={0.3}
        />
      ))}

      {/* Side and Goal Lines */}
      <Line 
        points={[0, 0, width, 0, width, height, 0, height, 0, 0]} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />

      {/* Goals */}
      <Line 
        points={[width, yScale * 30.34, xScale * 105, yScale * 30.34, xScale * 105, yScale * 37.66, width, yScale * 37.66]} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />
      <Line 
        points={[0, yScale * 30.34, xScale * 0, yScale * 30.34, xScale * 0, yScale * 37.66, 0, yScale * 37.66]} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />

      {/* 6-yard Boxes */}
      <Line 
        points={[0, yScale * 23.1, xScale * 5.5, yScale * 23.1, xScale * 5.5, yScale * 44.9, 0, yScale * 44.9]} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />
      <Line 
        points={[width, yScale * 23.1, xScale * 99.5, yScale * 23.1, xScale * 99.5, yScale * 44.9, width, yScale * 44.9]} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />

      {/* Penalty Areas */}
      <Line 
        points={[0, yScale * 14, xScale * 16.5, yScale * 14, xScale * 16.5, yScale * 54, 0, yScale * 54]} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />
      <Line 
        points={[width, yScale * 14, xScale * 88.5, yScale * 14, xScale * 88.5, yScale * 54, width, yScale * 54]} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />

      {/* Penalty Spots */}
      <Circle 
        x={xScale * 11} 
        y={yScale * 34} 
        radius={xScale * 0.4} 
        fill={lineColorState} 
      />
      <Circle 
        x={xScale * 94} 
        y={yScale * 34} 
        radius={xScale * 0.4} 
        fill={lineColorState} 
      />

      {/* Halfway Line */}
      <Line 
        points={[xScale * 52.5, 0, xScale * 52.5, height]} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />

      {/* Center Circle */}
      <Circle 
        x={xScale * 52.5} 
        y={yScale * 34} 
        radius={xScale * 9.15} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />

      {/* Corner Arcs */}
      <Arc 
        x={xScale * 0} 
        y={yScale * 0} 
        innerRadius={0} 
        outerRadius={xScale * 1} 
        angle={90} 
        rotation={0} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />
      <Arc 
        x={xScale * 0} 
        y={yScale * 68} 
        innerRadius={0} 
        outerRadius={xScale * 1} 
        angle={90} 
        rotation={270} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />
      <Arc 
        x={xScale * 105} 
        y={yScale * 0} 
        innerRadius={0} 
        outerRadius={xScale * 1} 
        angle={90} 
        rotation={90} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />
      <Arc 
        x={xScale * 105} 
        y={yScale * 68} 
        innerRadius={0} 
        outerRadius={xScale * 1} 
        angle={90} 
        rotation={180} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />

      {/* Penalty Arcs */}
      <Arc 
        x={xScale * 94} 
        y={yScale * 34} 
        innerRadius={xScale * 9.15} 
        outerRadius={xScale * 9.15} 
        angle={105} 
        rotation={127.5} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />
      <Arc 
        x={xScale * 11} 
        y={yScale * 34} 
        innerRadius={xScale * 9.15} 
        outerRadius={xScale * 9.15} 
        angle={105} 
        rotation={307.5} 
        stroke={lineColorState} 
        strokeWidth={2} 
      />

      {/* "SCORELECT" in the End Zones - exactly like SoccerPitch.js */}
      <Text 
        text="SCORELECT.COM" 
        x={xScale * 22.5} 
        y={height / 40.25} 
        fontSize={width / 50} 
        fill="#D3D3D3" 
        opacity={0.7} 
        align="center" 
      />
      <Text 
        text="SCORELECT.COM" 
        x={width - xScale * 22.5} 
        y={height / 1.02} 
        fontSize={width / 50} 
        fill="#D3D3D3" 
        opacity={0.7} 
        rotation={180} 
        align="center" 
      />
    </>
  );
};

// ORIGINAL: Function that returns complete Stage (for compatibility)
export const renderSoccerPitch = (width, height, initialScale = 1) => {
  // This is kept for backward compatibility but uses the new detailed rendering
  const canvasSizeMain = { width, height };
  const pitchColorState = '#1D6E1D';
  const lightStripeColorState = '#278227';
  const darkStripeColorState = '#1D6E1D';
  const lineColorState = '#FFFFFF';
  
  // Simple scale values for compatibility
  const xScale = width / PITCH_WIDTH;
  const yScale = height / PITCH_HEIGHT;

  return (
    <Stage width={width} height={height}>
      <Layer>
        {renderSoccerPitchElements({
          canvasSizeMain,
          pitchColorState,
          lightStripeColorState,
          darkStripeColorState,
          lineColorState,
          xScale,
          yScale
        })}
      </Layer>
    </Stage>
  );
};

export default renderSoccerPitch;