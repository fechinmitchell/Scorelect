// src/SavedGames.js

import React, { useEffect, useState, useContext } from 'react';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import './SavedGames.css';
import { GameContext } from './GameContext'; // Import GameContext
import PropTypes from 'prop-types'; // Import PropTypes

const SavedGames = ({ userType, onLoadGame }) => { // Removed apiUrl prop
  const [datasets, setDatasets] = useState({});
  const navigate = useNavigate();
  const auth = getAuth();
  const { setLoadedCoords } = useContext(GameContext); // Use Context to set loadedCoords
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Get the API URL from environment variables
  const apiUrl = process.env.REACT_APP_API_URL;

  useEffect(() => {
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
            'Authorization': `Bearer ${await user.getIdToken()}`, // Include authorization if required
          },
          body: JSON.stringify({ uid: user.uid }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch saved games.');
        }

        const gamesList = await response.json();
        console.log('Fetched games list:', gamesList); // Log the fetched data

        // Group games by datasetName
        const groupedDatasets = gamesList.reduce((acc, game) => {
          const dataset = game.datasetName || 'Default'; // Use 'Default' if no datasetName
          if (!acc[dataset]) {
            acc[dataset] = [];
          }
          acc[dataset].push(game);
          return acc;
        }, {});

        console.log('Grouped Datasets:', groupedDatasets); // Log grouped datasets

        setDatasets(groupedDatasets);
        setLoading(false);
        setFetchError(null);
      } catch (error) {
        console.error('Error fetching saved games:', error);
        setFetchError('Failed to fetch saved games.');
        setLoading(false);
      }
    };

    fetchSavedGames();
  }, [auth, apiUrl]);

  // Function to load a game
  const handleLoadGame = async (game) => {
    console.log('Attempting to load game:', game.gameName, 'for user:', auth.currentUser.uid);
    if (game.gameData && game.gameData.length > 0) {
      try {
        setLoadedCoords(game.gameData);
        Swal.fire('Success', `Game "${game.gameName}" loaded successfully!`, 'success');
        navigate('/'); // Navigate to the main pitch page or desired route
      } catch (error) {
        console.error('Error loading game data:', error);
        Swal.fire('Error', 'Failed to load game data.', 'error');
      }
    } else {
      Swal.fire('Error', 'Game data is empty or corrupted.', 'error');
    }
  };

  // Function to delete a single game
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
          const response = await fetch(`${apiUrl}/delete-game`, { // Ensure /delete-game endpoint exists
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`, // Include authorization if required
            },
            body: JSON.stringify({ uid: user.uid, gameId }),
          });

          const resultData = await response.json();
          console.log('Delete game response:', resultData); // Log response

          if (response.ok) {
            Swal.fire('Deleted!', `Game "${gameName}" has been deleted.`, 'success');
            // Optionally, refresh the saved games list
            setDatasets((prevDatasets) => {
              const updatedDatasets = { ...prevDatasets };
              for (const dataset in updatedDatasets) {
                updatedDatasets[dataset] = updatedDatasets[dataset].filter((game) => game.gameName !== gameName);
                if (updatedDatasets[dataset].length === 0) {
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

  // Function to download a dataset
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
          'Authorization': `Bearer ${token}`, // Include authorization if required
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

  // Function to delete an entire dataset
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
              'Authorization': `Bearer ${token}`, // Include authorization if required
            },
            body: JSON.stringify({ uid: user.uid, datasetName }),
          });

          const resultData = await response.json();
          console.log('Delete dataset response:', resultData); // Log response

          if (response.ok) {
            Swal.fire('Deleted!', `Dataset "${datasetName}" and all its games have been deleted.`, 'success');
            // Remove the deleted dataset from the state
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

  if (loading) {
    return <div className="saved-games-container"><p>Loading saved games...</p></div>;
  }

  if (fetchError) {
    return <div className="saved-games-container"><p className="error">{fetchError}</p></div>;
  }

  return (
    <div className="saved-games-container">
      <h2>Saved Games</h2>
      {userType === 'free' ? (
        <p>Please upgrade to access saved games.</p>
      ) : (
        <>
          {Object.keys(datasets).length === 0 ? (
            <p>No saved games available.</p>
          ) : (
            Object.entries(datasets).map(([datasetName, games]) => (
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
                      console.log('Rendering game:', game); // Log each game being rendered
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
                            <button className="load-button" onClick={() => handleLoadGame(game)}>Load</button>
                            <button className="delete-button" onClick={() => handleDeleteGame(game.gameId || game.gameName, game.gameName)}>Delete</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
};

// Define PropTypes for better type checking
SavedGames.propTypes = {
  userType: PropTypes.string.isRequired,
  onLoadGame: PropTypes.func.isRequired, // Ensure onLoadGame is passed
};

export default SavedGames;
