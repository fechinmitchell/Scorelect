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
  // Aggregation logic here

  return (
    <Box sx={{ width: '90%', maxWidth: 1000, height: 400, marginTop: '40px' }}>
      <Typography variant="h5" gutterBottom>
        Average Shot Positions by Team
      </Typography>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="group" />
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
  sport: PropTypes.string.isRequired,
};

export default AggregatedDataChart;
