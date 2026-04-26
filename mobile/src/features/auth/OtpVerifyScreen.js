import React, {useState} from 'react';
import {Alert, Button, StyleSheet, Text, TextInput, View} from 'react-native';
import {authService} from '@core/api/services/authService';
import {useAuth} from '@core/auth/AuthContext';
import {resolvePostLoginRoute} from '@features/auth/postLoginRouting';

export const OtpVerifyScreen = ({route, navigation}) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const {loginWithSession} = useAuth();
  const {flowId, purpose = 'login', channel = 'email', useEmailOtp = false} = route.params || {};

  const onVerify = async () => {
    setLoading(true);
    try {
      await authService.verifyOtp(flowId, purpose, channel, otp.trim());
      const session = useEmailOtp
        ? await authService.completeEmailOtpLogin(flowId, true)
        : await authService.completeLogin(flowId, true);
      await loginWithSession(session);
      const me = await authService.fetchMe();
      const nextRoute = await resolvePostLoginRoute({nextUser: me});
      navigation.reset({
        index: 0,
        routes: [{name: nextRoute.screen, params: nextRoute.params || {}}],
      });
    } catch (error) {
      Alert.alert('OTP verification failed', String(error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      await authService.resendOtp(flowId, purpose, channel);
      Alert.alert('OTP sent', 'A new OTP has been sent.');
    } catch (error) {
      Alert.alert('Could not resend OTP', String(error?.message || error));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="Enter OTP" style={styles.input} />
      <Button title={loading ? 'Verifying...' : 'Verify OTP'} onPress={onVerify} disabled={loading} />
      <Button title="Resend OTP" onPress={onResend} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20, gap: 12, justifyContent: 'center'},
  title: {fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8},
  input: {borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10},
});
