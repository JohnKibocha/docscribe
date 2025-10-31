/**
 * @fileoverview Session service for managing encounter and chunk processing sessions.
 * 
 * Provides:
 * - Global session management
 * - Per-encounter session tracking
 * - Per-chunk session tracking
 * - Session statistics
 * - Session event logging
 * 
 * @module business/services/sessionService
 */

import { logger } from '../../shared/utils/logger';
import type {
  GlobalSession,
  EncounterSession,
  ChunkSession,
  SessionState,
  PipelineStage,
  SessionStats,
  SessionEvent
} from '../../shared/types/session';

/**
 * Session service for managing processing sessions.
 */
export class SessionService {
  private globalSession: GlobalSession;
  private events: SessionEvent[] = [];

  constructor() {
    this.globalSession = {
      activeEncounterId: null,
      encounterSessions: {},
      isProcessing: false,
      activeEncountersCount: 0,
      totalEncountersCount: 0,
      sessionStartedAt: new Date(),
      lastActivityAt: new Date()
    };
  }

  /**
   * Get global session.
   * 
   * @returns {GlobalSession} Global session
   */
  getGlobalSession(): GlobalSession {
    return this.globalSession;
  }

  /**
   * Start a new encounter session.
   * 
   * @param encounterId - Encounter ID
   * @param encounterFolderName - Encounter folder name
   * @returns {EncounterSession} New encounter session
   */
  startEncounterSession(encounterId: string, encounterFolderName: string): EncounterSession {
    const session: EncounterSession = {
      encounterId,
      encounterFolderName,
      currentStage: null,
      completedStages: [],
      state: 'idle' as SessionState,
      totalChunks: 0,
      completedChunks: 0,
      failedChunks: 0,
      chunkSessions: {},
      isProcessing: false,
      pendingChunks: [],
      pendingFinalNote: false,
      isStopping: false,
      context: {}
    };

    this.globalSession.encounterSessions[encounterId] = session;
    this.globalSession.totalEncountersCount++;
    this.globalSession.activeEncountersCount++;
    this.globalSession.lastActivityAt = new Date();

    this.logEvent({
      id: `${encounterId}_started`,
      type: 'encounter_started',
      encounterId,
      timestamp: new Date()
    });

    logger.info('SessionService', 'Encounter session started', { encounterId });

    return session;
  }

  /**
   * Get encounter session.
   * 
   * @param encounterId - Encounter ID
   * @returns {EncounterSession | undefined} Encounter session
   */
  getEncounterSession(encounterId: string): EncounterSession | undefined {
    return this.globalSession.encounterSessions[encounterId];
  }

  /**
   * Set active encounter.
   * 
   * @param encounterId - Encounter ID
   */
  setActiveEncounter(encounterId: string): void {
    this.globalSession.activeEncounterId = encounterId;
    this.globalSession.lastActivityAt = new Date();
  }

  /**
   * Start recording for encounter.
   * 
   * @param encounterId - Encounter ID
   */
  startRecording(encounterId: string): void {
    const session = this.getEncounterSession(encounterId);
    if (session) {
      session.state = 'recording' as SessionState;
      session.recordingStartedAt = new Date();
      this.globalSession.lastActivityAt = new Date();
    }
  }

  /**
   * Stop recording for encounter.
   * 
   * @param encounterId - Encounter ID
   */
  stopRecording(encounterId: string): void {
    const session = this.getEncounterSession(encounterId);
    if (session) {
      session.recordingEndedAt = new Date();
      this.globalSession.lastActivityAt = new Date();
    }
  }

