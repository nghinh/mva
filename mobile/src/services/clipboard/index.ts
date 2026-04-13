import Clipboard from '@react-native-clipboard/clipboard';

export async function copyToClipboard(text: string): Promise<void> {
  Clipboard.setString(text);
}
