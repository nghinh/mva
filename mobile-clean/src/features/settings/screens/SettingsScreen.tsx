/**
 * Settings Screen
 *
 * Configure offline model management and local app behavior.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {useDeveloperMode, useSettingsStore} from '../../../shared/store';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

export function SettingsScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<SettingsNavigationProp>();
  const developerMode = useDeveloperMode();
  const {setDeveloperMode} = useSettingsStore();

  const renderSettingRow = (
    label: string,
    description: string,
    rightContent: React.ReactNode,
  ) => (
    <View style={[styles.settingRow, {borderBottomColor: theme.colors.border.subtle}]}> 
      <View style={styles.settingInfo}>
        <Text style={[theme.typography.lanePrimary, {color: theme.colors.text.primary}]}> 
          {label}
        </Text>
        <Text style={[theme.typography.caption, {color: theme.colors.text.tertiary}]}> 
          {description}
        </Text>
      </View>
      {rightContent}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}> 
      <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={[styles.backIcon, {color: theme.colors.text.primary}]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, theme.typography.screenTitle, {color: theme.colors.text.primary}]}> 
          Settings
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, theme.typography.sectionTitle, {color: theme.colors.text.primary}]}> 
            Models
          </Text>
          <TouchableOpacity
            style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}
            onPress={() => navigation.navigate('ModelRepository')}
            activeOpacity={0.8}>
            <Text style={[theme.typography.lanePrimary, {color: theme.colors.text.primary}]}> 
              AI Models
            </Text>
            <Text style={[theme.typography.caption, {color: theme.colors.text.tertiary}]}> 
              Review local model availability, storage usage, and lifecycle controls.
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, theme.typography.sectionTitle, {color: theme.colors.text.primary}]}> 
            Translation
          </Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
            <View style={styles.settingInfo}>
              <Text style={[theme.typography.lanePrimary, {color: theme.colors.text.primary}]}>Target Language</Text>
              <Text style={[theme.typography.caption, {color: theme.colors.text.tertiary}]}>Vietnamese (default for v1 offline build)</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, theme.typography.sectionTitle, {color: theme.colors.text.primary}]}> 
            Developer Options
          </Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
            {renderSettingRow(
              'Developer Diagnostics',
              'Show technical status information',
              <Switch
                value={developerMode}
                onValueChange={setDeveloperMode}
                trackColor={{false: theme.colors.surface.secondary, true: theme.colors.primary}}
                thumbColor={theme.colors.text.primary}
              />,
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, theme.typography.sectionTitle, {color: theme.colors.text.primary}]}> 
            About
          </Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
            <View style={[styles.aboutRow, {borderBottomColor: theme.colors.border.subtle}]}> 
              <Text style={[theme.typography.caption, {color: theme.colors.text.tertiary}]}>Version</Text>
              <Text style={[theme.typography.caption, {color: theme.colors.text.primary}]}>0.1.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={[theme.typography.caption, {color: theme.colors.text.tertiary}]}>Model</Text>
              <Text style={[theme.typography.caption, {color: theme.colors.text.primary}]}>SenseVoice + NLLB (offline)</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {},
  backIcon: {
    fontSize: 24,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
    gap: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
});

export default SettingsScreen;
