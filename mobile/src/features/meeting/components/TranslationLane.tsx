/**
 * TranslationLane Component
 *
 * Displays Vietnamese translation with draft/final states.
 * Draft translation renders with lighter opacity and badge.
 * Final translation replaces in-place with no layout shift.
 * Features independent scrolling with auto-scroll and jump-to-latest pill.
 *
 * @see Story 4-1: Two-lane layout
 * @see Story 4-3: Auto-scroll + jump-to-latest
 * @see Stories 3.2, 3.3, 3.4 - Translation lane and degraded states
 */

import React, {useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {useTheme} from '../../../shared/hooks/useTheme';
import {AppIcon, SpeakerBadge} from '../../../shared/components/ui';
import {TranslationEntry} from '../state/meetingStore';

interface TranslationLaneProps {
  style?: StyleProp<ViewStyle>;
  entries: TranslationEntry[];
  isOffline: boolean;
  isDegraded: boolean;
  translationAvailable?: boolean;
  degradedMessage?: string | null;
  isActive: boolean;
  isRecording: boolean;
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
// Sub-components
// =============================================================================

function ProvisionalBadge(): React.JSX.Element {
  const {theme} = useTheme();
  return (
    <View style={[styles.provisionalBadge, {backgroundColor: theme.colors.secondary + '25'}]}>
      <Text style={[styles.provisionalBadgeText, {color: theme.colors.secondary}]}>
        DRAFT
      </Text>
    </View>
  );
}

function TranslationEntryItem({
  entry,
  isActive,
}: {
  entry: TranslationEntry;
  isActive: boolean;
}): React.JSX.Element {
  const {theme} = useTheme();

  // Provisional = not yet final
  const isProvisional = !entry.isFinal;

  return (
    <View
      style={[
        styles.entryContainer,
        isActive && styles.activeEntryContainer,
        isProvisional && styles.provisionalEntryContainer,
      ]}
      accessibilityLabel={`${isProvisional ? 'Provisional translation' : 'Translation'}: ${entry.translatedText}`}
      accessibilityRole="text">
      <View style={styles.entryHeader}>
        <View style={styles.entryHeaderLeft}>
          <SpeakerBadge speakerId={entry.speakerId} label={entry.speakerId} size="small" />
          <Text style={[styles.timestamp, {color: theme.colors.text.tertiary}]}> 
            {new Date(entry.timestamp).toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.entryHeaderRight}>
          {isProvisional && <ProvisionalBadge />}
          {!isProvisional && (
            <View style={styles.finalBadge}>
              <AppIcon name="check-circle" size={10} color={theme.colors.text.tertiary} />
              <Text style={[styles.finalBadgeText, {color: theme.colors.text.tertiary}]}> 
                FINAL
              </Text>
            </View>
          )}
          {entry.isProcessing && (
            <View style={styles.processingIndicator}>
              <View style={styles.processingDots}>
                <View style={[styles.dot, {backgroundColor: theme.colors.secondary}]} />
                <View style={[styles.dot, {backgroundColor: theme.colors.secondary}]} />
                <View style={[styles.dot, {backgroundColor: theme.colors.secondary}]} />
              </View>
              <Text style={[styles.processingText, {color: theme.colors.secondary}]}>Translating</Text>
            </View>
          )}
        </View>
      </View>

      {/* Provisional: lighter opacity, warm tint */}
      <Text
        style={[
          styles.entryText,
          {color: theme.colors.text.primary},
          isProvisional && styles.provisionalEntryText,
        ]}>
        {entry.translatedText}
      </Text>

      {entry.originalText ? (
        <Text
          style={[styles.originalText, {color: theme.colors.text.tertiary}]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {entry.originalText}
        </Text>
      ) : null}
    </View>
  );
}

function OfflineState(): React.JSX.Element {
  const {theme} = useTheme();

  return (
    <View
      style={styles.offlineContainer}
      accessibilityLabel="Translation paused"
      accessibilityRole="alert">
      <View
        style={[styles.offlineIconContainer, {backgroundColor: theme.colors.surface.secondary}]}>
        <AppIcon name="cloud-off" size={28} color={theme.colors.secondary} />
      </View>
      <Text style={[styles.offlineTitle, {color: theme.colors.text.secondary}]}>
        Translation Paused
      </Text>
      <Text style={[styles.offlineDescription, {color: theme.colors.text.tertiary}]}> 
        Translation is temporarily unavailable. On-device translation will resume automatically.
      </Text>
    </View>
  );
}

function DegradedState({translationAvailable = false, message}: {translationAvailable?: boolean; message?: string | null}): React.JSX.Element {
  const {theme} = useTheme();

  return (
    <View
      style={styles.degradedContainer}
      accessibilityLabel="Translation temporarily unavailable"
      accessibilityRole="alert">
      <AppIcon name="warning" size={20} color={theme.colors.warning} />
      <Text style={[styles.degradedTitle, {color: theme.colors.text.secondary}]}> 
        {translationAvailable ? 'Optional Processing Limited' : 'Translation Unavailable'}
      </Text>
      <Text style={[styles.degradedDescription, {color: theme.colors.text.tertiary}]}> 
        {message ?? (translationAvailable
          ? 'Some optional processing is temporarily limited. Translation continues normally.'
          : 'Translation is temporarily unavailable. Please wait a moment and try again.')}
      </Text>
    </View>
  );
}

function WaitingState({isRecording}: {isRecording: boolean}): React.JSX.Element {
  const {theme} = useTheme();

  return (
    <View style={styles.waitingContainer}>
      <View style={[styles.waitingIconWrap, {backgroundColor: theme.colors.surface.secondary}]}> 
        <View style={styles.waitingIconRow}>
        <View style={[styles.languageChip, {backgroundColor: theme.colors.surface.secondary}]}> 
          <Text style={[styles.languageChipText, {color: theme.colors.text.tertiary}]}>AUTO</Text>
        </View>
        <View style={styles.arrowContainer}>
          <AppIcon name="forward" size={14} color={theme.colors.text.tertiary} />
        </View>
        <View style={[styles.languageChip, {backgroundColor: theme.colors.secondary}]}> 
          <Text style={[styles.languageChipText, {color: theme.colors.text.primary}]}>VI</Text>
        </View>
        </View>
      </View>
      {isRecording ? (
        <>
          <Text style={[styles.waitingTitle, {color: theme.colors.text.secondary}]}> 
            Translation standing by
          </Text>
          <Text style={[styles.waitingDescription, {color: theme.colors.text.tertiary}]}> 
            Incoming English, Japanese, Korean, and Chinese speech will appear here in Vietnamese.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.waitingTitle, {color: theme.colors.text.secondary}]}> 
            Translation Ready
          </Text>
          <Text style={[styles.waitingDescription, {color: theme.colors.text.tertiary}]}>
            Start meeting to begin translation.
          </Text>
        </>
      )}
    </View>
  );
}

// =============================================================================
// Main TranslationLane Component
// =============================================================================

export function TranslationLane({
  style,
  entries,
  isOffline,
  isDegraded,
  translationAvailable = false,
  degradedMessage,
  isActive: _isActive,
  isRecording,
}: TranslationLaneProps): React.JSX.Element {
  const {theme} = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Show all entries including provisional (per story 3.2)
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    if (a.sttRevision !== b.sttRevision) {
      return a.sttRevision - b.sttRevision;
    }
    return a.utteranceId.localeCompare(b.utteranceId);
  });
  const hasEntries = sortedEntries.length > 0;
  const showTranslationDegradedState = isDegraded && !isOffline && !translationAvailable;

  // Auto-scroll: only if already at bottom
  const scrollToEnd = useCallback(() => {
    if (isAtBottom && scrollViewRef.current) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      });
    }
  }, [isAtBottom]);

  // Auto-scroll whenever content size changes (new entry, text update, draft→final)
  const handleContentSizeChange = useCallback((_w: number, _h: number) => {
    scrollToEnd();
  }, [scrollToEnd]);

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

  const showPill = !isAtBottom && hasEntries;

  return (
    <View
      style={[
        styles.container,
        style,
        {backgroundColor: theme.colors.surface.primary},
        isOffline && styles.offlineContainerStyle,
        isDegraded && styles.degradedContainerStyle,
      ]}
      accessibilityLiveRegion="polite">
      {/* Lane Header */}
      <View style={styles.header}>
        <View style={[styles.headerLeft, {borderLeftColor: theme.colors.lane.translation}]}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerLabel, {color: theme.colors.lane.translation}]}>BẢN DỊCH</Text>
          </View>
          <Text style={[styles.headerSubtitle, {color: theme.colors.text.tertiary}]}>
            Active
          </Text>
        </View>
        {hasEntries && (
          <View style={styles.headerRight}>
            <View style={styles.activeIndicator}>
              <View style={[styles.activeDot, {backgroundColor: theme.colors.lane.translation}]} />
              <Text style={[styles.activeText, {color: theme.colors.lane.translation}]}>Active</Text>
            </View>
          </View>
        )}
      </View>

      {/* Offline Banner */}
      {isOffline && (
        <View style={[styles.offlineBanner, {backgroundColor: theme.colors.warning + '15'}]}>
          <AppIcon name="warning" size={14} color={theme.colors.warning} />
          <Text style={[styles.offlineBannerText, {color: theme.colors.warning}]}> 
            Translation paused
          </Text>
        </View>
      )}

      {/* Degraded Banner */}
      {isDegraded && !isOffline && (
        <View style={[styles.degradedBanner, {backgroundColor: theme.colors.warning + '10'}]}>
          <AppIcon name="warning" size={14} color={theme.colors.warning} />
          <Text style={[styles.degradedBannerText, {color: theme.colors.warning}]}> 
            {degradedMessage ?? (translationAvailable
              ? 'Optional processing temporarily unavailable'
              : 'Translation temporarily unavailable')}
          </Text>
        </View>
      )}

      {/* Lane Content */}
      <View style={styles.content}>
        {isOffline ? (
          <OfflineState />
        ) : showTranslationDegradedState ? (
          <DegradedState translationAvailable={translationAvailable} message={degradedMessage} />
        ) : !hasEntries ? (
          <WaitingState isRecording={isRecording} />
        ) : (
          <View style={styles.scrollWrapper}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContentContainer}
              onScroll={handleScroll}
              onContentSizeChange={handleContentSizeChange}
              scrollEventThrottle={16}>
              {sortedEntries.map((entry) => (
                <TranslationEntryItem key={entry.id} entry={entry} isActive={false} />
              ))}
            </ScrollView>

            {/* Jump to Latest Pill */}
            {showPill && (
              <JumpToLatestPill opacity={pillOpacity} onPress={handleJumpToLatest} visible={showPill} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    // Subtle amber background tint from mockup
    backgroundColor: 'rgba(68, 238, 186, 0.03)',
  },
  offlineContainerStyle: {
    opacity: 0.7,
  },
  degradedContainerStyle: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    borderLeftWidth: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 9,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  activeText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  offlineBannerText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  degradedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  degradedBannerText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
  },
  scrollWrapper: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
  },
  entryContainer: {
    gap: 4,
  },
  activeEntryContainer: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(68, 238, 186, 0.3)',
    paddingLeft: 12,
    marginLeft: -2,
  },
  provisionalEntryContainer: {
    // Subtle warm tint for provisional (per UX guidance)
    backgroundColor: 'rgba(255, 200, 100, 0.04)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 6,
  },
  entryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  entryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  timestamp: {
    fontSize: 9,
    fontFamily: 'monospace',
  },
  provisionalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  provisionalBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  finalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  finalBadgeText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  processingDots: {
    flexDirection: 'row',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  processingText: {
    fontSize: 8,
    fontStyle: 'italic',
  },
  entryText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  provisionalEntryText: {
    // Lighter, warmer treatment for provisional per UX spec
    opacity: 0.85,
  },
  originalText: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 2,
    opacity: 0.82,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  offlineIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  offlineDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  degradedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 6,
  },
  degradedTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  degradedDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  waitingIconWrap: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  waitingIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  languageChipText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  arrowContainer: {
    opacity: 0.5,
  },
  waitingTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  waitingDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 220,
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

export default TranslationLane;
