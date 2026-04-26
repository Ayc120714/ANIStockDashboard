import React, {useState} from 'react';
import {Alert, Button, StyleSheet, Switch, Text, TextInput, View} from 'react-native';
import {authService} from '@core/api/services/authService';

export const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useEmailOtp, setUseEmailOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const onContinue = async () => {
    setLoading(true);
    try {
      const resp = useEmailOtp
        ? await authService.loginWithEmailOtpStart(email.trim())
        : await authService.loginStart(email.trim(), password);
      const flowId = resp?.flow_id || resp?.flowId;
      if (!flowId) {
        throw new Error('Login flow was not created by the server.');
      }
      navigation.navigate('OtpVerify', {
        flowId,
        purpose: 'login',
        channel: 'email',
        useEmailOtp,
      });
    } catch (error) {
      Alert.alert('Login failed', String(error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ANI Stock Login</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" style={styles.input} />
      {!useEmailOtp && (
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          style={styles.input}
        />
      )}
      <View style={styles.row}>
        <Text>Email OTP login</Text>
        <Switch value={useEmailOtp} onValueChange={setUseEmailOtp} />
      </View>
      <Button title={loading ? 'Please wait...' : 'Continue'} onPress={onContinue} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20, gap: 12, justifyContent: 'center'},
  title: {fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8},
  input: {borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
});
