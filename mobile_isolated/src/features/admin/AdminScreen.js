import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {authService} from '@core/api/services/authService';
import {extractApiRows} from '@core/utils/apiPayload';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

const formatWhen = value => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return String(value).slice(0, 16);
  }
};

const accessHints = row => {
  const parts = [];
  if (row?.premium_lifetime) parts.push('Lifetime');
  if (row?.premium_complimentary) parts.push('Complimentary');
  if (row?.on_premium_allowlist) parts.push('Allowlist');
  if (row?.paid_premium_active) parts.push('Paid');
  return parts.length ? parts.join(' · ') : 'Basic';
};

const userStatus = row => {
  if (row?.is_pending_approval) return {label: 'Pending Approval', style: styles.statusPending};
  if (row?.is_active) return {label: 'Active', style: styles.statusActive};
  return {label: 'Blocked', style: styles.statusBlocked};
};

function AdminUserCard({row, busy, onApprove, onReject, onBlock, onUnblock}) {
  const status = userStatus(row);
  const pending = Boolean(row?.is_pending_approval);

  return (
    <View style={[styles.userCard, pending ? styles.userCardPending : null]}>
      <View style={styles.userHeader}>
        <View style={styles.userHeaderLeft}>
          <Text style={styles.userName}>{row?.full_name || '—'}</Text>
          <Text style={styles.userEmail}>{row?.email || '—'}</Text>
        </View>
        <View style={[styles.statusBadge, status.style]}>
          <Text style={styles.statusBadgeText}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.userMetaGrid}>
        <Text style={styles.userMeta}>ID {row?.id ?? '—'}</Text>
        <Text style={styles.userMeta}>Mobile {row?.mobile || '—'}</Text>
        <Text style={styles.userMeta}>Created {formatWhen(row?.created_at)}</Text>
        <Text style={styles.userMeta}>Access {accessHints(row)}</Text>
      </View>

      <View style={styles.userActions}>
        {pending ? (
          <>
            <Pressable
              disabled={busy}
              style={[styles.actionBtn, styles.actionBtnPrimary, busy ? styles.actionBtnDisabled : null]}
              onPress={onApprove}>
              <Text style={styles.actionBtnPrimaryText}>Approve & Send Link</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              style={[styles.actionBtn, styles.actionBtnWarn, busy ? styles.actionBtnDisabled : null]}
              onPress={onReject}>
              <Text style={styles.actionBtnWarnText}>Reject</Text>
            </Pressable>
          </>
        ) : row?.is_active ? (
          <Pressable
            disabled={busy}
            style={[styles.actionBtn, styles.actionBtnWarn, busy ? styles.actionBtnDisabled : null]}
            onPress={onBlock}>
            <Text style={styles.actionBtnWarnText}>Block</Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={busy}
            style={[styles.actionBtn, styles.actionBtnPrimary, busy ? styles.actionBtnDisabled : null]}
            onPress={onUnblock}>
            <Text style={styles.actionBtnPrimaryText}>Unblock</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export const AdminScreen = () => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [premiumRows, setPremiumRows] = useState([]);
  const [premiumEmail, setPremiumEmail] = useState('');
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userRes, premiumRes] = await Promise.all([
        authService.fetchAdminUsers(includeInactive),
        authService.fetchPremiumEmails().catch(() => ({data: []})),
      ]);
      setUsers(extractApiRows(userRes, ['data', 'users']));
      setPremiumRows(extractApiRows(premiumRes, ['data']));
    } catch (err) {
      setError(String(err?.message || err || 'Failed to load admin data'));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(row =>
      [row?.id, row?.email, row?.mobile, row?.full_name].some(v => String(v || '').toLowerCase().includes(term)),
    );
  }, [search, users]);

  const pendingUsers = useMemo(
    () => filteredUsers.filter(row => row?.is_pending_approval),
    [filteredUsers],
  );
  const otherUsers = useMemo(
    () => filteredUsers.filter(row => !row?.is_pending_approval),
    [filteredUsers],
  );

  const runAction = async (label, fn) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fn();
      setMessage(typeof res?.message === 'string' ? res.message : `${label} completed.`);
      await load();
    } catch (err) {
      setError(String(err?.message || err || `${label} failed`));
    } finally {
      setBusy(false);
    }
  };

  const addPremium = async () => {
    const email = String(premiumEmail || '').trim();
    if (!email) {
      Alert.alert('Premium email', 'Enter an email address.');
      return;
    }
    await runAction('Premium email added', async () => {
      await authService.addPremiumEmail(email);
      setPremiumEmail('');
      return {message: `Added ${email} to premium allowlist.`};
    });
  };

  const removePremium = entry => {
    Alert.alert('Remove premium email', `Remove ${entry?.email || 'this email'}?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          runAction('Premium email removed', () => authService.deletePremiumEmail(entry.id)),
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenScaffold title="Admin" subtitle="Admin users and premium management parity">
        <ActivityIndicator style={{marginTop: 24}} color="#2563eb" />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title="Admin" subtitle="Admin users and premium management parity">
      {message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Premium email allowlist</Text>
        <TextInput
          value={premiumEmail}
          onChangeText={setPremiumEmail}
          placeholder="Premium email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <Pressable style={styles.primaryBtn} onPress={addPremium} disabled={busy}>
          <Text style={styles.primaryBtnText}>Add premium email</Text>
        </Pressable>
        {premiumRows.length ? (
          <View style={styles.premiumList}>
            {premiumRows.map(entry => (
              <View key={String(entry.id)} style={styles.premiumRow}>
                <View style={styles.premiumRowText}>
                  <Text style={styles.premiumEmail}>{entry.email}</Text>
                  <Text style={styles.premiumAdded}>Added {formatWhen(entry.created_at)}</Text>
                </View>
                <Pressable onPress={() => removePremium(entry)} disabled={busy}>
                  <Text style={styles.premiumRemove}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.placeholder}>No premium emails in allowlist.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin users</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search id, email, mobile, name"
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Include inactive users</Text>
          <Switch value={includeInactive} onValueChange={setIncludeInactive} />
        </View>
        <Pressable style={styles.secondaryBtn} onPress={load} disabled={busy}>
          <Text style={styles.secondaryBtnText}>Refresh admin users</Text>
        </Pressable>
      </View>

      {pendingUsers.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending approval</Text>
            <Text style={styles.sectionCount}>{pendingUsers.length}</Text>
          </View>
          {pendingUsers.map(row => (
            <AdminUserCard
              key={String(row.id)}
              row={row}
              busy={busy}
              onApprove={() =>
                runAction('User approved', () => authService.approveAdminUserAccessLink(row.id))
              }
              onReject={() =>
                runAction('User rejected', () => authService.rejectAdminUserRequest(row.id, 'rejected_by_admin'))
              }
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{pendingUsers.length ? 'Other users' : 'All users'}</Text>
          <Text style={styles.sectionCount}>{otherUsers.length}</Text>
        </View>
        {otherUsers.length ? (
          otherUsers.map(row => (
            <AdminUserCard
              key={String(row.id)}
              row={row}
              busy={busy}
              onBlock={() => runAction('User blocked', () => authService.blockAdminUser(row.id, true))}
              onUnblock={() => runAction('User unblocked', () => authService.blockAdminUser(row.id, false))}
            />
          ))
        ) : (
          <Text style={styles.placeholder}>No users match your filters.</Text>
        )}
      </View>
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  card: {...mobileStyles.card, borderRadius: 12, padding: 12},
  cardTitle: mobileStyles.cardTitle,
  input: mobileStyles.input,
  primaryBtn: mobileStyles.btnPrimary,
  primaryBtnText: mobileStyles.btnPrimaryText,
  secondaryBtn: mobileStyles.btnSecondary,
  secondaryBtnText: mobileStyles.btnSecondaryText,
  switchRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  switchLabel: mobileStyles.body,
  premiumList: {gap: 8, marginTop: 4},
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AYC.cardBorder,
    paddingTop: 8,
  },
  premiumRowText: {flex: 1, gap: 2},
  premiumEmail: mobileStyles.bodyBold,
  premiumAdded: mobileStyles.muted,
  premiumRemove: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.negative},
  messageBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  messageText: mobileStyles.success,
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: mobileStyles.err,
  section: {gap: 10},
  sectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  sectionTitle: mobileStyles.cardTitle,
  sectionCount: {
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    color: AYC.textMuted,
    fontWeight: '800',
    fontSize: AYC.type.caption,
  },
  placeholder: {...mobileStyles.caption, textAlign: 'center', paddingVertical: 12, fontStyle: 'italic'},
  userCard: {...mobileStyles.card, borderRadius: 12, padding: 12},
  userCardPending: {borderColor: '#fcd34d', backgroundColor: '#fffbeb'},
  userHeader: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8},
  userHeaderLeft: {flex: 1, gap: 2},
  userName: mobileStyles.cardTitle,
  userEmail: mobileStyles.caption,
  statusBadge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999},
  statusBadgeText: {fontSize: AYC.type.cardLabel, fontWeight: '800', color: AYC.text},
  statusPending: {backgroundColor: '#fde68a'},
  statusActive: {backgroundColor: '#bbf7d0'},
  statusBlocked: {backgroundColor: '#fecaca'},
  userMetaGrid: {gap: 3},
  userMeta: mobileStyles.muted,
  userActions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2},
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnPrimary: {backgroundColor: '#eff6ff', borderColor: '#93c5fd'},
  actionBtnPrimaryText: {fontSize: AYC.type.caption, fontWeight: '800', color: '#1d4ed8'},
  actionBtnWarn: {backgroundColor: '#fff7ed', borderColor: '#fdba74'},
  actionBtnWarnText: {fontSize: AYC.type.caption, fontWeight: '800', color: '#c2410c'},
  actionBtnDisabled: {opacity: 0.5},
});
