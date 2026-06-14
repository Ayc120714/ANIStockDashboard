import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {useAuth} from '@core/auth/AuthContext';
import {runPageConnectivityChecks} from '@core/connectivity/pageConnectivityChecks';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

const CheckRow = ({page, name, status, detail}) => (
  <View style={styles.row}>
    <View style={styles.rowHead}>
      <Text style={styles.pageTag}>{page}</Text>
      <Text
        style={[
          styles.rowStatus,
          status === 'PASS' ? styles.pass : status === 'FAIL' ? styles.fail : styles.idle,
        ]}>
        {status}
      </Text>
    </View>
    <Text style={styles.rowName}>{name}</Text>
    {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
  </View>
);

export const AppSetupVerifyScreen = () => {
  const {user} = useAuth();
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState([]);
  const [lastRunAt, setLastRunAt] = useState(null);

  const runChecks = async () => {
    setRunning(true);
    setRows([]);
    try {
      const results = await runPageConnectivityChecks({includeAdmin: Boolean(user?.is_super_admin)});
      setRows(results);
    } catch (error) {
      setRows([
        {
          page: 'Runner',
          name: 'Verification',
          status: 'FAIL',
          detail: String(error?.message || error),
        },
      ]);
    } finally {
      setLastRunAt(new Date());
      setRunning(false);
    }
  };

  const summary = useMemo(() => {
    const total = rows.length;
    const passed = rows.filter(r => r.status === 'PASS').length;
    return {total, passed, failed: total - passed};
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const list = map.get(row.page) || [];
      list.push(row);
      map.set(row.page, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <ScreenScaffold
      title="Verify connectivity"
      subtitle="Log in first, then run checks for every page's API">
      <Pressable style={styles.btn} onPress={runChecks} disabled={running}>
        <Text style={styles.btnText}>{running ? 'Checking all pages…' : 'Run page connectivity checks'}</Text>
      </Pressable>
      {running ? <ActivityIndicator size="small" color="#2563eb" /> : null}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>Total: {summary.total}</Text>
        <Text style={styles.summaryText}>Passed: {summary.passed}</Text>
        <Text style={styles.summaryText}>Failed: {summary.failed}</Text>
        <Text style={styles.summarySub}>Last run: {lastRunAt ? lastRunAt.toLocaleTimeString() : 'Not run yet'}</Text>
      </View>
      <View style={styles.list}>
        {grouped.map(([page, pageRows]) => (
          <View key={page} style={styles.group}>
            <Text style={styles.groupTitle}>{page}</Text>
            {pageRows.map(item => (
              <CheckRow
                key={`${page}-${item.name}`}
                page={item.page}
                name={item.name}
                status={item.status}
                detail={item.detail}
              />
            ))}
          </View>
        ))}
      </View>
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  btn: mobileStyles.btnPrimary,
  btnText: mobileStyles.btnPrimaryText,
  summaryCard: {...mobileStyles.card, gap: 3},
  summaryText: mobileStyles.bodyBold,
  summarySub: mobileStyles.caption,
  list: {paddingBottom: 24, gap: 12},
  group: {gap: 8},
  groupTitle: mobileStyles.bodyBold,
  row: {...mobileStyles.card, gap: 4},
  rowHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  pageTag: mobileStyles.sectionTitle,
  rowName: mobileStyles.bodyBold,
  rowStatus: {fontSize: AYC.type.caption, fontWeight: '800'},
  rowDetail: mobileStyles.caption,
  pass: {color: AYC.positive},
  fail: {color: AYC.negative},
  idle: {color: AYC.textMuted},
});
