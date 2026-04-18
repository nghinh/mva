/**
 * HistoryListScreen
 *
 * Home screen showing past meeting sessions with a session card list,
 * empty state, long-press-to-delete, FAB, and bottom navigation.
 *
 * Matches design from docs/stich/meeting_history_home/code.html
 * @see Story S-5-2
 * @see docs/implementation-artifacts/5-2-build-session-history-list-on-home-screen.md
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {getPersistenceService, SessionData, UtteranceData} from '../../../services/persistence';
import {SessionId} from '../../../shared/types';
import {AppBottomNav, AppIcon} from '../../../shared/components/ui';

type HistoryNavigationProp = StackNavigationProp<RootStackParamList, 'History'>;

// =============================================================================
// Types
// =============================================================================

interface SessionItem {
  id: string;
  title: string;
  dateLabel: string;          // e.g. "Apr 11, 2026 • 14:30–15:45"
  durationLabel: string;     // e.g. "1H 15M", "45M", "30M"
  languages: string[];       // e.g. ["EN", "JA", "KO"]
  utteranceCount: number;
  speakerCount: number;
  lastTranslationPreview: string | null;
  status: 'complete' | 'interrupted' | 'offline';
}

// =============================================================================
// Language Pill Colors (from mockup)
// =============================================================================

const LANGUAGE_COLORS: Record<string, {bg: string; text: string}> = {
  EN: {bg: 'rgba(173, 198, 255, 0.2)', text: '#adc6ff'},   // tertiary
  JA: {bg: 'rgba(255, 180, 171, 0.2)', text: '#ffb4ab'},   // error
  KO: {bg: 'rgba(68, 238, 186, 0.2)', text: '#44eeba'},   // secondary
  DE: {bg: 'rgba(68, 238, 186, 0.2)', text: '#44eeba'},
  ZH: {bg: 'rgba(68, 238, 186, 0.2)', text: '#44eeba'},
  VI: {bg: 'rgba(68, 238, 186, 0.2)', text: '#44eeba'},
};

function getLanguageColor(lang: string): {bg: string; text: string} {
  return LANGUAGE_COLORS[lang.toUpperCase()] ?? {bg: 'rgba(200, 196, 215, 0.15)', text: '#c8c4d7'};
}

// =============================================================================
// Duration Formatting — "1H 15M", "45M", "30M" style
// =============================================================================

function formatDuration(startedAt: number, endedAt: number | null): string {
  const end = endedAt ?? startedAt;
  const totalMinutes = Math.max(1, Math.round(Math.max(0, end - startedAt) / 60000));

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) {
      return `${hours}H`;
    }
    return `${hours}H ${mins}M`;
  }
  return `${totalMinutes}M`;
}

// =============================================================================
// Session Title — derived from source/target language pair
// =============================================================================

function buildSessionTitle(_sourceLang: string, _targetLang: string): string {
  // In a real app, this would be derived from the meeting content or user-set title.
  // For now, show a generic title based on languages.
  return 'Meeting';
}

// =============================================================================
// Date Range Formatting — "Apr 11, 2026 • 14:30–15:45"
// =============================================================================

function formatSessionDateRange(session: SessionData): string {
  const start = new Date(session.startedAt);
  const end = session.endedAt ? new Date(session.endedAt) : null;

  const month = start.toLocaleString('en-US', {month: 'short'});
  const day = start.getDate();
  const year = start.getFullYear();
  const startTime = start.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});

  if (end) {
    const endTime = end.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
    return `${month} ${day}, ${year} • ${startTime}–${endTime}`;
  }

  return `${month} ${day}, ${year} • ${startTime}`;
}

// =============================================================================
// Map SessionData + Utterances → SessionItem
// =============================================================================

function mapSessionToItem(session: SessionData, utterances: UtteranceData[]): SessionItem {
  // Collect unique languages from utterances
  const detectedLangs = Array.from(
    new Set(utterances.map((u) => u.sourceLanguage.toUpperCase()).filter(Boolean))
  );
  // Also include sourceLanguage from session if no utterances
  const langs = detectedLangs.length > 0
    ? detectedLangs
    : [session.sourceLanguage.toUpperCase()].filter(Boolean);

  // Last translation = last utterance with a translatedText
  const lastTranslation =
    utterances.length > 0
      ? [...utterances]
          .reverse()
          .find((u) => u.translatedText !== null)?.translatedText ?? null
      : null;

  return {
    id: session.id,
    title: buildSessionTitle(session.sourceLanguage, session.targetLanguage),
    dateLabel: formatSessionDateRange(session),
    durationLabel: formatDuration(session.startedAt, session.endedAt),
    languages: langs,
    utteranceCount: utterances.length,
    speakerCount: session.speakerCount ?? 0,
    lastTranslationPreview: lastTranslation,
    status:
      session.status === 'live' ? 'offline' : (session.status as 'complete' | 'interrupted' | 'offline'),
  };
}

// =============================================================================
// App Header (from mockup: "Executive MVA" + status dot + settings)
// =============================================================================

interface AppHeaderProps {
  onSettingsPress?: () => void;
}

function AppHeader({onSettingsPress}: AppHeaderProps): React.JSX.Element {
  const {theme} = useTheme();

  return (
    <View style={[styles.appHeader, {backgroundColor: theme.colors.surface.secondary}]}>
      <View style={styles.appHeaderLeft}>
        <Text style={[styles.appHeaderTitle, {color: theme.colors.text.primary}]}>
          Executive MVA
        </Text>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={[styles.statusLabel, {color: theme.colors.secondary}]}>Connected</Text>
        </View>
      </View>
      <View style={styles.appHeaderRight}>
        <TouchableOpacity
          style={[styles.headerIconButton, {backgroundColor: theme.colors.surface['container-high']}]}
          onPress={onSettingsPress}
          activeOpacity={0.7}
          accessibilityLabel="Settings">
          <AppIcon name="settings" size={18} color={theme.colors.text.secondary} />
        </TouchableOpacity>
        <View style={[styles.avatar, {borderColor: 'rgba(71, 69, 84, 0.3)'}]}>
          {/* Placeholder avatar - in production would use actual user image */}
          <View style={[styles.avatarPlaceholder, {backgroundColor: theme.colors.surface['container-high']}]}>
            <Text style={{color: theme.colors.text.tertiary, fontSize: 12}}>NV</Text>
          </View>
        </View>
      </View>
    </View>
  );
}



