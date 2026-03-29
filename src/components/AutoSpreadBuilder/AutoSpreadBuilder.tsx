import React, { useState, useEffect } from 'react';
import styles from './AutoSpreadBuilder.module.css';
import { X, PlayCircle, Loader2, Info } from 'lucide-react';
import { getKlines } from '../../services/openalgo';
import openalgoModule from '../../services/optionChain';

interface AutoSpreadBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  underlyingOptions?: string[];
  onPlotSpreads: (leftSpread: any, rightSpread: any) => void;
}

const AutoSpreadBuilder: React.FC<AutoSpreadBuilderProps> = ({
  isOpen,
  onClose,
  underlyingOptions = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'],
  onPlotSpreads,
}) => {
  const [underlying, setUnderlying] = useState('NIFTY');
  const [exchange, setExchange] = useState('NFO');
  const [spreadDistance, setSpreadDistance] = useState('500');
  
  // New States
  const [availableExpiries, setAvailableExpiries] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [snapshotTime, setSnapshotTime] = useState('09:15');

  // Preview States
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    atmStrike: number;
    openPrice: number;
    peSpread: { buy: string; sell: string };
    ceSpread: { buy: string; sell: string };
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Expiries when underlying changes
  useEffect(() => {
    let isMounted = true;
    const fetchExpiries = async () => {
      try {
        const expiries = await openalgoModule.getAvailableExpiries(underlying, exchange, 'options');
        if (isMounted) {
          setAvailableExpiries(expiries || []);
          if (expiries && expiries.length > 0) {
            setSelectedExpiry(expiries[0]);
          }
        }
      } catch (e) {
        console.error("Failed to fetch expiries", e);
      }
    };
    if (isOpen) fetchExpiries();
    return () => { isMounted = false; };
  }, [underlying, exchange, isOpen]);

  // Live Auto-Calculate Preview
  useEffect(() => {
    if (!isOpen || !selectedExpiry) return;
    
    let isMounted = true;
    const calculatePreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      
      try {
        const chainCtx = await openalgoModule.getOptionChain(underlying, exchange, selectedExpiry);
        const chain = chainCtx.chain;
        if (!chain || chain.length === 0) throw new Error('Option chain is empty.');

        const underlyingConfig = openalgoModule.UNDERLYINGS.find((u: any) => u.symbol === underlying);
        const indexSymbol = underlyingConfig ? underlyingConfig.name : underlying;
        const indexEx = underlyingConfig ? underlyingConfig.indexExchange : 'NSE';

        let referencePrice = chainCtx.underlyingLTP;
        try {
          // Attempt to fetch 1m candles to find exact snapshotTime
          const klines = await getKlines(indexSymbol, indexEx, '1m', 2);
          if (klines && klines.length > 0) {
            const [targetHr, targetMin] = snapshotTime.split(':').map(Number);
            
            // Reverse search to find the most recent trading session match
            const reverseKlines = [...klines].reverse();
            const matchIndex = reverseKlines.findIndex((k: any) => {
              const d = new Date(k.time);
              return d.getHours() === targetHr && d.getMinutes() === targetMin;
            });
            
            if (matchIndex !== -1) {
              referencePrice = reverseKlines[matchIndex].open;
            } else {
              // Fallback to latest 1D open if exact time is missed (e.g. 9:15 exactly missed)
              const dayKlines = await getKlines(indexSymbol, indexEx, '1D', 2);
              if (dayKlines && dayKlines.length > 0) referencePrice = dayKlines[dayKlines.length - 1].open;
            }
          }
        } catch(e) { /* fallback to underlyingLTP stringently */ }

        let step = 50;
        if (underlying === 'BANKNIFTY') step = 100;
        else if (underlying === 'SENSEX') step = 100;
        else if (underlying === 'BANKEX') step = 100;

        const atmStrike = Math.round(referencePrice / step) * step;
        const spreadDistNum = parseInt(spreadDistance, 10) || 500;

        const atmRow = chain.reduce((prev:any, curr:any) => 
          Math.abs(curr.strike - atmStrike) < Math.abs(prev.strike - atmStrike) ? curr : prev
        );
        const actualAtmStrike = atmRow.strike;

        const otmPeStrike = actualAtmStrike - spreadDistNum;
        const otmCeStrike = actualAtmStrike + spreadDistNum;

        const otmPeRow = chain.reduce((prev:any, curr:any) => 
          Math.abs(curr.strike - otmPeStrike) < Math.abs(prev.strike - otmPeStrike) ? curr : prev
        );
        const otmCeRow = chain.reduce((prev:any, curr:any) => 
          Math.abs(curr.strike - otmCeStrike) < Math.abs(prev.strike - otmCeStrike) ? curr : prev
        );

        const atmPeSymbol = atmRow.pe?.symbol;
        const otmPeSymbol = otmPeRow.pe?.symbol;
        const atmCeSymbol = atmRow.ce?.symbol;
        const otmCeSymbol = otmCeRow.ce?.symbol;

        if (!atmPeSymbol || !otmPeSymbol || !atmCeSymbol || !otmCeSymbol) {
          throw new Error('Could not resolve Option symbols from chain.');
        }

        if (isMounted) {
          setPreviewData({
            atmStrike: actualAtmStrike,
            openPrice: referencePrice,
            peSpread: { buy: atmPeSymbol, sell: otmPeSymbol },
            ceSpread: { buy: atmCeSymbol, sell: otmCeSymbol }
          });
          setPreviewLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setPreviewError(err.message || 'Error formulating spread calculations.');
          setPreviewLoading(false);
        }
      }
    };
    
    // Debounce computation by 600ms
    const token = setTimeout(calculatePreview, 600);
    return () => { isMounted = false; clearTimeout(token); };
  }, [underlying, spreadDistance, selectedExpiry, snapshotTime, exchange, isOpen]);


  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!previewData) return;
    
    setLoading(true);
    setError(null);
    try {
      const leftSpread = {
        exchange: exchange,
        displayName: `${underlying} \u20B9${previewData.atmStrike}PE / \u20B9${previewData.atmStrike - parseInt(spreadDistance)}PE`,
        legs: [
          { id: '1', symbol: previewData.peSpread.buy, direction: 'buy', quantity: 1 },
          { id: '2', symbol: previewData.peSpread.sell, direction: 'sell', quantity: 1 }
        ]
      };

      const rightSpread = {
        exchange: exchange,
        displayName: `${underlying} \u20B9${previewData.atmStrike}CE / \u20B9${previewData.atmStrike + parseInt(spreadDistance)}CE`,
        legs: [
          { id: '1', symbol: previewData.ceSpread.buy, direction: 'buy', quantity: 1 },
          { id: '2', symbol: previewData.ceSpread.sell, direction: 'sell', quantity: 1 }
        ]
      };

      onPlotSpreads(leftSpread, rightSpread);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Auto Spread Builder ⚡</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className={styles.body}>
          <p className={styles.description}>
            Dynamically captures the exact reference Strike at a specific time-of-day and plots automated Dual Spread Synthetics side-by-side.
          </p>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Underlying</label>
              <select value={underlying} onChange={(e) => setUnderlying(e.target.value)} className={styles.input}>
                {underlyingOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label>Expiry Date</label>
              <select value={selectedExpiry} onChange={(e) => setSelectedExpiry(e.target.value)} className={styles.input} disabled={availableExpiries.length === 0}>
                {availableExpiries.map((dateStr) => (
                  <option key={dateStr} value={dateStr}>{dateStr}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Reference Time</label>
              <input 
                type="time" 
                value={snapshotTime} 
                onChange={(e) => setSnapshotTime(e.target.value)} 
                className={styles.input} 
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Spread Distance (OTM)</label>
              <input 
                type="number" 
                value={spreadDistance} 
                onChange={(e) => setSpreadDistance(e.target.value)} 
                className={styles.input} 
                min="0"
                step="50"
              />
            </div>
          </div>

          <div className={`${styles.previewBox} ${previewLoading ? styles.loading : ''}`}>
             <div className={styles.previewTitle}><Info size={14} /> LIVE PREVIEW</div>
             {previewError && <div className={styles.errorAlert} style={{marginBottom: 0, padding: '8px'}}>{previewError}</div>}
             
             {previewLoading && !previewError && !previewData && (
               <>
                 <div className={styles.skeleton}></div>
                 <div className={`${styles.skeleton} ${styles.short}`}></div>
               </>
             )}

             {previewData && !previewError && (
               <div className={styles.previewContent}>
                 Calculated Premium Reference (Index Price: <span className={styles.previewHighlight}>{previewData.openPrice}</span>). <br/>
                 Detected ATM Strike: <span className={styles.previewHighlight}>{previewData.atmStrike}</span> <br/><br/>
                 <b>PE Spread:</b> Sell <span style={{color:'#ef5350'}}>{previewData.peSpread.sell.slice(-6)}</span> / Buy <span style={{color:'#26a69a'}}>{previewData.peSpread.buy.slice(-6)}</span> <br/>
                 <b>CE Spread:</b> Sell <span style={{color:'#ef5350'}}>{previewData.ceSpread.sell.slice(-6)}</span> / Buy <span style={{color:'#26a69a'}}>{previewData.ceSpread.buy.slice(-6)}</span>
               </div>
             )}
          </div>

          {error && <div className={styles.errorAlert}>{error}</div>}

          <div className={styles.buttonGroup}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.generateBtn} onClick={handleGenerate} disabled={loading || !!previewError || previewLoading || !previewData}>
              {loading ? <Loader2 className={styles.spinner} size={16} /> : <PlayCircle size={16} />}
              <span>Plot Dual Charts</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoSpreadBuilder;
