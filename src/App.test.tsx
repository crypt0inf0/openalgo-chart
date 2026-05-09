import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';

// Mock child components to isolate App testing
vi.mock('./components/Layout/Layout', () => ({
    default: () => <div data-testid="mock-layout">Layout</div>
}));

// Mock services
vi.mock('./services/openalgo', () => ({
    checkAuth: vi.fn().mockResolvedValue(true),
    closeAllWebSockets: vi.fn(),
    forceCloseAllWebSockets: vi.fn(),
    getTickerPrice: vi.fn().mockResolvedValue(null),
    subscribeToMultiTicker: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    saveUserPreferences: vi.fn(),
    modifyOrder: vi.fn(),
    cancelOrder: vi.fn(),
    getKlines: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('./hooks/useCloudWorkspaceSync', () => ({
    useCloudWorkspaceSync: () => ({ isLoaded: true, isSyncing: false })
}));

describe('App Component', () => {
    it('renders without crashing', () => {
        const { container } = render(
            <UserProvider>
                <ThemeProvider>
                    <UIProvider>
                        <App />
                    </UIProvider>
                </ThemeProvider>
            </UserProvider>
        );
        expect(container).toBeDefined();
    });
});
