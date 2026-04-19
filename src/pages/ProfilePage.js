import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { useLocation, useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import UpgradeToPremiumBanner from '../components/UpgradeToPremiumBanner';
import { brokerRowHasLiveTradingSession, fetchBrokerSetup, saveBrokerSetup, validateBrokerSetup } from '../api/brokers';
import { deleteAiApiKey, fetchAiApiKeys, saveAiApiKey, setAiApiKeyStatus } from '../api/auth';
import {
  fetchAngeloneHoldings,
  fetchAngeloneOrders,
  fetchAngelonePositions,
  ensureAngeloneSession,
} from '../api/angelone';
import {
  fetchDhanHoldings,
  connectDhan,
  fetchDhanOrders,
  fetchDhanPositions,
} from '../api/dhan';
import { loadRestBrokerPortfolioSlices } from '../api/restBrokerPortfolio';
import { ensureKotakBrokerSession } from '../api/kotakBroker';
import { ensureFyersBrokerSession } from '../api/fyersBroker';
import { ensureZerodhaBrokerSession } from '../api/zerodhaBroker';
import { resolveDhanClientIdForSubmit } from '../utils/dhanBrokerDraft';
import { PricingMarketingContent } from './PricingPage';
import { FeaturesMarketingContent } from './FeaturesPage';

const pickArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.positions)) return payload.positions;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const deriveOpenPositionsFromOrders = (orders) => {
  const rows = Array.isArray(orders) ? orders : [];
  const bySymbol = new Map();
  rows.forEach((row) => {
    const status = String(row?.orderStatus || row?.status || '').toUpperCase();
    if (!['FILLED', 'PARTIAL', 'COMPLETE'].includes(status)) return;
    const symbol = String(row?.tradingSymbol || row?.symbol || row?.securityId || '').trim().toUpperCase();
    if (!symbol) return;
    const side = String(row?.transactionType || row?.side || '').toUpperCase();
    const qty = Number(row?.filledQty ?? row?.quantity ?? row?.qty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const price = Number(row?.averagePrice ?? row?.avgPrice ?? row?.price ?? 0);
    const current = bySymbol.get(symbol) || { tradingSymbol: symbol, netQty: 0, buyValue: 0 };
    if (side === 'BUY') {
      current.netQty += qty;
      if (Number.isFinite(price) && price > 0) current.buyValue += qty * price;
    } else if (side === 'SELL') {
      current.netQty -= qty;
      if (Number.isFinite(price) && price > 0) current.buyValue -= qty * price;
    }
    bySymbol.set(symbol, current);
  });
  return [...bySymbol.values()]
    .filter((r) => Number(r.netQty) !== 0)
    .map((r) => ({
      ...r,
      productType: 'DELIVERY',
      buyAvg: r.netQty !== 0 ? Math.abs((r.buyValue || 0) / r.netQty) : 0,
      pnl: 0,
      ltp: 0,
    }));
};

const AI_KEY_PROVIDERS = ['groq', 'gemini', 'cerebras', 'perplexity'];
const BROKER_LABELS = {
  dhan: 'Dhan',
  angelone: 'Angel One',
  samco: 'Samco',
  upstox: 'Upstox',
  kotak: 'Kotak Neo',
  fyers: 'Fyers',
  zerodha: 'Zerodha (Kite)',
};
/**
 * Official broker setup / API documentation (keys, OAuth, consent, IP allowlist — follow the broker site).
 * Used when `GET /brokers/setup` does not return `doc_url` for a row.
 */
const BROKER_SETUP_DOC_URLS = {
  dhan: 'https://dhanhq.co/docs/v2/',
  samco: 'https://docs-tradeapi.samco.in',
  angelone: 'https://smartapi.angelbroking.com/docs',
  upstox: 'https://upstox.com/developer/api-documentation',
  kotak: 'https://www.notion.so/Client-documentation-236da70d37e280b3a979fc7be7b003bc',
  fyers: 'https://myapi.fyers.in/docsv3',
  zerodha: 'https://kite.trade/docs/connect/v3/',
};
const PROFILE_BROKER_TABS_ORDER = ['dhan', 'samco', 'angelone', 'upstox', 'kotak', 'fyers', 'zerodha'];

/** Hints for password managers; `new-password` on non-login fields often triggers wrong suggestions. */
const BROKER_ANTI_AUTOFILL_DATA = {
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
};

const buildBrokerInputProps = (name) => ({
  name,
  autoComplete: 'off',
  spellCheck: false,
  autoCapitalize: 'off',
  autoCorrect: 'off',
  ...BROKER_ANTI_AUTOFILL_DATA,
});

const buildBrokerSecretInputProps = (name) => ({
  name,
  autoComplete: 'off',
  spellCheck: false,
  autoCapitalize: 'off',
  autoCorrect: 'off',
  ...BROKER_ANTI_AUTOFILL_DATA,
});
const DHAN_DAILY_CONSENT_LIMIT = 25;
const consentBlockKeyForToday = (userId) => `dhan_consent_blocked_${String(userId || '')}_${new Date().toISOString().slice(0, 10)}`;

/** Backend sends RFC3339 ``Z`` or legacy naive UTC; always show wall time in IST. */
const formatLastAuthIST = (value) => {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  let ms = Date.parse(s);
  if (!Number.isFinite(ms)) {
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[\sT](\d{2}:\d{2}:\d{2})/);
    if (m) ms = Date.parse(`${m[1]}T${m[2]}Z`);
  }
  if (!Number.isFinite(ms)) return s;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(ms));
  } catch (_) {
    return s;
  }
};

