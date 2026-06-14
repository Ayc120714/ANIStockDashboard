import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {useAuth} from '@core/auth/AuthContext';
import {SITE_SECTIONS, SITE_SECTIONS_ADMIN} from '@nav/siteSections';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

const Row = ({title, onPress}) => (
  <Pressable onPress={onPress} style={styles.row}>
    <Text style={styles.rowText}>{title}</Text>
    <Text style={styles.chev}>›</Text>
  </Pressable>
);

export function MoreHubScreen({navigation}) {
  const {user, logout} = useAuth();
  const links = useMemo(() => {
    const extra = user?.is_super_admin ? SITE_SECTIONS_ADMIN : [];
    return [...SITE_SECTIONS, ...extra];
  }, [user?.is_super_admin]);

  return (
    <ScreenScaffold title="More" subtitle="Full web modules">
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.hint}>These open the same pages as the desktop site inside the in-app browser.</Text>
        {links.map(item => (
          <Row key={item.path} title={item.title} onPress={() => navigation.navigate('WebPortal', {path: item.path, title: item.title})} />
        ))}
        <Pressable style={styles.danger} onPress={logout}>
          <Text style={styles.dangerText}>Logout</Text>
        </Pressable>
        {user?.is_super_admin ? (
          <Pressable style={styles.admin} onPress={() => navigation.navigate('Admin')}>
            <Text style={styles.adminText}>Admin console</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  pad: {paddingBottom: 32},
  hint: mobileStyles.subtitle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AYC.cardBorder,
  },
  rowText: mobileStyles.cardTitle,
  chev: {fontSize: AYC.type.pageTitle, color: AYC.textMuted},
  danger: {
    marginTop: 20,
    backgroundColor: '#fee2e2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerText: {color: '#991b1b', fontWeight: '800', fontSize: AYC.type.metricMd},
  admin: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
  },
  adminText: {color: '#3730a3', fontWeight: '800', fontSize: AYC.type.body},
});
