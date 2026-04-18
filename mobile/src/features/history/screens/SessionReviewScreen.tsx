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
  ScrollView,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {getPersistenceService, SessionData, UtteranceData} from '../../../services/persistence';
import {SpeakerBadge} from '../../../shared/components/ui';
import {
  exportRecap,
  exportMinutes,
} from '../utils/exportTranscript';

type SessionReviewNavigationProp = StackNavigationProp<RootStackParamList, 'SessionReview'>;
type SessionReviewRouteProp = RouteProp<RootStackParamList, 'SessionReview'>;

type TabId = 'transcript' | 'insights' | 'media' | 'export';

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

// ─────────────────────────────────────────────────────────────────────────────
// Recap & Minutes types
// ─────────────────────────────────────────────────────────────────────────────

interface RecapPoint {
  speakerLabel: string;
  utteranceCount: number;
  sampleText: string;
}

interface MinutesBlock {
  label: string;
  speakerId: string;
  speakerLabel: string;
  entries: Array<{
    timestamp: number;
    sourceText: string;
    translatedText: string | null;
  }>;
}

/**
 * Generates recap data from session transcript.
 * Groups utterances by speaker to produce summary points.
 */
function buildRecapData(
  session: SessionData,
  utterances: UtteranceData[],
): RecapPoint[] {
  const finalUtterances = utterances.filter((u) => u.isFinal);
  if (finalUtterances.length === 0) return [];

  const speakerLabels = session.speakerLabels ?? {};
  const speakerGroups: Record<string, UtteranceData[]> = {};
  for (const u of finalUtterances) {
    const speaker = u.speakerId ?? 'Unknown';
    if (!speakerGroups[speaker]) speakerGroups[speaker] = [];
    speakerGroups[speaker].push(u);
  }

  const points: RecapPoint[] = [];
  for (const [speakerId, speakerUtts] of Object.entries(speakerGroups)) {
    const label = speakerLabels[speakerId] ?? speakerId;
    const sample = speakerUtts.find(
      (u) => u.sourceText.trim().length > 20,
    ) ?? speakerUtts[0];

    points.push({
      speakerLabel: label,
      utteranceCount: speakerUtts.length,
      sampleText: sample?.sourceText.trim().slice(0, 120) ?? '',
    });
  }

  return points;
}

/**
 * Generates minutes data from session transcript.
 * Organizes utterances by time block and speaker.
 */
