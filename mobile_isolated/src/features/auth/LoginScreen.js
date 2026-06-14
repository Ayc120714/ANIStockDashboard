import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Image,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {authService} from '@core/api/services/authService';
import {useAuth} from '@core/auth/AuthContext';
import {AuthPageBackground} from '@components/auth/AuthPageBackground';
import {resolvePostLoginRoute} from '@features/auth/postLoginRouting';
import {resolveTopInset} from '@core/utils/safeAreaTop';
import {resetLogoutState} from '@core/auth/authSessionControl';

const MAIN_TAB_NAMES = new Set(['Dashboard', 'Stocks', 'Signals', 'Screens', 'Advisor']);

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

export const LoginScreen = ({navigation}) => {
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const insets = useSafeAreaInsets();
  const topPad = resolveTopInset(insets) + 12;
  const {loginWithSession} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [useEmailOtp, setUseEmailOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    resetLogoutState();
  }, []);

  const canSubmit = useEmailOtp
    ? email.trim().length > 0
    : email.trim().length > 0 && password.length >= 8;

  const finishAuthenticated = async session => {
    await loginWithSession(session);
    const me = await authService.fetchMe();
    const nextRoute = await resolvePostLoginRoute({nextUser: me});
    navigation.reset(buildPostLoginReset(nextRoute.screen, nextRoute.params));
  };

  const onContinue = async () => {
    if (!canSubmit) {
      Alert.alert(
        useEmailOtp ? 'Enter email' : 'Invalid credentials',
        useEmailOtp ? 'Please enter your email address.' : 'Password must be at least 8 characters.',
      );
      return;
    }
    setLoading(true);
    try {
      const resp = useEmailOtp
        ? await authService.loginWithEmailOtpStart(email.trim())
        : await authService.loginStart(email.trim(), password);

      if (resp?.mfa_required === false && resp?.access_token && resp?.refresh_token) {
        await finishAuthenticated({
          access_token: resp.access_token,
          refresh_token: resp.refresh_token,
        });
        return;
      }

      const flowId = resp?.flow_id || resp?.flowId;
      if (!flowId) {
        throw new Error('Login flow was not created by the server.');
      }

      const purpose = resp?.purpose || (useEmailOtp ? 'login_email' : 'login');
      navigation.navigate('OtpVerify', {
        flowId,
        purpose,
        channel: 'email',
        email: email.trim(),
        requires: resp?.requires || ['email'],
      });
    } catch (error) {
      const msg = String(error?.message || error);
      const friendly =
        msg === 'Signed out.'
          ? 'Could not reach the login service. Check mobile data or Wi‑Fi and try again.'
          : msg;
      Alert.alert('Login failed', friendly);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 8}>
        <View style={[styles.container, {paddingTop: topPad}]}>
        <View style={styles.card}>
          <Image source={require('../../assets/ayc-logo.png')} style={styles.logo} />
          <View style={styles.headerBand}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.headerSub}>
              {useEmailOtp ? 'Sign in with email OTP' : 'Sign in with password, then verify with email OTP'}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailRef}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              showSoftInputOnFocus
              importantForAutofill="no"
              autoFocus
              returnKeyType={useEmailOtp ? 'done' : 'next'}
              onSubmitEditing={() => {
                if (!useEmailOtp) {
                  passwordRef.current?.focus();
                }
              }}
              style={styles.input}
              placeholderTextColor="#93a4c7"
            />
          </View>

          {!useEmailOtp && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password (min 8 chars)"
                  secureTextEntry={!showPassword}
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  showSoftInputOnFocus
                  importantForAutofill="no"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={onContinue}
                  style={[styles.input, styles.passwordInput]}
                  placeholderTextColor="#93a4c7"
                />
                <Pressable
                  onPress={() => setShowPassword(v => !v)}
                  disabled={loading}
                  style={styles.eyeBtn}>
                  <Text style={styles.eyeBtnText}>{showPassword ? '🙈' : '👁'}</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.switchLabel}>Email OTP login</Text>
            <Switch value={useEmailOtp} onValueChange={setUseEmailOtp} disabled={loading} />
          </View>

          <Pressable
            onPress={onContinue}
            disabled={loading || !canSubmit}
            style={[styles.button, (loading || !canSubmit) && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>{loading ? 'Please wait...' : useEmailOtp ? 'Send OTP' : 'Login'}</Text>
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </AuthPageBackground>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {flexGrow: 1, padding: 20, justifyContent: 'flex-start'},
  card: {
    backgroundColor: '#0a183a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    padding: 18,
    gap: 14,
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
  headerSub: {fontSize: 13, color: '#dbeafe', textAlign: 'center', opacity: 0.95},
  fieldGroup: {gap: 6},
  label: {fontSize: 13, color: '#e3eeff'},
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordInput: {
    flex: 1,
  },
  eyeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  eyeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4},
  switchLabel: {fontSize: 14, color: '#dbeafe'},
  button: {
    marginTop: 10,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {opacity: 0.65},
  buttonText: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
});
