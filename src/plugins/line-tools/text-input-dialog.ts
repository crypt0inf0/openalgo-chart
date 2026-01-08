/**
 * Inline Text Editor for editing text and callout tools directly on the chart
 */
export class TextInputDialog {
    private _input: HTMLInputElement | null = null;
    private _onConfirm: ((text: string) => void) | null = null;
    private _onCancel: (() => void) | null = null;
    private _blurHandler: (() => void) | null = null;
    private _hasConfirmed: boolean = false; // Prevent double-confirm race condition (B-8)

    /**
     * Show the inline text editor
     * @param initialText - Initial text value
     * @param position - Position to show the editor (required)
     * @param onConfirm - Callback when user confirms
     * @param onCancel - Callback when user cancels
     */
    public show(
        initialText: string,
        position: { x: number; y: number },
        onConfirm?: (text: string) => void,
        onCancel?: () => void
    ): void {
        // Remove existing input if any
        this.hide();

        this._hasConfirmed = false; // Reset confirm flag (B-8)
        this._onConfirm = onConfirm || null;
        this._onCancel = onCancel || null;

        // Create inline input
        this._input = document.createElement('input');
        this._input.type = 'text';
        this._input.value = initialText;
        this._input.className = 'inline-text-editor';

        // Add styles
        this._addStyles();

        // Position input at the text location
        this._input.style.left = `${position.x}px`;
        this._input.style.top = `${position.y}px`;

        document.body.appendChild(this._input);

        // Focus input and select all text
        setTimeout(() => {
            if (this._input) {
                this._input.focus();
                this._input.select();
            }
        }, 0);

        // Handle Enter and Escape keys
        this._input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this._handleConfirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this._handleCancel();
            }
        });

        // Handle blur (clicking outside)
        this._blurHandler = () => {
            // Small delay to allow click events to process
            setTimeout(() => this._handleConfirm(), 100);
        };
        this._input.addEventListener('blur', this._blurHandler);

        // Prevent chart interactions while editing
        this._input.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        this._input.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * Hide and remove the input
     */
    public hide(): void {
        if (this._input) {
            if (this._blurHandler) {
                this._input.removeEventListener('blur', this._blurHandler);
                this._blurHandler = null;
            }
            if (this._input.parentNode) {
                this._input.parentNode.removeChild(this._input);
            }
        }
        this._input = null;
        this._onConfirm = null;
        this._onCancel = null;
        this._hasConfirmed = false; // Reset confirm flag (B-8)
    }

    private _handleConfirm(): void {
        // Prevent double-confirm (B-8)
        if (this._hasConfirmed) return;
        this._hasConfirmed = true;

        const text = this._input?.value || '';
        if (this._onConfirm) {
            this._onConfirm(text);
        }
        this.hide();
    }

    private _handleCancel(): void {
        if (this._onCancel) {
            this._onCancel();
        }
        this.hide();
    }

    private _addStyles(): void {
        const styleId = 'inline-text-editor-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .inline-text-editor {
                position: fixed;
                background: #ffffff;
                border: 1px solid #2962FF;
                border-radius: 0;
                padding: 4px 6px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif;
                z-index: 10000;
                min-width: 80px;
                color: #2962FF;
                box-sizing: border-box;
            }

            .inline-text-editor:focus {
                outline: none;
                border-color: #2962FF;
            }

            .inline-text-editor::placeholder {
                color: #2962FF;
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }
}
