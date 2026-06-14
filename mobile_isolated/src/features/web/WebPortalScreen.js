import React, {useCallback, useEffect, useLayoutEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {env} from '@core/config/env';
import {sessionStorage} from '@core/storage/sessionStorage';
import {tokenStorage} from '@core/storage/tokenStorage';

/** Keys used by stockdashboard/src/auth/AuthContext.js */
const WEB_LS_ACCESS = 'auth_access_token';
const WEB_LS_REFRESH = 'auth_refresh_token';
const WEB_LS_USER = 'auth_user';

function buildAuthInjectionScript(accessToken, refreshToken, user) {
  const access = JSON.stringify(accessToken || '');
  const refresh = JSON.stringify(refreshToken || '');
  const userPayload = user == null ? 'null' : JSON.stringify(JSON.stringify(user));
  return `(function(){try{var a=${access};var r=${refresh};var u=${userPayload};if(a)localStorage.setItem(${JSON.stringify(WEB_LS_ACCESS)},a);if(r)localStorage.setItem(${JSON.stringify(WEB_LS_REFRESH)},r);if(u)localStorage.setItem(${JSON.stringify(WEB_LS_USER)},u);}catch(e){}})();true;`;
}

export const WebPortalScreen = ({navigation, route}) => {
  const insets = useSafeAreaInsets();
  const path = route.params?.path ?? '/';
  const title = route.params?.title ?? 'Website';
  const [injection, setInjection] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  const uri = useMemo(() => {
    const base = env.webAppUrl;
    const p = path.startsWith('/') ? path : `/${path}`;
    if (p === '/') {
      return `${base}/`;
    }
    return `${base}${p}`;
  }, [path]);

  const prepareAuth = useCallback(async () => {
    setAuthReady(false);
    const [accessToken, refreshToken, user] = await Promise.all([
      tokenStorage.getAccessToken(),
      tokenStorage.getRefreshToken(),
      sessionStorage.getUser(),
    ]);
    setInjection(buildAuthInjectionScript(accessToken, refreshToken, user));
    setAuthReady(true);
  }, []);

  useEffect(() => {
    prepareAuth();
  }, [prepareAuth, path, loadKey]);

  useLayoutEffect(() => {
    navigation.setOptions({title});
  }, [navigation, title]);

  const onRetry = useCallback(() => {
    setLoadKey(k => k + 1);
  }, []);

  if (!authReady) {
    return (
      <View style={[styles.centered, {paddingTop: insets.top}]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.hint}>Preparing session…</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <WebView
        key={`${uri}-${loadKey}`}
        source={{uri}}
        injectedJavaScriptBeforeContentLoaded={injection}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        startInLoadingState
        setSupportMultipleWindows={false}
        renderLoading={() => (
          <View style={styles.webLoading}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        )}
        onError={() => {}}
      />
      <View style={[styles.toolbar, {paddingBottom: Math.max(insets.bottom, 8)}]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.toolbarBtn}>
          <Text style={styles.toolbarBtnText}>Back</Text>
        </Pressable>
        <Pressable onPress={onRetry} style={styles.toolbarBtnSecondary}>
          <Text style={styles.toolbarBtnSecondaryText}>Reload</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: '#ffffff'},
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', gap: 8},
  hint: {fontSize: 14, color: '#4b5563'},
  webLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  toolbarBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toolbarBtnText: {color: '#ffffff', fontWeight: '600', fontSize: 15},
  toolbarBtnSecondary: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toolbarBtnSecondaryText: {color: '#111827', fontWeight: '600', fontSize: 15},
});
