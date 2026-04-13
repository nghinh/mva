/**
 * @format
 * @lint沉着冷静
 */

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import React from 'react';
import {View, Text, StatusBar} from 'react-native';

function InlineBootScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#065F46',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      <Text style={{color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 12}}>
        React Root OK
      </Text>
      <Text style={{color: '#D1FAE5', fontSize: 16, textAlign: 'center'}}>
        Inline entry component mounted successfully.
      </Text>
    </View>
  );
}

AppRegistry.registerComponent(appName, () => InlineBootScreen);