  /**
   * Start processing stage for encounter.
   * 
   * @param encounterId - Encounter ID
   * @param stage - Pipeline stage
   */
  startStage(encounterId: string, stage: PipelineStage): void {
    const session = this.getEncounterSession(encounterId);
    if (session) {
      session.currentStage = stage;
      session.state = `processing_${stage}` as SessionState;
      session.isProcessing = true;
      this.globalSession.isProcessing = true;

      if (!session.processingStartedAt) {
        session.processingStartedAt = new Date();
      }

      this.logEvent({
        id: `${encounterId}_${stage}_started`,
        type: 'stage_started',
        encounterId,
        stage,
        timestamp: new Date()
      });

      this.globalSession.lastActivityAt = new Date();
    }
  }

  /**
   * Complete processing stage for encounter.
   * 
   * @param encounterId - Encounter ID
   * @param stage - Pipeline stage
   */
  completeStage(encounterId: string, stage: PipelineStage): void {
    const session = this.getEncounterSession(encounterId);
    if (session) {
      if (!session.completedStages.includes(stage)) {
        session.completedStages.push(stage);
      }

      this.logEvent({
        id: `${encounterId}_${stage}_completed`,
        type: 'stage_completed',
        encounterId,
        stage,
        timestamp: new Date()
      });

      this.globalSession.lastActivityAt = new Date();
    }
  }

  /**
   * Fail processing stage for encounter.
   * 
   * @param encounterId - Encounter ID
   * @param stage - Pipeline stage
   * @param error - Error message
   */
  failStage(encounterId: string, stage: PipelineStage, error: string): void {
    const session = this.getEncounterSession(encounterId);
    if (session) {
      session.state = 'error' as SessionState;
      session.error = {
        stage,
        message: error,
        timestamp: new Date(),
        recoverable: false
      };
      session.isProcessing = false;
      this.globalSession.isProcessing = false;

      this.logEvent({
        id: `${encounterId}_${stage}_failed`,
        type: 'stage_failed',
        encounterId,
        stage,
        timestamp: new Date(),
        data: { error }
      });

      this.globalSession.lastActivityAt = new Date();
    }
  }

  /**
   * Start chunk processing.
   * 
   * @param encounterId - Encounter ID
   * @param chunkId - Chunk ID
   * @param sequenceNumber - Chunk sequence number
   * @returns {ChunkSession} New chunk session
   */
  startChunkSession(
    encounterId: string,
    chunkId: string,
    sequenceNumber: number
  ): ChunkSession {
    const encounterSession = this.getEncounterSession(encounterId);
    if (!encounterSession) {
      throw new Error(`Encounter session not found: ${encounterId}`);
    }

    const chunkSession: ChunkSession = {
      chunkId,
      encounterId,
      sequenceNumber,
      currentStage: 'triage',
      completedStages: [],
      startedAt: new Date(),
      state: 'processing_triage' as SessionState,
      retryCount: 0
    };

    encounterSession.chunkSessions[chunkId] = chunkSession;
    encounterSession.totalChunks++;

    this.logEvent({
      id: `${chunkId}_started`,
      type: 'chunk_started',
      encounterId,
      chunkId,
      timestamp: new Date()
    });

    this.globalSession.lastActivityAt = new Date();

    return chunkSession;
  }

  /**
   * Complete chunk processing.
   * 
   * @param encounterId - Encounter ID
   * @param chunkId - Chunk ID
   */
  completeChunkSession(encounterId: string, chunkId: string): void {
    const encounterSession = this.getEncounterSession(encounterId);
    if (encounterSession) {
      const chunkSession = encounterSession.chunkSessions[chunkId];
      if (chunkSession) {
        chunkSession.state = 'completed' as SessionState;
        chunkSession.completedAt = new Date();
        encounterSession.completedChunks++;

        this.logEvent({
          id: `${chunkId}_completed`,
          type: 'chunk_completed',
          encounterId,
          chunkId,
          timestamp: new Date()
        });

        this.globalSession.lastActivityAt = new Date();
      }
    }
  }

