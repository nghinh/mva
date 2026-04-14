/**
 * History List Screen
 *
 * Home screen showing past meeting sessions with a session card list,
 * empty state, long-press-to-delete, FAB, and bottom navigation.
 *
 * @see Story S-5-2
 * @see docs/implementation-artifacts/5-2-build-session-history-list-on-home-screen.md
 * @see docs/stich/meeting_history_home/code.html
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
import {AppIcon} from '../../../shared/components/ui';

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
  lastTranslationPreview: string | null;
  status: 'complete' | 'interrupted' | 'offline';
}

// =============================================================================
// Language Pill Colors (from mockup)
// =============================================================================

const LANGUAGE_COLORS: Record<string, {bg: string; text: string}> = {
  EN: {bg: 'rgba(173, 198, 255, 0.15)', text: '#adc6ff'},   // tertiary
  JA: {bg: 'rgba(255, 180, 171, 0.15)', text: '#ffb4ab'},   // error (red)
  KO: {bg: 'rgba(68, 238, 186, 0.15)', text: '#44eeba'},   // secondary (green)
  DE: {bg: 'rgba(68, 238, 186, 0.15)', text: '#44eeba'},   // secondary (green)
  ZH: {bg: 'rgba(68, 238, 186, 0.15)', text: '#44eeba'},   // secondary (green)
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

function buildSessionTitle(sourceLang: string, targetLang: string): string {
  return `${sourceLang.toUpperCase()}–${targetLang.toUpperCase()} Meeting`;
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
    languages: [
      session.sourceLanguage.toUpperCase(),
      session.targetLanguage.toUpperCase(),
    ],
    utteranceCount: utterances.length,
    lastTranslationPreview: lastTranslation,
    status:
      session.status === 'live' ? 'offline' : (session.status as 'complete' | 'interrupted' | 'offline'),
  };
}

// =============================================================================
// BottomNavBar
// =============================================================================

type TabName = 'meetings' | 'live' | 'network';

interface BottomNavBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

function BottomNavBar({activeTab, onTabPress}: BottomNavBarProps): React.JSX.Element {
  const {theme} = useTheme();

  const tabs: {name: TabName; label: string; icon: 'history' | 'mic' | 'dns'; filled: boolean}[] = [
    {name: 'meetings', label: 'Meetings', icon: 'history', filled: true},
    {name: 'live', label: 'Live', icon: 'mic', filled: false},
    {name: 'network', label: 'Network', icon: 'dns', filled: false},
  ];

  return (
    <View
      style={[
        styles.bottomNav,
        {backgroundColor: theme.colors.surface.primary},
      ]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.navTab, isActive && {backgroundColor: theme.colors.surface.container}]}
            onPress={() => onTabPress(tab.name)}
            activeOpacity={0.7}
            accessibilityLabel={tab.label}
            accessibilityRole="button">
            <AppIcon
              name={tab.icon}
              size={20}
              color={isActive ? theme.colors.primary : theme.colors.text.tertiary}
            />
            <Text
              style={[
                styles.navTabLabel,
                {color: isActive ? theme.colors.primary : theme.colors.text.tertiary},
              ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
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
  const [activeTab, setActiveTab] = useState<TabName>('meetings');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load sessions with utterances (for count + last translation preview)
  useEffect(() => {
    const persistence = getPersistenceService();

    const loadSessions = async () => {
      setIsLoading(true);
      try {
        const storedSessions = await persistence.getSessions();
        const items = await Promise.all(
          storedSessions.map(async (session) => {
            const utterances = await persistence.getUtterances(session.id);
            return mapSessionToItem(session, utterances);
          }),
        );
        setSessions(items);
      } catch (error) {
        console.warn('[HistoryListScreen] Failed to load sessions:', error);
        setSessions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
    const unsubscribe = persistence.subscribe(loadSessions);
    return unsubscribe;
  }, []);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const persistence = getPersistenceService();
      const storedSessions = await persistence.getSessions();
      const items = await Promise.all(
        storedSessions.map(async (session) => {
          const utterances = await persistence.getUtterances(session.id);
          return mapSessionToItem(session, utterances);
        }),
      );
      setSessions(items);
    } catch (error) {
      console.warn('[HistoryListScreen] Failed to refresh sessions:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Handle tab press
  const handleTabPress = useCallback(
    (tab: TabName) => {
      if (tab === 'meetings') {
        setActiveTab('meetings');
      } else if (tab === 'live') {
        navigation.navigate('Meeting');
      } else if (tab === 'network') {
        navigation.navigate('Settings');
      }
    },
    [navigation],
  );

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
    <SafeAreaView
      style={[styles.container, {backgroundColor: theme.colors.background.primary}]}> 
      {/* Header */}
      <View
        style={[
          styles.header,
          {backgroundColor: theme.colors.surface.primary},
        ]}>
        <View style={styles.headerLeft}>
          <Text
            style={[
              styles.headerTitle,
              theme.typography.screenTitle,
              {color: theme.colors.text.primary},
            ]}>
            Sessions
          </Text>
          <Text style={[styles.headerSubtitle, {color: theme.colors.text.tertiary}]}>
            Archived meeting transcripts
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusDot} />
          <Text style={[styles.statusLabel, {color: theme.colors.secondary}]}>Connected</Text>
        </View>
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

      {/* FAB — New Meeting */}
      <FABNewMeeting onPress={handleNewMeeting} />

      {/* Bottom Nav */}
      <BottomNavBar activeTab={activeTab} onTabPress={handleTabPress} />
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {},
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    opacity: 0.6,
  },
  headerRight: {
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

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 140, // space for FAB + bottom nav
  },
  listContentEmpty: {
    flex: 1,
  },

  // Separator
  separator: {
    height: 16,
  },

  // Session Card
  sessionCard: {
    borderRadius: 16,
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
    gap: 3,
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
    gap: 8,
    marginBottom: 12,
  },
  languagePill: {
    paddingHorizontal: 10,
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
  emptyArrowContainer: {
    position: 'absolute',
    bottom: 100,
    right: 40,
  },
  emptyArrowLine: {
    width: 60,
    height: 1.5,
    borderRadius: 1,
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
    paddingBottom: 28, // extra bottom safe area
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
