/**
 * Watchlist Constants
 * Symbol full names and other constants
 */

// Symbol full names (can be extended or fetched from API)
export const SYMBOL_FULL_NAMES = {
    'NIFTY': 'Nifty 50 Index',
    'BANKNIFTY': 'Bank Nifty Index',
    'NIFTY50': 'Nifty 50 Index',
    'SENSEX': 'BSE Sensex',
    'RELIANCE': 'Reliance Industries Limited',
    'TCS': 'Tata Consultancy Services',
    'INFY': 'Infosys Limited',
    'HDFCBANK': 'HDFC Bank Limited',
    'ICICIBANK': 'ICICI Bank Limited',
    'SBIN': 'State Bank of India',
    'BHARTIARTL': 'Bharti Airtel Limited',
    'ITC': 'ITC Limited',
    'HINDUNILVR': 'Hindustan Unilever Limited',
    'KOTAKBANK': 'Kotak Mahindra Bank',
    'LT': 'Larsen & Toubro Limited',
    'AXISBANK': 'Axis Bank Limited',
    'BAJFINANCE': 'Bajaj Finance Limited',
    'MARUTI': 'Maruti Suzuki India Limited',
    'ASIANPAINT': 'Asian Paints Limited',
    'TITAN': 'Titan Company Limited',
    'SUNPHARMA': 'Sun Pharmaceutical Industries',
    'WIPRO': 'Wipro Limited',
    'ULTRACEMCO': 'UltraTech Cement Limited',
    'NESTLEIND': 'Nestle India Limited',
    'POWERGRID': 'Power Grid Corporation',
    'NTPC': 'NTPC Limited',
    'ONGC': 'Oil and Natural Gas Corporation',
    'JSWSTEEL': 'JSW Steel Limited',
    'TATASTEEL': 'Tata Steel Limited',
    'M&M': 'Mahindra & Mahindra Limited',
    'HCLTECH': 'HCL Technologies Limited',
    'ADANIENT': 'Adani Enterprises Limited',
    'ADANIPORTS': 'Adani Ports and SEZ Limited',
    'COALINDIA': 'Coal India Limited',
    'BPCL': 'Bharat Petroleum Corporation',
    'GRASIM': 'Grasim Industries Limited',
    'TECHM': 'Tech Mahindra Limited',
    'INDUSINDBK': 'IndusInd Bank Limited',
    'EICHERMOT': 'Eicher Motors Limited',
    'DIVISLAB': 'Divi\'s Laboratories Limited',
    'DRREDDY': 'Dr. Reddy\'s Laboratories',
    'CIPLA': 'Cipla Limited',
    'APOLLOHOSP': 'Apollo Hospitals Enterprise',
    'BRITANNIA': 'Britannia Industries Limited',
    'HEROMOTOCO': 'Hero MotoCorp Limited',
    'BAJAJ-AUTO': 'Bajaj Auto Limited',
    'TATACONSUM': 'Tata Consumer Products Limited',
    'SBILIFE': 'SBI Life Insurance Company',
    'HDFCLIFE': 'HDFC Life Insurance Company',
};

/**
 * Check if market is open (simplified)
 * @param {string} exchange - Exchange code
 * @returns {boolean} Whether market is currently open
 */
export function isMarketOpenNow(exchange) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay();

    // Weekend check
    if (day === 0 || day === 6) return false;

    // India market hours (9:15 AM - 3:30 PM IST)
    if (['NSE', 'NSE_INDEX', 'BSE', 'NFO', 'MCX', 'CDS', 'BFO'].includes(exchange)) {
        const timeInMinutes = hours * 60 + minutes;
        return timeInMinutes >= 555 && timeInMinutes <= 930; // 9:15 to 15:30
    }

    // US market hours (simplified - 9:30 AM - 4:00 PM EST)
    if (['NYSE', 'NASDAQ', 'AMEX'].includes(exchange)) {
        const timeInMinutes = hours * 60 + minutes;
        return timeInMinutes >= 570 && timeInMinutes <= 960;
    }

    return false;
}

export default {
    SYMBOL_FULL_NAMES,
    isMarketOpenNow,
};
