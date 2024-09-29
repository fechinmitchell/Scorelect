// src/components/PlaysTable.js

import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Typography } from '@mui/material';
import PropTypes from 'prop-types';

const PlaysTable = ({ data }) => {
  const columns = [
    { field: 'id', headerName: '#', width: 70 },
    { field: 'team', headerName: 'Team', width: 130 },
    { field: 'playerName', headerName: 'Player', width: 130 },
    { field: 'playType', headerName: 'Play Type', width: 130 },
    { field: 'yardLine', headerName: 'Yard Line', type: 'number', width: 130 },
    { field: 'down', headerName: 'Down', type: 'number', width: 90 },
    { field: 'distance', headerName: 'Distance', type: 'number', width: 100 },
    // Add more columns as needed
  ];

  const rows = data.map((entry, index) => ({
    id: index + 1,
    team: entry.team || 'N/A',
    playerName: entry.playerName || 'N/A',
    playType: entry.playType || 'N/A',
    yardLine: parseInt(entry.yardLine, 10) || 0,
    down: parseInt(entry.down, 10) || 0,
    distance: parseInt(entry.distance, 10) || 0,
  }));

  return (
    <Box sx={{ height: 500, width: '90%', marginTop: '40px' }}>
      <Typography variant="h5" gutterBottom>
        Detailed Play Statistics
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

PlaysTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default PlaysTable;