function ProfilePage() {
  const { user, isAdmin, outlookPremium } = useAuth();
  const paidPremiumLapsed =
    Boolean(user?.paid_premium_until) &&
    user?.paid_premium_active === false &&
    !outlookPremium;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = String(user?.id || user?.user_id || user?.email || '');
  const brokerSessionKey = useCallback(
    (broker) => `broker_session_auth_${userId}_${String(broker || '').toLowerCase()}`,
    [userId]
  );
  const onboardingBrokerSetup = Boolean(location.state?.openBrokerSetup);
  const onboardingTargetPath = location.state?.from || '/';
  const onboardingPreferredBroker = String(location.state?.preferredBroker || '').toLowerCase();
  const activeTab = useMemo(() => {
    const t = String(searchParams.get('tab') || '').toLowerCase();
    return t === 'broker' || t === 'pricing' || t === 'features' ? t : 'account';
  }, [searchParams]);

  const setActiveTab = useCallback(
    (value) => {
      const v = value === 'broker' || value === 'pricing' || value === 'features' ? value : 'account';
      const next = new URLSearchParams(searchParams);
      if (v === 'account') {
        next.delete('tab');
      } else {
        next.set('tab', v);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const [rows, setRows] = useState([]);
  const [selectedBroker, setSelectedBroker] = useState('dhan');
  const brokerSelectInitializedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [aiKeys, setAiKeys] = useState([]);
  const [aiKeyDrafts, setAiKeyDrafts] = useState({});
  const [aiBusy, setAiBusy] = useState(false);
  /** Placeholder only — real password is never stored in the browser. Default: hidden (off). */
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [aiKeyShowPassword, setAiKeyShowPassword] = useState({});
  const [brokerSecretVisible, setBrokerSecretVisible] = useState({ pin: false, api_secret: false });
  const isLiveExecution = (row) => Boolean(row?.is_enabled && row?.has_session) || Boolean(row?.live_enabled);

  const brokerSecretAdornment = (field) => ({
    endAdornment: (
      <InputAdornment position="end">
        <IconButton
          aria-label={brokerSecretVisible[field] ? `Hide ${field}` : `Show ${field}`}
          edge="end"
          size="small"
          onClick={() => setBrokerSecretVisible((p) => ({ ...p, [field]: !p[field] }))}
          onMouseDown={(e) => e.preventDefault()}
        >
          {brokerSecretVisible[field] ? <MdVisibilityOff size={22} /> : <MdVisibility size={22} />}
        </IconButton>
      </InputAdornment>
    ),
  });
  /** Chrome often ignores `autocomplete=off` for “login-like” pairs; brief readOnly blocks injected fills. */
  const [brokerAutofillUnlock, setBrokerAutofillUnlock] = useState({});
  useEffect(() => {
    setBrokerAutofillUnlock({});
  }, [selectedBroker]);
  const brokerFieldsUnlocked = Boolean(brokerAutofillUnlock[selectedBroker]);
  const brokerLockedInputProps = useCallback(
    (name, { secret = false } = {}) => {
      const base = secret ? buildBrokerSecretInputProps(name) : buildBrokerInputProps(name);
      return {
        ...base,
        readOnly: !brokerFieldsUnlocked,
        onFocus: (e) => {
          if (!brokerFieldsUnlocked) {
            setBrokerAutofillUnlock((p) => ({ ...p, [selectedBroker]: true }));
          }
          const t = e?.target;
          if (t && t.readOnly) t.readOnly = false;
        },
      };
    },
    [brokerFieldsUnlocked, selectedBroker]
  );
  const brokerPinMaskSx = (pinVisible) => ({
    '& input': {
      WebkitTextSecurity: pinVisible ? 'none' : 'disc',
    },
  });
  const brokerDraftKey = useCallback(
    (broker) => `broker_integration_draft_${userId}_${String(broker || '').toLowerCase()}`,
    [userId]
  );

  const liveEnabledCount = rows.filter((r) => isLiveExecution(r)).length;
  const displayName = user?.name || user?.full_name || '—';
  const displayEmail = user?.email || '—';
  const displayMobile = user?.mobile || user?.phone || '—';
  const aiRows = useMemo(() => {
    const byProvider = new Map((Array.isArray(aiKeys) ? aiKeys : []).map((r) => [String(r.provider || '').toLowerCase(), r]));
    return AI_KEY_PROVIDERS.map((provider) => {
      const row = byProvider.get(provider);
      return row || { provider, has_key: false, is_active: false, masked_key: '', updated_at: null };
    });
  }, [aiKeys]);

  const emptyCredentials = (broker) => {
    if (broker === 'dhan') return { mobile: '', pin: '', totp: '', access_token: '', api_key: '', api_secret: '', token_id: '' };
    if (broker === 'angelone' || broker === 'kotak') return { api_key: '', pin: '', totp: '', access_token: '' };
    if (broker === 'upstox') return { access_token: '', auth_code: '', client_secret: '', redirect_uri: '' };
    if (broker === 'fyers' || broker === 'zerodha') {
      return { api_key: '', api_secret: '', access_token: '', auth_code: '', redirect_uri: '' };
    }
    return { pin: '', access_token: '' }; // samco
  };

  const readBrokerDraft = useCallback((broker) => {
    if (!userId) return {};
    try {
      const raw = localStorage.getItem(brokerDraftKey(broker));
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }, [userId, brokerDraftKey]);

  /** Persist broker form draft only on explicit user edits — not after API-loaded `rows` (avoids mirroring server/env defaults into localStorage). */
  const persistBrokerDraftForRow = useCallback(
    (row) => {
      if (!userId || !row?.broker) return;
      const broker = String(row.broker).toLowerCase();
      if (!broker) return;
      try {
        const isDhan = broker === 'dhan';
        const draftClientId = isDhan
          ? resolveDhanClientIdForSubmit(row?.client_id, row?.credentials?.mobile)
          : String(row?.client_id || '').trim();
        localStorage.setItem(
          brokerDraftKey(broker),
          JSON.stringify({
            client_id: draftClientId,
            credentials: {
              mobile: isDhan ? '' : String(row?.credentials?.mobile || '').trim(),
              api_key: String(row?.credentials?.api_key || '').trim(),
              api_secret: String(row?.credentials?.api_secret || '').trim(),
            },
          })
        );
      } catch (_) {
        // ignore localStorage failures
      }
    },
    [userId, brokerDraftKey]
  );

  const applyDraftToRow = useCallback((row) => {
    const broker = String(row?.broker || '').toLowerCase();
    const draft = readBrokerDraft(broker);
    const draftCred = draft?.credentials && typeof draft.credentials === 'object' ? draft.credentials : {};
    const baseCred = { ...emptyCredentials(broker), ...(row?.credentials || {}) };
    const mergedMobile = String(baseCred.mobile || draftCred.mobile || '').trim();
    const dhanId =
      broker === 'dhan'
        ? resolveDhanClientIdForSubmit(
            row?.client_id || draft?.client_id,
            mergedMobile || draftCred.mobile || baseCred.mobile,
          )
        : String(row?.client_id || draft?.client_id || '').trim();
    return {
      ...row,
      client_id: dhanId,
      credentials: {
        ...baseCred,
        mobile: broker === 'dhan' ? '' : mergedMobile,
        api_key: String(baseCred.api_key || draftCred.api_key || '').trim(),
        api_secret: String(baseCred.api_secret || draftCred.api_secret || '').trim(),
      },
    };
  }, [readBrokerDraft]);

  const loadBrokerRows = useCallback(async () => {
    try {
      const data = await fetchBrokerSetup({ userId });
      setRows(
        (Array.isArray(data) ? data : []).map((row) => applyDraftToRow({
          ...row,
          credentials: emptyCredentials(row.broker),
        }))
      );
    } catch (_) {
      setRows([]);
    }
  }, [userId, applyDraftToRow]);

  const loadAiKeys = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetchAiApiKeys();
      setAiKeys(Array.isArray(res?.data) ? res.data : []);
    } catch (_) {
      setAiKeys([]);
    }
  }, [userId]);

  const loadLiveData = useCallback(async () => {
    setError('');
    const b = String(selectedBroker || 'dhan').toLowerCase();
    const lsKey = (kind) => `broker_live_${kind}_${b}_${userId}`;
    try {
      if (b === 'dhan') {
        const [posResult, holdResult, ordResult] = await Promise.allSettled([
          fetchDhanPositions({ userId }),
          fetchDhanHoldings({ userId }),
          fetchDhanOrders({ userId }),
        ]);
        const parsedPositions = posResult.status === 'fulfilled' ? pickArray(posResult.value) : [];
        const parsedHoldings = holdResult.status === 'fulfilled' ? pickArray(holdResult.value) : [];
        const parsedOrders = ordResult.status === 'fulfilled' ? pickArray(ordResult.value) : [];
        const mergedPositionsRaw = [...parsedPositions, ...parsedHoldings];
        const mergedPositions = mergedPositionsRaw.length ? mergedPositionsRaw : deriveOpenPositionsFromOrders(parsedOrders);
        setPositions(mergedPositions);
        setOrders(parsedOrders);
        try {
          localStorage.setItem(lsKey('positions'), JSON.stringify(mergedPositions));
          localStorage.setItem(lsKey('orders'), JSON.stringify(parsedOrders));
          localStorage.setItem(`${lsKey('sync')}`, String(Date.now()));
        } catch (_) {
          // ignore localStorage failures
        }
        if (!mergedPositions.length && !parsedOrders.length) {
          setMessage('Session active. No open positions/holdings found for this account.');
        } else if (!mergedPositionsRaw.length && mergedPositions.length) {
          setMessage(`Session active. Positions reconstructed from ${parsedOrders.length} Dhan orders.`);
        }
        return;
      }

      if (b === 'angelone') {
        const [posResult, holdResult, ordResult] = await Promise.allSettled([
          fetchAngelonePositions({ userId }),
          fetchAngeloneHoldings({ userId }),
          fetchAngeloneOrders({ userId }),
        ]);
        const parsedPositions = posResult.status === 'fulfilled' ? pickArray(posResult.value) : [];
        const parsedHoldings = holdResult.status === 'fulfilled' ? pickArray(holdResult.value) : [];
        const parsedOrders = ordResult.status === 'fulfilled' ? pickArray(ordResult.value) : [];
        const mergedPositionsRaw = [...parsedPositions, ...parsedHoldings];
        const mergedPositions = mergedPositionsRaw.length ? mergedPositionsRaw : deriveOpenPositionsFromOrders(parsedOrders);
        setPositions(mergedPositions);
        setOrders(parsedOrders);
        try {
          localStorage.setItem(lsKey('positions'), JSON.stringify(mergedPositions));
          localStorage.setItem(lsKey('orders'), JSON.stringify(parsedOrders));
        } catch (_) {
          // ignore
        }
        if (!mergedPositions.length && !parsedOrders.length) {
          setMessage('Session active. No open positions/holdings found for this Angel One account.');
        } else if (!mergedPositionsRaw.length && mergedPositions.length) {
          setMessage(`Session active. Positions reconstructed from ${parsedOrders.length} Angel One orders.`);
        }
        return;
      }

      {
        const slices = await loadRestBrokerPortfolioSlices(b, userId);
        if (slices) {
          const [posResult, holdResult, ordResult] = slices;
          const pv = posResult.status === 'fulfilled' ? posResult.value : {};
          const hv = holdResult.status === 'fulfilled' ? holdResult.value : {};
          const ov = ordResult.status === 'fulfilled' ? ordResult.value : {};
          const parsedPositions = pickArray(pv?.data ?? pv);
          const parsedHoldings = pickArray(hv?.data ?? hv);
          const parsedOrders = pickArray(ov?.data ?? ov);
          const mergedPositionsRaw = [...parsedPositions, ...parsedHoldings];
          const mergedPositions = mergedPositionsRaw.length ? mergedPositionsRaw : deriveOpenPositionsFromOrders(parsedOrders);
          setPositions(mergedPositions);
          setOrders(parsedOrders);
          const note = String(pv?.message || hv?.message || ov?.message || '').trim();
          if (note) {
            setMessage(note);
          } else if (!mergedPositions.length && !parsedOrders.length) {
            setMessage(`No portfolio rows returned for ${BROKER_LABELS[b] || b}.`);
          }
          return;
        }
      }

      setPositions([]);
      setOrders([]);
    } catch (e) {
      setError(e?.message || `Failed to fetch live data for ${BROKER_LABELS[b] || b}`);
    }
  }, [selectedBroker, userId]);

  useEffect(() => {
    if (!userId || activeTab !== 'broker') return;
    const r = rows.find((x) => String(x.broker) === String(selectedBroker));
    if (!r?.has_session) {
      setPositions([]);
      setOrders([]);
      return;
    }
    loadLiveData();
  }, [selectedBroker, userId, activeTab, rows, loadLiveData]);

  useEffect(() => {
    loadBrokerRows();
  }, [loadBrokerRows]);

  useEffect(() => {
    brokerSelectInitializedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!rows.length) {
      brokerSelectInitializedRef.current = false;
      return;
    }
    if (brokerSelectInitializedRef.current) return;
    brokerSelectInitializedRef.current = true;
    const livePriority = ['dhan', 'angelone', 'samco', 'upstox', 'kotak', 'fyers', 'zerodha'];
    const withLive = livePriority
      .map((b) => rows.find((r) => String(r.broker || '').toLowerCase() === b && brokerRowHasLiveTradingSession(r)))
      .find(Boolean);
    if (withLive?.broker) {
      setSelectedBroker(String(withLive.broker));
      return;
    }
    const prioritized = ['angelone', 'samco', 'upstox', 'kotak', 'fyers', 'zerodha', 'dhan'];
    const pick = prioritized
      .map((b) => rows.find((r) => String(r.broker || '').toLowerCase() === b))
      .find(Boolean);
    if (pick?.broker) setSelectedBroker(String(pick.broker));
  }, [rows]);

  useEffect(() => {
    loadAiKeys();
  }, [loadAiKeys]);

  useEffect(() => {
    if (!onboardingBrokerSetup) return;
    setActiveTab('broker');
    if (onboardingPreferredBroker && PROFILE_BROKER_TABS_ORDER.includes(onboardingPreferredBroker)) {
      setSelectedBroker(onboardingPreferredBroker);
      brokerSelectInitializedRef.current = true;
    }
    setMessage('Complete broker validation to activate session and show holdings on dashboard.');
  }, [onboardingBrokerSetup, onboardingPreferredBroker, setActiveTab]);

  useEffect(() => {
    setBrokerSecretVisible({ pin: false, api_secret: false });
  }, [selectedBroker]);

  useEffect(() => {
    if (!userId) return;
    const broker = String(selectedBroker || '').trim().toLowerCase();
    if (!broker || !PROFILE_BROKER_TABS_ORDER.includes(broker)) return;
    try {
      localStorage.setItem(`broker_preferred_${userId}`, broker);
    } catch (_) {
      // ignore storage failures
    }
  }, [selectedBroker, userId]);

  useEffect(() => {
    setShowAccountPassword(false);
  }, [activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const tokenId = String(params.get('tokenId') || '').trim();
    if (!tokenId || !userId) return;

    let cancelled = false;
    const finishConsentLogin = async () => {
      setBusy(true);
      setActiveTab('broker');
      setError('');
      setMessage('Completing Dhan login from callback token...');
      try {
        let pending = {};
        try {
          pending = JSON.parse(sessionStorage.getItem(`dhan_pending_connect_${userId}`) || '{}');
        } catch (_) {
          pending = {};
        }
        let draftParsed = {};
        try {
          draftParsed = JSON.parse(localStorage.getItem(`broker_integration_draft_${userId}_dhan`) || '{}');
        } catch (_) {
          draftParsed = {};
        }
        const dCred =
          draftParsed?.credentials && typeof draftParsed.credentials === 'object'
            ? draftParsed.credentials
            : {};
        let clientId = resolveDhanClientIdForSubmit(
          pending?.client_id || draftParsed?.client_id,
          dCred?.mobile,
        );
        const pendingApiKey = String(pending?.api_key || dCred.api_key || '').trim();
        const pendingApiSecret = String(pending?.api_secret || dCred.api_secret || '').trim();
        const connectRes = await connectDhan({
          user_id: userId,
          client_id: clientId,
          token_id: tokenId,
          api_key: pendingApiKey,
          api_secret: pendingApiSecret,
        });
        const token = String(connectRes?.session_token || '').trim();
        if (!token) {
          throw new Error('Dhan callback completed but no access token was returned.');
        }
        if (cancelled) return;
        setRows((prev) => prev.map((r) => (
          r.broker === 'dhan'
            ? { ...r, credentials: { ...(r.credentials || {}), access_token: token } }
            : r
        )));
        try {
          localStorage.setItem(`broker_session_auth_${userId}_dhan`, String(Date.now()));
        } catch (_) {
          // ignore localStorage failures
        }
        setMessage('Dhan session token generated successfully.');
        await loadBrokerRows();
        try {
          sessionStorage.removeItem(`dhan_pending_connect_${userId}`);
        } catch (_) {
          // ignore storage failures
        }
        navigate('/profile', { replace: true });
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to consume Dhan callback token.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    finishConsentLogin();

    return () => {
      cancelled = true;
    };
  }, [location.search, navigate, userId, loadBrokerRows, setActiveTab]);

  const updateRow = (broker, patch) => {
    setRows((prev) => {
      let next;
      const index = prev.findIndex((r) => r.broker === broker);
      if (index >= 0) {
        next = prev.map((r) => (r.broker === broker ? { ...r, ...patch } : r));
      } else {
        next = [
          ...prev,
          {
            broker,
            client_id: '',
            is_enabled: false,
            has_session: false,
            live_enabled: false,
            credentials: emptyCredentials(broker),
            ...patch,
          },
        ];
      }
      const updated = next.find((r) => r.broker === broker);
      if (updated) persistBrokerDraftForRow(updated);
      return next;
    });
  };

  const updateRowCredential = (broker, key, value) => {
    setRows((prev) => {
      let next;
      const index = prev.findIndex((r) => r.broker === broker);
      if (index >= 0) {
        next = prev.map((r) => (
          r.broker === broker
            ? { ...r, credentials: { ...(r.credentials || {}), [key]: value } }
            : r
        ));
      } else {
        next = [
          ...prev,
          {
            broker,
            client_id: '',
            is_enabled: false,
            has_session: false,
            live_enabled: false,
            credentials: { ...emptyCredentials(broker), [key]: value },
          },
        ];
      }
      const updated = next.find((r) => r.broker === broker);
      if (updated) persistBrokerDraftForRow(updated);
      return next;
    });
  };

  const onSaveBroker = async (row) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        user_id: userId,
        broker: row.broker,
        client_id: (row.client_id || ''),
        is_enabled: Boolean(row?.is_enabled),
        has_session: Boolean(row?.has_session),
      };
      await saveBrokerSetup(payload);
      setMessage(`${row.broker.toUpperCase()} setup saved.`);
      await loadBrokerRows();
    } catch (e) {
      setError(e?.message || 'Failed to save broker setup');
    } finally {
      setBusy(false);
    }
  };

  const onValidateBroker = async (row) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const resolvedClientId = row.broker === 'dhan'
        ? resolveDhanClientIdForSubmit(row.client_id, row.credentials?.mobile)
        : String(row.client_id || '').trim();
      const payload = {
        user_id: userId,
        broker: row.broker,
        client_id: resolvedClientId,
        pin: (row.credentials?.pin || '').trim(),
        totp: (row.credentials?.totp || '').replace(/\s/g, '').trim(),
        api_key: (row.credentials?.api_key || '').trim(),
        api_secret: (row.credentials?.api_secret || '').trim(),
        token_id: (row.credentials?.token_id || '').trim(),
        client_secret: (row.credentials?.client_secret || '').trim(),
        redirect_uri: (row.credentials?.redirect_uri || '').trim(),
        auth_code: (row.credentials?.auth_code || '').trim(),
        access_token: (row.credentials?.access_token || '').trim(),
      };
      // Guard against browser autofill pollution (email/password landing in broker fields).
      if (row.broker === 'dhan') {
        const hasDhanOAuthInputs = Boolean(payload.client_id || payload.token_id || payload.api_key || payload.api_secret);
        if (hasDhanOAuthInputs) {
          if (!payload.client_id) {
            throw new Error('Dhan Client ID is required for API token generation/consent flow.');
          }
          if (!/^\d{5,16}$/.test(String(payload.client_id))) {
            throw new Error('Dhan Client ID must be the numeric dhanClientId from web.dhan.co (5–16 digits only, not an email).');
          }
          if (!payload.api_key) {
            throw new Error('Dhan App ID/API Key is required for API token generation/consent flow.');
          }
          if (!payload.api_secret) {
            throw new Error('Dhan API Secret is required for API token generation/consent flow.');
          }
        }
        if (payload.api_key && payload.api_key.includes('@')) {
          throw new Error('Dhan App ID/API Key cannot be an email. Enter the API Key from Dhan Access DhanHQ APIs.');
        }
        if (payload.pin && !/^\d{4,8}$/.test(payload.pin)) {
          throw new Error('Dhan PIN must be numeric (typically 4 digits).');
        }
        if (payload.totp && !/^\d{6}$/.test(payload.totp)) {
          throw new Error('Dhan TOTP must be 6 digits.');
        }
        if (payload.client_id && !/^\d{5,16}$/.test(String(payload.client_id))) {
          throw new Error('Dhan Client ID must be numeric (5–16 digits from web.dhan.co), not an email or text.');
        }
      }
      if (row.broker === 'angelone' || row.broker === 'kotak') {
        if (payload.api_key && payload.api_key.includes('@')) {
          throw new Error(`${BROKER_LABELS[row.broker] || row.broker} API key cannot be an email.`);
        }
        if (payload.pin && !/^\d{4,8}$/.test(payload.pin)) {
          throw new Error(`${BROKER_LABELS[row.broker] || row.broker} PIN must be numeric.`);
        }
        if (payload.totp && !/^\d{6}$/.test(payload.totp)) {
          throw new Error(`${BROKER_LABELS[row.broker] || row.broker} TOTP must be 6 digits.`);
        }
      }
      if (row.broker === 'fyers' || row.broker === 'zerodha') {
        if (payload.api_key && payload.api_key.includes('@')) {
          throw new Error('App API key cannot be an email.');
        }
      }
      if (!Boolean(row?.is_enabled)) {
        await onSaveBroker({ ...row, is_enabled: false });
        setMessage(`${row.broker.toUpperCase()} saved for later. Enable integration when ready.`);
        return;
      }
      let res = null;
      let validated = false;
      let effectiveToken = payload.access_token;
      if (row.broker === 'dhan') {
        const tokenFromCallback = String(payload.token_id || '').trim();
        if (!tokenFromCallback) {
          const blockedToday = localStorage.getItem(consentBlockKeyForToday(userId)) === '1';
          if (blockedToday) {
            throw new Error(
              `Dhan allows maximum ${DHAN_DAILY_CONSENT_LIMIT} consent logins per day. Limit reached for today; please retry tomorrow.`
            );
          }
        }
        const draftDhan = readBrokerDraft('dhan');
        const dDraftCred =
          draftDhan?.credentials && typeof draftDhan.credentials === 'object' ? draftDhan.credentials : {};
        const mergedDhanApiKey = String(payload.api_key || dDraftCred.api_key || '').trim();
        const mergedDhanApiSecret = String(payload.api_secret || dDraftCred.api_secret || '').trim();
        const mergedDhanClientId = resolveDhanClientIdForSubmit(
          payload.client_id || draftDhan?.client_id,
          dDraftCred.mobile,
        );
        const connectRes = await connectDhan({
          user_id: userId,
          client_id: mergedDhanClientId,
          pin: payload.pin,
          totp: payload.totp,
          access_token: payload.access_token,
          api_key: mergedDhanApiKey,
          api_secret: mergedDhanApiSecret,
          token_id: payload.token_id,
        });
        if (connectRes?.requires_token_id && connectRes?.login_url) {
          try {
            sessionStorage.setItem(
              `dhan_pending_connect_${userId}`,
              JSON.stringify({
                client_id: String(connectRes?.client_id || mergedDhanClientId || '').trim(),
                api_key: mergedDhanApiKey,
                api_secret: mergedDhanApiSecret,
              })
            );
          } catch (_) {
            // ignore storage failures
          }
          setMessage(connectRes?.message || `Complete Dhan browser login and return to ${connectRes?.redirect_url || 'the callback URL'} with tokenId.`);
          window.location.assign(connectRes.login_url);
          return;
        }
        payload.client_id = String(connectRes?.data?.client_id || mergedDhanClientId || '').trim();
        effectiveToken = String(connectRes?.session_token || effectiveToken || '').trim();
        if (!effectiveToken) {
          throw new Error('Unable to create Dhan session token. Check Client ID/PIN/TOTP or JWT token.');
        }
        payload.access_token = effectiveToken;
      }
      res = await validateBrokerSetup(payload);
      validated = Boolean(res?.validated);
      if (row.broker === 'dhan' && effectiveToken) {
        updateRowCredential(row.broker, 'access_token', effectiveToken);
      }

      if (validated) {
        setMessage(`${row.broker.toUpperCase()} validation successful.`);
        if (row.broker === 'dhan') {
          setRows((prev) => prev.map((r) => (
            r.broker === row.broker
              ? { ...r, has_session: true, is_enabled: true, last_auth_at: new Date().toISOString() }
              : r
          )));
        }
        try {
          localStorage.setItem(brokerSessionKey(row.broker), String(Date.now()));
        } catch (_) {
          // ignore localStorage failures
        }
      } else {
        setError(res?.reason || `${row.broker.toUpperCase()} setup saved. Complete required credentials to activate session.`);
        if (row.broker === 'dhan') {
          setRows((prev) => prev.map((r) => (
            r.broker === row.broker
              ? { ...r, has_session: false }
              : r
          )));
          try {
            localStorage.removeItem(brokerSessionKey(row.broker));
          } catch (_) {
            // ignore localStorage failures
          }
        }
      }

      await loadBrokerRows();
      if (validated) {
        await loadLiveData();
      }
      if (validated && onboardingBrokerSetup) {
        navigate(onboardingTargetPath, { replace: true, state: { brokerSetupCompleted: true } });
      }
    } catch (e) {
      if (row.broker === 'dhan') {
        const msg = String(e?.message || '');
        if (msg.toUpperCase().includes('CONSENT_LIMIT_EXCEED') || msg.toLowerCase().includes('consent limit')) {
          try {
            localStorage.setItem(consentBlockKeyForToday(userId), '1');
          } catch (_) {
            // ignore storage failures
          }
        }
      }
      setError(e?.message || `Validation failed for ${row.broker}`);
    } finally {
      setBusy(false);
    }
  };

  const onRenewBrokerToken = async (row) => {
    if (!row) return;
    const b = String(row.broker || '').toLowerCase();
    const restEnsureByBroker = {
      kotak: ensureKotakBrokerSession,
      fyers: ensureFyersBrokerSession,
      zerodha: ensureZerodhaBrokerSession,
    };
    if (b !== 'dhan' && b !== 'angelone' && !restEnsureByBroker[b]) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (b === 'dhan') {
        const res = await connectDhan({
          user_id: userId,
          client_id: resolveDhanClientIdForSubmit(row.client_id, row.credentials?.mobile),
          access_token: String(row.credentials?.access_token || '').trim(),
          renew_token: true,
        });
        const renewedToken = String(res?.session_token || '').trim();
        if (renewedToken) {
          updateRowCredential(row.broker, 'access_token', renewedToken);
        }
        setMessage('Dhan access token renewed successfully.');
      } else if (b === 'angelone') {
        await ensureAngeloneSession({ user_id: userId });
        setMessage('Angel One session refreshed (token rotation when supported).');
      } else if (restEnsureByBroker[b]) {
        await restEnsureByBroker[b]({ user_id: userId });
        setMessage(`${BROKER_LABELS[b] || b} session refreshed (when supported by the server).`);
      }
      await loadBrokerRows();
      await loadLiveData();
    } catch (e) {
      setError(e?.message || `Failed to refresh ${BROKER_LABELS[b] || b} session`);
    } finally {
      setBusy(false);
    }
  };

  const positionColumns = useMemo(() => {
    if (!positions.length) return [];
    const preferred = ['securityId', 'tradingSymbol', 'productType', 'netQty', 'buyAvg', 'sellAvg', 'ltp', 'pnl'];
    const presentPreferred = preferred.filter((k) => Object.prototype.hasOwnProperty.call(positions[0], k));
    if (presentPreferred.length) return presentPreferred;
    return Object.keys(positions[0]).slice(0, 8);
  }, [positions]);

  const orderColumns = useMemo(() => {
    if (!orders.length) return [];
    const preferred = ['orderId', 'tradingSymbol', 'transactionType', 'orderType', 'quantity', 'price', 'orderStatus'];
    const presentPreferred = preferred.filter((k) => Object.prototype.hasOwnProperty.call(orders[0], k));
    if (presentPreferred.length) return presentPreferred;
    return Object.keys(orders[0]).slice(0, 8);
  }, [orders]);

  const brokerRows = useMemo(() => {
    const fallback = PROFILE_BROKER_TABS_ORDER.map((broker) => ({
      broker,
      client_id: '',
      is_enabled: false,
      has_session: false,
      live_enabled: false,
      daily_session_ok: false,
      token_stored: false,
      credentials: emptyCredentials(broker),
    }));
    if (!rows.length) return fallback.map((row) => applyDraftToRow(row));
    const byBroker = new Map(rows.map((r) => [r.broker, r]));
    return PROFILE_BROKER_TABS_ORDER.map((broker) => {
      const row = byBroker.get(broker);
      return row
        ? applyDraftToRow({ ...row, credentials: row.credentials || emptyCredentials(broker) })
        : applyDraftToRow({
            broker,
            client_id: '',
            is_enabled: false,
            has_session: false,
            live_enabled: false,
            daily_session_ok: false,
            token_stored: false,
            credentials: emptyCredentials(broker),
          });
    });
  }, [rows, applyDraftToRow]);

  const activeBrokerRow = useMemo(
    () => brokerRows.find((r) => r.broker === selectedBroker) || brokerRows[0] || null,
    [brokerRows, selectedBroker]
  );
  const hasBrokerCredentials = useMemo(() => {
    if (!activeBrokerRow) return false;
    const broker = String(activeBrokerRow.broker || '').toLowerCase();
    const clientId =
      broker === 'dhan'
        ? resolveDhanClientIdForSubmit(activeBrokerRow.client_id, activeBrokerRow.credentials?.mobile)
        : String(activeBrokerRow.client_id || activeBrokerRow.credentials?.mobile || '').trim();
    const pin = String(activeBrokerRow.credentials?.pin || '').trim();
    const totp = String(activeBrokerRow.credentials?.totp || '').trim();
    const accessToken = String(activeBrokerRow.credentials?.access_token || '').trim();
    const apiKey = String(activeBrokerRow.credentials?.api_key || '').trim();
    const apiSecret = String(activeBrokerRow.credentials?.api_secret || '').trim();
    const authCode = String(activeBrokerRow.credentials?.auth_code || '').trim();
    const clientSecret = String(activeBrokerRow.credentials?.client_secret || '').trim();
    const redirectUri = String(activeBrokerRow.credentials?.redirect_uri || '').trim();

    if (broker === 'dhan') return Boolean(clientId && ((pin && totp) || accessToken || (apiKey && apiSecret)));
    // Samco live data uses server SAMCO_* env (Trade API); Validate calls server login — no per-user secrets required in UI.
    if (broker === 'samco') return true;
    if (broker === 'angelone' || broker === 'kotak') {
      return Boolean(clientId && ((apiKey && pin && totp) || accessToken));
    }
    if (broker === 'upstox') return Boolean(clientId && (accessToken || (authCode && clientSecret && redirectUri)));
    if (broker === 'fyers') {
      return Boolean(accessToken || (authCode && redirectUri && apiKey && apiSecret));
    }
    if (broker === 'zerodha') {
      return Boolean(accessToken || (authCode && apiKey && apiSecret));
    }
    return Boolean(clientId);
  }, [activeBrokerRow]);

  const setAiDraft = (provider, value) => {
    setAiKeyDrafts((prev) => ({ ...prev, [provider]: value }));
  };

  const onSaveAiKey = async (provider, isActive) => {
    const providerKey = String(provider || '').toLowerCase();
    const draftValue = String(aiKeyDrafts?.[providerKey] || '').trim();
    if (!draftValue) {
      setError(`Enter ${providerKey.toUpperCase()} API key before saving.`);
      return;
    }
    setAiBusy(true);
    setError('');
    setMessage('');
    try {
      await saveAiApiKey(providerKey, draftValue, isActive);
      setAiDraft(providerKey, '');
      await loadAiKeys();
      setMessage(`${providerKey.toUpperCase()} API key saved.`);
    } catch (e) {
      setError(e?.message || `Failed to save ${providerKey.toUpperCase()} API key.`);
    } finally {
      setAiBusy(false);
    }
  };

  const onToggleAiStatus = async (provider, nextActive) => {
    const providerKey = String(provider || '').toLowerCase();
    setAiBusy(true);
    setError('');
    setMessage('');
    try {
      await setAiApiKeyStatus(providerKey, nextActive);
      await loadAiKeys();
      setMessage(`${providerKey.toUpperCase()} key ${nextActive ? 'enabled' : 'disabled'}.`);
    } catch (e) {
      setError(e?.message || `Failed to update ${providerKey.toUpperCase()} key status.`);
    } finally {
      setAiBusy(false);
    }
  };

  const onDeleteAiKey = async (provider) => {
    const providerKey = String(provider || '').toLowerCase();
    setAiBusy(true);
    setError('');
    setMessage('');
    try {
      await deleteAiApiKey(providerKey);
      setAiDraft(providerKey, '');
      await loadAiKeys();
      setMessage(`${providerKey.toUpperCase()} API key removed.`);
    } catch (e) {
      setError(e?.message || `Failed to delete ${providerKey.toUpperCase()} API key.`);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Profile
      </Typography>
      <UpgradeToPremiumBanner />
      {paidPremiumLapsed ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your paid premium period has ended. This account is on the <strong>basic</strong> plan until your
          administrator confirms renewal.
        </Alert>
      ) : null}
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}
      >
        <Tab value="account" label="Account Details" />
        <Tab value="broker" label="Broker Integration" />
        <Tab value="pricing" label="Pricing" />
        <Tab value="features" label="Features" />
      </Tabs>

      {activeTab === 'account' ? (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>User Profile</Typography>
            <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
              <TextField size="small" label="Name" value={displayName} disabled />
              <TextField size="small" label="Email ID" value={displayEmail} disabled />
              <TextField size="small" label="Mobile Number" value={displayMobile} disabled />
              {showAccountPassword ? (
                <TextField
                  key="profile-pw-shown"
                  size="small"
                  label="Password"
                  name="profile-password-placeholder-shown"
                  value="********"
                  type="text"
                  autoComplete="off"
                  inputProps={{
                    readOnly: true,
                    'aria-label': 'Password placeholder (visible)',
                    spellCheck: false,
                  }}
                  sx={{
                    '& .MuiInputBase-root': { bgcolor: 'action.hover' },
                    '& .MuiInputBase-input': { cursor: 'default', fontFamily: 'ui-monospace, monospace' },
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="Hide placeholder"
                          edge="end"
                          size="small"
                          onClick={() => setShowAccountPassword(false)}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <MdVisibility size={22} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              ) : (
                <TextField
                  key="profile-pw-hidden"
                  size="small"
                  label="Password"
                  name="profile-password-placeholder-hidden"
                  value="********"
                  type="password"
                  autoComplete="new-password"
                  inputProps={{
                    readOnly: true,
                    'aria-label': 'Password (masked placeholder)',
                    spellCheck: false,
                  }}
                  sx={{
                    '& .MuiInputBase-root': { bgcolor: 'action.hover' },
                    '& .MuiInputBase-input': { cursor: 'default' },
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="Show placeholder characters"
                          edge="end"
                          size="small"
                          onClick={() => setShowAccountPassword(true)}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <MdVisibilityOff size={22} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <Button
                variant="contained"
                sx={{ textTransform: 'none' }}
                onClick={() => navigate('/forgot-password')}
              >
                Change Password
              </Button>
            </Box>
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>AI API Keys</Typography>
            <Typography sx={{ fontSize: 12, color: '#666', mb: 1.5 }}>
              Review saved keys in masked form, rotate them, and keep providers enabled or disabled for later use.
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Provider</TableCell>
                    <TableCell>Saved Key</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell>New / Rotate Key</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aiRows.map((row) => {
                    const provider = String(row.provider || '').toLowerCase();
                    return (
                      <TableRow key={provider}>
                        <TableCell sx={{ fontWeight: 700 }}>{provider.toUpperCase()}</TableCell>
                        <TableCell>{row.has_key ? (row.masked_key || '****') : 'Not configured'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.has_key ? (row.is_active ? 'Enabled' : 'Disabled') : 'Not set'}
                            color={row.has_key ? (row.is_active ? 'success' : 'default') : 'default'}
                            variant={row.is_active ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell>{row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type={aiKeyShowPassword[provider] ? 'text' : 'password'}
                            placeholder={`Enter ${provider.toUpperCase()} key`}
                            value={aiKeyDrafts?.[provider] || ''}
                            onChange={(e) => setAiDraft(provider, e.target.value)}
                            sx={{ minWidth: 260 }}
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton
                                    aria-label={aiKeyShowPassword[provider] ? 'Hide API key' : 'Show API key'}
                                    edge="end"
                                    size="small"
                                    onClick={() =>
                                      setAiKeyShowPassword((prev) => ({
                                        ...prev,
                                        [provider]: !prev[provider],
                                      }))
                                    }
                                    onMouseDown={(e) => e.preventDefault()}
                                  >
                                    {aiKeyShowPassword[provider] ? (
                                      <MdVisibilityOff size={22} />
                                    ) : (
                                      <MdVisibility size={22} />
                                    )}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="contained"
                              disabled={aiBusy}
                              onClick={() => onSaveAiKey(provider, Boolean(row.is_active || !row.has_key))}
                              sx={{ textTransform: 'none' }}
                            >
                              Save
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={aiBusy || !row.has_key}
                              onClick={() => onToggleAiStatus(provider, !Boolean(row.is_active))}
                              sx={{ textTransform: 'none' }}
                            >
                              {row.is_active ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              disabled={aiBusy || !row.has_key}
                              onClick={() => onDeleteAiKey(provider)}
                              sx={{ textTransform: 'none' }}
                            >
                              Delete
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : null}

      {activeTab === 'pricing' ? (
        <Box sx={{ py: 0.5 }}>
          <PricingMarketingContent />
        </Box>
      ) : null}

      {activeTab === 'features' ? (
        <Box sx={{ py: 0.5, maxWidth: 1000, mx: 'auto' }}>
          <FeaturesMarketingContent />
        </Box>
      ) : null}

      {activeTab === 'broker' ? (
        <>
      {onboardingBrokerSetup ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography component="span" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            API access and IPv4 allowlisting
          </Typography>
          Most brokers only accept API traffic from approved networks. In your broker&apos;s developer or API
          console, <strong>enable API / algo access</strong> and register this deployment&apos;s{' '}
          <strong>public IPv4 address</strong> (static IP allowlist / whitelist). Without that, validation and live
          calls from our servers may fail even if your credentials are correct. Use each broker&apos;s official
          documentation (listed below) for keys, consent, and IP rules.
        </Alert>
      ) : null}
      {isAdmin ? (
        <Alert severity={liveEnabledCount > 0 ? 'success' : 'info'} sx={{ mb: 2 }}>
          Live execution: {liveEnabledCount > 0 ? `${liveEnabledCount} broker session(s) active.` : 'Activate broker session to place live orders.'}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          component="form"
          autoComplete="off"
          noValidate
          onSubmit={(e) => e.preventDefault()}
        >
        <Typography sx={{ fontSize: 13, color: '#555', mb: 1.5 }}>
          Select your broker, enter only the required fields for that broker, validate, and keep integration enabled now or later.
        </Typography>
        <Alert severity="info" variant="outlined" sx={{ mb: 1.5, py: 1.25 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 13, mb: 0.75 }}>
            Official setup and API documentation (per broker)
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#555', mb: 1, lineHeight: 1.45 }}>
            Each vendor documents app registration, authentication (including OTP/TOTP where applicable), and any
            static IPv4 or API allowlisting. Open the guide for the broker you are configuring.
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.25, fontSize: 12.5, lineHeight: 1.5 }}>
            {PROFILE_BROKER_TABS_ORDER.map((bid) => (
              <Box component="li" key={bid} sx={{ mb: 0.35 }}>
                <Link href={BROKER_SETUP_DOC_URLS[bid]} target="_blank" rel="noreferrer" sx={{ fontWeight: 600 }}>
                  {BROKER_LABELS[bid] || bid}
                </Link>
                <Typography component="span" sx={{ fontSize: 12, color: '#666' }}>
                  {' — '}
                  setup, API keys, and connectivity requirements on the broker&apos;s site
                </Typography>
              </Box>
            ))}
          </Box>
        </Alert>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 1.5 }}>
          <TextField
            select
            size="small"
            label="Select Broker"
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {brokerRows.map((row) => (
              <MenuItem key={row.broker} value={row.broker}>{row.broker.toUpperCase()}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={loadBrokerRows} disabled={busy} sx={{ textTransform: 'none' }}>
            Refresh Broker Setup
          </Button>
        </Stack>

        {activeBrokerRow ? (
          <>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 1.2 }}>
              <TextField
                size="small"
                label={activeBrokerRow.broker === 'dhan' ? 'Dhan Client ID (numeric dhanClientId)' : 'Client ID'}
                value={activeBrokerRow.client_id || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (activeBrokerRow.broker === 'dhan') {
                    updateRow(activeBrokerRow.broker, { client_id: v.replace(/\D/g, '').slice(0, 16) });
                  } else {
                    updateRow(activeBrokerRow.broker, { client_id: v });
                  }
                }}
                sx={{ minWidth: 260 }}
                autoComplete="off"
                inputProps={{
                  ...brokerLockedInputProps(`broker_${activeBrokerRow.broker}_client_id`),
                  ...(activeBrokerRow.broker === 'dhan'
                    ? { inputMode: 'numeric', pattern: '[0-9]*' }
                    : {}),
                }}
                helperText={
                  activeBrokerRow.broker === 'dhan'
                    ? 'Digits only — copy the numeric Client ID from web.dhan.co (not your email).'
                    : undefined
                }
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 12, color: '#666' }}>Enable now</Typography>
                <Switch
                  checked={Boolean(activeBrokerRow.is_enabled)}
                  onChange={(e) => updateRow(activeBrokerRow.broker, { is_enabled: e.target.checked })}
                />
                <Typography sx={{ fontSize: 12, color: activeBrokerRow.is_enabled ? '#1b5e20' : '#666', fontWeight: 600 }}>
                  {activeBrokerRow.is_enabled ? 'Enabled' : 'Enable later'}
                </Typography>
              </Stack>
            </Stack>

            <Box sx={{ display: 'grid', gap: 1.1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, mb: 1.2 }}>
              {activeBrokerRow.broker === 'dhan' ? (
                <>
                  <Typography sx={{ fontSize: 12, color: '#666', gridColumn: '1 / -1', lineHeight: 1.45 }}>
                    OAuth consent uses your numeric Client ID plus App ID and App Secret from Dhan → My Profile → Access DhanHQ APIs.{' '}
                    <Link href={BROKER_SETUP_DOC_URLS.dhan} target="_blank" rel="noreferrer">DhanHQ API setup documentation</Link>
                  </Typography>
                  <TextField
                    size="small"
                    type="text"
                    label="PIN / Password"
                    value={activeBrokerRow.credentials?.pin || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)}
                    InputProps={brokerSecretAdornment('pin')}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_dhan_pin', { secret: true })}
                    sx={brokerPinMaskSx(brokerSecretVisible.pin)}
                  />
                  <TextField
                    size="small"
                    label="TOTP"
                    value={activeBrokerRow.credentials?.totp || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'totp', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_dhan_totp')}
                  />
                  <TextField
                    size="small"
                    label="App ID (API Key from Dhan)"
                    value={activeBrokerRow.credentials?.api_key || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_key', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_dhan_api_key')}
                  />
                  <TextField
                    size="small"
                    type="text"
                    label="App Secret (from Dhan)"
                    value={activeBrokerRow.credentials?.api_secret || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_secret', e.target.value)}
                    InputProps={brokerSecretAdornment('api_secret')}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_dhan_api_secret', { secret: true })}
                    sx={brokerPinMaskSx(brokerSecretVisible.api_secret)}
                    helperText="Required for Dhan API token/consent flow. Paste exactly as shown in Dhan (any characters Dhan provides)."
                  />
                  <TextField
                    size="small"
                    label="tokenId (after Dhan redirect)"
                    value={activeBrokerRow.credentials?.token_id || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'token_id', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_dhan_token_id')}
                  />
                  <TextField
                    size="small"
                    label="Access Token (JWT optional)"
                    value={activeBrokerRow.credentials?.access_token || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)}
                    placeholder="Use Dhan JWT token if available"
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_dhan_access_token')}
                  />
                </>
              ) : null}
              {activeBrokerRow.broker === 'samco' ? (
                <>
                  <Typography sx={{ fontSize: 12, color: '#666', gridColumn: '1 / -1', lineHeight: 1.45 }}>
                    Samco market and session checks use the server&apos;s <code>SAMCO_*</code> environment variables (Trade API: password, YOB, secret key or daily access token). Use super-admin{' '}
                    <code>POST /api/system/samco/*</code> for IP registration and OTP onboarding. Optional fields below are for your records; <strong>Validate &amp; Create Session</strong> runs{' '}
                    <code>SamcoClient.login()</code> on the server. Follow{' '}
                    <Link href={BROKER_SETUP_DOC_URLS.samco} target="_blank" rel="noreferrer">Samco Trade API documentation</Link>
                    {' '}for gateway access, OTP, and static IP rules.
                  </Typography>
                  <TextField
                    size="small"
                    type="text"
                    label="PIN/Password (optional, not sent to Samco from here)"
                    value={activeBrokerRow.credentials?.pin || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)}
                    InputProps={brokerSecretAdornment('pin')}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_samco_pin', { secret: true })}
                    sx={brokerPinMaskSx(brokerSecretVisible.pin)}
                  />
                  <TextField
                    size="small"
                    label="Access Token (optional, not used for server login)"
                    value={activeBrokerRow.credentials?.access_token || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_samco_access_token')}
                  />
                </>
              ) : null}
              {activeBrokerRow.broker === 'angelone' ? (
                <>
                  <TextField
                    size="small"
                    label="Access Token (optional)"
                    value={activeBrokerRow.credentials?.access_token || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_angel_access_token')}
                  />
                  <TextField
                    size="small"
                    label="API Key"
                    value={activeBrokerRow.credentials?.api_key || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_key', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_angel_smartapi_key')}
                  />
                  <TextField
                    size="small"
                    type="text"
                    label="PIN/Password"
                    value={activeBrokerRow.credentials?.pin || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)}
                    InputProps={brokerSecretAdornment('pin')}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_angel_pin', { secret: true })}
                    sx={brokerPinMaskSx(brokerSecretVisible.pin)}
                  />
                  <TextField
                    size="small"
                    label="TOTP"
                    value={activeBrokerRow.credentials?.totp || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'totp', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_angel_totp')}
                  />
                  <Typography sx={{ fontSize: 11, color: '#666', gridColumn: '1 / -1', lineHeight: 1.4 }}>
                    Use the <strong>Published API key</strong> from the Angel One SmartAPI developer console. Retail login does not use a separate client secret; enable <strong>Enable now</strong>, then enter <strong>PIN</strong> and <strong>6-digit TOTP</strong> from the Angel One authenticator app and click Validate. Optional access token is only if you already have a valid JWT. See{' '}
                    <Link href={BROKER_SETUP_DOC_URLS.angelone} target="_blank" rel="noreferrer">Angel One SmartAPI documentation</Link>
                    {' '}for app creation, IP allowlist, and session flow.
                  </Typography>
                </>
              ) : null}
              {activeBrokerRow.broker === 'upstox' ? (
                <>
                  <Typography sx={{ fontSize: 12, color: '#666', gridColumn: '1 / -1', lineHeight: 1.45 }}>
                    OAuth2 redirect flow: create an app, set redirect URI, then exchange auth code for tokens. See{' '}
                    <Link href={BROKER_SETUP_DOC_URLS.upstox} target="_blank" rel="noreferrer">Upstox developer documentation</Link>
                    {' '}for registration, scopes, and IPv4 allowlisting if your account requires it.
                  </Typography>
                  <TextField size="small" label="Access Token (optional)" value={activeBrokerRow.credentials?.access_token || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_upstox_access_token')} />
                  <TextField size="small" label="Auth Code" value={activeBrokerRow.credentials?.auth_code || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'auth_code', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_upstox_auth_code')} />
                  <TextField size="small" label="Client Secret" value={activeBrokerRow.credentials?.client_secret || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'client_secret', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_upstox_client_secret', { secret: true })} />
                  <TextField size="small" label="Redirect URI" value={activeBrokerRow.credentials?.redirect_uri || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'redirect_uri', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_upstox_redirect_uri')} />
                </>
              ) : null}
              {activeBrokerRow.broker === 'kotak' ? (
                <>
                  <Typography sx={{ fontSize: 12, color: '#666', gridColumn: '1 / -1', lineHeight: 1.45 }}>
                    Kotak Neo API credentials follow the client documentation from Kotak (consumer key, PIN, TOTP, or tokens as your integration uses).{' '}
                    <Link href={BROKER_SETUP_DOC_URLS.kotak} target="_blank" rel="noreferrer">Kotak Neo client documentation</Link>
                  </Typography>
                  <TextField
                    size="small"
                    label="Access Token (optional)"
                    value={activeBrokerRow.credentials?.access_token || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_kotak_access_token')}
                  />
                  <TextField
                    size="small"
                    label="API Key"
                    value={activeBrokerRow.credentials?.api_key || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_key', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_kotak_api_key')}
                  />
                  <TextField
                    size="small"
                    type="text"
                    label="PIN"
                    value={activeBrokerRow.credentials?.pin || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'pin', e.target.value)}
                    InputProps={brokerSecretAdornment('pin')}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_kotak_pin', { secret: true })}
                    sx={brokerPinMaskSx(brokerSecretVisible.pin)}
                  />
                  <TextField
                    size="small"
                    label="TOTP"
                    value={activeBrokerRow.credentials?.totp || ''}
                    onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'totp', e.target.value)}
                    autoComplete="off"
                    inputProps={brokerLockedInputProps('broker_kotak_totp')}
                  />
                </>
              ) : null}
              {activeBrokerRow.broker === 'fyers' ? (
                <>
                  <Typography sx={{ fontSize: 12, color: '#666', gridColumn: '1 / -1', lineHeight: 1.45 }}>
                    Fyers API v3 uses OAuth2-style auth: register an app, set the redirect URL, then exchange the auth code for an access token. See{' '}
                    <Link href={BROKER_SETUP_DOC_URLS.fyers} target="_blank" rel="noreferrer">Fyers API v3 documentation</Link>
                    {' '}for request/response structure, auth, and connectivity.
                  </Typography>
                  <TextField size="small" label="App ID (API key)" value={activeBrokerRow.credentials?.api_key || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_key', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_fyers_api_key')} />
                  <TextField size="small" type="text" label="App Secret" value={activeBrokerRow.credentials?.api_secret || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_secret', e.target.value)} InputProps={brokerSecretAdornment('api_secret')} autoComplete="off" inputProps={brokerLockedInputProps('broker_fyers_api_secret', { secret: true })} sx={brokerPinMaskSx(brokerSecretVisible.api_secret)} />
                  <TextField size="small" label="Redirect URI" value={activeBrokerRow.credentials?.redirect_uri || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'redirect_uri', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_fyers_redirect_uri')} />
                  <TextField size="small" label="Auth code" value={activeBrokerRow.credentials?.auth_code || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'auth_code', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_fyers_auth_code')} />
                  <TextField size="small" label="Access token (optional)" value={activeBrokerRow.credentials?.access_token || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_fyers_access_token')} />
                </>
              ) : null}
              {activeBrokerRow.broker === 'zerodha' ? (
                <>
                  <Typography sx={{ fontSize: 12, color: '#666', gridColumn: '1 / -1', lineHeight: 1.45 }}>
                    Zerodha Kite Connect uses your app <code>api_key</code> and <code>api_secret</code>; after the browser login, paste the <code>request_token</code> from the redirect as the auth code. Full setup:{' '}
                    <Link href={BROKER_SETUP_DOC_URLS.zerodha} target="_blank" rel="noreferrer">Kite Connect documentation</Link>.
                  </Typography>
                  <TextField size="small" label="API key (Kite app)" value={activeBrokerRow.credentials?.api_key || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_key', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_zerodha_api_key')} />
                  <TextField size="small" type="text" label="API secret" value={activeBrokerRow.credentials?.api_secret || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'api_secret', e.target.value)} InputProps={brokerSecretAdornment('api_secret')} autoComplete="off" inputProps={brokerLockedInputProps('broker_zerodha_api_secret', { secret: true })} sx={brokerPinMaskSx(brokerSecretVisible.api_secret)} />
                  <TextField size="small" label="Redirect URL (registered on Kite)" value={activeBrokerRow.credentials?.redirect_uri || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'redirect_uri', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_zerodha_redirect_uri')} />
                  <TextField size="small" label="Request token / auth code" value={activeBrokerRow.credentials?.auth_code || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'auth_code', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_zerodha_auth_code')} />
                  <TextField size="small" label="Access token (optional)" value={activeBrokerRow.credentials?.access_token || ''} onChange={(e) => updateRowCredential(activeBrokerRow.broker, 'access_token', e.target.value)} autoComplete="off" inputProps={brokerLockedInputProps('broker_zerodha_access_token')} />
                </>
              ) : null}
            </Box>

            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button size="small" variant="outlined" onClick={() => onSaveBroker(activeBrokerRow)} disabled={busy} sx={{ textTransform: 'none' }}>
                Save
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => onValidateBroker(activeBrokerRow)}
                disabled={busy || !Boolean(activeBrokerRow?.is_enabled) || !hasBrokerCredentials}
                sx={{ textTransform: 'none' }}
              >
                Validate & Create Session
              </Button>
              {activeBrokerRow.broker === 'dhan'
                || activeBrokerRow.broker === 'angelone'
                || activeBrokerRow.broker === 'kotak'
                || activeBrokerRow.broker === 'fyers'
                || activeBrokerRow.broker === 'zerodha' ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onRenewBrokerToken(activeBrokerRow)}
                  disabled={busy || !activeBrokerRow.has_session}
                  sx={{ textTransform: 'none' }}
                >
                  {activeBrokerRow.broker === 'dhan' ? 'Renew Token' : 'Refresh session'}
                </Button>
              ) : null}
              {(activeBrokerRow.doc_url || BROKER_SETUP_DOC_URLS[activeBrokerRow.broker]) ? (
                <Button size="small" component={Link} href={activeBrokerRow.doc_url || BROKER_SETUP_DOC_URLS[activeBrokerRow.broker]} target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>
                  Open docs
                </Button>
              ) : null}
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#666', mb: 1 }}>
              Each <b>IST calendar day</b>, run <b>Validate &amp; Create Session</b> once (PIN, TOTP, or tokens as required by the broker) so the integration is active for that India calendar day. <b>Last auth</b> is always shown in <b>IST</b>.
            </Typography>
            {activeBrokerRow.broker === 'dhan' ? (
              <Typography sx={{ fontSize: 12, color: '#666', mb: 1 }}>
                If Dhan shows a consent redirect, complete it and return to <code>https://localhost:3000/callback</code>.
              </Typography>
            ) : null}
            {!Boolean(activeBrokerRow?.is_enabled) ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                Broker login is disabled by default. Turn on <b>Enable now</b> after entering your broker details.
              </Alert>
            ) : null}
            {Boolean(activeBrokerRow?.is_enabled) && !hasBrokerCredentials ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Enter required broker details to enable <b>Validate &amp; Create Session</b>.
              </Alert>
            ) : null}
            {activeBrokerRow.broker === 'dhan' ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                Dhan allows maximum {DHAN_DAILY_CONSENT_LIMIT} consent logins per day. Reuse the existing session whenever possible.
              </Alert>
            ) : null}
            {activeBrokerRow.token_stored && activeBrokerRow.daily_session_ok === false ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                A broker session is on file, but today&apos;s <b>IST</b> window is not active. Use <b>Validate &amp; Create Session</b> again for the current calendar day in India (credentials / TOTP as your broker requires).
              </Alert>
            ) : null}

            <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
              <Chip size="small" label={activeBrokerRow.has_session ? 'Session active' : 'No session'} color={activeBrokerRow.has_session ? 'success' : 'default'} variant={activeBrokerRow.has_session ? 'filled' : 'outlined'} />
              {isAdmin ? (
                <Chip size="small" label={isLiveExecution(activeBrokerRow) ? 'LIVE enabled' : 'Session required'} color={isLiveExecution(activeBrokerRow) ? 'error' : 'primary'} variant={isLiveExecution(activeBrokerRow) ? 'filled' : 'outlined'} />
              ) : null}
              <Typography sx={{ fontSize: 12, color: '#666', ml: 0.5 }}>
                {activeBrokerRow.last_auth_at
                  ? `Last auth (IST): ${formatLastAuthIST(activeBrokerRow.last_auth_at)}`
                  : 'Validate to create broker session.'}
              </Typography>
            </Stack>
          </>
        ) : null}
        </Box>
      </Paper>

      {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Live Positions</Typography>
        {!positions.length ? (
          <Typography sx={{ fontSize: 13, color: '#666' }}>
            {activeBrokerRow?.has_session
              ? 'No open positions found.'
              : `Validate ${BROKER_LABELS[selectedBroker] || selectedBroker} setup to load positions.`}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {positionColumns.map((c) => <TableCell key={c}>{c}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((row, idx) => (
                  <TableRow key={`pos-${idx}`}>
                    {positionColumns.map((c) => (
                      <TableCell key={`${idx}-${c}`}>{String(row?.[c] ?? '—')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Recent Orders</Typography>
        {!orders.length ? (
          <Typography sx={{ fontSize: 13, color: '#666' }}>
            {activeBrokerRow?.has_session
              ? 'No orders found.'
              : `Validate ${BROKER_LABELS[selectedBroker] || selectedBroker} setup to load orders.`}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {orderColumns.map((c) => <TableCell key={c}>{c}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((row, idx) => (
                  <TableRow key={`ord-${idx}`}>
                    {orderColumns.map((c) => (
                      <TableCell key={`${idx}-${c}`}>{String(row?.[c] ?? '—')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
        </>
      ) : null}
    </Box>
  );
}

export default ProfilePage;
