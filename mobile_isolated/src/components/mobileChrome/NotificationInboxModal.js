import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';
import {
  INBOX_FILTER_CHIPS,
  INBOX_SOURCES,
  formatAlertTimeIST,
  resolveInboxNavigationTarget,
} from '@core/utils/alertInboxUtils';
import {
  navigateFromInboxItem,
  navigateToAdvisorTab,
} from '@nav/navigationHelpers';

function sourceTone(source) {
  if (String(source || '').startsWith('trend_b')) return {bg: '#ecfdf5', color: '#047857'};
  if (String(source || '').startsWith('trend_s')) return {bg: '#fef2f2', color: '#b91c1c'};
  if (String(source || '').startsWith('chart_')) return {bg: '#eef2ff', color: '#4338ca'};
  if (String(source || '').startsWith('sig_')) return {bg: '#f0fdf4', color: '#15803d'};
  switch (source) {
    case INBOX_SOURCES.WEEKLY:
      return {bg: '#eff6ff', color: '#1d4ed8'};
    case INBOX_SOURCES.DIVERGENCE:
      return {bg: '#fdf4ff', color: '#7e22ce'};
    case INBOX_SOURCES.PRICE:
      return {bg: '#fff7ed', color: '#c2410c'};
    case INBOX_SOURCES.PRICE_MOVERS:
      return {bg: '#fff7ed', color: '#c2410c'};
    case INBOX_SOURCES.VOLUME_MOVERS:
      return {bg: '#ecfeff', color: '#0e7490'};
    case INBOX_SOURCES.ADMIN:
      return {bg: '#fef2f2', color: '#b91c1c'};
    default:
      return {bg: '#ecfdf5', color: '#047857'};
  }
}

