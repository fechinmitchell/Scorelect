// DatasetPreview.js - Component for viewing dataset contents in Admin Settings
// Import this in AdminSettings.js and add as a new tab

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Button, IconButton, Grid, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Alert, TextField, Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, ButtonGroup, Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon, ExpandMore as ExpandMoreIcon, Visibility as ViewIcon,
  Search as SearchIcon, SportsSoccer as SportsIcon, Close as CloseIcon,
  ChevronLeft, ChevronRight, FirstPage, LastPage, Download as DownloadIcon
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import axios from 'axios';

const BASE_API_URL = process.env.REACT_APP_API_URL || 'https://scorelect.onrender.com';

const DatasetPreview = ({ mode = 'dark', datasets = [], onRefresh }) => {
  const auth = getAuth();
  const [selectedDataset, setSelectedDataset] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterGame, setFilterGame] = useState('all');
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fetchDatasetPreview = useCallback(async (datasetName) => {
    if (!datasetName) return;
    
    try {
      setLoading(true);
      setError(null);
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      const response = await axios.post(`${BASE_API_URL}/preview-dataset`, {
        uid: user.uid,
        datasetName: datasetName,
        limit: 2000
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000
      });
      
      setPreviewData(response.data);
      setPage(1);
      setFilterGame('all');
      setFilterAction('all');
      setSearchTerm('');
    } catch (err) {
      console.error('Error fetching dataset preview:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load dataset');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (selectedDataset) {
      fetchDatasetPreview(selectedDataset);
    }
  }, [selectedDataset, fetchDatasetPreview]);

  // Filter logic
  const filteredEvents = previewData?.events?.filter(event => {
    const matchesSearch = searchTerm === '' || 
      (event.playerName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (event.team?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (event.action?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesAction = filterAction === 'all' || event.action === filterAction;
    const matchesGame = filterGame === 'all' || event.gameId === filterGame;
    
    return matchesSearch && matchesAction && matchesGame;
  }) || [];

  const totalPages = Math.ceil(filteredEvents.length / rowsPerPage) || 1;
  const paginatedEvents = filteredEvents.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  
  const uniqueActions = [...new Set(previewData?.events?.map(e => e.action).filter(Boolean))].sort();
  const uniqueGames = previewData?.games || [];

  const handleViewGame = (gameId) => {
    const game = previewData?.games?.find(g => g.gameId === gameId);
    if (game) {
      setSelectedGame(game);
      setGameDialogOpen(true);
    }
  };

  const getActionColor = (action) => {
    const colors = {
      'point': '#22c55e', 'goal': '#f59e0b', 'goal miss': '#ef4444', 'wide': '#ef4444',
      'miss': '#ef4444', 'block': '#3b82f6', 'save': '#8b5cf6', 'free': '#06b6d4',
      'free wide': '#f97316', 'shot': '#ec4899', '45': '#14b8a6', 'penalty': '#eab308',
    };
    return colors[action?.toLowerCase()] || '#64748b';
  };

  const getOutcomeColor = (outcome) => {
    if (!outcome) return '#64748b';
    const lower = outcome.toLowerCase();
    if (lower.includes('score') || lower.includes('success')) return '#22c55e';
    if (lower.includes('miss') || lower.includes('wide')) return '#ef4444';
    return '#64748b';
  };

  const exportToCSV = () => {
    if (!filteredEvents.length) return;
    const headers = ['Game', 'Action', 'Player', 'Team', 'Position', 'X', 'Y', 'Distance', 'Angle', 'Pressure', 'Foot', 'Minute', 'xP', 'xG', 'Outcome'];
    const rows = filteredEvents.map(e => [
      e.gameName || e.gameId || '', e.action || '', e.playerName || '', e.team || '', e.position || '',
      e.x?.toFixed(1) || '', e.y?.toFixed(1) || '', e.distance?.toFixed(1) || '', e.angle?.toFixed(1) || '',
      e.pressure || '', e.foot || '', e.minute || '', e.xP?.toFixed(4) || '', e.xG?.toFixed(4) || '', e.outcome || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDataset}_data.csv`;
    a.click();
  };

  // Stat card component
  const StatCard = ({ label, value, color }) => (
    <Paper sx={{ 
      p: 2.5, 
      textAlign: 'center', 
      borderRadius: '16px',
      background: mode === 'dark' 
        ? `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`
        : `linear-gradient(135deg, ${color}12 0%, ${color}05 100%)`,
      border: `1px solid ${color}25`,
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 8px 25px ${color}20`
      }
    }}>
      <Typography variant="caption" sx={{ 
        color: mode === 'dark' ? '#888' : '#666', 
        fontSize: '0.65rem', 
        textTransform: 'uppercase', 
        letterSpacing: 1.5,
        fontWeight: 600
      }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, color, mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );

  return (
    <Card sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <ViewIcon sx={{ color: '#7c3aed', fontSize: 28 }} />
            Dataset Preview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Inspect all your data before running models • {previewData?.totalEvents || 0} total events
          </Typography>
        </Box>
        {previewData && (
          <Button variant="contained" size="small" startIcon={<DownloadIcon />} onClick={exportToCSV}
            sx={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', borderRadius: '10px' }}>
            Export CSV
          </Button>
        )}
      </Box>

      {/* Dataset Selection */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Select Dataset</InputLabel>
            <Select 
              value={selectedDataset} 
              onChange={(e) => setSelectedDataset(e.target.value)} 
              label="Select Dataset"
              sx={{ borderRadius: '12px' }}
            >
              {datasets.map((ds) => (<MenuItem key={ds} value={ds}>{ds}</MenuItem>))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button variant="outlined" startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />} 
            onClick={() => fetchDatasetPreview(selectedDataset)} disabled={!selectedDataset || loading}
            sx={{ borderRadius: '10px' }}>
            {loading ? 'Loading...' : 'Reload Data'}
          </Button>
          <Button variant="text" startIcon={<RefreshIcon />} onClick={onRefresh} size="small">
            Refresh List
          </Button>
        </Grid>
      </Grid>

      {datasets.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: '12px' }}>No datasets found. Create some games first.</Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#7c3aed', mb: 2 }} size={48} />
          <Typography color="text.secondary">Loading dataset...</Typography>
        </Box>
      )}

      {previewData && !loading && (
        <>
          {/* Stats Grid */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={6} sm={3}><StatCard label="Games" value={previewData.gameCount || 0} color="#7c3aed" /></Grid>
            <Grid item xs={6} sm={3}><StatCard label="Total Events" value={previewData.totalEvents || 0} color="#22c55e" /></Grid>
            <Grid item xs={6} sm={3}><StatCard label="With xP" value={previewData.eventsWithXP || 0} color="#f59e0b" /></Grid>
            <Grid item xs={6} sm={3}><StatCard label="Avg xP" value={previewData.avgXP ? previewData.avgXP.toFixed(3) : '—'} color="#ec4899" /></Grid>
          </Grid>

          {/* Games Accordion */}
          {previewData.games?.length > 0 && (
            <Accordion sx={{ mb: 3, borderRadius: '16px !important', '&:before': { display: 'none' }, overflow: 'hidden', 
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} 
                sx={{ backgroundColor: mode === 'dark' ? 'rgba(124,58,237,0.08)' : 'rgba(99,102,241,0.05)' }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700 }}>
                  <SportsIcon sx={{ color: '#7c3aed' }} /> 
                  Games in Dataset 
                  <Chip label={previewData.games.length} size="small" sx={{ ml: 1, fontWeight: 700, backgroundColor: '#7c3aed', color: '#fff' }} />
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <TableContainer sx={{ maxHeight: 350 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#1a1a24' : '#f8f9fc' }}>Game Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#1a1a24' : '#f8f9fc' }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#1a1a24' : '#f8f9fc' }} align="center">Events</TableCell>
                        <TableCell sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#1a1a24' : '#f8f9fc' }} align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.games.map((game) => (
                        <TableRow key={game.gameId} hover sx={{ '&:hover': { backgroundColor: mode === 'dark' ? 'rgba(124,58,237,0.08)' : 'rgba(99,102,241,0.05)' } }}>
                          <TableCell sx={{ fontWeight: 600 }}>{game.gameName || game.gameId}</TableCell>
                          <TableCell sx={{ color: mode === 'dark' ? '#888' : '#666' }}>
                            {game.matchDate ? new Date(game.matchDate).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={game.eventCount || 0} size="small" sx={{ fontWeight: 700, minWidth: 50, backgroundColor: mode === 'dark' ? '#252530' : '#e8e9f0' }} />
                          </TableCell>
                          <TableCell align="center">
                            <ButtonGroup size="small" variant="outlined">
                              <Tooltip title="View details"><Button onClick={() => handleViewGame(game.gameId)}>Details</Button></Tooltip>
                              <Tooltip title="Filter events to this game"><Button onClick={() => { setFilterGame(game.gameId); setPage(1); }}>Filter</Button></Tooltip>
                            </ButtonGroup>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Filters Bar */}
          <Paper sx={{ p: 2, mb: 3, borderRadius: '14px', backgroundColor: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField 
                  size="small" 
                  fullWidth 
                  placeholder="Search player, team, action..." 
                  value={searchTerm} 
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  InputProps={{ startAdornment: <SearchIcon sx={{ color: '#888', mr: 1 }} /> }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Action Type</InputLabel>
                  <Select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }} label="Action Type" sx={{ borderRadius: '10px' }}>
                    <MenuItem value="all">All Actions</MenuItem>
                    {uniqueActions.map(action => (<MenuItem key={action} value={action}>{action}</MenuItem>))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Game</InputLabel>
                  <Select value={filterGame} onChange={(e) => { setFilterGame(e.target.value); setPage(1); }} label="Game" sx={{ borderRadius: '10px' }}>
                    <MenuItem value="all">All Games</MenuItem>
                    {uniqueGames.map(game => (<MenuItem key={game.gameId} value={game.gameId}>{game.gameName || game.gameId}</MenuItem>))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Typography variant="body2" sx={{ textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>
                  {filteredEvents.length.toLocaleString()} events
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Events Table */}
          <Paper sx={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['#', 'Action', 'Player', 'Team', 'Pos', 'X', 'Y', 'Dist', 'Angle', 'Pressure', 'Foot', 'Min', 'xP', 'xG', 'Outcome'].map((col, i) => (
                      <TableCell key={col} align={i >= 5 && i <= 13 ? 'right' : 'left'}
                        sx={{ fontWeight: 700, backgroundColor: mode === 'dark' ? '#1e1e28' : '#f0f1f5', fontSize: '0.75rem',
                          borderBottom: `2px solid ${mode === 'dark' ? '#7c3aed40' : '#6366f140'}`,
                          ...(i === 0 && { position: 'sticky', left: 0, zIndex: 3 }) }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedEvents.map((event, idx) => (
                    <TableRow key={idx} hover sx={{ '&:hover': { backgroundColor: mode === 'dark' ? 'rgba(124,58,237,0.08)' : 'rgba(99,102,241,0.04)' } }}>
                      <TableCell sx={{ color: '#666', fontFamily: 'monospace', fontSize: '0.7rem', position: 'sticky', left: 0, 
                        backgroundColor: mode === 'dark' ? '#1a1a24' : '#fff', zIndex: 1, borderRight: `1px solid ${mode === 'dark' ? '#333' : '#eee'}` }}>
                        {((page - 1) * rowsPerPage + idx + 1).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip label={event.action || '—'} size="small" 
                          sx={{ backgroundColor: `${getActionColor(event.action)}18`, color: getActionColor(event.action), fontWeight: 700, fontSize: '0.7rem', height: 24, borderRadius: '6px' }} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.playerName || '—'}
                      </TableCell>
                      <TableCell sx={{ color: mode === 'dark' ? '#aaa' : '#555', fontSize: '0.8rem' }}>{event.team || '—'}</TableCell>
                      <TableCell sx={{ color: mode === 'dark' ? '#777' : '#888', fontSize: '0.75rem' }}>{event.position || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{event.x?.toFixed(1) || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{event.y?.toFixed(1) || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#3b82f6' }}>{event.distance?.toFixed(1) || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#8b5cf6' }}>{event.angle?.toFixed(1) || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {event.pressure ? (
                          <Chip label={event.pressure} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600,
                            backgroundColor: event.pressure?.toLowerCase() === 'high' ? '#ef444418' : event.pressure?.toLowerCase() === 'medium' ? '#f59e0b18' : '#22c55e18',
                            color: event.pressure?.toLowerCase() === 'high' ? '#ef4444' : event.pressure?.toLowerCase() === 'medium' ? '#f59e0b' : '#22c55e' }} />
                        ) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: mode === 'dark' ? '#888' : '#666' }}>{event.foot || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{event.minute || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700, color: event.xP ? '#22c55e' : '#555', fontSize: '0.85rem' }}>
                        {event.xP ? event.xP.toFixed(3) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700, color: event.xG ? '#f59e0b' : '#555', fontSize: '0.85rem' }}>
                        {event.xG ? event.xG.toFixed(3) : '—'}
                      </TableCell>
                      <TableCell>
                        {event.outcome ? (
                          <Chip label={event.outcome} size="small" 
                            sx={{ backgroundColor: `${getOutcomeColor(event.outcome)}18`, color: getOutcomeColor(event.outcome), fontSize: '0.65rem', height: 20, fontWeight: 600, borderRadius: '6px' }} />
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Beautiful Pagination */}
            <Box sx={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2,
              p: 2, borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              background: mode === 'dark' 
                ? 'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, rgba(0,0,0,0.2) 100%)'
                : 'linear-gradient(180deg, rgba(99,102,241,0.05) 0%, rgba(0,0,0,0.02) 100%)'
            }}>
              {/* Rows per page */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="body2" sx={{ color: mode === 'dark' ? '#888' : '#666', fontWeight: 500 }}>Show</Typography>
                <Select value={rowsPerPage} onChange={(e) => { setRowsPerPage(e.target.value); setPage(1); }} size="small"
                  sx={{ minWidth: 75, borderRadius: '8px', '& .MuiSelect-select': { py: 0.75, fontWeight: 600 } }}>
                  {[10, 25, 50, 100].map(n => (<MenuItem key={n} value={n}>{n}</MenuItem>))}
                </Select>
                <Typography variant="body2" sx={{ color: mode === 'dark' ? '#888' : '#666' }}>rows</Typography>
              </Box>

              {/* Center info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: mode === 'dark' ? '#fff' : '#333', fontWeight: 600 }}>
                  {((page - 1) * rowsPerPage + 1).toLocaleString()}–{Math.min(page * rowsPerPage, filteredEvents.length).toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ color: mode === 'dark' ? '#666' : '#888' }}>of</Typography>
                <Typography variant="body2" sx={{ color: '#7c3aed', fontWeight: 700 }}>
                  {filteredEvents.length.toLocaleString()}
                </Typography>
              </Box>

              {/* Navigation */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ButtonGroup variant="contained" size="small" sx={{ boxShadow: 'none' }}>
                  <Button onClick={() => setPage(1)} disabled={page === 1}
                    sx={{ minWidth: 36, backgroundColor: mode === 'dark' ? '#252530' : '#e8e9f0', color: mode === 'dark' ? '#fff' : '#333',
                      '&:hover': { backgroundColor: '#7c3aed', color: '#fff' }, '&:disabled': { backgroundColor: mode === 'dark' ? '#1a1a24' : '#f5f5f5' } }}>
                    <FirstPage fontSize="small" />
                  </Button>
                  <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    sx={{ minWidth: 36, backgroundColor: mode === 'dark' ? '#252530' : '#e8e9f0', color: mode === 'dark' ? '#fff' : '#333',
                      '&:hover': { backgroundColor: '#7c3aed', color: '#fff' }, '&:disabled': { backgroundColor: mode === 'dark' ? '#1a1a24' : '#f5f5f5' } }}>
                    <ChevronLeft fontSize="small" />
                  </Button>
                </ButtonGroup>

                <Box sx={{ 
                  px: 2.5, py: 0.75, borderRadius: '10px', minWidth: 100, textAlign: 'center',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  boxShadow: '0 4px 15px rgba(124,58,237,0.3)'
                }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                    {page} / {totalPages}
                  </Typography>
                </Box>

                <ButtonGroup variant="contained" size="small" sx={{ boxShadow: 'none' }}>
                  <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    sx={{ minWidth: 36, backgroundColor: mode === 'dark' ? '#252530' : '#e8e9f0', color: mode === 'dark' ? '#fff' : '#333',
                      '&:hover': { backgroundColor: '#7c3aed', color: '#fff' }, '&:disabled': { backgroundColor: mode === 'dark' ? '#1a1a24' : '#f5f5f5' } }}>
                    <ChevronRight fontSize="small" />
                  </Button>
                  <Button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    sx={{ minWidth: 36, backgroundColor: mode === 'dark' ? '#252530' : '#e8e9f0', color: mode === 'dark' ? '#fff' : '#333',
                      '&:hover': { backgroundColor: '#7c3aed', color: '#fff' }, '&:disabled': { backgroundColor: mode === 'dark' ? '#1a1a24' : '#f5f5f5' } }}>
                    <LastPage fontSize="small" />
                  </Button>
                </ButtonGroup>
              </Box>
            </Box>
          </Paper>
        </>
      )}

      {/* Game Details Dialog */}
      <Dialog open={gameDialogOpen} onClose={() => setGameDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SportsIcon sx={{ color: '#7c3aed' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Game Details</Typography>
          </Box>
          <IconButton onClick={() => setGameDialogOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedGame && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 800 }}>{selectedGame.gameName || selectedGame.gameId}</Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[
                  { label: 'Date', value: selectedGame.matchDate ? new Date(selectedGame.matchDate).toLocaleDateString() : '—' },
                  { label: 'Sport', value: selectedGame.sport || '—' },
                  { label: 'Events', value: selectedGame.eventCount || 0 },
                  { label: 'Type', value: selectedGame.analysisType || 'pitch' },
                ].map((item) => (
                  <Grid item xs={6} key={item.label}>
                    <Paper sx={{ p: 2, borderRadius: '12px', backgroundColor: mode === 'dark' ? '#252530' : '#f5f5f5' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>{item.label}</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{item.value}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {selectedGame.teamsData && (
                <Paper sx={{ p: 2, borderRadius: '12px', backgroundColor: mode === 'dark' ? '#252530' : '#f5f5f5' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Teams</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Home</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedGame.teamsData.home?.name || '—'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Away</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedGame.teamsData.away?.name || '—'}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => { setFilterGame(selectedGame?.gameId); setGameDialogOpen(false); }} variant="outlined" sx={{ borderRadius: '10px' }}>
            Filter to This Game
          </Button>
          <Button onClick={() => setGameDialogOpen(false)} variant="contained" sx={{ borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default DatasetPreview;