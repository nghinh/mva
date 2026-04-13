import React from 'react';
import {Text, StyleSheet, TextStyle} from 'react-native';
import {colors} from '../../constants';

type IconName =
  | 'menu'
  | 'back'
  | 'memory'
  | 'cloud-off'
  | 'download'
  | 'delete'
  | 'refresh'
  | 'settings'
  | 'expand-more'
  | 'open-in-new'
  | 'forum'
  | 'insights'
  | 'check-circle'
  | 'warning'
  | 'error'
  | 'schedule'
  | 'fire'
  | 'dns'
  | 'sync'
  | 'help'
  | 'mic'
  | 'stop'
  | 'stop-circle'
  | 'copy'
  | 'language'
  | 'forward'
  | 'block'
  | 'bolt'
  | 'cloud_off'
  | 'signal_disconnected';

const glyphMap: Record<IconName, string> = {
  menu: '≡',
  back: '‹',
  memory: '◈',
  'cloud-off': '◌',
  'cloud_off': '◌',
  download: '↓',
  delete: '×',
  refresh: '↻',
  settings: '⚙',
  'expand-more': '⌄',
  'open-in-new': '↗',
  forum: '◫',
  insights: '◭',
  'check-circle': '●',
  warning: '▲',
  error: '!',
  schedule: '◷',
  fire: '✦',
  dns: '⌁',
  sync: '↺',
  help: '?',
  mic: '◉',
  stop: '◼',
  'stop-circle': '◼',
  copy: '◻',
  language: '◐',
  forward: '→',
  block: '⊘',
  bolt: '⚡',
  'signal_disconnected': '⛁',
};

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
}

export function AppIcon({name, size = 18, color = colors['on-surface'], style}: AppIconProps) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.icon, {fontSize: size, color}, style]}>
      {glyphMap[name]}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export type {IconName};
