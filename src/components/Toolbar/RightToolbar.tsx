import React from 'react';
import type { ComponentType } from 'react';
import { List, Clock, TrendingUp, Layers, ArrowLeftRight, Brain, Filter, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './RightToolbar.module.css';
import classNames from 'classnames';

interface ToolItem {
    id: string;
    icon: LucideIcon;
    label: string;
}

export interface RightToolbarProps {
    activePanel: string | null;
    onPanelChange: (panelId: string | null) => void;
    badges?: Record<string, number>;
}

const RightToolbar: React.FC<RightToolbarProps> = ({ activePanel, onPanelChange, badges = {} }) => {
    const tools: ToolItem[] = [
        { id: 'watchlist', icon: List, label: 'Watchlist' },
        { id: 'objectTree', icon: Layers, label: 'Object Tree' },
        { id: 'screener', icon: Filter, label: 'Market Screener' },
        { id: 'position_tracker', icon: TrendingUp, label: 'Position Flow' },
        { id: 'ann_scanner', icon: Brain, label: 'ANN Scanner' },
        { id: 'cpr_scanner', icon: Target, label: 'CPR Scanner' },
        { id: 'alerts', icon: Clock, label: 'Alerts' },
        { id: 'dom', icon: Layers, label: 'Depth of Market' },
        { id: 'trade', icon: ArrowLeftRight, label: 'Trade Panel' },
    ];

    const handleToolClick = (id: string): void => {
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
