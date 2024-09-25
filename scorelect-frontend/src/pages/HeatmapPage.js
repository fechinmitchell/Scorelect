// src/pages/HeatmapPage.js
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stage, Layer, Rect, Line, Circle, Arc, Text, Group } from 'react-konva';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import Swal from 'sweetalert2';

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
  max-width: 1050px; /* Match the soccer pitch width */
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

const ActionsDistributionContainer = styled.div`
  background-color: #ffffff;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 90%;
  max-width: 1000px;

  @media (max-width: 850px) {
    width: 100%;
  }
`;

const HeatmapPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, sport } = location.state || {};
  const [heatmapData, setHeatmapData] = useState([]);
  const [maxCount, setMaxCount] = useState(0); // To normalize heatmap opacity
  const stageRef = useRef(null);
  const [isHeatmapReady, setIsHeatmapReady] = useState(false); // To control rendering

  // Dimensions
  const pitchWidthMeters = 105;
  const pitchHeightMeters = 68;
  const stageWidth = 932; // pixels (10 pixels per meter)
  const stageHeight = 550; // pixels (10 pixels per meter)
  const xScale = stageWidth / pitchWidthMeters;
  const yScale = stageHeight / pitchHeightMeters;

  // Process data to generate heatmap
  useEffect(() => {
    if (!data || !sport) {
      Swal.fire({
        title: 'Missing Data',
        text: 'No dataset found. Please upload a dataset first.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
      navigate('/analysis');
      return;
    }

    console.log('Received Data:', data); // Debugging log

    const processHeatmap = () => {
      const gridSizeX = 42; // Increased grid size for smoother heatmap
      const gridSizeY = 26; // Increased grid size for smoother heatmap
      // Initialize a 2D grid with zeros
      const grid = Array.from({ length: gridSizeY }, () => Array(gridSizeX).fill(0));

      data.forEach((entry, index) => {
        // Validate entry structure
        if (typeof entry.x !== 'number' || typeof entry.y !== 'number') {
          console.warn(`Invalid entry at index ${index}:`, entry);
          return; // Skip invalid entries
        }

        let x = parseFloat(entry.x);
        let y = parseFloat(entry.y);

        // Validate x and y within pitch dimensions
        if (x < 0 || x > pitchWidthMeters || y < 0 || y > pitchHeightMeters) {
          console.warn(`Entry out of bounds at index ${index}:`, entry);
          return; // Skip out-of-bounds entries
        }

        // Normalize x and y to grid indices based on pitch dimensions
        const gridX = Math.min(Math.floor((x / pitchWidthMeters) * gridSizeX), gridSizeX - 1);
        const gridY = Math.min(Math.floor((y / pitchHeightMeters) * gridSizeY), gridSizeY - 1);

        grid[gridY][gridX] += 1;
      });

      // Determine the maximum count for normalization
      const flattened = grid.flat();
      const currentMax = Math.max(...flattened);
      setMaxCount(currentMax);

      setHeatmapData(grid);
      console.log('Processed Heatmap Data:', grid); // Debugging log
      console.log('Max Count:', currentMax); // Debugging log

      setIsHeatmapReady(true); // Mark heatmap as ready for rendering
    };

    processHeatmap();
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
        <Arc x={0} y={0} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={0} stroke="#000000" strokeWidth={2} />
        <Arc x={0} y={stageHeight} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={270} stroke="#000000" strokeWidth={2} />
        <Arc x={stageWidth} y={0} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={90} stroke="#000000" strokeWidth={2} />
        <Arc x={stageWidth} y={stageHeight} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={180} stroke="#000000" strokeWidth={2} />

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
    );
}; 
  // Function to render the heatmap
  const renderHeatmap = () => {
    if (!heatmapData || heatmapData.length === 0 || !heatmapData[0]) {
      console.warn('Heatmap data is empty or undefined.');
      return null; // Do not render anything if heatmapData is not ready
    }

    const gridSizeX = heatmapData[0].length;
    const gridSizeY = heatmapData.length;
    const cellWidth = stageWidth / gridSizeX;
    const cellHeight = stageHeight / gridSizeY;

    const heatmapShapes = [];

    // Define a color scale, e.g., from blue (low density) to red (high density)
    const getColor = (count) => {
      const ratio = count / maxCount;
      // Interpolate between blue (low density) and red (high density)
      const r = Math.floor(255 * ratio);
      const g = 0;
      const b = Math.floor(255 * (1 - ratio));
      return `rgba(${r},${g},${b},${ratio * 0.6})`; // Adjust alpha as needed
    };

    for (let y = 0; y < gridSizeY; y++) {
      for (let x = 0; x < gridSizeX; x++) {
        const count = heatmapData[y][x];
        if (count > 0) {
          const color = getColor(count);
          heatmapShapes.push(
            <Rect
              key={`heatmap-${x}-${y}`}
              x={x * cellWidth}
              y={y * cellHeight}
              width={cellWidth}
              height={cellHeight}
              fill={color} // Gradient color based on count
            />
          );
        }
      }
    }

    return heatmapShapes;
  };

  // Function to aggregate data for BarChart
  const aggregateDataForBarChart = () => {
    if (!heatmapData || heatmapData.length === 0) return [];

    const aggregated = [];

    for (let y = 0; y < heatmapData.length; y++) {
      let rowTotal = 0;
      for (let x = 0; x < heatmapData[y].length; x++) {
        rowTotal += heatmapData[y][x];
      }
      aggregated.push({
        position: `Row ${y + 1}`,
        actions: rowTotal,
      });
    }

    return aggregated;
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
          <Layer>
            {renderSoccerPitch()}
          </Layer>

          {/* Heatmap Overlay Layer */}
          {isHeatmapReady && (
            <Layer>
              {renderHeatmap()}
            </Layer>
          )}
        </Stage>
        <GenerateButton onClick={handleExport}>Export Heatmap</GenerateButton>
      </HeatmapContainer>

      {/* Additional Visualizations */}
      <ActionsDistributionContainer>
        <h3>Actions Distribution</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={aggregateDataForBarChart()}
            margin={{
              top: 20, right: 30, left: 20, bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="position" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="actions" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </ActionsDistributionContainer>
    </Container>
  );
};

export default HeatmapPage;
