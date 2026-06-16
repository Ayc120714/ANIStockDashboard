import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import {
  addAdminUser,
  addPremiumEmail,
  deleteAdminUser,
  deletePremiumEmail,
  fetchAdminUsers,
  fetchPremiumEmails,
  setUserPaidPremium,
} from '../api/auth';
import AdminUserDirectoryTables from '../components/AdminUserDirectoryTables';
import AdminPageVisitStats from '../components/AdminPageVisitStats';
import { Table, TableSection, TableTitle, TableWrapper } from './SectorOutlook.styles';

const compact = { fontSize: 12, padding: '6px 8px', whiteSpace: 'nowrap' };

function isMonthlyPremiumUser(row) {
  if (row.premium_lifetime) return false;
  if (row.paid_premium_active && row.premium_plan === 'monthly') return true;
  return Boolean(row.premium_complimentary || row.on_premium_allowlist);
}

function isYearlyPremiumUser(row) {
  if (row.premium_lifetime) return false;
  if (!row.paid_premium_active) return false;
  return row.premium_plan === 'yearly' || !row.premium_plan;
}

function isBasicUser(row) {
  return !row.premium_lifetime && !isMonthlyPremiumUser(row) && !isYearlyPremiumUser(row);
}

const isMissingResourceError = (err) => {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('not found') || msg.includes('404');
};

