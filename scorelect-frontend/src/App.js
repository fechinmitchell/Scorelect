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
import AmericanFootballPitch from './AmericanFootballPitch'; // Import AmericanFootballPitch
import Sidebar from './Sidebar';
import Upgrade from './Upgrade';
import Profile from './Profile';
import SavedGames from './SavedGames';
import Success from './Success'; // Import Success component
import Cancel from './Cancel'; // Import Cancel component
import { ToastContainer, toast } from 'react-toastify';
import { Analytics } from '@vercel/analytics/react';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const App = () => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('free');
  const [selectedSport, setSelectedSport] = useState('Soccer');
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role || 'free');
        } else {
          await setDoc(doc(firestore, 'users', user.uid), { role: 'free' });
          setUserRole('free');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSportChange = (sport) => {
    setSelectedSport(sport);
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
            <Route path="/" element={
              selectedSport === 'GAA' ? <PitchGraphic userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} /> :
              selectedSport === 'Soccer' ? <SoccerPitch userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} /> :
              selectedSport === 'Basketball' ? <BasketballCourt userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} /> :
              selectedSport === 'AmericanFootball' ? <AmericanFootballPitch userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} /> :
              <Navigate replace to="/" />
            } />
            <Route path="/upgrade" element={<Upgrade setUserRole={setUserRole} />} />
            <Route path="/saved-games" element={<SavedGames userType={userRole} apiUrl={API_BASE_URL} />} />
            <Route path="/profile" element={user ? <Profile onLogout={handleLogout} apiUrl={API_BASE_URL} /> : <Navigate replace to="/signin" />} />
            <Route path="/signin" element={<SignIn apiUrl={API_BASE_URL} />} />
            <Route path="/signup" element={<SignUp apiUrl={API_BASE_URL} />} />
            <Route path="/gaa" element={<PitchGraphic userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />} />
            <Route path="/soccer" element={<SoccerPitch userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />} />
            <Route path="/basketball" element={<BasketballCourt userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />} />
            <Route path="/americanfootball" element={<AmericanFootballPitch userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />} />
            <Route path="/success" element={<Success setUserRole={setUserRole} />} />
            <Route path="/cancel" element={<Cancel />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
          <Analytics /> {/* Add the Analytics component here */}
        </div>
      </div>
    </div>
  );
};

export default App;
