import React from 'react';
import classNames from 'classnames';
import styles from '../OptionChainModal.module.css';

/**
 * Format helpers
 */
export const formatOI = (oi) => {
    if (!oi && oi !== 0) return '-';
    if (oi >= 100000) return (oi / 100000).toFixed(2) + 'L';
    if (oi >= 1000) return (oi / 1000).toFixed(2) + 'K';
    return oi.toLocaleString('en-IN');
};

export const formatLTP = (ltp) => (!ltp && ltp !== 0) ? '-' : ltp.toFixed(2);

export const formatLtpChange = (change) => {
    if (change === null || change === undefined) return null;
    const sign = change >= 0 ? '+' : '';
    return sign + change.toFixed(2) + '%';
};

export const formatGreek = (value, decimals = 4) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(decimals);
};

export const formatDelta = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(2);
};

export const formatIv = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(1) + '%';
};

export const formatTheta = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(0);
};

export const formatVega = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(0);
};

export const formatGamma = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(4);
};

/**
 * Standard LTP/OI Row Component
 */
export function OptionChainRow({
    row,
    isITM_CE,
    isITM_PE,
    rowIndex,
    focusedRow,
    focusedCol,
    maxOI,
    liveLTP,
    onCellClick,
}) {
    const ceLive = liveLTP.get(row.ce?.symbol);
    const peLive = liveLTP.get(row.pe?.symbol);

    const ceLTP = ceLive?.ltp ?? row.ce?.ltp;
    const peLTP = peLive?.ltp ?? row.pe?.ltp;

    const ceOIWidth = row.ce?.oi ? Math.min((row.ce.oi / maxOI) * 100, 100) : 0;
    const peOIWidth = row.pe?.oi ? Math.min((row.pe.oi / maxOI) * 100, 100) : 0;
    const isRowFocused = rowIndex === focusedRow;

    // Calculate LTP change
    const ceLtpChange = row.ce?.prevClose && ceLTP
        ? ((ceLTP - row.ce.prevClose) / row.ce.prevClose) * 100
        : null;
    const peLtpChange = row.pe?.prevClose && peLTP
        ? ((peLTP - row.pe.prevClose) / row.pe.prevClose) * 100
        : null;

    return (
        <div className={classNames(styles.row, {
            [styles.itmCE]: isITM_CE,
            [styles.itmPE]: isITM_PE,
            [styles.focused]: isRowFocused
        })}>
            {/* CALLS */}
            <div
                className={classNames(styles.cell, styles.combinedCell, styles.combinedCellLeft, styles.clickable, {
                    [styles.focusedCell]: isRowFocused && focusedCol === 'ce'
                })}
                onClick={() => onCellClick(rowIndex, 'ce', row.ce?.symbol)}
            >
                <div className={styles.oiSection}>
                    <div className={styles.oiBarWrapperLeft}>
                        <div className={styles.oiBarGreen} style={{ width: `${ceOIWidth}%` }}></div>
                    </div>
                    <span className={styles.oiValue}>{formatOI(row.ce?.oi)}</span>
                </div>
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

            {/* PUTS */}
            <div
                className={classNames(styles.cell, styles.combinedCell, styles.combinedCellRight, styles.clickable, {
                    [styles.focusedCell]: isRowFocused && focusedCol === 'pe'
                })}
                onClick={() => onCellClick(rowIndex, 'pe', row.pe?.symbol)}
            >
                <div className={styles.ltpSection}>
                    <span className={styles.ltpValue}>{formatLTP(peLTP)}</span>
                    {peLtpChange !== null && (
                        <span className={classNames(styles.ltpChange, peLtpChange >= 0 ? styles.changePositive : styles.changeNegative)}>
                            {formatLtpChange(peLtpChange)}
                        </span>
                    )}
                </div>
                <div className={styles.oiSection}>
                    <div className={styles.oiBarWrapperRight}>
                        <div className={styles.oiBarRed} style={{ width: `${peOIWidth}%` }}></div>
                    </div>
                    <span className={styles.oiValue}>{formatOI(row.pe?.oi)}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Greeks Row Component
 */
export function OptionChainGreeksRow({
    row,
    isITM_CE,
    isITM_PE,
    rowIndex,
    focusedRow,
    focusedCol,
    liveLTP,
    greeksData,
    onCellClick,
}) {
    const ceLive = liveLTP.get(row.ce?.symbol);
    const peLive = liveLTP.get(row.pe?.symbol);
    const ceLTP = ceLive?.ltp ?? row.ce?.ltp;
    const peLTP = peLive?.ltp ?? row.pe?.ltp;

    const ceGreeks = greeksData.get(row.ce?.symbol);
    const peGreeks = greeksData.get(row.pe?.symbol);

    const isRowFocused = rowIndex === focusedRow;

    return (
        <div className={classNames(styles.rowGreeks, {
            [styles.itmCE]: isITM_CE,
            [styles.itmPE]: isITM_PE,
            [styles.focused]: isRowFocused
        })}>
            {/* CALLS - Gamma, Vega, Theta, Delta, LTP */}
            <div
                className={classNames(styles.greeksCell, {
                    [styles.focusedCell]: isRowFocused && focusedCol === 'ce'
                })}
                onClick={() => onCellClick(rowIndex, 'ce', row.ce?.symbol)}
            >
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
            <div
                className={classNames(styles.greeksCell, {
                    [styles.focusedCell]: isRowFocused && focusedCol === 'pe'
                })}
                onClick={() => onCellClick(rowIndex, 'pe', row.pe?.symbol)}
            >
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
}

export default OptionChainRow;
