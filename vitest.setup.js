import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Path2D for tests (missing in jsdom)
global.Path2D = class Path2D {
    constructor() { }
    addPath() { }
    closePath() { }
    moveTo() { }
    lineTo() { }
    bezierCurveTo() { }
    quadraticCurveTo() { }
    arc() { }
    aps() { }
    rect() { }
};

// Mock matchMedia for tests (missing in jsdom)
// Simplified assignment
window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
}));
