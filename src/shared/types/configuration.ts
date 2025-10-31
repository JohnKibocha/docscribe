/**
 * @fileoverview Configuration type definitions.
 * 
 * Defines all configuration interfaces for the DocScribe application:
 * - AI pipeline settings
 * - Encounter type configurations
 * - Documentation standards
 * - Audio recording settings
 * - Storage preferences
 * 
 * @module shared/types/configuration
 */

/**
 * AI pipeline configuration.
 */
export interface AIPipelineConfig {
  /**
   * Temperature for AI generation (0.0-1.0).
   * Lower = more deterministic, Higher = more creative.
   */
  temperature: number;

  /**
   * Top-K sampling parameter.
   */
  topK: number;

  /**
   * Whether to yield during AI processing to prevent UI freezing.
   */
  yieldDuringProcessing: boolean;

  /**
   * Chunk size for processing (number of utterances per chunk).
   */
  chunkSize: number;

  /**
   * Maximum context length for AI model.
   */
  maxContextLength: number;

  /**
   * Retry configuration for AI operations.
   */
  retry: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };
}

/**
 * Encounter type configuration.
 */
export interface EncounterTypeConfig {
  /**
   * Unique identifier for encounter type.
   */
  id: string;

  /**
   * Display name.
   */
  name: string;

  /**
   * Description.
   */
  description: string;

  /**
   * Typical duration (minutes).
   */
  typicalDuration: number;

  /**
   * Suggested documentation standard.
   */
  defaultStandard: string;

  /**
   * Whether this type is active.
   */
  enabled: boolean;

  /**
   * Custom prompts for this encounter type (optional).
   */
  customPrompts?: {
    triage?: string;
    clean?: string;
    extract?: string;
    assemble?: string;
  };
}

/**
 * Documentation standard configuration.
 */
export interface DocumentationStandardConfig {
  /**
   * Unique identifier.
   */
  id: string;

  /**
   * Display name (e.g., "SOAP", "DAP", "APSO").
   */
  name: string;

  /**
   * Description.
   */
  description: string;

  /**
   * Section definitions.
   */
  sections: {
    id: string;
    name: string;
    required: boolean;
    order: number;
    placeholder?: string;
  }[];

  /**
   * Whether this standard is active.
   */
  enabled: boolean;
}

/**
 * Audio recording configuration.
 */
export interface AudioRecordingConfig {
  /**
   * Audio quality (bits per second).
   */
  audioBitsPerSecond: number;

  /**
   * MIME type for recording.
   */
  mimeType: string;

  /**
   * Maximum recording duration (milliseconds).
   */
  maxDuration: number;

  /**
   * Silence detection settings.
   */
  silenceDetection: {
    enabled: boolean;
    threshold: number;
    duration: number;
  };

  /**
   * Auto-stop after silence.
   */
  autoStop: {
    enabled: boolean;
    silenceDuration: number;
  };

  /**
   * Audio level monitoring.
   */
  levelMonitoring: {
    enabled: boolean;
    updateInterval: number;
  };
}

/**
 * Storage configuration.
 */
export interface StorageConfig {
  /**
   * Auto-save interval (milliseconds).
   */
  autoSaveInterval: number;

  /**
   * Maximum versions to keep per file.
   */
  maxVersions: number;

  /**
   * Auto-backup settings.
   */
  autoBackup: {
    enabled: boolean;
    intervalDays: number;
  };

  /**
   * Storage quota warning threshold (bytes).
   */
  quotaWarningThreshold: number;
}

/**
 * User preferences configuration.
 */
export interface UserPreferencesConfig {
  /**
   * Theme preference.
   */
  theme: 'light' | 'dark' | 'system';

  /**
   * Default encounter type.
   */
  defaultEncounterType: string;

  /**
   * Default documentation standard.
   */
  defaultDocumentationStandard: string;

  /**
   * Auto-start recording on app launch.
   */
  autoStartRecording: boolean;

  /**
   * Show tooltips.
   */
  showTooltips: boolean;

  /**
   * Confirmation prompts.
   */
  confirmations: {
    deleteEncounter: boolean;
    deleteVersion: boolean;
    restoreVersion: boolean;
  };
}

/**
 * Complete application configuration.
 */
export interface AppConfig {
  /**
   * AI pipeline settings.
   */
  aiPipeline: AIPipelineConfig;

  /**
   * Available encounter types.
   */
  encounterTypes: EncounterTypeConfig[];

  /**
   * Available documentation standards.
   */
  documentationStandards: DocumentationStandardConfig[];

  /**
   * Audio recording settings.
   */
  audioRecording: AudioRecordingConfig;

