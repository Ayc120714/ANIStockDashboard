import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, Checkbox, Typography } from '@mui/material';
import {
  approveAdminUserAccessLink,
  blockAdminUser,
  bulkMoveUserLifetimeToComplimentary,
  bulkSetUserComplimentaryPremium,
  bulkSetUserLifetimePremium,
  clearUserPaidPremium,
  moveUserLifetimeToComplimentary,
  rejectAdminUserRequest,
  resendAdminUserAccessLink,
  setUserComplimentaryPremium,
  setUserLifetimePremium,
} from '../api/auth';
import { Table, TableTitle, TableWrapper } from '../pages/SectorOutlook.styles';
import { formatAdminUserAccessHints } from '../utils/adminUserTiers';

const compact = { fontSize: 12, padding: '6px 8px', whiteSpace: 'nowrap' };
const checkboxCompact = { ...compact, width: 36, textAlign: 'center' };

function UserRows({
  rows,
  listKind,
  busy,
  setBusy,
  setError,
  setMessage,
  loadUsers,
  onUserActionComplete,
  setPaidTarget,
  setDeleteTarget,
  selectable,
  selectedIds,
  onToggleRow,
  highlightUserId,
}) {
  const run = async (fn, userId) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      const nextRows = await loadUsers({ silent: true });
      if (userId && typeof onUserActionComplete === 'function') {
        onUserActionComplete(userId, nextRows);
      }
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!rows.length) {
    return (
      <tr>
        <td colSpan={selectable ? 11 : 10} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
          No users in this list.
        </td>
      </tr>
    );
  }

  return rows.map((row) => (
    <tr
      key={`${listKind}-${row.id}`}
      style={
        highlightUserId && row.id === highlightUserId
          ? { background: 'rgba(255, 193, 7, 0.22)', outline: '2px solid rgba(255, 152, 0, 0.55)' }
          : undefined
      }
    >
      {selectable ? (
        <td style={checkboxCompact}>
          <Checkbox
            size="small"
            checked={selectedIds.includes(row.id)}
            disabled={busy}
            onChange={() => onToggleRow(row.id)}
            inputProps={{ 'aria-label': `Select ${row.email}` }}
          />
        </td>
      ) : null}
      <td style={compact}>{row.id}</td>
      <td style={compact}>{row.email}</td>
      <td style={compact}>{row.mobile || '—'}</td>
      <td style={compact}>{row.full_name || '—'}</td>
      <td style={{ ...compact, fontWeight: 700, color: row.is_pending_approval ? '#ed6c02' : row.is_pending_access_setup ? '#1565c0' : row.is_active ? '#2e7d32' : '#c62828' }}>
        {row.is_pending_approval
          ? 'Pending Approval'
          : row.is_pending_access_setup
            ? 'Awaiting setup'
            : row.is_active
              ? 'Active'
              : 'Blocked'}
      </td>
      <td style={compact}>{row.created_at || '—'}</td>
      <td style={compact}>
        {row.first_login_at ? (
          <span style={{ color: '#2e7d32', fontWeight: 600 }}>Logged in</span>
        ) : row.is_pending_access_setup ? (
          <span style={{ color: '#1565c0' }}>Not yet</span>
        ) : (
          '—'
        )}
      </td>
      <td style={compact}>{formatAdminUserAccessHints(row)}</td>
      <td style={{ ...compact, maxWidth: 130 }}>
        {row.paid_premium_active ? (
          <span style={{ color: '#2e7d32', fontWeight: 700 }}>Active</span>
        ) : row.paid_premium_until ? (
          <span style={{ color: '#888' }}>Expired</span>
        ) : (
          '—'
        )}
        {row.paid_premium_until_ist || row.paid_premium_until ? (
          <div style={{ fontSize: 10, color: '#555', marginTop: 2, whiteSpace: 'normal' }}>
            {row.paid_premium_until_ist || String(row.paid_premium_until).slice(0, 10)}
          </div>
        ) : null}
      </td>
      <td style={compact}>
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          {row.is_pending_approval ? (
            <>
              <Button
                size="small"
                color="primary"
                variant="outlined"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const res = await approveAdminUserAccessLink(row.id);
                    setMessage(res?.message || `Access link sent to ${row.email}.`);
                  }, row.id)
                }
              >
                Approve & Send Link
              </Button>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await rejectAdminUserRequest(row.id, 'rejected_by_admin');
                    setMessage(`User ${row.email} rejected.`);
                  }, row.id)
                }
              >
                Reject
              </Button>
            </>
          ) : row.is_active ? (
            <>
              <Button
                size="small"
                color="primary"
                variant="contained"
                disabled={busy || !row.is_pending_access_setup || Boolean(row.first_login_at)}
                title={
                  row.first_login_at
                    ? 'User has already logged in — activation link not needed'
                    : !row.is_pending_access_setup
                      ? 'User has already completed access setup'
                      : 'Send a new activation email link'
                }
                onClick={() =>
                  run(async () => {
                    const res = await resendAdminUserAccessLink(row.id);
                    setMessage(res?.message || `Activation link resent to ${row.email}.`);
                  }, row.id)
                }
                sx={
                  !row.is_pending_access_setup || row.first_login_at
                    ? { opacity: 0.55 }
                    : undefined
                }
              >
                Resend activation link
              </Button>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await blockAdminUser(row.id, true);
                    setMessage(`User ${row.email} blocked successfully.`);
                  }, row.id)
                }
              >
                Block
              </Button>
            </>
          ) : (
            <Button
              size="small"
              color="success"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await blockAdminUser(row.id, false);
                  setMessage(`User ${row.email} unblocked successfully.`);
                }, row.id)
              }
            >
              Unblock
            </Button>
          )}
          {!row.is_pending_approval && listKind === 'monthly' && row.paid_premium_active && row.premium_plan === 'monthly' ? (
            <Button
              size="small"
              color="primary"
              variant="outlined"
              disabled={busy}
              onClick={() => setPaidTarget({ ...row, plan: 'monthly' })}
            >
              Extend monthly
            </Button>
          ) : null}
          {!row.is_pending_approval && listKind === 'yearly' ? (
            <Button
              size="small"
              color="primary"
              variant="outlined"
              disabled={busy}
              onClick={() => setPaidTarget({ ...row, plan: 'yearly' })}
            >
              Extend yearly
            </Button>
          ) : null}
          {!row.is_pending_approval && (listKind === 'monthly' || listKind === 'yearly') && row.paid_premium_until ? (
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await clearUserPaidPremium(row.id);
                  setMessage(`Cleared paid premium for ${row.email}.`);
                }, row.id)
              }
            >
              Clear paid
            </Button>
          ) : null}
          {!row.is_pending_approval && listKind === 'basic' ? (
            <>
              <Button
                size="small"
                color="primary"
                variant="outlined"
                disabled={busy}
                onClick={() => setPaidTarget({ ...row, plan: 'monthly' })}
              >
                Grant monthly
              </Button>
              <Button
                size="small"
                color="primary"
                variant="outlined"
                disabled={busy}
                onClick={() => setPaidTarget({ ...row, plan: 'yearly' })}
              >
                Grant yearly
              </Button>
              <Button
                size="small"
                color="secondary"
                variant="outlined"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await setUserComplimentaryPremium(row.id, true);
                    setMessage(`Complimentary premium enabled for ${row.email} (no payment).`);
                  }, row.id)
                }
              >
                Complimentary premium
              </Button>
            </>
          ) : null}
          {!row.is_pending_approval && (listKind === 'basic' || listKind === 'monthly' || listKind === 'yearly') && !row.premium_lifetime ? (
            <Button
              size="small"
              color="info"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setUserLifetimePremium(row.id, true);
                  setMessage(`Lifetime premium enabled for ${row.email}.`);
                }, row.id)
              }
            >
              Lifetime premium
            </Button>
          ) : null}
          {!row.is_pending_approval && listKind === 'lifetime' && row.premium_lifetime ? (
            <Button
              size="small"
              color="secondary"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await moveUserLifetimeToComplimentary(row.id);
                  setMessage(`Moved ${row.email} from lifetime to complimentary premium.`);
                }, row.id)
              }
            >
              Move to complimentary
            </Button>
          ) : null}
          {!row.is_pending_approval && (listKind === 'lifetime' || listKind === 'monthly' || listKind === 'yearly') && row.premium_lifetime ? (
            <Button
              size="small"
              color="info"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setUserLifetimePremium(row.id, false);
                  setMessage(`Lifetime premium removed for ${row.email}.`);
                }, row.id)
              }
            >
              Remove lifetime
            </Button>
          ) : null}
          {!row.is_pending_approval && (listKind === 'lifetime' || listKind === 'monthly' || listKind === 'yearly') && row.premium_complimentary ? (
            <Button
              size="small"
              color="secondary"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setUserComplimentaryPremium(row.id, false);
                  setMessage(`Complimentary premium removed for ${row.email}.`);
                }, row.id)
              }
            >
              Remove complimentary
            </Button>
          ) : null}
          <Button size="small" color="error" variant="outlined" disabled={busy} onClick={() => setDeleteTarget(row)}>
            Delete
          </Button>
        </Box>
      </td>
    </tr>
  ));
}

