// src/components/AggregatedDataChart.js

import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
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

const AggregatedDataChart = ({ data }) => {
  // Aggregate average shot positions by team
  const teamAggregation = {};

  data.forEach((entry) => {
    const team = entry.team || 'Unknown';
    const x = parseFloat(entry.x) || 0;
    const y = parseFloat(entry.y) || 0;

    if (!teamAggregation[team]) {
      teamAggregation[team] = { totalX: 0, totalY: 0, count: 0 };
    }

    teamAggregation[team].totalX += x;
    teamAggregation[team].totalY += y;
    teamAggregation[team].count += 1;
  });

  const chartData = Object.keys(teamAggregation).map((team) => ({
    team,
    avgX: teamAggregation[team].totalX / teamAggregation[team].count,
    avgY: teamAggregation[team].totalY / teamAggregation[team].count,
  }));

  return (
    <Box sx={{ width: '90%', maxWidth: 1000, height: 400, marginTop: '40px' }}>
      <Typography variant="h5" gutterBottom>
        Average Shot Positions by Team
      </Typography>
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
          <Bar dataKey="avgX" fill="#8884d8" name="Average X Position" />
          <Bar dataKey="avgY" fill="#82ca9d" name="Average Y Position" />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

AggregatedDataChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default AggregatedDataChart;
