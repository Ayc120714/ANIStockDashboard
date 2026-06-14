import React from 'react';
import {Platform, StyleSheet, Text, View} from 'react-native';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error && typeof error.message === 'string' ? error.message : String(error || ''),
    };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error('Fatal app render error:', error);
  }

  render() {
    if (this.state.hasError) {
      const dev = typeof __DEV__ !== 'undefined' && __DEV__;
      const detail = this.state.message;
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Unable to start app</Text>
          <Text style={styles.body}>
            A startup error occurred. Please reinstall the latest release APK and try again.
          </Text>
          {dev && detail ? (
            <Text style={styles.devDetail} selectable>
              {detail}
            </Text>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'},
  title: {fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#111'},
  body: {fontSize: 14, color: '#444', textAlign: 'center'},
  devDetail: {
    marginTop: 20,
    fontSize: 12,
    color: '#991b1b',
    textAlign: 'left',
    alignSelf: 'stretch',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
