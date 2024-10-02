// src/App.js

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { firestore } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import SignIn from './SignIn';
import SignUp from './SignUp';
import PitchGraphic from './PitchGraphic';
import SoccerPitch from './SoccerPitch';
import BasketballCourt from './BasketballCourt';
import AmericanFootballPitch from './AmericanFootballPitch';
import Sidebar from './Sidebar';
import Upgrade from './Upgrade';
import Profile from './Profile'
import HowTo from './HowTo';
import SavedGames from './SavedGames';
import Success from './Success';
import Cancel from './Cancel';
import Analysis from './Analysis';
import FilterPage from './pages/FilterPage';
import HeatmapPage from './pages/HeatmapPage';
import HeatmapGAA from './pages/HeatmapGAA';
import HeatmapAF from './pages/HeatMapAF';
import HeatmapBBall from './pages/HeatmapBBall'; // <-- Added import for HeatmapBBall
import { ToastContainer, toast } from 'react-toastify';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const App = () => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('free');
  const [selectedSport, setSelectedSport] = useState('Soccer'); // Default sport
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role || 'free');
        } else {
          await setDoc(userDocRef, { role: 'free', email: currentUser.email });
          setUserRole('free');
        }
      } else {
        setUserRole('free');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSportChange = (sport) => {
    setSelectedSport(sport);
    navigate('/'); // Navigate to root path to display selected sport
  };

  const handleLogout = async () => {
    const auth = getAuth();
    if (auth.currentUser) {
      await signOut(auth);
      setUser(null);
      setUserRole('free');
      toast.success('Successfully logged out');
      navigate('/signin');
    } else {
      toast.error('You are not logged in. Please sign in.');
      navigate('/signin');
    }
  };

  const handleNavigate = (path) => {
    navigate(path);
  };

  // Function to render the selected sport's component
  const renderSelectedSport = () => {
    switch (selectedSport) {
      case 'GAA':
        return <PitchGraphic userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />;
      case 'Soccer':
        return <SoccerPitch userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />;
      case 'Basketball':
        return <BasketballCourt userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />;
      case 'AmericanFootball':
        return (
          <AmericanFootballPitch
            userType={userRole}
            userId={user?.uid}
            apiUrl={API_BASE_URL}
          />
        );
      default:
        return <Navigate replace to="/" />; // Fallback to root if sport is unrecognized
    }
  };

  return (
    <div className="app">
      <ToastContainer />
      <div className="main-container">
        <Sidebar
          onLogout={handleLogout}
          onSportChange={handleSportChange}
          onNavigate={handleNavigate}
          userType={userRole}
          user={user}
        />
        <div className="content-area">
          <Routes>
            <Route path="/" element={renderSelectedSport()} />
            <Route path="/upgrade" element={<Upgrade setUserRole={setUserRole} />} />
            <Route
              path="/saved-games"
              element={<SavedGames userType={userRole} apiUrl={API_BASE_URL} />}
            />
            <Route
              path="/profile"
              element={
                user ? (
                  <Profile onLogout={handleLogout} apiUrl={API_BASE_URL} />
                ) : (
                  <Navigate replace to="/signin" />
                )
              }
            />
            <Route path="/signin" element={<SignIn apiUrl={API_BASE_URL} />} />
            <Route path="/signup" element={<SignUp apiUrl={API_BASE_URL} />} />
            <Route path="/success" element={<Success setUserRole={setUserRole} />} />
            <Route path="/cancel" element={<Cancel />} />
            <Route path="/howto" element={<HowTo />} />
            <Route
              path="/analysis"
              element={<Analysis onSportSelect={(sport) => setSelectedSport(sport)} />}
            />
            <Route path="/analysis/filter" element={<FilterPage />} />
            <Route path="/analysis/heatmap" element={<HeatmapPage />} />
            <Route path="/analysis/heatmap-gaa" element={<HeatmapGAA />} />
            <Route path="/analysis/heatmap-af" element={<HeatmapAF />} />
            <Route path="/analysis/heatmap-bball" element={<HeatmapBBall />} /> {/* <-- Added Route */}
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
          <Analytics />
          <SpeedInsights />
        </div>
      </div>
    </div>
  );
};

export default App;
