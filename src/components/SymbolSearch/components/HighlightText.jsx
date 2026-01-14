/**
 * HighlightText Component
 * Highlights matching text in search results
 */
import React from 'react';
import styles from '../SymbolSearch.module.css';

/**
 * Escape special regex characters to prevent crashes
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Highlight matching text
 * @param {Object} props
 * @param {string} props.text - Text to display
 * @param {string} props.highlight - Text to highlight
 * @returns {JSX.Element}
 */
export const HighlightText = ({ text, highlight }) => {
    if (!highlight || !text) return <>{text}</>;

    const regex = new RegExp(`(${escapeRegex(highlight)})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span key={i} className={styles.highlight}>{part}</span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};

export default HighlightText;
