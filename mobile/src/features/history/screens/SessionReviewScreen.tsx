/**
 * Session Review Screen
 *
 * Shows a saved meeting in stable non-live context.
 * Full implementation for Story S-5-3 matching UX mockups.
 *
 * @see docs/planning-artifacts/ux-design-specification.md#4 Session Review Screen
 * @see docs/implementation-artifacts/5-3-build-session-review-detail-screen.md
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  SafeAreaView,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {getPersistenceService, SessionData, UtteranceData} from '../../../services/persistence';
import {SpeakerBadge} from '../../../shared/components/ui';
import {getSpeakerClusterService} from '../../../services/speaker/SpeakerClusterService';

type SessionReviewNavigationProp = StackNavigationProp<RootStackParamList, 'SessionReview'>;
type SessionReviewRouteProp = RouteProp<RootStackParamList, 'SessionReview'>;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineEntry {
  id: string;
  timestamp: number;
  sourceLanguage: string;
  sourceText: string;
  translatedText: string | null;
  /** Speaker identifier (S1, S2, S3...) - non-fatal if absent */
  speakerId?: string | null;
  /** Display label for speaker (e.g., "Speaker 1") - non-fatal if absent */
  speakerLabel?: string | null;
}

interface SessionSummary {
  dateLabel: string;
  durationLabel: string;
  totalUtterances: number;
  languageBreakdown: {
    EN: number;
    JA: number;
    KO: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function buildSummary(session: SessionData, utterances: UtteranceData[]): SessionSummary {
  const end = session.endedAt ?? session.startedAt;
  const totalMinutes = Math.max(1, Math.round(Math.max(0, end - session.startedAt) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const dateLabel = new Date(session.startedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const languageBreakdown = {EN: 0, JA: 0, KO: 0};
  for (const u of utterances) {
    const lang = u.sourceLanguage.toUpperCase();
    if (lang === 'EN' || lang === 'ENGLISH') languageBreakdown.EN++;
    else if (lang === 'JA' || lang === 'JAPANESE') languageBreakdown.JA++;
    else if (lang === 'KO' || lang === 'KOREAN') languageBreakdown.KO++;
  }

  return {
    dateLabel,
    durationLabel,
    totalUtterances: utterances.length,
    languageBreakdown,
  };
}

function buildTimeline(utterances: UtteranceData[]): TimelineEntry[] {
  return [...utterances]
    .filter((u) => u.isFinal)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((u) => ({
      id: u.id,
      timestamp: u.timestamp,
      sourceLanguage: u.sourceLanguage,
      sourceText: u.sourceText,
      translatedText: u.translatedText,
      speakerId: u.speakerId ?? null,
      speakerLabel: u.speakerLabel ?? null,
    }));
}

// Language badge colors matching the mockup palette
const LANG_COLORS: Record<string, {text: string; bg: string}> = {
  EN: {text: '#c6bfff', bg: 'rgba(198,191,255,0.12)'},
  JA: {text: '#44eeba', bg: 'rgba(68,238,186,0.12)'},
  KO: {text: '#adc6ff', bg: 'rgba(173,198,255,0.12)'},
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SessionReviewScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<SessionReviewNavigationProp>();
  const route = useRoute<SessionReviewRouteProp>();
  const sessionId = route.params?.sessionId;

  const [session, setSession] = useState<SessionData | null>(null);
  const [utterances, setUtterances] = useState<UtteranceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // ── Data loading ──
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

  // ── Derived state ──
  const summary = useMemo<SessionSummary | null>(
    () => (session ? buildSummary(session, utterances) : null),
    [session, utterances],
  );

  const timeline = useMemo<TimelineEntry[]>(() => buildTimeline(utterances), [utterances]);

  // ── Export handler ──
  const handleExportTranscript = async () => {
    if (!session || utterances.length === 0) return;
    setIsExporting(true);
    try {
      const lines: string[] = [];
      const dateLabel = new Date(session.startedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      lines.push(`Meeting Voice Assistant - Meeting ${dateLabel}`);
      lines.push('=============================================');
      lines.push('');
      for (const u of utterances.filter((u) => u.isFinal).sort((a, b) => a.timestamp - b.timestamp)) {
        const speakerTag = u.speakerId ? `[${u.speakerId}] ` : '';
        lines.push(`[${formatTimestamp(u.timestamp)}] ${speakerTag}[${u.sourceLanguage.toUpperCase()}] ${u.sourceText}`);
        if (u.translatedText) lines.push(`→ ${u.translatedText}`);
        lines.push('');
      }
      const langCounts = {EN: 0, JA: 0, KO: 0};
      for (const u of utterances) {
        const l = u.sourceLanguage.toUpperCase();
        if (l === 'EN' || l === 'ENGLISH') langCounts.EN++;
        else if (l === 'JA' || l === 'JAPANESE') langCounts.JA++;
        else if (l === 'KO' || l === 'KOREAN') langCounts.KO++;
      }
      lines.push('---');
      lines.push(`Summary: ${utterances.length} utterances | Duration: ${summary?.durationLabel ?? '—'} | EN ${langCounts.EN} | JA ${langCounts.JA} | KO ${langCounts.KO}`);
      await Share.share({message: lines.join('\n')});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Export Failed', `Could not export transcript: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Recalculate speakers handler ──
  const handleRecalculateSpeakers = async () => {
    Alert.alert(
      'Speaker Recalculation Unavailable',
      'Speaker diarization now runs after meeting stop for stability. Review-time recalculation is disabled in this build.',
    );
  };

  // ── Bottom nav items ──
  type NavItem = {label: string; icon: string; active: boolean; disabled: boolean};
  const bottomNavItems: NavItem[] = [
    {label: 'Transcript', icon: '📄', active: true, disabled: false},
    {label: 'Insights', icon: '💡', active: false, disabled: true},
    {label: 'Media', icon: '🎧', active: false, disabled: true},
    {label: 'Export', icon: '📤', active: false, disabled: true},
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // Timeline entry renderer
  // ───────────────────────────────────────────────────────────────────────────
  const renderTimelineEntry = ({item, index}: {item: TimelineEntry; index: number}) => {
    const langUpper = item.sourceLanguage.toUpperCase();
    const langStyle = LANG_COLORS[langUpper] ?? {text: theme.colors.text.tertiary, bg: `${theme.colors.text.tertiary}20`};

    return (
      <View style={styles.timelineEntry}>
        {/* Vertical connector line (between dots) */}
        {index < timeline.length - 1 && (
          <View
            style={[
              styles.timelineLine,
              {backgroundColor: theme.colors.border.subtle},
            ]}
          />
        )}

        {/* Timeline dot */}
        <View
          style={[
            styles.timelineDot,
            {backgroundColor: theme.colors.primary},
          ]}
        />

        {/* Entry content */}
        <View style={styles.timelineContent}>
          {/* Speaker badge + Timestamp + language badge */}
          <View style={styles.entryMeta}>
            {/* Speaker badge - shown before language badge if available */}
            <SpeakerBadge speakerId={item.speakerId} label={item.speakerId} size="small" />
            <Text style={[styles.timestamp, {color: theme.colors.text.tertiary}]}>
              {formatTimestamp(item.timestamp)}
            </Text>
            <View style={[styles.langBadge, {backgroundColor: langStyle.bg}]}>
              <Text style={[styles.langBadgeText, {color: langStyle.text}]}>
                {langUpper}
              </Text>
            </View>
          </View>

          {/* Original text card */}
          <View style={[styles.textCard, {backgroundColor: theme.colors.surface.primary}]}>
            <Text style={[styles.originalText, {color: theme.colors.text.primary}]}>
              {item.sourceText}
            </Text>
          </View>

          {/* Vietnamese translation (amber italic) */}
          {item.translatedText && (
            <View
              style={[
                styles.translationCard,
                {
                  backgroundColor: 'rgba(68,238,186,0.05)',
                  borderLeftColor: 'rgba(68,238,186,0.25)',
                },
              ]}>
              <Text style={[styles.translationText, {color: theme.colors.secondary}]}>
                {item.translatedText}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Header (per mockup: back + "Meeting Apr 11, 2026" + share + more_vert)
  // ───────────────────────────────────────────────────────────────────────────
  const Header = () => (
    <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        style={styles.headerBackBtn}>
        <Text style={[styles.headerIcon, {color: theme.colors.text.primary}]}>←</Text>
      </TouchableOpacity>

      <Text
        style={[styles.headerTitle, theme.typography.screenTitle, {color: theme.colors.text.primary}]}
        numberOfLines={1}>
        {summary ? `Meeting ${summary.dateLabel}` : 'Meeting Review'}
      </Text>

      <View style={styles.headerActions}>
        <TouchableOpacity activeOpacity={0.7} style={styles.headerIconBtn}>
          <Text style={[styles.headerIcon, {color: theme.colors.text.secondary}]}>↗</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.headerIconBtn}>
          <Text style={[styles.headerIcon, {color: theme.colors.text.secondary}]}>⋮</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Summary Bento Cards
  // ───────────────────────────────────────────────────────────────────────────
  const SummaryDurationCard = () => (
    <View style={[styles.bentoCard, {backgroundColor: theme.colors.surface.primary}]}>
      <View style={styles.bentoCardHeader}>
        <Text style={[styles.bentoCardLabel, {color: theme.colors.text.tertiary}]}>
          Duration
        </Text>
        <Text style={styles.bentoCardIcon}>⏱</Text>
      </View>
      <Text style={[styles.bentoCardValue, {color: theme.colors.text.primary}]}>
        {summary?.durationLabel ?? '—'}
      </Text>
    </View>
  );

  const SummaryUtterancesCard = () => (
    <View style={[styles.bentoCard, {backgroundColor: theme.colors.surface.primary}]}>
      <View style={styles.bentoCardHeader}>
        <Text style={[styles.bentoCardLabel, {color: theme.colors.text.tertiary}]}>
          Total Activity
        </Text>
        <Text style={styles.bentoCardIcon}>🎙</Text>
      </View>
      <Text style={[styles.bentoCardValue, {color: theme.colors.text.primary}]}>
        {summary != null ? `${summary.totalUtterances} utterances` : '—'}
      </Text>
    </View>
  );

  const SummaryLanguageCard = () => {
    const lb = summary?.languageBreakdown ?? {EN: 0, JA: 0, KO: 0};
    return (
      <View style={[styles.bentoCard, {backgroundColor: theme.colors.surface.primary}]}>
        <View style={styles.bentoCardHeader}>
          <Text style={[styles.bentoCardLabel, {color: theme.colors.text.tertiary}]}>
            Language Split
          </Text>
        </View>
        <View style={styles.languageSplitRow}>
          <View style={styles.languageSplitItem}>
            <Text style={[styles.languageSplitLabel, {color: '#c6bfff'}]}>EN</Text>
            <Text style={[styles.languageSplitCount, {color: theme.colors.text.secondary}]}>
              {lb.EN}
            </Text>
          </View>
          <View style={[styles.languageSplitDivider, {backgroundColor: theme.colors.border.subtle}]} />
          <View style={styles.languageSplitItem}>
            <Text style={[styles.languageSplitLabel, {color: '#44eeba'}]}>JA</Text>
            <Text style={[styles.languageSplitCount, {color: theme.colors.text.secondary}]}>
              {lb.JA}
            </Text>
          </View>
          <View style={[styles.languageSplitDivider, {backgroundColor: theme.colors.border.subtle}]} />
          <View style={styles.languageSplitItem}>
            <Text style={[styles.languageSplitLabel, {color: '#adc6ff'}]}>KO</Text>
            <Text style={[styles.languageSplitCount, {color: theme.colors.text.secondary}]}>
              {lb.KO}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Empty / loading states
  // ───────────────────────────────────────────────────────────────────────────
  if (!sessionId || (!isLoading && !session)) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
        <Header />
        <View style={styles.centerContent}>
          <Text style={[theme.typography.sectionTitle, {color: theme.colors.text.primary}]}>
            Session unavailable
          </Text>
          <Text style={[theme.typography.caption, {color: theme.colors.text.secondary}]}>
            The requested session could not be found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading || !summary) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
        <Header />
        <View style={styles.centerContent}>
          <Text style={[theme.typography.caption, {color: theme.colors.text.secondary}]}>
            Loading session…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main render
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
      <Header />

      <FlatList
        data={timeline}
        renderItem={renderTimelineEntry}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ── Summary Bento Grid ── */}
            <View style={styles.bentoGrid}>
              <SummaryDurationCard />
              <SummaryUtterancesCard />
              <SummaryLanguageCard />
            </View>

            {/* ── Timeline section label ── */}
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>
                Conversation Timeline
              </Text>
            </View>
          </>
        }
        ListFooterComponent={
          <>
            {/* ── Recalculate Speakers Button ── */}
            <View style={styles.exportSection}>
              <TouchableOpacity
                style={[
                  styles.exportButton,
                  {borderColor: theme.colors.primary + '40'},
                ]}
                onPress={handleRecalculateSpeakers}
                disabled={isRecalculating}
                activeOpacity={0.7}>
                {isRecalculating ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Text style={styles.exportButtonIcon}>🔄</Text>
                    <Text style={[styles.exportButtonText, {color: theme.colors.primary}]}>
                      Recalculate Speakers
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ── Export Button (centered) ── */}
            <View style={styles.exportSection}>
              <TouchableOpacity
                style={[
                  styles.exportButton,
                  {borderColor: theme.colors.border.subtle},
                ]}
                onPress={handleExportTranscript}
                disabled={isExporting}
                activeOpacity={0.7}>
                {isExporting ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Text style={styles.exportButtonIcon}>📋</Text>
                    <Text style={[styles.exportButtonText, {color: theme.colors.text.primary}]}>
                      Export Transcript
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Spacer for bottom nav */}
            <View style={styles.bottomNavSpacer} />
          </>
        }
      />

      {/* ── Bottom Navigation Bar ── */}
      <View style={[styles.bottomNav, {backgroundColor: theme.colors.surface.primary}]}>
        {bottomNavItems.map((item) => (
          <View key={item.label} style={styles.bottomNavItem}>
            {item.active ? (
              <View style={[styles.bottomNavActive, {backgroundColor: theme.colors.surface.secondary}]}>
                <Text style={styles.bottomNavIcon}>{item.icon}</Text>
                <Text style={[styles.bottomNavLabel, {color: theme.colors.primary}]}>
                  {item.label}
                </Text>
              </View>
            ) : (
              <View style={[styles.bottomNavInactive, {opacity: item.disabled ? 0.4 : 1}]}>
                <Text style={styles.bottomNavIcon}>{item.icon}</Text>
                <Text style={[styles.bottomNavLabel, {color: theme.colors.text.tertiary}]}>
                  {item.label}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  headerBackBtn: {
    padding: 8,
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconBtn: {
    padding: 8,
  },

  // ── Center placeholder ──
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 32,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },

  // ── Bento Grid ──
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  bentoCard: {
    borderRadius: 16,
    padding: 16,
    minHeight: 96,
    flex: 1,
    justifyContent: 'space-between',
  },
  bentoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bentoCardLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bentoCardIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  bentoCardValue: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },

  // ── Language Split ──
  languageSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 12,
  },
  languageSplitItem: {
    alignItems: 'center',
    flex: 1,
  },
  languageSplitLabel: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
  },
  languageSplitCount: {
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 2,
  },
  languageSplitDivider: {
    width: 1,
    height: 24,
    opacity: 0.3,
  },

  // ── Section label ──
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // ── Timeline ──
  timelineEntry: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 14,
    bottom: -24,
    width: 1,
    opacity: 0.4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 16,
    marginTop: 4,
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
    gap: 8,
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  timestamp: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  langBadgeText: {
    fontFamily: 'System',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textCard: {
    borderRadius: 12,
    padding: 14,
  },
  originalText: {
    fontFamily: 'System',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  translationCard: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 3,
  },
  translationText: {
    fontFamily: 'System',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    fontWeight: '400',
  },

  // ── Export ──
  exportSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    justifyContent: 'center',
  },
  exportButtonIcon: {
    fontSize: 16,
  },
  exportButtonText: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ── Bottom Nav ──
  bottomNavSpacer: {
    height: 88,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
  },
  bottomNavInactive: {
    alignItems: 'center',
    gap: 4,
  },
  bottomNavActive: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  bottomNavIcon: {
    fontSize: 18,
  },
  bottomNavLabel: {
    fontFamily: 'System',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
