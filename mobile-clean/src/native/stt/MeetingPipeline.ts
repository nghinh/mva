/**
 * Meeting Pipeline
 *
 * Orchestrates all native components for the meeting capture pipeline:
 * - AudioCapture: Continuous 16kHz PCM capture
 * - ChunkProcessor: Buffers and prepares chunks for VAD
 * - VADProcessor: Detects speech vs silence
 * - STTProcessor: Produces partial/final transcripts
 * - LanguageDetector: Detects source language
 * - MeetingEventEmitter: Controlled JS boundary
 *
 * This is the main entry point for the meeting pipeline in the native boundary.
 */

import type { SessionId, UtteranceId } from '../../shared/types/common';
import type { MeetingPipelineEvent, STTPartialEvent, STTFinalEvent } from '../../shared/types/meeting';
import type { PCMChunk } from './AudioCapture';

import { AudioCaptureSimulator, getAudioCaptureInstance, releaseAudioCaptureInstance } from './AudioCapture';
import { ChunkProcessor, getChunkProcessorInstance, releaseChunkProcessorInstance } from './ChunkProcessor';
import { VADProcessor, getVADProcessorInstance, releaseVADProcessorInstance } from '../vad/VADProcessor';
import { STTProcessor, getSTTProcessorInstance, releaseSTTProcessorInstance } from './STTProcessor';
import { LanguageDetector, getLanguageDetectorInstance, releaseLanguageDetectorInstance } from './LanguageDetector';
import { getMeetingEventEmitter, releaseMeetingEventEmitter, MeetingEventEmitterImpl } from './MeetingEventEmitter';

export interface MeetingPipelineConfig {
  sampleRate: number;
  chunkDurationMs: number;
  vadThreshold: number;
  minSpeechDurationMs: number;
  enablePartialTranscripts: boolean;
}

const DEFAULT_CONFIG: MeetingPipelineConfig = {
  sampleRate: 16000,
  chunkDurationMs: 100,
  vadThreshold: 0.5,
  minSpeechDurationMs: 250,
  enablePartialTranscripts: true,
};

export type PipelineState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
export type PipelineError = { code: string; message: string };

/**
 * MeetingPipeline
 *
 * Main orchestrator for the meeting capture pipeline.
 * Coordinates all native components and ensures proper event flow.
 */
export class MeetingPipeline {
  private config: MeetingPipelineConfig;
  private state: PipelineState = 'idle';
  private sessionId: SessionId | null = null;
  private error: PipelineError | null = null;

  // Components
  private audioCapture: AudioCaptureSimulator;
  private chunkProcessor: ChunkProcessor;
  private vadProcessor: VADProcessor;
  private sttProcessor: STTProcessor;
  private languageDetector: LanguageDetector;
  private eventEmitter: MeetingEventEmitterImpl;

  // Subscriptions for cleanup
  private subscriptions: Array<() => void> = [];

  // Current utterance tracking
  private currentUtteranceId: UtteranceId | null = null;
  private pendingUtteranceId: UtteranceId | null = null;
  private utteranceCounter = 0;
  private pendingPartialEvents: Map<UtteranceId, STTPartialEvent> = new Map();

  constructor(config: Partial<MeetingPipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize components
    this.audioCapture = getAudioCaptureInstance();
    this.chunkProcessor = getChunkProcessorInstance();
    this.vadProcessor = getVADProcessorInstance();
    this.sttProcessor = getSTTProcessorInstance();
    this.languageDetector = getLanguageDetectorInstance();
    this.eventEmitter = getMeetingEventEmitter();

    // Wire up event listeners
    this.wireComponents();
  }

  /**
   * Wire up internal component event handlers
   */
  private wireComponents(): void {
    // Audio capture -> Chunk processor
    const chunkUnsub = this.audioCapture.subscribeToChunks((chunk: PCMChunk) => {
      this.handlePCMChunk(chunk);
    });
    this.subscriptions.push(chunkUnsub);

    const audioStatusUnsub = this.audioCapture.subscribeToStatus((event) => {
      this.eventEmitter.emit(event);
    });
    this.subscriptions.push(audioStatusUnsub);

    // VAD state changes -> Track utterance lifecycle
    const vadStateUnsub = this.vadProcessor.subscribeToStateChanges((event) => {
      this.handleVADStateChange(event);
    });
    this.subscriptions.push(vadStateUnsub);

    // STT partial -> Store and forward
    const partialUnsub = this.sttProcessor.subscribeToPartial((event) => {
      this.handleSTTPartial(event);
    });
    this.subscriptions.push(partialUnsub);

    // STT final -> Emit and detect language
    const finalUnsub = this.sttProcessor.subscribeToFinal((event) => {
      this.handleSTTFinal(event);
    });
    this.subscriptions.push(finalUnsub);

    const languageUnsub = this.languageDetector.subscribe((event) => {
      this.eventEmitter.emit(event);
    });
    this.subscriptions.push(languageUnsub);
  }

