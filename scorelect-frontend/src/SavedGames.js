// src/components/SavedGames.js
import React, { useEffect, useState, useContext } from 'react';
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

/**
 * parseJSONNoNaN(response):
 * 1) Reads raw text from the response.
 * 2) Replaces NaN, Infinity, -Infinity with valid tokens.
 * 3) Returns the JSON-parsed object.
 */
async function parseJSONNoNaN(response) {
  const rawText = await response.text();
  const safeText = rawText
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, '999999999')
    .replace(/\b-Infinity\b/g, '-999999999');
  return JSON.parse(safeText);
}

const SavedGames = ({ userType, onLoadGame, selectedSport }) => {
  const { datasets, loading, fetchError, fetchSavedGames } = useContext(SavedGamesContext); 
  const { fetchPublishedDatasets } = useContext(SportsDataHubContext);
  const auth = getAuth();
  const { setLoadedCoords } = useContext(GameContext);

  const [selectedDataset, setSelectedDataset] = useState(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Called after successful publication
  const handlePublishSuccess = () => {
    Swal.fire('Published!', 'Dataset has been published successfully.', 'success');
    setIsPublishModalOpen(false);
    fetchSavedGames();
    fetchPublishedDatasets();
  };

  // Load a game
  const handleLoadGame = async (game) => {
    if (game.gameData && game.gameData.length > 0) {
      try {
        onLoadGame(game.sport, game.gameData);
        Swal.fire('Success', `Game "${game.gameName}" loaded successfully!`, 'success');
      } catch (error) {
        console.error('Error loading game data:', error);
        Swal.fire('Error', 'Failed to load game data.', 'error');
      }
    } else {
      Swal.fire('Error', 'Game data is empty or corrupted.', 'error');
    }
  };

  // Delete a single game using DELETE method and reading response once
  const handleDeleteGame = async (gameId, gameName) => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire('Error', 'User not authenticated.', 'error');
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
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = await user.getIdToken();
          const response = await fetch(`${apiUrl}/delete-game`, {
            method: 'DELETE', // Use DELETE method
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ uid: user.uid, gameId }),
          });

          // Read the response text once
          const responseText = await response.text();
          let resultData;
          try {
            resultData = JSON.parse(responseText);
          } catch (error) {
            throw new Error(responseText || 'Unknown error occurred.');
          }

          if (response.ok) {
            Swal.fire('Deleted!', `Game "${gameName}" has been deleted.`, 'success');
            fetchSavedGames();
          } else {
            throw new Error(resultData.error || 'Failed to delete the game.');
          }
        } catch (error) {
          console.error('Error deleting game:', error);
          Swal.fire('Error', error.message || 'Failed to delete the game.', 'error');
        }
      }
    });
  };

  // Download dataset
  const handleDownloadDataset = async (datasetName) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Swal.fire('Error', 'User not authenticated.', 'error');
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

      Swal.fire('Downloaded!', `Dataset "${datasetName}" has been downloaded.`, 'success');
    } catch (error) {
      console.error('Error downloading dataset:', error);
      Swal.fire('Error', error.message || 'Failed to download dataset.', 'error');
    }
  };

  // Delete entire dataset
  const handleDeleteDataset = async (datasetName) => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire('Error', 'User not authenticated.', 'error');
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
            Swal.fire('Deleted!', `Dataset "${datasetName}" and all its games have been deleted.`, 'success');
            fetchSavedGames();
            fetchPublishedDatasets();
          } else {
            throw new Error(resultData.error || 'Failed to delete the dataset.');
          }
        } catch (error) {
          console.error('Error deleting dataset:', error);
          Swal.fire('Error', error.message || 'Failed to delete the dataset.', 'error');
        }
      }
    });
  };

  // Publish dataset
  const handlePublishDataset = (datasetName) => {
    setSelectedDataset(datasetName);
    setIsPublishModalOpen(true);
  };

  // Close publish modal
  const closePublishModal = () => {
    setIsPublishModalOpen(false);
    setSelectedDataset(null);
  };

  const handlePublishSuccessInternal = () => {
    handlePublishSuccess();
  };

  // Update dataset
  const handleUpdateDataset = (datasetName) => {
    setSelectedDataset(datasetName);
    setIsUpdateModalOpen(true);
  };

  // Close update modal
  const closeUpdateModal = () => {
    setIsUpdateModalOpen(false);
    setSelectedDataset(null);
  };

  // Refresh from Firestore
  const handleRefresh = async () => {
    try {
      const db = getFirestore();
      const user = auth.currentUser;
      if (!user) {
        Swal.fire('Error', 'User not authenticated.', 'error');
        return;
      }
      const datasetsRef = collection(db, 'datasets');
      const snapshot = await getDocs(datasetsRef);
      // Optionally process new datasets here
      fetchSavedGames();
      fetchPublishedDatasets();

      Swal.fire('Refreshed!', 'Saved games and datasets updated.', 'success');
    } catch (error) {
      console.error('Error refreshing from Firebase:', error);
      Swal.fire('Error', 'Failed to refresh data from Firebase.', 'error');
    }
  };

  const handleUpdateSuccess = () => {
    Swal.fire('Updated!', `Dataset "${selectedDataset}" updated successfully.`, 'success');
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

  // Filter datasets to only include games for the selected sport
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

  return (
    <div className="saved-games-container">
      <div className="header-container">
        <h2>Saved Games for {selectedSport}</h2>
        <button className="refresh-button" onClick={handleRefresh}>Refresh</button>
      </div>

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
                  {games.length === 0 ? (
                    <p>No games in this dataset for {selectedSport}.</p>
                  ) : (
                    <ul className="saved-games-list">
                      {games.map((game) => (
                        <li key={game.gameId || game.gameName} className="saved-game-item">
                          <div className="game-info">
                            <span className="game-name">{game.gameName}</span>
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
                              className="delete-button"
                              onClick={() =>
                                handleDeleteGame(game.gameId || game.gameName, game.gameName)
                              }
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
