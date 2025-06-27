// src/components/SavedGamesContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';

export const SavedGamesContext = createContext();

/**
 * parseJSONNoNaN: same approach as in backend to handle NaN values
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

  const fetchSavedGames = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      console.log('SavedGamesContext: No authenticated user');
      setDatasets({});
      setLoading(false);
      return;
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
    console.log('SavedGamesContext: Fetching from API URL:', apiUrl);

    setLoading(true);
    setFetchError(null);

    try {
      const token = await user.getIdToken();
      console.log('SavedGamesContext: Got auth token, making request...');
      
      const response = await fetch(`${apiUrl}/load-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          uid: user.uid,
          includeGameData: false  // Don't include heavy game data
        }),
      });

      console.log('SavedGamesContext: Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('SavedGamesContext: Error response:', errorText);
        throw new Error(`Failed to fetch saved games: ${response.status} ${errorText}`);
      }

      const result = await parseJSONNoNaN(response);
      console.log('SavedGamesContext: Fetched result:', result);

      if (result.error) {
        throw new Error(result.error);
      }

      // Transform the data into the expected format
      const transformedDatasets = {};
      
      // Make sure savedGames exists and is an array
      const savedGames = result.savedGames || [];
      const publishedDatasets = result.publishedDatasets || [];
      
      console.log(`SavedGamesContext: Processing ${savedGames.length} games`);
      console.log('SavedGamesContext: savedGames type:', typeof savedGames, Array.isArray(savedGames));
      
      // Only process if savedGames is actually an array
      if (Array.isArray(savedGames)) {
        savedGames.forEach(game => {
          const datasetName = game.datasetName || 'Uncategorized';
          
          if (!transformedDatasets[datasetName]) {
            transformedDatasets[datasetName] = {
              games: [],
              isPublished: false
            };
          }
          
          // Don't include the heavy gameData in the listing
          const { gameData, ...lightweightGame } = game;
          transformedDatasets[datasetName].games.push(lightweightGame);
        });
      } else {
        console.error('SavedGamesContext: savedGames is not an array:', savedGames);
      }

      // Check which datasets are published
      if (Array.isArray(publishedDatasets)) {
        publishedDatasets.forEach(datasetName => {
          if (transformedDatasets[datasetName]) {
            transformedDatasets[datasetName].isPublished = true;
          }
        });
      }

      console.log('SavedGamesContext: Transformed datasets:', Object.keys(transformedDatasets));
      setDatasets(transformedDatasets);
      setLoading(false);
    } catch (error) {
      console.error('SavedGamesContext: Error fetching saved games:', error);
      setFetchError(error.message);
      setDatasets({});
      setLoading(false);
    }
  }, [auth]);

  // Function to fetch full game data when needed
  const fetchFullGameData = useCallback(async (gameId) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
    console.log('SavedGamesContext: Fetching full game data for:', gameId);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/load-game-by-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          uid: user.uid,
          gameId: gameId
        }),
      });

      console.log('SavedGamesContext: Full game data response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('SavedGamesContext: Error fetching full game data:', errorText);
        throw new Error(`Failed to fetch game data: ${response.status}`);
      }

      const result = await parseJSONNoNaN(response);
      
      if (result.error) {
        throw new Error(result.error);
      }

      console.log('SavedGamesContext: Fetched full game data successfully');
      return result.game;
    } catch (error) {
      console.error('SavedGamesContext: Error fetching full game data:', error);
      throw error;
    }
  }, [auth]);

  useEffect(() => {
    fetchSavedGames();
  }, [fetchSavedGames]);

  const value = {
    datasets,
    loading,
    fetchError,
    fetchSavedGames,
    fetchFullGameData
  };

  return (
    <SavedGamesContext.Provider value={value}>
      {children}
    </SavedGamesContext.Provider>
  );
};