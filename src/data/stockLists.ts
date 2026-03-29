/**
 * Predefined Stock Lists for Watchlist Discover panel & ANN Scanner
 * Organized by segment (like Kite): Indices, F&O Stocks, ETF
 */

export interface Stock {
  symbol: string;
  exchange: string;
  name: string;
}

export interface StockListOption {
  id: string;
  name: string;
  description: string;
}

export interface DiscoverGroup {
  id: string;
  name: string;
  stocks: Stock[];
}

export interface DiscoverSegment {
  id: string;
  name: string;
  groups: DiscoverGroup[];
}

// ─────────────────────────────────────────────
// INDIVIDUAL LISTS
// ─────────────────────────────────────────────

// Nifty 50 constituents (2024-25)
export const NIFTY_50: Stock[] = [
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
export const BANK_NIFTY: Stock[] = [
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
export const NIFTY_IT: Stock[] = [
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

// Nifty Auto
export const NIFTY_AUTO: Stock[] = [
  { symbol: 'MARUTI', exchange: 'NSE', name: 'Maruti Suzuki' },
  { symbol: 'TATAMOTORS', exchange: 'NSE', name: 'Tata Motors' },
  { symbol: 'M&M', exchange: 'NSE', name: 'Mahindra & Mahindra' },
  { symbol: 'EICHERMOT', exchange: 'NSE', name: 'Eicher Motors' },
  { symbol: 'HEROMOTOCO', exchange: 'NSE', name: 'Hero MotoCorp' },
  { symbol: 'BAJAJ-AUTO', exchange: 'NSE', name: 'Bajaj Auto' },
  { symbol: 'TVSMOTORS', exchange: 'NSE', name: 'TVS Motor Company' },
  { symbol: 'ASHOKLEY', exchange: 'NSE', name: 'Ashok Leyland' },
  { symbol: 'TVSMOTOR', exchange: 'NSE', name: 'TVS Motor' },
  { symbol: 'BALKRISIND', exchange: 'NSE', name: 'Balkrishna Industries' },
  { symbol: 'MOTHERSON', exchange: 'NSE', name: 'Samvardhana Motherson' },
];

// Nifty FMCG
export const NIFTY_FMCG: Stock[] = [
  { symbol: 'HINDUNILVR', exchange: 'NSE', name: 'Hindustan Unilever' },
  { symbol: 'ITC', exchange: 'NSE', name: 'ITC' },
  { symbol: 'NESTLEIND', exchange: 'NSE', name: 'Nestle India' },
  { symbol: 'BRITANNIA', exchange: 'NSE', name: 'Britannia Industries' },
  { symbol: 'TATACONSUM', exchange: 'NSE', name: 'Tata Consumer Products' },
  { symbol: 'DABUR', exchange: 'NSE', name: 'Dabur India' },
  { symbol: 'MARICO', exchange: 'NSE', name: 'Marico' },
  { symbol: 'COLPAL', exchange: 'NSE', name: 'Colgate Palmolive' },
  { symbol: 'GODREJCP', exchange: 'NSE', name: 'Godrej Consumer Products' },
  { symbol: 'EMAMILTD', exchange: 'NSE', name: 'Emami' },
  { symbol: 'UBL', exchange: 'NSE', name: 'United Breweries' },
];

// Nifty Pharma
export const NIFTY_PHARMA: Stock[] = [
  { symbol: 'SUNPHARMA', exchange: 'NSE', name: 'Sun Pharmaceutical' },
  { symbol: 'DRREDDY', exchange: 'NSE', name: 'Dr Reddys Labs' },
  { symbol: 'CIPLA', exchange: 'NSE', name: 'Cipla' },
  { symbol: 'APOLLOHOSP', exchange: 'NSE', name: 'Apollo Hospitals' },
  { symbol: 'DIVISLAB', exchange: 'NSE', name: 'Divis Laboratories' },
  { symbol: 'AUROPHARMA', exchange: 'NSE', name: 'Aurobindo Pharma' },
  { symbol: 'BIOCON', exchange: 'NSE', name: 'Biocon' },
  { symbol: 'TORNTPHARM', exchange: 'NSE', name: 'Torrent Pharmaceuticals' },
  { symbol: 'LUPIN', exchange: 'NSE', name: 'Lupin' },
  { symbol: 'ALKEM', exchange: 'NSE', name: 'Alkem Laboratories' },
  { symbol: 'IPCA', exchange: 'NSE', name: 'IPCA Laboratories' },
];

// Nifty Metal
export const NIFTY_METAL: Stock[] = [
  { symbol: 'TATASTEEL', exchange: 'NSE', name: 'Tata Steel' },
  { symbol: 'JSWSTEEL', exchange: 'NSE', name: 'JSW Steel' },
  { symbol: 'HINDALCO', exchange: 'NSE', name: 'Hindalco Industries' },
  { symbol: 'COALINDIA', exchange: 'NSE', name: 'Coal India' },
  { symbol: 'VEDL', exchange: 'NSE', name: 'Vedanta' },
  { symbol: 'SAIL', exchange: 'NSE', name: 'Steel Authority of India' },
  { symbol: 'NMDC', exchange: 'NSE', name: 'NMDC' },
  { symbol: 'NATIONALUM', exchange: 'NSE', name: 'National Aluminium' },
  { symbol: 'JINDALSTEL', exchange: 'NSE', name: 'Jindal Steel & Power' },
  { symbol: 'APL', exchange: 'NSE', name: 'APL Apollo Tubes' },
];

// Nifty Realty
export const NIFTY_REALTY: Stock[] = [
  { symbol: 'DLF', exchange: 'NSE', name: 'DLF' },
  { symbol: 'GODREJPROP', exchange: 'NSE', name: 'Godrej Properties' },
  { symbol: 'OBEROIRLTY', exchange: 'NSE', name: 'Oberoi Realty' },
  { symbol: 'PRESTIGE', exchange: 'NSE', name: 'Prestige Estates' },
  { symbol: 'MACROTECH', exchange: 'NSE', name: 'Lodha (Macrotech Dev)' },
  { symbol: 'PHOENIXLTD', exchange: 'NSE', name: 'Phoenix Mills' },
  { symbol: 'BRIGADE', exchange: 'NSE', name: 'Brigade Enterprises' },
  { symbol: 'SOBHA', exchange: 'NSE', name: 'Sobha Developers' },
  { symbol: 'KOLTEPATIL', exchange: 'NSE', name: 'Kolte-Patil Developers' },
];

// Nifty FinNifty
export const NIFTY_FINNIFTY: Stock[] = [
  { symbol: 'HDFCBANK', exchange: 'NSE', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', exchange: 'NSE', name: 'ICICI Bank' },
  { symbol: 'BAJFINANCE', exchange: 'NSE', name: 'Bajaj Finance' },
  { symbol: 'KOTAKBANK', exchange: 'NSE', name: 'Kotak Mahindra Bank' },
  { symbol: 'AXISBANK', exchange: 'NSE', name: 'Axis Bank' },
  { symbol: 'SBIN', exchange: 'NSE', name: 'State Bank of India' },
  { symbol: 'BAJAJFINSV', exchange: 'NSE', name: 'Bajaj Finserv' },
  { symbol: 'SBILIFE', exchange: 'NSE', name: 'SBI Life Insurance' },
  { symbol: 'HDFCLIFE', exchange: 'NSE', name: 'HDFC Life Insurance' },
  { symbol: 'SHRIRAMFIN', exchange: 'NSE', name: 'Shriram Finance' },
  { symbol: 'INDUSINDBK', exchange: 'NSE', name: 'IndusInd Bank' },
  { symbol: 'LICI', exchange: 'NSE', name: 'LIC of India' },
  { symbol: 'ICICIPRULI', exchange: 'NSE', name: 'ICICI Prudential Life' },
  { symbol: 'ICICIGI', exchange: 'NSE', name: 'ICICI Lombard General' },
  { symbol: 'MUTHOOTFIN', exchange: 'NSE', name: 'Muthoot Finance' },
  { symbol: 'PFC', exchange: 'NSE', name: 'Power Finance Corp' },
  { symbol: 'RECLTD', exchange: 'NSE', name: 'REC Limited' },
  { symbol: 'M&MFIN', exchange: 'NSE', name: 'M&M Financial Services' },
  { symbol: 'CHOLAFIN', exchange: 'NSE', name: 'Cholamandalam Investment' },
  { symbol: 'FEDERALBNK', exchange: 'NSE', name: 'Federal Bank' },
];

// BSE Sensex (top 30)
export const BSE_SENSEX: Stock[] = [
  { symbol: 'RELIANCE', exchange: 'BSE', name: 'Reliance Industries' },
  { symbol: 'TCS', exchange: 'BSE', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK', exchange: 'BSE', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', exchange: 'BSE', name: 'ICICI Bank' },
  { symbol: 'INFY', exchange: 'BSE', name: 'Infosys' },
  { symbol: 'HINDUNILVR', exchange: 'BSE', name: 'Hindustan Unilever' },
  { symbol: 'ITC', exchange: 'BSE', name: 'ITC' },
  { symbol: 'SBIN', exchange: 'BSE', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', exchange: 'BSE', name: 'Bharti Airtel' },
  { symbol: 'KOTAKBANK', exchange: 'BSE', name: 'Kotak Mahindra Bank' },
  { symbol: 'LT', exchange: 'BSE', name: 'Larsen & Toubro' },
  { symbol: 'HCLTECH', exchange: 'BSE', name: 'HCL Technologies' },
  { symbol: 'AXISBANK', exchange: 'BSE', name: 'Axis Bank' },
  { symbol: 'ASIANPAINT', exchange: 'BSE', name: 'Asian Paints' },
  { symbol: 'MARUTI', exchange: 'BSE', name: 'Maruti Suzuki' },
  { symbol: 'SUNPHARMA', exchange: 'BSE', name: 'Sun Pharmaceutical' },
  { symbol: 'TITAN', exchange: 'BSE', name: 'Titan Company' },
  { symbol: 'BAJFINANCE', exchange: 'BSE', name: 'Bajaj Finance' },
  { symbol: 'ULTRACEMCO', exchange: 'BSE', name: 'UltraTech Cement' },
  { symbol: 'WIPRO', exchange: 'BSE', name: 'Wipro' },
  { symbol: 'NTPC', exchange: 'BSE', name: 'NTPC' },
  { symbol: 'M&M', exchange: 'BSE', name: 'Mahindra & Mahindra' },
  { symbol: 'POWERGRID', exchange: 'BSE', name: 'Power Grid Corp' },
  { symbol: 'TATASTEEL', exchange: 'BSE', name: 'Tata Steel' },
  { symbol: 'BAJAJFINSV', exchange: 'BSE', name: 'Bajaj Finserv' },
  { symbol: 'TATAMOTORS', exchange: 'BSE', name: 'Tata Motors' },
  { symbol: 'NESTLEIND', exchange: 'BSE', name: 'Nestle India' },
  { symbol: 'ADANIENT', exchange: 'BSE', name: 'Adani Enterprises' },
  { symbol: 'DRREDDY', exchange: 'BSE', name: 'Dr Reddys Labs' },
  { symbol: 'INDUSINDBK', exchange: 'BSE', name: 'IndusInd Bank' },
];

// BSE Bankex
export const BSE_BANKEX: Stock[] = [
  { symbol: 'HDFCBANK', exchange: 'BSE', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', exchange: 'BSE', name: 'ICICI Bank' },
  { symbol: 'SBIN', exchange: 'BSE', name: 'State Bank of India' },
  { symbol: 'KOTAKBANK', exchange: 'BSE', name: 'Kotak Mahindra Bank' },
  { symbol: 'AXISBANK', exchange: 'BSE', name: 'Axis Bank' },
  { symbol: 'INDUSINDBK', exchange: 'BSE', name: 'IndusInd Bank' },
  { symbol: 'BANDHANBNK', exchange: 'BSE', name: 'Bandhan Bank' },
  { symbol: 'IDFCFIRSTB', exchange: 'BSE', name: 'IDFC First Bank' },
  { symbol: 'PNB', exchange: 'BSE', name: 'Punjab National Bank' },
  { symbol: 'BANKBARODA', exchange: 'BSE', name: 'Bank of Baroda' },
];

// Major Indices (tradable index symbols)
export const MAJOR_INDICES: Stock[] = [
  { symbol: 'NIFTY', exchange: 'NSE', name: 'Nifty 50' },
  { symbol: 'BANKNIFTY', exchange: 'NSE', name: 'Bank Nifty' },
  { symbol: 'FINNIFTY', exchange: 'NSE', name: 'Nifty Financial Services' },
  { symbol: 'MIDCPNIFTY', exchange: 'NSE', name: 'Nifty Midcap Select' },
  { symbol: 'SENSEX', exchange: 'BSE', name: 'BSE Sensex' },
  { symbol: 'BANKEX', exchange: 'BSE', name: 'BSE Bankex' },
  { symbol: 'SENSEX50', exchange: 'BSE', name: 'BSE Sensex 50' },
];

// Global Indices (approximate symbols — adjust if broker supports different)
export const GLOBAL_INDICES: Stock[] = [
  { symbol: 'DJI', exchange: 'NSE', name: 'Dow Jones Industrial Avg' },
  { symbol: 'SPX', exchange: 'NSE', name: 'S&P 500' },
  { symbol: 'NASDAQ', exchange: 'NSE', name: 'Nasdaq Composite' },
  { symbol: 'FTSE', exchange: 'NSE', name: 'FTSE 100' },
  { symbol: 'DAX', exchange: 'NSE', name: 'DAX (Germany)' },
  { symbol: 'N225', exchange: 'NSE', name: 'Nikkei 225' },
  { symbol: 'HSI', exchange: 'NSE', name: 'Hang Seng Index' },
  { symbol: 'SSE', exchange: 'NSE', name: 'Shanghai Composite' },
];

// NSE F&O Stocks — complete list of all F&O eligible stocks
export const NSE_FO_STOCKS: Stock[] = [
  { symbol: 'RELIANCE', exchange: 'NSE', name: 'Reliance Industries' },
  { symbol: 'TCS', exchange: 'NSE', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK', exchange: 'NSE', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', exchange: 'NSE', name: 'ICICI Bank' },
  { symbol: 'INFY', exchange: 'NSE', name: 'Infosys' },
  { symbol: 'SBIN', exchange: 'NSE', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', exchange: 'NSE', name: 'Bharti Airtel' },
  { symbol: 'AXISBANK', exchange: 'NSE', name: 'Axis Bank' },
  { symbol: 'KOTAKBANK', exchange: 'NSE', name: 'Kotak Mahindra Bank' },
  { symbol: 'LT', exchange: 'NSE', name: 'Larsen & Toubro' },
  { symbol: 'BAJFINANCE', exchange: 'NSE', name: 'Bajaj Finance' },
  { symbol: 'MARUTI', exchange: 'NSE', name: 'Maruti Suzuki' },
  { symbol: 'TATAMOTORS', exchange: 'NSE', name: 'Tata Motors' },
  { symbol: 'HCLTECH', exchange: 'NSE', name: 'HCL Technologies' },
  { symbol: 'WIPRO', exchange: 'NSE', name: 'Wipro' },
  { symbol: 'SUNPHARMA', exchange: 'NSE', name: 'Sun Pharmaceutical' },
  { symbol: 'HINDUNILVR', exchange: 'NSE', name: 'Hindustan Unilever' },
  { symbol: 'ITC', exchange: 'NSE', name: 'ITC' },
  { symbol: 'M&M', exchange: 'NSE', name: 'Mahindra & Mahindra' },
  { symbol: 'TITAN', exchange: 'NSE', name: 'Titan Company' },
  { symbol: 'NTPC', exchange: 'NSE', name: 'NTPC' },
  { symbol: 'ULTRACEMCO', exchange: 'NSE', name: 'UltraTech Cement' },
  { symbol: 'ONGC', exchange: 'NSE', name: 'ONGC' },
  { symbol: 'ADANIENT', exchange: 'NSE', name: 'Adani Enterprises' },
  { symbol: 'ADANIPORTS', exchange: 'NSE', name: 'Adani Ports' },
  { symbol: 'JSWSTEEL', exchange: 'NSE', name: 'JSW Steel' },
  { symbol: 'TATASTEEL', exchange: 'NSE', name: 'Tata Steel' },
  { symbol: 'COALINDIA', exchange: 'NSE', name: 'Coal India' },
  { symbol: 'BAJAJFINSV', exchange: 'NSE', name: 'Bajaj Finserv' },
  { symbol: 'POWERGRID', exchange: 'NSE', name: 'Power Grid Corp' },
  { symbol: 'HINDALCO', exchange: 'NSE', name: 'Hindalco Industries' },
  { symbol: 'INDUSINDBK', exchange: 'NSE', name: 'IndusInd Bank' },
  { symbol: 'GRASIM', exchange: 'NSE', name: 'Grasim Industries' },
  { symbol: 'BPCL', exchange: 'NSE', name: 'Bharat Petroleum' },
  { symbol: 'CIPLA', exchange: 'NSE', name: 'Cipla' },
  { symbol: 'DIVISLAB', exchange: 'NSE', name: 'Divis Laboratories' },
  { symbol: 'DRREDDY', exchange: 'NSE', name: 'Dr Reddys Labs' },
  { symbol: 'EICHERMOT', exchange: 'NSE', name: 'Eicher Motors' },
  { symbol: 'TECHM', exchange: 'NSE', name: 'Tech Mahindra' },
  { symbol: 'NESTLEIND', exchange: 'NSE', name: 'Nestle India' },
  { symbol: 'APOLLOHOSP', exchange: 'NSE', name: 'Apollo Hospitals' },
  { symbol: 'BRITANNIA', exchange: 'NSE', name: 'Britannia Industries' },
  { symbol: 'DLF', exchange: 'NSE', name: 'DLF' },
  { symbol: 'TATACONSUM', exchange: 'NSE', name: 'Tata Consumer Products' },
  { symbol: 'HEROMOTOCO', exchange: 'NSE', name: 'Hero MotoCorp' },
  { symbol: 'SHRIRAMFIN', exchange: 'NSE', name: 'Shriram Finance' },
  { symbol: 'LTIM', exchange: 'NSE', name: 'LTIMindtree' },
  { symbol: 'BAJAJ-AUTO', exchange: 'NSE', name: 'Bajaj Auto' },
  { symbol: 'ASIANPAINT', exchange: 'NSE', name: 'Asian Paints' },
  { symbol: 'DMART', exchange: 'NSE', name: 'Avenue Supermarts' },
  // Banking
  { symbol: 'FEDERALBNK', exchange: 'NSE', name: 'Federal Bank' },
  { symbol: 'IDFCFIRSTB', exchange: 'NSE', name: 'IDFC First Bank' },
  { symbol: 'PNB', exchange: 'NSE', name: 'Punjab National Bank' },
  { symbol: 'BANKBARODA', exchange: 'NSE', name: 'Bank of Baroda' },
  { symbol: 'AUBANK', exchange: 'NSE', name: 'AU Small Finance Bank' },
  { symbol: 'BANDHANBNK', exchange: 'NSE', name: 'Bandhan Bank' },
  { symbol: 'CANBK', exchange: 'NSE', name: 'Canara Bank' },
  { symbol: 'UNIONBANK', exchange: 'NSE', name: 'Union Bank of India' },
  { symbol: 'INDIANB', exchange: 'NSE', name: 'Indian Bank' },
  { symbol: 'CENTRALBK', exchange: 'NSE', name: 'Central Bank of India' },
  { symbol: 'MAHABANK', exchange: 'NSE', name: 'Bank of Maharashtra' },
  { symbol: 'UCOBANK', exchange: 'NSE', name: 'UCO Bank' },
  { symbol: 'RBLBANK', exchange: 'NSE', name: 'RBL Bank' },
  { symbol: 'YESBANK', exchange: 'NSE', name: 'Yes Bank' },
  { symbol: 'KARURVYSYA', exchange: 'NSE', name: 'Karur Vysya Bank' },
  { symbol: 'DCBBANK', exchange: 'NSE', name: 'DCB Bank' },
  { symbol: 'LAKSHVILAS', exchange: 'NSE', name: 'Lakshmi Vilas Bank' },
  // Finance & Insurance
  { symbol: 'LICI', exchange: 'NSE', name: 'LIC of India' },
  { symbol: 'SBILIFE', exchange: 'NSE', name: 'SBI Life Insurance' },
  { symbol: 'HDFCLIFE', exchange: 'NSE', name: 'HDFC Life Insurance' },
  { symbol: 'ICICIPRULI', exchange: 'NSE', name: 'ICICI Prudential Life' },
  { symbol: 'ICICIGI', exchange: 'NSE', name: 'ICICI Lombard General' },
  { symbol: 'MUTHOOTFIN', exchange: 'NSE', name: 'Muthoot Finance' },
  { symbol: 'CHOLAFIN', exchange: 'NSE', name: 'Cholamandalam Investment' },
  { symbol: 'M&MFIN', exchange: 'NSE', name: 'M&M Financial Services' },
  { symbol: 'PFC', exchange: 'NSE', name: 'Power Finance Corp' },
  { symbol: 'RECLTD', exchange: 'NSE', name: 'REC Limited' },
  { symbol: 'POONAWALLA', exchange: 'NSE', name: 'Poonawalla Fincorp' },
  { symbol: 'AAVAS', exchange: 'NSE', name: 'Aavas Financiers' },
  { symbol: 'LICHSGFIN', exchange: 'NSE', name: 'LIC Housing Finance' },
  { symbol: 'MANAPPURAM', exchange: 'NSE', name: 'Manappuram Finance' },
  { symbol: 'BAJAJHLDNG', exchange: 'NSE', name: 'Bajaj Holdings' },
  // IT & Tech
  { symbol: 'COFORGE', exchange: 'NSE', name: 'Coforge' },
  { symbol: 'MPHASIS', exchange: 'NSE', name: 'Mphasis' },
  { symbol: 'PERSISTENT', exchange: 'NSE', name: 'Persistent Systems' },
  { symbol: 'LTITECH', exchange: 'NSE', name: 'L&T Technology Services' },
  { symbol: 'KPITTECH', exchange: 'NSE', name: 'KPIT Technologies' },
  { symbol: 'TATAELXSI', exchange: 'NSE', name: 'Tata Elxsi' },
  { symbol: 'OFSS', exchange: 'NSE', name: 'Oracle Financial Services' },
  { symbol: 'HEXAWARE', exchange: 'NSE', name: 'Hexaware Technologies' },
  // Auto & Components
  { symbol: 'TVSMOTORS', exchange: 'NSE', name: 'TVS Motor Company' },
  { symbol: 'TVSMOTOR', exchange: 'NSE', name: 'TVS Motor' },
  { symbol: 'ASHOKLEY', exchange: 'NSE', name: 'Ashok Leyland' },
  { symbol: 'BALKRISIND', exchange: 'NSE', name: 'Balkrishna Industries' },
  { symbol: 'MOTHERSON', exchange: 'NSE', name: 'Samvardhana Motherson' },
  { symbol: 'BOSCHLTD', exchange: 'NSE', name: 'Bosch' },
  { symbol: 'EXIDEIND', exchange: 'NSE', name: 'Exide Industries' },
  { symbol: 'AMARAJABAT', exchange: 'NSE', name: 'Amara Raja Energy' },
  { symbol: 'FORCEMOT', exchange: 'NSE', name: 'Force Motors' },
  { symbol: 'SUNDRMFAST', exchange: 'NSE', name: 'Sundram Fasteners' },
  { symbol: 'ENDURANCE', exchange: 'NSE', name: 'Endurance Technologies' },
  { symbol: 'TIINDIA', exchange: 'NSE', name: 'Tube Investments of India' },
  // Pharma
  { symbol: 'AUROPHARMA', exchange: 'NSE', name: 'Aurobindo Pharma' },
  { symbol: 'BIOCON', exchange: 'NSE', name: 'Biocon' },
  { symbol: 'TORNTPHARM', exchange: 'NSE', name: 'Torrent Pharmaceuticals' },
  { symbol: 'LUPIN', exchange: 'NSE', name: 'Lupin' },
  { symbol: 'ALKEM', exchange: 'NSE', name: 'Alkem Laboratories' },
  { symbol: 'IPCA', exchange: 'NSE', name: 'IPCA Laboratories' },
  { symbol: 'GRANULES', exchange: 'NSE', name: 'Granules India' },
  { symbol: 'LALPATHLAB', exchange: 'NSE', name: 'Dr Lal PathLabs' },
  { symbol: 'METROPOLIS', exchange: 'NSE', name: 'Metropolis Healthcare' },
  { symbol: 'MAXHEALTH', exchange: 'NSE', name: 'Max Healthcare' },
  { symbol: 'FORTIS', exchange: 'NSE', name: 'Fortis Healthcare' },
  { symbol: 'NHLIND', exchange: 'NSE', name: 'Narayana Hrudayalaya' },
  { symbol: 'ABBOTINDIA', exchange: 'NSE', name: 'Abbott India' },
  { symbol: 'PFIZER', exchange: 'NSE', name: 'Pfizer' },
  { symbol: 'GLAXO', exchange: 'NSE', name: 'GSK Pharmaceuticals' },
  // FMCG & Consumer
  { symbol: 'DABUR', exchange: 'NSE', name: 'Dabur India' },
  { symbol: 'MARICO', exchange: 'NSE', name: 'Marico' },
  { symbol: 'COLPAL', exchange: 'NSE', name: 'Colgate Palmolive' },
  { symbol: 'GODREJCP', exchange: 'NSE', name: 'Godrej Consumer Products' },
  { symbol: 'EMAMILTD', exchange: 'NSE', name: 'Emami' },
  { symbol: 'UBL', exchange: 'NSE', name: 'United Breweries' },
  { symbol: 'RADICO', exchange: 'NSE', name: 'Radico Khaitan' },
  { symbol: 'UNITDSPR', exchange: 'NSE', name: 'United Spirits' },
  { symbol: 'MCDOWELL-N', exchange: 'NSE', name: 'McDowell\'s N' },
  // Metals & Mining
  { symbol: 'VEDL', exchange: 'NSE', name: 'Vedanta' },
  { symbol: 'SAIL', exchange: 'NSE', name: 'Steel Authority of India' },
  { symbol: 'NMDC', exchange: 'NSE', name: 'NMDC' },
  { symbol: 'NATIONALUM', exchange: 'NSE', name: 'National Aluminium' },
  { symbol: 'JINDALSTEL', exchange: 'NSE', name: 'Jindal Steel & Power' },
  { symbol: 'APL', exchange: 'NSE', name: 'APL Apollo Tubes' },
  { symbol: 'HINDZINC', exchange: 'NSE', name: 'Hindustan Zinc' },
  { symbol: 'WELCORP', exchange: 'NSE', name: 'Welspun Corp' },
  { symbol: 'RATNAMANI', exchange: 'NSE', name: 'Ratnamani Metals' },
  { symbol: 'APLAPOLLO', exchange: 'NSE', name: 'APL Apollo Tubes' },
  // Oil & Gas / Energy
  { symbol: 'IOC', exchange: 'NSE', name: 'Indian Oil Corp' },
  { symbol: 'HINDPETRO', exchange: 'NSE', name: 'Hindustan Petroleum' },
  { symbol: 'GAIL', exchange: 'NSE', name: 'GAIL (India)' },
  { symbol: 'PETRONET', exchange: 'NSE', name: 'Petronet LNG' },
  { symbol: 'MGL', exchange: 'NSE', name: 'Mahanagar Gas' },
  { symbol: 'IGL', exchange: 'NSE', name: 'Indraprastha Gas' },
  { symbol: 'GSPL', exchange: 'NSE', name: 'Gujarat State Petronet' },
  { symbol: 'TATAPOWER', exchange: 'NSE', name: 'Tata Power' },
  { symbol: 'ADANIGREEN', exchange: 'NSE', name: 'Adani Green Energy' },
  { symbol: 'ADANITRANS', exchange: 'NSE', name: 'Adani Transmission' },
  { symbol: 'TORNTPOWER', exchange: 'NSE', name: 'Torrent Power' },
  { symbol: 'CESC', exchange: 'NSE', name: 'CESC' },
  { symbol: 'NHPC', exchange: 'NSE', name: 'NHPC' },
  { symbol: 'SJVN', exchange: 'NSE', name: 'SJVN' },
  // Cement & Infrastructure
  { symbol: 'SHREECEM', exchange: 'NSE', name: 'Shree Cement' },
  { symbol: 'AMBUJACEM', exchange: 'NSE', name: 'Ambuja Cements' },
  { symbol: 'ACC', exchange: 'NSE', name: 'ACC' },
  { symbol: 'DALBHARAT', exchange: 'NSE', name: 'Dalmia Bharat' },
  { symbol: 'RAMCOCEM', exchange: 'NSE', name: 'Ramco Cements' },
  { symbol: 'NUVOCO', exchange: 'NSE', name: 'Nuvoco Vistas Corp' },
  { symbol: 'LTTS', exchange: 'NSE', name: 'L&T Technology Services' },
  { symbol: 'IRB', exchange: 'NSE', name: 'IRB Infrastructure Dev' },
  { symbol: 'KNRCON', exchange: 'NSE', name: 'KNR Constructions' },
  { symbol: 'PNCINFRA', exchange: 'NSE', name: 'PNC Infratech' },
  { symbol: 'NCC', exchange: 'NSE', name: 'NCC Ltd' },
  // Real Estate
  { symbol: 'GODREJPROP', exchange: 'NSE', name: 'Godrej Properties' },
  { symbol: 'OBEROIRLTY', exchange: 'NSE', name: 'Oberoi Realty' },
  { symbol: 'PRESTIGE', exchange: 'NSE', name: 'Prestige Estates' },
  { symbol: 'MACROTECH', exchange: 'NSE', name: 'Lodha (Macrotech Dev)' },
  { symbol: 'PHOENIXLTD', exchange: 'NSE', name: 'Phoenix Mills' },
  { symbol: 'BRIGADE', exchange: 'NSE', name: 'Brigade Enterprises' },
  { symbol: 'SOBHA', exchange: 'NSE', name: 'Sobha Developers' },
  { symbol: 'KOLTEPATIL', exchange: 'NSE', name: 'Kolte-Patil Developers' },
  // Capital Goods & Defence
  { symbol: 'BEL', exchange: 'NSE', name: 'Bharat Electronics' },
  { symbol: 'HAL', exchange: 'NSE', name: 'Hindustan Aeronautics' },
  { symbol: 'BHEL', exchange: 'NSE', name: 'Bharat Heavy Electricals' },
  { symbol: 'ABB', exchange: 'NSE', name: 'ABB India' },
  { symbol: 'SIEMENS', exchange: 'NSE', name: 'Siemens' },
  { symbol: 'SCHNEIDER', exchange: 'NSE', name: 'Schneider Electric' },
  { symbol: 'CUMMINSIND', exchange: 'NSE', name: 'Cummins India' },
  { symbol: 'BHARAT-ELE', exchange: 'NSE', name: 'Bharat Electronics' },
  { symbol: 'GRINDWELL', exchange: 'NSE', name: 'Grindwell Norton' },
  { symbol: 'CG', exchange: 'NSE', name: 'Crompton Greaves Consumer' },
  { symbol: 'CGPOWER', exchange: 'NSE', name: 'CG Power & Industrial' },
  { symbol: 'TD POWER', exchange: 'NSE', name: 'TD Power Systems' },
  { symbol: 'THERMAX', exchange: 'NSE', name: 'Thermax' },
  { symbol: 'COCHINSHIP', exchange: 'NSE', name: 'Cochin Shipyard' },
  { symbol: 'MAHINDCIE', exchange: 'NSE', name: 'Mahindra CIE Automotive' },
  // Chemicals & Specialty
  { symbol: 'PIDILITIND', exchange: 'NSE', name: 'Pidilite Industries' },
  { symbol: 'SRF', exchange: 'NSE', name: 'SRF' },
  { symbol: 'DEEPAKNTR', exchange: 'NSE', name: 'Deepak Nitrite' },
  { symbol: 'AARTI', exchange: 'NSE', name: 'Aarti Industries' },
  { symbol: 'NAVINFLUOR', exchange: 'NSE', name: 'Navin Fluorine' },
  { symbol: 'ALKYLAMINE', exchange: 'NSE', name: 'Alkyl Amines Chemicals' },
  { symbol: 'FINEORG', exchange: 'NSE', name: 'Fine Organic Industries' },
  { symbol: 'TATACHEM', exchange: 'NSE', name: 'Tata Chemicals' },
  { symbol: 'GHCL', exchange: 'NSE', name: 'GHCL' },
  { symbol: 'BASF', exchange: 'NSE', name: 'BASF India' },
  // Retail & Lifestyle
  { symbol: 'TRENT', exchange: 'NSE', name: 'Trent' },
  { symbol: 'SHOPERSTOP', exchange: 'NSE', name: 'Shoppers Stop' },
  { symbol: 'V2RETAIL', exchange: 'NSE', name: 'V2 Retail' },
  { symbol: 'VMART', exchange: 'NSE', name: 'V-Mart Retail' },
  { symbol: 'NYKAA', exchange: 'NSE', name: 'FSN E-Commerce (Nykaa)' },
  { symbol: 'ZOMATO', exchange: 'NSE', name: 'Zomato' },
  { symbol: 'PAYTM', exchange: 'NSE', name: 'One97 Communications (Paytm)' },
  { symbol: 'POLICYBZR', exchange: 'NSE', name: 'PB Fintech (PolicyBazaar)' },
  { symbol: 'CARTRADE', exchange: 'NSE', name: 'CarTrade Tech' },
  { symbol: 'INDIAMART', exchange: 'NSE', name: 'IndiaMART InterMESH' },
  { symbol: 'JUSTDIAL', exchange: 'NSE', name: 'Just Dial' },
  // Telecom & Media
  { symbol: 'IDEA', exchange: 'NSE', name: 'Vodafone Idea' },
  { symbol: 'TATACOMM', exchange: 'NSE', name: 'Tata Communications' },
  { symbol: 'HFCL', exchange: 'NSE', name: 'HFCL' },
  { symbol: 'STLARETAIL', exchange: 'NSE', name: 'Star Health Insurance' },
  // Logistics & Transport
  { symbol: 'CONCOR', exchange: 'NSE', name: 'Container Corp of India' },
  { symbol: 'BLUEDART', exchange: 'NSE', name: 'Blue Dart Express' },
  { symbol: 'DELHIVERY', exchange: 'NSE', name: 'Delhivery' },
  { symbol: 'MAHLOG', exchange: 'NSE', name: 'Mahindra Logistics' },
  { symbol: 'SAIRAM', exchange: 'NSE', name: 'Sai Silks (Kalamandir)' },
  // Agri & Fertilizers
  { symbol: 'CHAMBAL', exchange: 'NSE', name: 'Chambal Fertilisers' },
  { symbol: 'RCF', exchange: 'NSE', name: 'Rashtriya Chemicals' },
  { symbol: 'COROMANDEL', exchange: 'NSE', name: 'Coromandel International' },
  { symbol: 'UPL', exchange: 'NSE', name: 'UPL' },
  { symbol: 'PIIND', exchange: 'NSE', name: 'PI Industries' },
  { symbol: 'RALLIS', exchange: 'NSE', name: 'Rallis India' },
  { symbol: 'BAYER', exchange: 'NSE', name: 'Bayer Cropscience' },
  // Textiles
  { symbol: 'PAGEIND', exchange: 'NSE', name: 'Page Industries' },
  { symbol: 'RAYMOND', exchange: 'NSE', name: 'Raymond' },
  { symbol: 'KPRMILL', exchange: 'NSE', name: 'KPR Mill' },
  { symbol: 'SOMANYCERA', exchange: 'NSE', name: 'Somany Ceramics' },
  { symbol: 'KAJARIACER', exchange: 'NSE', name: 'Kajaria Ceramics' },
  // Miscellaneous
  { symbol: 'GLENMARK', exchange: 'NSE', name: 'Glenmark Pharmaceuticals' },
  { symbol: 'ZYDUSLIFE', exchange: 'NSE', name: 'Zydus Lifesciences' },
  { symbol: 'JUBLFOOD', exchange: 'NSE', name: 'Jubilant Foodworks' },
  { symbol: 'WESTLIFE', exchange: 'NSE', name: 'Westlife Foodworld' },
  { symbol: 'DEVYANI', exchange: 'NSE', name: 'Devyani International' },
  { symbol: 'BARBEQUE', exchange: 'NSE', name: 'Barbeque Nation Hospitality' },
  { symbol: 'LEMERITE', exchange: 'NSE', name: 'Le Merite Exports' },
  { symbol: 'MFSL', exchange: 'NSE', name: 'Max Financial Services' },
  { symbol: 'STARHEALTH', exchange: 'NSE', name: 'Star Health Insurance' },
  { symbol: 'NIACL', exchange: 'NSE', name: 'New India Assurance' },
  { symbol: 'GICRE', exchange: 'NSE', name: 'General Insurance Corp' },
  { symbol: 'IRCTC', exchange: 'NSE', name: 'IRCTC' },
  { symbol: 'RAILVIKAS', exchange: 'NSE', name: 'Rail Vikas Nigam' },
  { symbol: 'RVNL', exchange: 'NSE', name: 'Rail Vikas Nigam Ltd' },
  { symbol: 'IRFC', exchange: 'NSE', name: 'Indian Railway Finance Corp' },
  { symbol: 'HUDCO', exchange: 'NSE', name: 'Housing & Urban Dev Corp' },
  { symbol: 'NBCC', exchange: 'NSE', name: 'NBCC (India)' },
  { symbol: 'BDL', exchange: 'NSE', name: 'Bharat Dynamics' },
  { symbol: 'RITES', exchange: 'NSE', name: 'RITES' },
  { symbol: 'IREDA', exchange: 'NSE', name: 'Indian Renewable Energy Dev' },
  { symbol: 'MAZAGON', exchange: 'NSE', name: 'Mazagon Dock Shipbuilders' },
];


// ETFs - Broad Based
export const ETF_BROAD: Stock[] = [
  { symbol: 'NIFTYBEES', exchange: 'NSE', name: 'Nippon India Nifty 50 ETF' },
  { symbol: 'JUNIORBEES', exchange: 'NSE', name: 'Nippon India Junior Bees' },
  { symbol: 'SETFNN50', exchange: 'NSE', name: 'SBI ETF Nifty Next 50' },
  { symbol: 'MOM100', exchange: 'NSE', name: 'Mirae Asset Nifty 100 ETF' },
  { symbol: 'ICICINIFTY', exchange: 'NSE', name: 'ICICI Prudential Nifty ETF' },
  { symbol: 'HDFCNIFTY', exchange: 'NSE', name: 'HDFC Nifty 50 ETF' },
  { symbol: 'SENSEXBEES', exchange: 'BSE', name: 'Nippon India Sensex ETF' },
];

// ETFs - Sectoral
export const ETF_SECTORAL: Stock[] = [
  { symbol: 'BANKBEES', exchange: 'NSE', name: 'Nippon India Bank ETF' },
  { symbol: 'ITBEES', exchange: 'NSE', name: 'Nippon India IT ETF' },
  { symbol: 'PHARMABEES', exchange: 'NSE', name: 'Nippon India Pharma ETF' },
  { symbol: 'AUTOIETF', exchange: 'NSE', name: 'Mirae Asset Nifty Auto ETF' },
  { symbol: 'INFRABEES', exchange: 'NSE', name: 'Nippon India Infra ETF' },
  { symbol: 'DIVOPPBEES', exchange: 'NSE', name: 'Nippon India Div Opp ETF' },
];

// ETFs - Debt / Commodity
export const ETF_DEBT_COMMODITY: Stock[] = [
  { symbol: 'LIQUIDBEES', exchange: 'NSE', name: 'Nippon India Liquid ETF' },
  { symbol: 'GOLDBEES', exchange: 'NSE', name: 'Nippon India Gold ETF' },
  { symbol: 'SETFGOLD', exchange: 'NSE', name: 'SBI Gold ETF' },
  { symbol: 'HDFCGOLD', exchange: 'NSE', name: 'HDFC Gold ETF' },
  { symbol: 'AXISGOLD', exchange: 'NSE', name: 'Axis Gold ETF' },
  { symbol: 'SILVERBEES', exchange: 'NSE', name: 'Nippon India Silver ETF' },
];

// ─────────────────────────────────────────────
// DISCOVER SEGMENTS (Kite-style hierarchy)
// ─────────────────────────────────────────────
export const DISCOVER_SEGMENTS: DiscoverSegment[] = [
  {
    id: 'indices',
    name: 'INDICES',
    groups: [
      { id: 'major_indices', name: 'Major Indices', stocks: MAJOR_INDICES },
      { id: 'global_indices', name: 'Global Indices', stocks: GLOBAL_INDICES },
      { id: 'nifty50', name: 'Nifty 50', stocks: NIFTY_50 },
      { id: 'banknifty', name: 'Bank Nifty', stocks: BANK_NIFTY },
      { id: 'finnifty', name: 'Nifty FinNifty', stocks: NIFTY_FINNIFTY },
      { id: 'bse_sensex', name: 'BSE Sensex', stocks: BSE_SENSEX },
      { id: 'nifty_it', name: 'Nifty IT', stocks: NIFTY_IT },
      { id: 'nifty_auto', name: 'Nifty Auto', stocks: NIFTY_AUTO },
      { id: 'nifty_fmcg', name: 'Nifty FMCG', stocks: NIFTY_FMCG },
      { id: 'nifty_pharma', name: 'Nifty Pharma', stocks: NIFTY_PHARMA },
      { id: 'nifty_metal', name: 'Nifty Metal', stocks: NIFTY_METAL },
      { id: 'nifty_realty', name: 'Nifty Realty', stocks: NIFTY_REALTY },
      { id: 'bse_bankex', name: 'BSE Bankex', stocks: BSE_BANKEX },
    ],
  },
  {
    id: 'fo_stocks',
    name: 'F&O STOCKS',
    groups: [
      { id: 'nse_fo', name: 'NSE F&O Stocks', stocks: NSE_FO_STOCKS },
    ],
  },
  {
    id: 'etf',
    name: 'ETF',
    groups: [
      { id: 'etf_broad', name: 'Broad Based Indices', stocks: ETF_BROAD },
      { id: 'etf_sectoral', name: 'Sectoral Indices', stocks: ETF_SECTORAL },
      { id: 'etf_debt_commodity', name: 'Debt & Commodity', stocks: ETF_DEBT_COMMODITY },
    ],
  },
];

// ─────────────────────────────────────────────
// LEGACY - Available stock list options (used by ANN Scanner)
// ─────────────────────────────────────────────
export const STOCK_LIST_OPTIONS: StockListOption[] = [
  { id: 'watchlist', name: 'Watchlist', description: 'Your watchlist symbols' },
  { id: 'nifty50', name: 'Nifty 50', description: '50 large cap stocks' },
  { id: 'banknifty', name: 'Bank Nifty', description: 'Banking sector stocks' },
  { id: 'niftyit', name: 'Nifty IT', description: 'IT sector stocks' },
];

// Get stock list by ID (used by ANN Scanner)
export const getStockList = (listId: string): Stock[] => {
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
