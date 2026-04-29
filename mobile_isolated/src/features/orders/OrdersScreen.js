import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button, TextInput} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {JsonCard} from '@components/JsonCard';
import {ordersService} from '@core/api/services/ordersService';

export const OrdersScreen = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [symbol, setSymbol] = useState('NSE:SBIN');
  const [qty, setQty] = useState('1');

  const load = async () => {
    setLoading(true);
    try {
      const resp = await ordersService.fetchOrders();
      setOrders(Array.isArray(resp) ? resp : resp?.data || []);
    } catch (error) {
      Alert.alert('Orders', String(error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const placeDemoOrder = async () => {
    try {
      await ordersService.placeOrder({symbol, quantity: Number(qty), side: 'BUY', order_type: 'MARKET'});
      await load();
    } catch (error) {
      Alert.alert('Place order failed', String(error?.message || error));
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{marginTop: 30}} />;
  }

  return (
    <ScreenScaffold title="Orders" subtitle="Order placement and management parity">
      <TextInput value={symbol} onChangeText={setSymbol} placeholder="Symbol" style={{borderWidth: 1, borderRadius: 8, padding: 10}} />
      <TextInput value={qty} onChangeText={setQty} placeholder="Qty" keyboardType="number-pad" style={{borderWidth: 1, borderRadius: 8, padding: 10}} />
      <Button title="Place demo market order" onPress={placeDemoOrder} />
      <Button title="Refresh orders" onPress={load} />
      <JsonCard label="Orders" value={orders} />
    </ScreenScaffold>
  );
};
