import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';
import { UIProvider } from './context/UIContext';
import { ToolProvider } from './context/ToolContext';
import { WatchlistProvider } from './context/WatchlistContext';

// Apply theme immediately to prevent flash of default theme
// This runs synchronously BEFORE React renders anything
const savedTheme = localStorage.getItem('tv_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Suppress known browser extension errors that pollute the console
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  // Chrome Extension Messaging API error
  // Occurs when an extension content script throws an error or fails to handle a message
  if (event.reason && (event.reason as Error).message &&
    (event.reason as Error).message.includes('message channel closed before a response was received')) {
    event.preventDefault(); // Stop the error from being printed to console
    console.debug('[External] Suppressed browser extension error:', (event.reason as Error).message);
  }
});

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <UserProvider>
          <ThemeProvider>
            <UIProvider>
              <ToolProvider>
                <WatchlistProvider>
                  <App />
                </WatchlistProvider>
              </ToolProvider>
            </UIProvider>
          </ThemeProvider>
        </UserProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
