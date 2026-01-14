import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for option chain filter/add-on state management
 */
export function useOptionFilters() {
    // Add-ons visibility state
    const [showOI, setShowOI] = useState(true);
    const [showOIBars, setShowOIBars] = useState(true);
    const [showPremium, setShowPremium] = useState(true);
    const [showDelta, setShowDelta] = useState(true);
    const [showIV, setShowIV] = useState(false);
    const [addOnsOpen, setAddOnsOpen] = useState(false);
    const addOnsRef = useRef(null);

    // Configurable strike count (persisted in localStorage)
    const [strikeCount, setStrikeCount] = useState(() => {
        const saved = localStorage.getItem('optionChainStrikeCount');
        return saved ? parseInt(saved, 10) : 15;
    });
    const STRIKE_COUNT_OPTIONS = [10, 15, 20, 25, 30, 50];

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (addOnsRef.current && !addOnsRef.current.contains(e.target)) {
                setAddOnsOpen(false);
            }
        };
        if (addOnsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [addOnsOpen]);

    // Handle strike count change with persistence
    const handleStrikeCountChange = (val) => {
        setStrikeCount(val);
        localStorage.setItem('optionChainStrikeCount', val.toString());
    };

    return {
        // Filter states
        showOI,
        setShowOI,
        showOIBars,
        setShowOIBars,
        showPremium,
        setShowPremium,
        showDelta,
        setShowDelta,
        showIV,
        setShowIV,

        // Add-ons dropdown
        addOnsOpen,
        setAddOnsOpen,
        addOnsRef,

        // Strike count
        strikeCount,
        setStrikeCount: handleStrikeCountChange,
        STRIKE_COUNT_OPTIONS,
    };
}

export default useOptionFilters;
