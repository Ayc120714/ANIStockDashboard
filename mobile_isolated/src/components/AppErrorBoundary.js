import React from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LightScreenStatusBar} from '@core/utils/lightScreenStatusBar';

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

  retry = () => {
    this.setState({hasError: false, message: ''});
  };

  render() {
    if (this.state.hasError) {
      const detail = this.state.message;
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <LightScreenStatusBar backgroundColor="#ffffff" />
          <Text style={styles.title}>Unable to start app</Text>
          <Text style={styles.body}>
            Something went wrong while loading the app. Try again, or reinstall the latest APK if this keeps happening.
          </Text>
          <Pressable onPress={this.retry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
          {detail ? (
            <Text style={styles.devDetail} selectable>
              {detail}
            </Text>
          ) : null}
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'},
  title: {fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#111'},
  body: {fontSize: 14, color: '#444', textAlign: 'center'},
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  retryText: {color: '#fff', fontWeight: '700', fontSize: 14},
  devDetail: {
    marginTop: 20,
    fontSize: 12,
    color: '#991b1b',
    textAlign: 'left',
    alignSelf: 'stretch',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
