import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { UserProvider } from './context/UserContext.jsx'

// Apply theme immediately to prevent flash of default theme
// This runs synchronously BEFORE React renders anything
const savedTheme = localStorage.getItem('tv_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Suppress known browser extension errors that pollute the console
window.addEventListener('unhandledrejection', (event) => {
  // Chrome Extension Messaging API error
  // Occurs when an extension content script throws an error or fails to handle a message
  if (event.reason && event.reason.message &&
    event.reason.message.includes('message channel closed before a response was received')) {
    event.preventDefault(); // Stop the error from being printed to console
    console.debug('[External] Suppressed browser extension error:', event.reason.message);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <UserProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </UserProvider>
    </ErrorBoundary>
  </StrictMode>,
)