function AdminUsersPage() {
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [search, setSearch] = useState('');
  const [highlightUserId, setHighlightUserId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const [paidTarget, setPaidTarget] = useState(null);

  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  const [premiumRows, setPremiumRows] = useState([]);
  const [premiumLoading, setPremiumLoading] = useState(true);
  const [premiumEmail, setPremiumEmail] = useState('');
  const [premiumError, setPremiumError] = useState('');
  const [premiumMessage, setPremiumMessage] = useState('');
  const [premiumBusy, setPremiumBusy] = useState(false);

  const loadPremiumEmails = useCallback(async () => {
    setPremiumLoading(true);
    setPremiumError('');
    try {
      const res = await fetchPremiumEmails();
      setPremiumRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      if (isMissingResourceError(err)) {
        setPremiumRows([]);
      } else {
        setPremiumError(err?.message || 'Failed to load premium email list.');
      }
    } finally {
      setPremiumLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminUsers(includeInactive);
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      if (isMissingResourceError(err)) {
        setRows([]);
      } else {
        setError(err?.message || 'Failed to load users.');
      }
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const id = location.state?.highlightUserId;
    if (!id) return;
    setHighlightUserId(Number(id));
    const row = rows.find((r) => r.id === Number(id));
    if (row?.email) {
      setSearch(String(row.email));
      setMessage(`Opened from notification — review ${row.email}.`);
    }
  }, [location.state?.highlightUserId, rows]);

  useEffect(() => {
    loadPremiumEmails();
  }, [loadPremiumEmails]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      return (
        String(r.id || '').includes(term) ||
        String(r.email || '').toLowerCase().includes(term) ||
        String(r.mobile || '').toLowerCase().includes(term) ||
        String(r.full_name || '').toLowerCase().includes(term)
      );
    });
  }, [rows, search]);

  const tierLifetimeUsers = useMemo(
    () => filteredRows.filter((r) => Boolean(r.premium_lifetime)),
    [filteredRows],
  );
  const tierMonthlyPremiumUsers = useMemo(
    () => filteredRows.filter((r) => isMonthlyPremiumUser(r)),
    [filteredRows],
  );
  const tierYearlyPremiumUsers = useMemo(
    () => filteredRows.filter((r) => isYearlyPremiumUser(r)),
    [filteredRows],
  );
  const tierBasicUsers = useMemo(
    () => filteredRows.filter((r) => isBasicUser(r)),
    [filteredRows],
  );

  const canCreate = useMemo(() => {
    const em = email.trim();
    const mb = mobile.replace(/\D/g, '');
    const mobileOk = !mb || (mb.length >= 8 && mb.length <= 15);
    return em.includes('@') && em.length > 5 && mobileOk;
  }, [email, mobile]);

  const onCreate = async () => {
    if (!canCreate) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const cleanMobile = mobile.replace(/\D/g, '');
      const res = await addAdminUser({
        email: email.trim(),
        ...(cleanMobile ? { mobile: cleanMobile } : {}),
      });
      const pw = res?.temporary_password;
      setMessage(
        pw
          ? `User created. One-time password (copy now): ${pw}`
          : `User ${res?.action || 'saved'} successfully.`,
      );
      setEmail('');
      setMobile('');
      await loadUsers();
    } catch (err) {
      setError(err?.message || 'Unable to add user.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    const userId = deleteTarget?.id;
    if (!userId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminUser(userId);
      setMessage(`User ${deleteTarget?.email || userId} deleted permanently.`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err?.message || 'Unable to delete user.');
    } finally {
      setBusy(false);
    }
  };

  const canAddPremium = premiumEmail.trim().includes('@') && premiumEmail.trim().length > 5;

  const onAddPremiumEmail = async () => {
    if (!canAddPremium) return;
    setPremiumBusy(true);
    setPremiumError('');
    setPremiumMessage('');
    try {
      await addPremiumEmail(premiumEmail.trim());
      setPremiumMessage(`Premium access granted for ${premiumEmail.trim()}.`);
      setPremiumEmail('');
      await loadPremiumEmails();
    } catch (err) {
      setPremiumError(err?.message || 'Unable to add email.');
    } finally {
      setPremiumBusy(false);
    }
  };

  const onSubmitPaidPremium = async () => {
    if (!paidTarget) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await setUserPaidPremium(paidTarget.id, paidTarget.plan || 'yearly');
      const planLabel = (paidTarget.plan || 'yearly') === 'monthly' ? 'Monthly' : 'Yearly';
      const ist = res?.paid_premium_until_ist ? ` (through ${res.paid_premium_until_ist})` : '';
      setMessage(`${planLabel} premium recorded for ${paidTarget.email}${ist}.`);
      setPaidTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err?.message || 'Unable to record payment.');
    } finally {
      setBusy(false);
    }
  };

  const onRemovePremiumEmail = async (row) => {
    if (!row?.id) return;
    setPremiumBusy(true);
    setPremiumError('');
    setPremiumMessage('');
    try {
      await deletePremiumEmail(row.id);
      setPremiumMessage(`Removed ${row.email} from premium list.`);
      await loadPremiumEmails();
    } catch (err) {
      setPremiumError(err?.message || 'Unable to remove email.');
    } finally {
      setPremiumBusy(false);
    }
  };

  return (
    <TableSection>
      <TableTitle>Admin User Management</TableTitle>

      <AdminPageVisitStats />

      <Box sx={{ fontSize: 13, color: 'text.secondary', mb: 2, lineHeight: 1.5 }}>
        Creating or approving a user grants <strong>one month</strong> of premium on first approval (then basic after expiry).
        Below, users are split into <strong>Lifetime members</strong>, <strong>Monthly premium</strong> (monthly paid,
        complimentary, or allowlist), <strong>Yearly premium</strong> (active yearly paid term), and <strong>Basic</strong>.
        Use <strong>Grant monthly</strong> / <strong>Grant yearly</strong> to extend paid access (IST).
      </Box>
      <Box
        component="ol"
        sx={{
          fontSize: 13,
          color: 'text.secondary',
          mb: 2,
          pl: 2.5,
          lineHeight: 1.65,
          '& li': { mb: 0.75 },
        }}
      >
        <Box component="li">
          <strong>Basic → premium (multi-select):</strong> open the <strong>Basic users</strong> table, tick the checkbox on
          each row (or the header to select all visible rows), then use <strong>Complimentary premium for selected</strong>.
          The server stores that in one database commit (up to 200 users per action).
        </Box>
        <Box component="li">
          <strong>Premium → lifetime (multi-select):</strong> open <strong>Monthly premium</strong> or <strong>Yearly premium</strong>, select rows,
          then <strong>Lifetime premium for selected</strong>. From <strong>Basic</strong> you can instead choose{' '}
          <strong>Lifetime premium for selected</strong> to grant lifetime in one step. Both use a single DB commit per bulk
          action.
        </Box>
        <Box component="li">
          <strong>Lifetime → complimentary (multi-select):</strong> open <strong>Lifetime members</strong>, select rows, then{' '}
          <strong>Move selected to complimentary</strong>. Or use <strong>Move to complimentary</strong> on a single row.
        </Box>
        <Box component="li">
          Single-row actions (Block, Record payment, etc.) stay in each row’s <strong>Action</strong> column.
        </Box>
      </Box>

      <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2, mb: 2, bgcolor: '#fff' }}>
        <Box sx={{ fontWeight: 700, mb: 0.5 }}>Premium email access</Box>
        <Box sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
          When the premium paywall is on, these emails get full access without using per-user <strong>Record payment</strong>.
          Use this list for partners or manual overrides; paying customers can instead use <strong>Record payment</strong> on
          their user row. Emails must match the account login email after normalization.
        </Box>
        {premiumError ? <Alert severity="error" sx={{ mb: 1.5 }}>{premiumError}</Alert> : null}
        {premiumMessage ? <Alert severity="success" sx={{ mb: 1.5 }}>{premiumMessage}</Alert> : null}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start', mb: 1.5 }}>
          <TextField
            size="small"
            label="Email to grant premium"
            value={premiumEmail}
            onChange={(e) => setPremiumEmail(e.target.value)}
            sx={{ minWidth: 280 }}
            disabled={premiumBusy}
          />
          <Button variant="contained" onClick={onAddPremiumEmail} disabled={!canAddPremium || premiumBusy} sx={{ mt: 0.25 }}>
            Add to list
          </Button>
          <Button variant="outlined" onClick={loadPremiumEmails} disabled={premiumBusy || premiumLoading}>
            Refresh list
          </Button>
        </Box>
        {premiumLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <th style={compact}>ID</th>
                  <th style={compact}>Email</th>
                  <th style={compact}>Added</th>
                  <th style={compact}>Action</th>
                </tr>
              </thead>
              <tbody>
                {premiumRows.map((row) => (
                  <tr key={row.id}>
                    <td style={compact}>{row.id}</td>
                    <td style={compact}>{row.email}</td>
                    <td style={compact}>{row.created_at || '—'}</td>
                    <td style={compact}>
                      <Button
                        size="small"
                        color="warning"
                        variant="outlined"
                        disabled={premiumBusy}
                        onClick={() => onRemovePremiumEmail(row)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {premiumRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                      No premium emails yet. Add one above when a customer should bypass the paywall.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

      <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2, mb: 2, bgcolor: '#fff' }}>
        <Box sx={{ fontWeight: 700, mb: 1 }}>Add User</Box>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <TextField size="small" label="Email (User ID)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            size="small"
            label="Mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            inputProps={{ inputMode: 'tel', maxLength: 20 }}
            helperText="Optional: 8-15 digits, country code included (no + or spaces)"
          />
        </Box>
        <Box sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}>
          A secure one-time password is generated by the server and shown once after the user is created.
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={onCreate} disabled={!canCreate || busy}>Add User</Button>
          <Button variant="outlined" onClick={loadUsers} disabled={busy}>Refresh</Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Switch
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
          }
          label="Show inactive (old IDs)"
        />
        <TextField
          size="small"
          placeholder="Search id/email/mobile/name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <AdminUserDirectoryTables
          tierLifetimeUsers={tierLifetimeUsers}
          tierMonthlyPremiumUsers={tierMonthlyPremiumUsers}
          tierYearlyPremiumUsers={tierYearlyPremiumUsers}
          tierBasicUsers={tierBasicUsers}
          highlightUserId={highlightUserId}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setMessage={setMessage}
          loadUsers={loadUsers}
          setPaidTarget={setPaidTarget}
          setDeleteTarget={setDeleteTarget}
        />
      )}

      <Dialog open={Boolean(paidTarget)} onClose={() => !busy && setPaidTarget(null)}>
        <DialogTitle>
          {paidTarget?.plan === 'monthly' ? 'Grant monthly premium (IST)' : 'Grant yearly premium (IST)'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            User <strong>{paidTarget?.email || ''}</strong>. This records{' '}
            <strong>{paidTarget?.plan === 'monthly' ? 'one calendar month' : 'one calendar year'}</strong> of paid
            premium from the later of <em>now</em> (Asia/Kolkata) and the current subscription end (if still active).
          </DialogContentText>
          <DialogContentText sx={{ color: 'text.secondary', fontSize: 13 }}>
            After the term ends, the user automatically returns to <strong>basic</strong> until you grant again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaidTarget(null)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={onSubmitPaidPremium} disabled={busy}>
            Confirm {paidTarget?.plan === 'monthly' ? 'monthly' : 'yearly'} premium
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete user <strong>{deleteTarget?.email || ''}</strong> permanently from DB?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</Button>
          <Button onClick={onDelete} color="error" variant="contained" disabled={busy}>Delete</Button>
        </DialogActions>
      </Dialog>
    </TableSection>
  );
}

export default AdminUsersPage;
