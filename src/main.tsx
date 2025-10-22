/**
 * @fileoverview The main entry point for the DocScribe application.
 * @module main
 * @description This file is responsible for initializing the React application,
 * rendering the root component (`App`), and attaching it to the DOM.
 * It sets up React's StrictMode for development-time checks.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Fatal Error: The element with ID 'root' was not found in the document. The application cannot be mounted.");
}

/**
 * Initializes and renders the React application.
 * 
 * This function uses React 18's `createRoot` API to render the main `App` component
 * into the DOM element with the ID 'root'. The application is wrapped
 * in `<StrictMode>` to highlight potential problems during development.
 */
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
