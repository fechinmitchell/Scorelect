// src/components/SavedGamesContext.js

import React, { createContext, useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';

export const SavedGamesContext = createContext();

/**
 * SavedGamesProvider Component
 *
 * This component fetches and provides the user's saved games data to its children via context.
 *
 * Props:
 * - children (React.Node): The child components that will consume the saved games data.
 */
export const SavedGamesProvider = ({ children }) => {
  const [datasets, setDatasets] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const auth = getAuth();

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

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
      const token = await user.getIdToken();

      // Fetch saved games
      const response = await fetch(`${apiUrl}/load-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
          'Authorization': `Bearer ${token}`,
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
      setFetchError(null);
    } catch (error) {
      console.error('Error fetching saved games:', error);
      setFetchError(error.message || 'Failed to fetch saved games.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.currentUser]); // Re-fetch if the user changes

  return (
    <SavedGamesContext.Provider value={{ datasets, loading, fetchError, fetchSavedGames }}>
      {children}
    </SavedGamesContext.Provider>
  );
};
