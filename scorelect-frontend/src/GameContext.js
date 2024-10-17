// src/GameContext.js

import React, { createContext, useState, useEffect } from 'react';

export const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [loadedCoords, setLoadedCoords] = useState([]);

  // Optional: Persist loadedCoords in localStorage
  useEffect(() => {
    const storedCoords = localStorage.getItem('loadedCoords');
    if (storedCoords) {
      setLoadedCoords(JSON.parse(storedCoords));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('loadedCoords', JSON.stringify(loadedCoords));
  }, [loadedCoords]);

  return (
    <GameContext.Provider value={{ loadedCoords, setLoadedCoords }}>
      {children}
    </GameContext.Provider>
  );
};
