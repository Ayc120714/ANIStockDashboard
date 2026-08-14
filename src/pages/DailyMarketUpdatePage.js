import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { fetchDailyMarketUpdate } from '../api/dailyMarketUpdate';
import {
  formatInrPrice,
  formatInrVolume,
  formatIndexValue,
  formatPctDelta,
  normalizeDailyMarketUpdatePayload,
  splitBoldSegments,
} from '../utils/dailyMarketUpdatePayload';

const PAGE_BG = '#f3f4f6';
const CARD_BG = '#ffffff';
const TEXT = '#1a1a1a';
const MUTED = '#6b7280';
const BLUE = '#2563eb';
const GREEN = '#16a34a';
const RED = '#dc2626';
const BORDER = '#e5e7eb';

function BoldText({ text, sx }) {
  const parts = splitBoldSegments(text);
  return (
    <Typography component="p" sx={{ fontSize: 15, lineHeight: 1.7, color: '#374151', m: 0, ...sx }}>
      {parts.map((p, i) =>
        p.bold ? (
          <Box key={i} component="strong" sx={{ color: TEXT, fontWeight: 700 }}>
            {p.text}
          </Box>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
    </Typography>
  );
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: TEXT, mb: 1.5, mt: 3.5 }}>
      {children}
    </Typography>
  );
}

function MetricCard({ label, value, pct }) {
  const delta = formatPctDelta(pct);
  return (
    <Box
      sx={{
        bgcolor: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: '10px',
        p: 2,
        minHeight: 96,
      }}
    >
      <Typography sx={{ fontSize: 11, letterSpacing: 0.6, color: MUTED, fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: TEXT, mt: 0.5 }}>{value}</Typography>
      {pct != null ? (
        <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 0.5, color: delta.positive ? GREEN : RED }}>
          {delta.text}
        </Typography>
      ) : null}
    </Box>
  );
}

function SignalCard({ label, value }) {
  return (
    <Box sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '10px', p: 2 }}>
      <Typography sx={{ fontSize: 11, letterSpacing: 0.6, color: MUTED, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: TEXT, mt: 0.5 }}>{value}</Typography>
    </Box>
  );
}

