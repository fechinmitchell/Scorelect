/* ===========================================================
   PLAYERS COMPONENT  (src/components/Players.js)
   -----------------------------------------------------------
   • Dark-mode team-roster manager
   • CRUD (add / edit / delete) with validation
   • Bulk “E-mail selected”
   • Immediate localStorage persistence  ← FIX FOR DISAPPEARING PLAYER
   • “Save Team” button + green toast
   • Backup / Restore JSON (shares file with Schedule)
   • Responsive Material-UI + custom CSS (Players.css)
   =========================================================== */

   import React, { useEffect, useState } from 'react';
   import {
     Alert,
     Box,
     Button,
     Checkbox,
     Container,
     Dialog,
     DialogActions,
     DialogContent,
     DialogTitle,
     FormControl,
     IconButton,
     InputLabel,
     MenuItem,
     Paper,
     Select,
     Snackbar,
     Table,
     TableBody,
     TableCell,
     TableContainer,
     TableHead,
     TableRow,
     TextField,
     Typography,
   } from '@mui/material';
   import {
     Add,
     Clear,
     CloudDownload,
     CloudUpload,
     Delete,
     Edit,
     Email,
     Save,
     Search,
   } from '@mui/icons-material';
   import Swal from 'sweetalert2';
   import { v4 as uuidv4 } from 'uuid';
   import './Players.css';

   
   /* -----------------------------------------------------------
      SHARED STORAGE HELPERS
      -----------------------------------------------------------
      These come from the single source of truth utils/storage.js
      Note the path is “./utils/storage” if utils lives inside src/.
   ----------------------------------------------------------- */
   import {
     getUserId,
     getPlayers,
     savePlayers,
     backupData,
     restoreData,
   } from './storage';   // <-- adjust if necessary
   
   /* -----------------------------------------------------------
      REGEX + CONSTANTS
   ----------------------------------------------------------- */
   const emailRegex =
     /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
   const phoneRegex = /^[0-9\s\-()+]+$/;
   
   const positions = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'];
   
   const blankPlayer = {
     id: '',
     name: '',
     position: '',
     number: '',
     email: '',
     phone: '',
     injuryStatus: 'Healthy',
   };
   
   /* ===========================================================
      COMPONENT
      =========================================================== */
   const Players = () => {
     /* ------------------------------------------------------------------
        1.  UNIQUE USER ID  (shared by Schedule / Players / storage helpers)
     ------------------------------------------------------------------ */
     const userId = getUserId();
   
     /* ------------------------------------------------------------------
        2.  STATE VARIABLES
     ------------------------------------------------------------------ */
     const [players, setPlayers] = useState([]);
     const [openDialog, setOpenDialog] = useState(false);           // add / edit modal
     const [dialogMode, setDialogMode] = useState('add');           // 'add' | 'edit'
     const [currentPlayer, setCurrentPlayer] = useState(blankPlayer);
   
     const [searchTerm, setSearchTerm] = useState('');
     const [filterPosition, setFilterPosition] = useState('');
   
     const [selectedPlayers, setSelectedPlayers] = useState([]);
     const [selectAll, setSelectAll] = useState(false);
   
     const [snackbar, setSnackbar] = useState({
       open: false,
       message: '',
       severity: 'success',
     });
   
     const [savedBanner, setSavedBanner] = useState(false);         // green “Changes saved” toast
   
     /* ------------------------------------------------------------------
        3.  INITIAL LOAD  (pull roster from localStorage)
     ------------------------------------------------------------------ */
     useEffect(() => {
       const stored = getPlayers(userId);
       if (stored.length) {
         setPlayers(stored);
       } else {
         const demo = [
           {
             id: uuidv4(),
             name: 'Player One',
             position: 'Forward',
             number: 9,
             email: 'playerone@example.com',
             phone: '555-111-2222',
             injuryStatus: 'Healthy',
           },
         ];
         setPlayers(demo);
         savePlayers(userId, demo);
       }
     }, [userId]);
   
     /* ------------------------------------------------------------------
        4.  AUTO-HIDE GREEN “Saved” BANNER
     ------------------------------------------------------------------ */
     useEffect(() => {
       if (!savedBanner) return;
       const t = setTimeout(() => setSavedBanner(false), 3000);
       return () => clearTimeout(t);
     }, [savedBanner]);
   
     /* ------------------------------------------------------------------
        5.  HELPER   commit(roster [, toast ])
            • ALWAYS writes to localStorage FIRST  ← FIX
            • updates React state, banner + snackbar
     ------------------------------------------------------------------ */
     const commit = (roster, toast = 'Roster saved!') => {
       // write synchronously – ensures data sticks even if user navigates away immediately
       savePlayers(userId, roster);
   
       // update UI state
       setPlayers(roster);
       setSavedBanner(true);
   
       // optional snackbar
       if (toast) {
         setSnackbar({
           open: true,
           message: toast,
           severity: 'success',
         });
       }
     };
   
     /* ------------------------------------------------------------------
        6.  OPEN / CLOSE DIALOG HELPERS
     ------------------------------------------------------------------ */
     const openAddDialog = () => {
       setDialogMode('add');
       setCurrentPlayer(blankPlayer);
       setOpenDialog(true);
     };
   
     const openEditDialog = (player) => {
       setDialogMode('edit');
       setCurrentPlayer(player);
       setOpenDialog(true);
     };
   
     /* ------------------------------------------------------------------
        7.  VALIDATION
     ------------------------------------------------------------------ */
     const validate = () => {
       const { name, position, number, email, phone } = currentPlayer;
   
       if (!name || !position || !number || !email || !phone) {
         return 'All fields are required.';
       }
       if (!emailRegex.test(email)) {
         return 'Invalid email address.';
       }
       if (!phoneRegex.test(phone)) {
         return 'Invalid phone number.';
       }
   
       const num = parseInt(number, 10);
       if (
         players.some(
           (p) => p.number === num && p.id !== currentPlayer.id
         )
       ) {
         return 'Jersey number must be unique.';
       }
       return null;
     };
   
     /* ===============================================================
        8.  CRUD: ADD / EDIT / DELETE
        =============================================================== */
   
     /* -- ADD or SAVE CHANGES -------------------------------------- */
     const handleSavePlayer = () => {
       const error = validate();
       if (error) {
         Swal.fire({
           icon: 'error',
           title: error,
           customClass: {
             popup: 'modern-swal-popup',
             title: 'modern-swal-title',
           },
         });
         return;
       }
   
       const num = parseInt(currentPlayer.number, 10);
   
       if (dialogMode === 'add') {
         const newPlayer = { ...currentPlayer, id: uuidv4(), number: num };
         commit([...players, newPlayer], 'Player added!');
       } else {
         const updatedRoster = players.map((p) =>
           p.id === currentPlayer.id ? { ...currentPlayer, number: num } : p
         );
         commit(updatedRoster, 'Player updated!');
       }
   
       setOpenDialog(false);
     };
   
     /* -- DELETE --------------------------------------------------- */
     const handleDeletePlayer = (id) => {
       Swal.fire({
         icon: 'warning',
         title: 'Delete this player?',
         showCancelButton: true,
         confirmButtonText: 'Delete',
         customClass: {
           popup: 'modern-swal-popup',
           title: 'modern-swal-title',
           confirmButton: 'modern-swal-delete-button',
         },
       }).then((result) => {
         if (result.isConfirmed) {
           const roster = players.filter((p) => p.id !== id);
           commit(roster, 'Player deleted!');
         }
       });
     };
   
     /* ===============================================================
        9.  BULK & DATA UTILITIES
        =============================================================== */
   
     /* -- BULK EMAIL ----------------------------------------------- */
     const handleBulkEmail = () => {
       if (!selectedPlayers.length) return;
   
       const emails = players
         .filter((p) => selectedPlayers.includes(p.id))
         .map((p) => p.email)
         .join(',');
   
       window.location.href = `mailto:${emails}?subject=Team%20Schedule%20Update`;
     };
   
     /* -- BACKUP ---------------------------------------------------- */
     const handleBackup = () => {
       backupData(userId);
       setSnackbar({
         open: true,
         message: 'Backup downloaded!',
         severity: 'success',
       });
     };
   
     /* -- RESTORE --------------------------------------------------- */
     const handleRestore = () => {
       const input = Object.assign(document.createElement('input'), {
         type: 'file',
         accept: 'application/json',
         style: 'display:none',
       });
   
       input.onchange = (e) => {
         const file = e.target.files[0];
         if (!file) return;
   
         const reader = new FileReader();
         reader.onload = (evt) => {
           try {
             const ok = restoreData(JSON.parse(evt.target.result), userId);
             if (!ok) throw new Error();
             commit(getPlayers(userId), 'Data restored!');
           } catch {
             setSnackbar({
               open: true,
               message: 'Invalid backup file.',
               severity: 'error',
             });
           }
         };
         reader.readAsText(file);
       };
   
       document.body.appendChild(input);
       input.click();
       document.body.removeChild(input);
     };
   
     /* ===============================================================
        10.  SEARCH / FILTERED LIST
        =============================================================== */
     const displayedPlayers = players.filter((p) => {
       const matchesSearch = p.name
         .toLowerCase()
         .includes(searchTerm.toLowerCase());
       const matchesFilter = filterPosition
         ? p.position === filterPosition
         : true;
       return matchesSearch && matchesFilter;
     });
   
     /* ===============================================================
        11.  JSX RENDER
        =============================================================== */
     return (
       <Container maxWidth="lg" className="players-page">
   
         {/* Green banner when commit() fires */}
         {savedBanner && (
           <div className="save-feedback">
             Changes saved successfully!
           </div>
         )}
   
         {/* -------------------------------------------------------
            PAGE TITLE
         ------------------------------------------------------- */}
         <Typography variant="h4" gutterBottom className="page-title">
           Team Roster
         </Typography>
   
         {/* -------------------------------------------------------
            SEARCH & FILTERS BAR
         ------------------------------------------------------- */}
         <Box className="search-filter-section">
           {/* Search */}
           <div className="search-container">
             <TextField
               label="Search by Name"
               variant="outlined"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               InputProps={{
                 startAdornment: <Search className="search-icon" />,
                 endAdornment: searchTerm && (
                   <IconButton
                     size="small"
                     onClick={() => setSearchTerm('')}
                   >
                     <Clear />
                   </IconButton>
                 ),
               }}
               className="search-field"
             />
           </div>
   
           {/* Position Filter */}
           <FormControl variant="outlined" className="position-filter">
             <InputLabel id="filter-position-label">
               Filter by Position
             </InputLabel>
             <Select
               labelId="filter-position-label"
               label="Filter by Position"
               value={filterPosition}
               onChange={(e) => setFilterPosition(e.target.value)}
             >
               <MenuItem value="">
                 <em>All</em>
               </MenuItem>
               {positions.map((pos) => (
                 <MenuItem key={pos} value={pos}>
                   {pos}
                 </MenuItem>
               ))}
             </Select>
           </FormControl>
   
           {/* Main Action Buttons */}
           <div className="action-buttons-container">
             <Button
               variant="contained"
               startIcon={<Add />}
               onClick={openAddDialog}
               className="add-button"
             >
               Add Player
             </Button>
   
             <Button
               variant="contained"
               startIcon={<Email />}
               onClick={handleBulkEmail}
               className="email-button"
               disabled={!selectedPlayers.length}
             >
               Email Selected
             </Button>
   
             <Button
               variant="contained"
               startIcon={<Save />}
               onClick={() => commit(players)}
               className="save-button"
             >
               Save Team
             </Button>
           </div>
         </Box>
   
         {/* -------------------------------------------------------
            BACKUP / RESTORE BAR
         ------------------------------------------------------- */}
         <Box className="backup-restore-container">
           <Button
             variant="outlined"
             startIcon={<CloudDownload />}
             onClick={handleBackup}
             className="backup-button"
           >
             Backup Data
           </Button>
   
           <Button
             variant="outlined"
             startIcon={<CloudUpload />}
             onClick={handleRestore}
             className="restore-button"
           >
             Restore Data
           </Button>
         </Box>
   
         {/* -------------------------------------------------------
            ROSTER TABLE
         ------------------------------------------------------- */}
         <TableContainer component={Paper} className="players-table-container">
           <Table className="players-table">
             <TableHead>
               <TableRow>
                 <TableCell padding="checkbox">
                   <Checkbox
                     checked={selectAll}
                     onChange={() => {
                       setSelectAll(!selectAll);
                       setSelectedPlayers(
                         !selectAll
                           ? displayedPlayers.map((p) => p.id)
                           : []
                       );
                     }}
                     className="player-checkbox"
                   />
                 </TableCell>
                 <TableCell align="center">Jersey #</TableCell>
                 <TableCell align="center">Name</TableCell>
                 <TableCell align="center">Position</TableCell>
                 <TableCell align="center">Status</TableCell>
                 <TableCell align="center">Email</TableCell>
                 <TableCell align="center">Phone</TableCell>
                 <TableCell align="center">Actions</TableCell>
               </TableRow>
             </TableHead>
   
             <TableBody>
               {displayedPlayers.length > 0 ? (
                 displayedPlayers.map((p) => (
                   <TableRow
                     key={p.id}
                     className={
                       selectedPlayers.includes(p.id)
                         ? 'selected-row'
                         : ''
                     }
                   >
                     {/* Checkbox */}
                     <TableCell padding="checkbox">
                       <Checkbox
                         checked={selectedPlayers.includes(p.id)}
                         onChange={() => {
                           setSelectedPlayers(
                             selectedPlayers.includes(p.id)
                               ? selectedPlayers.filter(
                                   (x) => x !== p.id
                                 )
                               : [...selectedPlayers, p.id]
                           );
                         }}
                         className="player-checkbox"
                       />
                     </TableCell>
   
                     {/* Jersey # */}
                     <TableCell
                       align="center"
                       className="jersey-number"
                     >
                       {p.number}
                     </TableCell>
   
                     {/* Name */}
                     <TableCell align="center">{p.name}</TableCell>
   
                     {/* Position */}
                     <TableCell align="center">{p.position}</TableCell>
   
                     {/* Status */}
                     <TableCell align="center">
                       <span
                         className={`status-badge status-${p.injuryStatus.toLowerCase()}`}
                       >
                         {p.injuryStatus}
                       </span>
                     </TableCell>
   
                     {/* Email */}
                     <TableCell align="center">
                       <a
                         href={`mailto:${p.email}`}
                         className="player-email"
                       >
                         {p.email}
                       </a>
                     </TableCell>
   
                     {/* Phone */}
                     <TableCell align="center">
                       <a
                         href={`tel:${p.phone}`}
                         className="player-phone"
                       >
                         {p.phone}
                       </a>
                     </TableCell>
   
                     {/* Actions */}
                     <TableCell align="center">
                       <div className="table-actions">
                         <IconButton
                           onClick={() => openEditDialog(p)}
                           className="edit-button"
                         >
                           <Edit />
                         </IconButton>
                         <IconButton
                           onClick={() => handleDeletePlayer(p.id)}
                           className="delete-button"
                         >
                           <Delete />
                         </IconButton>
                       </div>
                     </TableCell>
                   </TableRow>
                 ))
               ) : (
                 <TableRow>
                   <TableCell
                     colSpan={8}
                     align="center"
                     className="no-players"
                   >
                     No players found.
                   </TableCell>
                 </TableRow>
               )}
             </TableBody>
           </Table>
         </TableContainer>
   
         {/* -------------------------------------------------------
            ADD / EDIT DIALOG
         ------------------------------------------------------- */}
         <Dialog
           open={openDialog}
           onClose={() => setOpenDialog(false)}
           fullWidth
           maxWidth="sm"
           className="player-dialog"
         >
           <DialogTitle className="dialog-title">
             {dialogMode === 'add' ? 'Add New Player' : 'Edit Player'}
           </DialogTitle>
   
           <DialogContent className="dialog-content">
             <Box className="dialog-form">
               {/* Name */}
               <TextField
                 label="Name"
                 variant="outlined"
                 value={currentPlayer.name}
                 onChange={(e) =>
                   setCurrentPlayer({
                     ...currentPlayer,
                     name: e.target.value,
                   })
                 }
                 required
                 fullWidth
                 className="form-field"
               />
   
               {/* Position */}
               <FormControl
                 variant="outlined"
                 required
                 fullWidth
                 className="form-field"
               >
                 <InputLabel>Position</InputLabel>
                 <Select
                   value={currentPlayer.position}
                   label="Position"
                   onChange={(e) =>
                     setCurrentPlayer({
                       ...currentPlayer,
                       position: e.target.value,
                     })
                   }
                 >
                   {positions.map((pos) => (
                     <MenuItem key={pos} value={pos}>
                       {pos}
                     </MenuItem>
                   ))}
                 </Select>
               </FormControl>
   
               {/* Jersey Number */}
               <TextField
                 label="Jersey Number"
                 type="number"
                 variant="outlined"
                 value={currentPlayer.number}
                 onChange={(e) =>
                   setCurrentPlayer({
                     ...currentPlayer,
                     number: e.target.value,
                   })
                 }
                 required
                 fullWidth
                 inputProps={{ min: 0 }}
                 className="form-field"
               />
   
               {/* Email */}
               <TextField
                 label="Email"
                 type="email"
                 variant="outlined"
                 value={currentPlayer.email}
                 onChange={(e) =>
                   setCurrentPlayer({
                     ...currentPlayer,
                     email: e.target.value,
                   })
                 }
                 required
                 fullWidth
                 className="form-field"
               />
   
               {/* Phone */}
               <TextField
                 label="Phone Number"
                 type="tel"
                 variant="outlined"
                 value={currentPlayer.phone}
                 onChange={(e) =>
                   setCurrentPlayer({
                     ...currentPlayer,
                     phone: e.target.value,
                   })
                 }
                 required
                 fullWidth
                 className="form-field"
               />
   
               {/* Injury Status */}
               <FormControl
                 variant="outlined"
                 required
                 fullWidth
                 className="form-field"
               >
                 <InputLabel>Injury Status</InputLabel>
                 <Select
                   value={currentPlayer.injuryStatus}
                   label="Injury Status"
                   onChange={(e) =>
                     setCurrentPlayer({
                       ...currentPlayer,
                       injuryStatus: e.target.value,
                     })
                   }
                 >
                   {['Healthy', 'Injured', 'Suspended', 'Unknown'].map(
                     (s) => (
                       <MenuItem key={s} value={s}>
                         {s}
                       </MenuItem>
                     )
                   )}
                 </Select>
               </FormControl>
             </Box>
           </DialogContent>
   
           <DialogActions className="dialog-actions">
             <Button
               onClick={() => setOpenDialog(false)}
               className="cancel-button"
             >
               Cancel
             </Button>
   
             <Button
               onClick={handleSavePlayer}
               variant="contained"
               className="save-button"
             >
               {dialogMode === 'add' ? 'Add Player' : 'Save Changes'}
             </Button>
           </DialogActions>
         </Dialog>
   
         {/* -------------------------------------------------------
            SNACKBAR NOTIFICATIONS
         ------------------------------------------------------- */}
         <Snackbar
           open={snackbar.open}
           autoHideDuration={3000}
           onClose={() => setSnackbar({ ...snackbar, open: false })}
           anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
         >
           <Alert
             severity={snackbar.severity}
             sx={{ width: '100%' }}
             onClose={() => setSnackbar({ ...snackbar, open: false })}
             className={`snackbar-alert snackbar-${snackbar.severity}`}
           >
             {snackbar.message}
           </Alert>
         </Snackbar>
       </Container>
     );
   };
   
   export default Players;
   