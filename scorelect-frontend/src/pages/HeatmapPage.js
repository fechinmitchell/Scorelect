// src/pages/HeatmapPage.js

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

const HeatmapPage = () => {
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
  const pitchWidthMeters = 105;
  const pitchHeightMeters = 68;
  const stageWidth = 932.5;
  const stageHeight = 500;
  const xScale = stageWidth / pitchWidthMeters;
  const yScale = stageHeight / pitchHeightMeters;

  // Function to calculate distance and angle to the goal
  const calculateShotFeatures = (x, y) => {
    // Assuming the goal is centered at (105, 34) for shots towards the right goal
    const goalX = 105;
    const goalY = 34;

    const deltaX = goalX - x;
    const deltaY = goalY - y;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const angle = Math.atan2(Math.abs(deltaY), deltaX) * (180 / Math.PI); // Angle in degrees

    return { distance, angle };
  };

  // Function to calculate XG using logistic regression approximation
  const calculateXG = (distance, angle) => {
    // Coefficients from a hypothetical logistic regression model
    const intercept = -1.2;
    const coefDistance = -0.1; // Negative coefficient as farther shots have less chance
    const coefAngle = -0.05; // Negative coefficient as tighter angles have less chance

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
      const gridSizeX = 42;
      const gridSizeY = 26;
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

  // Function to render the soccer pitch
  const renderSoccerPitch = () => {
    console.log('Rendering Soccer Pitch'); // Debugging log
    const numStripes = 10;
    const stripeWidth = stageWidth / numStripes;

    return (
      <>
        {/* Pitch Background */}
        <Rect x={0} y={0} width={stageWidth} height={stageHeight} fill="#00A86B" />

        {/* Stripes */}
        {Array.from({ length: numStripes }, (_, i) => (
          <Rect
            key={i}
            x={i * stripeWidth}
            y={0}
            width={stripeWidth}
            height={stageHeight}
            fill={i % 2 === 0 ? '#A8D5BA' : '#8FBF9C'}
            opacity={0.3} // Adjust opacity for subtlety
          />
        ))}

        {/* Outer Lines */}
        <Line
          points={[0, 0, stageWidth, 0, stageWidth, stageHeight, 0, stageHeight, 0, 0]}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* Goals */}
        {/* Left Goal */}
        {/* <Line
          points={[0, yScale * 30.34, xScale * 105, yScale * 30.34, xScale * 105, yScale * 37.66, 0, yScale * 37.66]}
          stroke="#000000"
          strokeWidth={2}
        /> */}
        {/* Right Goal */}
        {/* <Line
          points={[stageWidth, yScale * 30.34, xScale * 0, yScale * 30.34, xScale * 0, yScale * 37.66, stageWidth, yScale * 37.66]}
          stroke="#000000"
          strokeWidth={2}
        /> */}

        {/* 6-yard Boxes */}
        {/* Left 6-yard Box */}
        <Line
          points={[0, yScale * 23.1, xScale * 5.5, yScale * 23.1, xScale * 5.5, yScale * 44.9, 0, yScale * 44.9]}
          stroke="#000000"
          strokeWidth={2}
        />
        {/* Right 6-yard Box */}
        <Line
          points={[stageWidth, yScale * 23.1, xScale * 99.5, yScale * 23.1, xScale * 99.5, yScale * 44.9, stageWidth, yScale * 44.9]}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* Penalty Areas */}
        {/* Left Penalty Area */}
        <Line
          points={[0, yScale * 14, xScale * 16.5, yScale * 14, xScale * 16.5, yScale * 54, 0, yScale * 54]}
          stroke="#000000"
          strokeWidth={2}
        />
        {/* Right Penalty Area */}
        <Line
          points={[stageWidth, yScale * 14, xScale * 88.5, yScale * 14, xScale * 88.5, yScale * 54, stageWidth, yScale * 54]}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* Penalty Spots */}
        <Circle x={xScale * 11} y={yScale * 34} radius={xScale * 0.4} fill="#000000" />
        <Circle x={xScale * 94} y={yScale * 34} radius={xScale * 0.4} fill="#000000" />

        {/* Halfway Line */}
        <Line
          points={[xScale * 52.5, 0, xScale * 52.5, stageHeight]}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* Center Circle */}
        <Circle x={xScale * 52.5} y={yScale * 34} radius={xScale * 9.15} stroke="#000000" strokeWidth={2} />

        {/* Corner Arcs */}
        <Arc
          x={0}
          y={0}
          innerRadius={0}
          outerRadius={xScale * 1}
          angle={90}
          rotation={0}
          stroke="#000000"
          strokeWidth={2}
        />
        <Arc
          x={0}
          y={stageHeight}
          innerRadius={0}
          outerRadius={xScale * 1}
          angle={90}
          rotation={270}
          stroke="#000000"
          strokeWidth={2}
        />
        <Arc
          x={stageWidth}
          y={0}
          innerRadius={0}
          outerRadius={xScale * 1}
          angle={90}
          rotation={90}
          stroke="#000000"
          strokeWidth={2}
        />
        <Arc
          x={stageWidth}
          y={stageHeight}
          innerRadius={0}
          outerRadius={xScale * 1}
          angle={90}
          rotation={180}
          stroke="#000000"
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
          stroke="#000000"
          strokeWidth={2}
        />
        <Arc
          x={xScale * 11}
          y={yScale * 34}
          innerRadius={xScale * 9.15}
          outerRadius={xScale * 9.15}
          angle={105}
          rotation={307.5}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* "SCORELECT.COM" Text */}
        <Text
          text="SCORELECT.COM"
          x={xScale * 22.5}
          y={stageHeight / 40.25}
          fontSize={stageWidth / 50}
          fill="#D3D3D3"
          opacity={0.7}
          align="center"
        />
        <Text
          text="SCORELECT.COM"
          x={stageWidth - xScale * 22.5}
          y={stageHeight / 1.02}
          fontSize={stageWidth / 50}
          fill="#D3D3D3"
          opacity={0.7}
          rotation={180}
          align="center"
        />
      </>
); // Make sure this closes the return properly, with no semicolon error.
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
        <h3>Expected Goals (XG) by Team</h3>
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
            <Bar dataKey="xg" fill="#82ca9d" name="Total XG" />
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
          style={{ border: '1px solid #ccc', borderRadius: '10px' }}
        >
          {/* Soccer Pitch Layer */}
          <Layer>{renderSoccerPitch()}</Layer>

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

export default HeatmapPage;
