import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { fetchAdminPageVisitStats } from '../api/analytics';

const cardSx = {
  border: '1px solid #e5e7eb',
  borderRadius: 2,
  p: 1.5,
  bgcolor: '#fff',
  minWidth: 140,
  flex: '1 1 140px',
};

function StatCard({ label, uniqueVisitors, pageViews, loggedInViews }) {
  return (
    <Box sx={cardSx}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, lineHeight: 1.2 }}>
        {uniqueVisitors}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
        unique visitors
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.75, fontSize: 12 }}>
        <strong>{pageViews}</strong> page views
      </Typography>
      {loggedInViews != null ? (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 0.25 }}>
          {loggedInViews} while signed in
        </Typography>
      ) : null}
    </Box>
  );
}

function AdminPageVisitStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminPageVisitStats();
      setStats(res);
    } catch (err) {
      setStats(null);
      setError(err?.message || 'Could not load visit statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const periods = stats?.periods || {};
  const topPaths = Array.isArray(stats?.top_paths_30d) ? stats.top_paths_30d : [];

  return (
    <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.92)' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Site visits
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
            Unique visitors and page views across the app (IST calendar day for &quot;Today&quot;).
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {loading && !stats ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: topPaths.length ? 2 : 0 }}>
            <StatCard
              label="Today"
              uniqueVisitors={periods.today?.unique_visitors ?? 0}
              pageViews={periods.today?.page_views ?? 0}
              loggedInViews={periods.today?.logged_in_page_views ?? 0}
            />
            <StatCard
              label="Last 7 days"
              uniqueVisitors={periods.last_7_days?.unique_visitors ?? 0}
              pageViews={periods.last_7_days?.page_views ?? 0}
              loggedInViews={periods.last_7_days?.logged_in_page_views ?? 0}
            />
            <StatCard
              label="Last 30 days"
              uniqueVisitors={periods.last_30_days?.unique_visitors ?? 0}
              pageViews={periods.last_30_days?.page_views ?? 0}
              loggedInViews={periods.last_30_days?.logged_in_page_views ?? 0}
            />
            <StatCard
              label="All time"
              uniqueVisitors={periods.all_time?.unique_visitors ?? 0}
              pageViews={periods.all_time?.page_views ?? 0}
              loggedInViews={periods.all_time?.logged_in_page_views ?? 0}
            />
          </Box>

          {topPaths.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Top pages (30 days)
              </Typography>
              <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.25, fontSize: 13, color: 'text.secondary' }}>
                {topPaths.map((row) => (
                  <li key={row.path}>
                    <strong style={{ color: '#333' }}>{row.path}</strong>
                    {' — '}
                    {row.page_views} views
                  </li>
                ))}
              </Box>
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}

export default AdminPageVisitStats;
