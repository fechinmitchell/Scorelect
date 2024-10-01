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

const AggregatedDataChart = ({ data, sport }) => {
  let chartData = [];

  if (sport === 'Basketball') {
    // Aggregate data for Basketball
    const teamAggregation = {};

    data.forEach((entry) => {
      const team = entry.team || 'Unknown';
      const points = parseInt(entry.points, 10) || 0;

      if (!teamAggregation[team]) {
        teamAggregation[team] = { totalPoints: 0, totalShots: 0 };
      }

      teamAggregation[team].totalPoints += points;
      teamAggregation[team].totalShots += 1;
    });

    chartData = Object.keys(teamAggregation).map((team) => ({
      team,
      averagePoints: teamAggregation[team].totalPoints / teamAggregation[team].totalShots,
      totalShots: teamAggregation[team].totalShots,
    }));
  } else if (sport === 'AmericanFootball') {
    // Existing aggregation logic for American football
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

    chartData = Object.keys(teamAggregation).map((team) => ({
      team,
      averageYards: teamAggregation[team].totalYards / teamAggregation[team].totalPlays,
      totalPlays: teamAggregation[team].totalPlays,
    }));
  } else {
    // Default or other sports
    // You can add more conditions here for other sports if needed
  }

  return (
    <Box sx={{ width: '90%', maxWidth: 1000, height: 400, marginTop: '40px' }}>
      <Typography variant="h5" gutterBottom>
        {sport === 'Basketball' ? 'Team Shooting Performance' : 'Team Performance Metrics'}
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
          {sport === 'Basketball' ? (
            <>
              <Bar dataKey="averagePoints" fill="#8884d8" name="Avg Points per Shot" />
              <Bar dataKey="totalShots" fill="#82ca9d" name="Total Shots" />
            </>
          ) : sport === 'AmericanFootball' ? (
            <>
              <Bar dataKey="averageYards" fill="#8884d8" name="Avg Yards per Play" />
              <Bar dataKey="totalPlays" fill="#82ca9d" name="Total Plays" />
            </>
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

AggregatedDataChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  sport: PropTypes.string.isRequired,
};

export default AggregatedDataChart;
