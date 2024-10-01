// src/pages/HeatmapBBall.js

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

const HeatmapBBall = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, filters, charts, sport } = location.state || {};
  const [heatmapData, setHeatmapData] = useState([]);
  const [maxCount, setMaxCount] = useState(0);
  const stageRef = useRef(null);
  const [isHeatmapReady, setIsHeatmapReady] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const [processedData, setProcessedData] = useState([]);

  // Court dimensions in meters
  const courtLength = 28.65; // meters
  const courtWidth = 15.24;  // meters
  const stageWidth = 930;
  const stageHeight = (stageWidth * courtWidth) / courtLength;
  const xScale = stageWidth / courtLength;
  const yScale = stageHeight / courtWidth;

  const courtColor = '#F0F0F0';
  const lineColor = '#000000';
  const threePointColor = '#FF0000';

  const calculateShotFeatures = (x, y) => {
    const basketX = courtLength;
    const basketY = courtWidth / 2;
    const deltaX = basketX - x;
    const deltaY = basketY - y;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const angle = Math.atan2(Math.abs(deltaY), deltaX) * (180 / Math.PI);
    return { distance, angle };
  };

  const calculateXG = (distance, angle) => {
    const intercept = -3.5;
    const coefDistance = 0.1;
    const coefAngle = 0.05;
    const linearPredictor = intercept + coefDistance * distance + coefAngle * angle;
    const xg = 1 / (1 + Math.exp(-linearPredictor));
    return xg;
  };

  const applyFilters = () => {
    if (!filters) return data;

    return data.filter((entry) => {
      const matchesTeam = filters.team ? entry.team === filters.team : true;
      const matchesAction = filters.action ? entry.action === filters.action : true;
      const matchesPlayer = filters.player ? entry.playerName === filters.player : true;
      return matchesTeam && matchesAction && matchesPlayer;
    });
  };

  useEffect(() => {
    if (!data || !sport) {
      Swal.fire({
        title: 'Missing Data',
        text: 'No dataset found. Please upload and filter data first.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
      navigate('/analysis');
      return;
    }

    const filteredData = applyFilters();

    const processHeatmapAndXG = () => {
      const gridSizeX = 50;
      const gridSizeY = 30;
      const grid = Array.from({ length: gridSizeY }, () => Array(gridSizeX).fill(0));

      const updatedData = filteredData
        .map((entry) => {
          let x = parseFloat(entry.x);
          let y = parseFloat(entry.y);

          if (isNaN(x) || isNaN(y)) {
            return null;
          }

          // Convert x and y from feet to meters
          x = x * 0.3048;
          y = y * 0.3048;

          if (x < 0 || x > courtLength || y < 0 || y > courtWidth) {
            return null;
          }

          const { distance, angle } = calculateShotFeatures(x, y);
          const xg = calculateXG(distance, angle);
          const updatedEntry = { ...entry, xg, x, y };
          const gridX = Math.min(Math.floor((x / courtLength) * gridSizeX), gridSizeX - 1);
          const gridY = Math.min(Math.floor((y / courtWidth) * gridSizeY), gridSizeY - 1);
          grid[gridY][gridX] += 1;
          return updatedEntry;
        })
        .filter((entry) => entry !== null);

      const flattened = grid.flat();
      const currentMax = Math.max(...flattened);
      setMaxCount(currentMax);
      setHeatmapData(grid);
      setIsHeatmapReady(true);
      setProcessedData(updatedData);
    };

    processHeatmapAndXG();
  }, [data, filters, navigate, sport]);

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

  const renderBasketballCourt = () => (
    <>
      <Rect x={0} y={0} width={stageWidth} height={stageHeight} fill={courtColor} />
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
      {/* Center Circle */}
      <Circle
        x={stageWidth / 2}
        y={stageHeight / 2}
        radius={xScale * 1.8} // Center circle radius in meters
        stroke={lineColor}
        strokeWidth={2}
      />
      {/* Half-Court Line */}
      <Line
        points={[
          stageWidth / 2, 0,
          stageWidth / 2, stageHeight
        ]}
        stroke={lineColor}
        strokeWidth={2}
      />
      {/* Three-Point Arcs */}
      <Arc
        x={xScale * 5.25}
        y={stageHeight / 2}
        innerRadius={xScale * 6.75}
        outerRadius={xScale * 6.75}
        angle={180}
        rotation={270}
        stroke={threePointColor}
        strokeWidth={2}
      />
      <Arc
        x={stageWidth - (xScale * 5.25)}
        y={stageHeight / 2}
        innerRadius={xScale * 6.75}
        outerRadius={xScale * 6.75}
        angle={180}
        rotation={90}
        stroke={threePointColor}
        strokeWidth={2}
      />
      {/* Free Throw Circles */}
      <Circle
        x={xScale * 5.8}
        y={stageHeight / 2}
        radius={xScale * 1.8}
        stroke={lineColor}
        strokeWidth={2}
      />
      <Circle
        x={stageWidth - (xScale * 5.8)}
        y={stageHeight / 2}
        radius={xScale * 1.8}
        stroke={lineColor}
        strokeWidth={2}
      />
      {/* Key Areas */}
      <Rect
        x={0}
        y={stageHeight / 2 - yScale * 2.45}
        width={xScale * 5.8}
        height={yScale * 4.9}
        stroke={lineColor}
        strokeWidth={2}
      />
      <Rect
        x={stageWidth - xScale * 5.8}
        y={stageHeight / 2 - yScale * 2.45}
        width={xScale * 5.8}
        height={yScale * 4.9}
        stroke={lineColor}
        strokeWidth={2}
      />
      {/* Baseline Arcs */}
      <Arc
        x={xScale * 1.575}
        y={stageHeight / 2}
        innerRadius={xScale * 1.25}
        outerRadius={xScale * 1.25}
        angle={180}
        rotation={90}
        stroke={lineColor}
        strokeWidth={2}
      />
      <Arc
        x={stageWidth - xScale * 1.575}
        y={stageHeight / 2}
        innerRadius={xScale * 1.25}
        outerRadius={xScale * 1.25}
        angle={180}
        rotation={270}
        stroke={lineColor}
        strokeWidth={2}
      />
      {/* Decorations */}
      <Text
        text="SCORELECT.COM"
        x={xScale * 20}
        y={stageHeight / 50}
        fontSize={stageWidth / 50}
        fill="#D3D3D3"
        opacity={0.7}
        rotation={0}
        align="center"
      />
      <Text
        text="SCORELECT.COM"
        x={stageWidth - xScale * 20}
        y={stageHeight - stageHeight / 30}
        fontSize={stageWidth / 50}
        fill="#D3D3D3"
        opacity={0.7}
        rotation={180}
        align="center"
      />
    </>
  );

  const renderHeatmap = () => {
    if (!heatmapData || heatmapData.length === 0 || !heatmapData[0]) {
      return null;
    }

    const gridSizeX = heatmapData[0].length;
    const gridSizeY = heatmapData.length;
    const cellWidth = stageWidth / gridSizeX;
    const cellHeight = stageHeight / gridSizeY;
    const heatmapShapes = [];

    const getColor = (count) => {
      const ratio = count / maxCount;
      const r = Math.floor(255 * ratio);
      const g = 0;
      const b = Math.floor(255 * (1 - ratio));
      return `rgba(${r},${g},${b},${ratio * 0.6})`;
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
              fill={color}
            />
          );
        }
      }
    }

    return heatmapShapes;
  };

  const renderShotsWithXG = () => {
    if (!processedData || processedData.length === 0) {
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
                content: `xP: ${xg.toFixed(2)}`,
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
        <h3>Expected Points (xP) by Team</h3>
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
            <Bar dataKey="xg" fill="#82ca9d" name="Total xP" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  };

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

  const renderActionsDistributionChart = () => (
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
          <XAxis dataKey="action" />
          <YAxis />
          <RechartsTooltip />
          <Legend />
          <Bar dataKey="count" fill="#8884d8" name="Total Actions" />
        </BarChart>
      </ResponsiveContainer>
    </ActionsDistributionContainer>
  );

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
          <Layer>
            {renderBasketballCourt()}
            {charts.heatmap && isHeatmapReady && renderHeatmap()}
            {isHeatmapReady && renderShotsWithXG()}
          </Layer>
        </Stage>
        <GenerateButton onClick={handleExport}>Export Heatmap</GenerateButton>
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
      <ChartsContainer>
        {charts.xgChart && renderXGChart()}
        {charts.heatmap && renderActionsDistributionChart()}
        <AggregatedDataChart data={processedData} sport={sport} />
        <ShotsTable data={processedData} sport={sport} />
      </ChartsContainer>
    </Container>
  );
};

export default HeatmapBBall;
