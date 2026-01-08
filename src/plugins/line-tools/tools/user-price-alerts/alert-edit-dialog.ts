import { AlertCondition } from '../line-tool-alert-manager';
import { AlertNotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from './state';

export interface AlertEditData {
    alertId: string;
    price: number;
    condition: AlertCondition;
    symbol: string;
    exchange?: string;
    isTrendline?: boolean;
    toolType?: 'line' | 'shape' | 'vertical';
    notifications?: AlertNotificationSettings;
}

type TabId = 'settings' | 'message' | 'notifications';

export class AlertEditDialog {
    private _overlay: HTMLElement | null = null;
    private _onSave: ((data: AlertEditData) => void) | null = null;
    private _currentData: AlertEditData | null = null;
    private _overlayClickHandler: ((e: MouseEvent) => void) | null = null;
    private _activeTab: TabId = 'settings';
    private _notifications: AlertNotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };

    constructor() {
        this._injectStyles();
    }

    private _injectStyles(): void {
        const styleId = 'alert-edit-dialog-styles-v2';
        if (document.getElementById(styleId)) return;

        const css = `
            .alert-edit-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif;
            }

            .alert-edit-dialog {
                background: var(--tv-dialog-bg, #ffffff);
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
                width: 480px;
                max-width: 95%;
                max-height: 90vh;
                overflow: hidden;
                animation: dialogFadeIn 0.2s ease-out;
                display: flex;
                flex-direction: column;
            }

            [data-theme="dark"] .alert-edit-dialog {
                background: #1e222d;
            }

            .alert-edit-dialog-header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--tv-border-color, #E0E3EB);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            [data-theme="dark"] .alert-edit-dialog-header {
                border-bottom-color: #363a45;
            }

            .alert-edit-dialog-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--tv-text-color, #131722);
                margin: 0;
            }

            [data-theme="dark"] .alert-edit-dialog-title {
                color: #d1d4dc;
            }

            .alert-edit-dialog-close {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                color: #787B86;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
            }

            .alert-edit-dialog-close:hover {
                background: rgba(0, 0, 0, 0.05);
                color: #131722;
            }

            [data-theme="dark"] .alert-edit-dialog-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #d1d4dc;
            }

            /* Tabs */
            .alert-edit-tabs {
                display: flex;
                border-bottom: 1px solid var(--tv-border-color, #E0E3EB);
                padding: 0 20px;
                gap: 4px;
            }

            [data-theme="dark"] .alert-edit-tabs {
                border-bottom-color: #363a45;
            }

            .alert-edit-tab {
                padding: 12px 16px;
                font-size: 14px;
                color: #787B86;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .alert-edit-tab:hover {
                color: var(--tv-text-color, #131722);
            }

            [data-theme="dark"] .alert-edit-tab:hover {
                color: #d1d4dc;
            }

            .alert-edit-tab.active {
                color: #2962FF;
                border-bottom-color: #2962FF;
            }

            .alert-edit-tab-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #2962FF;
            }

            .alert-edit-dialog-content {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                overflow-y: auto;
                max-height: 400px;
            }

            .alert-edit-tab-content {
                display: none;
            }

            .alert-edit-tab-content.active {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .alert-edit-form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .alert-edit-label {
                font-size: 13px;
                color: #787B86;
                font-weight: 500;
            }

            .alert-edit-input, .alert-edit-select, .alert-edit-textarea {
                padding: 10px 12px;
                border: 1px solid var(--tv-border-color, #E0E3EB);
                border-radius: 4px;
                font-size: 14px;
                color: var(--tv-text-color, #131722);
                background: var(--tv-input-bg, #ffffff);
                outline: none;
                transition: border-color 0.2s;
            }

            [data-theme="dark"] .alert-edit-input,
            [data-theme="dark"] .alert-edit-select,
            [data-theme="dark"] .alert-edit-textarea {
                background: #2a2e39;
                border-color: #363a45;
                color: #d1d4dc;
            }

            .alert-edit-input:focus, .alert-edit-select:focus, .alert-edit-textarea:focus {
                border-color: #2962FF;
            }

            .alert-edit-textarea {
                min-height: 80px;
                resize: vertical;
                font-family: monospace;
            }

            .alert-edit-hint {
                font-size: 12px;
                color: #787B86;
                margin-top: 4px;
            }

            /* Toggle Switch */
            .alert-edit-toggle-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 0;
                border-bottom: 1px solid var(--tv-border-color, #E0E3EB);
            }

            .alert-edit-toggle-row:last-child {
                border-bottom: none;
            }

            [data-theme="dark"] .alert-edit-toggle-row {
                border-bottom-color: #363a45;
            }

            .alert-edit-toggle-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .alert-edit-toggle-title {
                font-size: 14px;
                color: var(--tv-text-color, #131722);
                font-weight: 500;
            }

            [data-theme="dark"] .alert-edit-toggle-title {
                color: #d1d4dc;
            }

            .alert-edit-toggle-desc {
                font-size: 12px;
                color: #787B86;
            }

            .alert-edit-toggle {
                position: relative;
                width: 44px;
                height: 24px;
                cursor: pointer;
            }

            .alert-edit-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .alert-edit-toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: 0.3s;
                border-radius: 24px;
            }

            .alert-edit-toggle-slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: 0.3s;
                border-radius: 50%;
            }

            .alert-edit-toggle input:checked + .alert-edit-toggle-slider {
                background-color: #2962FF;
            }

            .alert-edit-toggle input:checked + .alert-edit-toggle-slider:before {
                transform: translateX(20px);
            }

            /* Webhook Section */
            .alert-edit-webhook-section {
                margin-top: 8px;
                padding: 16px;
                background: var(--tv-section-bg, #f5f8fa);
                border-radius: 8px;
                display: none;
            }

            .alert-edit-webhook-section.visible {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            [data-theme="dark"] .alert-edit-webhook-section {
                background: #2a2e39;
            }

            .alert-edit-radio-group {
                display: flex;
                gap: 16px;
            }

            .alert-edit-radio {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 14px;
                color: var(--tv-text-color, #131722);
            }

            [data-theme="dark"] .alert-edit-radio {
                color: #d1d4dc;
            }

            .alert-edit-radio input {
                accent-color: #2962FF;
            }

            .alert-edit-openalgo-fields {
                display: none;
                flex-direction: column;
                gap: 12px;
            }

            .alert-edit-openalgo-fields.visible {
                display: flex;
            }

            .alert-edit-row {
                display: flex;
                gap: 12px;
            }

            .alert-edit-row > .alert-edit-form-group {
                flex: 1;
            }

            .alert-edit-custom-url {
                display: none;
            }

            .alert-edit-custom-url.visible {
                display: block;
            }

            .alert-edit-dialog-footer {
                padding: 16px 20px;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                border-top: 1px solid var(--tv-border-color, #E0E3EB);
                background: var(--tv-footer-bg, #F8F9FD);
            }

            [data-theme="dark"] .alert-edit-dialog-footer {
                background: #1e222d;
                border-top-color: #363a45;
            }

            .alert-edit-btn {
                padding: 10px 20px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                transition: background 0.2s;
            }

            .alert-edit-btn-cancel {
                background: transparent;
                color: var(--tv-text-color, #131722);
                border: 1px solid var(--tv-border-color, #E0E3EB);
            }

            [data-theme="dark"] .alert-edit-btn-cancel {
                color: #d1d4dc;
                border-color: #363a45;
            }

            .alert-edit-btn-cancel:hover {
                background: rgba(0, 0, 0, 0.05);
            }

            [data-theme="dark"] .alert-edit-btn-cancel:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .alert-edit-btn-save {
                background: #2962FF;
                color: white;
            }

            .alert-edit-btn-save:hover {
                background: #1E53E5;
            }

            @keyframes dialogFadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    public show(data: AlertEditData, onSave: (data: AlertEditData) => void): void {
        this._currentData = { ...data };
        this._onSave = onSave;
        this._activeTab = 'settings';
        this._notifications = data.notifications
            ? { ...data.notifications }
            : { ...DEFAULT_NOTIFICATION_SETTINGS };
        this._createOverlay();
        document.body.appendChild(this._overlay!);
    }

    public hide(): void {
        if (this._overlay) {
            if (this._overlayClickHandler) {
                this._overlay.removeEventListener('click', this._overlayClickHandler);
                this._overlayClickHandler = null;
            }
            if (this._overlay.parentNode) {
                this._overlay.parentNode.removeChild(this._overlay);
            }
        }
        this._overlay = null;
        this._onSave = null;
        this._currentData = null;
    }

    private _createOverlay(): void {
        this._overlay = document.createElement('div');
        this._overlay.className = 'alert-edit-dialog-overlay';

        this._overlayClickHandler = (e: MouseEvent) => {
            if (e.target === this._overlay) {
                this.hide();
            }
        };
        this._overlay.addEventListener('click', this._overlayClickHandler);

        const dialog = document.createElement('div');
        dialog.className = 'alert-edit-dialog';
        this._overlay.appendChild(dialog);

        // Header
        const header = document.createElement('div');
        header.className = 'alert-edit-dialog-header';

        const title = document.createElement('h2');
        title.className = 'alert-edit-dialog-title';
        title.textContent = `Edit alert on ${this._currentData?.symbol || ''}`;
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'alert-edit-dialog-close';
        closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path fill="currentColor" d="M9 7.586L14.293 2.293l1.414 1.414L10.414 9l5.293 5.293-1.414 1.414L9 10.414l-5.293 5.293-1.414-1.414L7.586 9 2.293 3.707l1.414-1.414L9 7.586z"/></svg>';
        closeBtn.addEventListener('click', () => this.hide());
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'alert-edit-tabs';

        const tabData: { id: TabId; label: string }[] = [
            { id: 'settings', label: 'Settings' },
            { id: 'message', label: 'Message' },
            { id: 'notifications', label: 'Notifications' },
        ];

        const tabElements: HTMLElement[] = [];
        tabData.forEach(t => {
            const tab = document.createElement('div');
            tab.className = `alert-edit-tab ${this._activeTab === t.id ? 'active' : ''}`;
            tab.textContent = t.label;

            // Add indicator for notifications tab if webhook is enabled
            if (t.id === 'notifications' && this._notifications.webhookEnabled) {
                const indicator = document.createElement('span');
                indicator.className = 'alert-edit-tab-indicator';
                tab.appendChild(indicator);
            }

            tab.addEventListener('click', () => {
                this._activeTab = t.id;
                tabElements.forEach(te => te.classList.remove('active'));
                tab.classList.add('active');
                this._updateTabContent(dialog);
            });
            tabs.appendChild(tab);
            tabElements.push(tab);
        });
        dialog.appendChild(tabs);

        // Content
        const content = document.createElement('div');
        content.className = 'alert-edit-dialog-content';
        content.id = 'alert-dialog-content';
        dialog.appendChild(content);

        this._renderTabContent(content);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'alert-edit-dialog-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'alert-edit-btn alert-edit-btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this.hide());
        footer.appendChild(cancelBtn);

        const saveBtn = document.createElement('button');
        saveBtn.className = 'alert-edit-btn alert-edit-btn-save';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => this._handleSave());
        footer.appendChild(saveBtn);
        dialog.appendChild(footer);
    }

    private _updateTabContent(dialog: HTMLElement): void {
        const content = dialog.querySelector('#alert-dialog-content');
        if (content) {
            content.innerHTML = '';
            this._renderTabContent(content as HTMLElement);
        }
    }

    // Store references to inputs
    private _conditionSelect: HTMLSelectElement | null = null;
    private _priceInput: HTMLInputElement | null = null;
    private _messageInput: HTMLTextAreaElement | null = null;

    private _renderTabContent(content: HTMLElement): void {
        if (this._activeTab === 'settings') {
            this._renderSettingsTab(content);
        } else if (this._activeTab === 'message') {
            this._renderMessageTab(content);
        } else if (this._activeTab === 'notifications') {
            this._renderNotificationsTab(content);
        }
    }

    private _renderSettingsTab(content: HTMLElement): void {
        // Condition Dropdown
        const conditionGroup = document.createElement('div');
        conditionGroup.className = 'alert-edit-form-group';

        const conditionLabel = document.createElement('label');
        conditionLabel.className = 'alert-edit-label';
        conditionLabel.textContent = 'Condition';
        conditionGroup.appendChild(conditionLabel);

        const conditionSelect = document.createElement('select');
        conditionSelect.className = 'alert-edit-select';
        this._conditionSelect = conditionSelect;

        const allOptions: { value: AlertCondition, label: string }[] = [
            { value: 'crossing', label: 'Crossing' },
            { value: 'crossing_up', label: 'Crossing Up' },
            { value: 'crossing_down', label: 'Crossing Down' },
            { value: 'entering', label: 'Entering' },
            { value: 'exiting', label: 'Exiting' },
            { value: 'inside', label: 'Inside' },
            { value: 'outside', label: 'Outside' }
        ];

        let options = allOptions;
        if (this._currentData?.toolType === 'vertical') {
            options = allOptions.filter(o => o.value === 'crossing');
        } else if (this._currentData?.toolType === 'shape') {
            options = allOptions.filter(o => ['entering', 'exiting', 'inside', 'outside'].includes(o.value));
        } else {
            options = allOptions.filter(o => ['crossing', 'crossing_up', 'crossing_down'].includes(o.value));
        }

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === this._currentData?.condition) {
                option.selected = true;
            }
            conditionSelect.appendChild(option);
        });
        conditionGroup.appendChild(conditionSelect);
        content.appendChild(conditionGroup);

        // Price Input (only for non-trendline alerts)
        if (!this._currentData?.isTrendline) {
            const priceGroup = document.createElement('div');
            priceGroup.className = 'alert-edit-form-group';

            const priceLabel = document.createElement('label');
            priceLabel.className = 'alert-edit-label';
            priceLabel.textContent = 'Value';
            priceGroup.appendChild(priceLabel);

            const priceInput = document.createElement('input');
            priceInput.className = 'alert-edit-input';
            priceInput.type = 'number';
            priceInput.step = '0.01';
            priceInput.value = this._currentData?.price.toFixed(2) || '';
            this._priceInput = priceInput;
            priceGroup.appendChild(priceInput);
            content.appendChild(priceGroup);
        }
    }

    private _renderMessageTab(content: HTMLElement): void {
        const messageGroup = document.createElement('div');
        messageGroup.className = 'alert-edit-form-group';

        const messageLabel = document.createElement('label');
        messageLabel.className = 'alert-edit-label';
        messageLabel.textContent = 'Alert Message';
        messageGroup.appendChild(messageLabel);

        const messageInput = document.createElement('textarea');
        messageInput.className = 'alert-edit-textarea';
        messageInput.placeholder = '{{symbol}} {{condition}} {{price}}';
        messageInput.value = this._notifications.message || '{{symbol}} {{condition}} {{price}}';
        this._messageInput = messageInput;
        messageInput.addEventListener('input', () => {
            this._notifications.message = messageInput.value;
        });
        messageGroup.appendChild(messageInput);

        const hint = document.createElement('div');
        hint.className = 'alert-edit-hint';
        hint.innerHTML = 'Available variables: <code>{{symbol}}</code>, <code>{{exchange}}</code>, <code>{{price}}</code>, <code>{{direction}}</code>, <code>{{condition}}</code>, <code>{{time}}</code>, <code>{{close}}</code>';
        messageGroup.appendChild(hint);

        content.appendChild(messageGroup);
    }

    private _renderNotificationsTab(content: HTMLElement): void {
        // Toast toggle
        content.appendChild(this._createToggleRow(
            'Show toast notification',
            'Displays an onsite notification in the page corner.',
            this._notifications.showToast,
            (checked) => { this._notifications.showToast = checked; }
        ));

        // Sound toggle
        content.appendChild(this._createToggleRow(
            'Play sound',
            'Plays an audio cue when your alert triggers.',
            this._notifications.playSound,
            (checked) => { this._notifications.playSound = checked; }
        ));

        // Webhook toggle
        const webhookToggle = this._createToggleRow(
            'Webhook URL',
            'Sends a POST request to your specified URL when alert triggers.',
            this._notifications.webhookEnabled,
            (checked) => {
                this._notifications.webhookEnabled = checked;
                webhookSection.classList.toggle('visible', checked);
            }
        );
        content.appendChild(webhookToggle);

        // Webhook configuration section
        const webhookSection = document.createElement('div');
        webhookSection.className = `alert-edit-webhook-section ${this._notifications.webhookEnabled ? 'visible' : ''}`;

        // Mode selection (radio buttons)
        const modeGroup = document.createElement('div');
        modeGroup.className = 'alert-edit-form-group';

        const modeLabel = document.createElement('label');
        modeLabel.className = 'alert-edit-label';
        modeLabel.textContent = 'Webhook Mode';
        modeGroup.appendChild(modeLabel);

        const radioGroup = document.createElement('div');
        radioGroup.className = 'alert-edit-radio-group';

        const openalgoRadio = this._createRadio('webhook-mode', 'openalgo', 'OpenAlgo Trading', this._notifications.webhookMode === 'openalgo');
        const customRadio = this._createRadio('webhook-mode', 'custom', 'Custom URL', this._notifications.webhookMode === 'custom');

        radioGroup.appendChild(openalgoRadio);
        radioGroup.appendChild(customRadio);
        modeGroup.appendChild(radioGroup);
        webhookSection.appendChild(modeGroup);

        // OpenAlgo fields
        const openalgoFields = document.createElement('div');
        openalgoFields.className = `alert-edit-openalgo-fields ${this._notifications.webhookMode === 'openalgo' ? 'visible' : ''}`;

        // Action row
        const actionRow = document.createElement('div');
        actionRow.className = 'alert-edit-row';

        const actionGroup = document.createElement('div');
        actionGroup.className = 'alert-edit-form-group';
        actionGroup.innerHTML = `
            <label class="alert-edit-label">Action</label>
            <select class="alert-edit-select" id="openalgo-action">
                <option value="BUY" ${this._notifications.openalgoAction === 'BUY' ? 'selected' : ''}>BUY</option>
                <option value="SELL" ${this._notifications.openalgoAction === 'SELL' ? 'selected' : ''}>SELL</option>
            </select>
        `;
        actionRow.appendChild(actionGroup);

        const productGroup = document.createElement('div');
        productGroup.className = 'alert-edit-form-group';
        productGroup.innerHTML = `
            <label class="alert-edit-label">Product</label>
            <select class="alert-edit-select" id="openalgo-product">
                <option value="MIS" ${this._notifications.openalgoProduct === 'MIS' ? 'selected' : ''}>MIS (Intraday)</option>
                <option value="CNC" ${this._notifications.openalgoProduct === 'CNC' ? 'selected' : ''}>CNC (Delivery)</option>
                <option value="NRML" ${this._notifications.openalgoProduct === 'NRML' ? 'selected' : ''}>NRML (F&O)</option>
            </select>
        `;
        actionRow.appendChild(productGroup);
        openalgoFields.appendChild(actionRow);

        // Quantity row
        const qtyRow = document.createElement('div');
        qtyRow.className = 'alert-edit-row';

        const qtyGroup = document.createElement('div');
        qtyGroup.className = 'alert-edit-form-group';
        qtyGroup.innerHTML = `
            <label class="alert-edit-label">Quantity</label>
            <input type="number" class="alert-edit-input" id="openalgo-quantity" min="1" value="${this._notifications.openalgoQuantity || 1}">
        `;
        qtyRow.appendChild(qtyGroup);

        const priceTypeGroup = document.createElement('div');
        priceTypeGroup.className = 'alert-edit-form-group';
        priceTypeGroup.innerHTML = `
            <label class="alert-edit-label">Price Type</label>
            <select class="alert-edit-select" id="openalgo-pricetype">
                <option value="MARKET" ${this._notifications.openalgoPricetype === 'MARKET' ? 'selected' : ''}>MARKET</option>
                <option value="LIMIT" ${this._notifications.openalgoPricetype === 'LIMIT' ? 'selected' : ''}>LIMIT</option>
            </select>
        `;
        qtyRow.appendChild(priceTypeGroup);
        openalgoFields.appendChild(qtyRow);

        webhookSection.appendChild(openalgoFields);

        // Custom URL field
        const customUrlSection = document.createElement('div');
        customUrlSection.className = `alert-edit-custom-url ${this._notifications.webhookMode === 'custom' ? 'visible' : ''}`;

        const urlGroup = document.createElement('div');
        urlGroup.className = 'alert-edit-form-group';
        urlGroup.innerHTML = `
            <label class="alert-edit-label">Webhook URL</label>
            <input type="url" class="alert-edit-input" id="webhook-url" placeholder="https://your-webhook-url.com" value="${this._notifications.webhookUrl || ''}">
        `;
        customUrlSection.appendChild(urlGroup);
        webhookSection.appendChild(customUrlSection);

        // Mode change listeners
        (openalgoRadio.querySelector('input') as HTMLInputElement).addEventListener('change', () => {
            this._notifications.webhookMode = 'openalgo';
            openalgoFields.classList.add('visible');
            customUrlSection.classList.remove('visible');
        });

        (customRadio.querySelector('input') as HTMLInputElement).addEventListener('change', () => {
            this._notifications.webhookMode = 'custom';
            openalgoFields.classList.remove('visible');
            customUrlSection.classList.add('visible');
        });

        content.appendChild(webhookSection);

        // Telegram toggle
        content.appendChild(this._createToggleRow(
            'Telegram notification',
            'Sends alert message to your Telegram via OpenAlgo bot.',
            this._notifications.telegramEnabled || false,
            (checked) => { this._notifications.telegramEnabled = checked; }
        ));
    }

    private _createToggleRow(
        title: string,
        description: string,
        checked: boolean,
        onChange: (checked: boolean) => void
    ): HTMLElement {
        const row = document.createElement('div');
        row.className = 'alert-edit-toggle-row';

        const info = document.createElement('div');
        info.className = 'alert-edit-toggle-info';
        info.innerHTML = `
            <span class="alert-edit-toggle-title">${title}</span>
            <span class="alert-edit-toggle-desc">${description}</span>
        `;
        row.appendChild(info);

        const toggle = document.createElement('label');
        toggle.className = 'alert-edit-toggle';
        toggle.innerHTML = `
            <input type="checkbox" ${checked ? 'checked' : ''}>
            <span class="alert-edit-toggle-slider"></span>
        `;
        const input = toggle.querySelector('input') as HTMLInputElement;
        input.addEventListener('change', () => onChange(input.checked));
        row.appendChild(toggle);

        return row;
    }

    private _createRadio(name: string, value: string, label: string, checked: boolean): HTMLElement {
        const radioLabel = document.createElement('label');
        radioLabel.className = 'alert-edit-radio';
        radioLabel.innerHTML = `
            <input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}>
            ${label}
        `;
        return radioLabel;
    }

    private _handleSave(): void {
        if (!this._onSave || !this._currentData) return;

        // Collect values from OpenAlgo fields if visible
        const actionSelect = document.getElementById('openalgo-action') as HTMLSelectElement;
        const productSelect = document.getElementById('openalgo-product') as HTMLSelectElement;
        const quantityInput = document.getElementById('openalgo-quantity') as HTMLInputElement;
        const priceTypeSelect = document.getElementById('openalgo-pricetype') as HTMLSelectElement;
        const webhookUrlInput = document.getElementById('webhook-url') as HTMLInputElement;

        if (actionSelect) this._notifications.openalgoAction = actionSelect.value as 'BUY' | 'SELL';
        if (productSelect) this._notifications.openalgoProduct = productSelect.value as 'MIS' | 'CNC' | 'NRML';
        if (quantityInput) this._notifications.openalgoQuantity = parseInt(quantityInput.value) || 1;
        if (priceTypeSelect) this._notifications.openalgoPricetype = priceTypeSelect.value as 'MARKET' | 'LIMIT';
        if (webhookUrlInput) this._notifications.webhookUrl = webhookUrlInput.value;

        this._onSave({
            ...this._currentData,
            condition: (this._conditionSelect?.value || this._currentData.condition) as AlertCondition,
            price: this._priceInput ? parseFloat(this._priceInput.value) : this._currentData.price,
            notifications: { ...this._notifications },
        });
        this.hide();
    }
}
