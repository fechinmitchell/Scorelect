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
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
} from '@mui/material'; // Added Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel
import AggregatedDataChart from '../components/AggregatedDataChart';
import ShotsTable from '../components/ShotsTable';
import axios from 'axios'; // For making API calls to the backend

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

// Styled Tab Component to customize the tabs
const StyledTabs = styled(Tabs)`
  .MuiTabs-flexContainer {
    border-radius: 25px;
    overflow: hidden;
    background-color: #f0f0f0;
  }
  .MuiTab-root {
    text-transform: none;
    min-width: 50%;
    transition: background-color 0.3s ease-in-out;
    color: #000000;
    background-color: #D3D3D3;
  }
  .MuiTab-root.Mui-selected {
    background-color: #5E2E8F;
    color: #D3D3D3;
  }
`;

const HeatmapPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, charts, sport } = location.state || {};
  const [processedData, setProcessedData] = useState([]);
  const stageRef = useRef(null);
  const [isHeatmapReady, setIsHeatmapReady] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  // Additional states for Tabs and AI Insights
  const [tabValue, setTabValue] = useState('analysis');
  const [aiInsights, setAIInsights] = useState('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // Dimensions
  const pitchWidthMeters = 105;
  const pitchHeightMeters = 68;
  const stageWidth = 932.5;
  const stageHeight = 500;
  const xScale = stageWidth / pitchWidthMeters;
  const yScale = stageHeight / pitchHeightMeters;

  // New state variables for dropdown and checkbox
  const [selectedStat, setSelectedStat] = useState('Goals');
  const [showXG, setShowXG] = useState(true);
  const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';


  // Function to calculate XG using logistic regression approximation
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
      const filteredData = data.filter((entry) => {
        // Normalize keys to lowercase
        const normalizedEntry = {};
        Object.keys(entry).forEach((key) => {
          normalizedEntry[key.toLowerCase()] = entry[key];
        });

        // Filter based on selectedStat
        if (selectedStat === 'All') {
          return true; // Include all data
        } else if (selectedStat === 'Goals') {
          return normalizedEntry.action?.toLowerCase() === 'goal';
        } else if (selectedStat === 'Assists') {
          return normalizedEntry.action?.toLowerCase() === 'assist';
        } else if (selectedStat === 'Shots on Target') {
          return normalizedEntry.action?.toLowerCase() === 'shot on target';
        } else if (selectedStat === 'Shots off Target') {
          return normalizedEntry.action?.toLowerCase() === 'shot off target';
        } else {
          return true;
        }
      });

      const updatedData = filteredData
        .map((entry, index) => {
          // Normalize keys to lowercase
          const normalizedEntry = {};
          Object.keys(entry).forEach((key) => {
            normalizedEntry[key.toLowerCase()] = entry[key];
          });

          let x = parseFloat(normalizedEntry.x);
          let y = parseFloat(normalizedEntry.y);

          if (isNaN(x) || isNaN(y)) {
            console.warn(`Invalid entry at index ${index}:`, entry);
            return null;
          }

          if (x < 0 || x > pitchWidthMeters || y < 0 || y > pitchHeightMeters) {
            console.warn(`Entry out of bounds at index ${index}:`, entry);
            return null;
          }

          // Extract team information
          const team = normalizedEntry.team || 'Unknown';
          const action = normalizedEntry.action || 'Unknown';
          const playerName = normalizedEntry.playername || 'Unknown';

          let xg = null;
          // Calculate XG if showXG is true and the action is a shot
          if (
            showXG &&
            ['goal', 'shot on target', 'shot off target'].includes(action.toLowerCase())
          ) {
            // Calculate distance and angle
            const { distance, angle } = calculateShotFeatures(x, y);
            // Calculate XG
            xg = calculateXG(distance, angle);
          }

          // Append XG and team to entry
          const updatedEntry = {
            ...normalizedEntry,
            x,
            y,
            xg,
            team,
            action,
            playerName,
          };

          return updatedEntry;
        })
        .filter((entry) => entry !== null);

      setProcessedData(updatedData);
      setIsHeatmapReady(true);

      // Log the processed data for debugging
      console.log('Processed Data:', updatedData);
    };

    processHeatmapAndXG();
  }, [data, navigate, sport, selectedStat, showXG]);

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

      {/* 6-yard Boxes */}
      {/* Left 6-yard Box */}
      <Line
        points={[0, yScale * 23.1, xScale * 5.5, yScale * 23.1, xScale * 5.5, yScale * 44.9, 0, yScale * 44.9]}
        stroke="#000000"
        strokeWidth={2}
      />
      {/* Right 6-yard Box */}
      <Line
        points={[
          stageWidth,
          yScale * 23.1,
          xScale * 99.5,
          yScale * 23.1,
          xScale * 99.5,
          yScale * 44.9,
          stageWidth,
          yScale * 44.9,
        ]}
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
        points={[
          stageWidth,
          yScale * 14,
          xScale * 88.5,
          yScale * 14,
          xScale * 88.5,
          yScale * 54,
          stageWidth,
          yScale * 54,
        ]}
        stroke="#000000"
        strokeWidth={2}
      />

      {/* Penalty Spots */}
      <Circle x={xScale * 11} y={yScale * 34} radius={xScale * 0.4} fill="#000000" />
      <Circle x={xScale * 94} y={yScale * 34} radius={xScale * 0.4} fill="#000000" />

      {/* Halfway Line */}
      <Line points={[xScale * 52.5, 0, xScale * 52.5, stageHeight]} stroke="#000000" strokeWidth={2} />

      {/* Center Circle */}
      <Circle
        x={xScale * 52.5}
        y={yScale * 34}
        radius={xScale * 9.15}
        stroke="#000000"
        strokeWidth={2}
      />

      {/* Corner Arcs */}
      {/* Top Left */}
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
      {/* Bottom Left */}
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
      {/* Top Right */}
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
      {/* Bottom Right */}
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
      {/* Right Penalty Arc */}
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
      {/* Left Penalty Arc */}
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
  );
};

  // Function to render the smooth heatmap
  const renderSmoothHeatmap = () => {
    if (!processedData || processedData.length === 0) {
      console.warn('No data available for rendering heatmap.');
      return null;
    }

    const circles = processedData.map((entry, index) => {
      let { x, y } = entry;

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
      <Layer filters={[Konva.Filters.Blur]} blurRadius={50}>
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

    if (!showXG) return null;

    const shotGroups = processedData.map((entry, index) => {
      let { x, y, xg } = entry;

      if (isNaN(x) || isNaN(y) || xg === null || isNaN(xg)) {
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

    // Wrap the shotGroups in a Layer
    return <Layer>{shotGroups}</Layer>;
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
    if (!showXG) return null;

    const xgAggregation = {};

    processedData.forEach((entry) => {
      const team = entry.team || 'Unknown';
      const xg = parseFloat(entry.xg) || 0;

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
      <Box
        sx={{
          width: '90%',
          maxWidth: 1000,
          height: 400,
          marginTop: '40px',
          marginBottom: '40px',
        }}
      >
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

  // Handle Tab Change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

// Function to Generate AI Insights
const generateAIInsights = async () => {
  setIsGeneratingInsights(true);

  try {
    // Prepare the enhanced summary
    const summary = `We have analyzed a soccer match with the following data:
- Total Actions: ${processedData.length}
- Selected Stat: ${selectedStat}
- Actions Distribution:
${aggregateDataForBarChart()
  .map((item) => `  - ${item.action}: ${item.count}`)
  .join('\n')}
${showXG ? `- Expected Goals (XG) by Team:\n${Object.entries(
      processedData.reduce((acc, curr) => {
        const team = curr.team || 'Unknown';
        if (!acc[team]) acc[team] = 0;
        acc[team] += curr.xg || 0;
        return acc;
      }, {})
    )
      .map(([team, xg]) => `  - ${team}: ${xg.toFixed(2)}`)
      .join('\n')}` : ''}
`;

  console.log('Summary being sent to backend:', summary);

  // Use the full backend URL
  const response = await axios.post(`${backendUrl}/generate-insights`, { summary });

  console.log('Response from backend:', response.data);

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  setAIInsights(response.data.insights);
  } catch (error) {
  console.error('Error generating AI insights:', error);

  Swal.fire({
    title: 'Error',
    text: `Failed to generate AI insights: ${error.response?.data?.error || error.message}`,
    icon: 'error',
    confirmButtonText: 'OK',
  });
  } finally {
  setIsGeneratingInsights(false);
  }
};

  // Use useEffect to call generateAIInsights when switching to AI tab
  useEffect(() => {
    if (tabValue === 'ai' && !aiInsights && !isGeneratingInsights) {
      generateAIInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue]);

    return (
      <Container>
        {/* Tabs at the top */}
        <Box sx={{ width: '25%', marginBottom: '20px' }}>
          <StyledTabs
            value={tabValue}
            onChange={handleTabChange}
            centered
            TabIndicatorProps={{ style: { display: 'none' } }}
          >
            <Tab label="Analysis" value="analysis" />
            <Tab label="AI Insight" value="ai" />
          </StyledTabs>
        </Box>
  
        {/* Analysis Tab Content */}
        {tabValue === 'analysis' && (
          <>
            <AnalysisTitle>{sport} Heatmap Analysis</AnalysisTitle>
            {/* Dropdown and Checkbox */}
            <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <FormControl variant="outlined" sx={{ minWidth: 200, marginRight: '20px' }}>
                <InputLabel id="stat-select-label">Select Stat</InputLabel>
                <Select
                  labelId="stat-select-label"
                  id="stat-select"
                  value={selectedStat}
                  onChange={(e) => setSelectedStat(e.target.value)}
                  label="Select Stat"
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="Goals">Goals</MenuItem>
                  <MenuItem value="Assists">Assists</MenuItem>
                  <MenuItem value="Shots on Target">Shots on Target</MenuItem>
                  <MenuItem value="Shots off Target">Shots off Target</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={<Checkbox checked={showXG} onChange={(e) => setShowXG(e.target.checked)} />}
                label="Show XG"
              />
            </Box>
            <HeatmapContainer>
              <Stage width={stageWidth} height={stageHeight} ref={stageRef}>
                {/* Soccer Pitch Layer */}
                <Layer>{renderSoccerPitch()}</Layer>
  
                {/* Smooth Heatmap Layer */}
                {charts.heatmap && isHeatmapReady && renderSmoothHeatmap()}
  
                {/* Shots with XG Tooltip Layer */}
                {isHeatmapReady && renderShotsWithXG()}
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
              <AggregatedDataChart data={processedData} sport={sport} />
              <ShotsTable data={processedData} />
            </ChartsContainer>
          </>
        )}
  
        {/* AI Insight Tab Content */}
        {tabValue === 'ai' && (
          <Box sx={{ width: '90%', maxWidth: 1000, marginTop: '40px' }}>
            <Typography variant="h4" gutterBottom>
              AI Insights
            </Typography>
            {isGeneratingInsights ? (
              <Typography variant="body1">Generating insights, please wait...</Typography>
            ) : (
              <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                {aiInsights}
              </Typography>
            )}
          </Box>
        )}
      </Container>
    );
  };

export default HeatmapPage;
