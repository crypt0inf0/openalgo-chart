import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';

// Mock child components to isolate App testing
vi.mock('./components/Layout/Layout', () => ({
    default: () => <div data-testid="mock-layout">Layout</div>
}));

// Mock services
vi.mock('./services/openalgo', () => ({
    checkAuth: vi.fn().mockResolvedValue(true),
    // Add other mocked exports if needed by App
}));

vi.mock('./hooks/useCloudWorkspaceSync', () => ({
    useCloudWorkspaceSync: () => ({ isLoaded: true, syncKey: 1 })
}));

describe('App Component', () => {
    it('renders without crashing', () => {
        const { container } = render(
            <UserProvider>
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </UserProvider>
        );
        expect(container).toBeDefined();
    });
});
