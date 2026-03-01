import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { approveTrailSlToCost, placeOrder, setBrokerExecutionMode, updateSuperTargetWithOco } from '../api/orders';
import { useAuth } from '../auth/AuthContext';

const PRODUCT_OPTIONS = [
  { value: 'INTRADAY', label: 'MIS (Intraday)' },
  { value: 'MARGIN', label: 'MTF (Margin)' },
  { value: 'DELIVERY', label: 'Delivery (CNC)' },
];
const ORDER_TYPES = ['MARKET', 'LIMIT', 'SUPER'];
const SUPER_ENTRY_TYPES = ['MARKET', 'LIMIT'];

const BROKER_CAPABILITIES = {
  dhan: { products: PRODUCT_OPTIONS.map((p) => p.value), limitSupported: true, superSupported: true },
  samco: { products: PRODUCT_OPTIONS.map((p) => p.value), limitSupported: true, superSupported: false },
  angelone: { products: PRODUCT_OPTIONS.map((p) => p.value), limitSupported: true, superSupported: false },
  upstox: { products: PRODUCT_OPTIONS.map((p) => p.value), limitSupported: true, superSupported: false },
};
const BROKER_LEVERAGE = {
  dhan: { INTRADAY: 5, MARGIN: 4, DELIVERY: 1 },
  angelone: { INTRADAY: 5, MARGIN: 4, DELIVERY: 1 },
  samco: { INTRADAY: 5, MARGIN: 4, DELIVERY: 1 },
  upstox: { INTRADAY: 5, MARGIN: 4, DELIVERY: 1 },
};

const toPositiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const formatInputPrice = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toFixed(2);
};

const resolveProfileLeverage = ({ profile, broker, productType }) => {
  if (!profile) return null;
  const brokerKey = String(broker || 'dhan').toLowerCase();
  const productKey = String(productType || 'DELIVERY').toUpperCase();
  const productProfile = profile?.byProduct?.[productKey] || profile;

  const productBrokerSpecific = toPositiveNumber(
    productProfile?.leverageByBroker?.[brokerKey]?.[productKey]
      ?? productProfile?.leverageByBroker?.[brokerKey]?.[productKey.toLowerCase()]
      ?? productProfile?.leverageByBroker?.[brokerKey]
  );
  if (productBrokerSpecific != null) return productBrokerSpecific;

  const rootBrokerSpecific = toPositiveNumber(
    profile?.leverageByBroker?.[brokerKey]?.[productKey]
      ?? profile?.leverageByBroker?.[brokerKey]?.[productKey.toLowerCase()]
      ?? profile?.leverageByBroker?.[brokerKey]
  );
  if (rootBrokerSpecific != null) return rootBrokerSpecific;

  if (productKey === 'MARGIN') {
    return toPositiveNumber(productProfile?.mtfLeverage ?? productProfile?.marginLeverage ?? profile?.mtfLeverage ?? profile?.marginLeverage);
  }
  if (productKey === 'INTRADAY') {
    return toPositiveNumber(productProfile?.intradayLeverage ?? profile?.intradayLeverage);
  }
  if (productKey === 'DELIVERY') {
    return toPositiveNumber(productProfile?.deliveryLeverage ?? profile?.deliveryLeverage);
  }
  return toPositiveNumber(productProfile?.leverage ?? profile?.leverage);
};

const resolveUserId = (user) => user?.id || user?.user_id || user?.email || '';

