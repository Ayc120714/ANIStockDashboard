import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';
import {FiiDiiCashCards} from '@components/FiiDiiCashCards';
import {SortableTableHeader} from '@components/SortableTableHeader';
import {MIN_FII_DII_DAYS} from '@core/utils/fiiDiiPayload';
import {dashboardService} from '@core/api/services/dashboardService';
import {deriveSubsectorPerformers, formatSubsectorAll, pctColor, subsectorRowBg} from '@core/utils/outlookPayload';
import {sortRows} from '@core/utils/tableSort';
import {getSectorSortValue} from '@core/utils/screenSortValues';
import {useTableSort} from '@hooks/useTableSort';
import {isStockOutlookTab} from '@nav/navigationHelpers';

const OUTLOOK_TABS = [
  {id: 'market', label: 'Market insights'},
  {id: 'sector', label: 'Sector insights'},
  {id: 'sub', label: 'SubSector'},
];

const SUB_STRENGTH = [
  {id: 'all', label: 'All'},
  {id: 'strong', label: 'Strong'},
  {id: 'mod', label: 'Moderate'},
  {id: 'weak', label: 'Weak'},
];

const toList = raw => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw);
  return [];
};

function matchesSearch(row, q) {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const name = String(row?.name || row?.symbol || '').toLowerCase();
  return name.includes(s);
}

