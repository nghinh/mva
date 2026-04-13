/**
 * TranscriptLane Component
 *
 * Displays transcript entries (final and partial) with language badges.
 */

import React, {useMemo, useRef} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {useTheme} from '../../../shared/hooks/useTheme';
import {AppIcon} from '../../../shared/components/ui';
import {TranscriptEntry} from '../state/meetingStore';

interface TranscriptLaneProps {
  entries: TranscriptEntry[];
  partialTranscript: string;
  currentUtteranceId: string | null;
  isRecording: boolean;
  isOffline?: boolean;
}

function LanguageBadge({language}: {language: string | null}) {
  const {theme} = useTheme();
  if (!language) return null;
  return (
    <View style={[styles.languageBadge, {backgroundColor: theme.colors.primary}]}> 
      <Text style={[styles.languageText, {color: theme.colors.text.primary}]}>{language.toUpperCase()}</Text>
    </View>
  );
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function TranscriptEntryItem({entry}: {entry: TranscriptEntry}): React.JSX.Element {
  const {theme} = useTheme();
  const isFinal = entry.isFinal;
  const visibleText = entry.sourceText || entry.partialText;

  return (
    <View style={[styles.entryContainer, !isFinal && styles.activeEntryContainer]}> 
      <View style={styles.entryHeader}>
        <LanguageBadge language={entry.sourceLanguage} />
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

function EmptyState({isRecording, isOffline}: {isRecording: boolean; isOffline: boolean}): React.JSX.Element {
  const {theme} = useTheme();

  if (isOffline) {
    return (
      <View style={styles.emptyContainer}>
        <AppIcon name="mic" size={24} color={theme.colors.text.tertiary} />
        <Text style={[styles.emptyTitle, {color: theme.colors.text.secondary}]}>Transcript Active</Text>
        <Text style={[styles.emptyDescription, {color: theme.colors.text.tertiary}]}>Server offline. Transcript continues on device.</Text>
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

export function TranscriptLane({
  entries,
  partialTranscript,
  currentUtteranceId,
  isRecording,
  isOffline = false,
}: TranscriptLaneProps): React.JSX.Element {
  const {theme} = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const orderedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.revision - b.revision;
    });
  }, [entries]);

  const hasContent = orderedEntries.length > 0 || partialTranscript;

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    });
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.surface.primary}]}> 
      <View style={styles.header}>
        <View style={[styles.headerLeft, {borderLeftColor: theme.colors.lane.transcript}]}> 
          <Text style={[styles.headerLabel, {color: theme.colors.lane.transcript}]}>Original</Text>
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

      {!hasContent ? (
        <EmptyState isRecording={isRecording} isOffline={isOffline} />
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}>
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
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
  scrollContent: { flex: 1 },
  scrollContentContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
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
  entryContainer: { gap: 6 },
  activeEntryContainer: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(198, 191, 255, 0.3)',
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
});

export default TranscriptLane;
