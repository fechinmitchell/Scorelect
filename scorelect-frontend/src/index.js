// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import StripeSetup from './StripeSetup';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <StripeSetup>
        <App />
      </StripeSetup>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();

 










