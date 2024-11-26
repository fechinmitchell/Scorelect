// src/Training.js
import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Schedule from './Schedule';
import Sessions from './Sessions';
import Players from './Players';
import './Training.css';

const Training = () => {
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
      </div>
      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to="schedule" replace />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="players" element={<Players />} />
        </Routes>
      </div>
    </div>
  );
};

export default Training;