  /**
   * Handle incoming PCM chunk from audio capture
   */
  private handlePCMChunk(chunk: PCMChunk): void {
    if (this.state !== 'running') {
      return;
    }

    const activeUtteranceId = this.currentUtteranceId ?? this.pendingUtteranceId ?? this.createUtteranceId();
    if (!this.currentUtteranceId && !this.pendingUtteranceId) {
      this.pendingUtteranceId = activeUtteranceId;
    }

    // Add to chunk buffer
    const result = this.chunkProcessor.addChunk(chunk, activeUtteranceId);
    const buffer = this.chunkProcessor.getBuffer(activeUtteranceId);

    if (buffer && this.pendingUtteranceId === activeUtteranceId && this.chunkProcessor.isBufferExpired(buffer, chunk.timestampMs)) {
      this.chunkProcessor.removeBuffer(activeUtteranceId);
      this.pendingUtteranceId = null;
      return;
    }

    if (result?.isReady) {
      // Process through VAD
      const vadResult = this.vadProcessor.processBuffer(result.buffer);

      if (vadResult) {
        // Process through STT for partial transcript
        this.sttProcessor.processBuffer(result.buffer);
      }
    }
  }

  /**
   * Handle VAD state changes
   */
  private handleVADStateChange(event: { state: string; utterance_id: UtteranceId; timestamp_ms: number }): void {
    if (this.state !== 'running') return;

    switch (event.state) {
      case 'speech_start':
        // New utterance started
        this.currentUtteranceId = event.utterance_id;
        this.pendingUtteranceId = null;
        this.sttProcessor.startUtterance(event.utterance_id, event.timestamp_ms);
        break;

      case 'speech_end':
        // Finalize utterance
        const segment = this.vadProcessor.getSegment(event.utterance_id);
        if (segment) {
          this.sttProcessor.finalizeUtterance(segment);
        }
        this.chunkProcessor.removeBuffer(event.utterance_id);
        this.currentUtteranceId = null;
        this.pendingUtteranceId = null;
        break;

      case 'silence':
        // Reset tracking
        if (this.currentUtteranceId || this.pendingUtteranceId) {
          const utteranceId = this.currentUtteranceId ?? this.pendingUtteranceId;
          if (utteranceId) {
            this.sttProcessor.cancelUtterance(utteranceId);
            this.chunkProcessor.removeBuffer(utteranceId);
          }
        this.currentUtteranceId = null;
        this.pendingUtteranceId = null;
        }
        break;
    }
  }

  /**
   * Handle partial STT event
   */
  private handleSTTPartial(event: STTPartialEvent): void {
    if (this.state !== 'running') return;

    // Forward to event emitter
    this.eventEmitter.emit(event);

    // Detect language from partial text
    if (event.text.length > 5) {
      this.languageDetector.detectFromText(event.text, event.utterance_id);
    }
  }

  /**
   * Handle final STT event
   */
  private handleSTTFinal(event: STTFinalEvent): void {
    if (this.state !== 'running') return;

    // Emit final transcript
    this.eventEmitter.emit(event);

    // Detect and emit language through detector subscriber path
    this.languageDetector.detectFromText(event.text, event.utterance_id);

    // Clean up partial events for this utterance
    this.pendingPartialEvents.delete(event.utterance_id);
  }

