import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { getOptionChain, getAvailableExpiries, UNDERLYINGS } from '../../services/optionChain';
import { subscribeToMultiTicker, getMultiOptionGreeks } from '../../services/openalgo';
import styles from './OptionChainModal.module.css';
import classNames from 'classnames';

// Import extracted components and format helpers
import { formatOI, formatLTP, formatLtpChange, formatGreek, formatDelta, formatIv, formatTheta, formatVega, formatGamma } from './components';
import { useOptionChainKeyboard } from './hooks';

/**
 * OptionChainModal - Option Chain UI with proper date alignment
 */
const OptionChainModal = ({ isOpen, onClose, onSelectOption, initialSymbol }) => {
    const [underlying, setUnderlying] = useState(UNDERLYINGS[0]);
    const [isCustomSymbol, setIsCustomSymbol] = useState(false);
    const [optionChain, setOptionChain] = useState(null);
    const [availableExpiries, setAvailableExpiries] = useState([]);
    const [selectedExpiry, setSelectedExpiry] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingExpiries, setIsLoadingExpiries] = useState(false);
    const [error, setError] = useState(null);
    const [expiryScrollIndex, setExpiryScrollIndex] = useState(0);
    const [liveLTP, setLiveLTP] = useState(new Map());
    const [focusedRow, setFocusedRow] = useState(-1); // Keyboard navigation
    const [focusedCol, setFocusedCol] = useState('ce'); // 'ce' or 'pe'
    const [strikeCount, setStrikeCount] = useState(15); // Dynamic strike count
    const [isLoadingMore, setIsLoadingMore] = useState(false); // Loading state for load more
    const tableBodyRef = useRef(null);
    const wsRef = useRef(null);

    // Greeks mode state
    const [viewMode, setViewMode] = useState('ltp-oi'); // 'ltp-oi' or 'greeks'
    const [greeksData, setGreeksData] = useState(new Map()); // symbol -> greeks object
    const [greeksLoading, setGreeksLoading] = useState(false);

    // Request tracking refs to prevent stale responses and race conditions
    const expiryRequestIdRef = useRef(0);
    const chainRequestIdRef = useRef(0);
    const greeksRequestIdRef = useRef(0);
    // Track symbols that permanently failed to fetch Greeks (after MAX_RETRY_COUNT attempts)
    const failedGreeksSymbolsRef = useRef(new Set());
    // Track retry counts per symbol (symbol -> attempt count)
    const greeksRetryCountRef = useRef(new Map());
    const MAX_GREEKS_RETRY_COUNT = 3; // Block symbol after 3 failed attempts
    // Track if we're waiting for initialSymbol to be processed before fetching
    const pendingInitialSymbolRef = useRef(false);

    // Max strikes available (API supports up to 100)
    const MAX_STRIKE_COUNT = 100;
    const STRIKE_INCREMENT = 20; // Load 20 more strikes per click

    // Set underlying from initialSymbol when modal opens
    useEffect(() => {
        if (isOpen && initialSymbol) {
            // Mark that we're processing initialSymbol - skip auto-fetch until done
            pendingInitialSymbolRef.current = true;

            // Increment request IDs to invalidate any pending requests
            expiryRequestIdRef.current++;
            chainRequestIdRef.current++;

            // Check if it's a known index
            const known = UNDERLYINGS.find(u => u.symbol === initialSymbol.symbol);
            if (known) {
                setUnderlying(known);
                setIsCustomSymbol(false);
            } else {
                // Dynamic stock - create underlying object with correct exchange mapping
                // Map source exchange to F&O exchange:
                // NSE, NSE_INDEX -> NFO
                // BSE, BSE_INDEX -> BFO
                // MCX -> MCX
                // CDS -> CDS
                const sourceExchange = initialSymbol.exchange?.toUpperCase() || 'NSE';
                let foExchange = 'NFO';
                let indexExchange = 'NSE';

                if (sourceExchange === 'BSE' || sourceExchange === 'BSE_INDEX') {
                    foExchange = 'BFO';
                    indexExchange = 'BSE';
                } else if (sourceExchange === 'MCX') {
                    foExchange = 'MCX';
                    indexExchange = 'MCX';
                } else if (sourceExchange === 'CDS') {
                    foExchange = 'CDS';
                    indexExchange = 'CDS';
                } else if (sourceExchange === 'BFO') {
                    foExchange = 'BFO';
                    indexExchange = 'BSE';
                } else if (sourceExchange === 'NFO') {
                    foExchange = 'NFO';
                    indexExchange = 'NSE';
                }
                // Default: NSE, NSE_INDEX -> NFO, NSE

                setUnderlying({
                    symbol: initialSymbol.symbol,
                    name: initialSymbol.symbol,
                    exchange: foExchange,
                    indexExchange: indexExchange
                });
                setIsCustomSymbol(true);
            }
            // Reset state for new symbol
            setOptionChain(null);
            setAvailableExpiries([]);
            setSelectedExpiry(null);
            setExpiryScrollIndex(0);
            setStrikeCount(15); // Reset to default

            // Mark initialization complete - allow fetches in next render cycle
            // Use setTimeout to ensure state updates are batched first
            setTimeout(() => {
                pendingInitialSymbolRef.current = false;
            }, 0);
        } else if (isOpen && !initialSymbol) {
            // No initialSymbol, allow immediate fetches
            pendingInitialSymbolRef.current = false;
        }
    }, [isOpen, initialSymbol]);

    // Parse expiry date
    const parseExpiry = (expiryStr) => {
        const date = new Date(expiryStr);
        if (!isNaN(date.getTime())) {
            const day = date.getDate();
            const month = date.toLocaleString('en-US', { month: 'short' });
            const year = date.getFullYear();
            return { day, month, year };
        }
        return { day: expiryStr, month: '', year: 0 };
    };

    // Group expiries by month with proper structure
    const groupedExpiries = useMemo(() => {
        const groups = [];
        let currentMonth = '';
        let currentYear = 0;
        let lastDisplayedYear = new Date().getFullYear();

        availableExpiries.forEach((exp) => {
            const parsed = parseExpiry(exp);
            const monthKey = `${parsed.month}-${parsed.year}`;

            if (monthKey !== `${currentMonth}-${currentYear}`) {
                // Only show year if it's different from last displayed year
                const showYear = parsed.year !== lastDisplayedYear;
                const monthYear = showYear ? `${parsed.month} '${String(parsed.year).slice(-2)}` : parsed.month;

                groups.push({
                    monthYear,
                    dates: [{ expiry: exp, day: parsed.day }]
                });

                currentMonth = parsed.month;
                currentYear = parsed.year;
                if (showYear) lastDisplayedYear = parsed.year;
            } else {
                groups[groups.length - 1].dates.push({ expiry: exp, day: parsed.day });
            }
        });

        return groups;
    }, [availableExpiries]);

    // Visible groups based on scroll (show ~12 dates at a time)
    const visibleData = useMemo(() => {
        const maxDates = 12;
        const result = [];
        let dateCount = 0;
        let skipCount = expiryScrollIndex;
        let lastDisplayedYear = new Date().getFullYear();

        for (const group of groupedExpiries) {
            if (dateCount >= maxDates) break;

            // Skip dates based on scroll index
            if (skipCount >= group.dates.length) {
                skipCount -= group.dates.length;
                continue;
            }

            const startIdx = skipCount;
            skipCount = 0;

            const remainingSlots = maxDates - dateCount;
            const datesToTake = Math.min(group.dates.length - startIdx, remainingSlots);

            // Get the year from first date in this group's visible slice
            const firstDate = group.dates[startIdx];
            const expDate = new Date(firstDate.expiry);
            const month = expDate.toLocaleString('en-US', { month: 'short' });
            const year = expDate.getFullYear();

            // Show year only if different from last displayed
            const showYear = year !== lastDisplayedYear;
            const monthLabel = showYear ? `${month} '${String(year).slice(-2)}` : month;
            if (showYear) lastDisplayedYear = year;

            result.push({
                monthYear: monthLabel,
                dates: group.dates.slice(startIdx, startIdx + datesToTake)
            });

            dateCount += datesToTake;
        }

        // Calculate total visible dates for scroll (we want last visible to become first)
        const totalVisibleDates = dateCount;

        return { groups: result, scrollAmount: Math.max(1, totalVisibleDates - 1) };
    }, [groupedExpiries, expiryScrollIndex]);

    const totalExpiries = availableExpiries.length;
    const canScrollLeft = expiryScrollIndex > 0;
    const canScrollRight = expiryScrollIndex + 12 < totalExpiries;

    // Fetch expiries with request ID tracking to prevent stale responses
    const fetchExpiries = useCallback(async () => {
        // Skip if pending initialSymbol processing
        if (pendingInitialSymbolRef.current) {
            console.log('[OptionChain] Skipping fetchExpiries - waiting for initialSymbol');
            return;
        }

        // Increment request ID and capture current value
        const requestId = ++expiryRequestIdRef.current;
        const currentSymbol = underlying.symbol;
        const currentExchange = underlying.exchange;

        console.log('[OptionChain] Fetching expiries for', currentSymbol, 'requestId:', requestId);
        setIsLoadingExpiries(true);

        try {
            const expiries = await getAvailableExpiries(currentSymbol, currentExchange);

            // Check if this request is still current (user hasn't switched symbols)
            if (requestId !== expiryRequestIdRef.current) {
                console.log('[OptionChain] Discarding stale expiry response for', currentSymbol, 'requestId:', requestId, 'current:', expiryRequestIdRef.current);
                return;
            }

            setAvailableExpiries(expiries);
            if (expiries.length > 0) {
                setSelectedExpiry(expiries[0]);
                setExpiryScrollIndex(0);
            }
        } catch (err) {
            // Only handle error if request is still current
            if (requestId === expiryRequestIdRef.current) {
                console.error('Failed to fetch expiries:', err);
                setAvailableExpiries([]);
            }
        } finally {
            // Only update loading state if request is still current
            if (requestId === expiryRequestIdRef.current) {
                setIsLoadingExpiries(false);
            }
        }
    }, [underlying.symbol, underlying.exchange]);

    // Fetch chain with request ID tracking to prevent stale responses
    const fetchChain = useCallback(async (requestedStrikeCount = strikeCount) => {
        if (!selectedExpiry) return;

        // Increment request ID and capture current value
        const requestId = ++chainRequestIdRef.current;
        const currentSymbol = underlying.symbol;
        const currentExchange = underlying.exchange;
        const currentExpiry = selectedExpiry;

        console.log('[OptionChain] Fetching chain for', currentSymbol, currentExpiry, 'requestId:', requestId);
        setIsLoading(true);
        setError(null);

        try {
            const chain = await getOptionChain(currentSymbol, currentExchange, currentExpiry, requestedStrikeCount);

            // Check if this request is still current
            if (requestId !== chainRequestIdRef.current) {
                console.log('[OptionChain] Discarding stale chain response for', currentSymbol, 'requestId:', requestId, 'current:', chainRequestIdRef.current);
                return;
            }

            setOptionChain(chain);
        } catch (err) {
            // Only handle error if request is still current
            if (requestId === chainRequestIdRef.current) {
                setError('Failed to fetch option chain');
                console.error(err);
            }
        } finally {
            // Only update loading state if request is still current
            if (requestId === chainRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [underlying.symbol, underlying.exchange, selectedExpiry, strikeCount]);

    // Load more strikes handler
    const loadMoreStrikes = useCallback(async () => {
        if (strikeCount >= MAX_STRIKE_COUNT) return;

        const newStrikeCount = Math.min(strikeCount + STRIKE_INCREMENT, MAX_STRIKE_COUNT);
        setIsLoadingMore(true);

        try {
            const chain = await getOptionChain(underlying.symbol, underlying.exchange, selectedExpiry, newStrikeCount, true); // force refresh
            setOptionChain(chain);
            setStrikeCount(newStrikeCount);
        } catch (err) {
            console.error('Failed to load more strikes:', err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [underlying, selectedExpiry, strikeCount, MAX_STRIKE_COUNT, STRIKE_INCREMENT]);

    // Fetch expiries when modal opens or underlying changes
    // Using underlying.symbol as dependency instead of fetchExpiries to avoid stale closure issues
    useEffect(() => {
        if (isOpen && underlying.symbol) {
            // Small delay to allow initialSymbol effect to complete first
            const timeoutId = setTimeout(() => {
                if (!pendingInitialSymbolRef.current) {
                    fetchExpiries();
                }
            }, 10);
            return () => clearTimeout(timeoutId);
        }
    }, [isOpen, underlying.symbol, underlying.exchange, fetchExpiries]);

    // Fetch chain when expiry is selected
    useEffect(() => {
        if (isOpen && selectedExpiry) {
            fetchChain();
        }
    }, [isOpen, selectedExpiry, fetchChain]);

    useEffect(() => {
        if (optionChain?.atmStrike && tableBodyRef.current) {
            const spotBar = tableBodyRef.current.querySelector('[data-spot-bar="true"]');
            if (spotBar) spotBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [optionChain]);

    // WebSocket subscription for live LTP updates
    useEffect(() => {
        // Cleanup previous subscription
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        if (!isOpen || !optionChain?.chain?.length) return;

        // Build symbol list from chain (include underlying for live spot price)
        const symbols = [
            { symbol: underlying.symbol, exchange: underlying.indexExchange }
        ];
        optionChain.chain.forEach(row => {
            if (row.ce?.symbol) symbols.push({ symbol: row.ce.symbol, exchange: underlying.exchange });
            if (row.pe?.symbol) symbols.push({ symbol: row.pe.symbol, exchange: underlying.exchange });
        });

        if (symbols.length === 0) return;

        console.log('[OptionChain] Subscribing to', symbols.length, 'option symbols for live LTP');

        // Subscribe to WebSocket
        wsRef.current = subscribeToMultiTicker(symbols, (ticker) => {
            setLiveLTP(prev => {
                const newMap = new Map(prev);
                newMap.set(ticker.symbol, {
                    ltp: ticker.last,
                    volume: ticker.volume,
                    timestamp: Date.now()
                });
                return newMap;
            });
        });

        return () => {
            if (wsRef.current) {
                console.log('[OptionChain] Unsubscribing from live LTP');
                wsRef.current.close();
                wsRef.current = null;
            }
            setLiveLTP(new Map());
        };
    }, [isOpen, optionChain?.chain, underlying.exchange]);

    // Batch fetch Greeks when view mode changes to 'greeks'
    // Uses single batch API call for much faster loading
    const fetchGreeks = useCallback(async () => {
        if (!optionChain?.chain?.length) return;

        // Increment request ID and capture current value to detect stale responses
        const requestId = ++greeksRequestIdRef.current;

        // Collect all option symbols that need Greeks (exclude permanently failed ones)
        const symbolsToFetch = [];
        optionChain.chain.forEach(row => {
            if (row.ce?.symbol && !greeksData.has(row.ce.symbol) && !failedGreeksSymbolsRef.current.has(row.ce.symbol)) {
                symbolsToFetch.push({ symbol: row.ce.symbol, exchange: underlying.exchange });
            }
            if (row.pe?.symbol && !greeksData.has(row.pe.symbol) && !failedGreeksSymbolsRef.current.has(row.pe.symbol)) {
                symbolsToFetch.push({ symbol: row.pe.symbol, exchange: underlying.exchange });
            }
        });

        if (symbolsToFetch.length === 0) return;

        console.log('[OptionChain] Fetching Greeks for', symbolsToFetch.length, 'options using batch API, requestId:', requestId);
        setGreeksLoading(true);

        // Helper to increment retry count and check if should block
        const markSymbolFailed = (symbol) => {
            const currentCount = greeksRetryCountRef.current.get(symbol) || 0;
            const newCount = currentCount + 1;
            greeksRetryCountRef.current.set(symbol, newCount);

            if (newCount >= MAX_GREEKS_RETRY_COUNT) {
                failedGreeksSymbolsRef.current.add(symbol);
                console.log(`[OptionChain] Symbol ${symbol} permanently blocked after ${newCount} failed attempts`);
            } else {
                console.log(`[OptionChain] Symbol ${symbol} failed attempt ${newCount}/${MAX_GREEKS_RETRY_COUNT}`);
            }
        };

        try {
            // Single batch API call instead of many individual calls
            const response = await getMultiOptionGreeks(symbolsToFetch);

            // Check if request is still current
            if (requestId !== greeksRequestIdRef.current) {
                console.log('[OptionChain] Discarding stale Greeks response, requestId:', requestId, 'current:', greeksRequestIdRef.current);
                return;
            }

            if (response && response.data && response.data.length > 0) {
                const newGreeksData = new Map(greeksData);
                const symbolsInResponse = new Set();

                // Map response data to greeksData and track failures
                response.data.forEach(item => {
                    if (item.status === 'success' && item.symbol) {
                        newGreeksData.set(item.symbol, {
                            iv: item.implied_volatility,
                            greeks: item.greeks
                        });
                        symbolsInResponse.add(item.symbol);
                        // Clear retry count on success
                        greeksRetryCountRef.current.delete(item.symbol);
                    } else if (item.symbol) {
                        // Mark failure (with retry counting)
                        markSymbolFailed(item.symbol);
                        symbolsInResponse.add(item.symbol);
                    }
                });

                // Mark any symbols that weren't in the response as failed
                symbolsToFetch.forEach(s => {
                    if (!symbolsInResponse.has(s.symbol) && !newGreeksData.has(s.symbol)) {
                        markSymbolFailed(s.symbol);
                    }
                });

                setGreeksData(newGreeksData);
                console.log('[OptionChain] Greeks batch loaded:', response.summary, '- Total:', newGreeksData.size, ', Permanently failed:', failedGreeksSymbolsRef.current.size);
            } else {
                // API returned null/empty - increment retry count for all requested symbols
                console.log('[OptionChain] Greeks batch returned empty/null, incrementing retry count for', symbolsToFetch.length, 'symbols');
                symbolsToFetch.forEach(s => {
                    markSymbolFailed(s.symbol);
                });
            }
        } catch (error) {
            console.error('[OptionChain] Greeks batch API error:', error);
            // On error, increment retry count for all symbols
            symbolsToFetch.forEach(s => {
                markSymbolFailed(s.symbol);
            });
        } finally {
            if (requestId === greeksRequestIdRef.current) {
                setGreeksLoading(false);
            }
        }
    }, [optionChain?.chain, underlying.exchange, greeksData]);

    // Retry mechanism for failed Greeks - auto-retries missing symbols after delay
    // Only retries symbols that haven't been marked as permanently failed
    const retryFailedGreeks = useCallback(async () => {
        if (!optionChain?.chain?.length) return;

        // Find symbols still missing Greeks data (exclude permanently failed ones)
        const missingSymbols = [];
        optionChain.chain.forEach(row => {
            if (row.ce?.symbol && !greeksData.has(row.ce.symbol) && !failedGreeksSymbolsRef.current.has(row.ce.symbol)) {
                missingSymbols.push({ symbol: row.ce.symbol, exchange: underlying.exchange });
            }
            if (row.pe?.symbol && !greeksData.has(row.pe.symbol) && !failedGreeksSymbolsRef.current.has(row.pe.symbol)) {
                missingSymbols.push({ symbol: row.pe.symbol, exchange: underlying.exchange });
            }
        });

        if (missingSymbols.length === 0) {
            console.log('[OptionChain] No more Greeks to retry (permanently failed:', failedGreeksSymbolsRef.current.size, ')');
            return;
        }

        console.log('[OptionChain] Retrying', missingSymbols.length, 'missing Greeks...');
        setGreeksLoading(true);

        // Wait 2 seconds to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));

        // Helper to increment retry count and check if should block
        const markSymbolFailed = (symbol) => {
            const currentCount = greeksRetryCountRef.current.get(symbol) || 0;
            const newCount = currentCount + 1;
            greeksRetryCountRef.current.set(symbol, newCount);

            if (newCount >= MAX_GREEKS_RETRY_COUNT) {
                failedGreeksSymbolsRef.current.add(symbol);
                console.log(`[OptionChain] Symbol ${symbol} permanently blocked after ${newCount} failed attempts`);
            }
        };

        const requestId = greeksRequestIdRef.current;
        try {
            const response = await getMultiOptionGreeks(missingSymbols);

            if (requestId !== greeksRequestIdRef.current) return;

            if (response && response.data && response.data.length > 0) {
                const newGreeksData = new Map(greeksData);
                const symbolsInResponse = new Set();

                response.data.forEach(item => {
                    if (item.status === 'success' && item.symbol) {
                        newGreeksData.set(item.symbol, {
                            iv: item.implied_volatility,
                            greeks: item.greeks
                        });
                        symbolsInResponse.add(item.symbol);
                        // Clear retry count on success
                        greeksRetryCountRef.current.delete(item.symbol);
                    } else if (item.symbol) {
                        // Increment retry count
                        markSymbolFailed(item.symbol);
                        symbolsInResponse.add(item.symbol);
                    }
                });

                // Mark any symbols not in response
                missingSymbols.forEach(s => {
                    if (!symbolsInResponse.has(s.symbol) && !newGreeksData.has(s.symbol)) {
                        markSymbolFailed(s.symbol);
                    }
                });

                setGreeksData(newGreeksData);
                console.log('[OptionChain] Retry loaded:', response.summary, '- Permanently failed:', failedGreeksSymbolsRef.current.size);
            } else {
                // API returned null/empty - increment retry count
                console.log('[OptionChain] Retry returned empty, incrementing retry count for', missingSymbols.length, 'symbols');
                missingSymbols.forEach(s => {
                    markSymbolFailed(s.symbol);
                });
            }
        } catch (error) {
            console.error('[OptionChain] Retry failed:', error);
            // On error, increment retry count
            missingSymbols.forEach(s => {
                markSymbolFailed(s.symbol);
            });
        } finally {
            if (requestId === greeksRequestIdRef.current) {
                setGreeksLoading(false);
            }
        }
    }, [optionChain?.chain, underlying.exchange, greeksData]);


    // Trigger Greeks fetch when switching to greeks view
    useEffect(() => {
        if (isOpen && viewMode === 'greeks' && optionChain?.chain?.length > 0) {
            fetchGreeks();
        }
    }, [isOpen, viewMode, optionChain?.chain]);

    // Auto-retry missing Greeks after initial fetch completes (max 3 retries)
    // Excludes symbols already marked as permanently failed (no trading data)
    useEffect(() => {
        if (!isOpen || viewMode !== 'greeks' || greeksLoading || greeksData.size === 0) return;

        // Check if there are still missing Greeks (excluding permanently failed ones)
        const hasMissing = optionChain?.chain?.some(row =>
            (row.ce?.symbol && !greeksData.has(row.ce.symbol) && !failedGreeksSymbolsRef.current.has(row.ce.symbol)) ||
            (row.pe?.symbol && !greeksData.has(row.pe.symbol) && !failedGreeksSymbolsRef.current.has(row.pe.symbol))
        );

        if (hasMissing) {
            console.log('[OptionChain] Some Greeks missing (excluding failed), scheduling retry...');
            const timeoutId = setTimeout(() => {
                retryFailedGreeks();
            }, 500);
            return () => clearTimeout(timeoutId);
        } else if (failedGreeksSymbolsRef.current.size > 0) {
            console.log('[OptionChain] All retryable Greeks loaded. Permanently failed:', failedGreeksSymbolsRef.current.size, 'symbols');
        }
    }, [isOpen, viewMode, greeksLoading, greeksData.size, optionChain?.chain, retryFailedGreeks]);

    // Clear Greeks cache and invalidate pending requests when expiry changes or modal closes
    useEffect(() => {
        if (!isOpen) {
            // Modal closed - invalidate pending requests and reset state
            greeksRequestIdRef.current++;
            setGreeksData(new Map());
            failedGreeksSymbolsRef.current = new Set(); // Clear failed symbols
            greeksRetryCountRef.current = new Map(); // Reset retry counts
            setViewMode('ltp-oi'); // Reset view mode for next open
            console.log('[OptionChain] Modal closed - Greeks state reset');
            return;
        }
    }, [isOpen]);

    // Clear Greeks cache when expiry changes
    useEffect(() => {
        greeksRequestIdRef.current++; // Invalidate any pending Greeks requests
        setGreeksData(new Map());
        failedGreeksSymbolsRef.current = new Set(); // Clear failed symbols for new expiry
        greeksRetryCountRef.current = new Map(); // Reset retry counts for new expiry
    }, [selectedExpiry]);



    // Chain data
    const chainData = useMemo(() => optionChain?.chain || [], [optionChain]);
    const atmStrike = optionChain?.atmStrike || 0;
    const underlyingLTP = optionChain?.underlyingLTP || 0;

    // Max OI for bars
    const maxOI = useMemo(() => {
        let max = 0;
        chainData.forEach(row => {
            if (row.ce?.oi > max) max = row.ce.oi;
            if (row.pe?.oi > max) max = row.pe.oi;
        });
        return max || 1;
    }, [chainData]);

    const atmIndex = useMemo(() => chainData.findIndex(row => row.strike === atmStrike), [chainData, atmStrike]);

    const { aboveATM, belowATM } = useMemo(() => {
        if (atmIndex === -1) return { aboveATM: chainData, belowATM: [] };
        return { aboveATM: chainData.slice(0, atmIndex + 1), belowATM: chainData.slice(atmIndex + 1) };
    }, [chainData, atmIndex]);

    const handleOptionClick = useCallback((symbol) => {
        if (!symbol) return;
        onSelectOption(symbol, underlying.exchange);
        onClose();
    }, [underlying.exchange, onSelectOption, onClose]);

    // Keyboard navigation handler
    const handleKeyDown = useCallback((e) => {
        if (chainData.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedRow(prev => prev < 0 ? 0 : Math.min(prev + 1, chainData.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedRow(prev => prev < 0 ? 0 : Math.max(prev - 1, 0));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            setFocusedCol(prev => prev === 'ce' ? 'pe' : 'ce');
        } else if (e.key === 'Enter' && focusedRow >= 0 && focusedRow < chainData.length) {
            e.preventDefault();
            const row = chainData[focusedRow];
            const symbol = focusedCol === 'ce' ? row.ce?.symbol : row.pe?.symbol;
            if (symbol) handleOptionClick(symbol);
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [chainData, focusedRow, focusedCol, handleOptionClick, onClose]);

    // Click handler that also updates focus
    const handleCellClick = useCallback((rowIndex, col, symbol) => {
        setFocusedRow(rowIndex);
        setFocusedCol(col);
        handleOptionClick(symbol);
    }, [handleOptionClick]);

    // Helper functions (component-specific, keep inline)
    const getOIBarWidth = (oi) => oi ? Math.min((oi / maxOI) * 100, 100) : 0;

    const formatSpotChange = () => {
        // Get live spot price or fall back to REST data
        const liveSpot = liveLTP.get(underlying.symbol);
        const spotLTP = liveSpot?.ltp ?? underlyingLTP;

        const prevClose = optionChain?.underlyingPrevClose || 0;
        const change = prevClose > 0 ? spotLTP - prevClose : (optionChain?.change || 0);
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : (optionChain?.changePercent || 0);
        const isPositive = change >= 0;

        return {
            price: spotLTP.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            change: (isPositive ? '+' : '') + change.toFixed(2),
            percent: (isPositive ? '+' : '') + changePercent.toFixed(2) + '%',
            isPositive
        };
    };

    // Calculate LTP change percentage
    const getLtpChange = (data) => {
        if (!data?.ltp || !data?.prevClose) return null;
        const change = ((data.ltp - data.prevClose) / data.prevClose) * 100;
        return change;
    };

    const renderRow = (row, isITM_CE, isITM_PE, rowIndex) => {
        // Get live LTP from WebSocket or fall back to REST data
        const ceLive = liveLTP.get(row.ce?.symbol);
        const peLive = liveLTP.get(row.pe?.symbol);

        const ceLTP = ceLive?.ltp ?? row.ce?.ltp;
        const peLTP = peLive?.ltp ?? row.pe?.ltp;

        const ceOIWidth = getOIBarWidth(row.ce?.oi);
        const peOIWidth = getOIBarWidth(row.pe?.oi);
        const isRowFocused = rowIndex === focusedRow;
        const ceClickHandler = () => handleCellClick(rowIndex, 'ce', row.ce?.symbol);
        const peClickHandler = () => handleCellClick(rowIndex, 'pe', row.pe?.symbol);

        // Calculate LTP change using live LTP if available
        const ceLtpChange = row.ce?.prevClose && ceLTP
            ? ((ceLTP - row.ce.prevClose) / row.ce.prevClose) * 100
            : getLtpChange(row.ce);
        const peLtpChange = row.pe?.prevClose && peLTP
            ? ((peLTP - row.pe.prevClose) / row.pe.prevClose) * 100
            : getLtpChange(row.pe);

        return (
            <div key={row.strike} className={classNames(styles.row, {
                [styles.itmCE]: isITM_CE,
                [styles.itmPE]: isITM_PE,
                [styles.focused]: isRowFocused
            })}>
                {/* CALLS - Combined OI + LTP */}
                <div className={classNames(styles.cell, styles.combinedCell, styles.combinedCellLeft, styles.clickable, {
                    [styles.focusedCell]: isRowFocused && focusedCol === 'ce'
                })} onClick={ceClickHandler}>
                    {/* OI with bar */}
                    <div className={styles.oiSection}>
                        <div className={styles.oiBarWrapperLeft}>
                            <div className={styles.oiBarGreen} style={{ width: `${ceOIWidth}%` }}></div>
                        </div>
                        <span className={styles.oiValue}>{formatOI(row.ce?.oi)}</span>
                    </div>
                    {/* LTP with change */}
                    <div className={styles.ltpSection}>
                        <span className={styles.ltpValue}>{formatLTP(ceLTP)}</span>
                        {ceLtpChange !== null && (
                            <span className={classNames(styles.ltpChange, ceLtpChange >= 0 ? styles.changePositive : styles.changeNegative)}>
                                {formatLtpChange(ceLtpChange)}
                            </span>
                        )}
                    </div>
                </div>

                {/* STRIKE */}
                <div className={classNames(styles.cell, styles.strikeCell)}>
                    {row.strike.toLocaleString('en-IN')}
                </div>

                {/* PUTS - Combined LTP + OI */}
                <div className={classNames(styles.cell, styles.combinedCell, styles.combinedCellRight, styles.clickable, {
                    [styles.focusedCell]: isRowFocused && focusedCol === 'pe'
                })} onClick={peClickHandler}>
                    {/* LTP with change */}
                    <div className={styles.ltpSection}>
                        <span className={styles.ltpValue}>{formatLTP(peLTP)}</span>
                        {peLtpChange !== null && (
                            <span className={classNames(styles.ltpChange, peLtpChange >= 0 ? styles.changePositive : styles.changeNegative)}>
                                {formatLtpChange(peLtpChange)}
                            </span>
                        )}
                    </div>
                    {/* OI with bar */}
                    <div className={styles.oiSection}>
                        <div className={styles.oiBarWrapperRight}>
                            <div className={styles.oiBarRed} style={{ width: `${peOIWidth}%` }}></div>
                        </div>
                        <span className={styles.oiValue}>{formatOI(row.pe?.oi)}</span>
                    </div>
                </div>
            </div>
        );
    };

    // Render Greeks row
    const renderGreeksRow = (row, isITM_CE, isITM_PE, rowIndex) => {
        const ceLive = liveLTP.get(row.ce?.symbol);
        const peLive = liveLTP.get(row.pe?.symbol);
        const ceLTP = ceLive?.ltp ?? row.ce?.ltp;
        const peLTP = peLive?.ltp ?? row.pe?.ltp;

        const ceGreeks = greeksData.get(row.ce?.symbol);
        const peGreeks = greeksData.get(row.pe?.symbol);

        const isRowFocused = rowIndex === focusedRow;
        const ceClickHandler = () => handleCellClick(rowIndex, 'ce', row.ce?.symbol);
        const peClickHandler = () => handleCellClick(rowIndex, 'pe', row.pe?.symbol);

        return (
            <div key={row.strike} className={classNames(styles.rowGreeks, {
                [styles.itmCE]: isITM_CE,
                [styles.itmPE]: isITM_PE,
                [styles.focused]: isRowFocused
            })}>
                {/* CALLS - Gamma, Vega, Theta, Delta, LTP */}
                <div className={classNames(styles.greeksCell, {
                    [styles.focusedCell]: isRowFocused && focusedCol === 'ce'
                })} onClick={ceClickHandler}>
                    <span className={classNames(styles.greekValue, styles.muted)}>
                        {formatGamma(ceGreeks?.greeks?.gamma)}
                    </span>
                    <span className={styles.greekValue}>
                        {formatVega(ceGreeks?.greeks?.vega)}
                    </span>
                    <span className={classNames(styles.greekValue, styles.greekTheta)}>
                        {formatTheta(ceGreeks?.greeks?.theta)}
                    </span>
                    <span className={classNames(styles.greekValue, styles.greekDeltaPositive)}>
                        {formatDelta(ceGreeks?.greeks?.delta)}
                    </span>
                    <span className={styles.greekLtp}>{formatLTP(ceLTP)}</span>
                </div>

                {/* STRIKE with IV */}
                <div className={styles.strikeCellGreeks}>
                    <span>{row.strike.toLocaleString('en-IN')}</span>
                    <span className={styles.strikeIv}>
                        {ceGreeks?.iv ? formatIv(ceGreeks.iv) : ''}
                    </span>
                </div>

                {/* PUTS - LTP, Delta, Theta, Vega, Gamma */}
                <div className={classNames(styles.greeksCell, {
                    [styles.focusedCell]: isRowFocused && focusedCol === 'pe'
                })} onClick={peClickHandler}>
                    <span className={styles.greekLtp}>{formatLTP(peLTP)}</span>
                    <span className={classNames(styles.greekValue, styles.greekDeltaNegative)}>
                        {formatDelta(peGreeks?.greeks?.delta)}
                    </span>
                    <span className={classNames(styles.greekValue, styles.greekTheta)}>
                        {formatTheta(peGreeks?.greeks?.theta)}
                    </span>
                    <span className={styles.greekValue}>
                        {formatVega(peGreeks?.greeks?.vega)}
                    </span>
                    <span className={classNames(styles.greekValue, styles.muted)}>
                        {formatGamma(peGreeks?.greeks?.gamma)}
                    </span>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;


    const spotInfo = formatSpotChange();

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={classNames(styles.modal, { [styles.modalWide]: viewMode === 'greeks' })} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <ChevronLeft size={20} className={styles.backIcon} onClick={onClose} />
                        <select
                            className={styles.headerSelect}
                            value={underlying.symbol}
                            onChange={(e) => {
                                const found = UNDERLYINGS.find(u => u.symbol === e.target.value);
                                if (found) {
                                    setUnderlying(found);
                                    setIsCustomSymbol(false);
                                    setSelectedExpiry(null);
                                    setOptionChain(null);
                                }
                            }}
                        >
                            {isCustomSymbol && (
                                <option key={underlying.symbol} value={underlying.symbol}>
                                    {underlying.symbol}
                                </option>
                            )}
                            {UNDERLYINGS.map(u => (
                                <option key={u.symbol} value={u.symbol}>{u.symbol}</option>
                            ))}
                        </select>
                        <span className={styles.headerTitle}>Options</span>
                        <button className={styles.refreshBtnHeader} onClick={fetchChain} disabled={isLoading || !selectedExpiry}>
                            <RefreshCw size={16} className={isLoading ? styles.spin : ''} />
                        </button>
                    </div>
                    <div className={styles.headerRight}>
                        {/* View Mode Toggle */}
                        <div className={styles.viewToggle}>
                            <button
                                className={classNames(styles.viewToggleBtn, { [styles.viewToggleBtnActive]: viewMode === 'ltp-oi' })}
                                onClick={() => setViewMode('ltp-oi')}
                            >
                                LTP & OI
                            </button>
                            <button
                                className={classNames(styles.viewToggleBtn, { [styles.viewToggleBtnActive]: viewMode === 'greeks' })}
                                onClick={() => setViewMode('greeks')}
                            >
                                Greeks
                            </button>
                        </div>
                        {greeksLoading && (
                            <div className={styles.greeksLoading}>
                                <Loader2 size={14} className={styles.spin} />
                                <span>Loading Greeks...</span>
                            </div>
                        )}
                        <button className={styles.closeBtn} onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Expiry Picker */}
                <div className={styles.expiryPicker}>
                    {canScrollLeft && (
                        <button className={styles.scrollBtn} onClick={() => setExpiryScrollIndex(prev => Math.max(0, prev - 11))}>
                            <ChevronLeft size={14} />
                        </button>
                    )}

                    <div className={styles.expiryGrid}>
                        {visibleData.groups.map((group, idx) => (
                            <div key={idx} className={styles.monthColumn}>
                                <span className={styles.monthLabel}>{group.monthYear}</span>
                                <div className={styles.dateGroup}>
                                    {group.dates.map((d) => (
                                        <button
                                            key={d.expiry}
                                            className={classNames(styles.dateBtn, {
                                                [styles.activeDate]: selectedExpiry === d.expiry
                                            })}
                                            onClick={() => setSelectedExpiry(d.expiry)}
                                        >
                                            {d.day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {canScrollRight && (
                        <button className={styles.scrollBtn} onClick={() => setExpiryScrollIndex(prev => prev + visibleData.scrollAmount)}>
                            <ChevronRight size={14} />
                        </button>
                    )}
                </div>

                {/* Column Headers - conditional based on view mode */}
                {viewMode === 'ltp-oi' ? (
                    <div className={styles.colHeaders}>
                        <div className={styles.colHeaderCalls}>
                            <span className={styles.colHeaderLabel}>CALLS</span>
                            <span className={styles.colHeaderSub}>OI · LTP</span>
                        </div>
                        <span className={styles.colHeaderStrike}>STRIKE</span>
                        <div className={styles.colHeaderPuts}>
                            <span className={styles.colHeaderLabel}>PUTS</span>
                            <span className={styles.colHeaderSub}>LTP · OI</span>
                        </div>
                    </div>
                ) : (
                    <div className={styles.colHeadersGreeks}>
                        <div className={styles.greeksHeaderGroup}>
                            <span className={styles.greeksHeaderLabel}>Gamma</span>
                            <span className={styles.greeksHeaderLabel}>Vega</span>
                            <span className={styles.greeksHeaderLabel}>Theta</span>
                            <span className={styles.greeksHeaderLabel}>Delta</span>
                            <span className={styles.greeksHeaderLabel}>LTP</span>
                        </div>
                        <span className={styles.colHeaderStrike}>STRIKE<br /><small>IV</small></span>
                        <div className={styles.greeksHeaderGroup}>
                            <span className={styles.greeksHeaderLabel}>LTP</span>
                            <span className={styles.greeksHeaderLabel}>Delta</span>
                            <span className={styles.greeksHeaderLabel}>Theta</span>
                            <span className={styles.greeksHeaderLabel}>Vega</span>
                            <span className={styles.greeksHeaderLabel}>Gamma</span>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className={styles.tableContainer}>
                    {isLoading ? (
                        <div className={styles.loading}>
                            <Loader2 size={28} className={styles.spin} />
                            <p>Loading option chain...</p>
                        </div>
                    ) : error ? (
                        <div className={styles.error}>
                            <p>{error}</p>
                            <button onClick={fetchChain}>Retry</button>
                        </div>
                    ) : chainData.length === 0 ? (
                        <div className={styles.empty}>
                            <p>No options found</p>
                            <span>Select an expiry to load option chain</span>
                        </div>
                    ) : (
                        <div
                            className={styles.tableBody}
                            ref={tableBodyRef}
                            tabIndex={0}
                            onKeyDown={handleKeyDown}
                        >
                            {/* Load more strikes button - TOP */}
                            {strikeCount < MAX_STRIKE_COUNT && (
                                <button
                                    className={styles.loadMoreBtn}
                                    onClick={loadMoreStrikes}
                                    disabled={isLoadingMore}
                                >
                                    {isLoadingMore ? (
                                        <Loader2 size={14} className={styles.spin} />
                                    ) : (
                                        <ChevronUp size={14} />
                                    )}
                                    <span>Load more strikes</span>
                                </button>
                            )}

                            {aboveATM.map((row, idx) =>
                                viewMode === 'greeks'
                                    ? renderGreeksRow(row, row.strike < atmStrike, false, idx)
                                    : renderRow(row, row.strike < atmStrike, false, idx)
                            )}

                            {optionChain && (
                                <div className={styles.spotBar} data-spot-bar="true">
                                    <div className={styles.spotLine}></div>
                                    <div className={styles.spotBadge}>
                                        <span>Spot price</span>
                                        <strong>{spotInfo.price}</strong>
                                        <span className={classNames(styles.spotChange, { [styles.positive]: spotInfo.isPositive, [styles.negative]: !spotInfo.isPositive })}>
                                            {spotInfo.change} ({spotInfo.percent})
                                        </span>
                                    </div>
                                    <div className={styles.spotLine}></div>
                                </div>
                            )}

                            {belowATM.map((row, idx) =>
                                viewMode === 'greeks'
                                    ? renderGreeksRow(row, false, row.strike > atmStrike, aboveATM.length + idx)
                                    : renderRow(row, false, row.strike > atmStrike, aboveATM.length + idx)
                            )}


                            {/* Load more strikes button - BOTTOM */}
                            {strikeCount < MAX_STRIKE_COUNT && (
                                <button
                                    className={styles.loadMoreBtn}
                                    onClick={loadMoreStrikes}
                                    disabled={isLoadingMore}
                                >
                                    {isLoadingMore ? (
                                        <Loader2 size={14} className={styles.spin} />
                                    ) : (
                                        <ChevronDown size={14} />
                                    )}
                                    <span>Load more strikes</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(OptionChainModal);
