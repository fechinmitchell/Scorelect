import React, { useState, useEffect, useContext } from 'react';
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
import Profile from './Profile';
import HowTo from './HowTo';
import SavedGames from './SavedGames';
import Success from './Success';
import Cancel from './Cancel';
import Analysis from './Analysis';
import SoccerFilterPage from './components/SoccerFilterPage';
import SoccerAnalysisDashboard from './components/SoccerAnalysisDashboard';
import HeatmapPage from './pages/HeatmapPage';
import HeatmapGAA from './pages/HeatmapGAA';
import HeatmapAF from './pages/HeatMapAF';
import BballCollect from './blogs/BballCollect';
import SoccerCollect from './blogs/SoccerCollect';
import GAACollect from './blogs/GAACollect';
import AmericanFootballCollect from './blogs/AmericanFootballCollect';
import HeatmapBBall from './pages/HeatmapBBall';
import { ToastContainer, toast } from 'react-toastify';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { GameContext } from './GameContext';
import SportsDataHub from './SportsDataHub';
import PublishDataset from './PublishDataset';
import { SavedGamesProvider } from './components/SavedGamesContext';
import { SportsDataHubProvider } from './components/SportsDataHubContext';
import Training from './Training';
import SportSelectionPage from './SportSelectionPage';
import PlayerDataGAA from './PlayerDataGAA';
import ErrorBoundary from './components/ErrorBoundary';
import PlayerShotDataGAA from './components/PlayerShotDataGAA';
import TeamDataGAA from './TeamDataGAA';
import TeamDetails from './components/TeamDetails';
import AnalysisGAA from './AnalysisGAA';
import GAAAnalysisDashboard from './components/GAAAnalysisDashboard';
import AdminLogin from './AdminLogin';
import AdminSettings from './AdminSettings';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const App = () => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('free');
  const navigate = useNavigate();
  const { loadedCoords, setLoadedCoords } = useContext(GameContext);

  // Initialize selectedSport from localStorage or default to null
  const [selectedSport, setSelectedSport] = useState(() => {
    return localStorage.getItem('selectedSport') || null;
  });

  // Firebase auth listener to update user and role
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

  useEffect(() => {
    if (selectedSport) {
      localStorage.setItem('selectedSport', selectedSport);
    } else {
      localStorage.removeItem('selectedSport');
    }
  }, [selectedSport]);

  const loadGame = (sport, gameData) => {
    setSelectedSport(sport);
    setLoadedCoords(gameData);
    navigate('/');
  };

  const handleSportChange = (sport) => {
    setSelectedSport(sport);
    setLoadedCoords([]);
    navigate('/');
  };

  const handleNavigate = (path) => {
    if (path === '/') {
      setLoadedCoords([]);
    }
    navigate(path);
  };

  const handleLogout = async () => {
    const auth = getAuth();
    if (auth.currentUser) {
      await signOut(auth);
      setUser(null);
      setUserRole('free');
      toast.success('Successfully logged out');
      setLoadedCoords([]);
      navigate('/signin');
    } else {
      toast.error('You are not logged in. Please sign in.');
      navigate('/signin');
    }
    setSelectedSport(null);
    localStorage.removeItem('selectedSport');
  };

  // Render the pitch or sport view based on selectedSport
  const renderSelectedSport = () => {
    if (!selectedSport) return <Navigate replace to="/select-sport" />;
    switch (selectedSport) {
      case 'GAA':
        return <PitchGraphic userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />;
      case 'Soccer':
        return <SoccerPitch userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />;
      case 'Basketball':
        return <BasketballCourt userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />;
      case 'AmericanFootball':
        return <AmericanFootballPitch userType={userRole} userId={user?.uid} apiUrl={API_BASE_URL} />;
      default:
        return <Navigate replace to="/select-sport" />;
    }
  };

  return (
    <SavedGamesProvider>
      <SportsDataHubProvider>
        <div className="app">
          <ToastContainer />
          <div className="main-container">
            {selectedSport && (
              <Sidebar
                onLogout={handleLogout}
                onSportChange={handleSportChange}
                onNavigate={handleNavigate}
                userType={userRole}
                user={user}
                selectedSport={selectedSport}
              />
            )}
            <div className="content-area">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={renderSelectedSport()} />
                  <Route path="/select-sport" element={<SportSelectionPage onSportSelect={handleSportChange} />} />
                  <Route path="/upgrade" element={<Upgrade setUserRole={setUserRole} />} />
                  <Route path="/saved-games" element={<SavedGames userType={userRole} onLoadGame={loadGame} selectedSport={selectedSport} />} />
                  <Route path="/profile" element={user ? <Profile onLogout={handleLogout} apiUrl={API_BASE_URL} /> : <Navigate replace to="/signin" />} />
                  <Route path="/signin" element={<SignIn apiUrl={API_BASE_URL} />} />
                  <Route path="/signup" element={<SignUp apiUrl={API_BASE_URL} />} />
                  <Route path="/success" element={<Success setUserRole={setUserRole} />} />
                  <Route path="/cancel" element={<Cancel />} />
                  <Route path="/howto" element={<HowTo />} />
                  <Route path="/sports-datahub" element={<SportsDataHub />} />
                  <Route path="/publish-dataset" element={<PublishDataset />} />
                  <Route path="/training/*" element={<Training selectedSport={selectedSport} onSportChange={handleSportChange} />} />
                  <Route path="/analysis" element={<Analysis onSportSelect={(sport) => setSelectedSport(sport)} selectedSport={selectedSport} />} />
                  <Route path="/analysis-gaa" element={<AnalysisGAA onSportSelect={(sport) => setSelectedSport(sport)} selectedSport={selectedSport} />} />
                  <Route path="/analysis/gaa-dashboard" element={<GAAAnalysisDashboard />} />
                  <Route path="/analysis/soccer-filter" element={<SoccerFilterPage />} />
                  <Route path="/analysis/soccer-dashboard" element={<SoccerAnalysisDashboard />} />
                  <Route path="/player-data-gaa" element={<PlayerDataGAA />} />
                  <Route path="/player/:playerName" element={<PlayerShotDataGAA />} />
                  <Route path="/analysis/heatmap" element={<HeatmapPage />} />
                  <Route path="/analysis/heatmap-gaa" element={<HeatmapGAA />} />
                  <Route path="/analysis/heatmap-af" element={<HeatmapAF />} />
                  <Route path="/analysis/heatmap-bball" element={<HeatmapBBall />} />
                  <Route path="/blog/basketball-statistics" element={<BballCollect />} />
                  <Route path="/blog/soccercollect" element={<SoccerCollect />} />
                  <Route path="/blog/gaacollect" element={<GAACollect />} />
                  <Route path="/blog/americanfootballCollect" element={<AmericanFootballCollect />} />
                  <Route path="/team/:teamName" element={<TeamDetails />} />
                  <Route path="/team-data-gaa" element={<TeamDataGAA />} />
                  {/* New Admin Routes */}
                  <Route path="/admin-login" element={<AdminLogin />} />
                  <Route path="/admin-settings" element={<AdminSettings />} />
                  <Route path="*" element={<Navigate replace to="/select-sport" />} />
                </Routes>
              </ErrorBoundary>
              <Analytics />
              <SpeedInsights />
            </div>
          </div>
        </div>
      </SportsDataHubProvider>
    </SavedGamesProvider>
  );
};

export default App;
