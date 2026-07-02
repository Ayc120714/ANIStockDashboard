import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useFocusEffect, useRoute} from '@react-navigation/native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {TradingViewLink} from '@components/TradingViewLink';
import {AYC, mobilePad, mobileStyles} from '@core/theme/mobileStyles';
import {dashboardService} from '@core/api/services/dashboardService';
import {formatPct, parseStockListResponse, stockRowPct} from '@core/utils/stockListPayload';
import {formatMarketCap, formatINR} from '@core/utils/formatMarket';
import {sortRows} from '@core/utils/tableSort';
import {getScreenSortValue} from '@core/utils/screenSortValues';
import {useTableSort} from '@hooks/useTableSort';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {MOBILE_SCREEN_LIST_LIMIT} from '@core/utils/advisorWebParity';
import {hydrateFromPageCache} from '@core/utils/pageCacheHydration';
import {
  runScreenPayloadFetch,
  SCREEN_LIVE_POLL_MS,
  shouldRefreshPageCache,
} from '@core/utils/screenPageLoader';
import {
  ensureMarketSession,
  getCachedMarketSession,
  getMarketPollingIntervalMs,
  shouldPollLiveMarket,
} from '@core/utils/marketSession';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {safeFetch} from '@core/utils/safeFetch';
import {
  aiPicksScreensPayloadUsable,
  buildAiPicksScreensPayload,
  weeklyPicksHasRows,
} from '@core/utils/weeklyPicksScreens';

const LIVE_SCREEN_TABS = new Set(['trending', 'movers', 'volume', 'alpha']);

const MAIN_TABS = [
  {id: 'ai', label: 'AI picks'},
  {id: 'trending', label: 'Trending'},
  {id: 'movers', label: 'Top movers'},
  {id: 'volume', label: 'Volume'},
  {id: 'alpha', label: 'Alpha'},
  {id: 'ipo', label: 'IPOs'},
];

const GL = [
  {id: 'gainers', label: 'Gainers'},
  {id: 'losers', label: 'Losers'},
];
const PER = [
  {id: 'day', label: 'Day'},
  {id: 'week', label: 'Week'},
  {id: 'month', label: 'Month'},
];
function periodColLabel(period) {
  if (period === 'week') return '1W';
  if (period === 'month') return '1M';
  return '1D';
}
const IPO_FILTERS = [
  {id: '', label: 'All'},
  {id: 'Active', label: 'Active'},
  {id: 'Listed', label: 'Listed'},
  {id: 'Closed', label: 'Closed'},
];

const SCREEN_HEAVY_OPTS = {timeoutMs: API_TIMEOUT_MS.screenHeavy, retries: 1};
const SCREEN_OPTS = {timeoutMs: API_TIMEOUT_MS.screen, retries: 1};
const PAGINATED_MAIN_TABS = new Set(['trending', 'movers', 'volume', 'alpha']);

function stockSym(r) {
  return r?.symbol || r?.ticker || '—';
}

function volJump(r) {
  const v = r?.volume;
  const a = r?.avg_volume;
  if (v && a && Number(a) > 0) return `${(Number(v) / Number(a)).toFixed(1)}x`;
  const p = r?.percent_change_volume_1d ?? r?.percent_change_volume_1w;
  if (p != null) return `${Number(p).toFixed(0)}%`;
  return '—';
}