function BulkBar({ count, busy, onClear, children }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        mb: 1,
        p: 1,
        bgcolor: 'action.hover',
        borderRadius: 1,
      }}
    >
      <Typography variant="body2" sx={{ mr: 1, fontWeight: 600 }}>
        {count} selected
      </Typography>
      {children}
      <Button size="small" variant="text" disabled={count === 0 || busy} onClick={onClear}>
        Clear selection
      </Button>
    </Box>
  );
}

export default function AdminUserDirectoryTables({
  tierLifetimeUsers,
  tierMonthlyPremiumUsers,
  tierYearlyPremiumUsers,
  tierBasicUsers,
  highlightUserId,
  busy,
  setBusy,
  setError,
  setMessage,
  loadUsers,
  onUserActionComplete,
  setPaidTarget,
  setDeleteTarget,
}) {
  const [selectedBasic, setSelectedBasic] = useState([]);
  const [selectedMonthly, setSelectedMonthly] = useState([]);
  const [selectedYearly, setSelectedYearly] = useState([]);
  const [selectedLifetime, setSelectedLifetime] = useState([]);

  const basicVisibleIds = useMemo(() => tierBasicUsers.map((r) => r.id), [tierBasicUsers]);
  const monthlyVisibleIds = useMemo(() => tierMonthlyPremiumUsers.map((r) => r.id), [tierMonthlyPremiumUsers]);
  const yearlyVisibleIds = useMemo(() => tierYearlyPremiumUsers.map((r) => r.id), [tierYearlyPremiumUsers]);
  const lifetimeVisibleIds = useMemo(() => tierLifetimeUsers.map((r) => r.id), [tierLifetimeUsers]);

  const allBasicHeaderChecked =
    basicVisibleIds.length > 0 && basicVisibleIds.every((id) => selectedBasic.includes(id));
  const basicHeaderIndeterminate =
    basicVisibleIds.some((id) => selectedBasic.includes(id)) && !allBasicHeaderChecked;

  const allMonthlyHeaderChecked =
    monthlyVisibleIds.length > 0 && monthlyVisibleIds.every((id) => selectedMonthly.includes(id));
  const monthlyHeaderIndeterminate =
    monthlyVisibleIds.some((id) => selectedMonthly.includes(id)) && !allMonthlyHeaderChecked;

  const allYearlyHeaderChecked =
    yearlyVisibleIds.length > 0 && yearlyVisibleIds.every((id) => selectedYearly.includes(id));
  const yearlyHeaderIndeterminate =
    yearlyVisibleIds.some((id) => selectedYearly.includes(id)) && !allYearlyHeaderChecked;

  const allLifetimeHeaderChecked =
    lifetimeVisibleIds.length > 0 && lifetimeVisibleIds.every((id) => selectedLifetime.includes(id));
  const lifetimeHeaderIndeterminate =
    lifetimeVisibleIds.some((id) => selectedLifetime.includes(id)) && !allLifetimeHeaderChecked;

  const toggleBasicRow = useCallback((id) => {
    setSelectedBasic((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleMonthlyRow = useCallback((id) => {
    setSelectedMonthly((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleYearlyRow = useCallback((id) => {
    setSelectedYearly((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleLifetimeRow = useCallback((id) => {
    setSelectedLifetime((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleBasicAll = useCallback(() => {
    setSelectedBasic((prev) => {
      const allOn = basicVisibleIds.length > 0 && basicVisibleIds.every((id) => prev.includes(id));
      if (allOn) return prev.filter((id) => !basicVisibleIds.includes(id));
      return [...new Set([...prev, ...basicVisibleIds])];
    });
  }, [basicVisibleIds]);

  const toggleMonthlyAll = useCallback(() => {
    setSelectedMonthly((prev) => {
      const allOn = monthlyVisibleIds.length > 0 && monthlyVisibleIds.every((id) => prev.includes(id));
      if (allOn) return prev.filter((id) => !monthlyVisibleIds.includes(id));
      return [...new Set([...prev, ...monthlyVisibleIds])];
    });
  }, [monthlyVisibleIds]);

  const toggleYearlyAll = useCallback(() => {
    setSelectedYearly((prev) => {
      const allOn = yearlyVisibleIds.length > 0 && yearlyVisibleIds.every((id) => prev.includes(id));
      if (allOn) return prev.filter((id) => !yearlyVisibleIds.includes(id));
      return [...new Set([...prev, ...yearlyVisibleIds])];
    });
  }, [yearlyVisibleIds]);

  const toggleLifetimeAll = useCallback(() => {
    setSelectedLifetime((prev) => {
      const allOn = lifetimeVisibleIds.length > 0 && lifetimeVisibleIds.every((id) => prev.includes(id));
      if (allOn) return prev.filter((id) => !lifetimeVisibleIds.includes(id));
      return [...new Set([...prev, ...lifetimeVisibleIds])];
    });
  }, [lifetimeVisibleIds]);

  const runBulk = useCallback(
    async (fn, affectedIds = [], hintTier) => {
      setBusy(true);
      setError('');
      setMessage('');
      try {
        await fn();
        const nextRows = await loadUsers({ silent: true });
        const userId = Array.isArray(affectedIds) ? affectedIds[0] : affectedIds;
        if (userId && typeof onUserActionComplete === 'function') {
          onUserActionComplete(userId, nextRows, hintTier);
        }
      } catch (err) {
        setError(err?.message || 'Bulk action failed.');
      } finally {
        setBusy(false);
      }
    },
    [loadUsers, onUserActionComplete, setBusy, setError, setMessage],
  );

  const onBulkBasicComplimentary = useCallback(() => {
    if (!selectedBasic.length) return;
    runBulk(async () => {
      const res = await bulkSetUserComplimentaryPremium(selectedBasic, true);
      setMessage(`Complimentary premium saved for ${res.updated} user(s) (database updated).`);
      setSelectedBasic([]);
    }, selectedBasic, 'monthly');
  }, [runBulk, selectedBasic, setMessage]);

  const onBulkBasicLifetime = useCallback(() => {
    if (!selectedBasic.length) return;
    runBulk(async () => {
      const res = await bulkSetUserLifetimePremium(selectedBasic, true);
      setMessage(`Lifetime premium saved for ${res.updated} user(s) (database updated).`);
      setSelectedBasic([]);
    }, selectedBasic, 'lifetime');
  }, [runBulk, selectedBasic, setMessage]);

  const onBulkMonthlyLifetime = useCallback(() => {
    if (!selectedMonthly.length) return;
    runBulk(async () => {
      const res = await bulkSetUserLifetimePremium(selectedMonthly, true);
      setMessage(`Lifetime premium saved for ${res.updated} user(s) (database updated).`);
      setSelectedMonthly([]);
    }, selectedMonthly, 'lifetime');
  }, [runBulk, selectedMonthly, setMessage]);

  const onBulkYearlyLifetime = useCallback(() => {
    if (!selectedYearly.length) return;
    runBulk(async () => {
      const res = await bulkSetUserLifetimePremium(selectedYearly, true);
      setMessage(`Lifetime premium saved for ${res.updated} user(s) (database updated).`);
      setSelectedYearly([]);
    }, selectedYearly, 'lifetime');
  }, [runBulk, selectedYearly, setMessage]);

  const onBulkLifetimeToComplimentary = useCallback(() => {
    if (!selectedLifetime.length) return;
    runBulk(async () => {
      const res = await bulkMoveUserLifetimeToComplimentary(selectedLifetime);
      setMessage(`Moved ${res.updated} user(s) from lifetime to complimentary (database updated).`);
      setSelectedLifetime([]);
    }, selectedLifetime, 'monthly');
  }, [runBulk, selectedLifetime, setMessage]);

  const tableHead = (selectable, headerChecked, headerIndeterminate, onHeaderChange) => (
    <thead>
      <tr>
        {selectable ? (
          <th style={checkboxCompact}>
            <Checkbox
              size="small"
              checked={headerChecked}
              indeterminate={headerIndeterminate}
              disabled={busy}
              onChange={onHeaderChange}
              inputProps={{ 'aria-label': 'Select all visible rows' }}
            />
          </th>
        ) : null}
        <th style={compact}>ID</th>
        <th style={compact}>Email (User ID)</th>
        <th style={compact}>Mobile</th>
        <th style={compact}>Name</th>
        <th style={compact}>Status</th>
        <th style={compact}>Created</th>
        <th style={compact}>Login</th>
        <th style={compact}>Access</th>
        <th style={compact}>Paid premium</th>
        <th style={compact}>Action</th>
      </tr>
    </thead>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box id="admin-tier-lifetime">
        <TableTitle>Lifetime members ({tierLifetimeUsers.length})</TableTitle>
        <BulkBar count={selectedLifetime.length} busy={busy} onClear={() => setSelectedLifetime([])}>
          <Button
            size="small"
            color="secondary"
            variant="contained"
            disabled={busy || selectedLifetime.length === 0}
            onClick={onBulkLifetimeToComplimentary}
            title="Clear lifetime and grant complimentary for selected users (one DB commit)"
          >
            Move selected to complimentary
          </Button>
        </BulkBar>
        <TableWrapper>
          <Table>
            {tableHead(true, allLifetimeHeaderChecked, lifetimeHeaderIndeterminate, toggleLifetimeAll)}
            <tbody>
              <UserRows
                rows={tierLifetimeUsers}
                listKind="lifetime"
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                setMessage={setMessage}
                loadUsers={loadUsers}
                onUserActionComplete={onUserActionComplete}
                setPaidTarget={setPaidTarget}
                setDeleteTarget={setDeleteTarget}
                selectable
                selectedIds={selectedLifetime}
                onToggleRow={toggleLifetimeRow}
                highlightUserId={highlightUserId}
              />
            </tbody>
          </Table>
        </TableWrapper>
      </Box>

      <Box id="admin-tier-monthly">
        <TableTitle>Monthly premium ({tierMonthlyPremiumUsers.length})</TableTitle>
        <BulkBar count={selectedMonthly.length} busy={busy} onClear={() => setSelectedMonthly([])}>
          <Button
            size="small"
            color="info"
            variant="contained"
            disabled={busy || selectedMonthly.length === 0}
            onClick={onBulkMonthlyLifetime}
            title="Move selected users from premium to lifetime (one DB commit)"
          >
            Lifetime premium for selected
          </Button>
        </BulkBar>
        <TableWrapper>
          <Table>
            {tableHead(true, allMonthlyHeaderChecked, monthlyHeaderIndeterminate, toggleMonthlyAll)}
            <tbody>
              <UserRows
                rows={tierMonthlyPremiumUsers}
                listKind="monthly"
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                setMessage={setMessage}
                loadUsers={loadUsers}
                onUserActionComplete={onUserActionComplete}
                setPaidTarget={setPaidTarget}
                setDeleteTarget={setDeleteTarget}
                selectable
                selectedIds={selectedMonthly}
                onToggleRow={toggleMonthlyRow}
                highlightUserId={highlightUserId}
              />
            </tbody>
          </Table>
        </TableWrapper>
      </Box>

      <Box id="admin-tier-yearly">
        <TableTitle>Yearly premium ({tierYearlyPremiumUsers.length})</TableTitle>
        <BulkBar count={selectedYearly.length} busy={busy} onClear={() => setSelectedYearly([])}>
          <Button
            size="small"
            color="info"
            variant="contained"
            disabled={busy || selectedYearly.length === 0}
            onClick={onBulkYearlyLifetime}
            title="Move selected users from premium to lifetime (one DB commit)"
          >
            Lifetime premium for selected
          </Button>
        </BulkBar>
        <TableWrapper>
          <Table>
            {tableHead(true, allYearlyHeaderChecked, yearlyHeaderIndeterminate, toggleYearlyAll)}
            <tbody>
              <UserRows
                rows={tierYearlyPremiumUsers}
                listKind="yearly"
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                setMessage={setMessage}
                loadUsers={loadUsers}
                onUserActionComplete={onUserActionComplete}
                setPaidTarget={setPaidTarget}
                setDeleteTarget={setDeleteTarget}
                selectable
                selectedIds={selectedYearly}
                onToggleRow={toggleYearlyRow}
                highlightUserId={highlightUserId}
              />
            </tbody>
          </Table>
        </TableWrapper>
      </Box>

      <Box id="admin-tier-basic">
        <TableTitle>Basic users ({tierBasicUsers.length})</TableTitle>
        <BulkBar count={selectedBasic.length} busy={busy} onClear={() => setSelectedBasic([])}>
          <Button
            size="small"
            color="secondary"
            variant="contained"
            disabled={busy || selectedBasic.length === 0}
            onClick={onBulkBasicComplimentary}
            title="Grant premium without payment: basic → premium (one DB commit)"
          >
            Complimentary premium for selected
          </Button>
          <Button
            size="small"
            color="info"
            variant="contained"
            disabled={busy || selectedBasic.length === 0}
            onClick={onBulkBasicLifetime}
            title="Grant permanent premium: basic → lifetime in one step (one DB commit)"
          >
            Lifetime premium for selected
          </Button>
        </BulkBar>
        <TableWrapper>
          <Table>
            {tableHead(true, allBasicHeaderChecked, basicHeaderIndeterminate, toggleBasicAll)}
            <tbody>
              <UserRows
                rows={tierBasicUsers}
                listKind="basic"
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                setMessage={setMessage}
                loadUsers={loadUsers}
                onUserActionComplete={onUserActionComplete}
                setPaidTarget={setPaidTarget}
                setDeleteTarget={setDeleteTarget}
                selectable
                selectedIds={selectedBasic}
                onToggleRow={toggleBasicRow}
                highlightUserId={highlightUserId}
              />
            </tbody>
          </Table>
        </TableWrapper>
      </Box>
    </Box>
  );
}
