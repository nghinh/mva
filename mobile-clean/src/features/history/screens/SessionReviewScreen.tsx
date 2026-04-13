/**
 * Session Review Screen
 *
 * Shows a saved meeting in stable non-live context
 * Scaffold only for Epic 1
 *
 * @see docs/planning-artifacts/ux-design-specification.md#4 Session Review Screen
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {getPersistenceService, SessionData, UtteranceData} from '../../../services/persistence';

type SessionReviewNavigationProp = StackNavigationProp<RootStackParamList, 'SessionReview'>;
type SessionReviewRouteProp = RouteProp<RootStackParamList, 'SessionReview'>;

export function SessionReviewScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<SessionReviewNavigationProp>();
  const route = useRoute<SessionReviewRouteProp>();
  const sessionId = route.params?.sessionId;
  const [session, setSession] = useState<SessionData | null>(null);
  const [utterances, setUtterances] = useState<UtteranceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const persistence = getPersistenceService();
    const loadSession = () => {
      Promise.all([persistence.getSession(sessionId), persistence.getUtterances(sessionId)])
        .then(([storedSession, storedUtterances]) => {
          setSession(storedSession);
          setUtterances(storedUtterances);
        })
        .catch((error) => {
          console.warn('[SessionReviewScreen] Failed to load session detail:', error);
          setSession(null);
          setUtterances([]);
        })
        .finally(() => setIsLoading(false));
    };

    loadSession();
    const unsubscribe = persistence.subscribe(loadSession);

    return unsubscribe;
  }, [sessionId]);

  const sessionSummary = useMemo(() => {
    if (!session) {
      return null;
    }

    const end = session.endedAt ?? session.startedAt;
    const totalMinutes = Math.max(1, Math.round(Math.max(0, end - session.startedAt) / 60000));
    return {
      date: new Date(session.startedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      duration: `${totalMinutes} min`,
      language: `${session.sourceLanguage.toUpperCase()} → ${session.targetLanguage.toUpperCase()}`,
    };
  }, [session]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={[styles.backIcon, {color: theme.colors.text.primary}]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, theme.typography.screenTitle, {color: theme.colors.text.primary}]}>
          Session Review
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {!sessionId || (!isLoading && !session) ? (
          <View style={[styles.summaryCard, {backgroundColor: theme.colors.surface.primary}]}> 
            <Text style={[theme.typography.sectionTitle, {color: theme.colors.text.primary}]}>Session unavailable</Text>
            <Text style={[theme.typography.caption, {color: theme.colors.text.secondary}]}>The requested session could not be found.</Text>
          </View>
        ) : isLoading || !sessionSummary ? (
          <View style={[styles.summaryCard, {backgroundColor: theme.colors.surface.primary}]}> 
            <Text style={[theme.typography.caption, {color: theme.colors.text.secondary}]}>Loading session...</Text>
          </View>
        ) : (
          <>
            <View style={[styles.summaryCard, {backgroundColor: theme.colors.surface.primary}]}> 
              <Text style={[theme.typography.sectionTitle, {color: theme.colors.text.primary}]}> 
                {sessionSummary.date}
              </Text>
              <View style={styles.summaryMeta}>
                <Text style={[theme.typography.caption, {color: theme.colors.text.secondary}]}> 
                  {sessionSummary.duration}
                </Text>
                <View style={[styles.languageBadge, {backgroundColor: theme.colors.surface.secondary}]}> 
                  <Text style={[theme.typography.micro, {color: theme.colors.text.tertiary}]}> 
                    {sessionSummary.language}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.utterancesSection}>
              <Text style={[styles.sectionTitle, theme.typography.sectionTitle, {color: theme.colors.text.primary}]}> 
                Transcript
              </Text>

              {utterances.map((utterance) => (
                <View
                  key={utterance.id}
                  style={[styles.utteranceCard, {backgroundColor: theme.colors.surface.primary}]}> 
                  <Text style={[theme.typography.micro, {color: theme.colors.text.tertiary}]}> 
                    {new Date(utterance.timestamp).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </Text>

                  <View style={styles.contentLane}>
                    <Text style={[styles.laneLabel, theme.typography.micro, {color: theme.colors.text.tertiary}]}> 
                      {utterance.sourceLanguage.toUpperCase()}
                    </Text>
                    <Text style={[theme.typography.lanePrimary, {color: theme.colors.text.primary}]}> 
                      {utterance.sourceText}
                    </Text>
                  </View>

                  <View style={styles.contentLane}>
                    <Text style={[styles.laneLabel, theme.typography.micro, {color: theme.colors.secondary}]}> 
                      VI
                    </Text>
                    <Text style={[theme.typography.laneSecondary, {color: theme.colors.secondary}]}> 
                      {utterance.translatedText ?? 'No translation captured'}
                    </Text>
                  </View>

                  {utterance.suggestionText && (
                    <View style={styles.contentLane}>
                      <Text style={[styles.laneLabel, theme.typography.micro, {color: theme.colors.accent}]}> 
                        AI
                      </Text>
                      <Text style={[theme.typography.laneSecondary, {color: theme.colors.accent}]}> 
                        {utterance.suggestionText}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        )}
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
    padding: 16,
    gap: 16,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  languageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  utterancesSection: {
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  utteranceCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  contentLane: {
    gap: 4,
  },
  laneLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
