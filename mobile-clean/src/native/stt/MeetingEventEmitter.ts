/**
 * Meeting Event Emitter
 *
 * Single controlled JS boundary for all native pipeline events.
 * All STT outputs, VAD state changes, and pipeline status events
 * flow through this emitter to the JS layer.
 *
 * Per architecture:
 * - Native layer emits STT outputs into a single controlled JS event boundary
 * - JS layer never streams raw audio over network; only text events cross to server
 * - Every message affecting transcript/rendering correlated by utterance_id and session_id
 *
 * @see docs/planning-artifacts/architecture.md#Communication-Patterns
 */

import type { SessionId } from '../../shared/types/common';
import type { MeetingPipelineEvent } from '../../shared/types/meeting';

type EventListener = (event: MeetingPipelineEvent) => void;

export interface EventEmitterSubscription {
  unsubscribe: () => void;
}

/**
 * MeetingEventEmitter
 *
 * Central event emitter for the meeting pipeline.
 * Implements a controlled boundary that prevents:
 * - Raw audio from crossing to JS
 * - Multiple competing event streams
 * - Uncontrolled state mutations
 */
export class MeetingEventEmitterImpl {
  private listeners: Set<EventListener> = new Set();
  private sessionId: SessionId | null = null;
  private isActive: boolean = false;
  private eventHistory: MeetingPipelineEvent[] = [];
  private maxHistorySize: number = 100;

  /**
   * Set the active session for event context
   */
  setSession(sessionId: SessionId | null): void {
    this.sessionId = sessionId;
    if (!sessionId) {
      this.eventHistory = [];
    }
  }

  /**
   * Get current session ID
   */
  getSession(): SessionId | null {
    return this.sessionId;
  }

  /**
   * Check if emitter is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Activate the emitter
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * Deactivate the emitter and clear listeners
   */
  deactivate(): void {
    this.isActive = false;
    this.sessionId = null;
    this.eventHistory = [];
  }

  /**
   * Emit a pipeline event to all listeners
   */
  emit(event: MeetingPipelineEvent): void {
    if (!this.isActive) {
      console.warn('[MeetingEventEmitter] Emitter not active, event dropped:', event.type);
      return;
    }

    // Validate event session matches current session
    if (this.sessionId && 'session_id' in event && event.session_id !== this.sessionId) {
      console.warn('[MeetingEventEmitter] Event session mismatch, event dropped:', event.type);
      return;
    }

    // Store in history for debugging/replay
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Emit to all listeners
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[MeetingEventEmitter] Listener error:', error);
      }
    });
  }

  /**
   * Subscribe to pipeline events
   *
   * @returns unsubscribe function
   */
  subscribe(listener: EventListener): EventEmitterSubscription {
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  /**
   * Get event history for current session
   */
  getHistory(): MeetingPipelineEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Get events filtered by type
   */
  getEventsByType<T extends MeetingPipelineEvent['type']>(
    type: T
  ): Extract<MeetingPipelineEvent, { type: T }>[] {
    return this.eventHistory.filter(
      (event): event is Extract<MeetingPipelineEvent, { type: T }> => event.type === type
    );
  }

  /**
   * Get the count of listeners
   */
  getListenerCount(): number {
    return this.listeners.size;
  }
}

/**
 * Singleton instance for app-wide event emission
 */
let emitterInstance: MeetingEventEmitterImpl | null = null;

export function getMeetingEventEmitter(): MeetingEventEmitterImpl {
  if (!emitterInstance) {
    emitterInstance = new MeetingEventEmitterImpl();
  }
  return emitterInstance;
}

export function releaseMeetingEventEmitter(): void {
  if (emitterInstance) {
    emitterInstance.deactivate();
    emitterInstance = null;
  }
}

// Convenience re-export of types
export type { MeetingPipelineEvent };
