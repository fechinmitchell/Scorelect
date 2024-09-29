// src/components/ShotsTable.js

import React from 'react';
import { DataGrid } from '@mui/x-data-grid'; // Ensure this import is correct
import { Box, Typography } from '@mui/material';
import PropTypes from 'prop-types';

const ShotsTable = ({ data }) => {
  const columns = [
    { field: 'id', headerName: '#', width: 70 },
    { field: 'team', headerName: 'Team', width: 130 },
    { field: 'playerName', headerName: 'Player', width: 130 },
    { field: 'action', headerName: 'Action', width: 130 },
    { field: 'x', headerName: 'X Position (m)', type: 'number', width: 150 },
    { field: 'y', headerName: 'Y Position (m)', type: 'number', width: 150 },
    { field: 'xg', headerName: 'XG', type: 'number', width: 100 },
    // Add more columns as needed
  ];

  const rows = data.map((entry, index) => ({
    id: index + 1,
    team: entry.team || 'N/A',
    playerName: entry.playerName || 'N/A',
    action: entry.action || 'N/A',
    x: parseFloat(entry.x) || 0,
    y: parseFloat(entry.y) || 0,
    xg: entry.xg ? entry.xg.toFixed(2) : '0.00',
  }));

  return (
    <Box sx={{ height: 500, width: '90%', marginTop: '40px' }}>
      <Typography variant="h5" gutterBottom>
        Detailed Shot Statistics
      </Typography>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSize={10}
        rowsPerPageOptions={[10, 20, 50]}
        disableSelectionOnClick
      />
    </Box>
  );
};

ShotsTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default ShotsTable;
