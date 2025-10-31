/**
 * @fileoverview Session tracking type definitions.
 * 
 * Defines interfaces for tracking AI processing sessions:
 * - Global session tracking
 * - Per-encounter session tracking
 * - Per-chunk session tracking
 * 
 * @module shared/types/session
 */

/**
 * Session state for tracking.
 */
export const SessionState = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PROCESSING_TRIAGE: 'processing_triage',
  PROCESSING_CLEAN: 'processing_clean',
  PROCESSING_DIARIZE: 'processing_diarize',
  PROCESSING_EXTRACT: 'processing_extract',
  PROCESSING_ASSEMBLE: 'processing_assemble',
  REGENERATING: 'regenerating',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
} as const;

export type SessionState = typeof SessionState[keyof typeof SessionState];

/**
 * Pipeline stage identifier.
 */
export type PipelineStage = 
  | 'triage'
  | 'clean'
  | 'diarize'
  | 'extract'
  | 'assemble';

/**
 * Chunk processing session.
 * Tracks processing of individual audio chunks.
 */
export interface ChunkSession {
  /**
   * Unique chunk identifier.
   */
  chunkId: string;

  /**
   * Encounter this chunk belongs to.
   */
  encounterId: string;

  /**
   * Chunk sequence number.
   */
  sequenceNumber: number;

  /**
   * Current processing stage.
   */
  currentStage: PipelineStage;

  /**
   * Completed stages.
   */
  completedStages: PipelineStage[];

  /**
   * Processing start time.
   */
  startedAt: Date;

  /**
   * Processing end time.
   */
  completedAt?: Date;

  /**
   * Current state.
   */
  state: SessionState;

  /**
   * Error information if failed.
   */
  error?: {
    stage: PipelineStage;
    message: string;
    timestamp: Date;
  };

  /**
   * Retry count for this chunk.
   */
  retryCount: number;
}

/**
 * Encounter processing session.
 * Tracks overall encounter processing.
 */
export interface EncounterSession {
  /**
   * Encounter identifier.
   */
  encounterId: string;

  /**
   * Encounter folder name.
   */
  encounterFolderName: string;

  /**
   * Current processing stage.
   */
  currentStage: PipelineStage | null;

  /**
   * Completed stages.
   */
  completedStages: PipelineStage[];

  /**
   * Current state.
   */
  state: SessionState;

  /**
   * Recording start time.
   */
  recordingStartedAt?: Date;

  /**
   * Recording end time.
   */
  recordingEndedAt?: Date;

  /**
   * Processing start time.
   */
  processingStartedAt?: Date;

  /**
   * Processing end time.
   */
  processingCompletedAt?: Date;

  /**
   * Total chunks processed.
   */
  totalChunks: number;

  /**
   * Completed chunks.
   */
  completedChunks: number;

  /**
   * Failed chunks.
   */
  failedChunks: number;

  /**
   * Chunk sessions.
   */
  chunkSessions: Record<string, ChunkSession>;

  /**
   * Global processing lock.
   */
  isProcessing: boolean;

  /**
   * Pending chunks queue (received during processing).
   */
  pendingChunks: string[];

  /**
   * Whether final note generation is pending.
   */
  pendingFinalNote: boolean;

  /**
   * Whether stopping was requested.
   */
  isStopping: boolean;

  /**
   * Error information if failed.
   */
  error?: {
    stage: PipelineStage | 'general';
    message: string;
    timestamp: Date;
    recoverable: boolean;
  };

  /**
   * Contextual information for AI processing.
   */
  context: {
    encounterType?: string;
    documentationStandard?: string;
    speakerContext?: string;
    encounterSummary?: string;
    keyMedicalTerms?: string[];
    clinicalContext?: string;
  };
}

/**
 * Global session state.
 * Tracks application-wide session information.
 */
export interface GlobalSession {
  /**
   * Current active encounter (if any).
   */
  activeEncounterId: string | null;

  /**
   * All encounter sessions.
   */
  encounterSessions: Record<string, EncounterSession>;

  /**
   * Global processing state.
   */
  isProcessing: boolean;

  /**
   * Active encounters count.
   */
  activeEncountersCount: number;

  /**
   * Total encounters in current session.
   */
  totalEncountersCount: number;

  /**
   * Session start time.
   */
  sessionStartedAt: Date;

  /**
   * Last activity timestamp.
   */
  lastActivityAt: Date;
}

/**
 * Session statistics.
 */
export interface SessionStats {
  /**
   * Total encounters.
   */
  totalEncounters: number;

  /**
   * Completed encounters.
   */
  completedEncounters: number;

  /**
   * Failed encounters.
   */
  failedEncounters: number;

  /**
   * Total chunks processed.
   */
  totalChunks: number;

  /**
   * Total processing time (ms).
   */
  totalProcessingTime: number;

  /**
   * Average processing time per encounter (ms).
   */
  averageProcessingTime: number;

  /**
   * Average processing time per chunk (ms).
   */
  averageChunkTime: number;

  /**
   * Success rate (percentage).
   */
  successRate: number;
}

/**
 * Session event for tracking and logging.
 */
export interface SessionEvent {
  /**
   * Event identifier.
   */
  id: string;

  /**
   * Event type.
   */
  type: 'encounter_started' | 'encounter_completed' | 'encounter_failed' 
    | 'chunk_started' | 'chunk_completed' | 'chunk_failed'
    | 'stage_started' | 'stage_completed' | 'stage_failed'
    | 'regeneration_started' | 'regeneration_completed' | 'regeneration_failed';

  /**
   * Encounter ID.
   */
  encounterId: string;

  /**
   * Chunk ID (if applicable).
   */
  chunkId?: string;

  /**
   * Stage (if applicable).
   */
  stage?: PipelineStage;

  /**
   * Event timestamp.
   */
  timestamp: Date;

  /**
   * Additional data.
   */
  data?: Record<string, any>;
}