export function ScreensHubScreen({navigation}) {
  const route = useRoute();
  const [main, setMain] = useState('ai');
  const [gl, setGl] = useState('gainers');
  const [perM, setPerM] = useState('day');
  const [perV, setPerV] = useState('day');
  const [alphaHor, setAlphaHor] = useState('short');
  const [ipoFilter, setIpoFilter] = useState('');
  const [search, setSearch] = useState('');
  const [listPage, setListPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [list, setList] = useState([]);
  const [weeklyMeta, setWeeklyMeta] = useState({pickDate: null, subtitle: ''});
  const [screenDates, setScreenDates] = useState([]);
  const [screenDate, setScreenDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadDone = useRef(false);
  const aiGenerateAttemptedRef = useRef(false);
  const screenDefaultSortKey = useMemo(() => {
    if (main === 'alpha') return 'rs';
    if (main === 'movers') return perM === 'week' ? 'week1w' : perM === 'month' ? 'month1m' : 'day1d';
    if (main === 'volume') return perV === 'week' ? 'week1w' : perV === 'month' ? 'month1m' : 'day1d';
    if (main === 'trending') return 'chg';
    if (main === 'ipo') return 'gain';
    return null;
  }, [main, perM, perV]);
  const {sortConfig, onSort, setSortConfig} = useTableSort(screenDefaultSortKey, false);

  const pageSize = 7;

  const resetTabState = useCallback(() => {
    setErr('');
  }, []);

  const applyScreensPayload = useCallback(payload => {
    setWeeklyMeta(payload.weeklyMeta || {pickDate: null, subtitle: ''});
    setList(Array.isArray(payload.list) ? payload.list : []);
  }, []);

  const screensPayloadUsable = useCallback(
    data => {
      if (main === 'ai') return aiPicksScreensPayloadUsable(data);
      return Array.isArray(data?.list) && data.list.length > 0;
    },
    [main],
  );

  const selectMainTab = useCallback(
    tabId => {
      resetTabState();
      setMain(tabId);
      setListPage(1);
      if (tabId === 'ai') {
        aiGenerateAttemptedRef.current = false;
      }
    },
    [resetTabState],
  );

  useEffect(() => {
    const next = route?.params?.screensMain;
    if (next && MAIN_TABS.some(t => t.id === next)) {
      selectMainTab(next);
    }
  }, [route?.params?.screensMain, selectMainTab]);

  useEffect(() => {
    setSortConfig({key: screenDefaultSortKey, ascending: false});
    setListPage(1);
  }, [gl, main, perM, perV, screenDefaultSortKey, setSortConfig]);

  useEffect(() => {
    (async () => {
      try {
        const dates = await dashboardService.fetchScreenDates(SCREEN_OPTS);
        setScreenDates(Array.isArray(dates) ? dates : []);
      } catch (_) {
        setScreenDates([]);
      }
    })();
  }, []);

  const load = useCallback(async ({forceRefresh = false, silent = false} = {}) => {
    const cacheKey = MOBILE_PAGE_CACHE_KEYS.screensHub(main, gl, perM, perV, alphaHor, ipoFilter, screenDate);
    await runScreenPayloadFetch({
      cacheKey,
      fetcher: async () => {
        if (main === 'ai') {
          let picks = await safeFetch(() => dashboardService.fetchWeeklyPicks(SCREEN_HEAVY_OPTS), {
            ...SCREEN_HEAVY_OPTS,
            label: 'Weekly picks',
            fallback: null,
          });
          if (!picks) throw new Error('Weekly AI picks timed out. Pull down to retry.');
          if (!weeklyPicksHasRows(picks) && !aiGenerateAttemptedRef.current) {
            aiGenerateAttemptedRef.current = true;
            try {
              await dashboardService.generateWeeklyPicks(SCREEN_HEAVY_OPTS);
              for (let attempt = 0; attempt < 12; attempt += 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                picks = await dashboardService.fetchWeeklyPicks(SCREEN_HEAVY_OPTS);
                if (weeklyPicksHasRows(picks)) break;
              }
            } catch (_) {
              /* user can pull to refresh */
            }
          }
          return buildAiPicksScreensPayload(picks);
        }
        if (main === 'trending') {
          const res = await safeFetch(
            () => dashboardService.fetchTrending(MOBILE_SCREEN_LIST_LIMIT, {...SCREEN_HEAVY_OPTS, date: screenDate || undefined}),
            {
            ...SCREEN_HEAVY_OPTS,
            label: 'Trending',
            fallback: null,
          });
          if (!res) throw new Error('Trending data timed out. Pull down to retry.');
          return {
            weeklyMeta: {pickDate: screenDate || null, subtitle: screenDate ? `Trending · ${screenDate}` : 'Trending stocks'},
            list: Array.isArray(res) ? res : parseStockListResponse(res),
          };
        }
        if (main === 'movers') {
          const res = await safeFetch(
            () =>
              dashboardService.fetchPriceShockers({
                type: gl,
                period: perM,
                date: screenDate || undefined,
                timeoutMs: API_TIMEOUT_MS.screen,
              }),
            {timeoutMs: API_TIMEOUT_MS.screen, retries: 1, label: 'Movers', fallback: null},
          );
          if (!res) throw new Error('Top movers timed out. Pull down to retry.');
          return {
            weeklyMeta: {pickDate: screenDate || null, subtitle: `${gl} · ${perM}${screenDate ? ` · ${screenDate}` : ''}`},
            list: Array.isArray(res) ? res : parseStockListResponse(res),
          };
        }
        if (main === 'volume') {
          const res = await safeFetch(
            () =>
              dashboardService.fetchVolumeShockers({
                limit: MOBILE_SCREEN_LIST_LIMIT,
                period: perV,
                date: screenDate || undefined,
                timeoutMs: API_TIMEOUT_MS.screen,
              }),
            {timeoutMs: API_TIMEOUT_MS.screen, retries: 1, label: 'Volume', fallback: null},
          );
          if (!res) throw new Error('Volume screen timed out. Pull down to retry.');
          return {
            weeklyMeta: {pickDate: screenDate || null, subtitle: `Volume movers · ${perV}${screenDate ? ` · ${screenDate}` : ''}`},
            list: Array.isArray(res) ? res : parseStockListResponse(res),
          };
        }
        if (main === 'alpha') {
          const period = alphaHor === 'long' ? '6m' : '1w';
          const res = await safeFetch(
            () =>
              dashboardService.fetchRelativePerformance({
                period,
                limit: MOBILE_SCREEN_LIST_LIMIT,
                date: screenDate || undefined,
                timeoutMs: API_TIMEOUT_MS.screenHeavy,
              }),
            {...SCREEN_HEAVY_OPTS, label: 'Alpha tracker', fallback: null},
          );
          if (!res) throw new Error('Alpha tracker timed out. Pull down to retry.');
          return {
            weeklyMeta: {pickDate: null, subtitle: `RS% vs NIFTY (${period.toUpperCase()})`},
            list: Array.isArray(res) ? res : parseStockListResponse(res),
          };
        }
        const res = await safeFetch(
          () => dashboardService.fetchIpos({status: ipoFilter || undefined, limit: 200, timeoutMs: API_TIMEOUT_MS.screen}),
          {...SCREEN_OPTS, label: 'IPOs', fallback: null},
        );
        if (!res) throw new Error('IPO list timed out. Pull down to retry.');
        const rows = Array.isArray(res) ? res : [];
        return {
          weeklyMeta: {pickDate: null, subtitle: `IPOs (${rows.length})`},
          list: rows,
        };
      },
      applyPayload: applyScreensPayload,
      setLoading,
      setError: msg => setErr(msg || ''),
      forceNetwork: forceRefresh,
      hasUsable: screensPayloadUsable,
      silent: silent && !forceRefresh,
    });
  }, [alphaHor, applyScreensPayload, gl, ipoFilter, main, perM, perV, screenDate, screensPayloadUsable]);

  useEffect(() => {
    let cancelled = false;
    initialLoadDone.current = false;
    (async () => {
      const cacheKey = MOBILE_PAGE_CACHE_KEYS.screensHub(main, gl, perM, perV, alphaHor, ipoFilter, screenDate);
      const hadCache = await hydrateFromPageCache(cacheKey, {
        apply: applyScreensPayload,
        hasUsable: screensPayloadUsable,
      });
      if (cancelled) return;
      await load({silent: hadCache});
      initialLoadDone.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [alphaHor, applyScreensPayload, gl, ipoFilter, load, main, perM, perV, screenDate, screensPayloadUsable]);

  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current) return undefined;
      (async () => {
        const cacheKey = MOBILE_PAGE_CACHE_KEYS.screensHub(main, gl, perM, perV, alphaHor, ipoFilter, screenDate);
        const stale = await shouldRefreshPageCache(cacheKey);
        if (stale) {
          await load({silent: list.length > 0});
        }
      })();
      return undefined;
    }, [alphaHor, gl, ipoFilter, list.length, load, main, perM, perV, screenDate]),
  );

  useEffect(() => {
    if (!LIVE_SCREEN_TABS.has(main) || screenDate) return undefined;
    let pollId;
    (async () => {
      await ensureMarketSession();
      const pollMs = getMarketPollingIntervalMs(SCREEN_LIVE_POLL_MS, 0);
      if (pollMs <= 0) return;
      pollId = setInterval(async () => {
        await ensureMarketSession();
        if (!shouldPollLiveMarket(getCachedMarketSession())) return;
        await load({silent: true, forceRefresh: true});
      }, pollMs);
    })();
    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [alphaHor, gl, load, main, perM, perV, screenDate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (main === 'ai') {
        aiGenerateAttemptedRef.current = false;
      }
      await load({forceRefresh: true});
    } finally {
      setRefreshing(false);
    }
  }, [load, main]);

  const filteredTrend = useMemo(() => {
    if (main !== 'trending') return list;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r => String(r.symbol || '').toLowerCase().includes(q) || String(r.sector || '').toLowerCase().includes(q));
  }, [list, main, search]);

  const sortedList = useMemo(() => {
    if (main === 'ai') return list;
    const source = main === 'trending' ? filteredTrend : list;
    return sortRows(source, sortConfig, (row, key) =>
      getScreenSortValue(row, key, {main, perM, perV}),
    );
  }, [filteredTrend, list, main, perM, perV, sortConfig]);

  useEffect(() => {
    setListPage(1);
  }, [gl, perM, perV, alphaHor, screenDate]);

  const pagedList = useMemo(() => {
    if (!PAGINATED_MAIN_TABS.has(main)) return sortedList;
    const start = (listPage - 1) * pageSize;
    return sortedList.slice(start, start + pageSize);
  }, [listPage, main, pageSize, sortedList]);

  const listPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const isPaginated = PAGINATED_MAIN_TABS.has(main);

  const moversPctLabel = periodColLabel(perM);
  const volumePctLabel = periodColLabel(perV);
  const moversSortKey = perM === 'week' ? 'week1w' : perM === 'month' ? 'month1m' : 'day1d';
  const volumeSortKey = perV === 'week' ? 'week1w' : perV === 'month' ? 'month1m' : 'day1d';

  const renderHeader = () => (
    <View style={{gap: 8}}>
      <Text style={mobileStyles.pageTitle}>Screens</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {MAIN_TABS.map(t => (
          <Pressable key={t.id} onPress={() => selectMainTab(t.id)} style={[styles.chip, main === t.id ? styles.chipOn : null]}>
            <Text style={[styles.chipText, main === t.id ? styles.chipTextOn : null]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {['trending', 'movers', 'volume', 'alpha'].includes(main) && screenDates.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable
            onPress={() => setScreenDate('')}
            style={[styles.chipSm, !screenDate ? styles.chipOn : null]}>
            <Text style={[styles.chipText, !screenDate ? styles.chipTextOn : null]}>Live</Text>
          </Pressable>
          {screenDates.slice(0, 14).map(d => (
            <Pressable
              key={d}
              onPress={() => setScreenDate(d)}
              style={[styles.chipSm, screenDate === d ? styles.chipOn : null]}>
              <Text style={[styles.chipText, screenDate === d ? styles.chipTextOn : null]}>{d}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {main === 'movers' ? (
        <View style={{gap: 6}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {GL.map(x => (
              <Pressable key={x.id} onPress={() => setGl(x.id)} style={[styles.chipSm, gl === x.id ? styles.chipOn : null]}>
                <Text style={[styles.chipText, gl === x.id ? styles.chipTextOn : null]}>{x.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {PER.map(x => (
              <Pressable key={x.id} onPress={() => setPerM(x.id)} style={[styles.chipSm, perM === x.id ? styles.chipOn : null]}>
                <Text style={[styles.chipText, perM === x.id ? styles.chipTextOn : null]}>{x.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {main === 'volume' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {PER.map(x => (
            <Pressable key={x.id} onPress={() => setPerV(x.id)} style={[styles.chipSm, perV === x.id ? styles.chipOn : null]}>
              <Text style={[styles.chipText, perV === x.id ? styles.chipTextOn : null]}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {main === 'alpha' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable onPress={() => setAlphaHor('short')} style={[styles.chipSm, alphaHor === 'short' ? styles.chipOn : null]}>
            <Text style={[styles.chipText, alphaHor === 'short' ? styles.chipTextOn : null]}>Short term</Text>
          </Pressable>
          <Pressable onPress={() => setAlphaHor('long')} style={[styles.chipSm, alphaHor === 'long' ? styles.chipOn : null]}>
            <Text style={[styles.chipText, alphaHor === 'long' ? styles.chipTextOn : null]}>Long term</Text>
          </Pressable>
        </ScrollView>
      ) : null}
      {main === 'ipo' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {IPO_FILTERS.map(x => (
            <Pressable
              key={x.id || 'all'}
              onPress={() => setIpoFilter(x.id)}
              style={[styles.chipSm, ipoFilter === x.id ? styles.chipOn : null]}
            >
              <Text style={[styles.chipText, ipoFilter === x.id ? styles.chipTextOn : null]}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {main === 'trending' ? (
        <TextInput
          style={styles.search}
          placeholder="Search…"
          placeholderTextColor={AYC.textMuted}
          value={search}
          onChangeText={t => { setSearch(t); setListPage(1); }}
        />
      ) : null}
      {weeklyMeta.subtitle ? <Text style={styles.subHead}>{weeklyMeta.subtitle}</Text> : null}
      {weeklyMeta.pickDate ? (
        <Text style={styles.meta}>Generated: {weeklyMeta.pickDate}</Text>
      ) : null}
      {main === 'ai' && !loading && !aiHasPickRows ? (
        <Text style={styles.muted}>
          No weekly AI picks yet. Pull down to refresh — generation may take up to a minute.
        </Text>
      ) : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {loading && !list.length ? (
        <View style={styles.loader}>
          <ActivityIndicator color={AYC.accent} />
        </View>
      ) : null}
      {main !== 'ai' ? (
        <View style={styles.tableHead}>
          {main === 'trending' ? (
            <>
              <Text style={[styles.th, {width: 26}]}>#</Text>
              <SortableTableHeader label="Sym" sortKey="symbol" sortConfig={sortConfig} onSort={onSort} style={{flex: 1}} />
              <SortableTableHeader label="Sector" sortKey="sector" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.9}} />
              <SortableTableHeader label="MC" sortKey="market_cap" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
              <SortableTableHeader label="Chg" sortKey="chg" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.65}} />
            </>
          ) : main === 'movers' ? (
            <>
              <Text style={[styles.th, {width: 26}]}>#</Text>
              <SortableTableHeader label="Sym" sortKey="symbol" sortConfig={sortConfig} onSort={onSort} style={{flex: 1}} />
              <SortableTableHeader label="Sector" sortKey="sector" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.85}} />
              <SortableTableHeader label="CMP" sortKey="price" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.65}} />
              <SortableTableHeader label={moversPctLabel} sortKey={moversSortKey} sortConfig={sortConfig} onSort={onSort} style={{flex: 0.55}} />
            </>
          ) : main === 'volume' ? (
            <>
              <Text style={[styles.th, {width: 26}]}>#</Text>
              <SortableTableHeader label="Sym" sortKey="symbol" sortConfig={sortConfig} onSort={onSort} style={{flex: 1}} />
              <SortableTableHeader label="Vol" sortKey="volume_jump" sortConfig={sortConfig} onSort={onSort} style={{width: 52}} />
              <SortableTableHeader label="CMP" sortKey="price" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.6}} />
              <SortableTableHeader label={volumePctLabel} sortKey={volumeSortKey} sortConfig={sortConfig} onSort={onSort} style={{flex: 0.5}} />
            </>
          ) : main === 'alpha' ? (
            <>
              <Text style={[styles.th, {width: 26}]}>#</Text>
              <SortableTableHeader label="Sym" sortKey="symbol" sortConfig={sortConfig} onSort={onSort} style={{flex: 1}} />
              <SortableTableHeader label="Sector" sortKey="sector" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.75}} />
              <SortableTableHeader label="CMP" sortKey="price" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.55}} />
              <SortableTableHeader label="1W" sortKey="week1w" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.45}} />
              <SortableTableHeader label="RS" sortKey="rs" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.45}} />
            </>
          ) : (
            <>
              <Text style={[styles.th, {width: 26}]}>#</Text>
              <SortableTableHeader label="Sym" sortKey="symbol" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.9}} />
              <SortableTableHeader label="Sts" sortKey="status" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.75}} />
              <SortableTableHeader label="List" sortKey="list" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.55}} />
              <SortableTableHeader label="Gain" sortKey="gain" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.45}} />
              <SortableTableHeader label="CMP" sortKey="current_price" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.55}} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );

  const dataForList = isPaginated ? pagedList : main === 'ai' ? list : sortedList;
  const aiHasPickRows = main === 'ai' && list.some(item => item && !item._hdr);

  const renderItem = ({item, index}) => {
    if (item._hdr) {
      const bg = item._tone === 'bear' ? '#fecaca' : '#bbf7d0';
      return (
        <View style={[styles.hdrPill, {backgroundColor: bg}]}>
          <Text style={styles.hdrPillTxt}>{item._title}</Text>
        </View>
      );
    }
    if (main === 'ai') {
      const px = item?.cmp ?? item?.price;
      const rec = String(item?.recommendation || '').toUpperCase();
      const bull = item._side === 'bull';
      const badgeBg = bull ? '#16a34a' : '#dc2626';
      return (
        <View style={[styles.rowAi, bull ? styles.rowAiBull : styles.rowAiBear]}>
          <Text style={styles.aiNum}>{String(item._n).padStart(2, '0')}</Text>
          <View style={styles.aiSymWrap}>
            <TradingViewLink symbol={stockSym(item)} size={14} />
            <Text style={styles.aiSym}>{stockSym(item)}</Text>
          </View>
          <Text style={styles.aiGr}>{item.grade || '—'}</Text>
          <Text style={styles.aiSmall}>{px != null ? formatINR(px) : '—'}</Text>
          <Text style={styles.aiSmall}>{item.entry_price != null ? formatINR(item.entry_price) : '—'}</Text>
          <Text style={[styles.aiSmall, {color: bull ? AYC.positive : AYC.negative, fontWeight: '700'}]}>
            {item.target_1 != null ? formatINR(item.target_1) : '—'}
          </Text>
          <View style={[styles.reco, {backgroundColor: badgeBg}]}>
            <Text style={styles.recoTxt}>{bull ? 'BUY' : 'SELL'}</Text>
          </View>
        </View>
      );
    }
    const pct =
      main === 'movers'
        ? stockRowPct(item, perM)
        : main === 'volume'
          ? stockRowPct(item, perV)
          : stockRowPct(item);
    const rowBg =
      main === 'trending' || main === 'movers' || main === 'volume'
        ? pct != null && pct >= 0
          ? '#f0fdf4'
          : pct != null && pct < 0
            ? '#fef2f2'
            : '#fff'
        : '#fff';
    const ix = isPaginated ? (listPage - 1) * pageSize + index + 1 : index + 1;
    const symCell = (flex = 1) => (
      <View style={[styles.td, {flex, flexDirection: 'row', alignItems: 'center'}]}>
        <TradingViewLink symbol={stockSym(item)} size={14} />
        <Text style={{fontWeight: '800', flex: 1}} numberOfLines={1}>
          {stockSym(item)}
        </Text>
      </View>
    );
    if (main === 'trending') {
      return (
        <View style={[styles.tr, {backgroundColor: rowBg}]}>
          <Text style={[styles.td, {width: 26}]}>{String(ix).padStart(2, '0')}</Text>
          {symCell(1)}
          <Text style={[styles.td, {flex: 0.9}]} numberOfLines={1}>
            {item.sector || '—'}
          </Text>
          <Text style={[styles.td, {flex: 0.7}]} numberOfLines={1}>
            {formatMarketCap(item.market_cap)}
          </Text>
          <Text style={[styles.td, {flex: 0.65, color: pct >= 0 ? AYC.positive : AYC.negative, fontWeight: '800'}]}>
            {formatPct(pct)}
          </Text>
        </View>
      );
    }
    if (main === 'movers') {
      return (
        <View style={[styles.tr, {backgroundColor: rowBg}]}>
          <Text style={[styles.td, {width: 26}]}>{String(ix).padStart(2, '0')}</Text>
          {symCell(1)}
          <Text style={[styles.td, {flex: 0.85}]} numberOfLines={1}>
            {item.sector || '—'}
          </Text>
          <Text style={[styles.td, {flex: 0.65}]}>{item.price != null ? formatINR(item.price) : '—'}</Text>
          <Text style={[styles.td, {flex: 0.55, color: pct >= 0 ? AYC.positive : AYC.negative, fontWeight: '800'}]}>
            {formatPct(pct)}
          </Text>
        </View>
      );
    }
    if (main === 'volume') {
      const vj = volJump(item);
      const vjColor = parseFloat(vj) >= 10 ? AYC.negative : parseFloat(vj) >= 5 ? AYC.warning : AYC.text;
      return (
        <View style={[styles.tr, {backgroundColor: rowBg}]}>
          <Text style={[styles.td, {width: 26}]}>{String(ix).padStart(2, '0')}</Text>
          {symCell(1)}
          <Text style={[styles.td, {width: 52, color: vjColor, fontWeight: '800'}]}>{vj}</Text>
          <Text style={[styles.td, {flex: 0.6}]}>{item.price != null ? formatINR(item.price) : '—'}</Text>
          <Text style={[styles.td, {flex: 0.5, color: pct >= 0 ? AYC.positive : AYC.negative, fontWeight: '800'}]}>
            {formatPct(pct)}
          </Text>
        </View>
      );
    }
    if (main === 'alpha') {
      const rs = item.relative_strength;
      const w = item.week1w;
      return (
        <View style={[styles.tr, {backgroundColor: index % 2 === 0 ? '#f0fdf4' : '#fff'}]}>
          <Text style={[styles.td, {width: 26}]}>{String(ix).padStart(2, '0')}</Text>
          {symCell(1)}
          <Text style={[styles.td, {flex: 0.75}]} numberOfLines={1}>
            {item.sector || '—'}
          </Text>
          <Text style={[styles.td, {flex: 0.55}]}>{item.price != null ? formatINR(item.price) : '—'}</Text>
          <Text style={[styles.td, {flex: 0.45, color: AYC.positive, fontWeight: '700'}]}>
            {w != null ? formatPct(Number(w)) : '—'}
          </Text>
          <Text style={[styles.td, {flex: 0.45, color: AYC.positive, fontWeight: '700'}]}>
            {rs != null ? `${Number(rs).toFixed(2)}%` : '—'}
          </Text>
        </View>
      );
    }
    if (main === 'ipo') {
      const g = item.listing_gain;
      const gc = g == null ? AYC.text : Number(g) >= 0 ? AYC.positive : AYC.negative;
      return (
        <View style={[styles.tr, {borderBottomWidth: 1}]}>
          <Text style={[styles.td, {width: 26}]}>{String(ix).padStart(2, '0')}</Text>
          <View style={[styles.td, {flex: 0.9, flexDirection: 'row', alignItems: 'center'}]}>
            {item.symbol ? <TradingViewLink symbol={item.symbol} size={14} /> : null}
            <Text style={{fontWeight: '800', flex: 1}} numberOfLines={1}>
              {item.symbol || '—'}
            </Text>
          </View>
          <Text style={[styles.td, {flex: 0.75, color: AYC.accent}]} numberOfLines={1}>
            {item.status || '—'}
          </Text>
          <Text style={[styles.td, {flex: 0.55}]} numberOfLines={1}>
            {item.issue_price || '—'}
          </Text>
          <Text style={[styles.td, {flex: 0.45, color: gc, fontWeight: '800'}]}>
            {g != null ? `${Number(g) >= 0 ? '+' : ''}${Number(g).toFixed(2)}%` : '—'}
          </Text>
          <Text style={[styles.td, {flex: 0.55}]} numberOfLines={1}>
            {item.current_price != null ? formatINR(item.current_price) : '—'}
          </Text>
        </View>
      );
    }
    return null;
  };

  const keyExtractor = (item, i) => {
    if (item._hdr) return `h-${item._title}-${i}`;
    if (main === 'ai') return `ai-${stockSym(item)}-${item._n}-${item._side || ''}`;
    if (main === 'ipo') return `ipo-${item.id}-${i}`;
    return `${stockSym(item)}-${i}`;
  };

  return (
    <MobileChrome navigation={navigation}>
      <FlatList
        data={dataForList}
        keyExtractor={keyExtractor}
        style={{flex: 1}}
        contentContainerStyle={styles.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            {renderHeader()}
            {main === 'ai' && !loading ? (
              <View style={styles.tableHeadAi}>
                <Text style={[styles.th, {width: 28}]}>#</Text>
                <Text style={[styles.th, {flex: 1}]}>Symbol</Text>
                <Text style={[styles.th, {width: 32}]}>Grd</Text>
                <Text style={[styles.th, {flex: 0.7}]}>CMP</Text>
                <Text style={[styles.th, {flex: 0.7}]}>Entry</Text>
                <Text style={[styles.th, {flex: 0.7}]}>T1</Text>
                <Text style={[styles.th, {width: 40}]}>Reco</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={renderItem}
        ListEmptyComponent={!loading && main !== 'ai' ? <Text style={styles.muted}>No rows.</Text> : null}
        ListFooterComponent={
          <View>
            {isPaginated && !loading ? (
              <View style={styles.pager}>
                {Array.from({length: Math.min(listPages, 5)}, (_, j) => j + 1).map(p => (
                  <Pressable
                    key={p}
                    onPress={() => setListPage(p)}
                    style={[styles.pgDot, listPage === p ? styles.pgDotOn : null]}
                  >
                    <Text style={[styles.pgDotTxt, listPage === p ? styles.pgDotTxtOn : null]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        }
      />
    </MobileChrome>
  );
}

const styles = StyleSheet.create({
  pad: mobilePad,
  chipRow: {flexDirection: 'row', gap: 8, paddingVertical: 4},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AYC.card,
    borderWidth: 1,
    borderColor: AYC.accent,
  },
  chipSm: {paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: AYC.card, borderWidth: 1, borderColor: AYC.accent},
  chipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  chipText: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent},
  chipTextOn: {color: '#fff'},
  search: mobileStyles.input,
  subHead: mobileStyles.cardTitle,
  meta: mobileStyles.caption,
  err: mobileStyles.err,
  loader: {paddingVertical: 12, alignItems: 'center'},
  muted: {paddingVertical: 16, color: AYC.textMuted, fontSize: AYC.type.body},
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AYC.appBar,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    marginTop: 4,
  },
  tableHeadAi: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AYC.appBar,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    marginTop: 8,
  },
  th: mobileStyles.th,
  hdrPill: {paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, marginTop: 10, marginBottom: 4},
  hdrPillTxt: {fontWeight: '900', color: AYC.text, fontSize: AYC.type.body},
  rowAi: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: AYC.cardBorder,
  },
  rowAiBull: {backgroundColor: '#f0fdf4'},
  rowAiBear: {backgroundColor: '#fff1f2'},
  aiNum: {width: 28, fontSize: AYC.type.caption, fontWeight: '800', color: AYC.text},
  aiSymWrap: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4},
  aiSym: {flex: 1, fontSize: AYC.type.body, fontWeight: '900', color: AYC.text},
  aiGr: {width: 32, fontSize: AYC.type.caption, fontWeight: '800', color: AYC.positive},
  aiSmall: {flex: 0.7, fontSize: AYC.type.caption, color: AYC.text},
  reco: {width: 40, paddingVertical: 4, borderRadius: 6, alignItems: 'center'},
  recoTxt: {color: '#fff', fontSize: AYC.type.cardLabel, fontWeight: '900'},
  tr: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6},
  td: mobileStyles.td,
  pager: {flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12},
  pgDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AYC.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pgDotOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  pgDotTxt: {fontWeight: '800', color: AYC.accent, fontSize: AYC.type.body},
  pgDotTxtOn: {color: '#fff'},
});
