import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// For Chrome Extension injection:
// Dynamically check if our custom extension root container exists.
// If it doesn't exist, create it and append it directly to document.body.
let rootContainer = document.getElementById('snakey-extension-root');
if (!rootContainer) {
  rootContainer = document.createElement('div');
  rootContainer.id = 'snakey-extension-root';
  document.body.appendChild(rootContainer);
}

createRoot(rootContainer).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
