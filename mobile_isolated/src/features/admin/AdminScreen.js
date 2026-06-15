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
import {useAuth} from '@core/auth/AuthContext';
import {isAppAdmin} from '@core/auth/adminAccess';
import {authService} from '@core/api/services/authService';
import {fetchMobileInstallStats} from '@core/api/services/mobileService';
import {checkAppUpdateConnectivity} from '@core/utils/appUpdateCheck';
import {APP_VERSION_NAME} from '@core/config/appVersion';
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
  const {user} = useAuth();
  const canViewInstallStats = isAppAdmin(user);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [premiumRows, setPremiumRows] = useState([]);
  const [premiumEmail, setPremiumEmail] = useState('');
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [installStats, setInstallStats] = useState(null);
  const [updateCheck, setUpdateCheck] = useState(null);
  const [updateCheckBusy, setUpdateCheckBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userRes, premiumRes, statsRes] = await Promise.all([
        authService.fetchAdminUsers(includeInactive),
        authService.fetchPremiumEmails().catch(() => ({data: []})),
        canViewInstallStats ? fetchMobileInstallStats().catch(() => null) : Promise.resolve(null),
      ]);
      setUsers(extractApiRows(userRes, ['data', 'users']));
      setPremiumRows(extractApiRows(premiumRes, ['data']));
      setInstallStats(canViewInstallStats ? statsRes?.stats || null : null);
    } catch (err) {
      setError(String(err?.message || err || 'Failed to load admin data'));
    } finally {
      setLoading(false);
    }
  }, [canViewInstallStats, includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  const runUpdateCheck = useCallback(async () => {
    setUpdateCheckBusy(true);
    try {
      const result = await checkAppUpdateConnectivity();
      setUpdateCheck(result);
      const lines = [
        result.ok ? 'Manifest reachable' : result.error,
        `Installed: v${result.installed.version} (${result.installed.versionCode})`,
        result.published
          ? `Published: v${result.published.version} (${result.published.versionCode})`
          : null,
        `Latency: ${result.latencyMs} ms`,
        result.updateAvailable ? 'Update available on server' : 'App is up to date with server',
      ].filter(Boolean);
      Alert.alert('Auto-update check', lines.join('\n'));
    } finally {
      setUpdateCheckBusy(false);
    }
  }, []);

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

      {canViewInstallStats ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mobile app installs</Text>
        <Text style={styles.adminOnlyHint}>Visible to admin users only</Text>
        {installStats ? (
          <View style={styles.statsGrid}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{installStats.apk_downloads_total ?? 0}</Text>
              <Text style={styles.statLabel}>APK downloads</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{installStats.unique_users_installed ?? 0}</Text>
              <Text style={styles.statLabel}>Users installed</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{installStats.unique_devices_installed ?? 0}</Text>
              <Text style={styles.statLabel}>Devices installed</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{installStats.active_users_last_7_days ?? 0}</Text>
              <Text style={styles.statLabel}>Active users (7d)</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.placeholder}>Install stats unavailable.</Text>
        )}
        {installStats?.by_version?.length ? (
          <View style={styles.versionList}>
            <Text style={styles.versionTitle}>Installed versions</Text>
            {installStats.by_version.slice(0, 6).map(row => (
              <View key={row.version} style={styles.versionRow}>
                <Text style={styles.versionName}>{row.version}</Text>
                <Text style={styles.versionCount}>{row.devices} devices</Text>
              </View>
            ))}
          </View>
        ) : null}
        {installStats?.recent_installs?.length ? (
          <View style={styles.versionList}>
            <Text style={styles.versionTitle}>Recent app opens</Text>
            {installStats.recent_installs.slice(0, 5).map((row, idx) => (
              <View key={`${row.user_id}-${row.device_id}-${idx}`} style={styles.versionRow}>
                <Text style={styles.versionName} numberOfLines={1}>
                  {row.user_email || `User ${row.user_id}`}
                </Text>
                <Text style={styles.versionCount}>
                  v{row.app_version || '—'} · {formatWhen(row.last_opened_at)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable
          disabled={updateCheckBusy}
          style={[styles.actionBtn, styles.actionBtnPrimary, updateCheckBusy ? styles.actionBtnDisabled : null]}
          onPress={runUpdateCheck}>
          {updateCheckBusy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionBtnPrimaryText}>
              Check auto-update (v{APP_VERSION_NAME})
            </Text>
          )}
        </Pressable>
        {updateCheck?.published ? (
          <Text style={styles.placeholder}>
            Server v{updateCheck.published.version} · {updateCheck.latencyMs} ms
            {updateCheck.updateAvailable ? ' · update available' : ''}
          </Text>
        ) : null}
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
  adminOnlyHint: {
    fontSize: AYC.type.caption,
    color: AYC.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statTile: {
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    padding: 10,
    gap: 2,
  },
  statValue: {fontSize: 22, fontWeight: '900', color: AYC.text},
  statLabel: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '700'},
  versionList: {gap: 6, marginTop: 10},
  versionTitle: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.textMuted},
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  versionName: {flex: 1, fontSize: AYC.type.caption, fontWeight: '700', color: AYC.text},
  versionCount: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '600'},
});
