import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  if (row?.paid_premium_active && !row?.premium_lifetime) {
    parts.push(row?.premium_plan === 'monthly' ? 'Monthly paid' : 'Yearly paid');
  }
  return parts.length ? parts.join(' · ') : 'Basic';
};

const userStatus = row => {
  if (row?.is_pending_approval) return {label: 'Pending Approval', style: styles.statusPending};
  if (row?.is_active) return {label: 'Active', style: styles.statusActive};
  return {label: 'Blocked', style: styles.statusBlocked};
};

function isMonthlyPremiumUser(row) {
  if (row?.premium_lifetime) return false;
  if (row?.paid_premium_active && row?.premium_plan === 'monthly') return true;
  return Boolean(row?.premium_complimentary || row?.on_premium_allowlist);
}

function isYearlyPremiumUser(row) {
  if (row?.premium_lifetime) return false;
  if (!row?.paid_premium_active) return false;
  return row?.premium_plan === 'yearly' || !row?.premium_plan;
}

function isBasicUser(row) {
  return !row?.premium_lifetime && !isMonthlyPremiumUser(row) && !isYearlyPremiumUser(row);
}

function tierForUser(row) {
  if (!row) return 'basic';
  if (row.premium_lifetime) return 'lifetime';
  if (isMonthlyPremiumUser(row)) return 'monthly';
  if (isYearlyPremiumUser(row)) return 'yearly';
  return 'basic';
}

