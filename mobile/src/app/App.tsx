/**
 * Vibevoice App Entry Point
 * React Native TypeScript application shell
 */

import React from 'react';
import {StatusBar, StyleSheet, View, Text} from 'react-native';

export function App(): React.JSX.Element {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#7F1D1D" />
      <View style={styles.debugCard}>
        <Text style={styles.errorTitle}>Render Path OK</Text>
        <Text style={styles.errorMessage}>Native startup + JS bundle loaded successfully.</Text>
        <Text style={styles.errorMessage}>The black screen is inside a non-core provider/module.</Text>
      </View>
      <View style={styles.debugStrip}>
        <Text style={styles.debugStripText}>Core RN only test screen</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    justifyContent: 'center',
    padding: 24,
  },
  debugCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  debugStrip: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
  },
  debugStripText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#FDE68A',
    fontSize: 22,
    fontWeight: '700',
  },
  errorMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
