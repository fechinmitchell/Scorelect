// src/DatasetImporter.js
//
// Drop-in admin tool: upload a spreadsheet (.xlsx/.xls/.csv), let the backend
// scan its columns, review/fix the column->field mapping and warnings, then
// import it into Firestore as a new dataset.
//
// Usage inside AdminSettings.js (Datasets tab):
//   import DatasetImporter from './DatasetImporter';
//   ...
//   <DatasetImporter mode={mode} apiUrl={BASE_API_URL} onImported={fetchUserDatasets} />

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import {
  Box, Card, Typography, Button, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Alert, CircularProgress, TextField,
} from '@mui/material';

const SPORTS = ['GAA', 'Soccer', 'Basketball', 'AmericanFootball'];

const DatasetImporter = ({ mode = 'dark', apiUrl, onImported }) => {
  const auth = getAuth();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);      // backend analyze response
  const [mapping, setMapping] = useState({});          // {column: targetFieldOrNull}
  const [gameColumn, setGameColumn] = useState('');     // '' = one game
  const [datasetName, setDatasetName] = useState('');
  const [sport, setSport] = useState('GAA');

  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const card = { p: 4, mb: 3 };
  const dark = mode === 'dark';

  const resetAll = () => {
    setFile(null); setAnalysis(null); setMapping({}); setGameColumn('');
    setDatasetName(''); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setAnalysis(null);
    setResult(null);
    if (f && !datasetName) {
      // sensible default name from the filename
      setDatasetName(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${apiUrl}/admin-analyze-spreadsheet`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalysis(data);
      setMapping(data.suggestedMapping || {});
      setGameColumn(data.suggestedGameColumn || '');
    } catch (err) {
      Swal.fire('Analyze failed', err.response?.data?.error || err.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const runImport = async (overwrite = false) => {
    if (!file || !analysis) return;
    if (!datasetName.trim()) {
      Swal.fire('Name required', 'Please enter a dataset name.', 'warning');
      return;
    }
    setImporting(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('datasetName', datasetName.trim());
      fd.append('sport', sport);
      fd.append('gameColumn', gameColumn);
      fd.append('mapping', JSON.stringify(mapping));
      fd.append('overwrite', overwrite ? 'true' : 'false');
      const { data } = await axios.post(`${apiUrl}/admin-import-spreadsheet`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResult(data);
      Swal.fire('Imported', `${data.gamesWritten} game(s), ${data.eventsWritten} event(s) written.`, 'success');
      if (onImported) onImported();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'DATASET_EXISTS') {
        const r = await Swal.fire({
          title: 'Dataset already exists',
          text: err.response.data.error,
          icon: 'warning', showCancelButton: true,
          confirmButtonText: 'Overwrite it', cancelButtonText: 'Cancel',
          confirmButtonColor: '#d33',
        });
        if (r.isConfirmed) { setImporting(false); return runImport(true); }
      } else {
        Swal.fire('Import failed', err.response?.data?.error || err.message, 'error');
      }
    } finally {
      setImporting(false);
    }
  };

  const targetOptions = analysis?.targetFields || [];
  const gameLevelOptions = analysis?.gameLevelFields || [];
  const allFieldOptions = [...targetOptions, ...gameLevelOptions];

  return (
    <Box>
      {/* Step 1: file + analyze */}
      <Card sx={card}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Import Dataset from Spreadsheet</Typography>
        <Typography variant="body2" sx={{ mb: 3, opacity: 0.8 }}>
          Upload an .xlsx, .xls or .csv. The columns are scanned and matched to Scorelect's
          event fields — you can fix anything before importing.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            style={{ color: dark ? '#fff' : '#333' }}
          />
          <Button
            variant="contained"
            onClick={analyze}
            disabled={!file || analyzing}
            sx={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}
          >
            {analyzing ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Scan columns'}
          </Button>
          {(file || analysis) && (
            <Button variant="outlined" color="inherit" onClick={resetAll}>Reset</Button>
          )}
        </Box>
      </Card>

      {/* Step 2: warnings + mapping */}
      {analysis && (
        <Card sx={card}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip label={`${analysis.rowCount} rows`} size="small" />
            <Chip label={`${analysis.columnCount} columns`} size="small" />
          </Box>

          {analysis.warnings?.length > 0 && (
            <Box sx={{ mb: 3 }}>
              {analysis.warnings.map((w, i) => (
                <Alert key={i} severity="warning" sx={{ mb: 1 }}>{w}</Alert>
              ))}
            </Box>
          )}
          {analysis.warnings?.length === 0 && (
            <Alert severity="success" sx={{ mb: 3 }}>No problems detected in the columns.</Alert>
          )}

          {/* dataset meta */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <TextField
              label="Dataset name" value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              size="small" sx={{ minWidth: 240 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Sport</InputLabel>
              <Select label="Sport" value={sport} onChange={(e) => setSport(e.target.value)}>
                {SPORTS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Group rows into games by</InputLabel>
              <Select
                label="Group rows into games by"
                value={gameColumn}
                onChange={(e) => setGameColumn(e.target.value)}
              >
                <MenuItem value="">(All rows = one game)</MenuItem>
                {analysis.columns.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Column mapping</Typography>
          <TableContainer component={Paper} sx={{ borderRadius: '12px', maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Spreadsheet column</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Sample</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Maps to field</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analysis.columns.map((col) => (
                  <TableRow key={col} hover>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{col}</TableCell>
                    <TableCell sx={{ opacity: 0.7, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {analysis.sampleRows?.[0]?.[col] != null ? String(analysis.sampleRows[0][col]) : '—'}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <Select
                          value={mapping[col] || ''}
                          displayEmpty
                          onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value || null }))}
                        >
                          <MenuItem value=""><em>(ignore / keep as-is)</em></MenuItem>
                          {allFieldOptions.map((f) => (
                            <MenuItem key={f} value={f}>{f}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              variant="contained"
              onClick={() => runImport(false)}
              disabled={importing}
              sx={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', px: 4, py: 1.5 }}
            >
              {importing ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Import to Firebase'}
            </Button>
          </Box>

          {result && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="success">
                Imported “{result.datasetName}” — {result.gamesWritten} game(s), {result.eventsWritten} event(s),
                grouped by {result.groupedBy}.
              </Alert>
              {result.warnings?.map((w, i) => (
                <Alert key={i} severity="warning" sx={{ mt: 1 }}>{w}</Alert>
              ))}
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
};

export default DatasetImporter;