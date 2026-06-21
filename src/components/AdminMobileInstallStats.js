import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { fetchAdminMobileInstallStats } from '../api/auth';

const cardSx = {
  border: '1px solid #e5e7eb',
  borderRadius: 2,
  p: 1.5,
  bgcolor: '#fff',
  minWidth: 140,
  flex: '1 1 140px',
};

function StatCard({ label, value, hint }) {
  return (
    <Box sx={cardSx}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, lineHeight: 1.2 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12, mt: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

function AdminMobileInstallStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminMobileInstallStats();
      setStats(res?.stats || null);
    } catch (err) {
      setStats(null);
      setError(err?.message || 'Could not load mobile install statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byVersion = Array.isArray(stats?.by_version) ? stats.by_version : [];

  return (
    <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.92)' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Mobile app installs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
            APK downloads and authenticated Android installs/opens (all-time totals unless noted).
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: byVersion.length ? 2 : 0 }}>
            <StatCard
              label="APK downloads"
              value={stats?.apk_downloads_total ?? 0}
              hint="download events tracked"
            />
            <StatCard
              label="Users installed"
              value={stats?.unique_users_installed ?? 0}
              hint="unique signed-in users"
            />
            <StatCard
              label="Devices installed"
              value={stats?.unique_devices_installed ?? 0}
              hint="unique device IDs"
            />
            <StatCard
              label="Active users (7d)"
              value={stats?.active_users_last_7_days ?? 0}
              hint="opened app in last 7 days"
            />
            <StatCard
              label="Active users (30d)"
              value={stats?.active_users_last_30_days ?? 0}
              hint="opened app in last 30 days"
            />
            <StatCard
              label="Active devices (7d)"
              value={stats?.active_devices_last_7_days ?? 0}
              hint="devices opened in last 7 days"
            />
          </Box>

          {byVersion.length > 0 ? (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Installs by app version
              </Typography>
              <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.25, fontSize: 13, color: 'text.secondary' }}>
                {byVersion.map((row) => (
                  <li key={row.version}>
                    <strong style={{ color: '#333' }}>v{row.version}</strong>
                    {' — '}
                    {row.devices} device{row.devices === 1 ? '' : 's'}
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

export default AdminMobileInstallStats;
