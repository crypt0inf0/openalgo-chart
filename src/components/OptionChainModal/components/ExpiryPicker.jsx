import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import classNames from 'classnames';
import styles from '../OptionChainModal.module.css';

/**
 * Parse expiry date string into components
 */
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

/**
 * ExpiryPicker Component
 * Displays expiry dates grouped by month with horizontal scrolling
 */
export function ExpiryPicker({
    availableExpiries,
    selectedExpiry,
    onSelectExpiry,
    expiryScrollIndex,
    onScrollIndexChange,
}) {
    // Group expiries by month
    const groupedExpiries = useMemo(() => {
        const groups = [];
        let currentMonth = '';
        let currentYear = 0;
        let lastDisplayedYear = new Date().getFullYear();

        availableExpiries.forEach((exp) => {
            const parsed = parseExpiry(exp);
            const monthKey = `${parsed.month}-${parsed.year}`;

            if (monthKey !== `${currentMonth}-${currentYear}`) {
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

    // Visible groups based on scroll
    const visibleData = useMemo(() => {
        const maxDates = 12;
        const result = [];
        let dateCount = 0;
        let skipCount = expiryScrollIndex;
        let lastDisplayedYear = new Date().getFullYear();

        for (const group of groupedExpiries) {
            if (dateCount >= maxDates) break;

            if (skipCount >= group.dates.length) {
                skipCount -= group.dates.length;
                continue;
            }

            const startIdx = skipCount;
            skipCount = 0;

            const remainingSlots = maxDates - dateCount;
            const datesToTake = Math.min(group.dates.length - startIdx, remainingSlots);

            const firstDate = group.dates[startIdx];
            const expDate = new Date(firstDate.expiry);
            const month = expDate.toLocaleString('en-US', { month: 'short' });
            const year = expDate.getFullYear();

            const showYear = year !== lastDisplayedYear;
            const monthLabel = showYear ? `${month} '${String(year).slice(-2)}` : month;
            if (showYear) lastDisplayedYear = year;

            result.push({
                monthYear: monthLabel,
                dates: group.dates.slice(startIdx, startIdx + datesToTake)
            });

            dateCount += datesToTake;
        }

        const totalVisibleDates = dateCount;

        return { groups: result, scrollAmount: Math.max(1, totalVisibleDates - 1) };
    }, [groupedExpiries, expiryScrollIndex]);

    const totalExpiries = availableExpiries.length;
    const canScrollLeft = expiryScrollIndex > 0;
    const canScrollRight = expiryScrollIndex + 12 < totalExpiries;

    return (
        <div className={styles.expiryPicker}>
            {canScrollLeft && (
                <button
                    className={styles.scrollBtn}
                    onClick={() => onScrollIndexChange(Math.max(0, expiryScrollIndex - 11))}
                >
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
                                    onClick={() => onSelectExpiry(d.expiry)}
                                >
                                    {d.day}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {canScrollRight && (
                <button
                    className={styles.scrollBtn}
                    onClick={() => onScrollIndexChange(expiryScrollIndex + visibleData.scrollAmount)}
                >
                    <ChevronRight size={14} />
                </button>
            )}
        </div>
    );
}

export default ExpiryPicker;
