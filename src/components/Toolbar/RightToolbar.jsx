import React from 'react';
import { List, Clock, TrendingUp, Layers, ArrowLeftRight } from 'lucide-react';
import styles from './RightToolbar.module.css';
import classNames from 'classnames';

const RightToolbar = ({ activePanel, onPanelChange, badges = {} }) => {
    const tools = [
        { id: 'watchlist', icon: List, label: 'Watchlist' },
        { id: 'position_tracker', icon: TrendingUp, label: 'Position Flow' },
        { id: 'alerts', icon: Clock, label: 'Alerts' },
        { id: 'dom', icon: Layers, label: 'Depth of Market' },
        { id: 'trade', icon: ArrowLeftRight, label: 'Trade Panel' },
    ];

    const handleToolClick = (id) => {
        if (activePanel === id) {
            onPanelChange(null); // Toggle off if already active
        } else {
            onPanelChange(id);
        }
    };

    return (
        <div className={styles.toolbar}>
            {tools.map((tool) => (
                <div
                    key={tool.id}
                    className={classNames(styles.tool, { [styles.active]: activePanel === tool.id })}
                    onClick={() => handleToolClick(tool.id)}
                    title={tool.label}
                >
                    <tool.icon size={20} strokeWidth={1.5} />
                    {badges[tool.id] > 0 && (
                        <span className={styles.badge}>{badges[tool.id]}</span>
                    )}
                </div>
            ))}
        </div>
    );
};

export default RightToolbar;