function AdminUserCard({
  row,
  listKind,
  busy,
  highlighted,
  onApprove,
  onReject,
  onBlock,
  onUnblock,
  onGrantMonthly,
  onGrantYearly,
  onGrantComplimentary,
  onGrantLifetime,
  onClearPaid,
  onMoveToComplimentary,
  onRemoveLifetime,
  onRemoveComplimentary,
  onDelete,
}) {
  const status = userStatus(row);
  const pending = Boolean(row?.is_pending_approval);

  return (
    <View style={[styles.userCard, pending ? styles.userCardPending : null, highlighted ? styles.userCardHighlight : null]}>
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

        {!pending && listKind === 'basic' ? (
          <>
            <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnPrimary, busy ? styles.actionBtnDisabled : null]} onPress={onGrantMonthly}>
              <Text style={styles.actionBtnPrimaryText}>Grant monthly</Text>
            </Pressable>
            <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnPrimary, busy ? styles.actionBtnDisabled : null]} onPress={onGrantYearly}>
              <Text style={styles.actionBtnPrimaryText}>Grant yearly</Text>
            </Pressable>
            <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnSecondary, busy ? styles.actionBtnDisabled : null]} onPress={onGrantComplimentary}>
              <Text style={styles.actionBtnSecondaryText}>Complimentary</Text>
            </Pressable>
          </>
        ) : null}

        {!pending && (listKind === 'monthly' || listKind === 'yearly') && row?.paid_premium_until ? (
          <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnSecondary, busy ? styles.actionBtnDisabled : null]} onPress={onClearPaid}>
            <Text style={styles.actionBtnSecondaryText}>Clear paid</Text>
          </Pressable>
        ) : null}

        {!pending && (listKind === 'basic' || listKind === 'monthly' || listKind === 'yearly') && !row?.premium_lifetime ? (
          <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnInfo, busy ? styles.actionBtnDisabled : null]} onPress={onGrantLifetime}>
            <Text style={styles.actionBtnInfoText}>Lifetime</Text>
          </Pressable>
        ) : null}

        {!pending && listKind === 'lifetime' && row?.premium_lifetime ? (
          <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnSecondary, busy ? styles.actionBtnDisabled : null]} onPress={onMoveToComplimentary}>
            <Text style={styles.actionBtnSecondaryText}>Move to complimentary</Text>
          </Pressable>
        ) : null}

        {!pending && (listKind === 'lifetime' || listKind === 'monthly' || listKind === 'yearly') && row?.premium_lifetime ? (
          <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnInfo, busy ? styles.actionBtnDisabled : null]} onPress={onRemoveLifetime}>
            <Text style={styles.actionBtnInfoText}>Remove lifetime</Text>
          </Pressable>
        ) : null}

        {!pending && (listKind === 'lifetime' || listKind === 'monthly' || listKind === 'yearly') && row?.premium_complimentary ? (
          <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnSecondary, busy ? styles.actionBtnDisabled : null]} onPress={onRemoveComplimentary}>
            <Text style={styles.actionBtnSecondaryText}>Remove complimentary</Text>
          </Pressable>
        ) : null}

        {!pending ? (
          <Pressable disabled={busy} style={[styles.actionBtn, styles.actionBtnDanger, busy ? styles.actionBtnDisabled : null]} onPress={onDelete}>
            <Text style={styles.actionBtnDangerText}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function TierSection({title, count, sectionRef, children}) {
  return (
    <View ref={sectionRef} style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

export const AdminScreen = () => {
  const {user} = useAuth();
  const canViewInstallStats = isAppAdmin(user);
  const scrollRef = useRef(null);
  const sectionRefs = useRef({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [premiumRows, setPremiumRows] = useState([]);
  const [premiumEmail, setPremiumEmail] = useState('');
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [highlightUserId, setHighlightUserId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [installStats, setInstallStats] = useState(null);
  const [updateCheck, setUpdateCheck] = useState(null);
  const [updateCheckBusy, setUpdateCheckBusy] = useState(false);

  const reloadUsers = useCallback(async ({silent = false, cacheBust = false} = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [userRes, premiumRes, statsRes] = await Promise.all([
        authService.fetchAdminUsers(includeInactive, {cacheBust: cacheBust || silent}),
        authService.fetchPremiumEmails().catch(() => ({data: []})),
        canViewInstallStats ? fetchMobileInstallStats().catch(() => null) : Promise.resolve(null),
      ]);
      const nextUsers = extractApiRows(userRes, ['data', 'users']);
      setUsers(nextUsers);
      setPremiumRows(extractApiRows(premiumRes, ['data']));
      setInstallStats(canViewInstallStats ? statsRes?.stats || null : null);
      return nextUsers;
    } catch (err) {
      setError(String(err?.message || err || 'Failed to load admin data'));
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [canViewInstallStats, includeInactive]);

  useEffect(() => {
    reloadUsers({cacheBust: true});
  }, [reloadUsers]);

  const registerSectionRef = useCallback((tierKey, node) => {
    if (node) sectionRefs.current[tierKey] = node;
  }, []);

  const focusUserInDirectory = useCallback((userId, nextUsers, hintTier) => {
    if (!userId) return;
    const row = (Array.isArray(nextUsers) ? nextUsers : users).find(r => r.id === userId);
    const tier = hintTier || tierForUser(row);
    setHighlightUserId(userId);
    if (row?.email) setSearch(String(row.email));
    setTimeout(() => {
      const sectionNode = sectionRefs.current[tier];
      const scrollNode = scrollRef.current;
      if (!sectionNode || !scrollNode) return;
      sectionNode.measureLayout(
        scrollNode,
        (_x, y) => scrollNode.scrollTo({y: Math.max(0, y - 12), animated: true}),
        () => {},
      );
    }, 120);
  }, [users]);

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
  const tierLifetimeUsers = useMemo(
    () => filteredUsers.filter(row => Boolean(row?.premium_lifetime)),
    [filteredUsers],
  );
  const tierMonthlyUsers = useMemo(
    () => filteredUsers.filter(row => isMonthlyPremiumUser(row)),
    [filteredUsers],
  );
  const tierYearlyUsers = useMemo(
    () => filteredUsers.filter(row => isYearlyPremiumUser(row)),
    [filteredUsers],
  );
  const tierBasicUsers = useMemo(
    () => filteredUsers.filter(row => isBasicUser(row)),
    [filteredUsers],
  );

  const runAction = async (label, fn, focus = {}) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fn();
      setMessage(typeof res?.message === 'string' ? res.message : `${label} completed.`);
      const nextUsers = await reloadUsers({silent: true, cacheBust: true});
      if (focus.userId) focusUserInDirectory(focus.userId, nextUsers, focus.hintTier);
    } catch (err) {
      setError(String(err?.message || err || `${label} failed`));
    } finally {
      setBusy(false);
    }
  };

  const confirmGrantPaid = (row, plan) => {
    const planLabel = plan === 'monthly' ? 'monthly' : 'yearly';
    Alert.alert(
      `Grant ${planLabel} premium`,
      `Record one calendar ${planLabel === 'monthly' ? 'month' : 'year'} of paid premium for ${row?.email || 'this user'}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Confirm',
          onPress: () =>
            runAction('Premium granted', () => authService.setUserPaidPremium(row.id, plan), {
              userId: row.id,
              hintTier: plan,
            }),
        },
      ],
    );
  };

  const confirmDeleteUser = row => {
    Alert.alert('Delete user', `Delete ${row?.email || 'this user'} permanently?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => runAction('User deleted', () => authService.deleteAdminUser(row.id)),
      },
    ]);
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

  const renderUserCard = (row, listKind) => (
    <AdminUserCard
      key={String(row.id)}
      row={row}
      listKind={listKind}
      busy={busy}
      highlighted={highlightUserId != null && row.id === highlightUserId}
      onApprove={() =>
        runAction('User approved', () => authService.approveAdminUserAccessLink(row.id), {userId: row.id})
      }
      onReject={() =>
        runAction('User rejected', () => authService.rejectAdminUserRequest(row.id, 'rejected_by_admin'), {
          userId: row.id,
        })
      }
      onBlock={() => runAction('User blocked', () => authService.blockAdminUser(row.id, true), {userId: row.id})}
      onUnblock={() => runAction('User unblocked', () => authService.blockAdminUser(row.id, false), {userId: row.id})}
      onGrantMonthly={() => confirmGrantPaid(row, 'monthly')}
      onGrantYearly={() => confirmGrantPaid(row, 'yearly')}
      onGrantComplimentary={() =>
        runAction('Complimentary premium enabled', () => authService.setUserComplimentaryPremium(row.id, true), {
          userId: row.id,
          hintTier: 'monthly',
        })
      }
      onGrantLifetime={() =>
        runAction('Lifetime premium enabled', () => authService.setUserLifetimePremium(row.id, true), {
          userId: row.id,
          hintTier: 'lifetime',
        })
      }
      onClearPaid={() =>
        runAction('Paid premium cleared', () => authService.clearUserPaidPremium(row.id), {
          userId: row.id,
          hintTier: 'basic',
        })
      }
      onMoveToComplimentary={() =>
        runAction('Moved to complimentary', () => authService.moveUserLifetimeToComplimentary(row.id), {
          userId: row.id,
          hintTier: 'monthly',
        })
      }
      onRemoveLifetime={() =>
        runAction('Lifetime premium removed', () => authService.setUserLifetimePremium(row.id, false), {
          userId: row.id,
        })
      }
      onRemoveComplimentary={() =>
        runAction('Complimentary premium removed', () => authService.setUserComplimentaryPremium(row.id, false), {
          userId: row.id,
        })
      }
      onDelete={() => confirmDeleteUser(row)}
    />
  );

  if (loading && users.length === 0) {
    return (
      <ScreenScaffold title="Admin" subtitle="Users by tier — lifetime, monthly, yearly, basic">
        <ActivityIndicator style={{marginTop: 24}} color="#2563eb" />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      title="Admin"
      subtitle="Users by tier — lifetime, monthly, yearly, basic"
      scrollRef={scrollRef}>
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
            <Pressable
              disabled={updateCheckBusy}
              style={[styles.actionBtn, styles.actionBtnPrimary, updateCheckBusy ? styles.actionBtnDisabled : null]}
              onPress={runUpdateCheck}>
              {updateCheckBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.actionBtnPrimaryText}>Check auto-update (v{APP_VERSION_NAME})</Text>
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
          <Text style={styles.cardTitle}>User directory</Text>
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
          <Pressable style={styles.secondaryBtn} onPress={() => reloadUsers({cacheBust: true})} disabled={busy}>
            <Text style={styles.secondaryBtnText}>Refresh users</Text>
          </Pressable>
        </View>

        {pendingUsers.length ? (
          <TierSection
            title="Pending approval"
            count={pendingUsers.length}
            sectionRef={node => registerSectionRef('pending', node)}>
            {pendingUsers.map(row => renderUserCard(row, 'basic'))}
          </TierSection>
        ) : null}

        <TierSection
          title="Lifetime members"
          count={tierLifetimeUsers.length}
          sectionRef={node => registerSectionRef('lifetime', node)}>
          {tierLifetimeUsers.length ? (
            tierLifetimeUsers.map(row => renderUserCard(row, 'lifetime'))
          ) : (
            <Text style={styles.placeholder}>No lifetime members.</Text>
          )}
        </TierSection>

        <TierSection
          title="Monthly premium"
          count={tierMonthlyUsers.length}
          sectionRef={node => registerSectionRef('monthly', node)}>
          {tierMonthlyUsers.length ? (
            tierMonthlyUsers.map(row => renderUserCard(row, 'monthly'))
          ) : (
            <Text style={styles.placeholder}>No monthly premium users.</Text>
          )}
        </TierSection>

        <TierSection
          title="Yearly premium"
          count={tierYearlyUsers.length}
          sectionRef={node => registerSectionRef('yearly', node)}>
          {tierYearlyUsers.length ? (
            tierYearlyUsers.map(row => renderUserCard(row, 'yearly'))
          ) : (
            <Text style={styles.placeholder}>No yearly premium users.</Text>
          )}
        </TierSection>

        <TierSection
          title="Basic users"
          count={tierBasicUsers.length}
          sectionRef={node => registerSectionRef('basic', node)}>
          {tierBasicUsers.length ? (
            tierBasicUsers.map(row => renderUserCard(row, 'basic'))
          ) : (
            <Text style={styles.placeholder}>No basic users match your filters.</Text>
          )}
        </TierSection>
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  card: {...mobileStyles.card, borderRadius: 12, padding: 12, marginBottom: 12},
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
    marginBottom: 10,
  },
  messageText: mobileStyles.success,
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorText: mobileStyles.err,
  section: {gap: 10, marginBottom: 14},
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
  userCardHighlight: {borderColor: '#f59e0b', borderWidth: 2, backgroundColor: '#fffbeb'},
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
  actionBtnSecondary: {backgroundColor: '#faf5ff', borderColor: '#d8b4fe'},
  actionBtnSecondaryText: {fontSize: AYC.type.caption, fontWeight: '800', color: '#7e22ce'},
  actionBtnInfo: {backgroundColor: '#ecfeff', borderColor: '#67e8f9'},
  actionBtnInfoText: {fontSize: AYC.type.caption, fontWeight: '800', color: '#0e7490'},
  actionBtnWarn: {backgroundColor: '#fff7ed', borderColor: '#fdba74'},
  actionBtnWarnText: {fontSize: AYC.type.caption, fontWeight: '800', color: '#c2410c'},
  actionBtnDanger: {backgroundColor: '#fef2f2', borderColor: '#fecaca'},
  actionBtnDangerText: {fontSize: AYC.type.caption, fontWeight: '800', color: '#b91c1c'},
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
});
