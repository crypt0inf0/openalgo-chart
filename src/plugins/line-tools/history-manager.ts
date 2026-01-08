import { ToolType } from './line-tool-manager';
import { LogicalPoint } from './tools/polyline';

/**
 * Represents the state of a tool at a point in time
 */
export interface ToolState {
    points: LogicalPoint[];
    options: Record<string, any>;
}

/**
 * Types of actions that can be undone/redone
 */
type ActionType = 'add' | 'delete' | 'modify';

/**
 * Represents a single action in the history
 */
export interface HistoryAction {
    type: ActionType;
    tool: any;
    toolType: ToolType;
    prevState?: ToolState;  // State before the action (for undo)
    newState?: ToolState;   // State after the action (for redo)
}

/**
 * Extracts the current state from a tool for history tracking
 */
export function extractToolState(tool: any): ToolState | null {
    if (!tool) return null;
    
    const points: LogicalPoint[] = [];

    try {
        // Extract points based on tool structure with validation (B-6)
        if (tool._points && Array.isArray(tool._points)) {
            // Multi-point tools (Polyline, ParallelChannel, FibRetracement, etc.)
            tool._points.forEach((p: LogicalPoint) => {
                if (p && typeof p.logical === 'number' && typeof p.price === 'number') {
                    points.push({ logical: p.logical, price: p.price });
                }
            });
        } else if (tool._p1 && tool._p2 && tool._p3) {
            // Three-point tools (Triangle, LongPosition, ShortPosition, etc.)
            if (tool._p1.logical !== undefined && typeof tool._p1.price === 'number') {
                points.push({ logical: tool._p1.logical, price: tool._p1.price });
            }
            if (tool._p2.logical !== undefined && typeof tool._p2.price === 'number') {
                points.push({ logical: tool._p2.logical, price: tool._p2.price });
            }
            if (tool._p3.logical !== undefined && typeof tool._p3.price === 'number') {
                points.push({ logical: tool._p3.logical, price: tool._p3.price });
            }
        } else if (tool._p1 && tool._p2) {
            // Two-point tools (TrendLine, Rectangle, Circle, etc.)
            if (tool._p1.logical !== undefined && typeof tool._p1.price === 'number') {
                points.push({ logical: tool._p1.logical, price: tool._p1.price });
            }
            if (tool._p2.logical !== undefined && typeof tool._p2.price === 'number') {
                points.push({ logical: tool._p2.logical, price: tool._p2.price });
            }
        } else if (tool._point) {
            // Single-point tools (Text, PriceLabel)
            if (tool._point.logical !== undefined && typeof tool._point.price === 'number') {
                points.push({ logical: tool._point.logical, price: tool._point.price });
            }
        } else if (tool._price !== undefined && typeof tool._price === 'number') {
            // HorizontalLine
            points.push({ logical: 0, price: tool._price });
        } else if (tool._logical !== undefined && typeof tool._logical === 'number') {
            // VerticalLine
            points.push({ logical: tool._logical, price: 0 });
        }
    } catch (error) {
        console.error('Error extracting tool state:', error);
        return null;
    }

    // Extract options with validation
    const options: Record<string, any> = {};
    if (tool._options && typeof tool._options === 'object') {
        Object.keys(tool._options).forEach(key => {
            options[key] = tool._options[key];
        });
    }

    return { points, options };
}

/**
 * Applies a saved state back to a tool
 */
export function applyToolState(tool: any, state: ToolState): void {
    const { points, options } = state;

    // Restore points based on tool structure
    if (tool._points && Array.isArray(tool._points)) {
        tool._points = points.map(p => ({ logical: p.logical, price: p.price }));
    } else if (tool._p1 && tool._p2 && tool._p3 && points.length >= 3) {
        tool._p1 = { logical: points[0].logical, price: points[0].price };
        tool._p2 = { logical: points[1].logical, price: points[1].price };
        tool._p3 = { logical: points[2].logical, price: points[2].price };
    } else if (tool._p1 && tool._p2 && points.length >= 2) {
        tool._p1 = { logical: points[0].logical, price: points[0].price };
        tool._p2 = { logical: points[1].logical, price: points[1].price };
    } else if (tool._point && points.length >= 1) {
        tool._point = { logical: points[0].logical, price: points[0].price };
    } else if (tool._price !== undefined && points.length >= 1) {
        tool._price = points[0].price;
    } else if (tool._logical !== undefined && points.length >= 1) {
        tool._logical = points[0].logical;
    }

    // Restore options
    if (tool._options && options) {
        Object.keys(options).forEach(key => {
            tool._options[key] = options[key];
        });
    }

    // Trigger visual update
    if (tool.updateAllViews) {
        tool.updateAllViews();
    }
}

/**
 * Manages undo/redo history for drawing tools
 */
export class HistoryManager {
    private _undoStack: HistoryAction[] = [];
    private _redoStack: HistoryAction[] = [];
    private readonly MAX_HISTORY = 20;

    /**
     * Record a tool being added
     */
    public recordAdd(tool: any, toolType: ToolType): void {
        const state = extractToolState(tool);
        if (!state) return; // Skip if state extraction failed
        
        this._pushAction({
            type: 'add',
            tool,
            toolType,
            newState: state
        });
    }

    /**
     * Record a tool being deleted
     */
    public recordDelete(tool: any, toolType: ToolType): void {
        const state = extractToolState(tool);
        if (!state) return; // Skip if state extraction failed
        
        this._pushAction({
            type: 'delete',
            tool,
            toolType,
            prevState: state
        });
    }

    /**
     * Record a tool being modified (moved or style changed)
     */
    public recordModify(tool: any, toolType: ToolType, prevState: ToolState): void {
        const newState = extractToolState(tool);
        if (!newState) return; // Skip if state extraction failed
        
        this._pushAction({
            type: 'modify',
            tool,
            toolType,
            prevState,
            newState: newState
        });
    }

    /**
     * Pop the last action for undo
     */
    public popUndo(): HistoryAction | null {
        const action = this._undoStack.pop();
        if (action) {
            this._redoStack.push(action);
        }
        return action || null;
    }

    /**
     * Pop the last undone action for redo
     */
    public popRedo(): HistoryAction | null {
        const action = this._redoStack.pop();
        if (action) {
            this._undoStack.push(action);
        }
        return action || null;
    }

    public canUndo(): boolean {
        return this._undoStack.length > 0;
    }

    public canRedo(): boolean {
        return this._redoStack.length > 0;
    }

    public clear(): void {
        this._undoStack = [];
        this._redoStack = [];
    }

    private _pushAction(action: HistoryAction): void {
        // Clear redo stack when new action is recorded
        this._redoStack = [];

        // Add to undo stack
        this._undoStack.push(action);

        // Limit history size
        while (this._undoStack.length > this.MAX_HISTORY) {
            this._undoStack.shift();
        }
    }
}
