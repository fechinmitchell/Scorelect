// src/Training.js
import React from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import Schedule from './Schedule';
import Sessions from './Sessions';
import Players from './Players';
import MatchDay from './MatchDay';
import './Training.css';

const Training = ({ selectedSport, onSportChange }) => {
  const location = useLocation();

  return (
    <div className="training-page">
      <div className="navbar">
        <NavLink
          to="schedule"
          className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`}
        >
          Schedule
        </NavLink>
        <NavLink
          to="sessions"
          className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`}
        >
          Sessions
        </NavLink>
        <NavLink
          to="players"
          className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`}
        >
          Players
        </NavLink>
        <NavLink
          to="matchday"
          className={({ isActive }) => `nav-button${isActive ? ' active' : ''}`}
        >
          Match Day
        </NavLink>
      </div>
      <div className="training-content">
        <Routes>
          <Route path="/" element={<Navigate to="schedule" replace />} />
          <Route path="schedule" element={<Schedule />} />
          {/* Pass selectedSport and onSportChange to Sessions */}
          <Route
            path="sessions"
            element={
              <Sessions
                selectedSport={selectedSport}
                onSportChange={onSportChange}
              />
            }
          />
          {/* Pass the selectedSport as state to the Players component */}
          <Route 
            path="players" 
            element={
              <Players 
                // Pass the sport parameter directly
                sport={selectedSport}
                // Also pass it as state in case URL params are not accessible
                state={{ sport: selectedSport }}
              />
            }
          />
          <Route path="matchday" element={<MatchDay />} />
        </Routes>
      </div>
    </div>
  );
};

export default Training;