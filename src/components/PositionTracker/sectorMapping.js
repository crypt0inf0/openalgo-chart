/**
 * Sector Mapping - Maps F&O stock symbols to their sectors
 * Source: sector_wise_stocks.csv (208 F&O stocks)
 */

export const SECTOR_MAP = {
  // FMCG (8 stocks)
  'MARICO': 'FMCG',
  'NESTLEIND': 'FMCG',
  'HINDUNILVR': 'FMCG',
  'GODREJCP': 'FMCG',
  'DABUR': 'FMCG',
  'BRITANNIA': 'FMCG',
  'COLPAL': 'FMCG',
  'PATANJALI': 'FMCG',

  // Utilities (9 stocks)
  'NTPC': 'Utilities',
  'GAIL': 'Utilities',
  'TATAPOWER': 'Utilities',
  'ADANIGREEN': 'Utilities',
  'ADANIENSOL': 'Utilities',
  'TORNTPOWER': 'Utilities',
  'POWERGRID': 'Utilities',
  'JSWENERGY': 'Utilities',
  'NHPC': 'Utilities',

  // Retail (5 stocks)
  'ETERNAL': 'Retail',
  'NYKAA': 'Retail',
  'DMART': 'Retail',
  'NAUKRI': 'Retail',
  'TRENT': 'Retail',

  // Pharma (15 stocks)
  'GLENMARK': 'Pharma',
  'SYNGENE': 'Pharma',
  'DRREDDY': 'Pharma',
  'LAURUSLABS': 'Pharma',
  'MANKIND': 'Pharma',
  'ALKEM': 'Pharma',
  'SUNPHARMA': 'Pharma',
  'PPLPHARMA': 'Pharma',
  'ZYDUSLIFE': 'Pharma',
  'BIOCON': 'Pharma',
  'AUROPHARMA': 'Pharma',
  'DIVISLAB': 'Pharma',
  'CIPLA': 'Pharma',
  'TORNTPHARM': 'Pharma',
  'LUPIN': 'Pharma',

  // Metal (11 stocks)
  'SAIL': 'Metal',
  'TATASTEEL': 'Metal',
  'JINDALSTEL': 'Metal',
  'APLAPOLLO': 'Metal',
  'JSWSTEEL': 'Metal',
  'COALINDIA': 'Metal',
  'HINDALCO': 'Metal',
  'VEDL': 'Metal',
  'NATIONALUM': 'Metal',
  'NMDC': 'Metal',
  'HINDZINC': 'Metal',

  // Industrial (16 stocks)
  'CUMMINSIND': 'Industrial',
  'SUPREMEIND': 'Industrial',
  'BHARATFORG': 'Industrial',
  'POWERINDIA': 'Industrial',
  'MAZDOCK': 'Industrial',
  'ABB': 'Industrial',
  'SOLARINDS': 'Industrial',
  'SUZLON': 'Industrial',
  'HAL': 'Industrial',
  'BDL': 'Industrial',
  'BHEL': 'Industrial',
  'SIEMENS': 'Industrial',
  'BEL': 'Industrial',
  'ASTRAL': 'Industrial',
  'INOXWIND': 'Industrial',
  'CGPOWER': 'Industrial',

  // Bank (18 stocks) - Pure Banking Only
  'SBIN': 'Bank',
  'HDFCBANK': 'Bank',
  'ICICIBANK': 'Bank',
  'KOTAKBANK': 'Bank',
  'AXISBANK': 'Bank',
  'INDUSINDBK': 'Bank',
  'BANDHANBNK': 'Bank',
  'FEDERALBNK': 'Bank',
  'PNB': 'Bank',
  'BANKBARODA': 'Bank',
  'AUBANK': 'Bank',
  'IDFCFIRSTB': 'Bank',
  'CANBK': 'Bank',
  'UNIONBANK': 'Bank',
  'YESBANK': 'Bank',
  'RBLBANK': 'Bank',
  'INDIANB': 'Bank',
  'BANKINDIA': 'Bank',

  // Finance (32 stocks) - Financial Services
  'BAJFINANCE': 'Finance',
  'HDFCLIFE': 'Finance',
  'SBILIFE': 'Finance',
  'ICICIPRULI': 'Finance',
  'ICICIGI': 'Finance',
  'CHOLAFIN': 'Finance',
  'SHRIRAMFIN': 'Finance',
  'MUTHOOTFIN': 'Finance',
  'LICI': 'Finance',
  'JIOFIN': 'Finance',
  'SBICARD': 'Finance',
  'LICHSGFIN': 'Finance',
  'MANAPPURAM': 'Finance',
  'HDFCAMC': 'Finance',
  'KFINTECH': 'Finance',
  'LTF': 'Finance',
  'RECLTD': 'Finance',
  'BSE': 'Finance',
  'MCX': 'Finance',
  'MFSL': 'Finance',
  'IIFL': 'Finance',
  'PFC': 'Finance',
  'PNBHOUSING': 'Finance',
  'IEX': 'Finance',
  'CDSL': 'Finance',
  'IREDA': 'Finance',
  'NUVAMA': 'Finance',
  'ANGELONE': 'Finance',
  'IRFC': 'Finance',
  'SAMMAANCAP': 'Finance',
  'HUDCO': 'Finance',
  '360ONE': 'Finance',

  // Auto (15 stocks)
  'TITAGARH': 'Auto',
  'ASHOKLEY': 'Auto',
  'MOTHERSON': 'Auto',
  'UNOMINDA': 'Auto',
  'TMPV': 'Auto',
  'BAJAJ-AUTO': 'Auto',
  'TIINDIA': 'Auto',
  'MARUTI': 'Auto',
  'BOSCHLTD': 'Auto',
  'M&M': 'Auto',
  'EXIDEIND': 'Auto',
  'SONACOMS': 'Auto',
  'EICHERMOT': 'Auto',
  'HEROMOTOCO': 'Auto',
  'TVSMOTOR': 'Auto',

  // Telecom (3 stocks)
  'INDUSTOWER': 'Telecom',
  'IDEA': 'Telecom',
  'BHARTIARTL': 'Telecom',

  // Finance - Additional (moved from Diversified)
  'ABCAPITAL': 'Finance',
  'BAJAJFINSV': 'Finance',

  // ConsumerDur (11 stocks)
  'ASIANPAINT': 'ConsumerDur',
  'KEI': 'ConsumerDur',
  'VOLTAS': 'ConsumerDur',
  'HAVELLS': 'ConsumerDur',
  'CROMPTON': 'ConsumerDur',
  'PGEL': 'ConsumerDur',
  'AMBER': 'ConsumerDur',
  'POLYCAB': 'ConsumerDur',
  'BLUESTARCO': 'ConsumerDur',
  'KAYNES': 'ConsumerDur',
  'DIXON': 'ConsumerDur',

  // Cement (9 stocks)
  'NCC': 'Cement',
  'GRASIM': 'Cement',
  'DALBHARAT': 'Cement',
  'ULTRACEMCO': 'Cement',
  'NBCC': 'Cement',
  'GMRAIRPORT': 'Cement',
  'SHREECEM': 'Cement',
  'AMBUJACEM': 'Cement',
  'RVNL': 'Cement',

  // IT (17 stocks)
  'COFORGE': 'IT',
  'LTIM': 'IT',
  'TECHM': 'IT',
  'TATATECH': 'IT',
  'CYIENT': 'IT',
  'WIPRO': 'IT',
  'PAYTM': 'IT',
  'INFY': 'IT',
  'POLICYBZR': 'IT',
  'TCS': 'IT',
  'CAMS': 'IT',
  'TATAELXSI': 'IT',
  'MPHASIS': 'IT',
  'PERSISTENT': 'IT',
  'KPITTECH': 'IT',
  'OFSS': 'IT',
  'HCLTECH': 'IT',

  // Oil&Gas (7 stocks)
  'BPCL': 'Oil&Gas',
  'HINDPETRO': 'Oil&Gas',
  'IOC': 'Oil&Gas',
  'OIL': 'Oil&Gas',
  'ONGC': 'Oil&Gas',
  'RELIANCE': 'Oil&Gas',
  'PETRONET': 'Oil&Gas',

  // Transport (4 stocks)
  'INDIGO': 'Transport',
  'CONCOR': 'Transport',
  'DELHIVERY': 'Transport',
  'ADANIPORTS': 'Transport',

  // Healthcare (3 stocks)
  'MAXHEALTH': 'Healthcare',
  'APOLLOHOSP': 'Healthcare',
  'FORTIS': 'Healthcare',

  // Realty (6 stocks)
  'GODREJPROP': 'Realty',
  'PHOENIXLTD': 'Realty',
  'OBEROIRLTY': 'Realty',
  'LODHA': 'Realty',
  'DLF': 'Realty',
  'PRESTIGE': 'Realty',

  // CommServ (1 stock)
  'ADANIENT': 'CommServ',

  // Hotels (2 stocks)
  'JUBLFOOD': 'Hotels',
  'INDHOTEL': 'Hotels',

  // Textiles (3 stocks)
  'TITAN': 'Textiles',
  'PAGEIND': 'Textiles',
  'KALYANKJIL': 'Textiles',

  // Food&Bev (4 stocks)
  'TATACONSUM': 'Food&Bev',
  'VBL': 'Food&Bev',
  'UNITDSPR': 'Food&Bev',
  'ITC': 'Food&Bev',

  // Chemicals (4 stocks)
  'PIDILITIND': 'Chemicals',
  'PIIND': 'Chemicals',
  'SRF': 'Chemicals',
  'UPL': 'Chemicals',

  // ConsumerSvc (1 stock)
  'IRCTC': 'ConsumerSvc',

  // TelecomEquip (1 stock)
  'HFCL': 'TelecomEquip',
};

export const SECTORS = [
  'All',
  'Bank',
  'Finance',
  'IT',
  'Pharma',
  'Auto',
  'Metal',
  'Industrial',
  'ConsumerDur',
  'Utilities',
  'Cement',
  'FMCG',
  'Oil&Gas',
  'Realty',
  'Retail',
  'Transport',
  'Food&Bev',
  'Chemicals',
  'Healthcare',
  'Telecom',
  'Textiles',
  'Hotels',
  'CommServ',
  'ConsumerSvc',
  'TelecomEquip',
  'Other',
];

export const getSector = (symbol) => SECTOR_MAP[symbol] || 'Other';

export default { SECTOR_MAP, SECTORS, getSector };
