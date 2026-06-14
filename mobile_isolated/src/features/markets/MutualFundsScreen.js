import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {AYC, mobilePad, mobileStyles} from '@core/theme/mobileStyles';

const TABS = [
  {id: 'list', label: 'Fund List'},
  {id: 'tiers', label: 'Enter / Exit (B1–S3)'},
  {id: 'rs', label: 'RS D/W/M Setups'},
];

const TABLE_COLS = ['Scheme', 'Category', 'NAV', 'Exp Ratio', 'P/E', '1Y Ann%', '3Y Ann%', '5Y Ann%', '10Y Ann%', 'AUM (Cr)', 'Rating'];

/** Stitch mockup: design/stitch/mockups/mutual-funds.html */
export function MutualFundsScreen({navigation}) {
  const [tab, setTab] = useState('list');

  return (
    <MobileChrome navigation={navigation}>
      <ScrollView style={{flex: 1}} contentContainerStyle={mobilePad}>
        <View style={styles.titleRow}>
          <Text style={mobileStyles.pageTitle}>Mutual Funds</Text>
          <Pressable style={styles.refreshBtn}>
            <Text style={styles.refreshTxt}>Refresh</Text>
          </Pressable>
        </View>
        <Text style={mobileStyles.subtitle}>Direct MFs · scheme screener</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map(t => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id ? styles.tabOn : null]}>
              <Text style={[styles.tabText, tab === t.id ? styles.tabTextOn : null]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.tableWrap}>
          <View style={styles.thRow}>
            {TABLE_COLS.map(col => (
              <Text key={col} style={styles.th} numberOfLines={1}>
                {col}
              </Text>
            ))}
          </View>
          <Text style={styles.empty}>Mutual fund data will load here. Open the web module when available.</Text>
        </View>

        <Pressable
          style={styles.webBtn}
          onPress={() => navigation.navigate('WebPortal', {path: '/mutual-funds', title: 'Mutual Funds'})}>
          <Text style={styles.webBtnText}>Open web mutual funds</Text>
        </Pressable>
      </ScrollView>
    </MobileChrome>
  );
}

const styles = StyleSheet.create({
  titleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  refreshBtn: {
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: AYC.radius.default,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: AYC.card,
  },
  refreshTxt: {fontSize: AYC.type.caption, fontWeight: '700', color: AYC.text},
  tabRow: {gap: 8, paddingVertical: 4},
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: {borderBottomColor: AYC.accent},
  tabText: {fontSize: AYC.type.body, fontWeight: '600', color: AYC.textMuted},
  tabTextOn: {fontWeight: '800', color: AYC.accent},
  tableWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: AYC.radius.lg,
    backgroundColor: AYC.card,
    overflow: 'hidden',
  },
  thRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: AYC.appBar,
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  th: {color: '#fff', fontSize: AYC.type.cardLabel, fontWeight: '800', minWidth: 56},
  empty: {padding: 16, color: AYC.textMuted, fontSize: AYC.type.body, textAlign: 'center'},
  webBtn: {
    marginTop: 12,
    backgroundColor: AYC.accent,
    borderRadius: AYC.radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  webBtnText: {color: '#fff', fontWeight: '800', fontSize: AYC.type.body},
});
