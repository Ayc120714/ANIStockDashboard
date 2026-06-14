import {useEffect} from 'react';
import {Alert, Linking} from 'react-native';

let brokerCallbackHandler = null;

export const setBrokerCallbackHandler = handler => {
  brokerCallbackHandler = typeof handler === 'function' ? handler : null;
};

const parseLink = url => {
  try {
    const u = new URL(url);
    return {
      provider: u.searchParams.get('provider') || '',
      status: u.searchParams.get('status') || '',
      authCode: u.searchParams.get('auth_code') || '',
      requestToken: u.searchParams.get('request_token') || '',
      tokenId: u.searchParams.get('tokenId') || u.searchParams.get('token_id') || '',
      error: u.searchParams.get('error') || '',
    };
  } catch (_) {
    return null;
  }
};

export const useBrokerDeepLinking = () => {
  useEffect(() => {
    const processUrl = async ({url}) => {
      const parsed = parseLink(url);
      if (!parsed) return;
      if (parsed.error) {
        Alert.alert('Broker callback', `Callback error: ${parsed.error}`);
        return;
      }
      if (brokerCallbackHandler) {
        await brokerCallbackHandler(parsed);
        return;
      }
      Alert.alert(
        'Broker callback received',
        `Provider: ${parsed.provider || 'unknown'}\nStatus: ${parsed.status || 'pending'}`,
      );
    };

    const sub = Linking.addEventListener('url', processUrl);
    Linking.getInitialURL().then(url => {
      if (url) {
        processUrl({url});
      }
    });
    return () => sub.remove();
  }, []);
};
