import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, Checkbox, Typography } from '@mui/material';
import {
  approveAdminUserAccessLink,
  blockAdminUser,
  bulkSetUserComplimentaryPremium,
  bulkSetUserLifetimePremium,
  clearUserPaidPremium,
  rejectAdminUserRequest,
  setUserComplimentaryPremium,
  setUserLifetimePremium,
} from '../api/auth';
import { Table, TableTitle, TableWrapper } from '../pages/SectorOutlook.styles';

const compact = { fontSize: 12, padding: '6px 8px', whiteSpace: 'nowrap' };
const checkboxCompact = { ...compact, width: 36, textAlign: 'center' };

function accessHints(row) {
  const parts = [];
  if (row.premium_lifetime) parts.push('Life.');
  if (row.premium_complimentary) parts.push('Compl.');
  if (row.on_premium_allowlist) parts.push('List');
  if (row.paid_premium_active) parts.push('Paid');
  return parts.length ? parts.join(' ') : '—';
}

function UserRows({
  rows,
  listKind,
  busy,
  setBusy,
  setError,
  setMessage,
  loadUsers,
  setPaidTarget,
  setDeleteTarget,
  selectable,
  selectedIds,
  onToggleRow,
}) {
  const run = async (fn) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await loadUsers();
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!rows.length) {
    return (
      <tr>
        <td colSpan={selectable ? 10 : 9} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
          No users in this list.
        </td>
      </tr>
    );
  }

  return rows.map((row) => (
    <tr key={`${listKind}-${row.id}`}>
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
      <td style={{ ...compact, fontWeight: 700, color: row.is_active ? '#2e7d32' : '#c62828' }}>
        {row.is_pending_approval ? 'Pending Approval' : row.is_active ? 'Active' : 'Blocked'}
      </td>
      <td style={compact}>{row.created_at || '—'}</td>
      <td style={compact}>{accessHints(row)}</td>
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
                  })
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
                  })
                }
              >
                Reject
              </Button>
            </>
          ) : row.is_active ? (
            <Button
              size="small"
              color="warning"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await blockAdminUser(row.id, true);
                  setMessage(`User ${row.email} blocked successfully.`);
                })
              }
            >
              Block
            </Button>
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
                })
              }
            >
              Unblock
            </Button>
          )}
          {!row.is_pending_approval && listKind === 'yearly_other' ? (
            <Button size="small" color="primary" variant="outlined" disabled={busy} onClick={() => setPaidTarget(row)}>
              Record payment
            </Button>
          ) : null}
          {!row.is_pending_approval && listKind === 'yearly_other' && row.paid_premium_until ? (
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await clearUserPaidPremium(row.id);
                  setMessage(`Cleared paid premium for ${row.email}.`);
                })
              }
            >
              Clear paid
            </Button>
          ) : null}
          {!row.is_pending_approval && listKind === 'basic' ? (
            <Button
              size="small"
              color="secondary"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setUserComplimentaryPremium(row.id, true);
                  setMessage(`Complimentary premium enabled for ${row.email} (no payment).`);
                })
              }
            >
              Complimentary premium
            </Button>
          ) : null}
          {!row.is_pending_approval && (listKind === 'basic' || listKind === 'yearly_other') && !row.premium_lifetime ? (
            <Button
              size="small"
              color="info"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setUserLifetimePremium(row.id, true);
                  setMessage(`Lifetime premium enabled for ${row.email}.`);
                })
              }
            >
              Lifetime premium
            </Button>
          ) : null}
          {!row.is_pending_approval && (listKind === 'lifetime' || listKind === 'yearly_other') && row.premium_lifetime ? (
            <Button
              size="small"
              color="info"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setUserLifetimePremium(row.id, false);
                  setMessage(`Lifetime premium removed for ${row.email}.`);
                })
              }
            >
              Remove lifetime
            </Button>
          ) : null}
          {!row.is_pending_approval && (listKind === 'lifetime' || listKind === 'yearly_other') && row.premium_complimentary ? (
            <Button
              size="small"
              color="secondary"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setUserComplimentaryPremium(row.id, false);
                  setMessage(`Complimentary premium removed for ${row.email}.`);
                })
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
  tierYearlyOtherPremiumUsers,
  tierBasicUsers,
  busy,
  setBusy,
  setError,
  setMessage,
  loadUsers,
  setPaidTarget,
  setDeleteTarget,
}) {
  const [selectedBasic, setSelectedBasic] = useState([]);
  const [selectedYearly, setSelectedYearly] = useState([]);

  const basicVisibleIds = useMemo(() => tierBasicUsers.map((r) => r.id), [tierBasicUsers]);
  const yearlyVisibleIds = useMemo(() => tierYearlyOtherPremiumUsers.map((r) => r.id), [tierYearlyOtherPremiumUsers]);

  const allBasicHeaderChecked =
    basicVisibleIds.length > 0 && basicVisibleIds.every((id) => selectedBasic.includes(id));
  const basicHeaderIndeterminate =
    basicVisibleIds.some((id) => selectedBasic.includes(id)) && !allBasicHeaderChecked;

  const allYearlyHeaderChecked =
    yearlyVisibleIds.length > 0 && yearlyVisibleIds.every((id) => selectedYearly.includes(id));
  const yearlyHeaderIndeterminate =
    yearlyVisibleIds.some((id) => selectedYearly.includes(id)) && !allYearlyHeaderChecked;

  const toggleBasicRow = useCallback((id) => {
    setSelectedBasic((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleYearlyRow = useCallback((id) => {
    setSelectedYearly((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleBasicAll = useCallback(() => {
    setSelectedBasic((prev) => {
      const allOn = basicVisibleIds.length > 0 && basicVisibleIds.every((id) => prev.includes(id));
      if (allOn) return prev.filter((id) => !basicVisibleIds.includes(id));
      return [...new Set([...prev, ...basicVisibleIds])];
    });
  }, [basicVisibleIds]);

  const toggleYearlyAll = useCallback(() => {
    setSelectedYearly((prev) => {
      const allOn = yearlyVisibleIds.length > 0 && yearlyVisibleIds.every((id) => prev.includes(id));
      if (allOn) return prev.filter((id) => !yearlyVisibleIds.includes(id));
      return [...new Set([...prev, ...yearlyVisibleIds])];
    });
  }, [yearlyVisibleIds]);

  const runBulk = useCallback(
    async (fn) => {
      setBusy(true);
      setError('');
      setMessage('');
      try {
        await fn();
        await loadUsers();
      } catch (err) {
        setError(err?.message || 'Bulk action failed.');
      } finally {
        setBusy(false);
      }
    },
    [loadUsers, setBusy, setError, setMessage],
  );

  const onBulkBasicComplimentary = useCallback(() => {
    if (!selectedBasic.length) return;
    runBulk(async () => {
      const res = await bulkSetUserComplimentaryPremium(selectedBasic, true);
      setMessage(`Complimentary premium saved for ${res.updated} user(s) (database updated).`);
      setSelectedBasic([]);
    });
  }, [runBulk, selectedBasic, setMessage]);

  const onBulkBasicLifetime = useCallback(() => {
    if (!selectedBasic.length) return;
    runBulk(async () => {
      const res = await bulkSetUserLifetimePremium(selectedBasic, true);
      setMessage(`Lifetime premium saved for ${res.updated} user(s) (database updated).`);
      setSelectedBasic([]);
    });
  }, [runBulk, selectedBasic, setMessage]);

  const onBulkYearlyLifetime = useCallback(() => {
    if (!selectedYearly.length) return;
    runBulk(async () => {
      const res = await bulkSetUserLifetimePremium(selectedYearly, true);
      setMessage(`Lifetime premium saved for ${res.updated} user(s) (database updated).`);
      setSelectedYearly([]);
    });
  }, [runBulk, selectedYearly, setMessage]);

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
        <th style={compact}>Access</th>
        <th style={compact}>Paid premium</th>
        <th style={compact}>Action</th>
      </tr>
    </thead>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <TableTitle>Lifetime members ({tierLifetimeUsers.length})</TableTitle>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, maxWidth: 720 }}>
          Permanent premium until you remove lifetime on the row.
        </Typography>
        <TableWrapper>
          <Table>
            {tableHead(false, false, false, () => {})}
            <tbody>
              <UserRows
                rows={tierLifetimeUsers}
                listKind="lifetime"
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                setMessage={setMessage}
                loadUsers={loadUsers}
                setPaidTarget={setPaidTarget}
                setDeleteTarget={setDeleteTarget}
                selectable={false}
                selectedIds={[]}
                onToggleRow={() => {}}
              />
            </tbody>
          </Table>
        </TableWrapper>
      </Box>

      <Box>
        <TableTitle>Yearly &amp; other premium ({tierYearlyOtherPremiumUsers.length})</TableTitle>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, maxWidth: 720 }}>
          Active paid term (IST), complimentary, allowlist, or grandfathered access — everyone here has effective premium
          but is not on lifetime. Use row actions or multi-select + bulk <strong>Lifetime premium</strong> to move users
          to the lifetime list. The server applies all updates in a single database commit.
        </Typography>
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
                rows={tierYearlyOtherPremiumUsers}
                listKind="yearly_other"
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                setMessage={setMessage}
                loadUsers={loadUsers}
                setPaidTarget={setPaidTarget}
                setDeleteTarget={setDeleteTarget}
                selectable
                selectedIds={selectedYearly}
                onToggleRow={toggleYearlyRow}
              />
            </tbody>
          </Table>
        </TableWrapper>
      </Box>

      <Box>
        <TableTitle>Basic users ({tierBasicUsers.length})</TableTitle>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, maxWidth: 720 }}>
          No effective premium under current server rules. Select rows to grant <strong>complimentary</strong> (premium
          without payment) or <strong>lifetime</strong> in bulk; each bulk action is one database commit on the server.
        </Typography>
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
                setPaidTarget={setPaidTarget}
                setDeleteTarget={setDeleteTarget}
                selectable
                selectedIds={selectedBasic}
                onToggleRow={toggleBasicRow}
              />
            </tbody>
          </Table>
        </TableWrapper>
      </Box>
    </Box>
  );
}
