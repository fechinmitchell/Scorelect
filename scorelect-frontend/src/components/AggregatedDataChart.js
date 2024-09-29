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
  // Aggregate data for American football
  const teamAggregation = {};

  data.forEach((entry) => {
    const team = entry.team || 'Unknown';
    const yardsGained = parseFloat(entry.yardsGained) || 0;

    if (!teamAggregation[team]) {
      teamAggregation[team] = { totalYards: 0, totalPlays: 0 };
    }

    teamAggregation[team].totalYards += yardsGained;
    teamAggregation[team].totalPlays += 1;
  });

  const chartData = Object.keys(teamAggregation).map((team) => ({
    team,
    averageYards: teamAggregation[team].totalYards / teamAggregation[team].totalPlays,
    totalPlays: teamAggregation[team].totalPlays,
  }));

  return (
    <Box sx={{ width: '90%', maxWidth: 1000, height: 400, marginTop: '40px' }}>
      <Typography variant="h5" gutterBottom>
        Team Performance Metrics
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
          <Bar dataKey="averageYards" fill="#8884d8" name="Avg Yards per Play" />
          <Bar dataKey="totalPlays" fill="#82ca9d" name="Total Plays" />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

AggregatedDataChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default AggregatedDataChart;
