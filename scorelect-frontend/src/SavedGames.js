// src/components/SavedGames.js

import React, { useEffect, useState, useContext } from 'react';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import './SavedGames.css';
import { GameContext } from './GameContext';
import PropTypes from 'prop-types';
import PublishDataset from './PublishDataset';
import UpdateDataset from './UpdateDataset'; // Import the UpdateDataset component

/**
 * SavedGames Component
 *
 * This component fetches and displays the user's saved games, allowing them to load, delete, download, publish, or update datasets.
 * It integrates the PublishDataset and UpdateDataset components for dataset management.
 *
 * Props:
 * - userType (string): The type of user (e.g., 'free', 'premium').
 * - onLoadGame (function): Function to handle loading a game, provided by the parent component.
 */
const SavedGames = ({ userType, onLoadGame }) => {
  const [datasets, setDatasets] = useState({});
  const auth = getAuth();
  const { setLoadedCoords } = useContext(GameContext);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // State for PublishDataset modal
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);

  // State for UpdateDataset modal
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const apiUrl = process.env.REACT_APP_API_URL;

  /**
   * Fetches the saved games for the authenticated user and groups them by dataset.
   */
  const fetchSavedGames = async () => {
    const user = auth.currentUser;

    if (!user) {
      console.warn('User not authenticated, cannot fetch saved games.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/load-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ uid: user.uid }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch saved games.');
      }

      const gamesList = await response.json();
      console.log('Fetched games list:', gamesList);

      // Fetch all published datasets created by the user
      const datasetsResponse = await fetch(`${apiUrl}/list-published-datasets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ uid: user.uid }),
      });

      if (!datasetsResponse.ok) {
        throw new Error('Failed to fetch published datasets.');
      }

      const publishedDatasetsData = await datasetsResponse.json();
      const publishedDatasetNames = new Set(publishedDatasetsData.datasets);

      // Group games by datasetName and include published status
      const groupedDatasets = gamesList.reduce((acc, game) => {
        const dataset = game.datasetName || 'Default';
        if (!acc[dataset]) {
          acc[dataset] = { games: [], isPublished: false };
        }
        acc[dataset].games.push(game);
        // Check if the dataset is published
        if (publishedDatasetNames.has(dataset)) {
          acc[dataset].isPublished = true;
        }
        return acc;
      }, {});

      console.log('Grouped Datasets:', groupedDatasets);

      setDatasets(groupedDatasets);
      setLoading(false);
      setFetchError(null);
    } catch (error) {
      console.error('Error fetching saved games:', error);
      setFetchError('Failed to fetch saved games.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, apiUrl]);

  /**
   * Handles loading a selected game.
   *
   * @param {Object} game - The game object to load.
   */
  const handleLoadGame = async (game) => {
    console.log('Attempting to load game:', game.gameName, 'for user:', auth.currentUser.uid);
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

  /**
   * Handles deleting a single game.
   *
   * @param {string} gameId - The unique identifier of the game to delete.
   * @param {string} gameName - The name of the game to delete (for display purposes).
   */
  const handleDeleteGame = async (gameId, gameName) => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire('Error', 'User not authenticated.', 'error');
      return;
    }

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
            setDatasets((prevDatasets) => {
              const updatedDatasets = { ...prevDatasets };
              for (const dataset in updatedDatasets) {
                updatedDatasets[dataset].games = updatedDatasets[dataset].games.filter(
                  (game) => game.gameId !== gameId
                );
                if (updatedDatasets[dataset].games.length === 0) {
                  delete updatedDatasets[dataset];
                }
              }
              return updatedDatasets;
            });
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

  /**
   * Handles downloading a dataset as a JSON file.
   *
   * @param {string} datasetName - The name of the dataset to download.
   * @param {Array} games - The list of games within the dataset.
   */
  const handleDownloadDataset = async (datasetName, games) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Swal.fire('Error', 'User not authenticated.', 'error');
        return;
      }

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

  /**
   * Handles deleting an entire dataset along with all its games.
   *
   * @param {string} datasetName - The name of the dataset to delete.
   */
  const handleDeleteDataset = async (datasetName) => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire('Error', 'User not authenticated.', 'error');
      return;
    }

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
            setDatasets((prevDatasets) => {
              const updatedDatasets = { ...prevDatasets };
              delete updatedDatasets[datasetName];
              return updatedDatasets;
            });
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

  /**
   * Handles opening the PublishDataset modal for a specific dataset.
   *
   * @param {string} datasetName - The name of the dataset to publish.
   */
  const handlePublishDataset = (datasetName) => {
    setSelectedDataset(datasetName);
    setIsPublishModalOpen(true);
  };

  /**
   * Closes the PublishDataset modal.
   */
  const closePublishModal = () => {
    setIsPublishModalOpen(false);
    setSelectedDataset(null);
  };

  /**
   * Callback function to handle successful dataset publication.
   */
  const handlePublishSuccess = () => {
    Swal.fire('Published!', `Dataset "${selectedDataset}" has been published successfully.`, 'success');
    closePublishModal();
    fetchSavedGames(); // Refresh the saved games list
  };

  /**
   * Handles opening the UpdateDataset modal for a specific dataset.
   *
   * @param {string} datasetName - The name of the dataset to update.
   */
  const handleUpdateDataset = (datasetName) => {
    setSelectedDataset(datasetName);
    setIsUpdateModalOpen(true);
  };

  /**
   * Closes the UpdateDataset modal.
   */
  const closeUpdateModal = () => {
    setIsUpdateModalOpen(false);
    setSelectedDataset(null);
  };

  /**
   * Callback function to handle successful dataset update.
   */
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

  return (
    <div className="saved-games-container">
      <h2>Saved Games</h2>

      {/* Publish Dataset Modal */}
      {isPublishModalOpen && selectedDataset && (
        <PublishDataset
          isOpen={isPublishModalOpen}
          onClose={closePublishModal}
          datasetName={selectedDataset}
          onPublishSuccess={handlePublishSuccess}
          apiUrl={apiUrl}
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
          apiUrl={apiUrl}
          userType={userType}
        />
      )}

      {userType === 'free' ? (
        <p>Please upgrade to access saved games.</p>
      ) : (
        <>
          {Object.keys(datasets).length === 0 ? (
            <p>No saved games available.</p>
          ) : (
            Object.entries(datasets).map(([datasetName, datasetInfo]) => {
              const { games, isPublished } = datasetInfo;
              return (
                <div key={datasetName} className="dataset-section">
                  <div className="dataset-header">
                    <h3>Dataset: {datasetName}</h3>
                    <div className="dataset-actions">
                      <button
                        className="download-dataset-button"
                        onClick={() => handleDownloadDataset(datasetName, games)}
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
                    <p>No games in this dataset.</p>
                  ) : (
                    <ul className="saved-games-list">
                      {games.map((game) => {
                        console.log('Rendering game:', game);
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

// Define PropTypes for better type checking and to ensure required props are passed
SavedGames.propTypes = {
  userType: PropTypes.string.isRequired, // e.g., 'free', 'premium'
  onLoadGame: PropTypes.func.isRequired, // Function to handle loading a game
};

export default SavedGames;
