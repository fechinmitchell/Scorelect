import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { FaChartLine, FaShieldAlt, FaChessBoard, FaRunning, FaExchangeAlt, FaSyncAlt } from 'react-icons/fa';
import { useAuth } from '../AuthContext';
import Swal from 'sweetalert2';
import Attacking from './AIGAAAttacking';
import Defending from './AIGAADefending';
import Tactics from './AIGAATactics';
import FitnessAndStamina from './AIGAAFitnessAndStamina';
import HeadToHead from './AIGAAHeadToHead';
import './AIGAADashboard.css';

const AIGAADashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state;
  const { currentUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [datasetName, setDatasetName] = useState('');
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Check if state and state.file exist
    if (!state || !state.file || state.sport !== 'GAA') {
      Swal.fire({
        title: 'No Data',
        text: 'Invalid or no GAA dataset found.',
        icon: 'error',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
      }).then(() => navigate('/analysis'));
      return;
    }

    // Set dataset name and initialize availableDatasets with state.file
    setDatasetName(state.file?.datasetName || 'Unknown Dataset');
    setAvailableDatasets([state.file]); // Use state.file as the only dataset
    setIsLoading(false);
  }, [state, navigate]);

  useEffect(() => {
    // Redirect to /attacking if at root /ai-dashboard
    if (location.pathname === '/ai-dashboard' || location.pathname === '/ai-dashboard/') {
      navigate('attacking', { replace: true, state });
    }
  }, [location.pathname, navigate, state]);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => {
      Swal.fire({
        title: 'Data Refreshed',
        text: 'Dashboard data has been updated.',
        icon: 'success',
        background: 'var(--dark-card)',
        confirmButtonColor: 'var(--primary)',
        timer: 2000,
        showConfirmButton: false,
      });
      setIsLoading(false);
    }, 1000);
  };

  if (!state || !state.file) {
    return <Navigate replace to="/analysis" />;
  }

  if (isLoading) {
    return (
      <div className="ai-dashboard-loading">
        <div className="ai-dashboard-spinner" />
        <p>Loading AI Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="ai-dashboard-container">
      <div className="ai-dashboard-header">
        <div className="ai-dashboard-title">
          <h1>AI-Powered GAA Analysis Dashboard</h1>
          <p className="ai-dashboard-subtitle">Premium Analytics for {datasetName}</p>
        </div>
        <button className="ai-dashboard-refresh-btn" onClick={handleRefresh} title="Refresh Data">
          <FaSyncAlt />
        </button>
      </div>

      <div className="ai-dashboard-nav">
        <NavLink to="attacking" className={({ isActive }) => (isActive ? 'ai-nav-item aktif' : 'ai-nav-item')}>
          <FaChartLine />
          <span>Attacking</span>
        </NavLink>
        <NavLink to="defending" className={({ isActive }) => (isActive ? 'ai-nav-item active' : 'ai-nav-item')}>
          <FaShieldAlt />
          <span>Defending</span>
        </NavLink>
        <NavLink to="tactics" className={({ isActive }) => (isActive ? 'ai-nav-item active' : 'ai-nav-item')}>
          <FaChessBoard />
          <span>Tactics</span>
        </NavLink>
        <NavLink to="fitness" className={({ isActive }) => (isActive ? 'ai-nav-item active' : 'ai-nav-item')}>
          <FaRunning />
          <span>Fitness & Stamina</span>
        </NavLink>
        <NavLink to="head-to-head" className={({ isActive }) => (isActive ? 'ai-nav-item active' : 'ai-nav-item')}>
          <FaExchangeAlt />
          <span>Head-to-Head</span>
        </NavLink>
      </div>

      <div className="ai-dashboard-content">
        <Routes>
          <Route path="attacking" element={<Attacking data={state.file} refreshKey={refreshKey} datasets={availableDatasets} />} />
          <Route path="defending" element={<Defending data={state.file} refreshKey={refreshKey} datasets={availableDatasets} />} />
          <Route path="tactics" element={<Tactics data={state.file} refreshKey={refreshKey} datasets={availableDatasets} />} />
          <Route path="fitness" element={<FitnessAndStamina data={state.file} refreshKey={refreshKey} datasets={availableDatasets} />} />
          <Route path="head-to-head" element={<HeadToHead data={state.file} refreshKey={refreshKey} datasets={availableDatasets} />} />
          <Route path="*" element={<Navigate replace to="attacking" />} />
        </Routes>
      </div>

      <div className="ai-dashboard-footer">
        <p>AI-Powered Premium Analytics by Scorelect</p>
        <p className="ai-dashboard-version">v1.0.0</p>
      </div>
    </div>
  );
};

export default AIGAADashboard;