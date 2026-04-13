/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import React from 'react';
import {RootNavigator} from './src/app/navigation/RootNavigator';

AppRegistry.registerComponent(appName, () => RootNavigator);
