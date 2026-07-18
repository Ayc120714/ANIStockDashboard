import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Pagination from '@mui/material/Pagination';
import { MdRefresh } from 'react-icons/md';
import { TableWrapper, Table } from './SectorOutlook.styles';
import { fetchBrokerConsensus, fetchBrokerConsensusDetail } from '../api/advisor';
import { SymbolWithTradingView, symbolCellTdStyle } from '../components/TradingViewLink';
import useDebouncedValue from '../hooks/useDebouncedValue';
import {
  BROKER_CONSENSUS_DISCLAIMER,
  CONFIDENCE_FILTER_OPTIONS,
  LABEL_FILTER_OPTIONS,
  ORIGIN_FILTER_OPTIONS,
  PAGE_SIZE_OPTIONS,
  SORT_OPTIONS,
  buildBrokerConsensusQueryParams,
  buildBrokerConsensusRecommendationRowKey,
  canOpenExternalHttpUrl,
  consensusConfidenceDisplay,
  consensusLabelDisplay,
  formatBrokerPrice,
  formatConsensusSummaryLine,
  formatIsoDate,
  formatUpsidePct,
  isNoCoverage,
  isSingleSourceView,
  labelChipColors,
  normalizedRatingDisplay,
  originDisplay,
} from '../utils/brokerConsensusDisplay';

const compact = { fontSize: 12, padding: '4px 6px', whiteSpace: 'nowrap' };
const AYC_BLUE = '#0b3d91';

function FilterSelect({ label, value, options, onChange, minWidth = 140 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth }}>
      <Typography variant="caption" sx={{ color: '#546e7a', fontWeight: 600, fontSize: 10 }}>
        {label}
      </Typography>
      <Select
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ fontSize: 12, height: 34 }}
        aria-label={label}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value || '__all__'} value={opt.value} sx={{ fontSize: 12 }}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

function ConsensusLabelChip({ label }) {
  const style = labelChipColors(label);
  return (
    <Chip
      size="small"
      label={consensusLabelDisplay(label)}
      sx={{ fontSize: 10, height: 20, fontWeight: 700, ...style }}
    />
  );
}

function UniverseRow({ item, onOpen }) {
  const singleSource = isSingleSourceView(item);
  const noCoverage = isNoCoverage(item);
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.symbol)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item.symbol);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <td style={symbolCellTdStyle}>
        <SymbolWithTradingView symbol={item.symbol}>{item.symbol}</SymbolWithTradingView>
      </td>
      <td style={compact}>{item.company_name || '—'}</td>
      <td style={compact}>
        <ConsensusLabelChip label={item.label} />
      </td>
      <td style={compact}>
        <Typography variant="caption" sx={{ fontSize: 11, color: '#37474f' }}>
          {formatConsensusSummaryLine(item)}
        </Typography>
        {singleSource ? (
          <Chip size="small" variant="outlined" label="Single-source view" sx={{ ml: 0.5, fontSize: 9, height: 18 }} />
        ) : null}
        {noCoverage ? (
          <Chip size="small" variant="outlined" label="No coverage" sx={{ ml: 0.5, fontSize: 9, height: 18 }} />
        ) : null}
      </td>
      <td style={compact}>{formatUpsidePct(item.target?.implied_upside_pct)}</td>
      <td style={compact}>{formatIsoDate(item.newest_call_date)}</td>
      <td style={compact}>
        {(item.domestic_count ?? 0)} / {(item.foreign_count ?? 0)}
      </td>
    </tr>
  );
}