// =============================================================================
// LanguagePill
// =============================================================================

interface LanguagePillProps {
  lang: string;
}

function LanguagePill({lang}: LanguagePillProps): React.JSX.Element {
  const {bg, text} = getLanguageColor(lang);
  return (
    <View style={[styles.languagePill, {backgroundColor: bg}]}>
      <Text style={[styles.languagePillText, {color: text}]}>{lang}</Text>
    </View>
  );
}

// =============================================================================
// FAB — New Meeting Button
// =============================================================================

interface FABNewMeetingProps {
  onPress: () => void;
}

function FABNewMeeting({onPress}: FABNewMeetingProps): React.JSX.Element {
  const {theme} = useTheme();

  return (
    <View style={styles.fabContainer}>
      {/* Tooltip label */}
      <View style={[styles.fabTooltip, {backgroundColor: theme.colors.surface['container-high']}]}>
        <Text style={[styles.fabTooltipText, {color: theme.colors.primary}]}>New Meeting</Text>
      </View>
      {/* FAB button */}
      <TouchableOpacity
        style={[styles.fab, {backgroundColor: theme.colors.primary}]}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityLabel="New Meeting"
        accessibilityRole="button">
        <AppIcon name="mic" size={24} color={theme.colors.surface.primary} />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState({onStartMeeting}: {onStartMeeting: () => void}): React.JSX.Element {
  const {theme} = useTheme();

  return (
    <View style={styles.emptyState}>
      {/* Mic icon in circle */}
      <TouchableOpacity
        style={[styles.emptyIconCircle, {backgroundColor: theme.colors.surface.container}]}
        onPress={onStartMeeting}
        activeOpacity={0.8}
        accessibilityLabel="Start a meeting">
        <AppIcon name="mic" size={40} color={theme.colors.text.tertiary} />
      </TouchableOpacity>

      {/* Text */}
      <Text style={[styles.emptyTitle, {color: theme.colors.text.primary}]}>
        Start your first meeting
      </Text>
      <Text style={[styles.emptySubtitle, {color: theme.colors.text.tertiary}]}>
        Your meeting history will appear here
      </Text>
    </View>
  );
}

// =============================================================================
// SessionCard
// =============================================================================

interface SessionCardProps {
  item: SessionItem;
  onPress: () => void;
  onDelete: () => void;
}

function SessionCard({item, onPress, onDelete}: SessionCardProps): React.JSX.Element {
  const {theme} = useTheme();

  const handleLongPress = useCallback(() => {
    Alert.alert(
      'Delete this session?',
      'This cannot be undone. All transcripts and translations will be permanently deleted.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
      {cancelable: true},
    );
  }, [onDelete]);

  return (
    <TouchableOpacity
      style={[styles.sessionCard, {backgroundColor: theme.colors.surface.container}]}
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={500}
      activeOpacity={0.7}
      accessibilityLabel={`${item.title}, ${item.dateLabel}, ${item.durationLabel}`}
      accessibilityHint="Long press to delete this session">
      {/* Header: title + duration badge */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleArea}>
          <Text style={[styles.cardDateLabel, {color: theme.colors.text.tertiary}]}>
            {item.dateLabel}
          </Text>
          <Text style={[styles.cardTitle, {color: theme.colors.text.primary}]}>
            {item.title}
          </Text>
        </View>
        <View
          style={[
            styles.durationBadge,
            {backgroundColor: theme.colors.surface['container-highest']},
          ]}>
          <Text style={[styles.durationBadgeText, {color: theme.colors.primary}]}>
            {item.durationLabel}
          </Text>
        </View>
      </View>

      {/* Language pills */}
      <View style={styles.cardLanguages}>
        {item.languages.map((lang) => (
          <LanguagePill key={lang} lang={lang} />
        ))}
      </View>

      {/* Utterance count */}
      <View style={styles.cardUtteranceRow}>
        <AppIcon name="insights" size={14} color={theme.colors.text.tertiary} />
        <Text style={[styles.cardUtteranceText, {color: theme.colors.text.tertiary}]}>
          {item.utteranceCount} Utterance{item.utteranceCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Last translation preview */}
      {item.lastTranslationPreview && (
        <View style={[styles.cardTranslationPreview, {borderTopColor: theme.colors.border.subtle}]}>
          <Text
            style={[styles.cardTranslationText, {color: theme.colors.text.tertiary}]}
            numberOfLines={1}
            ellipsizeMode="tail">
            "{item.lastTranslationPreview}"
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// HistoryListScreen
// =============================================================================

export function HistoryListScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<HistoryNavigationProp>();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const persistence = getPersistenceService();
      const storedSessions = await persistence.getSessions();
      const items = (
        await Promise.all(
          storedSessions.map(async (session) => {
            try {
              const utterances = await persistence.getUtterances(session.id);
              return mapSessionToItem(session, utterances);
            } catch (itemError) {
              console.warn('[HistoryListScreen] Failed to map session item:', session.id, itemError);
              return null;
            }
          }),
        )
      ).filter((item): item is SessionItem => item !== null);
      setSessions(items);
    } catch (error) {
      console.warn('[HistoryListScreen] Failed to load sessions:', error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load sessions with utterances (for count + last translation preview)
  useEffect(() => {
    const persistence = getPersistenceService();

    loadSessions();
    const unsubscribe = persistence.subscribe(loadSessions);
    return unsubscribe;
  }, [loadSessions]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadSessions();
    } catch (error) {
      console.warn('[HistoryListScreen] Failed to refresh sessions:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadSessions]);

  // Handle settings press
  const handleSettingsPress = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  // Navigate to new meeting
  const handleNewMeeting = useCallback(() => {
    navigation.navigate('Meeting');
  }, [navigation]);

  // Navigate to session review
  const handleSessionPress = useCallback(
    (sessionId: string) => {
      navigation.navigate('SessionReview', {sessionId});
    },
    [navigation],
  );

  // Delete session
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const persistence = getPersistenceService();
        await persistence.deleteSession(sessionId as SessionId);
        // List updates automatically via subscription
      } catch (error) {
        console.warn('[HistoryListScreen] Failed to delete session:', error);
        Alert.alert('Error', 'Failed to delete session. Please try again.');
      }
    },
    [],
  );

  // Render item
  const renderItem = useCallback(
    ({item}: {item: SessionItem}) => (
      <SessionCard
        item={item}
        onPress={() => handleSessionPress(item.id)}
        onDelete={() => handleDeleteSession(item.id)}
      />
    ),
    [handleSessionPress, handleDeleteSession],
  );

  const keyExtractor = useCallback((item: SessionItem) => item.id, []);

  const ListEmptyComponent = useMemo(
    () => (!isLoading ? <EmptyState onStartMeeting={handleNewMeeting} /> : null),
    [isLoading, handleNewMeeting],
  );

  const ItemSeparatorComponent = useCallback(() => <View style={styles.separator} />, []);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
      {/* App Header */}
      <AppHeader onSettingsPress={handleSettingsPress} />

      {/* Content */}
      <View style={styles.content}>
        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text.primary}]}>
            Sessions
          </Text>
          <Text style={[styles.sectionSubtitle, {color: theme.colors.text.tertiary}]}>
            Archived meeting transcripts
          </Text>
        </View>

        {/* Session list */}
        <FlatList
          data={sessions}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            sessions.length === 0 && styles.listContentEmpty,
          ]}
          ItemSeparatorComponent={ItemSeparatorComponent}
          ListEmptyComponent={ListEmptyComponent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      </View>

      {/* FAB — New Meeting */}
      <FABNewMeeting onPress={handleNewMeeting} />

      {/* Bottom Nav */}
      <AppBottomNav activeTab="meetings" />
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // App Header
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 64,
  },
  appHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#44eeba',
    shadowColor: '#44eeba',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  appHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content area
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Section header
  sectionHeader: {
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.6,
  },

  // List
  listContent: {
    paddingBottom: 140, // space for FAB + bottom nav
  },
  listContentEmpty: {
    flex: 1,
  },

  // Separator
  separator: {
    height: 20,
  },

  // Session Card
  sessionCard: {
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleArea: {
    flex: 1,
    gap: 4,
  },
  cardDateLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.5,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  durationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginLeft: 12,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Language pills
  cardLanguages: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  languagePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  languagePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Utterance row
  cardUtteranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  cardUtteranceText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Translation preview
  cardTranslationPreview: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  cardTranslationText: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.6,
    lineHeight: 18,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 120,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 20,
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 50,
  },
  fabTooltip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  fabTooltipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
  },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  navTab: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 3,
    minWidth: 72,
  },
  navTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
