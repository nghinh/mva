/**
 * Root Navigator
 * Internal lightweight router to avoid native navigation module dependency.
 */

import React from 'react';
import {SplashScreen} from '../../features/bootstrap/screens/SplashScreen';
import {MeetingScreen} from '../../features/meeting/screens/MeetingScreen';
import {HistoryListScreen} from '../../features/history/screens/HistoryListScreen';
import {SessionReviewScreen} from '../../features/history/screens/SessionReviewScreen';
import {SettingsScreen} from '../../features/settings/screens';
import {ModelRepositoryScreen} from '../../features/models/screens';
import {AppRouterProvider, useRoute} from './router';

function NavigatorContent(): React.JSX.Element {
  const route = useRoute();

  switch (route.name) {
    case 'Meeting':
      return <MeetingScreen />;
    case 'History':
      return <HistoryListScreen />;
    case 'SessionReview':
      return <SessionReviewScreen />;
    case 'Settings':
      return <SettingsScreen />;
    case 'ModelRepository':
      return <ModelRepositoryScreen />;
    case 'Bootstrap':
    default:
      return <SplashScreen />;
  }
}

export function RootNavigator(): React.JSX.Element {
  return (
    <AppRouterProvider>
      <NavigatorContent />
    </AppRouterProvider>
  );
}

export type {RootStackParamList, StackNavigationProp, RouteProp} from './router';
