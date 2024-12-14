// src/components/SavedGames.js

import React, { useEffect, useState, useContext } from 'react';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import './SavedGames.css';
import { GameContext } from './GameContext';
import { SavedGamesContext } from './components/SavedGamesContext'; // Ensure the correct relative path
import PropTypes from 'prop-types';
import PublishDataset from './PublishDataset';
import UpdateDataset from './UpdateDataset';

/**
 * SavedGames Component
 *
 * This component displays the user's saved games, allowing them to load, delete, download, publish, or update datasets.
 * It consumes the saved games data from SavedGamesContext and filters them by the selected sport.
 *
 * Props:
 * - userType (string): The type of user (e.g., 'free', 'premium').
 * - onLoadGame (function): Function to handle loading a game, provided by the parent component.
 * - selectedSport (string): The sport currently selected in the sidebar dropdown.
 */
const SavedGames = ({ userType, onLoadGame, selectedSport }) => {
  const { datasets, loading, fetchError, fetchSavedGames } = useContext(SavedGamesContext); 
  const auth = getAuth();
  const { setLoadedCoords } = useContext(GameContext);
  const [selectedDataset, setSelectedDataset] = useState(null);

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const handleLoadGame = async (game) => {
    console.log('Attempting to load game:', game.gameName, 'for user:', auth.currentUser?.uid);
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
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ uid: user.uid, gameId }),
          });

          const resultData = await response.json();
          console.log('Delete game response:', resultData);

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
        const errorData = await response.json();
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

          const resultData = await response.json();
          console.log('Delete dataset response:', resultData);

          if (response.ok) {
            Swal.fire('Deleted!', `Dataset "${datasetName}" and all its games have been deleted.`, 'success');
            fetchSavedGames();
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

  const handlePublishDataset = (datasetName) => {
    setSelectedDataset(datasetName);
    setIsPublishModalOpen(true);
  };

  const closePublishModal = () => {
    setIsPublishModalOpen(false);
    setSelectedDataset(null);
  };

  const handlePublishSuccess = () => {
    Swal.fire('Published!', `Dataset "${selectedDataset}" has been published successfully.`, 'success');
    closePublishModal();
    fetchSavedGames(); // Refresh the saved games list
  };

  const handleUpdateDataset = (datasetName) => {
    setSelectedDataset(datasetName);
    setIsUpdateModalOpen(true);
  };

  const closeUpdateModal = () => {
    setIsUpdateModalOpen(false);
    setSelectedDataset(null);
  };

  const handleUpdateSuccess = () => {
    Swal.fire('Updated!', `Dataset "${selectedDataset}" has been updated successfully.`, 'success');
    closeUpdateModal();
    fetchSavedGames(); // Refresh the saved games list
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

  // Filter datasets by selectedSport
  const filteredDatasets = Object.entries(datasets).reduce((acc, [datasetName, datasetInfo]) => {
    const { games, isPublished } = datasetInfo;
    // Filter games by selectedSport
    const sportFilteredGames = games.filter((game) => game.sport === selectedSport);

    if (sportFilteredGames.length > 0) {
      // Only include this dataset if it has games matching the selectedSport
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
      <h2>Saved Games for {selectedSport}</h2>

      {/* Publish Dataset Modal */}
      {isPublishModalOpen && selectedDataset && (
        <PublishDataset
          isOpen={isPublishModalOpen}
          onClose={closePublishModal}
          datasetName={selectedDataset}
          onPublishSuccess={handlePublishSuccess}
          apiUrl={process.env.REACT_APP_API_URL || 'http://localhost:5001'}
          userType={userType}
        />
      )}

      {/* Update Dataset Modal */}
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

      {userType === 'free' ? (
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
                      {games.map((game) => {
                        return (
                          <li key={game.gameId || game.gameName} className="saved-game-item">
                            <div className="game-info">
                              <span className="game-name">{game.gameName}</span>
                              <span className="game-date">
                                {game.sport ? `${game.sport} - ` : ''}
                                {game.matchDate ? new Date(game.matchDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            <div className="game-actions">
                              <button className="load-button" onClick={() => handleLoadGame(game)}>
                                Load
                              </button>
                              <button
                                className="delete-button"
                                onClick={() => handleDeleteGame(game.gameId || game.gameName, game.gameName)}
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        );
                      })}
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
