// src/components/SavedGamesContext.js
import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';

export const SavedGamesContext = createContext();

// OPTIMIZATION 1: Cache implementation
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
  const [gameStats, setGameStats] = useState(null);
  const auth = getAuth();
  
  // OPTIMIZATION 2: Abort controller to cancel ongoing requests
  const abortControllerRef = useRef(null);
  
  // OPTIMIZATION 3: Debounced fetch to prevent multiple rapid calls
  const fetchTimeoutRef = useRef(null);

  const fetchSavedGames = useCallback(async (forceRefresh = false) => {
    const user = auth.currentUser;
    if (!user) {
      console.log('SavedGamesContext: No authenticated user');
      setDatasets({});
      setLoading(false);
      return;
    }

    // OPTIMIZATION 4: Use cache if valid and not forcing refresh
    if (!forceRefresh && cache.isValid()) {
      console.log('SavedGamesContext: Using cached data');
      setDatasets(cache.games.datasets);
      setGameStats(cache.games.stats);
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

    try {
      const token = await user.getIdToken();
      
      // OPTIMIZATION 5: Fetch stats and games in parallel
      const [gamesResponse, statsResponse] = await Promise.all([
        fetch(`${apiUrl}/load-games`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            uid: user.uid,
            includeGameData: false
          }),
          signal: abortControllerRef.current.signal
        }),
        fetch(`${apiUrl}/get-game-stats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: user.uid }),
          signal: abortControllerRef.current.signal
        }).catch(() => null) // Stats are optional, don't fail if endpoint doesn't exist
      ]);

      if (!gamesResponse.ok) {
        const errorText = await gamesResponse.text();
        throw new Error(`Failed to fetch saved games: ${gamesResponse.status} ${errorText}`);
      }

      const result = await parseJSONNoNaN(gamesResponse);
      const stats = statsResponse && statsResponse.ok ? await parseJSONNoNaN(statsResponse) : null;

      if (result.error) {
        throw new Error(result.error);
      }

      // Transform the data
      const transformedDatasets = {};
      const savedGames = result.savedGames || [];
      const publishedDatasets = result.publishedDatasets || [];
      
      if (Array.isArray(savedGames)) {
        savedGames.forEach(game => {
          const datasetName = game.datasetName || 'Uncategorized';
          
          if (!transformedDatasets[datasetName]) {
            transformedDatasets[datasetName] = {
              games: [],
              isPublished: false
            };
          }
          
          transformedDatasets[datasetName].games.push(game);
        });
      }

      if (Array.isArray(publishedDatasets)) {
        publishedDatasets.forEach(datasetName => {
          if (transformedDatasets[datasetName]) {
            transformedDatasets[datasetName].isPublished = true;
          }
        });
      }

      // Cache the results
      cache.set({ datasets: transformedDatasets, stats });

      setDatasets(transformedDatasets);
      setGameStats(stats);
      setLoading(false);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('SavedGamesContext: Fetch aborted');
        return;
      }
      console.error('SavedGamesContext: Error fetching saved games:', error);
      setFetchError(error.message);
      setDatasets({});
      setLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
  }, [auth]);

  // OPTIMIZATION 6: Debounced refresh function
  const debouncedFetchSavedGames = useCallback((forceRefresh = false) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
      fetchSavedGames(forceRefresh);
    }, 300); // 300ms debounce
  }, [fetchSavedGames]);

  // Function to fetch full game data when needed (unchanged)
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch game data: ${response.status}`);
      }

      const result = await parseJSONNoNaN(response);
      
      if (result.error) {
        throw new Error(result.error);
      }

      return result.game;
    } catch (error) {
      console.error('SavedGamesContext: Error fetching full game data:', error);
      throw error;
    }
  }, [auth]);

  // OPTIMIZATION 7: Clear cache on user change
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        cache.clear();
        setDatasets({});
        setGameStats(null);
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
    gameStats,
    fetchSavedGames: debouncedFetchSavedGames,
    fetchFullGameData,
    refreshCache: () => {
      cache.clear();
      fetchSavedGames(true);
    }
  };

  return (
    <SavedGamesContext.Provider value={value}>
      {children}
    </SavedGamesContext.Provider>
  );
};