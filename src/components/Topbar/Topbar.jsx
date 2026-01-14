import React, { useState, useEffect, useRef } from 'react';
import styles from './Topbar.module.css';
import classNames from 'classnames';
import { intervalToSeconds } from '../../utils/timeframes';
import { getIntervals } from '../../services/openalgo';
import { logger } from '../../utils/logger.js';
import Tooltip from '../Tooltip/Tooltip';
import {
    Plus, Star, Trash2, X, AlertCircle, Loader2, Layout as LayoutIcon, BarChart3, Bookmark
} from 'lucide-react';

// Import extracted components (ready for future use)
// import { IndicatorDropdown, SnapshotMenu, LayoutDropdown } from './components';


const Topbar = ({
    symbol, interval, chartType, indicators, favoriteIntervals, customIntervals,
    lastNonFavoriteInterval,
    onSymbolClick, onIntervalChange, onChartTypeChange, onToggleIndicator,
    onToggleFavorite, onAddCustomInterval, onRemoveCustomInterval,
    onUndo, onRedo, onMenuClick, theme, onToggleTheme,
    onDownloadImage, onCopyImage, onFullScreen,
    layout, onLayoutChange, onSaveLayout, onAlertClick, onCompareClick, onReplayClick,
    isReplayMode = false, onSettingsClick, onTemplatesClick, onChartTemplatesClick,
    onStraddleClick, strategyConfig = null,
    onOptionsClick, onHeatmapClick, onAddIndicator
}) => {

    const [showIndicators, setShowIndicators] = useState(false);
    const [showTimeframes, setShowTimeframes] = useState(false);
    const [showChartTypes, setShowChartTypes] = useState(false);
    const [showSnapshotMenu, setShowSnapshotMenu] = useState(false);
    const [showLayoutMenu, setShowLayoutMenu] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customValue, setCustomValue] = useState('1');
    const [customUnit, setCustomUnit] = useState('m');

    // Broker-supported intervals state
    const [brokerIntervals, setBrokerIntervals] = useState(null);
    const [intervalsLoading, setIntervalsLoading] = useState(true);
    const [intervalsError, setIntervalsError] = useState(null);

    // State for section expansion in dropdown
    const [expandedSections, setExpandedSections] = useState({
        Ticks: true,
        Seconds: true,
        Minutes: true,
        Hours: true,
        Days: true,
        Custom: true
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Refs for click-outside detection
    const timeframeRef = useRef(null);
    const chartTypeRef = useRef(null);
    const indicatorRef = useRef(null);
    const snapshotRef = useRef(null);
    const layoutRef = useRef(null);

    // Helper to get full name for tooltip
    const getFullTimeframeName = (value) => {
        const fullNames = {
            '1': '1 tick', '10': '10 ticks', '100': '100 ticks', '1000': '1000 ticks',
            '1s': '1 second', '5s': '5 seconds', '10s': '10 seconds', '15s': '15 seconds', '30s': '30 seconds', '45s': '45 seconds',
            '1m': '1 minute', '2m': '2 minutes', '3m': '3 minutes', '5m': '5 minutes', '10m': '10 minutes', '15m': '15 minutes', '30m': '30 minutes', '45m': '45 minutes',
            '1h': '1 hour', '2h': '2 hours', '3h': '3 hours', '4h': '4 hours',
            '1d': '1 day', '1w': '1 week', '1M': '1 month', '3M': '3 months', '6M': '6 months', '12M': '12 months'
        };
        return fullNames[value] || value;
    };

    // Helper to get short display label
    const getShortLabel = (value) => {
        const shortLabels = {
            '1d': 'D', '1w': 'W', '1M': 'M'
        };
        return shortLabels[value] || value;
    };

    const chartTypes = [
        {
            value: 'candlestick',
            label: 'Candles',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="currentColor"><path d="M17 11v6h3v-6h-3zm-.5-1h4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5z"></path><path d="M18 7h1v3.5h-1zm0 10.5h1V21h-1z"></path><path d="M9 8v12h3V8H9zm-.5-1h4a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5z"></path><path d="M10 4h1v3.5h-1zm0 16.5h1V24h-1z"></path></svg>
        },
        {
            value: 'bar',
            label: 'Bars',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M19 6h-1v7h-3v1h3v8h1v-3h3v-1h-3V6ZM11 7h-1v13H7v1h3v2h1V10h3V9h-3V7Z"></path></svg>
        },
        {
            value: 'hollow-candlestick',
            label: 'Hollow candles',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="currentColor"><path d="M17 11v6h3v-6h-3zm-.5-1h4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5z"></path><path d="M18 7h1v3.5h-1zm0 10.5h1V21h-1z"></path><path d="M9 8v11h3V8H9zm-.5-1h4a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5z"></path><path d="M10 4h1v5h-1zm0 14h1v5h-1z"></path></svg>
        },
        {
            value: 'line',
            label: 'Line',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="m25.39 7.31-8.83 10.92-6.02-5.47-7.16 8.56-.76-.64 7.82-9.36 6 5.45L24.61 6.7l.78.62Z"></path></svg>
        },
        {
            value: 'area',
            label: 'Area',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" fillRule="evenodd" d="m25.35 5.35-9.5 9.5-.35.36-.35-.36-4.65-4.64-8.15 8.14-.7-.7 8.5-8.5.35-.36.35.36 4.65 4.64 9.15-9.14.7.7Z"></path></svg>
        },
        {
            value: 'baseline',
            label: 'Baseline',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="m10.49 7.55-.42.7-2.1 3.5.86.5 1.68-2.8 1.8 2.82.84-.54-2.23-3.5-.43-.68ZM3 14v1h1v-1H3Zm2 0h1v1H5v-1Zm2 0v1h1v-1H7Z"></path></svg>
        },
        {
            value: 'heikin-ashi',
            label: 'Heikin Ashi',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="currentColor"><path d="M9 8v12h3V8H9zm-1-.502C8 7.223 8.215 7 8.498 7h4.004c.275 0 .498.22.498.498v13.004a.493.493 0 0 1-.498.498H8.498A.496.496 0 0 1 8 20.502V7.498z"></path><path d="M10 4h1v3.5h-1z"></path></svg>
        },
        {
            value: 'renko',
            label: 'Renko',
            icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="currentColor"><path d="M4 18h5v5H4v-5zm5-5h5v5H9v-5zm5-5h5v5h-5V8zm5-5h5v5h-5V3z" /></svg>
        },
    ];

    const defaultTimeframes = [
        // Ticks
        { label: '1 tick', value: '1', type: 'Ticks' },
        { label: '10 ticks', value: '10', type: 'Ticks' },
        { label: '100 ticks', value: '100', type: 'Ticks' },
        { label: '1000 ticks', value: '1000', type: 'Ticks' },
        // Seconds
        { label: '1 second', value: '1s', type: 'Seconds' },
        { label: '5 seconds', value: '5s', type: 'Seconds' },
        { label: '10 seconds', value: '10s', type: 'Seconds' },
        { label: '15 seconds', value: '15s', type: 'Seconds' },
        { label: '30 seconds', value: '30s', type: 'Seconds' },
        { label: '45 seconds', value: '45s', type: 'Seconds' },
        // Minutes
        { label: '1 minute', value: '1m', type: 'Minutes' },
        { label: '2 minutes', value: '2m', type: 'Minutes' },
        { label: '3 minutes', value: '3m', type: 'Minutes' },
        { label: '5 minutes', value: '5m', type: 'Minutes' },
        { label: '10 minutes', value: '10m', type: 'Minutes' },
        { label: '15 minutes', value: '15m', type: 'Minutes' },
        { label: '30 minutes', value: '30m', type: 'Minutes' },
        { label: '45 minutes', value: '45m', type: 'Minutes' },
        // Hours
        { label: '1 hour', value: '1h', type: 'Hours' },
        { label: '2 hours', value: '2h', type: 'Hours' },
        { label: '3 hours', value: '3h', type: 'Hours' },
        { label: '4 hours', value: '4h', type: 'Hours' },
        // Days/Weeks/Months
        { label: '1 day', value: '1d', type: 'Days' },
        { label: '1 week', value: '1w', type: 'Days' },
        { label: '1 month', value: '1M', type: 'Days' },
    ];

    // Fetch broker-supported intervals on mount
    useEffect(() => {
        let mounted = true;
        const fetchIntervals = async () => {
            try {
                setIntervalsLoading(true);
                setIntervalsError(null);
                const data = await getIntervals();

                if (!mounted) return;

                if (data) {
                    // Flatten the categorized intervals into a Set for quick lookup
                    // API format: { seconds: ['5s', '10s'], minutes: ['1m', '5m'], hours: ['1h'], days: ['D'], weeks: ['W'], months: ['M'] }
                    const supported = new Set();

                    if (data.seconds) data.seconds.forEach(v => supported.add(v));
                    if (data.minutes) data.minutes.forEach(v => supported.add(v));
                    if (data.hours) data.hours.forEach(v => supported.add(v));
                    if (data.days) data.days.forEach(v => {
                        // API returns 'D' for daily, map to '1d'
                        supported.add(v === 'D' ? '1d' : v);
                    });
                    if (data.weeks) data.weeks.forEach(v => {
                        // API returns 'W' for weekly, map to '1w'
                        supported.add(v === 'W' ? '1w' : v);
                    });
                    if (data.months) data.months.forEach(v => {
                        // API returns 'M' for monthly, map to '1M'
                        supported.add(v === 'M' ? '1M' : v);
                    });

                    setBrokerIntervals(supported);
                    logger.debug('[Topbar] Broker supported intervals:', [...supported]);
                } else {
                    setIntervalsError('Could not fetch broker intervals');
                }
            } catch (error) {
                if (mounted) {
                    logger.error('Error fetching intervals:', error);
                    setIntervalsError('Failed to load intervals');
                }
            } finally {
                if (mounted) {
                    setIntervalsLoading(false);
                }
            }
        };

        fetchIntervals();
        return () => { mounted = false; };
    }, []);

    // Helper to check if an interval is supported by broker
    const isIntervalSupported = (value) => {
        // Always show custom intervals
        if (!brokerIntervals) return true; // Show all if no data yet
        // Ticks are not typically supported by OpenAlgo API
        if (/^\d+$/.test(value)) return false;
        return brokerIntervals.has(value);
    };

    // Filter default timeframes to only show broker-supported intervals
    const filteredTimeframes = brokerIntervals
        ? defaultTimeframes.filter(tf => isIntervalSupported(tf.value))
        : defaultTimeframes;

    // Merge filtered default and custom intervals
    const allTimeframes = [...filteredTimeframes, ...customIntervals.map(c => ({ ...c, type: 'Custom' }))];

    // Group timeframes
    const groupedTimeframes = {
        'Ticks': allTimeframes.filter(tf => tf.type === 'Ticks'),
        'Seconds': allTimeframes.filter(tf => tf.type === 'Seconds'),
        'Minutes': allTimeframes.filter(tf => tf.type === 'Minutes'),
        'Hours': allTimeframes.filter(tf => tf.type === 'Hours'),
        'Days': allTimeframes.filter(tf => tf.type === 'Days'),
        'Custom': allTimeframes.filter(tf => tf.type === 'Custom'),
    };

    const handleCustomSubmit = (e) => {
        e.preventDefault();
        onAddCustomInterval(customValue, customUnit);
        setShowCustomInput(false);
    };

    // State for dropdown positions
    const [timeframePos, setTimeframePos] = useState({ top: 0, left: 0 });
    const [chartTypePos, setChartTypePos] = useState({ top: 0, left: 0 });
    const [indicatorPos, setIndicatorPos] = useState({ top: 0, left: 0 });
    const [snapshotPos, setSnapshotPos] = useState({ top: 0, right: 0 });
    const [layoutPos, setLayoutPos] = useState({ top: 0, left: 0 });

    const calculatePosition = (ref) => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            return {
                top: rect.bottom + 4, // 4px gap
                left: rect.left
            };
        }
        return { top: 0, left: 0 };
    };

    const calculateSnapshotPosition = (ref) => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            // Calculate distance from right edge of viewport
            const right = window.innerWidth - rect.right;
            return {
                top: rect.bottom + 4,
                right: right
            };
        }
        return { top: 0, right: 0 };
    };

    const toggleTimeframes = () => {
        if (!showTimeframes) {
            setTimeframePos(calculatePosition(timeframeRef));
        }
        setShowTimeframes(!showTimeframes);
        setShowChartTypes(false);
        setShowIndicators(false);
    };

    const toggleChartTypes = () => {
        if (!showChartTypes) {
            setChartTypePos(calculatePosition(chartTypeRef));
        }
        setShowChartTypes(!showChartTypes);
        setShowTimeframes(false);
        setShowIndicators(false);
    };

    const toggleIndicators = () => {
        if (!showIndicators) {
            setIndicatorPos(calculatePosition(indicatorRef));
        }
        setShowIndicators(!showIndicators);
        setShowTimeframes(false);
        setShowChartTypes(false);
        setShowSnapshotMenu(false);
    };

    const toggleSnapshotMenu = () => {
        if (!showSnapshotMenu) {
            setSnapshotPos(calculateSnapshotPosition(snapshotRef));
        }
        setShowSnapshotMenu(!showSnapshotMenu);
        setShowTimeframes(false);
        setShowChartTypes(false);
        setShowIndicators(false);
    };

    const toggleLayoutMenu = () => {
        if (!showLayoutMenu) {
            setLayoutPos(calculatePosition(layoutRef));
        }
        setShowLayoutMenu(!showLayoutMenu);
        setShowTimeframes(false);
        setShowChartTypes(false);
        setShowIndicators(false);
        setShowSnapshotMenu(false);
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (timeframeRef.current && !timeframeRef.current.contains(event.target) && !event.target.closest(`.${styles.dropdown}`)) {
                setShowTimeframes(false);
            }
            if (chartTypeRef.current && !chartTypeRef.current.contains(event.target) && !event.target.closest(`.${styles.dropdown}`)) {
                setShowChartTypes(false);
            }
            if (indicatorRef.current && !indicatorRef.current.contains(event.target) && !event.target.closest(`.${styles.indicatorDropdown}`)) {
                setShowIndicators(false);
            }
            if (snapshotRef.current && !snapshotRef.current.contains(event.target) && !event.target.closest(`.${styles.snapshotDropdown}`)) {
                setShowSnapshotMenu(false);
            }
            if (layoutRef.current && !layoutRef.current.contains(event.target) && !event.target.closest(`.${styles.dropdown}`)) {
                setShowLayoutMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Update positions on scroll or resize
    useEffect(() => {
        const handleUpdate = () => {
            if (showTimeframes) setTimeframePos(calculatePosition(timeframeRef));
            if (showChartTypes) setChartTypePos(calculatePosition(chartTypeRef));
            if (showIndicators) setIndicatorPos(calculatePosition(indicatorRef));
            if (showSnapshotMenu) setSnapshotPos(calculateSnapshotPosition(snapshotRef));
            if (showLayoutMenu) setLayoutPos(calculatePosition(layoutRef));
        };

        window.addEventListener('scroll', handleUpdate, true);
        window.addEventListener('resize', handleUpdate);
        return () => {
            window.removeEventListener('scroll', handleUpdate, true);
            window.removeEventListener('resize', handleUpdate);
        };
    }, [showTimeframes, showChartTypes, showIndicators, showSnapshotMenu]);

    return (
        <div className={styles.layoutAreaTop}>
            <div className={styles.toolbar}>
                <div className={styles.overflowWrap}>
                    <div className={styles.inner}>
                        <div className={styles.wrapOverflow}>
                            <div className={styles.wrap}>
                                <div className={styles.scrollWrap}>
                                    <div className={styles.content}>
                                        <div className={styles.innerWrap}>

                                            {/* Hamburger Menu */}
                                            <div className={styles.group}>
                                                <button
                                                    className={classNames(styles.button, styles.iconButton)}
                                                    aria-label="Menu"
                                                    onClick={onMenuClick}
                                                >
                                                    <div className={styles.icon}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M4 7h20v1H4V7zm0 6h20v1H4v-1zm0 6h20v1H4v-1z"></path></svg>
                                                    </div>
                                                </button>
                                            </div>

                                            {/* Symbol Search */}
                                            <div className={styles.separatorWrap}><div className={styles.separator}></div></div>
                                            <div className={styles.group}>
                                                <button
                                                    className={classNames(styles.button, styles.symbolButton)}
                                                    onClick={onSymbolClick}
                                                    aria-label="Symbol Search"
                                                >
                                                    <div className={styles.icon}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="18" height="18"><path fill="currentColor" d="M3.5 8a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM8 2a6 6 0 1 0 3.65 10.76l3.58 3.58 1.06-1.06-3.57-3.57A6 6 0 0 0 8 2Z"></path></svg>
                                                    </div>
                                                    <div className={classNames(styles.text, styles.uppercase)}>{symbol}</div>
                                                </button>
                                                <button
                                                    className={classNames(styles.button, styles.iconButton)}
                                                    aria-label="Compare or Add Symbol"
                                                    onClick={onCompareClick}
                                                >
                                                    <div className={styles.icon}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M13.5 6a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM4 14.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z"></path><path fill="currentColor" d="M9 14h4v-4h1v4h4v1h-4v4h-1v-4H9v-1z"></path></svg>
                                                    </div>
                                                </button>
                                                {/* Strategy Chart Button */}
                                                <Tooltip content={strategyConfig ? strategyConfig.displayName : "Create Option Strategy Chart"} position="bottom">
                                                    <button
                                                        className={classNames(styles.button, styles.iconButton, { [styles.isActive]: !!strategyConfig })}
                                                        aria-label="Option Strategy Chart"
                                                        onClick={onStraddleClick}
                                                    >
                                                        <div className={styles.icon}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M3 17l6-6 4 4 8-8" />
                                                                <path d="M17 7h4v4" />
                                                                <path d="M3 7l6 6 4-4 8 8" />
                                                                <path d="M17 17h4v-4" />
                                                            </svg>
                                                        </div>
                                                    </button>
                                                </Tooltip>
                                            </div>
                                            {/* Timeframes */}
                                            <div className={styles.separatorWrap}><div className={styles.separator}></div></div>
                                            <div className={styles.intervalGroup} ref={timeframeRef}>
                                                {favoriteIntervals.length === 0 ? (
                                                    // No favorites: Current interval acts as dropdown trigger
                                                    <button
                                                        className={classNames(styles.button, styles.intervalButton, styles.menuButton)}
                                                        onClick={toggleTimeframes}
                                                        title="Select Interval"
                                                        aria-haspopup="menu"
                                                        aria-expanded={showTimeframes}
                                                    >
                                                        <div className={styles.buttonText}>
                                                            <div className={styles.value}>{getShortLabel(interval)}</div>
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <>
                                                        <div className={styles.radioGroup} role="radiogroup" aria-orientation="horizontal">
                                                            {(() => {
                                                                // Determine the effective non-favorite interval to show
                                                                const effectiveNonFav = (!favoriteIntervals.includes(interval)) ? interval : lastNonFavoriteInterval;
                                                                const showEffectiveNonFav = effectiveNonFav && !favoriteIntervals.includes(effectiveNonFav);

                                                                // Sort favorites by duration
                                                                const sortedFavorites = [...favoriteIntervals].sort((a, b) => intervalToSeconds(a) - intervalToSeconds(b));

                                                                // Combine sorted favorites and the non-favorite interval (at the end)
                                                                const intervalsToShow = [...sortedFavorites];
                                                                if (showEffectiveNonFav) {
                                                                    intervalsToShow.push(effectiveNonFav);
                                                                }

                                                                return intervalsToShow.map(val => {
                                                                    return (
                                                                        <button
                                                                            key={val}
                                                                            className={classNames(styles.button, styles.intervalButton, styles.isGrouped, { [styles.isActive]: interval === val })}
                                                                            onClick={() => { onIntervalChange(val); setShowTimeframes(false); }}
                                                                            role="radio"
                                                                            aria-checked={interval === val}
                                                                            title={getFullTimeframeName(val)}
                                                                            tabIndex={-1}
                                                                        >
                                                                            <div className={styles.buttonText}>
                                                                                <div className={styles.value}>{getShortLabel(val)}</div>
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>

                                                        {/* Separate Dropdown Arrow */}
                                                        <button
                                                            className={classNames(styles.button, styles.menuButton, styles.intervalMenuButton)}
                                                            onClick={toggleTimeframes}
                                                            aria-label="Chart interval"
                                                            aria-haspopup="menu"
                                                            tabIndex={-1}
                                                        >
                                                            <div className={styles.arrow}>
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 6" width="10" height="6"><path fill="currentColor" d="M.59.91 5 5.32 9.41.91.91.91z"></path></svg>
                                                            </div>
                                                        </button>
                                                    </>
                                                )}
                                                {showTimeframes && (
                                                    <div
                                                        className={styles.dropdown}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{ top: timeframePos.top, left: timeframePos.left }}
                                                    >
                                                        {/* Add Custom Header */}
                                                        <div className={styles.addCustomBtn} onClick={() => setShowCustomInput(true)}>
                                                            <Plus size={14} />
                                                            <span>Add custom interval...</span>
                                                        </div>

                                                        {/* Custom Input Form */}
                                                        {showCustomInput && (
                                                            <div className={styles.customInputForm}>
                                                                <div className={styles.customHeader}>
                                                                    <span>Add interval</span>
                                                                    <X size={14} className={styles.closeIcon} onClick={() => setShowCustomInput(false)} />
                                                                </div>
                                                                <div className={styles.customBody}>
                                                                    <input type="number" value={customValue} onChange={(e) => setCustomValue(e.target.value)} className={styles.numInput} min="1" />
                                                                    <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className={styles.unitSelect}>
                                                                        <option value="m">Minutes</option>
                                                                        <option value="h">Hours</option>
                                                                        <option value="d">Days</option>
                                                                        <option value="w">Weeks</option>
                                                                        <option value="M">Months</option>
                                                                    </select>
                                                                    <button className={styles.addBtn} onClick={handleCustomSubmit}>Add</button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Separator */}
                                                        <div className={styles.separator}></div>

                                                        <div className={styles.scrollableList}>
                                                            {Object.entries(groupedTimeframes).map(([group, items]) => (
                                                                items.length > 0 && (
                                                                    <div key={group}>
                                                                        {/* Collapsible Section Header */}
                                                                        <div
                                                                            className={styles.sectionHeader}
                                                                            onClick={() => toggleSection(group)}
                                                                            role="row"
                                                                            aria-expanded={expandedSections[group]}
                                                                            aria-level="1"
                                                                            data-role="menuitem"
                                                                            tabIndex={-1}
                                                                        >
                                                                            <span>{group.toUpperCase()}</span>
                                                                            <span className={classNames(styles.caret, { [styles.expanded]: expandedSections[group] })}>
                                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 8" width="16" height="8">
                                                                                    <path fill="currentColor" d="M0 1.475l7.396 6.04.596.485.593-.49L16 1.39 14.807 0 7.393 6.122 8.58 6.12 1.186.08z"></path>
                                                                                </svg>
                                                                            </span>
                                                                        </div>

                                                                        {/* Collapsible Items */}
                                                                        {expandedSections[group] && (
                                                                            <div>
                                                                                {items.map((tf) => (
                                                                                    <div
                                                                                        key={tf.value}
                                                                                        className={classNames(styles.dropdownItem, { [styles.active]: interval === tf.value })}
                                                                                        onClick={() => { onIntervalChange(tf.value); setShowTimeframes(false); }}
                                                                                        role="row"
                                                                                        aria-level="2"
                                                                                        aria-selected={interval === tf.value}
                                                                                        data-value={tf.value}
                                                                                        data-role="menuitem"
                                                                                        tabIndex={-1}
                                                                                    >
                                                                                        <span className={styles.itemLabel}>{tf.label}</span>
                                                                                        <div className={styles.itemActions}>
                                                                                            <Star
                                                                                                size={14}
                                                                                                className={classNames(styles.starIcon, { [styles.filled]: favoriteIntervals.includes(tf.value) })}
                                                                                                onClick={(e) => { e.stopPropagation(); onToggleFavorite(tf.value); }}
                                                                                            />
                                                                                            {tf.type === 'Custom' && (
                                                                                                <Trash2
                                                                                                    size={14}
                                                                                                    className={styles.trashIcon}
                                                                                                    onClick={(e) => { e.stopPropagation(); onRemoveCustomInterval(tf.value); }}
                                                                                                />
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}

                                                                        {/* Separator after each section */}
                                                                        <div className={styles.separator}></div>
                                                                    </div>
                                                                )
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Chart Type */}
                                            <div className={styles.separatorWrap}><div className={styles.separator}></div></div>
                                            <div className={styles.group}>
                                                <div className={styles.chartTypeSection} ref={chartTypeRef}>
                                                    <button
                                                        className={classNames(styles.button, styles.menuButton)}
                                                        onClick={toggleChartTypes}
                                                    >
                                                        <div className={styles.icon}>
                                                            {chartTypes.find(ct => ct.value === chartType)?.icon || chartTypes[0].icon}
                                                        </div>
                                                    </button>
                                                    {showChartTypes && (
                                                        <div
                                                            className={styles.dropdown}
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{ top: chartTypePos.top, left: chartTypePos.left }}
                                                        >
                                                            {chartTypes.map((ct) => (
                                                                <div key={ct.value} className={classNames(styles.dropdownItem, styles.withIcon, { [styles.active]: chartType === ct.value })} onClick={() => { onChartTypeChange(ct.value); setShowChartTypes(false); }}>
                                                                    <span className={styles.icon}>{ct.icon}</span>
                                                                    <span>{ct.label}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Indicators */}
                                            <div className={styles.separatorWrap}><div className={styles.separator}></div></div>
                                            <div className={styles.group}>
                                                <div className={styles.indicatorBtn} ref={indicatorRef}>
                                                    <button
                                                        className={classNames(styles.button)}
                                                        aria-label="Indicators"
                                                        onClick={toggleIndicators}
                                                    >
                                                        <div className={styles.icon}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="none"><path stroke="currentColor" d="M6 12l4.8-4.8a1 1 0 0 1 1.4 0l2.7 2.7a1 1 0 0 0 1.3.1L23 5"></path><path fill="currentColor" fillRule="evenodd" d="M19 12a1 1 0 0 0-1 1v4h-3v-1a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v2H7a1 1 0 0 0-1 1v4h17V13a1 1 0 0 0-1-1h-3zm0 10h3v-9h-3v9zm-1 0v-4h-3v4h3zm-4-4.5V22h-3v-6h3v1.5zM10 22v-3H7v3h3z"></path></svg>
                                                        </div>
                                                        <div className={styles.text}>Indicators</div>
                                                    </button>
                                                    {showIndicators && (
                                                        <div
                                                            className={styles.indicatorDropdown}
                                                            style={{ top: indicatorPos.top, left: indicatorPos.left }}
                                                        >
                                                            <div className={styles.dropdownSection}>Moving Averages</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('sma'); }}>SMA</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('ema'); }}>EMA</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Oscillators</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('rsi'); }}>RSI</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('stochastic'); }}>Stochastic</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('hilengaMilenga'); }}>Hilenga-Milenga</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Momentum</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('macd'); }}>MACD</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Volatility</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('bollingerBands'); }}>Bollinger Bands</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('atr'); }}>ATR</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Trend</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('supertrend'); }}>Supertrend</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('ichimoku'); }}>Ichimoku Cloud</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Trend Strength</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('adx'); }}>ADX</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Support/Resistance</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('pivotPoints'); }}>Pivot Points</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Volume</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('volume'); }}>Volume</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('vwap'); }}>VWAP</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Market Profile</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('tpo'); }}>TPO Profile (30m)</div>
                                                            <div className={styles.dropdownDivider}></div>
                                                            <div className={styles.dropdownSection}>Strategy</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('firstCandle'); }}>First Red Candle</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('rangeBreakout'); }}>Range Breakout</div>
                                                            <div className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); onAddIndicator('annStrategy'); }}>ANN Strategy</div>
                                                        </div>
                                                    )}

                                                </div>
                                            </div>

                                            {/* Alerts, Replay & Option Chain */}
                                            <div className={styles.separatorWrap}><div className={styles.separator}></div></div>
                                            <div className={styles.group}>
                                                <button className={classNames(styles.button)} aria-label="Create Alert" onClick={onAlertClick}>
                                                    <div className={styles.icon}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="m19.54 4.5 3.96 4.32-.74.68-3.96-4.32.74-.68ZM7.46 4.5 3.5 8.82l.74.68L8.2 5.18l-.74-.68ZM19.74 10.33A7.5 7.5 0 0 1 21 14.5v.5h1v-.5a8.5 8.5 0 1 0-8.5 8.5h.5v-1h-.5a7.5 7.5 0 1 1 6.24-11.67Z"></path><path fill="currentColor" d="M13 9v5h-3v1h4V9h-1ZM19 20v-4h1v4h4v1h-4v4h-1v-4h-4v-1h4Z"></path></svg>
                                                    </div>
                                                    <div className={styles.text}>Alert</div>
                                                </button>
                                                <button className={classNames(styles.button, { [styles.isActive]: isReplayMode })} aria-label="Bar Replay" onClick={onReplayClick}>
                                                    <div className={styles.icon}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="none" stroke="currentColor" d="M13.5 20V9l-6 5.5 6 5.5zM21.5 20V9l-6 5.5 6 5.5z"></path></svg>
                                                    </div>
                                                    <div className={styles.text}>Replay</div>
                                                </button>
                                                <button className={styles.button} aria-label="Option Chain" onClick={onOptionsClick}>
                                                    <div className={styles.icon}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M4 7h2v2H4V7zm4 0h16v2H8V7zM4 13h2v2H4v-2zm4 0h16v2H8v-2zM4 19h2v2H4v-2zm4 0h16v2H8v-2z"></path></svg>
                                                    </div>
                                                    <div className={styles.text}>Options</div>
                                                </button>
                                                <Tooltip content="Sector Heatmap" position="bottom">
                                                    <button className={styles.button} aria-label="Sector Heatmap" onClick={onHeatmapClick}>
                                                        <div className={styles.icon}>
                                                            <BarChart3 size={20} strokeWidth={1.5} />
                                                        </div>
                                                        <div className={styles.text}>Heatmap</div>
                                                    </button>
                                                </Tooltip>
                                            </div>

                                            {/* Undo / Redo */}
                                            <div className={styles.separatorWrap}><div className={styles.separator}></div></div>
                                            <div className={styles.group}>
                                                <Tooltip content="Undo" shortcut="Ctrl+Z" position="bottom">
                                                    <button className={classNames(styles.button, styles.iconButton)} onClick={onUndo} aria-label="Undo">
                                                        <div className={styles.icon}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M8.707 13l2.647 2.646-.707.708L6.792 12.5l3.853-3.854.708.708L8.707 12H14.5a5.5 5.5 0 0 1 5.5 5.5V19h-1v-1.5a4.5 4.5 0 0 0-4.5-4.5H8.707z"></path></svg>
                                                        </div>
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Redo" shortcut="Ctrl+Y" position="bottom">
                                                    <button className={classNames(styles.button, styles.iconButton)} onClick={onRedo} aria-label="Redo">
                                                        <div className={styles.icon}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M18.293 13l-2.647 2.646.707.708 3.854-3.854-3.854-3.854-.707.708L18.293 12H12.5A5.5 5.5 0 0 0 7 17.5V19h1v-1.5a4.5 4.5 0 0 1 4.5-4.5h5.793z"></path></svg>
                                                        </div>
                                                    </button>
                                                </Tooltip>
                                            </div>

                                            <div className={styles.fill}></div>

                                            {/* Right Section */}
                                            <div className={styles.rightSection}>

                                                <div className={styles.layoutSection} ref={layoutRef}>
                                                    <button
                                                        className={classNames(styles.button, styles.menuButton)}
                                                        aria-label="Layout setup"
                                                        onClick={toggleLayoutMenu}
                                                    >
                                                        <div className={styles.icon}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 21 19" width="21" height="19"><path fill="currentColor" d="M2.5 1C1.67 1 1 1.67 1 2.5v12c0 .83.67 1.5 1.5 1.5h14c.83 0 1.5-.67 1.5-1.5v-12c0-.83-.67-1.5-1.5-1.5h-14ZM0 2.5A2.5 2.5 0 0 1 2.5 0h14A2.5 2.5 0 0 1 19 2.5v12a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 0 14.5v-12Z"></path></svg>
                                                        </div>
                                                    </button>
                                                    {showLayoutMenu && (
                                                        <div
                                                            className={styles.dropdown}
                                                            style={{ top: layoutPos.top, left: layoutPos.left }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className={classNames(styles.dropdownItem, styles.withIcon, { [styles.active]: layout === '1' })} onClick={() => { onLayoutChange('1'); setShowLayoutMenu(false); }}>
                                                                <span className={styles.icon}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M3 3h22v22H3V3z"></path></svg></span>
                                                                <span>Single Chart</span>
                                                            </div>
                                                            <div className={classNames(styles.dropdownItem, styles.withIcon, { [styles.active]: layout === '2' })} onClick={() => { onLayoutChange('2'); setShowLayoutMenu(false); }}>
                                                                <span className={styles.icon}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M3 3h10v22H3V3zm12 0h10v22H15V3z"></path></svg></span>
                                                                <span>2 Charts</span>
                                                            </div>
                                                            <div className={classNames(styles.dropdownItem, styles.withIcon, { [styles.active]: layout === '3' })} onClick={() => { onLayoutChange('3'); setShowLayoutMenu(false); }}>
                                                                <span className={styles.icon}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M3 3h6v22H3V3zm8 0h6v22h-6V3zm8 0h6v22h-6V3z"></path></svg></span>
                                                                <span>3 Charts</span>
                                                            </div>
                                                            <div className={classNames(styles.dropdownItem, styles.withIcon, { [styles.active]: layout === '4' })} onClick={() => { onLayoutChange('4'); setShowLayoutMenu(false); }}>
                                                                <span className={styles.icon}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M3 3h10v10H3V3zm12 0h10v10H15V3zM3 15h10v10H3V15zm12 0h10v10H15V15z"></path></svg></span>
                                                                <span>4 Charts</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <button className={classNames(styles.button)} aria-label="Save" onClick={onSaveLayout}>
                                                    <div className={styles.text}>Save</div>
                                                </button>
                                                <Tooltip content="Layout Templates" position="bottom">
                                                    <button className={classNames(styles.button, styles.iconButton)} aria-label="Templates" onClick={onTemplatesClick}>
                                                        <div className={styles.icon}>
                                                            <LayoutIcon size={20} strokeWidth={1.5} />
                                                        </div>
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Chart Templates" position="bottom">
                                                    <button className={classNames(styles.button, styles.iconButton)} aria-label="Chart Templates" onClick={onChartTemplatesClick}>
                                                        <div className={styles.icon}>
                                                            <Bookmark size={18} strokeWidth={1.5} />
                                                        </div>
                                                    </button>
                                                </Tooltip>

                                                <div className={styles.separatorWrap}><div className={styles.separator}></div></div>


                                                {/* Theme Toggle */}
                                                <button
                                                    className={classNames(styles.button, styles.iconButton, styles.themeToggle)}
                                                    onClick={onToggleTheme}
                                                    aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                                >
                                                    <div className={styles.icon}>
                                                        {theme === 'dark' ? (
                                                            /* Sun icon for switching to light */
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="currentColor">
                                                                <path d="M14 5a1 1 0 0 1-1-1V2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1ZM14 27a1 1 0 0 1-1-1v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1ZM27 14a1 1 0 0 1-1 1h-2a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1ZM5 14a1 1 0 0 1-1 1H2a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1ZM23.19 5.81a1 1 0 0 1 0 1.42l-1.42 1.41a1 1 0 0 1-1.41-1.41l1.41-1.42a1 1 0 0 1 1.42 0ZM7.64 21.36a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 0 1-1.41-1.42l1.41-1.41a1 1 0 0 1 1.42 0ZM5.81 4.81a1 1 0 0 1 1.42 0l1.41 1.42a1 1 0 1 1-1.41 1.41L5.81 6.23a1 1 0 0 1 0-1.42ZM21.36 20.36a1 1 0 0 1 1.41 0l1.42 1.41a1 1 0 0 1-1.42 1.42l-1.41-1.42a1 1 0 0 1 0-1.41ZM14 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-5 6a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"></path>
                                                            </svg>
                                                        ) : (
                                                            /* Moon icon for switching to dark */
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </button>

                                                <div className={styles.separatorWrap}><div className={styles.separator}></div></div>


                                                <Tooltip content="Settings" position="bottom">
                                                    <button className={classNames(styles.button, styles.iconButton)} aria-label="Settings" onClick={onSettingsClick}>
                                                        <div className={styles.icon}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28" fill="currentColor"><path fillRule="evenodd" d="M18 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-1 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path><path fillRule="evenodd" d="M8.5 5h11l5 9-5 9h-11l-5-9 5-9Zm-3.86 9L9.1 6h9.82l4.45 8-4.45 8H9.1l-4.45-8Z"></path></svg>
                                                        </div>
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Fullscreen" shortcut="F11" position="bottom">
                                                    <button className={classNames(styles.button, styles.iconButton)} aria-label="Fullscreen" onClick={onFullScreen}>
                                                        <div className={styles.icon}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28"><path fill="currentColor" d="M8.5 6A2.5 2.5 0 0 0 6 8.5V11h1V8.5C7 7.67 7.67 7 8.5 7H11V6H8.5zM6 17v2.5A2.5 2.5 0 0 0 8.5 22H11v-1H8.5A1.5 1.5 0 0 1 7 19.5V17H6zM19.5 7H17V6h2.5A2.5 2.5 0 0 1 22 8.5V11h-1V8.5c0-.83-.67-1.5-1.5-1.5zM22 19.5V17h-1v2.5c0 .83-.67 1.5-1.5 1.5H17v1h2.5a2.5 2.5 0 0 0 2.5-2.5z"></path></svg>
                                                        </div>
                                                    </button>
                                                </Tooltip>
                                                <div className={styles.snapshotSection} ref={snapshotRef}>
                                                    <Tooltip content="Chart Snapshot" position="bottom">
                                                        <button
                                                            className={classNames(styles.button, styles.iconButton)}
                                                            aria-label="Snapshot"
                                                            onClick={toggleSnapshotMenu}
                                                        >
                                                            <div className={styles.icon}>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M11.118 6a.5.5 0 0 0-.447.276L9.809 8H5.5A1.5 1.5 0 0 0 4 9.5v10A1.5 1.5 0 0 0 5.5 21h16a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 21.5 8h-4.309l-.862-1.724A.5.5 0 0 0 15.882 6h-4.764zm-1.342-.17A1.5 1.5 0 0 1 11.118 5h4.764a1.5 1.5 0 0 1 1.342.83L17.809 7H21.5A2.5 2.5 0 0 1 24 9.5v10a2.5 2.5 0 0 1-2.5 2.5h-16A2.5 2.5 0 0 1 3 19.5v-10A2.5 2.5 0 0 1 5.5 7h3.691l.585-1.17z"></path><path fillRule="evenodd" clipRule="evenodd" d="M13.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0 1a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z"></path></svg>
                                                            </div>
                                                        </button>
                                                    </Tooltip>
                                                    {showSnapshotMenu && (
                                                        <div
                                                            className={styles.snapshotDropdown}
                                                            style={{ top: snapshotPos.top, right: snapshotPos.right }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className={styles.snapshotHeader}>CHART SNAPSHOT</div>
                                                            <div
                                                                className={styles.snapshotItem}
                                                                onClick={() => { onDownloadImage?.(); setShowSnapshotMenu(false); }}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
                                                                    <path d="M14 18.5l-5-5h3.5V5h3v8.5H19l-5 5z"></path>
                                                                    <path d="M6 20h16v2H6v-2z"></path>
                                                                </svg>
                                                                <span>Download image</span>
                                                            </div>
                                                            <div
                                                                className={styles.snapshotItem}
                                                                onClick={() => { onCopyImage?.(); setShowSnapshotMenu(false); }}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
                                                                    <path d="M8 6h10v2H8V6zm12 4H8v12h12V10zm-2 10H10V12h8v8z"></path>
                                                                    <path d="M6 8v14h14v-2H8V8H6z"></path>
                                                                </svg>
                                                                <span>Copy image</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Topbar;