export default function DailyMarketUpdatePage() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await fetchDailyMarketUpdate({ volumeLimit: 10, sectorTopN: 5 });
      setPayload(normalizeDailyMarketUpdatePayload(raw));
    } catch (e) {
      setError(String(e?.message || 'Could not load daily market update'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !payload) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error && !payload) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>
        <Button size="small" variant="outlined" onClick={load}>Retry</Button>
      </Box>
    );
  }

  const b = payload.breadth;
  const advW = Math.max(b.advancesPct, 0);
  const uncW = Math.max(b.unchangedPct, 0);
  const decW = Math.max(b.declinesPct, 0);
  const barTotal = advW + uncW + decW || 1;

  return (
    <Box sx={{ bgcolor: PAGE_BG, mx: { xs: -2, md: -3.75 }, my: { xs: -2, md: -3.75 }, p: { xs: 2, md: 3.5 }, borderRadius: 1 }}>
      <Box sx={{ maxWidth: 980, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 12, letterSpacing: 1.2, color: MUTED, fontWeight: 600 }}>
              DAILY MARKET UPDATE
            </Typography>
            <Typography sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 800, color: TEXT, mt: 0.5, lineHeight: 1.2 }}>
              {payload.title}
            </Typography>
            <Typography sx={{ fontSize: 13, color: MUTED, mt: 1 }}>{payload.asOfLabel}</Typography>
            <Typography sx={{ fontSize: 13, color: MUTED }}>
              Last updated: {payload.lastUpdatedIst}
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={load} sx={{ textTransform: 'none', flexShrink: 0 }}>
            Refresh
          </Button>
        </Box>

        <Typography sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800, color: TEXT, mt: 3, mb: 1.5 }}>
          {payload.narratives.headline}
        </Typography>
        <Box sx={{ borderLeft: `4px solid ${BLUE}`, pl: 2, mb: 2 }}>
          <BoldText text={payload.narratives.executiveSummary} />
        </Box>
        <Box
          sx={{
            bgcolor: '#eef2f7',
            borderRadius: '8px',
            p: 1.5,
            display: 'flex',
            gap: 1.25,
            alignItems: 'flex-start',
            mb: 3,
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: BLUE, mt: 0.8, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 13, color: '#4b5563', lineHeight: 1.55 }}>
            {payload.narratives.disclaimer}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', p: 2.25 }}>
            <Typography sx={{ fontSize: 12, letterSpacing: 0.8, fontWeight: 700, color: MUTED, mb: 1.5 }}>
              MARKET BREADTH
            </Typography>
            <Box sx={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', mb: 2 }}>
              <Box sx={{ width: `${(100 * advW) / barTotal}%`, bgcolor: GREEN }} />
              <Box sx={{ width: `${(100 * uncW) / barTotal}%`, bgcolor: '#9ca3af' }} />
              <Box sx={{ width: `${(100 * decW) / barTotal}%`, bgcolor: RED }} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>ADVANCES</Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 800, color: GREEN }}>{b.advances}</Typography>
                <Typography sx={{ fontSize: 12, color: MUTED }}>{b.advancesPct}%</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>UNCHANGED</Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#6b7280' }}>{b.unchanged}</Typography>
                <Typography sx={{ fontSize: 12, color: MUTED }}>{b.unchangedPct}%</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>DECLINES</Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 800, color: RED }}>{b.declines}</Typography>
                <Typography sx={{ fontSize: 12, color: MUTED }}>{b.declinesPct}%</Typography>
              </Box>
            </Box>
            <Typography sx={{ textAlign: 'center', mt: 2, fontSize: 13, color: '#374151' }}>
              Advance / Decline ratio:{' '}
              <Box component="strong" sx={{ fontWeight: 800 }}>
                {b.advanceDeclineRatio == null ? '—' : b.advanceDeclineRatio}
              </Box>
            </Typography>
          </Box>

          <Box sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '12px', p: 2.25 }}>
            <Typography sx={{ fontSize: 12, letterSpacing: 0.8, fontWeight: 700, color: MUTED, mb: 1.5 }}>
              SECTOR PULSE
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: GREEN, mb: 1 }}>TOP GAINERS</Typography>
                {payload.sectorPulse.topGainers.map((row) => (
                  <Box key={row.code} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.55 }}>
                    <Typography sx={{ fontSize: 13, color: TEXT }}>{row.code}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: GREEN }}>
                      {formatPctDelta(row.pct).text.replace(/^↑\s*/, '')}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: RED, mb: 1 }}>TOP LOSERS</Typography>
                {payload.sectorPulse.topLosers.map((row) => (
                  <Box key={row.code} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.55 }}>
                    <Typography sx={{ fontSize: 13, color: TEXT }}>{row.code}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: RED }}>
                      {formatPctDelta(row.pct).text.replace(/^↓\s*/, '')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        <SectionTitle>Market Snapshot</SectionTitle>
        <BoldText text={payload.narratives.marketSnapshot} sx={{ mb: 1.5 }} />

        <SectionTitle>Index Performance</SectionTitle>
        <BoldText text={payload.narratives.indexPerformance} sx={{ mb: 1.5 }} />

        <SectionTitle>Sector Pulse</SectionTitle>
        <BoldText text={payload.narratives.sectorPulse} sx={{ mb: 2 }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 1.5,
          }}
        >
          {payload.indexCards.map((card) => (
            <MetricCard
              key={card.code}
              label={card.code}
              value={formatIndexValue(card.value)}
              pct={card.pct}
            />
          ))}
        </Box>

        <SectionTitle>What Drove the Action</SectionTitle>
        <BoldText text={payload.narratives.whatDroveAction} sx={{ mb: 1.5 }} />

        <SectionTitle>Volume &amp; Breadth</SectionTitle>
        <BoldText text={payload.narratives.volumeBreadth} sx={{ mb: 2 }} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 1.5,
          }}
        >
          {payload.volumeLeaders.map((row) => (
            <Box
              key={row.symbol}
              sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '10px', p: 2 }}
            >
              <Typography sx={{ fontSize: 11, letterSpacing: 0.6, color: MUTED, fontWeight: 600 }}>
                {row.symbol}
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT, mt: 0.5 }}>
                {formatInrVolume(row.volume)}
              </Typography>
              <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>{formatInrPrice(row.price)}</Typography>
            </Box>
          ))}
        </Box>

        <SectionTitle>What to Watch Tomorrow</SectionTitle>
        <BoldText text={payload.narratives.whatToWatch} sx={{ mb: 1.5 }} />

        <SectionTitle>Fresh Signals</SectionTitle>
        <BoldText text={payload.narratives.freshSignals} sx={{ mb: 2 }} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 1.5,
            pb: 2,
          }}
        >
          {['B1', 'B2', 'B3', 'S1', 'S2', 'S3'].map((tier) => (
            <SignalCard
              key={tier}
              label={`FRESH ${tier} SIGNALS`}
              value={payload.freshSignals[tier]}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
