/**
 * TranscriptLane Component
 *
 * Displays transcript entries (final and partial) with language badges.
 * Features independent scrolling with auto-scroll and jump-to-latest pill.
 *
 * @see Story 4-1: Two-lane layout
 * @see Story 4-3: Auto-scroll + jump-to-latest
 */

import React, {useMemo, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {useTheme} from '../../../shared/hooks/useTheme';
import {AppIcon, SpeakerBadge} from '../../../shared/components/ui';
import {TranscriptEntry} from '../state/meetingStore';

interface TranscriptLaneProps {
  entries: TranscriptEntry[];
  partialTranscript: string;
  currentUtteranceId: string | null;
  isRecording: boolean;
  isOffline?: boolean;
  suppressPlaceholder?: boolean;
}

// =============================================================================
// JumpToLatestPill Component
// =============================================================================

function JumpToLatestPill({
  opacity,
  onPress,
  visible,
}: {
  opacity: Animated.Value;
  onPress: () => void;
  visible: boolean;
}): React.JSX.Element {
  const {theme} = useTheme();

  return (
    <Animated.View
      style={[
        styles.jumpPillContainer,
        {opacity},
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}>
      <TouchableOpacity
        style={styles.jumpPillTouchable}
        onPress={onPress}
        activeOpacity={0.8}>
        <AppIcon name="chevron-down" size={14} color={theme.colors.jumpPill.text} />
        <Text style={[styles.jumpPillText, {color: theme.colors.jumpPill.text}]}>
          Latest
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// LanguageBadge
// =============================================================================

function LanguageBadge({language}: {language: string | null}) {
  const {theme} = useTheme();
  if (!language) return null;
  return (
    <View style={[styles.languageBadge, {backgroundColor: theme.colors.primary}]}>
      <Text style={[styles.languageText, {color: theme.colors.text.primary}]}>{language.toUpperCase()}</Text>
    </View>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// =============================================================================
// TranscriptEntryItem
// =============================================================================

function TranscriptEntryItem({entry}: {entry: TranscriptEntry}): React.JSX.Element {
  const {theme} = useTheme();
  const isFinal = entry.isFinal;
  const visibleText = entry.sourceText || entry.partialText;

  return (
    <View style={[styles.entryContainer, !isFinal && styles.activeEntryContainer]}>
      <View style={styles.entryHeader}>
        <LanguageBadge language={entry.sourceLanguage} />
        <SpeakerBadge speakerId={entry.speakerId} label={entry.speakerId} size="small" />
        <Text style={[styles.timestamp, {color: theme.colors.text.tertiary}]}> 
          {formatTimestamp(entry.timestamp)}
        </Text>
        {!isFinal && (
          <View style={styles.processingIndicator}>
            <Text style={[styles.processingText, {color: theme.colors.primary}]}>Live</Text>
          </View>
        )}
      </View>
      <View style={styles.entryContent}>
        <Text
          style={[
            styles.entryText,
            {color: theme.colors.text.primary},
            !isFinal && {opacity: 0.92},
          ]}>
          {visibleText}
        </Text>
        {!isFinal && (
          <View style={[styles.partialIndicator, {backgroundColor: theme.colors.primary}]} />
        )}
      </View>
    </View>
  );
}

// =============================================================================
// EmptyState
// =============================================================================

function EmptyState({isRecording, isOffline}: {isRecording: boolean; isOffline: boolean}): React.JSX.Element {
  const {theme} = useTheme();

  if (isOffline) {
    return (
      <View style={styles.emptyContainer}>
        <AppIcon name="mic" size={24} color={theme.colors.text.tertiary} />
        <Text style={[styles.emptyTitle, {color: theme.colors.text.secondary}]}>Transcript Active</Text>
        <Text style={[styles.emptyDescription, {color: theme.colors.text.tertiary}]}>Offline mode — transcript continues on device.</Text>
      </View>
    );
  }

  if (!isRecording) {
    return (
      <View style={styles.emptyContainer}>
        <AppIcon name="mic" size={24} color={theme.colors.text.tertiary} />
        <Text style={[styles.emptyTitle, {color: theme.colors.text.secondary}]}>Ready to Capture</Text>
        <Text style={[styles.emptyDescription, {color: theme.colors.text.tertiary}]}>Start meeting to see the original speaker transcript.</Text>
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <AppIcon name="sync" size={24} color={theme.colors.text.tertiary} />
      <Text style={[styles.emptyTitle, {color: theme.colors.text.secondary}]}>Listening...</Text>
      <Text style={[styles.emptyDescription, {color: theme.colors.text.tertiary}]}>Speak in English, Japanese, or Korean</Text>
    </View>
  );
}

// =============================================================================
// Main TranscriptLane Component
// =============================================================================

export function TranscriptLane({
  entries,
  partialTranscript,
  currentUtteranceId,
  isRecording,
  isOffline = false,
  suppressPlaceholder = false,
}: TranscriptLaneProps): React.JSX.Element {
  const {theme} = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  const orderedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.revision - b.revision;
    });
  }, [entries]);

  const hasContent = orderedEntries.length > 0 || Boolean(partialTranscript);

  // Auto-scroll: only if already at bottom
  const scrollToBottom = useCallback(() => {
    if (isAtBottom && scrollViewRef.current) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      });
    }
  }, [isAtBottom]);

  // Handle new content: auto-scroll if at bottom
  React.useEffect(() => {
    scrollToBottom();
  }, [entries.length, partialTranscript, scrollToBottom]);

  // Handle scroll events to track position
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
    const scrollableHeight = contentSize.height - layoutMeasurement.height;
    const currentScrollY = contentOffset.y;

    // Consider "at bottom" if within 50px of the end
    const atBottom = scrollableHeight - currentScrollY < 50;
    const wasAtBottom = isAtBottom;

    if (atBottom !== wasAtBottom) {
      setIsAtBottom(atBottom);

      // Animate pill visibility
      Animated.timing(pillOpacity, {
        toValue: atBottom ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isAtBottom, pillOpacity]);

  // Jump to latest and re-enable auto-scroll
  const handleJumpToLatest = useCallback(() => {
    setIsAtBottom(true);
    Animated.timing(pillOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    });
  }, [pillOpacity]);

  const showPill = !isAtBottom && hasContent;

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.surface.primary}]}
      accessibilityLiveRegion="polite">
      {/* Lane Header */}
      <View style={styles.header}>
        <View style={[styles.headerLeft, {borderLeftColor: theme.colors.lane.transcript}]}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerLabel, {color: theme.colors.lane.transcript}]}>ORIGINAL</Text>
          </View>
          <Text style={[styles.headerSubtitle, {color: theme.colors.text.tertiary}]}>
            Real-time Feed
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.countText, {color: theme.colors.text.tertiary}]}>
            {orderedEntries.length} items
          </Text>
          {isRecording && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={[styles.liveText, {color: theme.colors.success}]}>Live</Text>
            </View>
          )}
        </View>
      </View>

      {/* Lane Content */}
      {!hasContent ? (
        suppressPlaceholder ? <View style={styles.placeholderSpacer} /> : <EmptyState isRecording={isRecording} isOffline={isOffline} />
      ) : (
        <View style={styles.scrollWrapper}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={(_w, h) => setContentHeight(h)}
            onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}>
            {orderedEntries.map((entry) => (
              <TranscriptEntryItem key={`${entry.id}-${entry.revision}`} entry={entry} />
            ))}

            {partialTranscript && !orderedEntries.some(e => e.id === currentUtteranceId && !e.isFinal) && (
              <View style={[styles.entryContainer, styles.activeEntryContainer]}>
                <View style={styles.entryHeader}>
                  <LanguageBadge language={null} />
                  <View style={styles.processingIndicator}>
                    <Text style={[styles.processingText, {color: theme.colors.primary}]}>Live</Text>
                  </View>
                </View>
                <View style={styles.entryContent}>
                  <Text style={[styles.entryText, {color: theme.colors.text.primary}]}>
                    {partialTranscript}
                  </Text>
                  <View style={[styles.partialIndicator, {backgroundColor: theme.colors.primary}]} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Jump to Latest Pill */}
          {showPill && (
            <JumpToLatestPill opacity={pillOpacity} onPress={handleJumpToLatest} visible={showPill} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    // Subtle blue background tint from mockup
    backgroundColor: 'rgba(173, 198, 255, 0.03)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 10,
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countText: {
    fontSize: 10,
    fontWeight: '500',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scrollWrapper: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  placeholderSpacer: {
    flex: 1,
  },
  entryContainer: {
    gap: 6,
  },
  activeEntryContainer: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(173, 198, 255, 0.3)',
    paddingLeft: 12,
    marginLeft: -2,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  languageText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  processingText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  entryContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  entryText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
  },
  partialIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    opacity: 0.6,
  },
  // Jump to Latest Pill
  jumpPillContainer: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
  },
  jumpPillTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  jumpPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TranscriptLane;
