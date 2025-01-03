// src/components/SavedGamesContext.js

import React, { createContext, useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';

export const SavedGamesContext = createContext();

/**
 * parseJSONNoNaN: same approach as in SavedGames.js
 */
async function parseJSONNoNaN(response) {
  const rawText = await response.text();
  const safeText = rawText
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, '999999999')
    .replace(/\b-Infinity\b/g, '-999999999');
  return JSON.parse(safeText);
}

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

      // 1) Fetch saved games
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

      // Safely parse
      const gamesList = await parseJSONNoNaN(response);
      console.log('Fetched games list:', gamesList);

      // 2) Fetch all published datasets created by the user
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

      // Safely parse
      const publishedDatasetsData = await parseJSONNoNaN(datasetsResponse);
      const publishedDatasetNames = new Set(publishedDatasetsData.datasets);

      // Group games by datasetName
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