  /**
   * Start the meeting pipeline for a session
   */
  async start(sessionId: SessionId): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'stopped') {
      throw new Error(`Cannot start pipeline in state: ${this.state}`);
    }

    this.sessionId = sessionId;
    this.state = 'starting';
    this.error = null;
    this.currentUtteranceId = null;
    this.pendingUtteranceId = null;
    this.utteranceCounter = 0;
    this.pendingPartialEvents.clear();

    try {
      // Initialize all components with session
      this.chunkProcessor.setSession(sessionId);
      this.vadProcessor.setSession(sessionId);
      this.sttProcessor.setSession(sessionId);
      this.languageDetector.setSession(sessionId);
      this.eventEmitter.setSession(sessionId);

      // Load STT model
      await this.sttProcessor.loadModel();

      // Activate event emitter
      this.eventEmitter.activate();

      // Start audio capture
      await this.audioCapture.start(sessionId);

      this.state = 'running';

      this.eventEmitter.emit({
        type: 'pipeline_status',
        session_id: sessionId,
        status: 'ready',
        timestamp_ms: Date.now(),
      });
    } catch (err) {
      this.state = 'error';
      this.error = {
        code: 'START_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error starting pipeline',
      };
      throw err;
    }
  }


  private createUtteranceId(): UtteranceId {
    this.utteranceCounter += 1;
    return `${this.sessionId ?? 'session'}-utt-${this.utteranceCounter}`;
  }

  /**
   * Stop the meeting pipeline
   */
  async stop(): Promise<void> {
    if (this.state !== 'running' && this.state !== 'starting') {
      console.warn('[MeetingPipeline] Cannot stop pipeline in state:', this.state);
      return;
    }

    this.state = 'stopping';

    // Finalize current utterance if any
    if (this.currentUtteranceId) {
      const segment = this.vadProcessor.getSegment(this.currentUtteranceId);
      if (segment) {
        this.sttProcessor.finalizeUtterance(segment);
      }
    }

    // Stop audio capture
    await this.audioCapture.stop('user_action');

    this.eventEmitter.emit({
      type: 'pipeline_status',
      session_id: this.sessionId!,
      status: 'idle',
      timestamp_ms: Date.now(),
      details: 'Pipeline stopped',
    });

    // Deactivate emitter
    this.eventEmitter.deactivate();

    // Clean up components
    this.chunkProcessor.clearSession();
    this.vadProcessor.reset();
    this.sttProcessor.setSession('');
    this.languageDetector.setSession('');

    this.state = 'stopped';
    this.sessionId = null;
    this.currentUtteranceId = null;
  }

  /**
   * Pause the pipeline (for app lifecycle interruptions)
   */
  async pause(): Promise<void> {
    if (this.state !== 'running') return;

    await this.audioCapture.pause();

    this.eventEmitter.emit({
      type: 'pipeline_status',
      session_id: this.sessionId!,
      status: 'idle',
      timestamp_ms: Date.now(),
      details: 'Pipeline paused due to app interruption',
    });
  }

  /**
   * Resume the pipeline after pause
   */
  async resume(): Promise<void> {
    if (this.state !== 'running') return;

    await this.audioCapture.resume();

    this.eventEmitter.emit({
      type: 'pipeline_status',
      session_id: this.sessionId!,
      status: 'ready',
      timestamp_ms: Date.now(),
    });
  }

  /**
   * Get current pipeline state
   */
  getState(): PipelineState {
    return this.state;
  }

  /**
   * Get current session ID
   */
  getSessionId(): SessionId | null {
    return this.sessionId;
  }

  /**
   * Get current error if any
   */
  getError(): PipelineError | null {
    return this.error;
  }

  /**
   * Subscribe to pipeline events from JS layer
   */
  subscribe(listener: (event: MeetingPipelineEvent) => void): () => void {
    const subscription = this.eventEmitter.subscribe(listener);
    return () => subscription.unsubscribe();
  }

  /**
   * Release all resources
   */
  release(): void {
    // Unsubscribe all
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions = [];

    // Release singletons
    releaseAudioCaptureInstance();
    releaseChunkProcessorInstance();
    releaseVADProcessorInstance();
    releaseSTTProcessorInstance();
    releaseLanguageDetectorInstance();
    releaseMeetingEventEmitter();

    this.state = 'idle';
    this.sessionId = null;
  }
}

/**
 * Singleton instance
 */
let pipelineInstance: MeetingPipeline | null = null;

export function getMeetingPipelineInstance(): MeetingPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new MeetingPipeline();
  }
  return pipelineInstance;
}

export function releaseMeetingPipelineInstance(): void {
  if (pipelineInstance) {
    pipelineInstance.release();
    pipelineInstance = null;
  }
}
