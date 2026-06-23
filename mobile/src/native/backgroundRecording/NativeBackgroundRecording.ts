import {NativeModules, NativeEventEmitter, Platform, PermissionsAndroid} from 'react-native';

const {BackgroundRecordingModule} = NativeModules;

export const BackgroundRecordingEmitter =
  Platform.OS === 'android' && BackgroundRecordingModule
    ? new NativeEventEmitter(BackgroundRecordingModule)
    : null;

export async function startBackgroundRecording(
  meetingName: string,
  startTimestamp: number,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ).catch(() => undefined);
  }
  BackgroundRecordingModule?.startService(meetingName, startTimestamp);
}

export function pauseBackgroundRecording(): void {
  if (Platform.OS !== 'android') return;
  BackgroundRecordingModule?.pauseService();
}

export function resumeBackgroundRecording(pausedTotalMs: number): void {
  if (Platform.OS !== 'android') return;
  BackgroundRecordingModule?.resumeService(pausedTotalMs);
}

export function stopBackgroundRecording(): void {
  if (Platform.OS !== 'android') return;
  BackgroundRecordingModule?.stopService();
}
