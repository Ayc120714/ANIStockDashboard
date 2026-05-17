import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Box } from '@mui/material';
import { fetchWatchlistFundamentals } from '../api/watchlist';
import FundamentalTabContent from './FundamentalTabContent';

/** Legacy dialog wrapper — prefer WatchlistSymbolDetailPanel on LT/ST pages. */
export default function FundamentalTabsDialog({ open, symbol, onClose, technicalRow }) {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !symbol) return undefined;
    setLoading(true);
    setError('');
    fetchWatchlistFundamentals(symbol)
      .then(setSnapshot)
      .catch((e) => setError(e?.message || 'Not loaded'))
      .finally(() => setLoading(false));
    return undefined;
  }, [open, symbol]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{symbol} — Fundamentals</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ pt: 0.5 }}>
          <FundamentalTabContent
            symbol={symbol}
            snapshot={snapshot}
            loading={loading}
            error={error}
            technicalRow={technicalRow}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
