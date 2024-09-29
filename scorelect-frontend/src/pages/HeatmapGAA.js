// src/pages/HeatmapGAA.js

import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stage, Layer, Rect, Line, Circle, Arc, Text, Group } from 'react-konva';
import Konva from 'konva'; // Import Konva to access filters
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Swal from 'sweetalert2';
import { Box } from '@mui/material';
import AggregatedDataChart from '../components/AggregatedDataChart';
import ShotsTable from '../components/ShotsTable';

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;

  @media (max-width: 850px) {
    padding: 20px;
  }
`;

const HeatmapContainer = styled.div`
  position: relative;
  width: 90%;
  max-width: 1050px;
  margin-bottom: 40px;

  @media (max-width: 850px) {
    width: 100%;
  }
`;

const GenerateButton = styled.button`
  background-color: #17a2b8;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s;
  margin-top: 20px;

  &:hover {
    background-color: #138496;
  }
`;

const AnalysisTitle = styled.h2`
  margin-bottom: 20px;
`;

const ChartsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const ActionsDistributionContainer = styled.div`
  background-color: #ffffff;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 90%;
  max-width: 1000px;
  margin-top: 40px;

  @media (max-width: 850px) {
    width: 100%;
  }
`;

const TooltipDiv = styled.div`
  position: absolute;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  border-radius: 4px;
  pointer-events: none;
  font-size: 12px;
  z-index: 10;
  display: none;
