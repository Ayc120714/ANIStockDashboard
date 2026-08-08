import React, { useCallback, useEffect, useState } from 'react';
import { TableTitle, TableWrapper, Table } from '../pages/SectorOutlook.styles';
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { fetchHotSubsectors } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle } from './TradingViewLink';
import { formatAlertTimeIST } from '../utils/alertInboxUtils';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { runLiveMarketPageMountPoll } from '../utils/screenPageLoader';

const POLL_MS = 30 * 1000;
const CACHE_KEY = 'advisor_hot_subsectors_v1';
const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };

export default function HotSubsectorsTable() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [threshold, setThreshold] = useState(75);

  const load = useCallback(async ({ silent = false, forceNetwork = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      if (!forceNetwork) {
        const cached = readPageCache(CACHE_KEY);
        if (cached?.subsectors?.length) {
          setGroups(cached.subsectors);
          setThreshold(cached.threshold_all ?? 75);
          setLastSync(cached.updatedAt || null);
          if (!silent) setLoading(false);
        }
      }
      const payload = await fetchHotSubsectors({ top_stocks: 5, max_subsectors: 40 });
      const list = Array.isArray(payload?.subsectors)
        ? payload.subsectors
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      setGroups(list);
      setThreshold(Number(payload?.threshold_all) || 75);
      setLastSync(new Date().toISOString());
      writePageCache(CACHE_KEY, {
        subsectors: list,
        threshold_all: payload?.threshold_all ?? 75,
      });
    } catch (e) {
      setError(String(e?.message || 'Could not load Hot Subsectors'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cleanup;
    runLiveMarketPageMountPoll({
      load,
      liveIntervalMs: POLL_MS,
      onCleanup: (fn) => { cleanup = fn; },
    });
    return () => { if (cleanup) cleanup(); };
  }, [load]);

  return (
    <Box id="advisor-hot-subsectors" sx={{ mb: 2 }}>
      <TableTitle style={{ fontSize: 15, marginBottom: 8, color: '#0b3d91' }}>
        Hot Subsectors
      </TableTitle>
      <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary', maxWidth: 720 }}>
        Subsectors with ALL &gt; {threshold} on AYC Subsector Outlook. Top 5 stocks per list by CHG%.
        Updates with live market data and weekly subsector refreshes.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
        <Chip size="small" label={`${groups.length} hot subsectors`} variant="outlined" />
        <Chip size="small" label={`ALL > ${threshold}`} color="primary" variant="outlined" />
        {lastSync ? (
          <Chip size="small" label={`Updated ${formatAlertTimeIST(lastSync)}`} variant="outlined" />
        ) : null}
        <Button size="small" variant="outlined" onClick={() => load({ forceNetwork: true })}>
          Refresh
        </Button>
      </Box>

      {loading && !groups.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}
      {error ? (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      ) : null}
      {!loading && !error && !groups.length ? (
        <Typography variant="body2" color="text.secondary">
          No subsectors currently above ALL {threshold}. Check back as the week updates.
        </Typography>
      ) : null}

      {groups.map((g) => {
        const stocks = Array.isArray(g.stocks) ? g.stocks : [];
        return (
          <Box key={`${g.sector}|${g.subsector}`} sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 0.75 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                {g.subsector}
              </Typography>
              <Chip size="small" label={g.sector || '—'} variant="outlined" />
              <Chip
                size="small"
                label={`ALL ${g.all}`}
                sx={{ bgcolor: 'rgba(11,61,145,0.12)', fontWeight: 600 }}
              />
              {g.trend && g.trend !== '—' ? (
                <Chip size="small" label={`Trend ${g.trend}`} variant="outlined" />
              ) : null}
            </Box>
            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <th style={compact}>#</th>
                    <th style={compact}>Symbol</th>
                    <th style={compact}>CMP</th>
                    <th style={compact}>CHG%</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={compact}>No stocks</td>
                    </tr>
                  ) : (
                    stocks.map((s, idx) => {
                      const chg = String(s.chg || '');
                      const down = chg.startsWith('-');
                      return (
                        <tr key={s.symbol || idx}>
                          <td style={compact}>{idx + 1}</td>
                          <td style={{ ...compact, ...symbolCellTdStyle }}>
                            <SymbolWithTradingView symbol={s.symbol} />
                          </td>
                          <td style={compact}>
                            {s.cmp != null ? Number(s.cmp).toLocaleString('en-IN') : '—'}
                          </td>
                          <td
                            style={{
                              ...compact,
                              color: down ? '#c62828' : '#2e7d32',
                              fontWeight: 600,
                            }}
                          >
                            {s.chg || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </TableWrapper>
          </Box>
        );
      })}
    </Box>
  );
}
