/**
 * History List Screen
 *
 * Shows saved meetings by date and duration
 * Scaffold only for Epic 1
 *
 * @see docs/planning-artifacts/ux-design-specification.md#3 Session History Screen
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {getPersistenceService, SessionData} from '../../../services/persistence';

type HistoryNavigationProp = StackNavigationProp<RootStackParamList, 'History'>;

interface SessionItem {
  id: string;
  date: string;
  duration: string;
  languages: string[];
  status: 'complete' | 'interrupted' | 'offline';
}

function mapSessionToItem(session: SessionData): SessionItem {
  const end = session.endedAt ?? session.startedAt;
  const totalMinutes = Math.max(1, Math.round(Math.max(0, end - session.startedAt) / 60000));

  return {
    id: session.id,
    date: new Date(session.startedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    duration: `${totalMinutes} min`,
    languages: [session.sourceLanguage.toUpperCase(), session.targetLanguage.toUpperCase()],
    status: session.status === 'live' ? 'offline' : session.status,
  };
}

export function HistoryListScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<HistoryNavigationProp>();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const emptyState = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={[theme.typography.laneSecondary, {color: theme.colors.text.tertiary}]}> 
          No sessions yet
        </Text>
      </View>
    ),
    [theme.colors.text.tertiary, theme.typography.laneSecondary]
  );

  useEffect(() => {
    const persistence = getPersistenceService();
    const loadSessions = () => {
      persistence
        .getSessions()
        .then((storedSessions: SessionData[]) => setSessions(storedSessions.map(mapSessionToItem)))
        .catch((error: unknown) => {
          console.warn('[HistoryListScreen] Failed to load sessions:', error);
          setSessions([]);
        });
    };

    loadSessions();
    const unsubscribe = persistence.subscribe(loadSessions);

    return unsubscribe;
  }, []);

  const renderItem = ({item}: {item: SessionItem}) => {
    const statusColors = {
      complete: theme.colors.success,
      interrupted: theme.colors.warning,
      offline: theme.colors.info,
    };

    return (
      <TouchableOpacity
        style={[styles.sessionCard, {backgroundColor: theme.colors.surface.primary}]}
        onPress={() => navigation.navigate('SessionReview', {sessionId: item.id})}
        activeOpacity={0.7}>
        <View style={styles.sessionHeader}>
          <Text style={[theme.typography.lanePrimary, {color: theme.colors.text.primary}]}>
            {item.date}
          </Text>
          <View style={[styles.statusBadge, {backgroundColor: statusColors[item.status] + '20'}]}>
            <Text style={[theme.typography.micro, {color: statusColors[item.status]}]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.sessionMeta}>
          <Text style={[theme.typography.caption, {color: theme.colors.text.secondary}]}>
            {item.duration}
          </Text>
          <View style={styles.languageChips}>
            {item.languages.map((lang) => (
              <View
                key={lang}
                style={[styles.languageChip, {backgroundColor: theme.colors.surface.secondary}]}>
                <Text style={[theme.typography.micro, {color: theme.colors.text.tertiary}]}>
                  {lang}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={[styles.backIcon, {color: theme.colors.text.primary}]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, theme.typography.screenTitle, {color: theme.colors.text.primary}]}>
          History
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Session list */}
      <FlatList
        data={sessions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={emptyState}
      />
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
  headerSpacer: {
    width: 40,
  },
  backIcon: {
    fontSize: 24,
  },
  listContent: {
    padding: 16,
  },
  sessionCard: {
    borderRadius: 16,
    padding: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sessionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  languageChips: {
    flexDirection: 'row',
    gap: 6,
  },
  languageChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  separator: {
    height: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
});
