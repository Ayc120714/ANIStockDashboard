import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { Alert, Box, TextField, Button, IconButton, Chip, CircularProgress, Autocomplete, Checkbox, Typography, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { MdClose, MdDeleteSweep, MdSelectAll, MdRefresh, MdContentCopy, MdCheck } from 'react-icons/md';
import { fetchWatchlist, fetchWatchlistSignals, addToWatchlist, bulkDeleteFromWatchlist } from '../api/watchlist';
import { apiGet } from '../api/apiClient';
import { checkPriceAlerts, fetchPriceAlerts, upsertPriceAlert } from '../api/priceAlerts';
import { useAuth } from '../auth/AuthContext';
import OrderPanel from '../components/OrderPanel';

const recColors = {
  strong_buy: '#1b5e20', buy: '#2e7d32', hold: '#f57f17',
  sell: '#c62828', strong_sell: '#b71c1c',
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();
const parseNumber = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const firstPositive = (...values) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};
const extractLeverageByBroker = (row) => {
  const brokers = ['dhan', 'samco', 'angelone', 'upstox'];
  const result = {};

  const nested = row?.leverageByBroker || row?.leverage_by_broker;
  if (nested && typeof nested === 'object') {
    Object.entries(nested).forEach(([brokerName, value]) => {
      if (!brokerName || !value || typeof value !== 'object') return;
      const cleaned = {};
      ['INTRADAY', 'MARGIN', 'DELIVERY'].forEach((product) => {
        const lev = firstPositive(value?.[product], value?.[product.toLowerCase()]);
        if (lev != null) cleaned[product] = lev;
      });
      if (Object.keys(cleaned).length) result[String(brokerName).toLowerCase()] = cleaned;
    });
  }

  brokers.forEach((broker) => {
    const intraday = firstPositive(
      row?.[`${broker}_intraday_leverage`],
      row?.[`${broker}_mis_leverage`],
      row?.[`${broker}_intraday_multiplier`]
    );
    const margin = firstPositive(
      row?.[`${broker}_mtf_leverage`],
      row?.[`${broker}_margin_leverage`],
      row?.[`${broker}_mtf_multiplier`],
      row?.[`${broker}_margin_multiplier`]
    );
    const delivery = firstPositive(
      row?.[`${broker}_delivery_leverage`],
      row?.[`${broker}_cnc_leverage`],
      row?.[`${broker}_delivery_multiplier`]
    );
    const next = {
      ...(result[broker] || {}),
      ...(intraday != null ? { INTRADAY: intraday } : {}),
      ...(margin != null ? { MARGIN: margin } : {}),
      ...(delivery != null ? { DELIVERY: delivery } : {}),
    };
    if (Object.keys(next).length) result[broker] = next;
  });

  const genericIntraday = firstPositive(row?.intraday_leverage, row?.mis_leverage, row?.intraday_multiplier);
  const genericMtf = firstPositive(row?.mtf_leverage, row?.margin_leverage, row?.mtf_multiplier, row?.margin_multiplier);
  const genericDelivery = firstPositive(row?.delivery_leverage, row?.cnc_leverage, row?.delivery_multiplier);
  if (genericIntraday != null || genericMtf != null || genericDelivery != null) {
    brokers.forEach((broker) => {
      result[broker] = {
        ...(result[broker] || {}),
        ...(genericIntraday != null ? { INTRADAY: genericIntraday } : {}),
        ...(genericMtf != null ? { MARGIN: genericMtf } : {}),
        ...(genericDelivery != null ? { DELIVERY: genericDelivery } : {}),
      };
    });
  }
  return Object.keys(result).length ? result : null;
};

const getTrailingState = (row) => {
  const cmp = parseNumber(row?.price);
  const entry = parseNumber(row?.entry_price);
  const stopLoss = parseNumber(row?.stop_loss);
  const t1 = parseNumber(row?.target_long_term ?? row?.target_1);
  const direction = deriveTradeDirection(row);
  const isBull = direction >= 0;
  if (cmp == null || entry == null || stopLoss == null || t1 == null) {
    return {
      t1Hit: false,
      costExit: false,
      effectiveStopLoss: stopLoss,
      entryTriggered: false,
      stopHit: false,
      statusLabel: 'NO LEVELS',
      statusColor: '#757575',
      isBull,
    };
  }
  const t1Hit = isBull ? cmp >= t1 : cmp <= t1;
  const entryTriggered = isBull ? cmp >= entry : cmp <= entry;
  const stopHit = isBull ? cmp <= stopLoss : cmp >= stopLoss;
  const effectiveStopLoss = t1Hit ? entry : stopLoss;
  const costExit = t1Hit && (isBull ? cmp <= entry : cmp >= entry);
  let statusLabel = 'WAIT ENTRY';
  let statusColor = '#ef6c00';
  if (t1Hit) {
    statusLabel = 'EXIT TRIGGERED';
    statusColor = '#1565c0';
  } else if (stopHit) {
    statusLabel = 'SL HIT';
    statusColor = '#c62828';
  } else if (entryTriggered) {
    statusLabel = 'IN TRADE';
    statusColor = '#2e7d32';
  }
  return { t1Hit, costExit, effectiveStopLoss, entryTriggered, stopHit, statusLabel, statusColor, isBull };
};

const buildFibPivots = (row, currentPrice) => {
  const c = parseNumber(currentPrice);
  if (c == null || c <= 0) return null;
  let high = parseNumber(row?.day_high ?? row?.high ?? row?.high_price ?? row?.session_high);
  let low = parseNumber(row?.day_low ?? row?.low ?? row?.low_price ?? row?.session_low);
  let close = parseNumber(row?.prev_close ?? row?.previous_close ?? row?.close ?? row?.ltp);

  let range = (high != null && low != null && high > low) ? (high - low) : null;
  if (range == null || range <= 0) {
    const fallback = Math.abs((parseNumber(row?.entry_price) || c) - (parseNumber(row?.stop_loss) || c));
    range = fallback > 0 ? fallback : Math.max(c * 0.01, 1);
    high = c + range / 2;
    low = Math.max(0.01, c - range / 2);
  }
  if (close == null || close <= 0) close = c;

  const pp = (high + low + close) / 3;
  return {
    pp,
    r1: pp + 0.382 * range,
    r2: pp + 0.618 * range,
    r3: pp + 1.0 * range,
    s1: pp - 0.382 * range,
    s2: pp - 0.618 * range,
    s3: pp - 1.0 * range,
  };
};

const deriveMacdLabel = (row) => {
  const cross = String(row.macd_cross || '').toLowerCase().trim();
  if (cross === 'buy' || cross === 'bull' || cross === 'bullish') return 'BUY';
  if (cross === 'sell' || cross === 'bear' || cross === 'bearish') return 'SELL';
  const macd = parseNumber(row.macd ?? row.macd_value ?? row.macd_line);
  const signal = parseNumber(row.macd_signal ?? row.macd_signal_line);
  if (macd != null && signal != null) return macd >= signal ? 'BULL' : 'BEAR';
  const hist = parseNumber(row.macd_histogram ?? row.macd_hist);
  if (hist != null) return hist >= 0 ? 'BULL' : 'BEAR';
  if (macd != null) return macd >= 0 ? 'BULL' : 'BEAR';
  return '—';
};

const deriveTradeDirection = (row) => {
  const recommendation = String(row?.recommendation || '').toLowerCase().trim();
  if (recommendation.includes('sell')) return -1;
  if (recommendation.includes('buy')) return 1;
  const macdLabel = deriveMacdLabel(row);
  if (macdLabel === 'SELL' || macdLabel === 'BEAR') return -1;
  const trend = String(row?.trend || row?.signal_type || '').toLowerCase();
  if (trend.includes('bear') || trend.includes('sell') || trend.includes('down')) return -1;
  return 1;
};

function LongTermPage() {
  const { isAdmin, user } = useAuth();
  const [data, setData] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSymbols, setAllSymbols] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [checkedSymbols, setCheckedSymbols] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [visibleSymbols, setVisibleSymbols] = useState(new Set());
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [triggeredAlert, setTriggeredAlert] = useState('');
  const [movementDialog, setMovementDialog] = useState({ open: false, symbol: '', current: 0, row: null, pivots: null });
  const [movementAmount, setMovementAmount] = useState('');
  const [selectedPivotPreset, setSelectedPivotPreset] = useState('');
  const rowsPerPage = 15;
  const userId = String(user?.id || user?.user_id || user?.email || 'guest');
  const visibleSymbolsKey = `long_term_visible_symbols_${userId}`;
  const priceAlertsKey = `long_term_price_alerts_${userId}`;

  const loadSymbols = useCallback(() => {
    apiGet('/watchlist/available-symbols')
      .then(res => setAllSymbols(res?.data ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchWatchlist('long_term', { includeAll: isAdmin }),
      fetchWatchlistSignals({ includeAll: isAdmin, timeframe: 'intraday' }),
    ])
      .then(([wl, sigs]) => {
        setData(Array.isArray(wl) ? wl : []);
        setSignals(Array.isArray(sigs) ? sigs : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    load(); loadSymbols();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load, loadSymbols]);

  useEffect(() => {
    try {
      const rawVisible = localStorage.getItem(visibleSymbolsKey);
      const parsedVisible = rawVisible ? JSON.parse(rawVisible) : [];
      setVisibleSymbols(new Set(Array.isArray(parsedVisible) ? parsedVisible.map(normalizeSymbol).filter(Boolean) : []));
    } catch (_) {
      setVisibleSymbols(new Set());
    }
  }, [visibleSymbolsKey, priceAlertsKey]);

  useEffect(() => {
    let mounted = true;
    const loadAlerts = async () => {
      try {
        const rows = await fetchPriceAlerts({ userId, listType: 'long_term', activeOnly: true });
        const normalized = (rows || []).map((r) => ({
          id: r.id,
          symbol: normalizeSymbol(r.symbol),
          direction: String(r.direction || 'ABOVE').toUpperCase(),
          threshold: Number(r.threshold_price),
        }));
        if (mounted) setPriceAlerts(normalized);
        localStorage.setItem(priceAlertsKey, JSON.stringify(normalized));
      } catch (_) {
        try {
          const rawAlerts = localStorage.getItem(priceAlertsKey);
          const parsedAlerts = rawAlerts ? JSON.parse(rawAlerts) : [];
          if (mounted) setPriceAlerts(Array.isArray(parsedAlerts) ? parsedAlerts : []);
        } catch {
          if (mounted) setPriceAlerts([]);
        }
      }
    };
    loadAlerts();
    return () => { mounted = false; };
  }, [userId, priceAlertsKey]);

  const sigMap = useMemo(() => {
    const m = {};
    signals.forEach((s) => {
      const sym = normalizeSymbol(s?.symbol);
      if (!sym) return;
      m[sym] = s;
    });
    return m;
  }, [signals]);

  const serverDedupedData = useMemo(() => {
    const bySymbol = new Map();
    const mergeSignalIntoRow = (baseRow, signalRow = {}) => {
      const mergedRow = { ...baseRow };
      Object.entries(signalRow || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          mergedRow[key] = value;
        }
      });
      return mergedRow;
    };

    for (const row of data) {
      const sym = normalizeSymbol(row?.symbol);
      if (!sym || bySymbol.has(sym)) continue;
      const withSignal = mergeSignalIntoRow({ ...row, symbol: sym }, sigMap[sym] || {});
      bySymbol.set(sym, {
        ...withSignal,
        symbol: sym,
        rsi: parseNumber(withSignal?.rsi ?? withSignal?.rsi_14),
        macd: parseNumber(withSignal?.macd ?? withSignal?.macd_value ?? withSignal?.macd_line),
        macd_signal: parseNumber(withSignal?.macd_signal ?? withSignal?.macd_signal_line),
        macd_histogram: parseNumber(withSignal?.macd_histogram ?? withSignal?.macd_hist),
        macd_cross: withSignal?.macd_cross ?? withSignal?.macd_state ?? withSignal?.macd_signal_state ?? null,
        supertrend_direction: withSignal?.supertrend_direction ?? withSignal?.supertrend ?? withSignal?.ts ?? null,
        volume_ratio: parseNumber(withSignal?.volume_ratio ?? withSignal?.vol_ratio ?? withSignal?.volumeRatio),
      });
    }
    return Array.from(bySymbol.values());
  }, [data, sigMap]);

  const dedupedData = useMemo(() => {
    if (isAdmin) return serverDedupedData;
    return serverDedupedData.filter((row) => visibleSymbols.has(normalizeSymbol(row.symbol)));
  }, [isAdmin, serverDedupedData, visibleSymbols]);

  const existingSymbols = useMemo(
    () => new Set(dedupedData.map((d) => normalizeSymbol(d.symbol)).filter(Boolean)),
    [dedupedData]
  );
  const existingServerSymbols = useMemo(
    () => new Set(serverDedupedData.map((d) => normalizeSymbol(d.symbol)).filter(Boolean)),
    [serverDedupedData]
  );

  const availableSymbols = useMemo(() =>
    allSymbols.filter(s => !existingSymbols.has(normalizeSymbol(s.symbol))),
    [allSymbols, existingSymbols]
  );

  const handleAddSelected = async () => {
    if (selectedStocks.length === 0) return;
    setAdding(true);
    try {
      const toAdd = Array.from(
        new Set(
          selectedStocks
            .map((sym) => normalizeSymbol(typeof sym === 'string' ? sym : sym.symbol))
            .filter(Boolean)
        )
      ).filter((symbol) => !existingServerSymbols.has(symbol));
      for (const symbol of toAdd) {
        await addToWatchlist(symbol, 'long_term', '');
      }
      if (!isAdmin && toAdd.length) {
        const nextVisible = new Set([...visibleSymbols, ...toAdd]);
        setVisibleSymbols(nextVisible);
        localStorage.setItem(visibleSymbolsKey, JSON.stringify([...nextVisible]));
      }
      setSelectedStocks([]);
      load();
    } catch (e) { alert(e?.message || 'Failed to add'); }
    setAdding(false);
  };

  const handleRemoveFromList = (sym) => {
    const target = normalizeSymbol(typeof sym === 'string' ? sym : sym.symbol);
    setSelectedStocks(prev =>
      prev.filter((s) => normalizeSymbol(typeof s === 'string' ? s : s.symbol) !== target)
    );
  };

  const toggleCheck = (sym) => {
    setCheckedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const pageSyms = paged.map(r => r.symbol);
    const allSelected = pageSyms.every(s => checkedSymbols.has(s));
    setCheckedSymbols(prev => {
      const next = new Set(prev);
      if (allSelected) pageSyms.forEach(s => next.delete(s));
      else pageSyms.forEach(s => next.add(s));
      return next;
    });
  };

  const selectAll = () => {
    setCheckedSymbols(new Set(sorted.map(r => r.symbol)));
  };

  const clearSelection = () => setCheckedSymbols(new Set());

  const handleCopyTradingViewCsv = async () => {
    const symbols = checkedSymbols.size > 0
      ? [...checkedSymbols]
      : sorted.map(r => r.symbol);
    if (!symbols.length) return;
    const csv = symbols
      .filter(Boolean)
      .map(s => `NSE:${String(s).toUpperCase()}`)
      .join(',');
    try {
      await navigator.clipboard.writeText(csv);
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 1800);
    } catch (e) {
      alert('Failed to copy CSV');
    }
  };

  const handleBulkDelete = async () => {
    const syms = [...checkedSymbols];
    if (!syms.length) return;
    if (!window.confirm(`Delete ${syms.length} stock(s) from Long Term?\n\n${syms.join(', ')}`)) return;
    setDeleting(true);
    try {
      await bulkDeleteFromWatchlist(syms, 'long_term', { includeAll: isAdmin });
      setCheckedSymbols(new Set());
      if (!isAdmin && syms.length) {
        const removeSet = new Set(syms.map(normalizeSymbol));
        const nextVisible = new Set([...visibleSymbols].filter((s) => !removeSet.has(normalizeSymbol(s))));
        setVisibleSymbols(nextVisible);
        localStorage.setItem(visibleSymbolsKey, JSON.stringify([...nextVisible]));
      }
      load();
    } catch (e) { alert(e?.message || 'Bulk delete failed'); }
    setDeleting(false);
  };

  const parsePrice = (value) => parseNumber(value);

  const buildProductProfiles = useCallback((row) => {
    const leverageByBroker = extractLeverageByBroker(row);
    const genericMtfLeverage = firstPositive(row?.mtf_leverage, row?.margin_leverage, row?.mtf_multiplier, row?.margin_multiplier);
    const genericIntradayLeverage = firstPositive(row?.intraday_leverage, row?.mis_leverage, row?.intraday_multiplier);
    const genericDeliveryLeverage = firstPositive(row?.delivery_leverage, row?.cnc_leverage, row?.delivery_multiplier);
    const entry = parsePrice(row?.entry_price) || parsePrice(row?.price) || 0;
    const sl = parsePrice(row?.stop_loss) || 0;
    const baseT1 = parsePrice(row?.target_long_term ?? row?.target_1) || 0;
    const baseT2 = parsePrice(row?.target_2 ?? row?.next_scope_target) || 0;
    if (!(entry > 0)) {
      return {
        entryPrice: 0, stopLoss: 0, target1: 0, target2: 0,
        leverageByBroker,
        intradayLeverage: genericIntradayLeverage,
        mtfLeverage: genericMtfLeverage,
        deliveryLeverage: genericDeliveryLeverage,
        byProduct: {
          INTRADAY: { entryPrice: 0, stopLoss: 0, target1: 0, target2: 0 },
          MARGIN: { entryPrice: 0, stopLoss: 0, target1: 0, target2: 0 },
          DELIVERY: { entryPrice: 0, stopLoss: 0, target1: 0, target2: 0 },
        },
      };
    }
    const risk = Math.max(Math.abs(entry - (sl || entry)), Math.max(entry * 0.005, 0.5));
    const direction = baseT1 > 0 ? (baseT1 >= entry ? 1 : -1) : 1;
    const proj = (r) => Number((entry + direction * r).toFixed(2));
    const pushSL = (mult) => Number((entry - direction * risk * mult).toFixed(2));
    return {
      entryPrice: entry,
      stopLoss: sl || pushSL(1),
      target1: baseT1 || proj(risk * 2),
      target2: baseT2 || proj(risk * 3),
      leverageByBroker,
      intradayLeverage: genericIntradayLeverage,
      mtfLeverage: genericMtfLeverage,
      deliveryLeverage: genericDeliveryLeverage,
      byProduct: {
        INTRADAY: {
          entryPrice: entry,
          stopLoss: sl || pushSL(1),
          target1: proj(risk),
          target2: proj(risk * 2),
          intradayLeverage: genericIntradayLeverage,
        },
        MARGIN: {
          entryPrice: entry,
          stopLoss: pushSL(1.15),
          target1: baseT1 || proj(risk * 2),
          target2: baseT2 || proj(risk * 3),
          mtfLeverage: genericMtfLeverage,
        },
        DELIVERY: {
          entryPrice: entry,
          stopLoss: pushSL(1.35),
          target1: baseT1 || proj(risk * 3),
          target2: baseT2 || proj(risk * 4),
          deliveryLeverage: genericDeliveryLeverage,
        },
      },
    };
  }, []);

  const handleSetAlert = useCallback(({ symbol }) => {
    const cleanSymbol = normalizeSymbol(symbol);
    if (!cleanSymbol) return;
    const row = dedupedData.find((r) => normalizeSymbol(r.symbol) === cleanSymbol);
    const current = parsePrice(row?.price);
    if (current == null || current <= 0) {
      setTriggeredAlert(`Unable to set alert for ${cleanSymbol}: current price not available.`);
      return;
    }
    setMovementAmount('');
    setSelectedPivotPreset('');
    setMovementDialog({
      open: true,
      symbol: cleanSymbol,
      current,
      row,
      pivots: buildFibPivots(row, current),
    });
  }, [dedupedData]);

  const applyMovementAlert = useCallback(() => {
    const alertPrice = Number(movementAmount);
    if (!Number.isFinite(alertPrice) || alertPrice <= 0) return;
    const cleanSymbol = movementDialog.symbol;
    const current = Number(movementDialog.current || 0);
    if (!cleanSymbol || !Number.isFinite(current) || current <= 0) return;
    const threshold = Number(alertPrice.toFixed(2));
    const next = [
      ...priceAlerts.filter((a) => normalizeSymbol(a.symbol) !== cleanSymbol),
      { symbol: cleanSymbol, direction: 'AT', threshold },
    ];
    setPriceAlerts(next);
    localStorage.setItem(priceAlertsKey, JSON.stringify(next));
    setTriggeredAlert(`Price alert set: ${cleanSymbol} at ₹${threshold} (current ₹${current})`);
    upsertPriceAlert({
      userId,
      listType: 'long_term',
      symbol: cleanSymbol,
      direction: 'AT',
      thresholdPrice: threshold,
      isActive: true,
    }).catch(() => {});
    setMovementDialog({ open: false, symbol: '', current: 0, row: null, pivots: null });
    setSelectedPivotPreset('');
  }, [movementAmount, movementDialog, priceAlerts, priceAlertsKey, userId]);

  const filtered = useMemo(() => {
    if (!search) return dedupedData;
    const q = search.toLowerCase();
    return dedupedData.filter(r =>
      (r.symbol || '').toLowerCase().includes(q) ||
      (r.sector || '').toLowerCase().includes(q)
    );
  }, [dedupedData, search]);

  const sorted = useMemo(() => {
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortConfig.key] ?? '';
      const bv = b[sortConfig.key] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortConfig.ascending ? cmp : -cmp;
    });
  }, [filtered, sortConfig]);

  const totalPages = Math.ceil(sorted.length / rowsPerPage);
  const paged = sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const defaultOrderSymbol = useMemo(() => {
    if (checkedSymbols.size > 0) return [...checkedSymbols][0];
    const firstSelected = selectedStocks[0];
    if (firstSelected) return String(typeof firstSelected === 'string' ? firstSelected : firstSelected.symbol || '').toUpperCase();
    return '';
  }, [checkedSymbols, selectedStocks]);

  useEffect(() => {
    if (!priceAlerts.length || !dedupedData.length) return;
    const prices = dedupedData.reduce((acc, row) => {
      const price = parsePrice(row?.price);
      if (price != null) acc[normalizeSymbol(row.symbol)] = price;
      return acc;
    }, {});
    checkPriceAlerts({ userId, listType: 'long_term', prices })
      .then((res) => {
        const triggered = res?.triggered || [];
        if (!triggered.length) return;
        const triggeredSymbols = new Set(triggered.map((t) => `${normalizeSymbol(t.symbol)}_${String(t.direction || '').toUpperCase()}`));
        const pending = priceAlerts.filter((a) => !triggeredSymbols.has(`${normalizeSymbol(a.symbol)}_${a.direction}`));
        setPriceAlerts(pending);
        localStorage.setItem(priceAlertsKey, JSON.stringify(pending));
        const first = triggered[0];
        const msg = first?.message || `Price alert triggered: ${first.symbol}`;
        setTriggeredAlert(msg);
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('Stock Alert Triggered', { body: msg });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        }
      })
      .catch(() => {});
  }, [priceAlerts, dedupedData, priceAlertsKey, userId]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      ascending: prev.key === key ? !prev.ascending : true,
    }));
  };

  const columns = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'price', label: 'CMP' },
    { key: 'day1d', label: '1D %' },
    { key: 'composite_score', label: 'Score' },
    { key: 'recommendation', label: 'Rating' },
    { key: 'trend', label: 'Trend' },
    { key: 'supertrend_direction', label: 'TS' },
    { key: 'macd_cross', label: 'MACD' },
    { key: 'volume_ratio', label: 'Vol Ratio' },
    { key: 'entry_price', label: 'Entry' },
    { key: 'stop_loss', label: 'SL' },
    { key: 'target_long_term', label: 'Target' },
    { key: 'risk_reward_ratio', label: 'R:R' },
  ];

  return (
    <TableSection>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <TableTitle style={{ margin: 0 }}>Long Term Watchlist</TableTitle>
        <Chip label="Auto-refresh 60s" size="small" variant="outlined" sx={{ fontSize: 11 }} />
        <IconButton size="small" onClick={load} title="Refresh now"><MdRefresh /></IconButton>
      </Box>

      {!isAdmin && (
        <Typography sx={{ mb: 1.2, fontSize: 12, color: '#666' }}>
          Your long-term list starts empty by design. Add symbols to view and track only your own entries.
        </Typography>
      )}

      <OrderPanel
        defaultSymbol={defaultOrderSymbol}
        symbolOptions={dedupedData.map((r) => r.symbol)}
        symbolPrices={Object.fromEntries(dedupedData.map((r) => [normalizeSymbol(r.symbol), parsePrice(r.price) || 0]))}
        symbolProfiles={Object.fromEntries(dedupedData.map((r) => {
          const symbol = normalizeSymbol(r.symbol);
          return [symbol, buildProductProfiles(r)];
        }))}
        hideBrokerSelector
        onSetAlert={handleSetAlert}
      />
      {triggeredAlert ? (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setTriggeredAlert('')}>
          {triggeredAlert}
        </Alert>
      ) : null}
      <Dialog
        open={movementDialog.open}
        onClose={() => {
          setMovementDialog({ open: false, symbol: '', current: 0, row: null, pivots: null });
          setSelectedPivotPreset('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Set Price Alert - {movementDialog.symbol}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, mb: 1 }}>
            Current Price: <strong>₹{Number(movementDialog.current || 0).toFixed(2)}</strong>
          </Typography>
          <TextField
            autoFocus
            size="small"
            fullWidth
            type="number"
            label="Alert Price"
            placeholder="Example: 751.97"
            value={movementAmount}
            onChange={(e) => {
              setMovementAmount(e.target.value);
              setSelectedPivotPreset('');
            }}
            sx={{ mb: 1.2 }}
          />
          <Typography sx={{ fontSize: 12, color: '#555', mb: 0.8 }}>
            Fibonacci Pivot Levels (for tracking):
          </Typography>
          {movementDialog.pivots ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.8 }}>
              {[
                ['R3', movementDialog.pivots.r3],
                ['R2', movementDialog.pivots.r2],
                ['R1', movementDialog.pivots.r1],
                ['PP', movementDialog.pivots.pp],
                ['S1', movementDialog.pivots.s1],
                ['S2', movementDialog.pivots.s2],
                ['S3', movementDialog.pivots.s3],
              ].map(([k, v]) => {
                const levelPrice = Number(v || 0);
                return (
                  <Button
                    key={k}
                    size="small"
                    variant={selectedPivotPreset === k ? 'contained' : 'outlined'}
                    onClick={() => {
                      setMovementAmount(levelPrice > 0 ? levelPrice.toFixed(2) : '');
                      setSelectedPivotPreset(String(k));
                    }}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: 12, px: 1, py: 0.6 }}
                  >
                    {`${k}: ₹${Number(v).toFixed(2)}`}
                  </Button>
                );
              })}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 12, color: '#999' }}>Pivot levels unavailable for this symbol.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMovementDialog({ open: false, symbol: '', current: 0, row: null, pivots: null })} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={applyMovementAlert} sx={{ textTransform: 'none' }}>
            Set Alert
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Autocomplete
          multiple
          size="small"
          options={availableSymbols}
          getOptionLabel={opt => typeof opt === 'string' ? opt : `${opt.symbol} — ${opt.sector || 'N/A'}`}
          isOptionEqualToValue={(opt, val) => (opt.symbol || opt) === (val.symbol || val)}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.toLowerCase();
            return opts.filter(o =>
              o.symbol.toLowerCase().includes(q) ||
              (o.sector || '').toLowerCase().includes(q) ||
              (o.subsector || '').toLowerCase().includes(q)
            ).slice(0, 50);
          }}
          value={selectedStocks}
          onChange={(_, newVal) => setSelectedStocks(newVal)}
          renderInput={(params) => (
            <TextField {...params} placeholder="Search & select stocks…" />
          )}
          renderTags={() => null}
          sx={{ minWidth: 320, flex: 1 }}
          autoHighlight
          disableCloseOnSelect
        />
        <Button variant="contained" size="small" onClick={handleAddSelected}
          disabled={selectedStocks.length === 0 || adding}
          sx={{ bgcolor: '#1a3c5e', textTransform: 'none', height: 40, minWidth: 100 }}>
          {adding ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : `Add ${selectedStocks.length > 0 ? `(${selectedStocks.length})` : ''}`}
        </Button>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Filter watchlist…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} sx={{ width: 180 }} />
        <Button size="small" variant="outlined"
          startIcon={copiedCsv ? <MdCheck /> : <MdContentCopy />}
          onClick={handleCopyTradingViewCsv}
          sx={{ textTransform: 'none', fontSize: 11, height: 40, minWidth: 160 }}>
          {copiedCsv
            ? 'Copied!'
            : `Copy CSV (${checkedSymbols.size > 0 ? checkedSymbols.size : sorted.length})`}
        </Button>
      </Box>

      {selectedStocks.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
          {selectedStocks.map(s => {
            const sym = typeof s === 'string' ? s : s.symbol;
            return (
              <Chip key={sym} label={sym} size="small"
                onDelete={() => handleRemoveFromList(s)}
                deleteIcon={<MdClose size={14} />}
                sx={{ fontWeight: 600, fontSize: 12 }} />
            );
          })}
        </Box>
      )}

      {checkedSymbols.size > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center', p: '6px 12px',
          bgcolor: '#e3f2fd', borderRadius: 1, border: '1px solid #90caf9' }}>
          <Chip label={`${checkedSymbols.size} selected`} size="small"
            sx={{ fontWeight: 700, fontSize: 12, bgcolor: '#1a3c5e', color: '#fff' }} />
          <Button size="small" startIcon={<MdSelectAll />} onClick={selectAll}
            sx={{ textTransform: 'none', fontSize: 11, color: '#1a3c5e' }}>
            Select All ({sorted.length})
          </Button>
          <Button size="small" onClick={clearSelection}
            sx={{ textTransform: 'none', fontSize: 11, color: '#666' }}>
            Clear
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="contained" color="error" startIcon={<MdDeleteSweep />}
            onClick={handleBulkDelete} disabled={deleting}
            sx={{ textTransform: 'none', fontSize: 11 }}>
            {deleting ? 'Deleting…' : `Delete (${checkedSymbols.size})`}
          </Button>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <th style={{ width: 36, padding: '4px' }}>
                  <Checkbox size="small" sx={{ p: 0, color: '#fff', '&.Mui-checked': { color: '#fff' } }}
                    checked={paged.length > 0 && paged.every(r => checkedSymbols.has(r.symbol))}
                    indeterminate={paged.some(r => checkedSymbols.has(r.symbol)) && !paged.every(r => checkedSymbols.has(r.symbol))}
                    onChange={toggleSelectAllPage} />
                </th>
                {columns.map(c => (
                  <th key={c.key} onClick={() => handleSort(c.key)} style={{ cursor: 'pointer' }}>
                    {c.label} {sortConfig.key === c.key ? (sortConfig.ascending ? '▲' : '▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(row => (
                <tr key={row.symbol} style={{ background: checkedSymbols.has(row.symbol) ? '#e3f2fd' : undefined }}>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <Checkbox size="small" sx={{ p: 0 }}
                      checked={checkedSymbols.has(row.symbol)}
                      onChange={() => toggleCheck(row.symbol)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {row.symbol}
                      <a
                        href={`https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(row.symbol)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View ${row.symbol} on TradingView`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 18, height: 18, borderRadius: '50%', background: '#131722',
                          textDecoration: 'none', flexShrink: 0,
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 36 28" fill="none">
                          <path d="M14 22H7V11h7v11zm11 0h-7V6h7v16zm11 0h-7V0h7v22z" fill="#2962FF"/>
                          <rect y="25" width="36" height="3" rx="1.5" fill="#2962FF"/>
                        </svg>
                      </a>
                    </span>
                  </td>
                  <td>{row.price ? `₹${Number(row.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td style={{ fontWeight: 600, color: (row.day1d || 0) > 0 ? '#2e7d32' : (row.day1d || 0) < 0 ? '#c62828' : undefined }}>
                    {row.day1d != null ? `${row.day1d > 0 ? '+' : ''}${row.day1d.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.composite_score != null ? row.composite_score.toFixed(0) : '—'}</td>
                  <td>
                    {row.recommendation ? (
                      <Chip label={row.recommendation.replace('_', ' ').toUpperCase()} size="small"
                        sx={{ bgcolor: recColors[row.recommendation] || '#666', color: '#fff', fontWeight: 600, fontSize: 11 }} />
                    ) : '—'}
                  </td>
                  <td>{row.trend || '—'}</td>
                  <td style={{ color: row.supertrend_direction === 'up' ? '#2e7d32' : row.supertrend_direction === 'down' ? '#c62828' : undefined, fontWeight: 600 }}>
                    {row.supertrend_direction ? String(row.supertrend_direction).toUpperCase() : '—'}
                  </td>
                  <td style={{ color: deriveMacdLabel(row) === 'BUY' || deriveMacdLabel(row) === 'BULL' ? '#2e7d32' : deriveMacdLabel(row) === 'SELL' || deriveMacdLabel(row) === 'BEAR' ? '#c62828' : undefined, fontWeight: 600 }}>
                    {deriveMacdLabel(row)}
                  </td>
                  <td style={{ fontWeight: 600, color: (row.volume_ratio || 0) >= 2 ? '#c62828' : undefined }}>
                    {row.volume_ratio != null ? `${row.volume_ratio.toFixed(1)}x` : '—'}
                  </td>
                  <td>
                    {(() => {
                      const state = getTrailingState(row);
                      if (!row.entry_price) return '—';
                      return (
                        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.2 }}>
                          <span>₹{row.entry_price.toFixed(2)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: state.statusColor }}>
                            {state.statusLabel}
                          </span>
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const state = getTrailingState(row);
                      if (state.effectiveStopLoss == null) return '—';
                      return (
                        <span style={{ color: state.costExit ? '#c62828' : state.t1Hit ? '#1565c0' : undefined, fontWeight: state.t1Hit ? 700 : 400 }}>
                          ₹{state.effectiveStopLoss.toFixed(2)}
                          {state.costExit ? ' (C2C Exit)' : state.t1Hit ? ' (Trail @ Cost)' : ''}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const target = row.target_long_term ?? row.target_1;
                      if (!target) return '—';
                      const state = getTrailingState(row);
                      return (
                        <span style={{ color: state.t1Hit ? '#1565c0' : undefined, fontWeight: state.t1Hit ? 700 : 400 }}>
                          ₹{Number(target).toFixed(2)}{state.t1Hit ? ' (Hit)' : ''}
                        </span>
                      );
                    })()}
                  </td>
                  <td>{row.risk_reward_ratio ? `${row.risk_reward_ratio}:1` : '—'}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  No stocks in Long Term watchlist. Search and select stocks above to add.
                </td></tr>
              )}
            </tbody>
          </Table>
        </TableWrapper>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Box>
      )}
    </TableSection>
  );
}

export default LongTermPage;
