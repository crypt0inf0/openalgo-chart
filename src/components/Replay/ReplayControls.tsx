import React from 'react';
import { Play, Pause, SkipForward, X } from 'lucide-react';
import styles from './ReplayControls.module.css';

export interface ReplayControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    onForward: () => void;
    onClose: () => void;
}

const ReplayControls: React.FC<ReplayControlsProps> = ({
    isPlaying,
    onPlayPause,
    onForward,
    onClose,
}) => (
    <div className={styles.container}>
        <div className={styles.dragHandle}>
            <div className={styles.title}>Replay</div>
        </div>

        <div className={styles.controls}>
            <button className={styles.button} onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button className={styles.button} onClick={onForward} title="Step forward one bar" disabled={isPlaying}>
                <SkipForward size={18} />
            </button>

            <div className={styles.separator} />

            <button className={`${styles.button} ${styles.closeButton}`} onClick={onClose} title="Exit Replay">
                <X size={18} />
            </button>
        </div>
    </div>
);

export default ReplayControls;
