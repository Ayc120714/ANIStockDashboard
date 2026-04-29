import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError() {
    return {hasError: true};
  }

  componentDidCatch(error) {
    // Keep this simple and stable for release builds.
    // eslint-disable-next-line no-console
    console.error('Fatal app render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Unable to start app</Text>
          <Text style={styles.body}>
            A startup error occurred. Please reinstall the latest release APK and try again.
          </Text>
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
});
