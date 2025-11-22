import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App'; // Import your main application component

// Find the root element where the React app will be mounted
const container = document.getElementById('root');
const root = createRoot(container);

// Render the main App component
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);