/**
 * Predefined Stock Lists for ANN Scanner
 * Contains Nifty 50 and other popular index constituents
 */

// Nifty 50 constituents (as of 2024)
export const NIFTY_50 = [
  { symbol: 'RELIANCE', exchange: 'NSE', name: 'Reliance Industries' },
  { symbol: 'TCS', exchange: 'NSE', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK', exchange: 'NSE', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', exchange: 'NSE', name: 'ICICI Bank' },
  { symbol: 'INFY', exchange: 'NSE', name: 'Infosys' },
  { symbol: 'HINDUNILVR', exchange: 'NSE', name: 'Hindustan Unilever' },
  { symbol: 'ITC', exchange: 'NSE', name: 'ITC' },
  { symbol: 'SBIN', exchange: 'NSE', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', exchange: 'NSE', name: 'Bharti Airtel' },
  { symbol: 'KOTAKBANK', exchange: 'NSE', name: 'Kotak Mahindra Bank' },
  { symbol: 'LT', exchange: 'NSE', name: 'Larsen & Toubro' },
  { symbol: 'HCLTECH', exchange: 'NSE', name: 'HCL Technologies' },
  { symbol: 'AXISBANK', exchange: 'NSE', name: 'Axis Bank' },
  { symbol: 'ASIANPAINT', exchange: 'NSE', name: 'Asian Paints' },
  { symbol: 'MARUTI', exchange: 'NSE', name: 'Maruti Suzuki' },
  { symbol: 'SUNPHARMA', exchange: 'NSE', name: 'Sun Pharmaceutical' },
  { symbol: 'TITAN', exchange: 'NSE', name: 'Titan Company' },
  { symbol: 'BAJFINANCE', exchange: 'NSE', name: 'Bajaj Finance' },
  { symbol: 'DMART', exchange: 'NSE', name: 'Avenue Supermarts' },
  { symbol: 'ULTRACEMCO', exchange: 'NSE', name: 'UltraTech Cement' },
  { symbol: 'WIPRO', exchange: 'NSE', name: 'Wipro' },
  { symbol: 'ADANIENT', exchange: 'NSE', name: 'Adani Enterprises' },
  { symbol: 'NTPC', exchange: 'NSE', name: 'NTPC' },
  { symbol: 'NESTLEIND', exchange: 'NSE', name: 'Nestle India' },
  { symbol: 'TATAMOTORS', exchange: 'NSE', name: 'Tata Motors' },
  { symbol: 'M&M', exchange: 'NSE', name: 'Mahindra & Mahindra' },
  { symbol: 'POWERGRID', exchange: 'NSE', name: 'Power Grid Corp' },
  { symbol: 'ONGC', exchange: 'NSE', name: 'ONGC' },
  { symbol: 'JSWSTEEL', exchange: 'NSE', name: 'JSW Steel' },
  { symbol: 'TATASTEEL', exchange: 'NSE', name: 'Tata Steel' },
  { symbol: 'COALINDIA', exchange: 'NSE', name: 'Coal India' },
  { symbol: 'BAJAJFINSV', exchange: 'NSE', name: 'Bajaj Finserv' },
  { symbol: 'ADANIPORTS', exchange: 'NSE', name: 'Adani Ports' },
  { symbol: 'GRASIM', exchange: 'NSE', name: 'Grasim Industries' },
  { symbol: 'TECHM', exchange: 'NSE', name: 'Tech Mahindra' },
  { symbol: 'HINDALCO', exchange: 'NSE', name: 'Hindalco Industries' },
  { symbol: 'INDUSINDBK', exchange: 'NSE', name: 'IndusInd Bank' },
  { symbol: 'SBILIFE', exchange: 'NSE', name: 'SBI Life Insurance' },
  { symbol: 'HDFCLIFE', exchange: 'NSE', name: 'HDFC Life Insurance' },
  { symbol: 'BRITANNIA', exchange: 'NSE', name: 'Britannia Industries' },
  { symbol: 'EICHERMOT', exchange: 'NSE', name: 'Eicher Motors' },
  { symbol: 'DIVISLAB', exchange: 'NSE', name: 'Divis Laboratories' },
  { symbol: 'DRREDDY', exchange: 'NSE', name: 'Dr Reddys Labs' },
  { symbol: 'BPCL', exchange: 'NSE', name: 'Bharat Petroleum' },
  { symbol: 'CIPLA', exchange: 'NSE', name: 'Cipla' },
  { symbol: 'APOLLOHOSP', exchange: 'NSE', name: 'Apollo Hospitals' },
  { symbol: 'TATACONSUM', exchange: 'NSE', name: 'Tata Consumer Products' },
  { symbol: 'HEROMOTOCO', exchange: 'NSE', name: 'Hero MotoCorp' },
  { symbol: 'SHRIRAMFIN', exchange: 'NSE', name: 'Shriram Finance' },
  { symbol: 'LTIM', exchange: 'NSE', name: 'LTIMindtree' },
];

// Bank Nifty constituents
export const BANK_NIFTY = [
  { symbol: 'HDFCBANK', exchange: 'NSE', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', exchange: 'NSE', name: 'ICICI Bank' },
  { symbol: 'KOTAKBANK', exchange: 'NSE', name: 'Kotak Mahindra Bank' },
  { symbol: 'AXISBANK', exchange: 'NSE', name: 'Axis Bank' },
  { symbol: 'SBIN', exchange: 'NSE', name: 'State Bank of India' },
  { symbol: 'INDUSINDBK', exchange: 'NSE', name: 'IndusInd Bank' },
  { symbol: 'BANDHANBNK', exchange: 'NSE', name: 'Bandhan Bank' },
  { symbol: 'FEDERALBNK', exchange: 'NSE', name: 'Federal Bank' },
  { symbol: 'IDFCFIRSTB', exchange: 'NSE', name: 'IDFC First Bank' },
  { symbol: 'PNB', exchange: 'NSE', name: 'Punjab National Bank' },
  { symbol: 'AUBANK', exchange: 'NSE', name: 'AU Small Finance Bank' },
  { symbol: 'BANKBARODA', exchange: 'NSE', name: 'Bank of Baroda' },
];

// IT Sector stocks
export const NIFTY_IT = [
  { symbol: 'TCS', exchange: 'NSE', name: 'Tata Consultancy Services' },
  { symbol: 'INFY', exchange: 'NSE', name: 'Infosys' },
  { symbol: 'HCLTECH', exchange: 'NSE', name: 'HCL Technologies' },
  { symbol: 'WIPRO', exchange: 'NSE', name: 'Wipro' },
  { symbol: 'TECHM', exchange: 'NSE', name: 'Tech Mahindra' },
  { symbol: 'LTIM', exchange: 'NSE', name: 'LTIMindtree' },
  { symbol: 'COFORGE', exchange: 'NSE', name: 'Coforge' },
  { symbol: 'MPHASIS', exchange: 'NSE', name: 'Mphasis' },
  { symbol: 'PERSISTENT', exchange: 'NSE', name: 'Persistent Systems' },
  { symbol: 'LTITECH', exchange: 'NSE', name: 'L&T Technology Services' },
];

// Available stock list options
export const STOCK_LIST_OPTIONS = [
  { id: 'watchlist', name: 'Watchlist', description: 'Your watchlist symbols' },
  { id: 'nifty50', name: 'Nifty 50', description: '50 large cap stocks' },
  { id: 'banknifty', name: 'Bank Nifty', description: 'Banking sector stocks' },
  { id: 'niftyit', name: 'Nifty IT', description: 'IT sector stocks' },
];

// Get stock list by ID
export const getStockList = (listId) => {
  switch (listId) {
    case 'nifty50':
      return NIFTY_50;
    case 'banknifty':
      return BANK_NIFTY;
    case 'niftyit':
      return NIFTY_IT;
    default:
      return [];
  }
};