function buildMinutesData(
  session: SessionData,
  utterances: UtteranceData[],
): MinutesBlock[] {
  const finalUtterances = utterances
    .filter((u) => u.isFinal)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (finalUtterances.length === 0) return [];

  const speakerLabels = session.speakerLabels ?? {};

  // Group by time block
  const blocks: Record<string, UtteranceData[]> = {};
  for (const u of finalUtterances) {
    const elapsedMinutes = Math.floor((u.timestamp - session.startedAt) / 60000);
    let blockLabel: string;
    if (elapsedMinutes < 5) blockLabel = 'Opening';
    else if (elapsedMinutes < 15) blockLabel = 'Early';
    else if (elapsedMinutes < 30) blockLabel = 'Mid';
    else if (elapsedMinutes < 60) blockLabel = 'Late';
    else blockLabel = 'Extended';

    if (!blocks[blockLabel]) blocks[blockLabel] = [];
    blocks[blockLabel].push(u);
  }

  const minutesBlocks: MinutesBlock[] = [];
  for (const [blockLabel, blockUtts] of Object.entries(blocks)) {
    // Group by speaker within block
    const speakerGroups: Record<string, UtteranceData[]> = {};
    for (const u of blockUtts) {
      const speaker = u.speakerId ?? 'Unknown';
      if (!speakerGroups[speaker]) speakerGroups[speaker] = [];
      speakerGroups[speaker].push(u);
    }

    for (const [speakerId, speakerUtts] of Object.entries(speakerGroups)) {
      const label = speakerLabels[speakerId] ?? speakerId;
      minutesBlocks.push({
        label: blockLabel,
        speakerId,
        speakerLabel: label,
        entries: speakerUtts.map((u) => ({
          timestamp: u.timestamp,
          sourceText: u.sourceText,
          translatedText: u.translatedText,
        })),
      });
    }
  }

  return minutesBlocks;
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
  const fallbackSession = route.params?.fallbackSession as SessionData | undefined;
  const fallbackUtterances = useMemo(
    () => (route.params?.fallbackUtterances as UtteranceData[] | undefined) ?? [],
    [route.params?.fallbackUtterances],
  );

  const [session, setSession] = useState<SessionData | null>(null);
  const [utterances, setUtterances] = useState<UtteranceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingRecap, setIsExportingRecap] = useState(false);
  const [isExportingMinutes, setIsExportingMinutes] = useState(false);
  const [isRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('transcript');

  // ── Data loading ──
  useEffect(() => {
    console.warn('[SessionReviewScreen] MOUNTED with sessionId=', sessionId, 'fallbackSession=', !!fallbackSession, 'fallbackUtterances=', fallbackUtterances.length);
    if (!sessionId) {
      console.warn('[SessionReviewScreen] Missing sessionId route param');
      setIsLoading(false);
      return;
    }

    const persistence = getPersistenceService();
    const loadSession = () => {
      console.warn('[SessionReviewScreen] loadSession: calling getSession and getUtterances for', sessionId);
      Promise.all([persistence.getSession(sessionId), persistence.getUtterances(sessionId)])
        .then(([storedSession, storedUtterances]) => {
          console.warn('[SessionReviewScreen] loadSession RESULT', {
            sessionId,
            foundSession: !!storedSession,
            sessionEndedAt: storedSession?.endedAt,
            utteranceCount: storedUtterances.length,
            firstUtteranceLang: storedUtterances[0]?.sourceLanguage,
          });
          setSession(storedSession ?? fallbackSession ?? null);
          setUtterances(storedUtterances.length > 0 ? storedUtterances : fallbackUtterances);
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
  }, [fallbackSession, fallbackUtterances, sessionId]);

  // ── Derived state ──
  const summary = useMemo<SessionSummary | null>(
    () => (session ? buildSummary(session, utterances) : null),
    [session, utterances],
  );

  const timeline = useMemo<TimelineEntry[]>(() => buildTimeline(utterances), [utterances]);

  const recapData = useMemo<RecapPoint[]>(
    () => (session ? buildRecapData(session, utterances) : []),
    [session, utterances],
  );

  const minutesData = useMemo<MinutesBlock[]>(
    () => (session ? buildMinutesData(session, utterances) : []),
    [session, utterances],
  );

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

  // ── Export Recap handler ──
  const handleExportRecap = async () => {
    if (!session || utterances.length === 0) return;
    setIsExportingRecap(true);
    try {
      await exportRecap(session, utterances);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Export Failed', `Could not export recap: ${message}`);
    } finally {
      setIsExportingRecap(false);
    }
  };

  // ── Export Minutes handler ──
  const handleExportMinutes = async () => {
    if (!session || utterances.length === 0) return;
    setIsExportingMinutes(true);
    try {
      await exportMinutes(session, utterances);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Export Failed', `Could not export minutes: ${message}`);
    } finally {
      setIsExportingMinutes(false);
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
  type NavItem = {id: TabId; label: string; icon: string};
  const bottomNavItems: NavItem[] = [
    {id: 'transcript', label: 'Transcript', icon: '📄'},
    {id: 'insights', label: 'Insights', icon: '💡'},
    {id: 'media', label: 'Media', icon: '🎧'},
    {id: 'export', label: 'Export', icon: '📤'},
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
        <TouchableOpacity activeOpacity={0.7} style={styles.headerIconBtn} onPress={handleExportTranscript}>
          <Text style={[styles.headerIcon, {color: theme.colors.text.secondary}]}>↗</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.headerIconBtn} onPress={() => navigation.navigate('Settings')}>
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
          Utterances
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
            Languages
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
  // Recap Section
  // ───────────────────────────────────────────────────────────────────────────
  const RecapSection = () => {
    if (recapData.length === 0) return null;

    return (
      <View style={styles.recapSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text.primary}]}>
            Recap
          </Text>
          <Text style={[styles.sectionSubtitle, {color: theme.colors.text.tertiary}]}>
            Stored locally
          </Text>
        </View>
        {recapData.map((point, index) => (
          <View
            key={point.speakerLabel + index}
            style={[styles.recapCard, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.recapCardHeader}>
              <SpeakerBadge
                speakerId={point.speakerLabel}
                label={point.speakerLabel}
                size="small"
                showBorder
              />
              <Text style={[styles.recapUtteranceCount, {color: theme.colors.text.tertiary}]}>
                {point.utteranceCount} time{point.utteranceCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text
              style={[styles.recapSampleText, {color: theme.colors.text.secondary}]}
              numberOfLines={2}>
              "{point.sampleText}"
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Minutes Section
  // ───────────────────────────────────────────────────────────────────────────
  const MinutesSection = () => {
    if (minutesData.length === 0) return null;

    // Group minutesData by block label for rendering
    const blockLabels = [...new Set(minutesData.map((b) => b.label))];

    return (
      <View style={styles.minutesSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, {color: theme.colors.text.primary}]}>
            Meeting Minutes
          </Text>
          <Text style={[styles.sectionSubtitle, {color: theme.colors.text.tertiary}]}>
            Stored locally
          </Text>
        </View>
        {blockLabels.map((blockLabel) => {
          const blockItems = minutesData.filter((b) => b.label === blockLabel);
          return (
            <View key={blockLabel} style={styles.minutesBlock}>
              <Text style={[styles.minutesBlockLabel, {color: theme.colors.text.tertiary}]}>
                {blockLabel}
              </Text>
              {blockItems.map((block, index) => (
                <View
                  key={block.speakerId + index}
                  style={[styles.minutesCard, {backgroundColor: theme.colors.surface.primary}]}>
                  <View style={styles.minutesCardHeader}>
                    <SpeakerBadge
                      speakerId={block.speakerId}
                      label={block.speakerLabel}
                      size="small"
                      showBorder
                    />
                  </View>
                  {block.entries.slice(0, 3).map((entry, entryIndex) => (
                    <View key={entryIndex} style={styles.minutesEntry}>
                      <Text style={[styles.minutesTimestamp, {color: theme.colors.text.tertiary}]}>
                        {formatTimestamp(entry.timestamp)}
                      </Text>
                      <Text
                        style={[styles.minutesText, {color: theme.colors.text.secondary}]}
                        numberOfLines={1}>
                        {entry.sourceText}
                      </Text>
                    </View>
                  ))}
                  {block.entries.length > 3 && (
                    <Text style={[styles.minutesMore, {color: theme.colors.text.tertiary}]}>
                      +{block.entries.length - 3} more
                    </Text>
                  )}
                </View>
              ))}
            </View>
          );
        })}
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
  // Tab content renderers
  // ───────────────────────────────────────────────────────────────────────────

  function renderTranscriptTab() {
    return (
      <FlatList
        data={timeline}
        renderItem={renderTimelineEntry}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}> 
              Transcript
            </Text>
          </View>
        }
        ListFooterComponent={<View style={styles.tabContentSpacer} />}
      />
    );
  }

  function renderInsightsTab() {
    return (
      <ScrollView
        contentContainerStyle={styles.insightsScrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.bentoGrid}>
          <SummaryDurationCard />
          <SummaryUtterancesCard />
          <SummaryLanguageCard />
        </View>
        <RecapSection />
        <MinutesSection />
        <View style={styles.tabContentSpacer} />
      </ScrollView>
    );
  }

  function renderMediaTab() {
    return (
      <ScrollView
        contentContainerStyle={styles.mediaScrollContent}
        showsVerticalScrollIndicator={false}>
      {/* ── Session Info Header ── */}
      <View style={styles.mediaHeader}>
          <Text style={[styles.mediaTitle, {color: theme.colors.text.primary}]}>
            Session Info
          </Text>
        <Text style={[styles.mediaSubtitle, {color: theme.colors.text.tertiary}]}>
          Speaker, language, and session data from this meeting
        </Text>
      </View>

      {/* ── Speaker Breakdown ── */}
      {recapData.length > 0 && (
        <View style={styles.mediaSection}>
          <Text style={[styles.mediaSectionLabel, {color: theme.colors.text.tertiary}]}>
            SPEAKERS
          </Text>
          {recapData.map((point, index) => (
            <View
              key={point.speakerLabel + index}
              style={[styles.mediaCard, {backgroundColor: theme.colors.surface.primary}]}>
              <View style={styles.mediaCardRow}>
                <SpeakerBadge
                  speakerId={point.speakerLabel}
                  label={point.speakerLabel}
                  size="small"
                  showBorder
                />
                <Text style={[styles.mediaCardValue, {color: theme.colors.text.secondary}]}>
                  {point.utteranceCount} utterances
                </Text>
              </View>
              <Text
                style={[styles.mediaCardSample, {color: theme.colors.text.tertiary}]}
                numberOfLines={1}>
                "{point.sampleText}"
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Language Breakdown ── */}
      {summary && (
        <View style={styles.mediaSection}>
          <Text style={[styles.mediaSectionLabel, {color: theme.colors.text.tertiary}]}>
            LANGUAGE DISTRIBUTION
          </Text>
          <View style={[styles.mediaCard, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.languageDistributionRow}>
              <View style={styles.languageDistributionItem}>
                <View style={[styles.langDot, {backgroundColor: '#c6bfff'}]} />
                <Text style={[styles.langDistributionLabel, {color: theme.colors.text.primary}]}>English</Text>
                <Text style={[styles.langDistributionCount, {color: theme.colors.text.secondary}]}>
                  {summary.languageBreakdown.EN}
                </Text>
              </View>
              <View style={styles.languageDistributionItem}>
                <View style={[styles.langDot, {backgroundColor: '#44eeba'}]} />
                <Text style={[styles.langDistributionLabel, {color: theme.colors.text.primary}]}>Japanese</Text>
                <Text style={[styles.langDistributionCount, {color: theme.colors.text.secondary}]}>
                  {summary.languageBreakdown.JA}
                </Text>
              </View>
              <View style={styles.languageDistributionItem}>
                <View style={[styles.langDot, {backgroundColor: '#adc6ff'}]} />
                <Text style={[styles.langDistributionLabel, {color: theme.colors.text.primary}]}>Korean</Text>
                <Text style={[styles.langDistributionCount, {color: theme.colors.text.secondary}]}>
                  {summary.languageBreakdown.KO}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── Session Metadata ── */}
      <View style={styles.mediaSection}>
        <Text style={[styles.mediaSectionLabel, {color: theme.colors.text.tertiary}]}>
          SESSION METADATA
        </Text>
        <View style={[styles.mediaCard, {backgroundColor: theme.colors.surface.primary}]}>
          <View style={styles.metadataRow}>
            <Text style={[styles.metadataLabel, {color: theme.colors.text.tertiary}]}>Date</Text>
            <Text style={[styles.metadataValue, {color: theme.colors.text.primary}]}>
              {summary?.dateLabel ?? '—'}
            </Text>
          </View>
          <View style={[styles.metadataDivider, {backgroundColor: theme.colors.border.subtle}]} />
          <View style={styles.metadataRow}>
            <Text style={[styles.metadataLabel, {color: theme.colors.text.tertiary}]}>Duration</Text>
            <Text style={[styles.metadataValue, {color: theme.colors.text.primary}]}>
              {summary?.durationLabel ?? '—'}
            </Text>
          </View>
          <View style={[styles.metadataDivider, {backgroundColor: theme.colors.border.subtle}]} />
          <View style={styles.metadataRow}>
            <Text style={[styles.metadataLabel, {color: theme.colors.text.tertiary}]}>Total Utterances</Text>
            <Text style={[styles.metadataValue, {color: theme.colors.text.primary}]}>
              {summary?.totalUtterances ?? 0}
            </Text>
          </View>
          <View style={[styles.metadataDivider, {backgroundColor: theme.colors.border.subtle}]} />
          <View style={styles.metadataRow}>
            <Text style={[styles.metadataLabel, {color: theme.colors.text.tertiary}]}>Speakers Detected</Text>
            <Text style={[styles.metadataValue, {color: theme.colors.text.primary}]}>
              {recapData.length}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Privacy Notice ── */}
      <View style={styles.mediaSection}>
        <View style={[styles.privacyCard, {backgroundColor: theme.colors.surface.primary}]}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <View style={styles.privacyContent}>
            <Text style={[styles.privacyTitle, {color: theme.colors.text.primary}]}>
              No Raw Audio Stored
            </Text>
              <Text style={[styles.privacyText, {color: theme.colors.text.secondary}]}> 
                Raw audio from your meetings is never stored after processing. 
                Only transcribed text and session metadata are retained locally for your review. 
                This protects your privacy while still giving you a complete meeting record.
              </Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContentSpacer} />
    </ScrollView>
    );
  }

  function renderExportTab() {
    return (
      <ScrollView
        contentContainerStyle={styles.exportScrollContent}
        showsVerticalScrollIndicator={false}>
      {/* ── Export Header ── */}
      <View style={styles.exportHeader}>
        <Text style={[styles.exportHeaderTitle, {color: theme.colors.text.primary}]}>
          Export
        </Text>
        <Text style={[styles.exportHeaderSubtitle, {color: theme.colors.text.tertiary}]}>
          Choose a format to export your meeting content
        </Text>
      </View>

      {/* ── Export Transcript ── */}
      <View style={styles.exportOptionSection}>
        <TouchableOpacity
          style={[
            styles.exportOptionCard,
            {backgroundColor: theme.colors.surface.primary},
          ]}
          onPress={handleExportTranscript}
          disabled={isExporting}
          activeOpacity={0.7}>
          <View style={styles.exportOptionHeader}>
            <Text style={styles.exportOptionIcon}>📋</Text>
            <View style={styles.exportOptionInfo}>
              <Text style={[styles.exportOptionTitle, {color: theme.colors.text.primary}]}>
                Full Transcript
              </Text>
              <Text style={[styles.exportOptionDesc, {color: theme.colors.text.tertiary}]}>
                Timestamped conversation with translations
              </Text>
            </View>
          </View>
          {isExporting ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={[styles.exportOptionAction, {color: theme.colors.primary}]}>Export</Text>
          )}
        </TouchableOpacity>

        {/* ── Export Recap ── */}
        <TouchableOpacity
          style={[
            styles.exportOptionCard,
            {backgroundColor: theme.colors.surface.primary},
          ]}
          onPress={handleExportRecap}
          disabled={isExportingRecap || recapData.length === 0}
          activeOpacity={0.7}>
          <View style={styles.exportOptionHeader}>
            <Text style={styles.exportOptionIcon}>📝</Text>
            <View style={styles.exportOptionInfo}>
              <Text style={[styles.exportOptionTitle, {color: theme.colors.text.primary}]}>
                Meeting Recap
              </Text>
              <Text style={[styles.exportOptionDesc, {color: theme.colors.text.tertiary}]}>
                Speaker summary with key points
              </Text>
            </View>
          </View>
          {isExportingRecap ? (
            <ActivityIndicator size="small" color={theme.colors.secondary} />
          ) : (
            <Text style={[styles.exportOptionAction, {color: theme.colors.secondary}]}>Export</Text>
          )}
        </TouchableOpacity>

        {/* ── Export Minutes ── */}
        <TouchableOpacity
          style={[
            styles.exportOptionCard,
            {backgroundColor: theme.colors.surface.primary},
          ]}
          onPress={handleExportMinutes}
          disabled={isExportingMinutes || minutesData.length === 0}
          activeOpacity={0.7}>
          <View style={styles.exportOptionHeader}>
            <Text style={styles.exportOptionIcon}>📑</Text>
            <View style={styles.exportOptionInfo}>
              <Text style={[styles.exportOptionTitle, {color: theme.colors.text.primary}]}>
                Meeting Minutes
              </Text>
              <Text style={[styles.exportOptionDesc, {color: theme.colors.text.tertiary}]}>
                Organized by time blocks and speakers
              </Text>
            </View>
          </View>
          {isExportingMinutes ? (
            <ActivityIndicator size="small" color={theme.colors.tertiary} />
          ) : (
            <Text style={[styles.exportOptionAction, {color: theme.colors.tertiary}]}>Export</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Recalculate Speakers ── */}
      <View style={styles.exportOptionSection}>
        <TouchableOpacity
          style={[
            styles.exportOptionCard,
            {backgroundColor: theme.colors.surface.primary},
          ]}
          onPress={handleRecalculateSpeakers}
          disabled={isRecalculating}
          activeOpacity={0.7}>
          <View style={styles.exportOptionHeader}>
            <Text style={styles.exportOptionIcon}>🔄</Text>
            <View style={styles.exportOptionInfo}>
              <Text style={[styles.exportOptionTitle, {color: theme.colors.text.primary}]}>
                Recalculate Speakers
              </Text>
              <Text style={[styles.exportOptionDesc, {color: theme.colors.text.tertiary}]}>
                Re-run speaker detection on stored transcript
              </Text>
            </View>
          </View>
          {isRecalculating ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={[styles.exportOptionAction, {color: theme.colors.primary}]}>Run</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabContentSpacer} />
    </ScrollView>
    );
  }

  // ── Active tab content ──
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'transcript':
        return renderTranscriptTab();
      case 'insights':
        return renderInsightsTab();
      case 'media':
        return renderMediaTab();
      case 'export':
        return renderExportTab();
      default:
        return null;
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Main render
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
      <Header />

      <View style={styles.tabContent}>
        {renderActiveTabContent()}
      </View>

      {/* ── Bottom Navigation Bar ── */}
      <View style={[styles.bottomNav, {backgroundColor: theme.colors.surface.primary}]}>
        {bottomNavItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.bottomNavItem}
              onPress={() => setActiveTab(item.id)}
              activeOpacity={0.7}>
              {isActive ? (
                <View style={[styles.bottomNavActive, {backgroundColor: theme.colors.surface.secondary}]}>
                  <Text style={styles.bottomNavIcon}>{item.icon}</Text>
                  <Text style={[styles.bottomNavLabel, {color: theme.colors.primary}]}>
                    {item.label}
                  </Text>
                </View>
              ) : (
                <View style={styles.bottomNavInactive}>
                  <Text style={styles.bottomNavIcon}>{item.icon}</Text>
                  <Text style={[styles.bottomNavLabel, {color: theme.colors.text.tertiary}]}>
                    {item.label}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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

  // ── Section Header ──
  sectionHeader: {
    marginBottom: 16,
    gap: 4,
  },
  sectionTitle: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontFamily: 'System',
    fontSize: 11,
    fontStyle: 'italic',
  },

  // ── Recap Section ──
  recapSection: {
    marginBottom: 24,
  },
  recapCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  recapCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recapUtteranceCount: {
    fontFamily: 'monospace',
    fontSize: 10,
  },
  recapSampleText: {
    fontFamily: 'System',
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Minutes Section ──
  minutesSection: {
    marginBottom: 24,
  },
  minutesBlock: {
    marginBottom: 16,
  },
  minutesBlockLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  minutesCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  minutesCardHeader: {
    marginBottom: 8,
  },
  minutesEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  minutesTimestamp: {
    fontFamily: 'monospace',
    fontSize: 10,
    flexShrink: 0,
    marginTop: 2,
  },
  minutesText: {
    fontFamily: 'System',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  minutesMore: {
    fontFamily: 'System',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4,
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

  // ── Tab Content ──
  tabContent: {
    flex: 1,
  },
  tabContentSpacer: {
    height: 24,
  },

  // ── Insights Tab ──
  insightsScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // ── Media Tab ──
  mediaScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  mediaHeader: {
    marginBottom: 24,
    gap: 4,
  },
  mediaTitle: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '700',
  },
  mediaSubtitle: {
    fontFamily: 'System',
    fontSize: 13,
  },
  mediaSection: {
    marginBottom: 20,
  },
  mediaSectionLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  mediaCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  mediaCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mediaCardValue: {
    fontFamily: 'System',
    fontSize: 13,
  },
  mediaCardSample: {
    fontFamily: 'System',
    fontSize: 12,
    fontStyle: 'italic',
  },
  languageDistributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  languageDistributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  langDistributionLabel: {
    fontFamily: 'System',
    fontSize: 13,
  },
  langDistributionCount: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metadataLabel: {
    fontFamily: 'System',
    fontSize: 13,
  },
  metadataValue: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
  },
  metadataDivider: {
    height: 1,
    opacity: 0.3,
  },
  privacyCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  privacyIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  privacyContent: {
    flex: 1,
    gap: 6,
  },
  privacyTitle: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '700',
  },
  privacyText: {
    fontFamily: 'System',
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Export Tab ──
  exportScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  exportHeader: {
    marginBottom: 24,
    gap: 4,
  },
  exportHeaderTitle: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '700',
  },
  exportHeaderSubtitle: {
    fontFamily: 'System',
    fontSize: 13,
  },
  exportOptionSection: {
    marginBottom: 12,
  },
  exportOptionCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exportOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  exportOptionIcon: {
    fontSize: 22,
  },
  exportOptionInfo: {
    flex: 1,
  },
  exportOptionTitle: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  exportOptionDesc: {
    fontFamily: 'System',
    fontSize: 11,
  },
  exportOptionAction: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ── Bottom Nav ──
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
