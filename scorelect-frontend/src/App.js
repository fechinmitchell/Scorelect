// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { auth } from './firebase';
import SignIn from './SignIn';
import SignUp from './SignUp';
import PitchGraphic from './PitchGraphic';
import SoccerPitch from './SoccerPitch'; // Import the SoccerPitch component
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import './App.css';

const App = () => {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedSport, setSelectedSport] = useState('GAA'); // State for selected sport

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  const handleSportChange = (sport) => {
    setSelectedSport(sport);
  };

  const handleLogout = async () => {
    await signOut(getAuth());
    setUser(null);
  };

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="*" element={<Navigate replace to="/signin" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        <TopBar />
        <div className="main-container">
          <Sidebar onNavigate={handleNavigate} onLogout={handleLogout} onSportChange={handleSportChange} />
          <div className="content-area">
            {currentPage === 'home' && (
              selectedSport === 'GAA' ? <PitchGraphic /> : <SoccerPitch />
            )}
            {currentPage === 'saved-games' && <div>Saved Games Content</div>}
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;


