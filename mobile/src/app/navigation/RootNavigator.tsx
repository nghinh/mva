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
import {useBootstrapStore, useBootstrapOverallStatus} from '../../shared/store';
import {areBundledAssetsAvailable, ensureBundledModelInstalled} from '../../native/models/BundledModelInstaller';
import {getSpeakerEmbeddingService} from '../../native/speaker/SpeakerEmbeddingService';

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

function BundledModelsInitializer(): null {
  const {
    initialize,
    setModelReady,
    setModelError,
    startPrewarm,
    completePrewarm,
  } = useBootstrapStore();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      initialize();

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

      const hasBundledDiarization = await areBundledAssetsAvailable('diarization');
      if (hasBundledDiarization) {
        try {
          await ensureBundledModelInstalled('diarization');
          await getSpeakerEmbeddingService().initialize();
        } catch {
          // Non-fatal: meeting flow still works without speaker labels.
        }
      }

      if (!cancelled && hasBundledStt) {
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
  }, [completePrewarm, initialize, setModelError, setModelReady, startPrewarm]);

  return null;
}

function NavigatorContent(): React.JSX.Element {
  const route = useRoute();
  const overallStatus = useBootstrapOverallStatus();

  // Show SplashScreen while models are loading (initializing or error)
  if (overallStatus !== 'ready') {
    return <SplashScreen />;
  }

  console.warn('[NavigatorContent] Rendering route:', route.name, 'stack length:', /* cannot access stack here */ '');

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
      return <HistoryListScreen />;
  }
}

export function RootNavigator(): React.JSX.Element {
  return (
    <ThemeProvider>
      {/* BundledModelsInitializer disabled — SplashScreen handles all initialization */}
      <AppRouterProvider>
        <ThemeProvider>
          <BundledModelsInitializer />
          <NavigatorContent />
        </ThemeProvider>
      </AppRouterProvider>

    </ThemeProvider>
  );
}

export type {RootStackParamList, StackNavigationProp, RouteProp} from './router';
