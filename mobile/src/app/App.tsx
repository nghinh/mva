/**
 * Vibevoice App Entry Point
 * React Native TypeScript application shell
 */

import React from 'react';
import {StatusBar, StyleSheet, View, Text} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

export function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#7F1D1D" />
        <View style={styles.debugCard}>
          <Text style={styles.errorTitle}>SafeArea Test OK</Text>
          <Text style={styles.errorMessage}>If this renders, SafeAreaProvider is not the culprit.</Text>
        </View>
        <View style={styles.debugStrip}>
          <Text style={styles.debugStripText}>SafeAreaProvider + SafeAreaView only</Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
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
