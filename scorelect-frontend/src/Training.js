// src/Training.js
import React, { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Schedule from './Schedule';
import Sessions from './Sessions';
import Players from './Players';
import './Training.css';

const Training = () => {
  const [activeSection, setActiveSection] = useState('schedule');

  return (
    <div className="training-page">
      <div className="navbar">
        <Link to="/training/schedule" className="nav-button">Schedule</Link>
        <Link to="/training/sessions" className="nav-button">Sessions</Link>
        <Link to="/training/players" className="nav-button">Players</Link>
      </div>
      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/training/schedule" replace />} />
          <Route path="/training/schedule" element={<Schedule />} />
          <Route path="/training/sessions" element={<Sessions />} />
          <Route path="/training/players" element={<Players />} />
        </Routes>
      </div>
    </div>
  );
};

export default Training;