  /**
   * Storage settings.
   */
  storage: StorageConfig;

  /**
   * User preferences.
   */
  userPreferences: UserPreferencesConfig;

  /**
   * Configuration version for migrations.
   */
  configVersion: number;

  /**
   * Last updated timestamp.
   */
  lastUpdated: Date;
}

/**
 * Default AI pipeline configuration.
 */
export const DEFAULT_AI_PIPELINE_CONFIG: AIPipelineConfig = {
  temperature: 0.7,
  topK: 40,
  yieldDuringProcessing: true,
  chunkSize: 10,
  maxContextLength: 8000,
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2
  }
};

/**
 * Default encounter types.
 */
export const DEFAULT_ENCOUNTER_TYPES: EncounterTypeConfig[] = [
  {
    id: 'consultation',
    name: 'Consultation',
    description: 'General medical consultation',
    typicalDuration: 15,
    defaultStandard: 'soap',
    enabled: true
  },
  {
    id: 'follow-up',
    name: 'Follow-up',
    description: 'Follow-up visit',
    typicalDuration: 10,
    defaultStandard: 'soap',
    enabled: true
  },
  {
    id: 'procedure',
    name: 'Procedure',
    description: 'Medical procedure documentation',
    typicalDuration: 30,
    defaultStandard: 'apso',
    enabled: true
  },
  {
    id: 'emergency',
    name: 'Emergency',
    description: 'Emergency department visit',
    typicalDuration: 20,
    defaultStandard: 'soap',
    enabled: true
  }
];

/**
 * Default documentation standards.
 */
export const DEFAULT_DOCUMENTATION_STANDARDS: DocumentationStandardConfig[] = [
  {
    id: 'soap',
    name: 'SOAP',
    description: 'Subjective, Objective, Assessment, Plan',
    sections: [
      { id: 'subjective', name: 'Subjective', required: true, order: 1 },
      { id: 'objective', name: 'Objective', required: true, order: 2 },
      { id: 'assessment', name: 'Assessment', required: true, order: 3 },
      { id: 'plan', name: 'Plan', required: true, order: 4 }
    ],
    enabled: true
  },
  {
    id: 'dap',
    name: 'DAP',
    description: 'Data, Assessment, Plan',
    sections: [
      { id: 'data', name: 'Data', required: true, order: 1 },
      { id: 'assessment', name: 'Assessment', required: true, order: 2 },
      { id: 'plan', name: 'Plan', required: true, order: 3 }
    ],
    enabled: true
  },
  {
    id: 'apso',
    name: 'APSO',
    description: 'Assessment, Plan, Subjective, Objective',
    sections: [
      { id: 'assessment', name: 'Assessment', required: true, order: 1 },
      { id: 'plan', name: 'Plan', required: true, order: 2 },
      { id: 'subjective', name: 'Subjective', required: true, order: 3 },
      { id: 'objective', name: 'Objective', required: true, order: 4 }
    ],
    enabled: true
  }
];

/**
 * Default audio recording configuration.
 */
export const DEFAULT_AUDIO_CONFIG: AudioRecordingConfig = {
  audioBitsPerSecond: 128000,
  mimeType: 'audio/webm',
  maxDuration: 3600000, // 1 hour
  silenceDetection: {
    enabled: true,
    threshold: 0.01,
    duration: 3000
  },
  autoStop: {
    enabled: true,
    silenceDuration: 30000 // 30 seconds
  },
  levelMonitoring: {
    enabled: true,
    updateInterval: 100
  }
};

/**
 * Default storage configuration.
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  autoSaveInterval: 5000, // 5 seconds
  maxVersions: 4,
  autoBackup: {
    enabled: false,
    intervalDays: 7
  },
  quotaWarningThreshold: 100 * 1024 * 1024 // 100 MB
};

/**
 * Default user preferences.
 */
export const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
  theme: 'system',
  defaultEncounterType: 'consultation',
  defaultDocumentationStandard: 'soap',
  autoStartRecording: false,
  showTooltips: true,
  confirmations: {
    deleteEncounter: true,
    deleteVersion: true,
    restoreVersion: true
  }
};

/**
 * Default application configuration.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  aiPipeline: DEFAULT_AI_PIPELINE_CONFIG,
  encounterTypes: DEFAULT_ENCOUNTER_TYPES,
  documentationStandards: DEFAULT_DOCUMENTATION_STANDARDS,
  audioRecording: DEFAULT_AUDIO_CONFIG,
  storage: DEFAULT_STORAGE_CONFIG,
  userPreferences: DEFAULT_USER_PREFERENCES,
  configVersion: 1,
  lastUpdated: new Date()
};

