/**
 * Vibevoice App Entry Point
 */

import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from '../shared/hooks/useTheme';
import {RootNavigator} from './navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5000,
    },
  },
});

export function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider mode="dark">
        <SafeAreaProvider>
          <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
            <RootNavigator />
          </View>
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});

export default App;
