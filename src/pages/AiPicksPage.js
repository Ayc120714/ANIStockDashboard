import React, { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, IconButton, Tooltip, Chip } from '@mui/material';
import { MdRefresh, MdPlaylistAdd, MdCheck } from 'react-icons/md';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { fetchWeeklyPicks, triggerWeeklyPicks } from '../api/stocks';
import { addToWatchlist } from '../api/watchlist';

const gradeColor = { A: '#1b5e20', B: '#2e7d32', C: '#f57f17', D: '#c62828' };
const gradeBg = { A: '#e8f5e9', B: '#f1f8e9', C: '#fff8e1', D: '#ffebee' };

function AiPicksPage() {
  const [data, setData] = useState({ bullish: [], bearish: [], pick_date: null });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchWeeklyPicks();
      setData({
        bullish: resp?.bullish ?? [],
        bearish: resp?.bearish ?? [],
        pick_date: resp?.pick_date ?? null,
      });
    } catch (e) {
      setError(e?.message || 'Failed to load weekly picks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerWeeklyPicks();
    } catch (_) { /* ignore */ }
    setTriggering(false);
  };

  const handleAdd = async (symbol, listType) => {
    const key = `${symbol}_${listType}`;
    if (added[key]) return;
    try {
      await addToWatchlist(symbol.toUpperCase(), listType, '');
      setAdded(prev => ({ ...prev, [key]: true }));
    } catch (_) { /* ignore */ }
  };

  const fmt = (v, decimals = 2) => {
    if (v == null) return '—';
    return Number(v).toFixed(decimals);
  };

  const renderTable = (rows, type) => {
    const isBullish = type === 'bullish';
    const headerBg = isBullish ? '#1b5e20' : '#b71c1c';
    const title = isBullish ? 'Top 5 Bullish Picks' : 'Top 5 Bearish Picks';

    return (
      <TableSection style={{ marginTop: 0 }}>
        <TableTitle style={{ color: headerBg }}>{title}</TableTitle>
        <TableWrapper>
          <Table>
            <thead style={{ backgroundColor: headerBg }}>
              <tr>
                <th>#</th>
                <th>Symbol</th>
                <th>Sector</th>
                <th>Grade</th>
                <th>CMP</th>
                <th>Entry</th>
                <th>SL</th>
                <th>SL%</th>
                <th>T1</th>
                <th>T2</th>
                <th>R:R</th>
                <th>Reco</th>
                <th>Strength</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                    No {type} picks available yet. Run the analysis to generate picks.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const shortKey = `${r.symbol}_short_term`;
                const longKey = `${r.symbol}_long_term`;
                return (
                  <tr key={r.symbol}>
                    <td className="index">{String(i + 1).padStart(2, '0')}</td>
                    <td style={{ fontWeight: 700 }}>{r.symbol}</td>
                    <td>{r.sector || '—'}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 4,
                        fontWeight: 700,
                        fontSize: 13,
                        color: gradeColor[r.grade] || '#333',
                        background: gradeBg[r.grade] || '#f5f5f5',
                      }}>
                        {r.grade}
                      </span>
                    </td>
                    <td>{fmt(r.cmp)}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(r.entry_price)}</td>
                    <td style={{ color: '#c62828' }}>{fmt(r.stop_loss)}</td>
                    <td style={{ color: (r.sl_pct && r.sl_pct < 3) ? '#2e7d32' : '#c62828' }}>
                      {r.sl_pct != null ? `${fmt(r.sl_pct)}%` : '—'}
                    </td>
                    <td style={{ color: '#1b5e20', fontWeight: 600 }}>{fmt(r.target_1)}</td>
                    <td style={{ color: '#1b5e20', fontWeight: 600 }}>{fmt(r.target_2)}</td>
                    <td style={{ fontWeight: 700 }}>{r.rr_ratio != null ? `${fmt(r.rr_ratio, 1)}` : '—'}</td>
                    <td>
                      <Chip
                        label={(r.recommendation || '—').toUpperCase()}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: 11,
                          bgcolor: r.recommendation?.includes('buy') ? '#e8f5e9'
                            : r.recommendation?.includes('sell') ? '#ffebee'
                            : '#f5f5f5',
                          color: r.recommendation?.includes('buy') ? '#1b5e20'
                            : r.recommendation?.includes('sell') ? '#b71c1c'
                            : '#333',
                        }}
                      />
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        fontSize: 12,
                        color: r.trend_strength === 'strong' ? '#1b5e20'
                          : r.trend_strength === 'moderate' ? '#f57f17'
                          : '#888',
                      }}>
                        {(r.trend_strength || '—').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={added[shortKey] ? 'Added to Short Term' : 'Add to Short Term'}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!!added[shortKey]}
                              onClick={() => handleAdd(r.symbol, 'short_term')}
                              sx={{
                                bgcolor: added[shortKey] ? '#e8f5e9' : '#e3f2fd',
                                color: added[shortKey] ? '#2e7d32' : '#1565c0',
                                fontSize: 16,
                                '&:hover': { bgcolor: added[shortKey] ? '#e8f5e9' : '#bbdefb' },
                              }}
                            >
                              {added[shortKey] ? <MdCheck /> : <MdPlaylistAdd />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={added[longKey] ? 'Added to Long Term' : 'Add to Long Term'}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!!added[longKey]}
                              onClick={() => handleAdd(r.symbol, 'long_term')}
                              sx={{
                                bgcolor: added[longKey] ? '#e8f5e9' : '#fff3e0',
                                color: added[longKey] ? '#2e7d32' : '#e65100',
                                fontSize: 16,
                                '&:hover': { bgcolor: added[longKey] ? '#e8f5e9' : '#ffe0b2' },
                              }}
                            >
                              {added[longKey] ? <MdCheck /> : <MdPlaylistAdd />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>
      </TableSection>
    );
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0b3d91' }}>
            Weekly AI Picks
          </h2>
          {data.pick_date && (
            <span style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              Generated: {data.pick_date}
            </span>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Refresh picks">
            <IconButton onClick={load} size="small">
              <MdRefresh size={20} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Run analysis now (runs in background)">
            <span>
              <IconButton
                onClick={handleTrigger}
                disabled={triggering}
                size="small"
                sx={{ bgcolor: '#e3f2fd', '&:hover': { bgcolor: '#bbdefb' } }}
              >
                {triggering ? <CircularProgress size={18} /> : <MdRefresh size={20} color="#1565c0" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <div style={{ color: '#dc3545', fontWeight: 600, marginBottom: 16 }}>{error}</div>
      )}

      {!loading && !error && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}>
          {renderTable(data.bullish, 'bullish')}
          {renderTable(data.bearish, 'bearish')}
        </Box>
      )}

      {!loading && !error && data.bullish.length === 0 && data.bearish.length === 0 && (
        <Box sx={{
          textAlign: 'center', py: 6, color: '#888',
          border: '2px dashed #e0e0e0', borderRadius: 2, mt: 2,
        }}>
          <p style={{ fontSize: 16, margin: 0 }}>
            No weekly picks available yet.
          </p>
          <p style={{ fontSize: 14, margin: '8px 0 0', color: '#aaa' }}>
            Picks are generated automatically every Saturday at 2:00 AM, or click the refresh button to trigger manually.
          </p>
        </Box>
      )}
    </div>
  );
}

export default AiPicksPage;
