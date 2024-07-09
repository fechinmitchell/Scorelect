// src/SavedGames.js
import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { firestore } from './firebase';
import { doc, getDocs, collection, deleteDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './SavedGames.css';

const SavedGames = ({ userType }) => {
  const [savedGames, setSavedGames] = useState([]);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const fetchSavedGames = async () => {
      const user = auth.currentUser;
      if (user) {
        const gamesRef = collection(firestore, 'savedGames', user.uid, 'games');
        const gamesSnapshot = await getDocs(gamesRef);
        const gamesList = gamesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          date: doc.data().date,
          sport: doc.data().sport, // Ensure the sport is being fetched
        }));
        setSavedGames(gamesList);
      }
    }; 

    fetchSavedGames();
  }, [auth]);

  const handleLoadGame = async (gameId, sport) => {
    const user = auth.currentUser;
    if (user) {
      const gameDoc = await getDoc(doc(firestore, 'savedGames', user.uid, 'games', gameId));
      if (gameDoc.exists()) {
        const gameData = gameDoc.data().gameData; // Fetch the saved game data
        navigate(`/${sport.toLowerCase()}`, { state: { loadedCoords: gameData } }); // Pass the game data to the specific component
      }
    }
  };

  const handleDeleteGame = async (gameId) => {
    const user = auth.currentUser;
    if (user) {
      await deleteDoc(doc(firestore, 'savedGames', user.uid, 'games', gameId));
      setSavedGames(savedGames.filter(game => game.id !== gameId));
    }
  };

  return (
    <div className="saved-games-container">
      <h2>Saved Games</h2>
      {userType === 'free' ? (
        <p>Please upgrade to access saved games.</p>
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
    </div>
  );
};

export default SavedGames;
