import {Platform, PermissionsAndroid, Alert, Linking, NativeModules} from 'react-native';

type IosMicrophonePermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown';

type IosMicrophonePermissionModule = {
  checkPermission: () => Promise<IosMicrophonePermissionStatus>;
  requestPermission: () => Promise<IosMicrophonePermissionStatus>;
};

const iosMicrophonePermission =
  NativeModules.MicrophonePermissionModule as IosMicrophonePermissionModule | undefined;

function showIosMicrophoneSettingsAlert(): void {
  Alert.alert(
    'Microphone Permission Required',
    'MVA needs microphone access to transcribe meetings. Please enable microphone access in Settings.',
    [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Open Settings', onPress: () => Linking.openSettings()},
    ],
  );
}

export async function checkAudioPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    if (!iosMicrophonePermission) {
      return false;
    }
    const status = await iosMicrophonePermission.checkPermission();
    return status === 'granted';
  }

  if (Platform.OS !== 'android') {
    return false;
  }

  const result = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );
  return result;
}

export async function requestAudioPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    if (!iosMicrophonePermission) {
      showIosMicrophoneSettingsAlert();
      return false;
    }

    const currentStatus = await iosMicrophonePermission.checkPermission();
    const nextStatus =
      currentStatus === 'undetermined'
        ? await iosMicrophonePermission.requestPermission()
        : currentStatus;

    if (nextStatus === 'granted') {
      return true;
    }

    if (nextStatus === 'denied') {
      showIosMicrophoneSettingsAlert();
    }

    return false;
  }

  if (Platform.OS !== 'android') {
    return false;
  }

  const hasPermission = await checkAudioPermission();
  if (hasPermission) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission Required',
      message:
        'VibeVoice needs microphone access to record and transcribe meetings.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'Allow',
    },
  );

  if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }

  if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    Alert.alert(
      'Permission Required',
      'Microphone permission was permanently denied. Please enable it in Settings > Apps > VibeVoice > Permissions.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: () => Linking.openSettings()},
      ],
    );
  }

  return false;
}
