import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const DEFAULT_HOST = 'http://127.0.0.1:5000';

const ApiKeyDialog = ({ onSave, onClose }) => {
    const [hostUrl, setHostUrl] = useState(() => {
        return localStorage.getItem('oa_host_url') || DEFAULT_HOST;
    });
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [error, setError] = useState('');
    const [isValidating, setIsValidating] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!apiKey.trim()) {
            setError('Please enter your API key');
            return;
        }

        setIsValidating(true);
        setError('');

        try {
            // Save host URL before validation
            localStorage.setItem('oa_host_url', hostUrl);

            // For local development, use relative path to leverage Vite proxy
            // This avoids CORS issues when frontend (localhost:5001) calls backend (127.0.0.1:5000)
            const isLocalhost = hostUrl === DEFAULT_HOST ||
                hostUrl === 'http://localhost:5000' ||
                hostUrl === 'http://127.0.0.1:5000';
            const apiUrl = isLocalhost
                ? `/api/v1/chart?apikey=${encodeURIComponent(apiKey.trim())}`
                : `${hostUrl}/api/v1/chart?apikey=${encodeURIComponent(apiKey.trim())}`;

            // Validate API key and fetch preferences in one request
            // Uses GET with apikey as query parameter
            const response = await fetch(apiUrl, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                // API key is valid - save API key
                localStorage.setItem('oa_apikey', apiKey.trim());

                // Parse and save preferences directly from the validation response
                // This eliminates the need for a separate cloud sync fetch
                try {
                    const result = await response.json();
                    // Response format: { status: 'success', data: {...prefs...} }
                    const prefs = result.data || result;
                    if (prefs && typeof prefs === 'object') {
                        Object.entries(prefs).forEach(([key, value]) => {
                            if (value !== null && value !== undefined) {
                                localStorage.setItem(key, value);
                            }
                        });
                        // Mark that cloud data has been loaded to skip cloud sync
                        localStorage.setItem('_cloud_sync_done', 'true');
                    }
                } catch (parseError) {
                    console.warn('[ApiKeyDialog] Could not parse preferences, cloud sync will handle it');
                }

                onSave(apiKey.trim());
            } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                // Invalid API key
                setError('Invalid API key. Please check your credentials and try again.');
            } else {
                // Other server error
                setError(`Server error: ${response.status}. Please try again later.`);
            }
        } catch (err) {
            console.error('[ApiKeyDialog] Validation error:', err);
            setError('Could not connect to OpenAlgo server. Please check if the server is running.');
        } finally {
            setIsValidating(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '12px',
        backgroundColor: '#131722',
        border: '1px solid #363a45',
        borderRadius: '4px',
        color: '#d1d4dc',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box'
    };

    const labelStyle = {
        display: 'block',
        color: '#d1d4dc',
        fontSize: '13px',
        marginBottom: '8px',
        fontWeight: 500
    };

    const hintStyle = {
        margin: '6px 0 0 0',
        color: '#787b86',
        fontSize: '11px',
        lineHeight: 1.4
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000
        }}>
            <div style={{
                backgroundColor: '#1e222d',
                borderRadius: '8px',
                padding: '24px',
                width: '420px',
                maxWidth: '90%',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)'
            }}>
                <h2 style={{
                    margin: '0 0 8px 0',
                    color: '#d1d4dc',
                    fontSize: '18px',
                    fontWeight: 500
                }}>
                    Connect to OpenAlgo
                </h2>
                <p style={{
                    margin: '0 0 20px 0',
                    color: '#787b86',
                    fontSize: '13px',
                    lineHeight: 1.5
                }}>
                    Configure your OpenAlgo server connection.
                </p>

                <form onSubmit={handleSubmit}>
                    {/* Host URL Field */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Host URL</label>
                        <input
                            type="text"
                            value={hostUrl}
                            onChange={(e) => setHostUrl(e.target.value)}
                            placeholder="http://127.0.0.1:5000"
                            style={inputStyle}
                        />
                        <p style={hintStyle}>
                            Default: http://127.0.0.1:5000
                        </p>
                    </div>

                    {/* API Key Field */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>API Key</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type={showApiKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    setError('');
                                }}
                                placeholder="Enter your API key"
                                autoFocus
                                style={{
                                    ...inputStyle,
                                    paddingRight: '40px',
                                    border: error ? '1px solid #f23645' : '1px solid #363a45'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                title={showApiKey ? "Hide API key" : "Show API key"}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'none',
                                    border: 'none',
                                    color: '#787b86',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '4px'
                                }}
                            >
                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {error && (
                            <p style={{
                                margin: '8px 0 0 0',
                                color: '#f23645',
                                fontSize: '12px'
                            }}>
                                {error}
                            </p>
                        )}
                        <p style={hintStyle}>
                            Find your API key in the{' '}
                            <a
                                href={`${hostUrl}/apikey`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#2962ff' }}
                            >
                                OpenAlgo Dashboard
                            </a >
                        </p >
                    </div >

                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '20px',
                        justifyContent: 'flex-end'
                    }}>
                        <a
                            href={`${hostUrl}/auth/login`}
                            style={{
                                padding: '10px 16px',
                                backgroundColor: 'transparent',
                                border: '1px solid #363a45',
                                borderRadius: '4px',
                                color: '#787b86',
                                fontSize: '14px',
                                cursor: 'pointer',
                                textDecoration: 'none'
                            }}
                        >
                            Login to OpenAlgo
                        </a>
                        <button
                            type="submit"
                            disabled={isValidating}
                            style={{
                                padding: '10px 24px',
                                backgroundColor: isValidating ? '#4a5568' : '#2962ff',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '14px',
                                cursor: isValidating ? 'not-allowed' : 'pointer',
                                opacity: isValidating ? 0.7 : 1
                            }}
                        >
                            {isValidating ? 'Validating...' : 'Connect'}
                        </button>
                    </div>
                </form >
            </div >
        </div >
    );
};

export default ApiKeyDialog;
