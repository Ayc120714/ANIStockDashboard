import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {authService} from '@core/api/services/authService';
import {useAuth} from '@core/auth/AuthContext';
import {AuthPageBackground} from '@components/auth/AuthPageBackground';
import {resolvePostLoginRoute} from '@features/auth/postLoginRouting';
import {STORAGE_KEYS} from '@core/storage/keys';
import {resolveTopInset} from '@core/utils/safeAreaTop';

const MAIN_TAB_NAMES = new Set(['Dashboard', 'Stocks', 'Signals', 'Screens', 'Advisor']);

function onlyDigits(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 8);
}

function maskEmail(email) {
  const raw = String(email || '').trim();
  if (!raw.includes('@')) return 'your email';
  const [user, domain] = raw.split('@');
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${user.length > 2 ? '***' : ''}@${domain}`;
}

function buildPostLoginReset(screen, params) {
  const p = params || {};
  if (MAIN_TAB_NAMES.has(screen)) {
    return {
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: {
            index: 0,
            routes: [{name: screen, params: p}],
          },
        },
      ],
    };
  }
  return {
    index: 0,
    routes: [{name: screen, params: p}],
  };
}

async function persistOtpFlow(payload) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.otpFlow, JSON.stringify({...payload, savedAt: Date.now()}));
  } catch {
    /* ignore */
  }
}

export const OtpVerifyScreen = ({route, navigation}) => {
  const {loginWithSession} = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = resolveTopInset(insets) + 12;
  const params = route.params || {};
  const flowId = String(params.flowId || '').trim();
  const purpose = String(params.purpose || 'login').trim();
  const channel = String(params.channel || 'email').trim();
  const email = String(params.email || '').trim();

  const isEmailOtpLogin = purpose === 'login_email';
  const isPasswordThenOtp = purpose === 'login';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const initialSendDone = useRef(false);

  const canSubmit = useMemo(() => flowId && purpose && otp.length >= 4, [flowId, purpose, otp]);

  const subtitle = useMemo(() => {
    if (isPasswordThenOtp) return 'Enter the email OTP after your password';
    if (isEmailOtpLogin) return 'Enter OTP sent to mail';
    return 'Secure sign-in with email verification';
  }, [isEmailOtpLogin, isPasswordThenOtp]);

  const helper = useMemo(() => {
    if (isPasswordThenOtp) {
      return 'Enter the one-time code sent to your email to finish signing in.';
    }
    if (isEmailOtpLogin) return 'Enter OTP sent to mail.';
    return 'Enter the OTP sent to your email to continue.';
  }, [isEmailOtpLogin, isPasswordThenOtp]);

  const doCompleteLogin = useCallback(async () => {
    const session = isEmailOtpLogin
      ? await authService.completeEmailOtpLogin(flowId, trustDevice)
      : await authService.completeLogin(flowId, trustDevice);
    await loginWithSession(session);
    const me = await authService.fetchMe();
    const nextRoute = await resolvePostLoginRoute({nextUser: me});
    await AsyncStorage.removeItem(STORAGE_KEYS.otpFlow);
    navigation.reset(buildPostLoginReset(nextRoute.screen, nextRoute.params));
  }, [flowId, isEmailOtpLogin, loginWithSession, navigation, trustDevice]);

  const onVerify = async () => {
    if (!canSubmit || emailVerified) return;
    setLoading(true);
    setError('');
    setMessage('');
    let verified = false;
    try {
      await authService.verifyOtp(flowId, purpose, channel, otp.trim());
      verified = true;
      setEmailVerified(true);
      setMessage('Signing you in…');
      await doCompleteLogin();
      setMessage('');
    } catch (e) {
      setMessage('');
      setError(String(e?.message || e || (verified ? 'Unable to complete login.' : 'Failed to verify email OTP.')));
    } finally {
      setLoading(false);
    }
  };

  const onResend = useCallback(async () => {
    if (!flowId || !purpose || emailVerified) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await authService.resendOtp(flowId, purpose, channel);
      setMessage(`Email OTP resent to ${maskEmail(email)}.`);
    } catch (e) {
      setError(String(e?.message || e || 'Failed to resend email OTP.'));
    } finally {
      setLoading(false);
    }
  }, [channel, email, emailVerified, flowId, purpose]);

  useEffect(() => {
    if (!flowId || !purpose) return;
    persistOtpFlow({flowId, purpose, channel, email});
  }, [channel, email, flowId, purpose]);

  useEffect(() => {
    if (!flowId || !purpose || initialSendDone.current) return;
    initialSendDone.current = true;
    onResend();
  }, [flowId, onResend, purpose]);

  if (!flowId || !purpose) {
    return (
      <AuthPageBackground>
        <View style={[styles.flex, {paddingTop: topPad}]}>
          <View style={styles.card}>
            <Text style={styles.title}>OTP session missing</Text>
            <Text style={styles.lead}>Start again from login.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => navigation.replace('Login')}>
              <Text style={styles.primaryBtnText}>Go to Login</Text>
            </Pressable>
          </View>
        </View>
      </AuthPageBackground>
    );
  }

  return (
    <AuthPageBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 8}>
        <ScrollView contentContainerStyle={[styles.scroll, {paddingTop: topPad}]} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Image source={require('../../assets/ayc-logo.png')} style={styles.logo} />
          <View style={styles.headerBand}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <Text style={styles.lead}>{helper}</Text>
          {email ? <Text style={styles.emailHint}>Sent to {maskEmail(email)}</Text> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.trustRow}>
            <Text style={styles.trustLabel}>Trust this device for 7 days (skip OTP on next login)</Text>
            <Switch value={trustDevice} onValueChange={setTrustDevice} disabled={loading || emailVerified} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email OTP</Text>
            <TextInput
              value={otp}
              onChangeText={t => setOtp(onlyDigits(t))}
              keyboardType="number-pad"
              placeholder="Enter 4–8 digit code"
              placeholderTextColor="#93a4c7"
              editable={!loading && !emailVerified}
              style={styles.input}
              maxLength={8}
            />
            <Text style={styles.helper}>
              {emailVerified
                ? 'Email OTP verified'
                : isPasswordThenOtp
                  ? 'Code from email after password step'
                  : 'Enter OTP sent to your email'}
            </Text>
          </View>

          <View style={styles.btnRow}>
            <Pressable
              style={[styles.primaryBtn, (!canSubmit || loading || emailVerified) && styles.btnDisabled]}
              onPress={onVerify}
              disabled={!canSubmit || loading || emailVerified}>
              <Text style={styles.primaryBtnText}>{loading ? 'Please wait…' : 'Verify Email OTP'}</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, (loading || emailVerified) && styles.btnDisabled]}
              onPress={onResend}
              disabled={loading || emailVerified}>
              <Text style={styles.secondaryBtnText}>Resend Email OTP</Text>
            </Pressable>
          </View>

          <Pressable style={styles.backLink} onPress={() => navigation.replace('Login')} disabled={loading}>
            <Text style={styles.backLinkText}>← Back to Login</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </AuthPageBackground>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, padding: 20, justifyContent: 'flex-start'},
  scroll: {flexGrow: 1, padding: 20, paddingBottom: 32},
  card: {
    backgroundColor: '#0a183a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    padding: 18,
    gap: 12,
  },
  logo: {width: 260, height: 70, alignSelf: 'center', resizeMode: 'contain'},
  headerBand: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#1d4ed8',
    gap: 4,
  },
  title: {fontSize: 24, fontWeight: '800', color: '#ffffff', textAlign: 'center'},
  subtitle: {fontSize: 13, color: '#dbeafe', textAlign: 'center', opacity: 0.95},
  lead: {fontSize: 14, color: '#cbd5e1', lineHeight: 20},
  emailHint: {fontSize: 13, color: '#93c5fd', fontWeight: '700'},
  error: {
    fontSize: 13,
    color: '#fecaca',
    backgroundColor: 'rgba(127,29,29,0.35)',
    borderRadius: 8,
    padding: 10,
  },
  message: {
    fontSize: 13,
    color: '#bbf7d0',
    backgroundColor: 'rgba(21,128,61,0.25)',
    borderRadius: 8,
    padding: 10,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
  },
  trustLabel: {flex: 1, fontSize: 13, color: '#e2e8f0', lineHeight: 18},
  fieldGroup: {gap: 6},
  label: {fontSize: 13, color: '#e3eeff', fontWeight: '700'},
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: '700',
  },
  helper: {fontSize: 12, color: '#94a3b8'},
  btnRow: {gap: 10, marginTop: 4},
  primaryBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  primaryBtnText: {color: '#ffffff', fontSize: 15, fontWeight: '800'},
  secondaryBtnText: {color: '#93c5fd', fontSize: 15, fontWeight: '800'},
  btnDisabled: {opacity: 0.55},
  backLink: {paddingVertical: 8, alignItems: 'center'},
  backLinkText: {color: '#93c5fd', fontWeight: '700', fontSize: 14},
});
