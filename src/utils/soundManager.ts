/**
 * Sound Manager for Alert Notifications
 * Handles playing alert sounds with proper browser compatibility
 */

// Types
export type SoundType = 'default' | 'success' | 'warning' | 'double';
export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface SoundSettings {
    enabled: boolean;
    volume: number;
    soundType: SoundType;
}

// Extend Window interface for webkit AudioContext
declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

// Settings stored in localStorage
const SETTINGS_KEY = 'tv_alert_sound_settings';

// Default settings
const DEFAULT_SETTINGS: SoundSettings = {
    enabled: true,
    volume: 0.7,
    soundType: 'default',
};

/**
 * Get sound settings from localStorage
 */
export const getSoundSettings = (): SoundSettings => {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            return JSON.parse(saved) as SoundSettings;
        }
    } catch (e) {
        console.warn('[SoundManager] Error reading settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
};

/**
 * Save sound settings to localStorage
 */
export const saveSoundSettings = (settings: SoundSettings): void => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('[SoundManager] Error saving settings:', e);
    }
};

/**
 * Create a simple beep sound using Web Audio API
 */
const createBeepSound = (
    frequency: number = 800,
    duration: number = 200,
    type: OscillatorType = 'sine'
): () => void => {
    return (): void => {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = type;

            const settings = getSoundSettings();
            gainNode.gain.value = settings.volume;

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration / 1000);

            // Cleanup
            oscillator.onended = (): void => {
                oscillator.disconnect();
                gainNode.disconnect();
                audioContext.close();
            };
        } catch (error) {
            console.warn('[SoundManager] Audio playback failed:', error);
        }
    };
};

// Initialize sound generators
const soundGenerators: Record<SoundType, () => void> = {
    default: createBeepSound(800, 200, 'sine'),
    success: createBeepSound(1000, 150, 'sine'),
    warning: createBeepSound(600, 300, 'triangle'),
    double: (): void => {
        createBeepSound(800, 100)();
        setTimeout(() => createBeepSound(1000, 100)(), 150);
    },
};

/**
 * Play an alert sound
 * @param type - Sound type: 'default', 'success', 'warning', 'double'
 * @returns Whether sound was played
 */
export const playAlertSound = (type: SoundType = 'default'): boolean => {
    const settings = getSoundSettings();

    if (!settings.enabled) {
        return false;
    }

    const generator = soundGenerators[type] || soundGenerators.default;

    try {
        generator();
        return true;
    } catch (error) {
        console.warn('[SoundManager] Failed to play sound:', error);
        return false;
    }
};

/**
 * Test sound playback (for settings UI)
 */
export const testSound = (): void => {
    const settings = getSoundSettings();
    const originalEnabled = settings.enabled;

    // Temporarily enable sound for test
    settings.enabled = true;
    saveSoundSettings(settings);

    playAlertSound('double');

    // Restore original setting
    settings.enabled = originalEnabled;
    saveSoundSettings(settings);
};

/**
 * Set sound enabled/disabled
 */
export const setSoundEnabled = (enabled: boolean): void => {
    const settings = getSoundSettings();
    settings.enabled = enabled;
    saveSoundSettings(settings);
};

/**
 * Set sound volume (0-1)
 */
export const setSoundVolume = (volume: number): void => {
    const settings = getSoundSettings();
    settings.volume = Math.max(0, Math.min(1, volume));
    saveSoundSettings(settings);
};

export default {
    playAlertSound,
    testSound,
    getSoundSettings,
    saveSoundSettings,
    setSoundEnabled,
    setSoundVolume,
};