`;

const HeatmapGAA = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, filters, charts, sport } = location.state || {};
  const [heatmapData, setHeatmapData] = useState([]);
  const [maxCount, setMaxCount] = useState(0);
  const stageRef = useRef(null);
  const [isHeatmapReady, setIsHeatmapReady] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const [processedData, setProcessedData] = useState([]);

  // Dimensions
  const pitchWidthMeters = 145; // GAA pitch width
  const pitchHeightMeters = 88; // GAA pitch height
  const stageWidth = 930; // Adjust as needed
  const stageHeight = (stageWidth * pitchHeightMeters) / pitchWidthMeters;
  const xScale = stageWidth / pitchWidthMeters;
  const yScale = stageHeight / pitchHeightMeters;

  // Colors
  const pitchColor = '#00A86B'; // Green color
  const lineColor = '#FFFFFF'; // White color
  const lightStripeColor = '#A8D5BA';
  const darkStripeColor = '#8FBF9C';

  // Function to calculate distance and angle to the goal (adjusted for GAA pitch)
  const calculateShotFeatures = (x, y) => {
    // Assuming the goal is centered at (145, 44) for shots towards the right goal
    const goalX = 145;
    const goalY = 44;

    const deltaX = goalX - x;
    const deltaY = goalY - y;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const angle = Math.atan2(Math.abs(deltaY), deltaX) * (180 / Math.PI); // Angle in degrees

    return { distance, angle };
  };

  // Function to calculate XG using logistic regression approximation (adjusted for GAA)
  const calculateXG = (distance, angle) => {
    // Coefficients from a hypothetical logistic regression model for GAA
    const intercept = -1.0;
    const coefDistance = -0.08; // Adjusted coefficients
    const coefAngle = -0.04;

    const linearPredictor = intercept + coefDistance * distance + coefAngle * angle;
    const xg = 1 / (1 + Math.exp(-linearPredictor)); // Sigmoid function

    return xg;
  };

  // Process data to generate heatmap and calculate XG
  useEffect(() => {
    if (!data || !sport) {
      Swal.fire({
        title: 'Missing Data',
        text: 'No dataset found. Please upload and filter data first.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
      navigate('/filter');
      return;
    }

    const processHeatmapAndXG = () => {
      const gridSizeX = 50;
      const gridSizeY = 30;
      const grid = Array.from({ length: gridSizeY }, () => Array(gridSizeX).fill(0));

      const updatedData = data
        .map((entry, index) => {
          let x = parseFloat(entry.x);
          let y = parseFloat(entry.y);

          if (isNaN(x) || isNaN(y)) {
            console.warn(`Invalid entry at index ${index}:`, entry);
            return null;
          }

          if (x < 0 || x > pitchWidthMeters || y < 0 || y > pitchHeightMeters) {
            console.warn(`Entry out of bounds at index ${index}:`, entry);
            return null;
          }

          // Calculate distance and angle
          const { distance, angle } = calculateShotFeatures(x, y);
          // Calculate XG
          const xg = calculateXG(distance, angle);

          // Append XG to entry
          const updatedEntry = { ...entry, xg };

          // Update heatmap grid
          const gridX = Math.min(Math.floor((x / pitchWidthMeters) * gridSizeX), gridSizeX - 1);
          const gridY = Math.min(Math.floor((y / pitchHeightMeters) * gridSizeY), gridSizeY - 1);
          grid[gridY][gridX] += 1;

          return updatedEntry;
        })
        .filter((entry) => entry !== null); // Remove invalid entries

      const flattened = grid.flat();
      const currentMax = Math.max(...flattened);
      setMaxCount(currentMax);
      setHeatmapData(grid);
      setIsHeatmapReady(true);

      // Update data with XG
      setProcessedData(updatedData);
    };

    processHeatmapAndXG();
  }, [data, navigate, sport]);

  // Handle Export Functionality
  const handleExport = () => {
    const stage = stageRef.current;
    if (stage) {
      stage.toDataURL({
        pixelRatio: 2,
        callback: (dataUrl) => {
          const link = document.createElement('a');
          link.download = `${sport}_heatmap.png`;
          link.href = dataUrl;
          link.click();
        },
      });
    } else {
      Swal.fire({
        title: 'Export Failed',
        text: 'Unable to export the heatmap.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };

  // Function to render the GAA pitch with detailed markings
  const renderGAAPitch = () => {
    const numStripes = 10;
    const stripeWidth = stageWidth / numStripes;

    return (
      <Layer>
        {/* Pitch Background */}
        <Rect
          x={0}
          y={0}
          width={stageWidth}
          height={stageHeight}
          fill={pitchColor}
        />

        {/* Stripes */}
        {Array.from({ length: numStripes }, (_, i) => (
          <Rect
            key={i}
            x={i * stripeWidth}
            y={0}
            width={stripeWidth}
            height={stageHeight}
            fill={i % 2 === 0 ? lightStripeColor : darkStripeColor}
            opacity={0.3} // Adjust opacity for subtlety
          />
        ))}

        {/* Outer Lines */}
        <Line
          points={[
            0, 0,
            stageWidth, 0,
            stageWidth, stageHeight,
            0, stageHeight,
            0, 0
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />

        {/* Goal Lines */}
        <Line
          points={[
            stageWidth, yScale * 40.75,
            xScale * 145.2, yScale * 40.75,
            xScale * 145.2, yScale * 47.25,
            stageWidth, yScale * 47.25
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            0, yScale * 40.75,
            xScale * -0.2, yScale * 40.75,
            xScale * -0.2, yScale * 47.25,
            0, yScale * 47.25
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />

        {/* Small Rectangle (6m Box) */}
        <Line
          points={[
            stageWidth, yScale * 37,
            xScale * 139, yScale * 37,
            xScale * 139, yScale * 51,
            stageWidth, yScale * 51
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            0, yScale * 37,
            xScale * 6, yScale * 37,
            xScale * 6, yScale * 51,
            0, yScale * 51
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />

        {/* Large Rectangle (13m Box) */}
        <Line
          points={[
            0, yScale * 34.5,
            xScale * 14, yScale * 34.5,
            xScale * 14, yScale * 53.5,
            0, yScale * 53.5
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            stageWidth, yScale * 34.5,
            xScale * 131, yScale * 34.5,
            xScale * 131, yScale * 53.5,
            stageWidth, yScale * 53.5
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />

        {/* Halfway Line */}
        <Line
          points={[
            xScale * 72.5, yScale * 39,
            xScale * 72.5, yScale * 49
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />

        {/* Penalty Marks */}
        <Line
          points={[
            xScale * 11, yScale * 43.5,
            xScale * 11, yScale * 44.5
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            xScale * 134, yScale * 43.5,
            xScale * 134, yScale * 44.5
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />

        {/* Arcs at 65m Lines */}
        <Arc
          x={xScale * 124}
          y={yScale * 44}
          innerRadius={0}
          outerRadius={xScale * 12}
          angle={180}
          rotation={90}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Arc
          x={xScale * 21}
          y={yScale * 44}
          innerRadius={0}
          outerRadius={xScale * 12}
          angle={180}
          rotation={270}
          stroke={lineColor}
          strokeWidth={2}
        />

        {/* Yard Lines */}
        <Line
          points={[
            xScale * 14, 0,
            xScale * 14, stageHeight
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            xScale * 131, 0,
            xScale * 131, stageHeight
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            xScale * 21, 0,
            xScale * 21, stageHeight
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            xScale * 124, 0,
            xScale * 124, stageHeight
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            xScale * 45, 0,
            xScale * 45, stageHeight
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            xScale * 100, 0,
            xScale * 100, stageHeight
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            xScale * 65, 0,
            xScale * 65, stageHeight
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />
        <Line
          points={[
            xScale * 80, 0,
            xScale * 80, stageHeight
          ]}
          stroke={lineColor}
          strokeWidth={2}
        />

        {/* "SCORELECT.COM" in the end zones */}
        <Text
          text="SCORELECT.COM"
          x={xScale * 22.5}
          y={stageHeight / 40.25}
          fontSize={stageWidth / 60}
          fill="#D3D3D3"
          opacity={0.7}
          rotation={0}
          align="center"
        />
        <Text
          text="SCORELECT.COM"
          x={stageWidth - xScale * 22.5}
          y={stageHeight / 1.02}
          fontSize={stageWidth / 60}
          fill="#D3D3D3"
          opacity={0.7}
          rotation={180}
          align="center"
        />
      </Layer>
    );
  };

  // Function to render the smooth heatmap
  const renderSmoothHeatmap = () => {
    if (!processedData || processedData.length === 0) {
      console.warn('No data available for rendering the heatmap.');
      return null;
    }

    // Create an array of circles representing each data point
    const circles = processedData.map((entry, index) => {
      let { x, y } = entry;
      x = parseFloat(x);
      y = parseFloat(y);

      if (isNaN(x) || isNaN(y)) {
        return null;
      }

      const posX = x * xScale;
      const posY = y * yScale;

      return (
        <Circle
          key={`heatmap-point-${index}`}
          x={posX}
          y={posY}
          radius={50} // Adjust radius as needed
          fillRadialGradientStartPoint={{ x: 0, y: 0 }}
          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndRadius={50} // Match radius
          fillRadialGradientColorStops={[
            0,
            'rgba(255, 0, 0, 1)', // Center color
            1,
            'rgba(255, 0, 0, 0)', // Edge color (transparent)
          ]}
          opacity={0.6} // Adjust opacity as needed
        />
      );
    });

    // Return a Layer with a blur filter applied
    return (
      <Layer
        filters={[Konva.Filters.Blur]}
        blurRadius={50} // Adjust blur radius for smoothness
      >
        {circles}
      </Layer>
    );
  };

  // Function to render Shots with XG under each shot
  const renderShotsWithXG = () => {
    if (!processedData || processedData.length === 0) {
      console.warn('No data available for rendering XG.');
      return null;
    }

    return processedData.map((entry, index) => {
      let { x, y, xg } = entry;
      x = parseFloat(x);
      y = parseFloat(y);

      if (isNaN(x) || isNaN(y) || isNaN(xg)) {
        return null;
      }

      const shotX = x * xScale;
      const shotY = y * yScale;

      return (
        <Group key={`shot-${index}`}>
          <Circle
            x={shotX}
            y={shotY}
            radius={5}
            fill="#FFA500"
            opacity={0.7}
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              stage.container().style.cursor = 'pointer';
              setTooltip({
                visible: true,
                x: e.evt.layerX,
                y: e.evt.layerY,
                content: `XG: ${xg.toFixed(2)}`,
              });
            }}
            onMouseLeave={() => {
              const stage = stageRef.current;
              if (stage) {
                stage.container().style.cursor = 'default';
              }
              setTooltip({ ...tooltip, visible: false });
            }}
          />
          {/* Display XG under the shot */}
          <Text
            text={`XG: ${xg.toFixed(2)}`}
            x={shotX - 15}
            y={shotY + 10}
            fontSize={12}
            fill="#000000"
          />
        </Group>
      );
    });
  };

  // Function to aggregate data for Actions Distribution Chart
  const aggregateDataForBarChart = () => {
    const actionAggregation = {};

    processedData.forEach((entry) => {
      const action = entry.action || 'Unknown';

      if (!actionAggregation[action]) {
        actionAggregation[action] = 0;
      }

      actionAggregation[action] += 1;
    });

    const chartData = Object.keys(actionAggregation).map((action) => ({
      action,
      count: actionAggregation[action],
    }));

    return chartData;
  };

  // Render Actions Distribution Chart
  const renderActionsDistributionChart = () => (
    <ActionsDistributionContainer>
      <h3>Actions Distribution</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={aggregateDataForBarChart()}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="action" />
          <YAxis />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="count" fill="#8884d8" name="Total Actions" />
        </BarChart>
      </ResponsiveContainer>
    </ActionsDistributionContainer>
  );

  // Function to render XG Chart
  const renderXGChart = () => {
    const xgAggregation = {};

    processedData.forEach((entry) => {
      const team = entry.team || 'Unknown';
      const xg = entry.xg || 0;

      if (!xgAggregation[team]) {
        xgAggregation[team] = 0;
      }

      xgAggregation[team] += xg;
    });

    const chartData = Object.keys(xgAggregation).map((team) => ({
      team,
      xg: xgAggregation[team],
    }));

    return (
      <Box sx={{ width: '90%', maxWidth: 1000, height: 400, marginTop: '40px', marginBottom: '40px' }}>
        <h3>Expected Points (XP) by Team</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="team" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar dataKey="xg" fill="#82ca9d" name="Total XP" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  return (
    <Container>
      <AnalysisTitle>{sport} Heatmap Analysis</AnalysisTitle>
      <HeatmapContainer>
        <Stage
          width={stageWidth}
          height={stageHeight}
          ref={stageRef}
        >
          {/* GAA Pitch Layer */}
          {renderGAAPitch()}

          {/* Smooth Heatmap Layer */}
          {charts.heatmap && isHeatmapReady && renderSmoothHeatmap()}

          {/* Shots with XG Tooltip Layer */}
          {isHeatmapReady && <Layer>{renderShotsWithXG()}</Layer>}
        </Stage>
        <GenerateButton onClick={handleExport}>Export Heatmap</GenerateButton>
        {/* Tooltip for XG */}
        {tooltip.visible && (
          <TooltipDiv
            style={{
              top: tooltip.y,
              left: tooltip.x,
              display: tooltip.visible ? 'block' : 'none',
            }}
          >
            {tooltip.content}
          </TooltipDiv>
        )}
      </HeatmapContainer>

      {/* Additional Visualizations */}
      <ChartsContainer>
        {charts.xgChart && renderXGChart()}
        {charts.heatmap && renderActionsDistributionChart()}
        <AggregatedDataChart data={processedData} />
        <ShotsTable data={processedData} />
      </ChartsContainer>
    </Container>
  );
};

export default HeatmapGAA;
