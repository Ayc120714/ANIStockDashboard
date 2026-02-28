import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from '@mui/material';
import { TableSection, TableTitle, TableWrapper, Table } from './SectorOutlook.styles';
import { deleteTelegramSubscriber, fetchTelegramSubscribers, setTelegramSubscriberApproval } from '../api/telegram';

const compact = { fontSize: 12, padding: '6px 8px', whiteSpace: 'nowrap' };

const validateSubscriber = (row) => {
  const checks = [];
  if (!row?.chat_id) checks.push('Missing chat id');
  if (row?.chat_id && !/^-?\d+$/.test(String(row.chat_id))) checks.push('Chat id must be numeric');
  if (!row?.last_seen) checks.push('Missing last seen');
  if (row?.is_active !== true) checks.push('Subscriber inactive');
  return {
    ok: checks.length === 0,
    checks,
  };
};

function TelegramAdminPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [busyChatIds, setBusyChatIds] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const approvedOnly = statusFilter === 'approved';
      const data = await fetchTelegramSubscribers({ activeOnly, approvedOnly });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load telegram subscribers');
    } finally {
      setLoading(false);
    }
  }, [activeOnly, statusFilter]);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      loadSubscribers();
    }, 10000);
    return () => window.clearInterval(timerId);
  }, [loadSubscribers]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    let next = rows;
    if (statusFilter === 'pending') {
      next = next.filter((r) => !r.is_approved);
    } else if (statusFilter === 'approved') {
      next = next.filter((r) => !!r.is_approved);
    }
    if (!term) return next;
    return next.filter((r) => {
      const user = `${r.username || ''} ${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
      return String(r.chat_id || '').toLowerCase().includes(term) || user.includes(term);
    });
  }, [rows, search, statusFilter]);

  const setApproval = async (row, isApproved) => {
    const chatId = String(row.chat_id || '');
    if (!chatId) return;
    setBusyChatIds((prev) => ({ ...prev, [chatId]: true }));
    try {
      await setTelegramSubscriberApproval(chatId, isApproved);
      setRows((prev) =>
        prev.map((r) => (String(r.chat_id) === chatId ? { ...r, is_approved: isApproved } : r))
      );
    } catch (err) {
      setError(err?.message || 'Failed to update approval');
    } finally {
      setBusyChatIds((prev) => ({ ...prev, [chatId]: false }));
    }
  };

  const removeSubscriber = async (chatId) => {
    if (!chatId) return;
    setBusyChatIds((prev) => ({ ...prev, [chatId]: true }));
    try {
      await deleteTelegramSubscriber(chatId);
      setRows((prev) => prev.filter((r) => String(r.chat_id) !== chatId));
      setDeleteTarget(null);
    } catch (err) {
      setError(err?.message || 'Failed to delete subscriber');
    } finally {
      setBusyChatIds((prev) => ({ ...prev, [chatId]: false }));
    }
  };

  return (
    <TableSection>
      <TableTitle>Telegram Approval Admin</TableTitle>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          size="small"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="pending">Pending Approval</MenuItem>
          <MenuItem value="approved">Approved</MenuItem>
        </Select>
        <Select
          size="small"
          value={activeOnly ? 'active' : 'all'}
          onChange={(e) => setActiveOnly(e.target.value === 'active')}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="active">Active Only</MenuItem>
          <MenuItem value="all">Active + Inactive</MenuItem>
        </Select>
        <TextField
          size="small"
          placeholder="Search chat id / user"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={loadSubscribers}>
          Refresh
        </Button>
      </Box>
      <Box sx={{ color: '#666', fontSize: 12, mb: 1 }}>Live sync is enabled (auto refresh every 10s).</Box>

      {error ? (
        <Box sx={{ color: '#c62828', fontWeight: 600, mb: 1 }}>{error}</Box>
      ) : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <th style={compact}>Chat ID</th>
                <th style={compact}>Username</th>
                <th style={compact}>Name</th>
                <th style={compact}>Active</th>
                <th style={compact}>Approved</th>
                <th style={compact}>Validation</th>
                <th style={compact}>Last Seen</th>
                <th style={compact}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const result = validateSubscriber(row);
                const chatId = String(row.chat_id || '');
                const busy = !!busyChatIds[chatId];
                return (
                  <tr key={chatId}>
                    <td style={compact}>{chatId || '—'}</td>
                    <td style={compact}>{row.username || '—'}</td>
                    <td style={compact}>
                      {[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td style={compact}>{row.is_active ? 'Yes' : 'No'}</td>
                    <td style={{ ...compact, fontWeight: 700, color: row.is_approved ? '#2e7d32' : '#ed6c02' }}>
                      {row.is_approved ? 'Approved' : 'Pending'}
                    </td>
                    <td style={compact}>
                      <Tooltip title={result.ok ? 'Validation passed' : result.checks.join(' | ')}>
                        <span style={{ fontWeight: 700, color: result.ok ? '#2e7d32' : '#c62828' }}>
                          {result.ok ? 'PASS' : 'REVIEW'}
                        </span>
                      </Tooltip>
                    </td>
                    <td style={compact}>{row.last_seen || '—'}</td>
                    <td style={compact}>
                      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                        {row.is_approved ? (
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => setApproval(row, false)}
                          >
                            Revoke
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            color="success"
                            variant="contained"
                            disabled={busy || !result.ok}
                            onClick={() => setApproval(row, true)}
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          disabled={busy}
                          onClick={() => setDeleteTarget(chatId)}
                        >
                          Delete
                        </Button>
                      </Box>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                    No subscribers found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </TableWrapper>
      )}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Subscriber</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete subscriber <strong>{deleteTarget || ''}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={!!busyChatIds[String(deleteTarget || '')]}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!!busyChatIds[String(deleteTarget || '')]}
            onClick={() => removeSubscriber(String(deleteTarget || ''))}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </TableSection>
  );
}

export default TelegramAdminPage;