export function StocksOverviewSection({navigation, initialTab}) {
  const [tab, setTab] = useState(() => (isStockOutlookTab(initialTab) ? initialTab : 'market'));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [indices, setIndices] = useState([]);
  const [sectorRows, setSectorRows] = useState([]);
  const [fii, setFii] = useState(null);
  const [grouped, setGrouped] = useState(null);
  const [subStrength, setSubStrength] = useState('all');
  const [err, setErr] = useState('');
  const {sortConfig, onSort, resetSort} = useTableSort();

  const pageSize = 10;

  const load = useCallback(async () => {
    setErr('');
    setBusy(true);
    try {
      if (tab === 'market') {
        const [ix, fd] = await Promise.all([
          dashboardService.fetchMarketIndices(),
          dashboardService.fetchFiiDii({days: MIN_FII_DII_DAYS}).catch(() => null),
        ]);
        setIndices(toList(ix));
        setFii(fd);
      } else if (tab === 'sector') {
        const data = await dashboardService.fetchSectorOutlook();
        setSectorRows(toList(data));
      } else {
        const g = await dashboardService.fetchSubsectorOutlookGrouped();
        setGrouped(g && typeof g === 'object' ? g : null);
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isStockOutlookTab(initialTab)) {
      setTab(initialTab);
      setPage(1);
    }
  }, [initialTab]);

  useEffect(() => {
    resetSort();
    setPage(1);
  }, [tab, resetSort]);

  const filteredSector = useMemo(() => {
    return sectorRows.filter(r => matchesSearch(r, search));
  }, [sectorRows, search]);

  const sortedSector = useMemo(
    () => sortRows(filteredSector, sortConfig, getSectorSortValue),
    [filteredSector, sortConfig],
  );

  const pagedSector = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedSector.slice(start, start + pageSize);
  }, [page, pageSize, sortedSector]);

  const totalPages = Math.max(1, Math.ceil(sortedSector.length / pageSize));

  const subDerived = useMemo(
    () => deriveSubsectorPerformers(grouped, {search, subStrength}),
    [grouped, search, subStrength],
  );

  const subWeekLabels = subDerived.weekLabels;
  const subRowsFlat = subDerived.rows;

  const renderMarket = () => (
    <View>
      <FiiDiiCashCards data={fii} loading={busy && !fii} />
      <FlatList
        scrollEnabled={false}
        data={indices.filter(r => matchesSearch({name: r?.name || r?.symbol}, search))}
        keyExtractor={(it, i) => String(it?.name || it?.symbol || i)}
        renderItem={({item}) => {
          const name = item?.name || item?.symbol || '—';
          const ltp = item?.value ?? item?.ltp ?? item?.last;
          const chDisplay = item?.day1d ?? '—';
          const col = pctColor(chDisplay, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
          return (
            <View style={styles.dataCard}>
              <Text style={styles.sym}>{name}</Text>
              <Text style={styles.cmp} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {typeof ltp === 'number' ? ltp.toLocaleString('en-IN', {maximumFractionDigits: 2}) : ltp ?? '—'}
              </Text>
              <Text style={{color: col, fontWeight: '800'}}>{chDisplay}</Text>
              <Text style={styles.trendTag}>{item?.trend || '—'}</Text>
            </View>
          );
        }}
      />
    </View>
  );

  const renderSector = () => (
    <View>
      <View style={styles.tableHead}>
        <Text style={[styles.th, {width: 28}]}>#</Text>
        <SortableTableHeader label="Index" sortKey="name" sortConfig={sortConfig} onSort={onSort} style={{flex: 1.4}} />
        <SortableTableHeader label="Trend" sortKey="trend" sortConfig={sortConfig} onSort={onSort} style={{width: 36}} />
        <SortableTableHeader label="1D" sortKey="day1d" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
        <SortableTableHeader label="1W" sortKey="week1w" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
        <SortableTableHeader label="1M" sortKey="month1m" sortConfig={sortConfig} onSort={onSort} style={{flex: 0.7}} />
      </View>
      {pagedSector.map((item, idx) => {
        const i = (page - 1) * pageSize + idx + 1;
        const d1Color = pctColor(item.day1d, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
        const w1Color = pctColor(item.week1w, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
        const m1Color = pctColor(item.month1m, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
        const trendColor =
          item.trendDirection === 'up'
            ? AYC.positive
            : item.trendDirection === 'down'
              ? AYC.negative
              : AYC.textMuted;
        return (
          <View key={String(item.id || item.name || idx)} style={styles.tableRow}>
            <Text style={[styles.td, {width: 28}]}>{i}</Text>
            <Text style={[styles.td, {flex: 1.4, color: AYC.accent, fontWeight: '800'}]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.td, {width: 36, color: trendColor, fontWeight: '800'}]}>{item.trend || '→'}</Text>
            <Text style={[styles.td, {flex: 0.7, color: d1Color, fontWeight: '700'}]} numberOfLines={1}>
              {item.day1d ?? '—'}
            </Text>
            <Text style={[styles.td, {flex: 0.7, color: w1Color, fontWeight: '700'}]} numberOfLines={1}>
              {item.week1w ?? '—'}
            </Text>
            <Text style={[styles.td, {flex: 0.7, color: m1Color, fontWeight: '700'}]} numberOfLines={1}>
              {item.month1m ?? '—'}
            </Text>
          </View>
        );
      })}
      <View style={styles.pager}>
        <Pressable style={styles.pgBtn} disabled={page <= 1} onPress={() => setPage(p => Math.max(1, p - 1))}>
          <Text style={styles.pgTxt}>‹</Text>
        </Pressable>
        <Text style={styles.pgLbl}>
          {page} / {totalPages}
        </Text>
        <Pressable style={styles.pgBtn} disabled={page >= totalPages} onPress={() => setPage(p => Math.min(totalPages, p + 1))}>
          <Text style={styles.pgTxt}>›</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderSub = () => {
    const top = subDerived.topPerformers;
    const under = subDerived.underPerformers;
  const weekCols = subWeekLabels.length ? subWeekLabels : ['W1', 'W2', 'W3'];

    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SUB_STRENGTH.map(c => (
            <Pressable
              key={c.id}
              onPress={() => setSubStrength(c.id)}
              style={[styles.chip, subStrength === c.id ? styles.chipOn : null]}
            >
              <Text style={[styles.chipTxt, subStrength === c.id ? styles.chipTxtOn : null]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.legend}>
          <Text style={styles.legRed}>Weak &lt; -2%</Text>
          <Text style={styles.legAmb}>Moderate</Text>
          <Text style={styles.legGr}>Strong &gt; +2%</Text>
        </View>
        {top.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Top performers</Text>
            {top.map(t => (
              <View key={t.subsector} style={styles.tpRow}>
                <Text style={styles.tpName}>{t.subsector}</Text>
                <Text style={styles.tpPct}>{t.performance}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {under.length ? (
          <View style={styles.block}>
            <Text style={[styles.blockTitle, styles.blockTitleUnder]}>Under performers</Text>
            {under.map(t => (
              <View key={`under-${t.subsector}`} style={styles.tpRow}>
                <Text style={styles.tpName}>{t.subsector}</Text>
                <Text style={styles.tpPctUnder}>{t.performance}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.tableHead}>
          <Text style={[styles.th, {flex: 1.2}]}>Sub Sector</Text>
          <Text style={[styles.th, {flex: 0.5}]}>ALL</Text>
          {weekCols.map(lbl => (
            <Text key={lbl} style={[styles.th, {flex: 0.45}]} numberOfLines={1}>
              {lbl}
            </Text>
          ))}
        </View>
        {subRowsFlat.length === 0 ? (
          <Text style={styles.emptySub}>No subsector data available.</Text>
        ) : null}
        {subRowsFlat.slice(0, 80).map((item, idx) => {
          const {sub: row, sector, weekLabels: labels} = item;
          const showSectorHeader = sector && (idx === 0 || subRowsFlat[idx - 1]?.sector !== sector);
          const p = row.trend_pct;
          const bg = subsectorRowBg(p);
          const allDisplay = formatSubsectorAll(row.all);
          const allColor = pctColor(allDisplay, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
          return (
            <React.Fragment key={`${sector}-${row.name}-${idx}`}>
              {showSectorHeader ? <Text style={styles.secHead}>{sector}</Text> : null}
              <View style={[styles.subRow, {backgroundColor: bg}]}>
                <Text style={[styles.subName, {flex: 1.2}]} numberOfLines={2}>
                  {row.name}
                </Text>
                <Text style={[styles.subCell, {flex: 0.5, color: allColor}]}>{allDisplay}</Text>
                {weekCols.map(lbl => {
                  const val = labels.includes(lbl) ? row[lbl] : null;
                  const display = val != null && val !== '' ? `${val}%` : '—';
                  const col = pctColor(display, {positive: AYC.positive, negative: AYC.negative, neutral: AYC.text});
                  return (
                    <Text key={`${row.name}-${lbl}`} style={[styles.subCell, {flex: 0.45, color: col}]}>
                      {display}
                    </Text>
                  );
                })}
              </View>
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.ovTitle}>Overview</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {OUTLOOK_TABS.map(t => (
          <Pressable key={t.id} onPress={() => { setTab(t.id); setPage(1); }} style={[styles.bigChip, tab === t.id ? styles.chipOn : null]}>
            <Text style={[styles.bigChipTxt, tab === t.id ? styles.chipTxtOn : null]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput
        style={styles.search}
        placeholder="Search…"
        placeholderTextColor={AYC.textMuted}
        value={search}
        onChangeText={t => { setSearch(t); setPage(1); }}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {busy ? <ActivityIndicator color={AYC.accent} style={{marginVertical: 12}} /> : null}
      {!busy && tab === 'market' ? renderMarket() : null}
      {!busy && tab === 'sector' ? renderSector() : null}
      {!busy && tab === 'sub' ? renderSub() : null}

      <View style={styles.horiz}>
        <Text style={styles.horizLabel}>Watchlists</Text>
        <View style={styles.horizRow}>
          <Pressable style={styles.hzCard} onPress={() => navigation.navigate('Watchlist', {listType: 'long_term', title: 'Long term'})}>
            <Text style={styles.hzTitle}>Long term</Text>
            <Text style={styles.hzHint}>Table + trade panel</Text>
          </Pressable>
          <Pressable style={styles.hzCard} onPress={() => navigation.navigate('Watchlist', {listType: 'short_term', title: 'Short term'})}>
            <Text style={styles.hzTitle}>Short term</Text>
            <Text style={styles.hzHint}>RSI · tier · score</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8, marginBottom: 16},
  ovTitle: {fontSize: AYC.type.pageTitle, fontWeight: '800', color: AYC.text},
  chipRow: {flexDirection: 'row', gap: 8, paddingVertical: 4},
  bigChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AYC.accent,
    backgroundColor: AYC.card,
  },
  chipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  bigChipTxt: {fontSize: 12, fontWeight: '800', color: AYC.accent},
  chipTxt: {fontSize: 12, fontWeight: '800', color: AYC.accent},
  chipTxtOn: {color: '#fff'},
  chip: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: AYC.cardBorder},
  search: {
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: AYC.text,
    backgroundColor: AYC.card,
  },
  err: {color: AYC.negative, fontSize: 12},
  dataCard: {
    backgroundColor: AYC.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
  },
  sym: {fontWeight: '700', fontSize: AYC.type.body, color: AYC.text},
  cmp: {fontSize: AYC.type.metricMd, fontWeight: '800', marginTop: 2},
  trendTag: {marginTop: 4, fontSize: 10, fontWeight: '800', color: AYC.textMuted},
  tableHead: {
    flexDirection: 'row',
    backgroundColor: AYC.appBar,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
  },
  th: {color: '#fff', fontSize: 10, fontWeight: '800'},
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: AYC.cardBorder,
    backgroundColor: AYC.card,
  },
  td: {fontSize: 11, color: AYC.text},
  pager: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 10},
  pgBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AYC.appBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pgTxt: {color: '#fff', fontSize: 18, fontWeight: '800'},
  pgLbl: {fontWeight: '800', color: AYC.text},
  legend: {flexDirection: 'row', gap: 12, marginVertical: 6, flexWrap: 'wrap'},
  legRed: {fontSize: 11, color: AYC.negative, fontWeight: '700'},
  legAmb: {fontSize: 11, color: AYC.warning, fontWeight: '700'},
  legGr: {fontSize: 11, color: AYC.positive, fontWeight: '700'},
  block: {marginTop: 8, marginBottom: 8},
  blockTitle: {fontSize: 13, fontWeight: '800', color: AYC.textMuted, marginBottom: 6, backgroundColor: '#e2e8f0', padding: 8},
  blockTitleUnder: {color: AYC.negative},
  tpPctUnder: {fontWeight: '800', color: AYC.negative},
  emptySub: {paddingVertical: 12, textAlign: 'center', color: AYC.textMuted, fontSize: 12},
  tpRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: AYC.cardBorder},
  tpName: {flex: 1, fontWeight: '700', color: AYC.text},
  tpPct: {fontWeight: '800', color: AYC.positive},
  secHead: {fontWeight: '800', fontSize: 13, color: AYC.textMuted, paddingVertical: 8, backgroundColor: '#e2e8f0', paddingHorizontal: 8},
  subRow: {flexDirection: 'row', padding: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: AYC.cardBorder},
  subName: {fontSize: 12, fontWeight: '700', color: AYC.text},
  subCell: {fontSize: 11, fontWeight: '700', textAlign: 'right', color: AYC.text},
  horiz: {marginTop: 16},
  horizLabel: {fontSize: 12, fontWeight: '800', color: AYC.textMuted, textTransform: 'uppercase'},
  horizRow: {flexDirection: 'row', gap: 10, marginTop: 8},
  hzCard: {
    flex: 1,
    backgroundColor: AYC.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    padding: 14,
  },
  hzTitle: {fontSize: 15, fontWeight: '800', color: AYC.text},
  hzHint: {fontSize: 12, color: AYC.textMuted, marginTop: 4},
});