function OrderPanel({
  defaultSymbol = '',
  defaultBroker = 'dhan',
  symbolOptions = [],
  symbolPrices = {},
  symbolProfiles = {},
  hideBrokerSelector = false,
  onSetAlert,
  onOrderPlaced,
}) {
  const { user, isAdmin } = useAuth();
  const userId = resolveUserId(user);
  const [side, setSide] = useState('BUY');
  const [broker, setBroker] = useState(defaultBroker);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [productType, setProductType] = useState('INTRADAY');
  const [orderType, setOrderType] = useState('MARKET');
  const [superEntryType, setSuperEntryType] = useState('MARKET');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [target1, setTarget1] = useState('');
  const [target2, setTarget2] = useState('');
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastAutofilledSymbol, setLastAutofilledSymbol] = useState('');
  const [lastAutofilledProduct, setLastAutofilledProduct] = useState('');
  const [lastSuperOrder, setLastSuperOrder] = useState(null);
  const [pendingTrail, setPendingTrail] = useState(null);
  const [trailHandled, setTrailHandled] = useState({});

  const capabilities = useMemo(() => BROKER_CAPABILITIES[broker] || BROKER_CAPABILITIES.dhan, [broker]);
  const effectiveOrderType = orderType === 'SUPER' ? superEntryType : orderType;
  const requiresFundsCheckPrice =
    side === 'BUY' || (side === 'SELL' && productType === 'INTRADAY');
  const enteredSymbol = String(symbol || '').trim().toUpperCase();
  const marketReferencePrice = useMemo(() => {
    const val = symbolPrices?.[enteredSymbol];
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [symbolPrices, enteredSymbol]);
  const selectedSymbolProfile = useMemo(
    () => symbolProfiles?.[enteredSymbol] || null,
    [symbolProfiles, enteredSymbol]
  );
  const leverageOverrideMap = useMemo(() => {
    const source = selectedSymbolProfile?.leverageByBroker;
    if (!source || typeof source !== 'object') return null;
    const next = {};
    for (const [brokerName, value] of Object.entries(source)) {
      if (!brokerName || !value || typeof value !== 'object') continue;
      const cleaned = {};
      for (const [productName, productLeverage] of Object.entries(value)) {
        const lev = toPositiveNumber(productLeverage);
        if (lev != null) cleaned[String(productName).toUpperCase()] = lev;
      }
      if (Object.keys(cleaned).length) next[String(brokerName).toLowerCase()] = cleaned;
    }
    return Object.keys(next).length ? next : null;
  }, [selectedSymbolProfile]);
  const effectiveProductOptions = useMemo(() => {
    const supported = PRODUCT_OPTIONS.filter((p) => capabilities.products.includes(p.value));
    if (side === 'SELL') {
      return supported.filter((p) => p.value !== 'MARGIN');
    }
    return supported;
  }, [capabilities.products, side]);

  const tradePreview = useMemo(() => {
    const qtyNum = Number(qty || 0);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return null;
    const entry = (orderType === 'LIMIT' || (orderType === 'SUPER' && superEntryType === 'LIMIT'))
      ? Number(price || 0)
      : Number(marketReferencePrice || 0);
    if (!Number.isFinite(entry) || entry <= 0) return null;

    const slNum = Number(stopLoss || 0);
    const t1Num = Number(target1 || 0);
    const t2Num = Number(target2 || 0);
    const direction = side === 'SELL' ? -1 : 1;
    const riskPerUnit = Number.isFinite(slNum) && slNum > 0 ? Math.max(0, (entry - slNum) * direction) : null;
    const reward1PerUnit = Number.isFinite(t1Num) && t1Num > 0 ? Math.max(0, (t1Num - entry) * direction) : null;
    const reward2PerUnit = Number.isFinite(t2Num) && t2Num > 0 ? Math.max(0, (t2Num - entry) * direction) : null;
    const riskTotal = riskPerUnit != null ? riskPerUnit * qtyNum : null;
    const reward1Total = reward1PerUnit != null ? reward1PerUnit * qtyNum : null;
    const reward2Total = reward2PerUnit != null ? reward2PerUnit * qtyNum : null;
    const rr1 = riskTotal != null && riskTotal > 0 && reward1Total != null ? reward1Total / riskTotal : null;
    const rr2 = riskTotal != null && riskTotal > 0 && reward2Total != null ? reward2Total / riskTotal : null;
    const leverage =
      resolveProfileLeverage({
        profile: selectedSymbolProfile,
        broker,
        productType,
      }) ?? Number(BROKER_LEVERAGE?.[broker]?.[productType] || 1);
    const turnover = entry * qtyNum;
    const marginRequired = turnover / Math.max(leverage, 1);

    return {
      entry,
      qty: qtyNum,
      leverage,
      turnover,
      marginRequired,
      riskTotal,
      reward1Total,
      reward2Total,
      rr1,
      rr2,
    };
  }, [qty, orderType, superEntryType, price, marketReferencePrice, stopLoss, target1, target2, side, broker, productType, selectedSymbolProfile]);

  const setupWarnings = useMemo(() => {
    const warnings = [];
    const entry = tradePreview?.entry;
    if (!Number.isFinite(entry) || entry <= 0) {
      warnings.push('Entry price is missing or invalid.');
      return warnings;
    }
    const slNum = Number(stopLoss || 0);
    const t1Num = Number(target1 || 0);
    const t2Num = Number(target2 || 0);

    if (!(Number.isFinite(slNum) && slNum > 0)) {
      warnings.push('Stop Loss is missing.');
    }
    if (!(Number.isFinite(t1Num) && t1Num > 0)) {
      warnings.push('Target 1 is missing.');
    }

    if (side === 'BUY') {
      if (Number.isFinite(slNum) && slNum > 0 && slNum >= entry) warnings.push('For BUY, SL must be below Entry.');
      if (Number.isFinite(t1Num) && t1Num > 0 && t1Num <= entry) warnings.push('For BUY, Target 1 must be above Entry.');
      if (orderType !== 'SUPER' && Number.isFinite(t2Num) && t2Num > 0 && t2Num <= entry) warnings.push('For BUY, Target 2 should be above Entry.');
    } else {
      if (Number.isFinite(slNum) && slNum > 0 && slNum <= entry) warnings.push('For SELL, SL must be above Entry.');
      if (Number.isFinite(t1Num) && t1Num > 0 && t1Num >= entry) warnings.push('For SELL, Target 1 must be below Entry.');
      if (orderType !== 'SUPER' && Number.isFinite(t2Num) && t2Num > 0 && t2Num >= entry) warnings.push('For SELL, Target 2 should be below Entry.');
    }
    return warnings;
  }, [tradePreview, stopLoss, target1, target2, side, orderType]);

  useEffect(() => {
    if (defaultSymbol) setSymbol(String(defaultSymbol).toUpperCase());
  }, [defaultSymbol]);

  useEffect(() => {
    if (defaultBroker) setBroker(String(defaultBroker).toLowerCase());
  }, [defaultBroker]);

  useEffect(() => {
    if (side === 'SELL' && productType === 'MARGIN') {
      setProductType('INTRADAY');
      setError('MTF does not support SELL. Switched to Intraday.');
    }
  }, [side, productType]);

  useEffect(() => {
    if (!enteredSymbol) {
      setLastAutofilledSymbol('');
      setLastAutofilledProduct('');
      return;
    }
    const profile = symbolProfiles?.[enteredSymbol];
    const productProfile = profile?.byProduct?.[productType] || profile;
    const alreadyAutofilled =
      enteredSymbol === lastAutofilledSymbol &&
      productType === lastAutofilledProduct;
    if (alreadyAutofilled && productProfile) return;
    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const profileEntry = toNum(productProfile?.entryPrice);
    const profileSl = toNum(productProfile?.stopLoss);
    const profileT1 = toNum(productProfile?.target1);
    const profileT2 = toNum(productProfile?.target2);
    const fallbackEntry = toNum(marketReferencePrice);

    if (orderType === 'SUPER') {
      if (profileEntry != null) setPrice(formatInputPrice(profileEntry));
      else if (fallbackEntry != null) setPrice(formatInputPrice(fallbackEntry));
      if (profileSl != null) setStopLoss(formatInputPrice(profileSl));
      if (profileT1 != null) setTarget1(formatInputPrice(profileT1));
      if (profileT2 != null) setTarget2(formatInputPrice(profileT2));
    } else {
      if (orderType === 'LIMIT') {
        if (profileEntry != null) setPrice(formatInputPrice(profileEntry));
        else if (fallbackEntry != null) setPrice(formatInputPrice(fallbackEntry));
      }
      if (profileSl != null) setStopLoss(formatInputPrice(profileSl));
      if (profileT1 != null) setTarget1(formatInputPrice(profileT1));
      if (profileT2 != null) setTarget2(formatInputPrice(profileT2));
    }
    setLastAutofilledSymbol(enteredSymbol);
    setLastAutofilledProduct(productType);
  }, [enteredSymbol, productType, lastAutofilledProduct, lastAutofilledSymbol, marketReferencePrice, orderType, symbolProfiles]);

  useEffect(() => {
    if (orderType !== 'LIMIT') return;
    if (price) return;
    if (marketReferencePrice > 0) setPrice(formatInputPrice(marketReferencePrice));
  }, [orderType, price, marketReferencePrice]);

  const place = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!userId) throw new Error('Missing user context');
      if (!symbol.trim()) throw new Error('Symbol is required');
      if (!Number(qty) || Number(qty) <= 0) throw new Error('Quantity must be greater than zero');
      if (orderType === 'SUPER') {
        if (!Number(stopLoss) || Number(stopLoss) <= 0) throw new Error('SL is required for Super order');
        if (!Number(target1) || Number(target1) <= 0) throw new Error('Target 1 is required for Super order');
      }
      const effectivePrice = orderType === 'LIMIT'
        ? Number(price || 0)
        : orderType === 'SUPER' && superEntryType === 'LIMIT'
        ? Number(price || 0)
        : Number(marketReferencePrice || 0);
      if ((orderType === 'LIMIT' || (orderType === 'SUPER' && superEntryType === 'LIMIT')) && (!effectivePrice || effectivePrice <= 0)) {
        throw new Error('Enter limit price');
      }
      if (requiresFundsCheckPrice && (!effectivePrice || effectivePrice <= 0)) {
        throw new Error('Price data unavailable for fund check. Select a symbol from your list with CMP.');
      }
      const payload = {
        user_id: userId,
        broker,
        symbol: symbol.trim().toUpperCase(),
        side,
        product_type: productType,
        order_type: effectiveOrderType,
        qty: Number(qty),
        price: effectivePrice,
        strategy_tag: orderType === 'SUPER' ? 'super_order' : 'manual',
        strategy_payload: {
          requested_order_type: orderType,
          super_entry_type: orderType === 'SUPER' ? superEntryType : null,
          stop_loss: stopLoss ? Number(stopLoss) : null,
          target_1: target1 ? Number(target1) : null,
          target_2: orderType === 'SUPER' ? null : (target2 ? Number(target2) : null),
          leverage_overrides: leverageOverrideMap,
        },
      };
      const res = await placeOrder(payload);
      const funds = res?.funds_check;
      const fundsSuffix = funds?.checked
        ? ` | Funds OK (Need ₹${Number(funds.required_amount || 0).toFixed(2)}, Available ₹${Number(funds.available_amount_before || 0).toFixed(2)}, Lev ${Number(funds.leverage_used || 1).toFixed(1)}x)`
        : '';
      setMessage(
        orderType === 'SUPER'
          ? `Super order requested (submitted as ${effectiveOrderType}) - ${res?.data?.status || 'OK'}${fundsSuffix}`
          : `Order placed (${res?.data?.status || 'OK'})${fundsSuffix}`
      );
      if (typeof onOrderPlaced === 'function') onOrderPlaced(res?.data ?? null);
      if (orderType === 'SUPER' && res?.data?.id) {
        setLastSuperOrder({
          orderId: res.data.id,
          symbol: payload.symbol,
          side: payload.side,
          target1: Number(payload.strategy_payload?.target_1 || 0),
          entryPrice: Number(payload.price || 0),
        });
      }
    } catch (e) {
      setError(e?.message || 'Failed to place order');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!lastSuperOrder?.orderId || trailHandled[lastSuperOrder.orderId]) return;
    const current = Number(symbolPrices?.[lastSuperOrder.symbol]);
    if (!Number.isFinite(current) || current <= 0) return;
    const target = Number(lastSuperOrder.target1 || 0);
    if (!Number.isFinite(target) || target <= 0) return;
    const hit = lastSuperOrder.side === 'SELL' ? current <= target : current >= target;
    if (!hit) return;
    setPendingTrail({
      ...lastSuperOrder,
      currentPrice: current,
    });
  }, [lastSuperOrder, symbolPrices, trailHandled]);

  const buildSuggestedTargetByConviction = (ctx, conviction) => {
    const current = Number(ctx?.currentPrice || 0);
    const base = Math.max(current, Number(ctx?.target1 || 0), Number(ctx?.entryPrice || 0));
    if (!Number.isFinite(base) || base <= 0) return 0;
    const c = String(conviction || 'MEDIUM').toUpperCase();
    const multiplier = c === 'HIGH' ? 1.03 : c === 'LOW' ? 1.01 : 1.02;
    return Number((base * multiplier).toFixed(2));
  };

  const runSlToCostUpdate = async (ctx) => {
    await approveTrailSlToCost({ userId, orderId: ctx.orderId });
    const entry = Number(ctx.entryPrice || 0);
    if (entry > 0) setStopLoss(String(entry));
  };

  const runOcoTargetUpdate = async (ctx) => {
    const convictionRaw = (window.prompt('Conviction for movement? Enter LOW / MEDIUM / HIGH', 'MEDIUM') || '').toUpperCase();
    const conviction = ['LOW', 'MEDIUM', 'HIGH'].includes(convictionRaw) ? convictionRaw : 'MEDIUM';
    const suggested = buildSuggestedTargetByConviction(ctx, conviction);
    const nextTargetRaw = window.prompt(
      `Enter new T2 for ${ctx.symbol} (Conviction: ${conviction})`,
      suggested > 0 ? String(suggested) : ''
    );
    const nextTarget = Number(nextTargetRaw);
    if (!Number.isFinite(nextTarget) || nextTarget <= 0) {
      throw new Error('Valid T2 is required for OCO update');
    }
    await updateSuperTargetWithOco({ userId, orderId: ctx.orderId, targetPrice: nextTarget });
    setTarget2(String(nextTarget));
    return nextTarget;
  };

  const onTrailAction = async (action) => {
    if (!pendingTrail?.orderId || !userId) return;
    setBusy(true);
    setError('');
    try {
      const ctx = pendingTrail;
      if (action === 'sl') {
        await runSlToCostUpdate(ctx);
        setMessage(`T1 reached for ${ctx.symbol}. SL moved to cost.`);
      } else if (action === 't2') {
        const t2 = await runOcoTargetUpdate(ctx);
        setMessage(`T1 reached for ${ctx.symbol}. OCO target updated to ₹${Number(t2).toFixed(2)}.`);
      } else {
        await runSlToCostUpdate(ctx);
        const t2 = await runOcoTargetUpdate(ctx);
        setMessage(`T1 reached for ${ctx.symbol}. SL moved to cost and OCO target updated to ₹${Number(t2).toFixed(2)}.`);
      }
      setTrailHandled((prev) => ({ ...prev, [ctx.orderId]: true }));
      setPendingTrail(null);
    } catch (e) {
      setError(e?.message || 'Failed to update trailing/OCO actions');
    } finally {
      setBusy(false);
    }
  };

  const triggerSetAlert = () => {
    if (typeof onSetAlert !== 'function') return;
    const cleanSymbol = String(symbol || '').trim().toUpperCase();
    if (!cleanSymbol) {
      setError('Enter symbol before setting alert');
      return;
    }
    onSetAlert({ symbol: cleanSymbol, side, productType });
  };

  const onToggleLive = async (checked) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!userId) throw new Error('Missing user context');
      await setBrokerExecutionMode({ user_id: userId, broker, live_enabled: checked });
      setLiveEnabled(checked);
      setMessage(checked ? 'Live execution enabled for broker.' : 'Paper execution enabled.');
    } catch (e) {
      setError(e?.message || 'Failed to update execution mode');
    } finally {
      setBusy(false);
    }
  };

  const clearForm = () => {
    setSide('BUY');
    setProductType('INTRADAY');
    setOrderType('MARKET');
    setSuperEntryType('MARKET');
    setSymbol('');
    setQty(1);
    setPrice('');
    setStopLoss('');
    setTarget1('');
    setTarget2('');
    setLastAutofilledSymbol('');
    setLastAutofilledProduct('');
    setLastSuperOrder(null);
    setPendingTrail(null);
    setTrailHandled({});
    setError('');
    setMessage('');
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 700 }}>
          Trade Action Panel
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontSize: 12, color: '#666' }}>Paper</Typography>
          <Switch
            size="small"
            checked={liveEnabled}
            onChange={(e) => onToggleLive(e.target.checked)}
            disabled={busy || !isAdmin}
          />
          <Typography sx={{ fontSize: 12, color: liveEnabled ? '#1b5e20' : '#666', fontWeight: 600 }}>
            {liveEnabled ? 'Live' : 'Paper'}
          </Typography>
        </Stack>
      </Stack>

      {hideBrokerSelector ? (
        <Stack direction="row" spacing={1} sx={{ mb: 1.2 }}>
          <Button
            variant={side === 'BUY' ? 'contained' : 'outlined'}
            color="success"
            onClick={() => setSide('BUY')}
            sx={{ textTransform: 'none', minWidth: 48, fontWeight: 700 }}
          >
            B
          </Button>
          <Button
            variant={side === 'SELL' ? 'contained' : 'outlined'}
            color="error"
            onClick={() => setSide('SELL')}
            sx={{ textTransform: 'none', minWidth: 48, fontWeight: 700 }}
          >
            S
          </Button>
          <Button
            variant="outlined"
            onClick={triggerSetAlert}
            sx={{ textTransform: 'none', ml: 1 }}
          >
            Set Alert
          </Button>
        </Stack>
      ) : null}

      <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
        {!hideBrokerSelector ? (
          <TextField select size="small" label="Broker" value={broker} onChange={(e) => setBroker(e.target.value)}>
            {Object.keys(BROKER_CAPABILITIES).map((name) => (
              <MenuItem value={name} key={name}>{name.toUpperCase()}</MenuItem>
            ))}
          </TextField>
        ) : null}
        <Autocomplete
          freeSolo
          size="small"
          options={(symbolOptions || []).map((s) => String(s).toUpperCase())}
          value={symbol || ''}
          onInputChange={(_, value) => setSymbol(String(value || '').toUpperCase())}
          onChange={(_, value) => setSymbol(String(value || '').toUpperCase())}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Symbol"
              placeholder="RELIANCE"
            />
          )}
        />
        <TextField select size="small" label="Product" value={productType} onChange={(e) => setProductType(e.target.value)}>
          {effectiveProductOptions.map((item) => (
            <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Order Type" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
          {ORDER_TYPES.map((item) => (
            <MenuItem key={item} value={item} disabled={item === 'SUPER' && !capabilities.superSupported}>
              {item === 'SUPER' ? 'SUPER (bracket)' : item}
            </MenuItem>
          ))}
        </TextField>
        {orderType === 'SUPER' ? (
          <TextField
            select
            size="small"
            label="Super Entry"
            value={superEntryType}
            onChange={(e) => setSuperEntryType(e.target.value)}
          >
            {SUPER_ENTRY_TYPES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField size="small" label="Quantity" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        {(orderType === 'LIMIT' || (orderType === 'SUPER' && superEntryType === 'LIMIT')) ? (
          <TextField
            size="small"
            label="Price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={!capabilities.limitSupported}
            placeholder="Limit price"
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1, color: '#666', fontSize: 12 }}>
            Market/Super order uses symbol CMP for validation.
          </Box>
        )}
        <TextField size="small" label="SL (optional)" type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
        <TextField size="small" label="Target 1" type="number" value={target1} onChange={(e) => setTarget1(e.target.value)} />
        {orderType !== 'SUPER' ? (
          <TextField size="small" label="Target 2" type="number" value={target2} onChange={(e) => setTarget2(e.target.value)} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1, color: '#666', fontSize: 12 }}>
            Super entry allows one target (T1). Use OCO update for T2 after T1 hit.
          </Box>
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        {!hideBrokerSelector ? (
          <>
            <Button
              variant={side === 'BUY' ? 'contained' : 'outlined'}
              color="success"
              onClick={() => setSide('BUY')}
              sx={{ textTransform: 'none' }}
            >
              Buy
            </Button>
            <Button
              variant={side === 'SELL' ? 'contained' : 'outlined'}
              color="error"
              onClick={() => setSide('SELL')}
              sx={{ textTransform: 'none' }}
            >
              Sell
            </Button>
          </>
        ) : null}
        <Button variant="outlined" onClick={clearForm} disabled={busy} sx={{ textTransform: 'none' }}>
          Clear
        </Button>
        <Button variant="contained" onClick={place} disabled={busy} sx={{ textTransform: 'none', ml: 'auto' }}>
          Place Order
        </Button>
      </Stack>

      {tradePreview ? (
        <Box sx={{ mt: 1.2, p: 1.2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Trade Preview (Qty based)</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`Entry: ₹${tradePreview.entry.toFixed(2)}`} />
            <Chip size="small" label={`Qty: ${tradePreview.qty}`} />
            <Chip size="small" label={`Leverage: ${tradePreview.leverage.toFixed(1)}x`} />
            <Chip size="small" label={`Margin: ₹${tradePreview.marginRequired.toFixed(2)}`} />
            <Chip
              size="small"
              color={tradePreview.riskTotal != null && tradePreview.riskTotal > 0 ? 'error' : 'default'}
              label={`Risk: ${tradePreview.riskTotal != null ? `₹${tradePreview.riskTotal.toFixed(2)}` : '—'}`}
            />
            <Chip
              size="small"
              color={tradePreview.reward1Total != null && tradePreview.reward1Total > 0 ? 'success' : 'default'}
              label={`Target1 PnL: ${tradePreview.reward1Total != null ? `₹${tradePreview.reward1Total.toFixed(2)}` : '—'}`}
            />
            <Chip
              size="small"
              color={tradePreview.rr1 != null ? 'primary' : 'default'}
              label={`R:R (T1): ${tradePreview.rr1 != null ? `${tradePreview.rr1.toFixed(2)}:1` : '—'}`}
            />
            {orderType !== 'SUPER' ? (
              <>
                <Chip
                  size="small"
                  color={tradePreview.reward2Total != null && tradePreview.reward2Total > 0 ? 'success' : 'default'}
                  label={`Target2 PnL: ${tradePreview.reward2Total != null ? `₹${tradePreview.reward2Total.toFixed(2)}` : '—'}`}
                />
                <Chip
                  size="small"
                  color={tradePreview.rr2 != null ? 'primary' : 'default'}
                  label={`R:R (T2): ${tradePreview.rr2 != null ? `${tradePreview.rr2.toFixed(2)}:1` : '—'}`}
                />
              </>
            ) : null}
          </Stack>
          {setupWarnings.length > 0 ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {setupWarnings.join(' ')}
            </Alert>
          ) : null}
        </Box>
      ) : null}

      {pendingTrail ? (
        <Alert
          severity="warning"
          sx={{ mt: 1.5 }}
          action={(
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={() => onTrailAction('sl')} disabled={busy} sx={{ textTransform: 'none' }}>
                Book at T1 (SL->Cost)
              </Button>
              <Button size="small" variant="outlined" onClick={() => onTrailAction('t2')} disabled={busy} sx={{ textTransform: 'none' }}>
                Extend to T2
              </Button>
              <Button size="small" variant="outlined" onClick={() => onTrailAction('both')} disabled={busy} sx={{ textTransform: 'none' }}>
                Do Both
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setTrailHandled((prev) => ({ ...prev, [pendingTrail.orderId]: true }));
                  setPendingTrail(null);
                }}
                sx={{ textTransform: 'none' }}
              >
                Dismiss
              </Button>
            </Stack>
          )}
        >
          {`T1 hit for ${pendingTrail.symbol} (CMP ₹${Number(pendingTrail.currentPrice || 0).toFixed(2)}). You can either book profit at T1 (move SL to cost) or extend the move by setting T2 via OCO based on conviction.`}
        </Alert>
      ) : null}
      {message ? <Alert severity="success" sx={{ mt: 1.5 }}>{message}</Alert> : null}
      {error ? <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert> : null}
    </Paper>
  );
}

export default OrderPanel;