  /**
   * Fail chunk processing.
   * 
   * @param encounterId - Encounter ID
   * @param chunkId - Chunk ID
   * @param stage - Pipeline stage where failure occurred
   * @param error - Error message
   */
  failChunkSession(
    encounterId: string,
    chunkId: string,
    stage: PipelineStage,
    error: string
  ): void {
    const encounterSession = this.getEncounterSession(encounterId);
    if (encounterSession) {
      const chunkSession = encounterSession.chunkSessions[chunkId];
      if (chunkSession) {
        chunkSession.state = 'error' as SessionState;
        chunkSession.error = {
          stage,
          message: error,
          timestamp: new Date()
        };
        encounterSession.failedChunks++;

        this.logEvent({
          id: `${chunkId}_failed`,
          type: 'chunk_failed',
          encounterId,
          chunkId,
          timestamp: new Date(),
          data: { error, stage }
        });

        this.globalSession.lastActivityAt = new Date();
      }
    }
  }

  /**
   * Complete encounter session.
   * 
   * @param encounterId - Encounter ID
   */
  completeEncounterSession(encounterId: string): void {
    const session = this.getEncounterSession(encounterId);
    if (session) {
      session.state = 'completed' as SessionState;
      session.processingCompletedAt = new Date();
      session.isProcessing = false;
      this.globalSession.isProcessing = false;
      this.globalSession.activeEncountersCount--;

      this.logEvent({
        id: `${encounterId}_completed`,
        type: 'encounter_completed',
        encounterId,
        timestamp: new Date()
      });

      this.globalSession.lastActivityAt = new Date();
    }
  }

  /**
   * Cancel encounter session.
   * 
   * @param encounterId - Encounter ID
   */
  cancelEncounterSession(encounterId: string): void {
    const session = this.getEncounterSession(encounterId);
    if (session) {
      session.state = 'cancelled' as SessionState;
      session.isStopping = true;
      session.isProcessing = false;
      this.globalSession.isProcessing = false;
      this.globalSession.activeEncountersCount--;
      this.globalSession.lastActivityAt = new Date();
    }
  }

  /**
   * Get session statistics.
   * 
   * @returns {SessionStats} Session statistics
   */
  getSessionStats(): SessionStats {
    const sessions = Object.values(this.globalSession.encounterSessions);

    const completed = sessions.filter(s => s.state === ('completed' as SessionState)).length;
    const failed = sessions.filter(s => s.state === ('error' as SessionState)).length;

    const totalChunks = sessions.reduce((sum, s) => sum + s.totalChunks, 0);

    let totalProcessingTime = 0;
    sessions.forEach(s => {
      if (s.processingStartedAt && s.processingCompletedAt) {
        totalProcessingTime += s.processingCompletedAt.getTime() - s.processingStartedAt.getTime();
      }
    });

    const averageProcessingTime = sessions.length > 0 ? totalProcessingTime / completed : 0;
    const averageChunkTime = totalChunks > 0 ? totalProcessingTime / totalChunks : 0;
    const successRate = sessions.length > 0 ? (completed / sessions.length) * 100 : 0;

    return {
      totalEncounters: sessions.length,
      completedEncounters: completed,
      failedEncounters: failed,
      totalChunks,
      totalProcessingTime,
      averageProcessingTime,
      averageChunkTime,
      successRate
    };
  }

  /**
   * Log a session event.
   * 
   * @param event - Session event
   */
  private logEvent(event: SessionEvent): void {
    this.events.push(event);
    logger.info('SessionService', `Event: ${event.type}`, {
      encounterId: event.encounterId,
      chunkId: event.chunkId,
      stage: event.stage
    });
  }

  /**
   * Get session events.
   * 
   * @param encounterId - Encounter ID (optional)
   * @returns {SessionEvent[]} Session events
   */
  getEvents(encounterId?: string): SessionEvent[] {
    if (encounterId) {
      return this.events.filter(e => e.encounterId === encounterId);
    }
    return this.events;
  }

  /**
   * Clear session events.
   */
  clearEvents(): void {
    this.events = [];
  }
}

/**
 * Singleton instance of session service.
 */
export const sessionService = new SessionService();

