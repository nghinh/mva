/**
 * Root Navigator
 * Internal lightweight router to avoid native navigation module dependency.
 */

import React, {useEffect} from 'react';
import {SplashScreen} from '../../features/bootstrap/screens/SplashScreen';
import {MeetingScreen} from '../../features/meeting/screens/MeetingScreen';
import {HistoryListScreen} from '../../features/history/screens/HistoryListScreen';
import {SessionReviewScreen} from '../../features/history/screens/SessionReviewScreen';
import {SettingsScreen} from '../../features/settings/screens';
import {ModelRepositoryScreen} from '../../features/models/screens';
import {AppRouterProvider, useRoute} from './router';
import {ThemeProvider} from '../../shared/hooks/useTheme';
import {useBootstrapStore} from '../../shared/store';
import {areBundledAssetsAvailable, ensureBundledModelInstalled} from '../../native/models/BundledModelInstaller';

const STT_MODEL_INFO = {
  id: 'sensevoice-small',
  name: 'SenseVoice-Small',
  version: '1.2.4-bundled',
  quality: 'int8' as const,
  diskFootprintMB: 234,
  languages: ['EN', 'JA', 'KO', 'ZH'],
  inferenceSpeedRTF: 0.05,
  isOptimizedFor: ['iPhone 15 Pro'],
};

const NLLB_MODEL_INFO = {
  id: 'nllb-600m-mobile',
  name: 'NLLB-600M Mobile',
  version: '0.1.0-bundled',
  quality: 'int8' as const,
  diskFootprintMB: 780,
  languages: ['EN', 'JA', 'KO', 'ZH', 'VI'],
  inferenceSpeedRTF: 0.4,
  isOptimizedFor: ['iPhone 15 Pro'],
};

function BundledModelsInitializer(): null {
  const {
    initialize,
    setModelReady,
    setModelError,
    setTranslatorModelReady,
    setTranslatorModelError,
    startPrewarm,
    completePrewarm,
  } = useBootstrapStore();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      initialize();
      let translatorReady = false;

      const hasBundledStt = await areBundledAssetsAvailable('stt');
      if (hasBundledStt) {
        try {
          await ensureBundledModelInstalled('stt');
          if (!cancelled) {
            setModelReady(STT_MODEL_INFO);
          }
        } catch (error) {
          if (!cancelled) {
            setModelError(error instanceof Error ? error.message : 'Bundled STT install failed');
          }
        }
      } else if (!cancelled) {
        setModelError('Bundled STT model files are missing from mobile/assets/models.');
      }

      const hasBundledNllb = await areBundledAssetsAvailable('nllb');
      if (hasBundledNllb) {
        try {
          await ensureBundledModelInstalled('nllb');
          if (!cancelled) {
            setTranslatorModelReady(NLLB_MODEL_INFO);
            translatorReady = true;
          }
        } catch (error) {
          if (!cancelled) {
            setTranslatorModelError(error instanceof Error ? error.message : 'Bundled NLLB install failed');
          }
        }
      } else if (!cancelled) {
        setTranslatorModelError('Bundled NLLB model files are missing from mobile/assets/models/nllb-600m-mobile.');
      }

      if (!cancelled && hasBundledStt && translatorReady) {
        startPrewarm();
        setTimeout(() => {
          if (!cancelled) {
            completePrewarm();
          }
        }, 200);
      }
    };

    run().catch(() => {
      // Leave bootstrap state unchanged; UI will surface missing/incomplete setup.
    });

    return () => {
      cancelled = true;
    };
  }, [completePrewarm, initialize, setModelError, setModelReady, setTranslatorModelError, setTranslatorModelReady, startPrewarm]);

  return null;
}

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
    <ThemeProvider>
      <BundledModelsInitializer />
      <AppRouterProvider>
        <NavigatorContent />
      </AppRouterProvider>
    </ThemeProvider>
  );
}

export type {RootStackParamList, StackNavigationProp, RouteProp} from './router';
