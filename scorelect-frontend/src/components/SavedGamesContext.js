// src/components/SavedGamesContext.js
// OPTIMIZED VERSION - Removes non-existent endpoint call, adds better error handling
import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';

export const SavedGamesContext = createContext();

// Cache implementation
const cache = {
  games: null,
  timestamp: null,
  TTL: 5 * 60 * 1000, // 5 minutes cache
  
  isValid() {
    return this.games && this.timestamp && (Date.now() - this.timestamp < this.TTL);
  },
  
  set(data) {
    this.games = data;
    this.timestamp = Date.now();
  },
  
  clear() {
    this.games = null;
    this.timestamp = null;
  }
};

// Cache for individual game data (full game data loaded on demand)
const gameDataCache = new Map();
const GAME_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for individual games

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
  
  // Abort controller to cancel ongoing requests
  const abortControllerRef = useRef(null);
  
  // Debounce timeout ref
  const fetchTimeoutRef = useRef(null);

  const fetchSavedGames = useCallback(async (forceRefresh = false) => {
    const user = auth.currentUser;
    if (!user) {
      console.log('SavedGamesContext: No authenticated user');
      setDatasets({});
      setLoading(false);
      return;
    }

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && cache.isValid()) {
      console.log('SavedGamesContext: Using cached data');
      setDatasets(cache.games.datasets);
      setLoading(false);
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any pending fetch timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
    console.log('SavedGamesContext: Fetching from API URL:', apiUrl);

    setLoading(true);
    setFetchError(null);

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    // Set a timeout for the request (30 seconds)
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 30000);

    try {
      const token = await user.getIdToken();
      
      // OPTIMIZED: Single request for games metadata only
      // Removed the non-existent /get-game-stats call
      const response = await fetch(`${apiUrl}/load-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          uid: user.uid,
          includeGameData: false  // CRITICAL: Only fetch metadata
        }),
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to fetch saved games (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // Keep the default error message
        }
        throw new Error(errorMessage);
      }

      const result = await parseJSONNoNaN(response);

      if (result.error) {
        throw new Error(result.error);
      }

      // Transform the data into datasets structure
      const transformedDatasets = {};
      const savedGames = result.savedGames || [];
      const publishedDatasets = result.publishedDatasets || [];
      
      // Create a Set for fast lookup of published datasets
      const publishedSet = new Set(publishedDatasets);
      
      if (Array.isArray(savedGames)) {
        savedGames.forEach(game => {
          const datasetName = game.datasetName || 'Uncategorized';
          
          if (!transformedDatasets[datasetName]) {
            transformedDatasets[datasetName] = {
              games: [],
              isPublished: publishedSet.has(datasetName)
            };
          }
          
          transformedDatasets[datasetName].games.push(game);
        });
      }

      // Cache the results
      cache.set({ datasets: transformedDatasets });

      setDatasets(transformedDatasets);
      setLoading(false);
      setFetchError(null);
      
      console.log(`SavedGamesContext: Loaded ${savedGames.length} games in ${Object.keys(transformedDatasets).length} datasets`);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.log('SavedGamesContext: Fetch aborted (timeout or cancelled)');
        setFetchError('Request timed out. Please try again.');
        setLoading(false);
        return;
      }
      
      console.error('SavedGamesContext: Error fetching saved games:', error);
      setFetchError(error.message || 'Failed to load saved games');
      setDatasets({});
      setLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
  }, [auth]);

  // Debounced fetch function to prevent rapid multiple calls
  const debouncedFetchSavedGames = useCallback((forceRefresh = false) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
      fetchSavedGames(forceRefresh);
    }, 300); // 300ms debounce
  }, [fetchSavedGames]);

  /**
   * Fetch full game data for a specific game (on-demand loading)
   * This is called when the user clicks "Load" on a game
   */
  const fetchFullGameData = useCallback(async (gameId) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check cache first
    const cachedGame = gameDataCache.get(gameId);
    if (cachedGame && (Date.now() - cachedGame.timestamp < GAME_CACHE_TTL)) {
      console.log('SavedGamesContext: Returning cached game data for:', gameId);
      return cachedGame.data;
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

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to fetch game data (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // Keep the default error message
        }
        throw new Error(errorMessage);
      }

      const result = await parseJSONNoNaN(response);
      
      if (result.error) {
        throw new Error(result.error);
      }

      const gameData = result.game;
      
      // Cache the game data
      gameDataCache.set(gameId, {
        data: gameData,
        timestamp: Date.now()
      });

      return gameData;
    } catch (error) {
      console.error('SavedGamesContext: Error fetching full game data:', error);
      throw error;
    }
  }, [auth]);

  /**
   * Clear game cache (useful after updates/deletes)
   */
  const clearGameCache = useCallback((gameId = null) => {
    if (gameId) {
      gameDataCache.delete(gameId);
    } else {
      gameDataCache.clear();
    }
  }, []);

  // Clear cache and refetch on user change
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        cache.clear();
        gameDataCache.clear();
        setDatasets({});
      } else {
        fetchSavedGames();
      }
    });

    return () => {
      unsubscribe();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [auth, fetchSavedGames]);

  const value = {
    datasets,
    loading,
    fetchError,
    fetchSavedGames: debouncedFetchSavedGames,
    fetchFullGameData,
    clearGameCache,
    refreshCache: () => {
      cache.clear();
      gameDataCache.clear();
      fetchSavedGames(true);
    }
  };

  return (
    <SavedGamesContext.Provider value={value}>
      {children}
    </SavedGamesContext.Provider>
  );
};