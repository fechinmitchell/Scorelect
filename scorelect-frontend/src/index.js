// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import StripeSetup from './StripeSetup';
import { Analytics } from '@vercel/analytics/react';
import Modal from 'react-modal'; // Import react-modal
import { GameProvider } from './GameContext'; // Import GameProvider
import { UserProvider } from './UserContext'; // Import UserProvider
import { AuthProvider } from './AuthContext'; // Import AuthProvider

// Set the app element for react-modal
Modal.setAppElement('#root'); // Ensure '#root' matches your HTML root element

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <StripeSetup> 
        <AuthProvider> {/* Wrap with AuthProvider */}
          <UserProvider> {/* Wrap with UserProvider */}
            <GameProvider> {/* Nested GameProvider */}
              <App />
              <Analytics />
            </GameProvider>
          </UserProvider>
        </AuthProvider>
      </StripeSetup>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
