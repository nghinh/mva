/**
 * Vibevoice App Entry Point
 * React Native TypeScript application shell
 */

import React from 'react';
import {Appearance, StatusBar} from 'react-native';
import {RootNavigator} from './navigation/RootNavigator';

export function App(): React.JSX.Element {
  const isLight = Appearance.getColorScheme() === 'light';
  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} translucent />
      <RootNavigator />
    </>
  );
}

export default App;