function NotificationRow({item, onPress}) {
  const tone = sourceTone(item.source);
  const unread = !item.isRead;
  return (
    <Pressable
      style={[styles.row, unread ? styles.rowUnread : styles.rowRead]}
      onPress={() => onPress(item)}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowTopLeft}>
          {unread ? <View style={styles.unreadDot} /> : null}
          <View style={[styles.badge, {backgroundColor: tone.bg}]}>
            <Text style={[styles.badgeText, {color: tone.color}]}>{item.sourceLabel}</Text>
          </View>
        </View>
        <Text style={styles.time}>{formatAlertTimeIST(item.timestamp)}</Text>
      </View>
      <Text style={[styles.symbol, unread && styles.symbolUnread]}>{item.symbol}</Text>
      <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={2}>
        {item.title}
      </Text>
      {item.subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function NotificationInboxModal({
  visible,
  onClose,
  navigation,
  isSuperAdmin = false,
  sections,
  counts,
  loading,
  error,
  onRefresh,
  onMarkItemRead,
  onMarkAllRead,
}) {
  const [filter, setFilter] = useState('all');

  const visibleFilters = useMemo(() => {
    return INBOX_FILTER_CHIPS.filter(f => {
      if (f.id === INBOX_SOURCES.ADMIN && !isSuperAdmin) return false;
      if (f.id === 'all') return true;
      return (counts[f.id] || 0) > 0 || f.id === filter;
    });
  }, [counts, filter, isSuperAdmin]);

  const items = useMemo(() => {
    if (filter === 'all') return sections.all;
    return sections[filter] || [];
  }, [filter, sections]);

  const grouped = useMemo(() => {
    if (filter !== 'all') return [{key: filter, label: null, items}];
    const order = INBOX_FILTER_CHIPS.map(f => f.id).filter(id => id !== 'all');
    return order
      .filter(source => (isSuperAdmin || source !== INBOX_SOURCES.ADMIN) && (sections[source] || []).length > 0)
      .map(source => {
        const chip = INBOX_FILTER_CHIPS.find(f => f.id === source);
        return {
          key: source,
          label: chip?.label || source,
          items: sections[source] || [],
        };
      });
  }, [filter, isSuperAdmin, items, sections]);

  const handleSelect = item => {
    onMarkItemRead?.(item);
    const target = resolveInboxNavigationTarget(item);
    onClose?.();
    setTimeout(() => {
      navigateFromInboxItem(navigation, item, target);
    }, 0);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View>
              <Text style={styles.sheetTitle}>Notifications</Text>
              <Text style={styles.sheetSub}>
                {counts.all} alerts
                {counts.unread ? ` · ${counts.unread} unread` : ' · all read'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {visibleFilters.map(f => {
              const active = filter === f.id;
              const count = f.id === 'all' ? counts.all : counts[f.id] || 0;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.filterChip, active && styles.filterChipOn]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextOn]}>
                    {f.label}
                    {count ? ` (${count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading && items.length ? (
            <Text style={styles.refreshingHint}>Updating…</Text>
          ) : null}

          {loading && !items.length ? (
            <View style={styles.center}>
              <ActivityIndicator color={AYC.accent} />
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {!loading && !items.length ? (
              <Text style={styles.empty}>No notifications in this view right now.</Text>
            ) : null}

            {grouped.map(group => (
              <View key={group.key} style={styles.group}>
                {filter === 'all' && group.label ? (
                  <Text style={styles.groupTitle}>
                    {group.label} ({group.items.length})
                  </Text>
                ) : null}
                {group.items.map(item => (
                  <NotificationRow key={`${item.source}:${item.id}`} item={item} onPress={handleSelect} />
                ))}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.footerBtn} onPress={onRefresh}>
              <Text style={styles.footerBtnText}>Refresh</Text>
            </Pressable>
            <Pressable
              style={[styles.footerBtn, counts.unread ? null : styles.footerBtnDisabled]}
              disabled={!counts.unread}
              onPress={() => onMarkAllRead?.()}
            >
              <Text style={[styles.footerBtnText, !counts.unread && styles.footerBtnTextDisabled]}>
                Mark all read
              </Text>
            </Pressable>
            <Pressable
              style={[styles.footerBtn, styles.footerBtnPrimary]}
              onPress={() => {
                onClose?.();
                setTimeout(() => {
                  navigateToAdvisorTab(navigation, 'sig');
                }, 0);
              }}
            >
              <Text style={[styles.footerBtnText, styles.footerBtnTextPrimary]}>Advisor</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)'},
  sheet: {
    maxHeight: '86%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 14,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sheetTitle: {fontSize: 18, fontWeight: '800', color: AYC.text},
  sheetSub: {fontSize: 12, color: AYC.textMuted, marginTop: 2},
  close: {fontSize: 22, color: '#6b7280', paddingHorizontal: 4},
  filters: {paddingHorizontal: 12, gap: 8, paddingBottom: 10},
  filterChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  filterText: {fontSize: 12, fontWeight: '700', color: AYC.text},
  filterTextOn: {color: '#fff'},
  center: {alignItems: 'center', justifyContent: 'center', paddingVertical: 24},
  refreshingHint: {fontSize: 11, color: AYC.textMuted, paddingHorizontal: 16, paddingBottom: 6},
  error: {color: '#b91c1c', fontSize: 12, paddingHorizontal: 16, paddingBottom: 8},
  list: {maxHeight: 460},
  listContent: {paddingHorizontal: 12, paddingBottom: 12, gap: 8},
  empty: {fontSize: 13, color: AYC.textMuted, fontStyle: 'italic', paddingVertical: 16, textAlign: 'center'},
  group: {gap: 8},
  groupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: AYC.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  row: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    gap: 4,
  },
  rowUnread: {borderColor: '#93c5fd', backgroundColor: '#f0f7ff'},
  rowRead: {opacity: 0.72},
  rowTopLeft: {flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1},
  unreadDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb'},
  rowTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8},
  badge: {borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3},
  badgeText: {fontSize: 10, fontWeight: '800'},
  time: {fontSize: 10, color: AYC.textMuted},
  symbol: {fontSize: 14, fontWeight: '800', color: AYC.text},
  symbolUnread: {color: '#0f172a'},
  title: {fontSize: 12, color: AYC.text, lineHeight: 17},
  titleUnread: {fontWeight: '700'},
  subtitle: {fontSize: 11, color: AYC.textMuted},
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  footerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  footerBtnPrimary: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  footerBtnText: {fontSize: 12, fontWeight: '800', color: AYC.text},
  footerBtnTextDisabled: {color: '#9ca3af'},
  footerBtnDisabled: {opacity: 0.55},
  footerBtnTextPrimary: {color: '#fff'},
});
