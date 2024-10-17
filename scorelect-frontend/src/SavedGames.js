// src/SavedGames.js

import React, { useEffect, useState, useContext } from 'react';
import { getAuth } from 'firebase/auth';
import { firestore } from './firebase';
import { doc, getDocs, collection, deleteDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './SavedGames.css';
import { GameContext } from './GameContext'; // Import GameContext
import PropTypes from 'prop-types'; // Import PropTypes

const SavedGames = ({ userType, apiUrl, onLoadGame }) => { // Accept onLoadGame as prop
  const [savedGames, setSavedGames] = useState([]);
  const navigate = useNavigate();
  const auth = getAuth();
  const { setLoadedCoords } = useContext(GameContext); // Use Context to set loadedCoords

  useEffect(() => {
    const fetchSavedGames = async () => {
      const user = auth.currentUser;
      console.log('Authenticated user:', user);
      if (user) {
        try {
          console.log('Fetching saved games for user:', user.uid);
          const gamesRef = collection(firestore, 'savedGames', user.uid, 'games');
          const gamesSnapshot = await getDocs(gamesRef);
          const gamesList = gamesSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            date: doc.data().date,
            sport: doc.data().sport,
          }));
          console.log('Fetched games:', gamesList);
          setSavedGames(gamesList);
        } catch (error) {
          console.error('Error fetching saved games:', error);
        }
      } else {
        console.warn('User not authenticated, cannot fetch saved games.');
      }
    };

    fetchSavedGames();
  }, [auth]);

  const handleLoadGame = async (gameId, sport) => {
    const user = auth.currentUser;
    console.log('Attempting to load game:', gameId, 'for user:', user);
    if (user) {
      try {
        console.log('Loading game:', gameId);
        const gameDoc = await getDoc(doc(firestore, 'savedGames', user.uid, 'games', gameId));
        if (gameDoc.exists()) {
          const gameData = gameDoc.data().gameData;
          console.log('Loaded game data:', gameData);
          if (gameData && gameData.length > 0) {
            onLoadGame(sport, gameData); // Use onLoadGame to set sport and coords
            // navigate('/'); // No need to navigate here, as onLoadGame handles it
          } else {
            console.warn('Loaded game data is empty:', gameData);
          }
        } else {
          console.warn('Game document does not exist:', gameId);
        }
      } catch (error) {
        console.error('Error loading game:', error);
      }
    } else {
      console.warn('User not authenticated, cannot load game.');
    }
  };

  const handleDeleteGame = async (gameId) => {
    const user = auth.currentUser;
    console.log('Attempting to delete game:', gameId, 'for user:', user);
    if (user) {
      try {
        console.log('Deleting game:', gameId);
        await deleteDoc(doc(firestore, 'savedGames', user.uid, 'games', gameId));
        setSavedGames(savedGames.filter(game => game.id !== gameId));
        console.log('Game deleted:', gameId);
      } catch (error) {
        console.error('Error deleting game:', error);
      }
    } else {
      console.warn('User not authenticated, cannot delete game.');
    }
  };

  return (
    <div className="saved-games-container">
      <h2>Saved Games</h2>
      {userType === 'free' ? (
        <p>Please upgrade to access saved games.</p>
      ) : (
        <>
          {savedGames.length === 0 ? (
            <p>No saved games available.</p>
          ) : (
            <ul className="saved-games-list">
              {savedGames.map((game, index) => (
                <li key={index} className="saved-game-item">
                  <span className="game-name">{game.name}</span>
                  <span className="game-date">{game.sport} - {new Date(game.date).toLocaleDateString()}</span>
                  <div className="game-actions">
                    <button className="load-button" onClick={() => handleLoadGame(game.id, game.sport)}>Load</button>
                    <button className="delete-button" onClick={() => handleDeleteGame(game.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

// Define PropTypes for better type checking
SavedGames.propTypes = {
  userType: PropTypes.string.isRequired,
  apiUrl: PropTypes.string.isRequired,
  onLoadGame: PropTypes.func.isRequired, // Ensure onLoadGame is passed
};

export default SavedGames;
