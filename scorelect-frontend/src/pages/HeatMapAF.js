// src/pages/HeatmapAF.js

import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stage, Layer, Rect, Line, Text, Circle, Group } from 'react-konva';
import Konva from 'konva';
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
import PlaysTable from '../components/PlaysTable';

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

const HeatmapAF = () => {
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
  const fieldWidthYards = 53.3; // American football field width in yards
  const fieldLengthYards = 120; // Including end zones
  const stageWidth = 800; // Adjust as needed
  const stageHeight = (stageWidth * fieldLengthYards) / fieldWidthYards;
  const xScale = stageWidth / fieldWidthYards;
  const yScale = stageHeight / fieldLengthYards;

  // Colors
  const fieldColor = '#2E8B57'; // Green color
  const lineColor = '#FFFFFF'; // White color
  const endZoneColor = '#00338D'; // Blue color for end zones
  const fieldMarkingsColor = '#FFFFFF'; // White color for field markings

  // Function to normalize data (e.g., flip coordinates if necessary)
  const normalizeData = (entry) => {
    // Implement any data normalization if required
    return entry;
  };

  // Process data to generate heatmap and calculate metrics
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

    const processHeatmapData = () => {
      const gridSizeX = 53;
      const gridSizeY = 120;
      const grid = Array.from({ length: gridSizeY }, () => Array(gridSizeX).fill(0));

      const updatedData = data
        .map((entry, index) => {
          let x = parseFloat(entry.x);
          let y = parseFloat(entry.y);

          if (isNaN(x) || isNaN(y)) {
            console.warn(`Invalid entry at index ${index}:`, entry);
            return null;
          }

          if (x < 0 || x > fieldWidthYards || y < 0 || y > fieldLengthYards) {
            console.warn(`Entry out of bounds at index ${index}:`, entry);
            return null;
          }

          // Normalize data if necessary
          const normalizedEntry = normalizeData(entry);

          // Update heatmap grid
          const gridX = Math.min(Math.floor((x / fieldWidthYards) * gridSizeX), gridSizeX - 1);
          const gridY = Math.min(Math.floor((y / fieldLengthYards) * gridSizeY), gridSizeY - 1);
          grid[gridY][gridX] += 1;

          return normalizedEntry;
        })
        .filter((entry) => entry !== null); // Remove invalid entries

      const flattened = grid.flat();
      const currentMax = Math.max(...flattened);
      setMaxCount(currentMax);
      setHeatmapData(grid);
      setIsHeatmapReady(true);

      // Update processed data
      setProcessedData(updatedData);
    };

    processHeatmapData();
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

  // Function to render the American football field
  const renderAmericanFootballField = () => {
    const yardLineSpacing = stageHeight / (fieldLengthYards / 5); // Every 5 yards
    const hashMarkWidth = 2;
    const hashMarkHeight = yScale * 0.5;

    return (
      <Layer>
        {/* Field Background */}
        <Rect x={0} y={0} width={stageWidth} height={stageHeight} fill={fieldColor} />

        {/* End Zones */}
        <Rect x={0} y={0} width={stageWidth} height={yScale * 10} fill={endZoneColor} />
        <Rect
          x={0}
          y={stageHeight - yScale * 10}
          width={stageWidth}
          height={yScale * 10}
          fill={endZoneColor}
        />

        {/* Yard Lines */}
        {Array.from({ length: fieldLengthYards / 5 + 1 }, (_, i) => (
          <Line
            key={`yard-line-${i}`}
            points={[
              0,
              i * yardLineSpacing,
              stageWidth,
              i * yardLineSpacing,
            ]}
            stroke={lineColor}
            strokeWidth={2}
          />
        ))}

        {/* Hash Marks */}
        {Array.from({ length: fieldLengthYards / 1 }, (_, i) => (
          <React.Fragment key={`hash-marks-${i}`}>
            {/* Left Hash Marks */}
            <Rect
              x={stageWidth * 0.4 - hashMarkWidth / 2}
              y={i * yScale}
              width={hashMarkWidth}
              height={hashMarkHeight}
              fill={fieldMarkingsColor}
            />
            {/* Right Hash Marks */}
            <Rect
              x={stageWidth * 0.6 - hashMarkWidth / 2}
              y={i * yScale}
              width={hashMarkWidth}
              height={hashMarkHeight}
              fill={fieldMarkingsColor}
            />
          </React.Fragment>
        ))}

        {/* Yard Line Numbers */}
        {Array.from({ length: fieldLengthYards / 10 }, (_, i) => {
          const yardNumber = i * 10;
          if (yardNumber === 0 || yardNumber === 60) return null; // Skip the end zones and midfield
          return (
            <React.Fragment key={`yard-number-${i}`}>
              {/* Top Field Numbers */}
              <Text
                text={`${yardNumber}`}
                x={stageWidth / 2 - 10}
                y={i * yardLineSpacing * 2 + yScale}
                fontSize={14}
                fill={fieldMarkingsColor}
              />
              {/* Bottom Field Numbers */}
              <Text
                text={`${yardNumber}`}
                x={stageWidth / 2 - 10}
                y={stageHeight - i * yardLineSpacing * 2 - yScale - 14}
                fontSize={14}
                fill={fieldMarkingsColor}
              />
            </React.Fragment>
          );
        })}

        {/* Midfield Line */}
        <Line
          points={[0, stageHeight / 2, stageWidth, stageHeight / 2]}
          stroke={lineColor}
          strokeWidth={4}
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

  // Function to render plays with tooltips
  const renderPlaysWithTooltips = () => {
    if (!processedData || processedData.length === 0) {
      console.warn('No data available for rendering plays.');
      return null;
    }

    return processedData.map((entry, index) => {
      let { x, y, playType, team, player } = entry;
      x = parseFloat(x);
      y = parseFloat(y);

      if (isNaN(x) || isNaN(y)) {
        return null;
      }

      const playX = x * xScale;
      const playY = y * yScale;

      return (
        <Group key={`play-${index}`}>
          <Circle
            x={playX}
            y={playY}
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
                content: `Play Type: ${playType}\nTeam: ${team}\nPlayer: ${player}`,
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
        </Group>
      );
    });
  };

  // Function to aggregate data for Plays Distribution Chart
  const aggregateDataForBarChart = () => {
    const playAggregation = {};

    processedData.forEach((entry) => {
      const playType = entry.playType || 'Unknown';

      if (!playAggregation[playType]) {
        playAggregation[playType] = 0;
      }

      playAggregation[playType] += 1;
    });

    const chartData = Object.keys(playAggregation).map((playType) => ({
      playType,
      count: playAggregation[playType],
    }));

    return chartData;
  };

  // Render Plays Distribution Chart
  const renderPlaysDistributionChart = () => (
    <ActionsDistributionContainer>
      <h3>Plays Distribution</h3>
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
          <XAxis dataKey="playType" />
          <YAxis />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="count" fill="#8884d8" name="Total Plays" />
        </BarChart>
      </ResponsiveContainer>
    </ActionsDistributionContainer>
  );

  // Function to render Team Performance Chart
  const renderTeamPerformanceChart = () => {
    const teamAggregation = {};

    processedData.forEach((entry) => {
      const team = entry.team || 'Unknown';
      if (!teamAggregation[team]) {
        teamAggregation[team] = 0;
      }
      teamAggregation[team] += 1; // Count of plays or can be adjusted for specific metrics
    });

    const chartData = Object.keys(teamAggregation).map((team) => ({
      team,
      plays: teamAggregation[team],
    }));

    return (
      <Box sx={{ width: '90%', maxWidth: 1000, height: 400, marginTop: '40px' }}>
        <h3>Team Performance</h3>
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
            <Bar dataKey="plays" fill="#82ca9d" name="Total Plays" />
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
          {/* American Football Field Layer */}
          {renderAmericanFootballField()}

          {/* Smooth Heatmap Layer */}
          {charts.heatmap && isHeatmapReady && renderSmoothHeatmap()}

          {/* Plays with Tooltips Layer */}
          {isHeatmapReady && <Layer>{renderPlaysWithTooltips()}</Layer>}
        </Stage>
        <GenerateButton onClick={handleExport}>Export Heatmap</GenerateButton>
        {/* Tooltip for Plays */}
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
        {charts.teamPerformance && renderTeamPerformanceChart()}
        {charts.playsDistribution && renderPlaysDistributionChart()}
        <AggregatedDataChart data={processedData} />
        <PlaysTable data={processedData} />
      </ChartsContainer>
    </Container>
  );
};

export default HeatmapAF;