function UniverseCard({ item, onOpen }) {
  const singleSource = isSingleSourceView(item);
  const noCoverage = isNoCoverage(item);
  return (
    <Card variant="outlined" sx={{ borderColor: '#e0e0e0' }}>
      <CardActionArea onClick={() => onOpen(item.symbol)}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
            <SymbolWithTradingView symbol={item.symbol}>
              <Typography component="span" sx={{ fontWeight: 700, color: AYC_BLUE, fontSize: 14 }}>
                {item.symbol}
              </Typography>
            </SymbolWithTradingView>
            <ConsensusLabelChip label={item.label} />
            {singleSource ? (
              <Chip size="small" variant="outlined" label="Single-source view" sx={{ fontSize: 9, height: 18 }} />
            ) : null}
            {noCoverage ? (
              <Chip size="small" variant="outlined" label="No coverage" sx={{ fontSize: 9, height: 18 }} />
            ) : null}
          </Box>
          <Typography variant="body2" sx={{ fontSize: 12, color: '#546e7a', mb: 0.5 }}>
            {item.company_name || '—'}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 11, color: '#37474f', lineHeight: 1.45 }}>
            {formatConsensusSummaryLine(item)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontSize: 11 }}>
              Upside: {formatUpsidePct(item.target?.implied_upside_pct)}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 11 }}>
              Newest: {formatIsoDate(item.newest_call_date)}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 11 }}>
              Dom/For: {(item.domestic_count ?? 0)}/{(item.foreign_count ?? 0)}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function DetailRecommendationsTable({ recommendations }) {
  if (!recommendations?.length) {
    return (
      <Typography variant="body2" sx={{ color: '#777', fontSize: 12, py: 1 }}>
        No active broker calls in coverage window.
      </Typography>
    );
  }
  return (
    <TableWrapper>
      <Table>
        <thead>
          <tr>
            <th>Institution</th>
            <th>Origin</th>
            <th>Rating</th>
            <th>Target</th>
            <th>Date</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {recommendations.map((rec, index) => (
            <tr key={buildBrokerConsensusRecommendationRowKey(rec, index)}>
              <td style={compact}>{rec.institution_name || '—'}</td>
              <td style={compact}>{originDisplay(rec.origin)}</td>
              <td style={compact}>
                <Tooltip title={rec.original_rating ? `Original: ${rec.original_rating}` : ''}>
                  <span>{normalizedRatingDisplay(rec.normalized_rating)}</span>
                </Tooltip>
              </td>
              <td style={compact}>{formatBrokerPrice(rec.target_price, rec.currency)}</td>
              <td style={compact}>{formatIsoDate(rec.recommendation_date)}</td>
              <td style={compact}>
                {canOpenExternalHttpUrl(rec.source_url) ? (
                  <Link
                    href={rec.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ fontSize: 11 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    View source
                  </Link>
                ) : (
                  '—'
                )}
                {rec.sebi_verified ? (
                  <Chip size="small" label="SEBI" sx={{ ml: 0.5, fontSize: 8, height: 16 }} />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
}

function BrokerConsensusDetailDialog({ open, symbol, onClose }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!open || !symbol) {
      setDetail(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBrokerConsensusDetail(symbol)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load broker consensus detail.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, symbol]);

  const summary = detail?.summary;
  const recommendations = detail?.recommendations || [];

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6, fontSize: 16 }}>
        <Box sx={{ flex: 1 }}>
          Broker Consensus — {symbol}
          {summary?.company_name ? (
            <Typography component="span" variant="body2" sx={{ display: 'block', color: '#546e7a', fontSize: 12 }}>
              {summary.company_name}
            </Typography>
          ) : null}
        </Box>
        <IconButton aria-label="Close detail" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {!loading && !error && summary ? (
          <>
            <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
              {BROKER_CONSENSUS_DISCLAIMER}
            </Alert>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
              <ConsensusLabelChip label={summary.label} />
              <Chip
                size="small"
                variant="outlined"
                label={consensusConfidenceDisplay(summary.confidence)}
                sx={{ fontSize: 10, height: 20 }}
              />
              {isSingleSourceView(summary) ? (
                <Chip size="small" color="warning" label="Single-source view" sx={{ fontSize: 10, height: 20 }} />
              ) : null}
              {isNoCoverage(summary) ? (
                <Chip size="small" color="default" label="No coverage" sx={{ fontSize: 10, height: 20 }} />
              ) : null}
            </Box>
            <Typography variant="body2" sx={{ fontSize: 12, mb: 1.5, color: '#37474f' }}>
              {formatConsensusSummaryLine(summary)}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <Typography variant="caption" sx={{ fontSize: 11 }}>
                Mean target: {formatBrokerPrice(summary.target?.mean)}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11 }}>
                Median target: {formatBrokerPrice(summary.target?.median)}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11 }}>
                Implied upside: {formatUpsidePct(summary.target?.implied_upside_pct)}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11 }}>
                As of: {formatIsoDate(summary.as_of)}
              </Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: AYC_BLUE, mb: 1, fontSize: 13 }}>
              Institution calls ({recommendations.length})
            </Typography>
            <DetailRecommendationsTable recommendations={recommendations} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function BrokerConsensusTab() {
  const theme = useTheme();
  const cardLayout = useMediaQuery(theme.breakpoints.down('md'));

  const [search, setSearch] = useState('');
  const [label, setLabel] = useState('');
  const [origin, setOrigin] = useState('');
  const [confidence, setConfidence] = useState('');
  const [sort, setSort] = useState('score_desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailSymbol, setDetailSymbol] = useState(null);
  const resetPage = useCallback(() => setPage(1), []);
  const debouncedSearch = useDebouncedValue(search, 350, resetPage);

  const queryFilters = useMemo(
    () => buildBrokerConsensusQueryParams({
      search: debouncedSearch,
      label,
      origin,
      confidence,
      sort,
      page,
      page_size: pageSize,
    }),
    [debouncedSearch, label, origin, confidence, sort, page, pageSize],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchBrokerConsensus(queryFilters, { normalized: true })
      .then((data) => setPayload(data))
      .catch((err) => setError(err?.message || 'Failed to load broker consensus.'))
      .finally(() => setLoading(false));
  }, [queryFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const items = payload?.items || [];
  const total = payload?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
        {BROKER_CONSENSUS_DISCLAIMER}
      </Alert>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'flex-end',
          mb: 2,
        }}
      >
        <TextField
          size="small"
          label="Search symbol or company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 220 }, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
          inputProps={{ 'aria-label': 'Search broker consensus' }}
        />
        <FilterSelect
          label="Label"
          value={label}
          options={LABEL_FILTER_OPTIONS}
          onChange={(value) => {
            setLabel(value);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Origin"
          value={origin}
          options={ORIGIN_FILTER_OPTIONS}
          onChange={(value) => {
            setOrigin(value);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Confidence"
          value={confidence}
          options={CONFIDENCE_FILTER_OPTIONS}
          onChange={(value) => {
            setConfidence(value);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Sort"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          minWidth={170}
        />
        <FilterSelect
          label="Page size"
          value={String(pageSize)}
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(value) => {
            setPageSize(Number(value));
            setPage(1);
          }}
          minWidth={90}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<MdRefresh />}
          onClick={load}
          sx={{ textTransform: 'none', height: 34 }}
        >
          Refresh
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
          {loading ? 'Loading…' : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
          {payload?.as_of ? ` · As of ${formatIsoDate(payload.as_of)}` : ''}
        </Typography>
      </Box>

      {loading && !payload ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {!loading && !error && items.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No symbols match your filters. Try clearing filters or search for a different symbol.
        </Alert>
      ) : null}

      {!cardLayout && items.length > 0 ? (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Company</th>
                <th>Label</th>
                <th>Summary</th>
                <th>Upside</th>
                <th>Newest call</th>
                <th>Dom/For</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <UniverseRow key={item.symbol} item={item} onOpen={setDetailSymbol} />
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      ) : null}

      {cardLayout && items.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr' }}>
          {items.map((item) => (
            <UniverseCard key={item.symbol} item={item} onOpen={setDetailSymbol} />
          ))}
        </Box>
      ) : null}

      {totalPages > 1 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
            size="small"
            siblingCount={1}
            boundaryCount={1}
          />
        </Box>
      ) : null}

      <BrokerConsensusDetailDialog
        open={Boolean(detailSymbol)}
        symbol={detailSymbol}
        onClose={() => setDetailSymbol(null)}
      />
    </Box>
  );
}
