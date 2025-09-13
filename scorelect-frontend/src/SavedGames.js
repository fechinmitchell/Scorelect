import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import './SavedGames.css';
import { GameContext } from './GameContext';
import { SavedGamesContext } from './components/SavedGamesContext';
import { SportsDataHubContext } from './components/SportsDataHubContext';
import PropTypes from 'prop-types';
import PublishDataset from './PublishDataset';
import UpdateDataset from './UpdateDataset';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { FaVideo, FaMap, FaSync, FaExchangeAlt } from 'react-icons/fa';

async function parseJSONNoNaN(response) {
  const rawText = await response.text();
  const safeText = rawText
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, '999999999')
    .replace(/\b-Infinity\b/g, '-999999999');
  return JSON.parse(safeText);
}

const SavedGames = ({ userType, onLoadGame, selectedSport }) => {
  const { datasets, loading, fetchError, fetchSavedGames, fetchFullGameData } = useContext(SavedGamesContext);
  const { fetchPublishedDatasets } = useContext(SportsDataHubContext);
  const auth = getAuth();
  const { setLoadedCoords } = useContext(GameContext);
  const navigate = useNavigate();

  const [selectedDataset, setSelectedDataset] = useState(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [analysisFilter, setAnalysisFilter] = useState('all');
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedGameToMove, setSelectedGameToMove] = useState(null);
  const [sourceDataset, setSourceDataset] = useState(null);

  const handlePublishSuccess = () => {
    Swal.fire('Published!', 'Dataset has been published successfully.', 'success');
    setIsPublishModalOpen(false);
    fetchSavedGames();
    fetchPublishedDatasets();
  };

  // Helper function to determine analysis type
  const getAnalysisType = (game) => {
    // Check for explicit analysisType field
    if (game.analysisType) {
      return game.analysisType;
    }
    // Check for youtubeUrl to determine if it's video analysis
    if (game.youtubeUrl) {
      return 'video';
    }
    // Default to pitch analysis
    return 'pitch';
  };

  // Updated handleLoadGame function with proper routing and data handling
  const handleLoadGame = async (game) => {
    try {
      Swal.fire({
        title: 'Loading Game...',
        text: 'Please wait while we load your game data.',
        allowOutsideClick: false,
        background: 'var(--dark-card)',
        color: 'var(--light)',
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const fullGameData = await fetchFullGameData(game.gameId || game.gameName);
      Swal.close();

      // Normalize the game data array
      let normalizedData = Array.isArray(fullGameData.gameData)
        ? fullGameData.gameData
        : Object.values(fullGameData.gameData || {});

      if (normalizedData.length === 0 && !fullGameData.youtubeUrl) {
        Swal.fire({
          title: 'Error',
          text: 'Game data is empty or corrupted.',
          icon: 'error',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
        return;
      }

      const analysisType = getAnalysisType(fullGameData);

      if (analysisType === 'video') {
        console.log('Loading video analysis game:', fullGameData.gameName);

        // Process tags for ManualTagging with proper position handling
        const processedTags = normalizedData.map((tag) => {
          // Determine position coordinates
          let x = 50, y = 50;
          
          // First check if position is an object with x,y coordinates
          if (tag.position && typeof tag.position === 'object' && tag.position.x !== undefined && tag.position.y !== undefined) {
            x = tag.position.x;
            y = tag.position.y;
          }
          // Then check direct x,y properties
          else if (tag.x !== undefined && tag.y !== undefined) {
            x = tag.x;
            y = tag.y;
          }

          // Determine position type (forward, midfield, etc.)
          let positionType = 'forward';
          if (typeof tag.position === 'string') {
            positionType = tag.position;
          } else if (tag.position && tag.position.type) {
            positionType = tag.position.type;
          }

          return {
            ...tag,
            // Ensure position is stored as an object for the pitch selector
            position: { x, y },
            // Keep direct x,y for compatibility
            x: x,
            y: y,
            // Player data
            playerName: tag.playerName || tag.player || '',
            playerNumber: tag.playerNumber || '',
            // Event data
            timestamp: tag.timestamp || 0,
            category: tag.category || '',
            action: tag.action || '',
            team: tag.team || 'home',
            outcome: tag.outcome || '',
            notes: tag.notes || '',
            // GAA-specific fields
            pressure: tag.pressure || '0',
            foot: tag.foot || 'Right',
            minute: tag.minute || '',
          };
        });

        navigate('/tagging/manual', {
          state: {
            youtubeUrl: fullGameData.youtubeUrl,
            tags: processedTags,
            teamsData: fullGameData.teamsData,
            datasetName: fullGameData.datasetName || fullGameData.gameName,
            sport: fullGameData.sport,
          },
        });

        Swal.fire({
          title: 'Success',
          text: `Video analysis "${fullGameData.gameName}" loaded successfully!`,
          icon: 'success',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
      } else if (fullGameData.sport === 'GAA') {
        console.log('Loading GAA pitch game:', fullGameData.gameName);

        // Process data for PitchGraphic - position should be a string, not an object
        const processedData = normalizedData.map((item) => {
          // Determine position type
          let positionType = 'forward';
          if (typeof item.position === 'string') {
            positionType = item.position;
          } else if (item.position && item.position.type) {
            positionType = item.position.type;
          }

          // Get coordinates
          let x = 50, y = 50;
          if (item.x !== undefined && item.y !== undefined) {
            x = item.x;
            y = item.y;
          } else if (item.position && typeof item.position === 'object') {
            x = item.position.x || 50;
            y = item.position.y || 50;
          }

          return {
            action: item.action || 'point',
            team: item.team || 'Unknown',
            playerName: item.playerName || item.player || '',
            player: item.player || item.playerNumber || '',
            position: positionType, // This should be a string for PitchGraphic
            pressure: item.pressure || '0',
            foot: item.foot || 'Right',
            minute: item.minute || '',
            x: x,
            y: y,
            type: item.type || item.action || 'point',
            from: item.from || null,
            to: item.to || null,
          };
        });

        // Set coords in context for PitchGraphic
        setLoadedCoords(processedData);

        // Navigate to PitchGraphic
        navigate('/pitch');

        Swal.fire({
          title: 'Success',
          text: `GAA game "${fullGameData.gameName}" loaded successfully!`,
          icon: 'success',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
      } else {
        // Handle other sports
        console.log('Loading game for other sport:', fullGameData.sport, fullGameData.gameName);

        const processedData = normalizedData.map((item) => ({
          ...item,
          playerName: item.playerName || item.player || '',
          playerNumber: item.playerNumber || '',
          position: item.position || { x: 50, y: 50 },
          x: item.x || item.position?.x || 50,
          y: item.y || item.position?.y || 50,
          pressure: item.pressure || '0',
          foot: item.foot || 'Right',
          outcome: item.outcome || '',
        }));

        onLoadGame(fullGameData.sport, processedData);

        Swal.fire({
          title: 'Success',
          text: `Game "${fullGameData.gameName}" loaded successfully!`,
          icon: 'success',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
      }
    } catch (error) {
      console.error('Error loading game data:', error);
      Swal.close();
      Swal.fire({
        title: 'Error',
        text: error.message || 'Failed to load game data.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    }
  };

  const handleDeleteGame = async (gameId, gameName) => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire({
        title: 'Error',
        text: 'User not authenticated.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
      return;
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete the game "${gameName}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      background: 'var(--dark-card)',
      confirmButtonColor: 'var(--primary)',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = await user.getIdToken();
          const response = await fetch(`${apiUrl}/delete-game`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ uid: user.uid, gameId }),
          });

          const responseText = await response.text();
          let resultData;
          try {
            resultData = JSON.parse(responseText);
          } catch (error) {
            throw new Error(responseText || 'Unknown error occurred.');
          }

          if (response.ok) {
            Swal.fire({
              title: 'Deleted!',
              text: `Game "${gameName}" has been deleted.`,
              icon: 'success',
              background: 'var(--dark-card)',
              confirmButtonColor: 'var(--primary)',
            });
            fetchSavedGames();
          } else {
            throw new Error(resultData.error || 'Failed to delete the game.');
          }
        } catch (error) {
          console.error('Error deleting game:', error);
          Swal.fire({
            title: 'Error',
            text: error.message || 'Failed to delete the game.',
            icon: 'error',
            background: 'var(--dark-card)',
            confirmButtonColor: 'var(--primary)',
          });
        }
      }
    });
  };

  const handleMoveGame = (game, currentDatasetName) => {
    setSelectedGameToMove(game);
    setSourceDataset(currentDatasetName);
    setIsMoveModalOpen(true);
  };

  const closeMoveModal = () => {
    setIsMoveModalOpen(false);
    setSelectedGameToMove(null);
    setSourceDataset(null);
  };

  const moveGameToDataset = async (targetDatasetName) => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire({
        title: 'Error',
        text: 'User not authenticated.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
      return;
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/move-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: user.uid,
          gameId: selectedGameToMove.gameId || selectedGameToMove.gameName,
          sourceDataset: sourceDataset,
          targetDataset: targetDatasetName,
        }),
      });

      const resultData = await parseJSONNoNaN(response);
      if (response.ok) {
        Swal.fire({
          title: 'Moved!',
          text: `Game "${selectedGameToMove.gameName}" has been moved to dataset "${targetDatasetName}".`,
          icon: 'success',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
        fetchSavedGames();
        closeMoveModal();
      } else {
        throw new Error(resultData.error || 'Failed to move the game.');
      }
    } catch (error) {
      console.error('Error moving game:', error);
      Swal.fire({
        title: 'Error',
        text: error.message || 'Failed to move the game.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    }
  };

  const handleDownloadDataset = async (datasetName) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Swal.fire({
          title: 'Error',
          text: 'User not authenticated.',
          icon: 'error',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
        return;
      }

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/download-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: user.uid, datasetName }),
      });

      if (!response.ok) {
        const errorData = await parseJSONNoNaN(response);
        throw new Error(errorData.error || 'Failed to download dataset.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${datasetName}_games.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      Swal.fire({
        title: 'Downloaded!',
        text: `Dataset "${datasetName}" has been downloaded.`,
        icon: 'success',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    } catch (error) {
      console.error('Error downloading dataset:', error);
      Swal.fire({
        title: 'Error',
        text: error.message || 'Failed to download dataset.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    }
  };

  const handleDeleteDataset = async (datasetName) => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire({
        title: 'Error',
        text: 'User not authenticated.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
      return;
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete the entire dataset "${datasetName}" and all its games? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      background: 'var(--dark-card)',
      confirmButtonColor: 'var(--primary)',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = await user.getIdToken();
          const response = await fetch(`${apiUrl}/delete-dataset`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ uid: user.uid, datasetName }),
          });

          const resultData = await parseJSONNoNaN(response);
          if (response.ok) {
            Swal.fire({
              title: 'Deleted!',
              text: `Dataset "${datasetName}" and all its games have been deleted.`,
              icon: 'success',
              background: 'var(--dark-card)',
              confirmButtonColor: 'var(--primary)',
            });
            fetchSavedGames();
            fetchPublishedDatasets();
          } else {
            throw new Error(resultData.error || 'Failed to delete the dataset.');
          }
        } catch (error) {
          console.error('Error deleting dataset:', error);
          Swal.fire({
            title: 'Error',
            text: error.message || 'Failed to delete the dataset.',
            icon: 'error',
            background: 'var(--dark-card)',
            confirmButtonColor: 'var(--primary)',
          });
        }
      }
    });
  };

  const handlePublishDataset = (datasetName) => {
    setSelectedDataset(datasetName);
    setIsPublishModalOpen(true);
  };

  const closePublishModal = () => {
    setIsPublishModalOpen(false);
    setSelectedDataset(null);
  };

  const handlePublishSuccessInternal = () => {
    handlePublishSuccess();
  };

  const handleUpdateDataset = (datasetName) => {
    setSelectedDataset(datasetName);
    setIsUpdateModalOpen(true);
  };

  const closeUpdateModal = () => {
    setIsUpdateModalOpen(false);
    setSelectedDataset(null);
  };

  const handleRefresh = async () => {
    try {
      const db = getFirestore();
      const user = auth.currentUser;
      if (!user) {
        Swal.fire({
          title: 'Error',
          text: 'User not authenticated.',
          icon: 'error',
          background: 'var(--dark-card)',
          confirmButtonColor: 'var(--primary)',
        });
        return;
      }
      const datasetsRef = collection(db, 'datasets');
      const snapshot = await getDocs(datasetsRef);
      fetchSavedGames();
      fetchPublishedDatasets();

      Swal.fire({
        title: 'Refreshed!',
        text: 'Saved games and datasets updated.',
        icon: 'success',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    } catch (error) {
      console.error('Error refreshing from Firebase:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to refresh data from Firebase.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      });
    }
  };

  const handleUpdateSuccess = () => {
    Swal.fire({
      title: 'Updated!',
      text: `Dataset "${selectedDataset}" updated successfully.`,
      icon: 'success',
      background: 'var(--dark-card)',
      confirmButtonColor: 'var(--primary)',
    });
    closeUpdateModal();
    fetchSavedGames();
    fetchPublishedDatasets();
  };

  if (loading) {
    return (
      <div className="saved-games-container">
        <p>Loading saved games...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="saved-games-container">
        <p className="error">{fetchError}</p>
      </div>
    );
  }

  const filteredDatasets = Object.entries(datasets).reduce((acc, [datasetName, datasetInfo]) => {
    const { games, isPublished } = datasetInfo;
    const sportFilteredGames = games.filter((g) => g.sport === selectedSport);

    if (sportFilteredGames.length > 0) {
      acc[datasetName] = {
        games: sportFilteredGames,
        isPublished
      };
    }
    return acc;
  }, {});

  const datasetKeys = Object.keys(filteredDatasets);

  const getAvailableTargetDatasets = () => {
    return datasetKeys.filter(datasetName => datasetName !== sourceDataset);
  };

  return (
    <div className="saved-games-container">
      <div className="header-container">
        <h2>Saved Games for {selectedSport}</h2>
      </div>

      <div className="filter-area">
        <div className="filter-buttons">
          <button 
            className={analysisFilter === 'all' ? 'active' : ''} 
            onClick={() => setAnalysisFilter('all')}
          >
            All
          </button>
          <button 
            className={analysisFilter === 'video' ? 'active' : ''} 
            onClick={() => setAnalysisFilter('video')}
          >
            Video Analysis
          </button>
          <button 
            className={analysisFilter === 'pitch' ? 'active' : ''} 
            onClick={() => setAnalysisFilter('pitch')}
          >
            Pitch Analysis
          </button>
        </div>
        <button 
          className="refresh-button" 
          onClick={handleRefresh} 
          title="Refresh Data"
        >
          <FaSync />
        </button>
      </div>

      <div className="legend">
        <span><FaVideo className="analysis-icon video" /> Video Analysis</span>
        <span><FaMap className="analysis-icon pitch" /> Pitch Analysis</span>
      </div>

      {/* Move Game Modal */}
      {isMoveModalOpen && selectedGameToMove && (
        <div className="modal-overlay" onClick={closeMoveModal}>
          <div className="move-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Move Game to Different Dataset</h3>
              <button className="modal-close" onClick={closeMoveModal}>×</button>
            </div>
            <div className="modal-content">
              <p>Move <strong>"{selectedGameToMove.gameName}"</strong> from <strong>"{sourceDataset}"</strong> to:</p>
              <div className="dataset-selection">
                {getAvailableTargetDatasets().length === 0 ? (
                  <p className="no-datasets">No other datasets available. Create a new dataset first.</p>
                ) : (
                  getAvailableTargetDatasets().map(datasetName => (
                    <button
                      key={datasetName}
                      className="dataset-option"
                      onClick={() => moveGameToDataset(datasetName)}
                    >
                      {datasetName}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isPublishModalOpen && selectedDataset && (
        <PublishDataset
          isOpen={isPublishModalOpen}
          onClose={closePublishModal}
          datasetName={selectedDataset}
          onPublishSuccess={handlePublishSuccessInternal}
          apiUrl={process.env.REACT_APP_API_URL || 'http://localhost:5001'}
          userType={userType}
        />
      )}

      {isUpdateModalOpen && selectedDataset && (
        <UpdateDataset
          isOpen={isUpdateModalOpen}
          onClose={closeUpdateModal}
          datasetName={selectedDataset}
          onUpdateSuccess={handleUpdateSuccess}
          apiUrl={process.env.REACT_APP_API_URL || 'http://localhost:5001'}
          userType={userType}
        />
      )}

      {userType === '' ? (
        <p>Please upgrade to access saved games.</p>
      ) : (
        <>
          {datasetKeys.length === 0 ? (
            <p>No saved games available for {selectedSport}.</p>
          ) : (
            datasetKeys.map((datasetName) => {
              const { games, isPublished } = filteredDatasets[datasetName];
              const filteredGames = analysisFilter === 'all' 
                ? games 
                : games.filter(game => getAnalysisType(game).toLowerCase() === analysisFilter.toLowerCase());
              
              return (
                <div key={datasetName} className="dataset-section">
                  <div className="dataset-header">
                    <h3>Dataset: {datasetName}</h3>
                    <div className="dataset-actions">
                      <button
                        className="download-dataset-button"
                        onClick={() => handleDownloadDataset(datasetName)}
                      >
                        Download Dataset
                      </button>
                      {isPublished ? (
                        <button
                          className="update-dataset-button"
                          onClick={() => handleUpdateDataset(datasetName)}
                        >
                          Update Dataset
                        </button>
                      ) : (
                        <button
                          className="publish-dataset-button"
                          onClick={() => handlePublishDataset(datasetName)}
                        >
                          Publish Dataset
                        </button>
                      )}
                      <button
                        className="delete-dataset-button"
                        onClick={() => handleDeleteDataset(datasetName)}
                      >
                        Delete Dataset
                      </button>
                    </div>
                  </div>
                  {filteredGames.length === 0 ? (
                    <p>No games {analysisFilter !== 'all' ? `of type ${analysisFilter}` : ''} in this dataset for {selectedSport}.</p>
                  ) : (
                    <ul className="saved-games-list">
                      {filteredGames.map((game) => (
                        <li key={game.gameId || game.gameName} className={`saved-game-item ${getAnalysisType(game)}`}>
                          <div className="game-info">
                            <span className="game-name-saved-games">{game.gameName}</span>
                            {getAnalysisType(game) === 'video' ? (
                              <FaVideo className="analysis-icon video" title="Video Analysis" />
                            ) : (
                              <FaMap className="analysis-icon pitch" title="Pitch Analysis" />
                            )}
                            <span className="game-date">
                              {game.sport ? `${game.sport} - ` : ''}
                              {game.matchDate ? new Date(game.matchDate).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="game-actions">
                            <button
                              className="load-button"
                              onClick={() => handleLoadGame(game)}
                            >
                              Load
                            </button>
                            <button
                              className="move-button"
                              onClick={() => handleMoveGame(game, datasetName)}
                              title="Move to different dataset"
                            >
                              <FaExchangeAlt />
                            </button>
                            <button
                              className="delete-button"
                              onClick={() => handleDeleteGame(game.gameId || game.gameName, game.gameName)}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
};

SavedGames.propTypes = {
  userType: PropTypes.string.isRequired,
  onLoadGame: PropTypes.func.isRequired,
  selectedSport: PropTypes.string.isRequired,
};

export default SavedGames;