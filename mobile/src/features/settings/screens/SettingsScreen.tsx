/**
 * Settings Screen
 *
 * Professional settings layout for offline model management and app preferences.
 * All AI inference runs locally — no network dependency.
 */

import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  Modal,
} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {
  useDeveloperMode,
  useSettingsStore,
  useModelState,
  useTranslatorModelState,
  useTargetLanguage,
  TARGET_LANGUAGE_OPTIONS,
  getLanguageOption,
} from '../../../shared/store';
import {getPersistenceService} from '../../../services/persistence';
import {spacing, borderRadius, typography} from '../../../shared/constants';
import {AppIcon} from '../../../shared/components/ui';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

// Bundled model info (sizes are fixed for bundled models)
const SENSEVOICE_SIZE_MB = 234;
const NLLB_SIZE_MB = 780;
const TOTAL_MODELS_SIZE_MB = SENSEVOICE_SIZE_MB + NLLB_SIZE_MB;

// Language flag emojis for selector
const LANGUAGE_FLAGS: Record<string, string> = {
  vi: '🇻🇳',
  zh: '🇨🇳',
  ko: '🇰🇷',
  ja: '🇯🇵',
};

export function SettingsScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<SettingsNavigationProp>();
  const developerMode = useDeveloperMode();
  const {setDeveloperMode} = useSettingsStore();
  const modelState = useModelState();
  const translatorModelState = useTranslatorModelState();
  const targetLanguage = useTargetLanguage();
  const {setTargetLanguage} = useSettingsStore();
  const currentLangOption = getLanguageOption(targetLanguage);

  // Session data size estimation (would be derived from persistence in production)
  const [sessionDataSizeMB] = useState<number>(0);
  const [langSelectorVisible, setLangSelectorVisible] = useState(false);

  const handleDeleteAllSessions = useCallback(async () => {
    Alert.alert(
      'Delete All Sessions',
      'Permanently delete all meeting sessions, transcripts, and translations? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const persistence = getPersistenceService();
              await persistence.deleteAllSessions();
            } catch (error) {
              console.warn('[SettingsScreen] Failed to delete all sessions:', error);
              Alert.alert('Error', 'Failed to delete all sessions. Please try again.');
            }
          },
        },
      ],
    );
  }, []);

  const getModelStatusDisplay = (status: string, isReady: boolean) => {
    if (isReady || status === 'cached-ready') {
      return {icon: 'check-circle', color: theme.colors.secondary, label: 'Ready'};
    }
    if (status === 'downloading') {
      return {icon: 'download', color: theme.colors.primary, label: 'Preparing'};
    }
    if (status === 'deleting') {
      return {icon: 'delete', color: theme.colors.error, label: 'Removing'};
    }
    if (status === 'invalid') {
      return {icon: 'error', color: theme.colors.error, label: 'Invalid'};
    }
    return {icon: 'cloud-off', color: theme.colors.text.tertiary, label: 'Not Available'};
  };

  const sttStatus = getModelStatusDisplay(modelState.status, modelState.status === 'cached-ready');
  const nllbStatus = getModelStatusDisplay(translatorModelState.status, translatorModelState.status === 'cached-ready');

  const renderModelCard = (
    name: string,
    description: string,
    sizeMB: number,
    statusInfo: {icon: string; color: string; label: string},
    onPress?: () => void,
  ) => (
    <TouchableOpacity
      style={[styles.modelCard, {backgroundColor: theme.colors.surface.container}]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}>
      <View style={styles.modelCardHeader}>
        <View style={styles.modelCardInfo}>
          <Text style={[styles.modelCardName, {color: theme.colors.text.primary}]}>{name}</Text>
          <Text style={[styles.modelCardDesc, {color: theme.colors.text.tertiary}]}>{description}</Text>
        </View>
        <View style={[styles.statusBadge, {backgroundColor: statusInfo.color + '20', borderColor: statusInfo.color + '40'}]}>
          <AppIcon name={statusInfo.icon as any} size={12} color={statusInfo.color} />
          <Text style={[styles.statusBadgeText, {color: statusInfo.color}]}>{statusInfo.label}</Text>
        </View>
      </View>
      <View style={styles.modelCardFooter}>
        <Text style={[styles.modelCardSize, {color: theme.colors.text.tertiary}]}>{sizeMB} MB</Text>
        {onPress && (
          <Text style={[styles.modelCardAction, {color: theme.colors.primary}]}>Manage</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.secondary}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backButton}>
          <AppIcon name="back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: theme.colors.text.primary}]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* AI Models Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI Models</Text>
          <Text style={styles.sectionSubtitle}>Bundled offline models — all processing happens on-device</Text>

          {renderModelCard(
            'SenseVoice-Small',
            'Speech recognition (STT)',
            SENSEVOICE_SIZE_MB,
            sttStatus,
            () => navigation.navigate('ModelRepository'),
          )}
          {renderModelCard(
            'NLLB-600M',
            'Neural machine translation',
            NLLB_SIZE_MB,
            nllbStatus,
            () => navigation.navigate('ModelRepository'),
          )}
        </View>

        {/* Translation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Translation</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setLangSelectorVisible(true)}
              activeOpacity={0.7}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Target Language</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>
                  All translations output to this language
                </Text>
              </View>
              <View style={[styles.languageSelector, {backgroundColor: theme.colors.surface.container}]}>
                <Text style={[styles.languageFlag]}>{LANGUAGE_FLAGS[targetLanguage] ?? '🇻🇳'}</Text>
                <Text style={[styles.languageCode, {color: theme.colors.text.primary}]}>
                  {targetLanguage.toUpperCase()}
                </Text>
                <AppIcon name="chevron-down" size={16} color={theme.colors.text.tertiary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Storage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Storage</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.storageRow}>
              <Text style={[styles.storageLabel, {color: theme.colors.text.tertiary}]}>AI Models</Text>
              <Text style={[styles.storageValue, {color: theme.colors.text.primary}]}>{TOTAL_MODELS_SIZE_MB} MB</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.storageRow}>
              <Text style={[styles.storageLabel, {color: theme.colors.text.tertiary}]}>Session Data</Text>
              <Text style={[styles.storageValue, {color: theme.colors.text.primary}]}>
                {sessionDataSizeMB > 0 ? `${sessionDataSizeMB} MB` : '—'}
              </Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, {color: theme.colors.text.primary}]}>Total Local</Text>
              <Text style={[styles.totalValue, {color: theme.colors.primary}]}>
                {TOTAL_MODELS_SIZE_MB + sessionDataSizeMB} MB
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.deleteButton, {borderColor: theme.colors.error + '40'}]}
            onPress={handleDeleteAllSessions}
            activeOpacity={0.7}>
            <AppIcon name="delete" size={18} color={theme.colors.error} />
            <Text style={[styles.deleteButtonText, {color: theme.colors.error}]}>Delete All Sessions</Text>
          </TouchableOpacity>
        </View>

        {/* Developer Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Developer Options</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Developer Mode</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>
                  Show performance metrics overlay during meetings
                </Text>
              </View>
              <Switch
                value={developerMode}
                onValueChange={setDeveloperMode}
                trackColor={{false: theme.colors.surface.container, true: theme.colors.primary + '60'}}
                thumbColor={developerMode ? theme.colors.primary : theme.colors.text.tertiary}
              />
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Privacy</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.privacyRow}>
              <View style={styles.privacyBadge}>
                <AppIcon name="check-circle" size={20} color={theme.colors.secondary} />
                <Text style={[styles.privacyBadgeText, {color: theme.colors.secondary}]}>100% Offline</Text>
              </View>
              <Text style={[styles.privacyDesc, {color: theme.colors.text.tertiary}]}>
                All AI inference runs locally. No audio or text ever leaves your device. All data is stored in app-private sandbox — uninstalling the app permanently removes all data.
              </Text>
            </View>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>Version</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>1.0.0</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>AI Models</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>SenseVoice + NLLB-600M</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>Target</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>
                {currentLangOption.nativeLabel} ({currentLangOption.label})
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Language Selector Modal */}
      <Modal
        visible={langSelectorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangSelectorVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLangSelectorVisible(false)}>
          <View style={[styles.modalContent, {backgroundColor: theme.colors.surface.primary}]}>
            <Text style={[styles.modalTitle, {color: theme.colors.text.primary}]}>Select Target Language</Text>
            {TARGET_LANGUAGE_OPTIONS.map((langOption, index) => (
              <TouchableOpacity
                key={langOption.code}
                style={[
                  styles.langOption,
                  index < TARGET_LANGUAGE_OPTIONS.length - 1 && {borderBottomWidth: 1, borderBottomColor: theme.colors.border.subtle},
                  targetLanguage === langOption.code && {backgroundColor: theme.colors.surface.container},
                ]}
                onPress={() => {
                  setTargetLanguage(langOption.code);
                  setLangSelectorVisible(false);
                }}
                activeOpacity={0.7}>
                <Text style={[styles.langOptionFlag]}>{LANGUAGE_FLAGS[langOption.code] ?? '🌐'}</Text>
                <View style={styles.langOptionInfo}>
                  <Text style={[styles.langOptionNative, {color: theme.colors.text.primary}]}>
                    {langOption.nativeLabel}
                  </Text>
                  <Text style={[styles.langOptionLabel, {color: theme.colors.text.tertiary}]}>
                    {langOption.label}
                  </Text>
                </View>
                {targetLanguage === langOption.code && (
                  <AppIcon name="check-circle" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing.xxs,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modelCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  modelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modelCardInfo: {
    flex: 1,
  },
  modelCardName: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  modelCardDesc: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xxs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs,
  },
  statusBadgeText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  modelCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  modelCardSize: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
  },
  modelCardAction: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  settingDesc: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xxs,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  languageFlag: {
    fontSize: typography.fontSize.md,
  },
  languageCode: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  storageLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
  },
  storageValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  totalLabel: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  totalValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  deleteButtonText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  privacyRow: {
    padding: spacing.md,
    alignItems: 'center',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  privacyBadgeText: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  privacyDesc: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  aboutLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
  },
  aboutValue: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  langOptionFlag: {
    fontSize: 24,
  },
  langOptionInfo: {
    flex: 1,
  },
  langOptionNative: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  langOptionLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
});

export default SettingsScreen;
