/**
 * @fileoverview Storage-related type definitions for file system operations.
 * 
 * Defines types for File System Access API integration, encounter storage,
 * and version control operations.
 * 
 * @module shared/types/storage
 */

/**
 * Result of File System Access API availability check.
 */
export interface FileSystemAvailability {
  /** Whether File System Access API is available */
  available: boolean;
  /** Reason if unavailable */
  reason?: string;
}

/**
 * Options for requesting directory access from user.
 */
export interface DirectoryPickerOptions {
  /** Suggested directory name */
  suggestedName?: string;
  /** Start in a specific directory */
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  /** Mode: read or readwrite */
  mode?: 'read' | 'readwrite';
}

/**
 * File write options for atomic operations.
 */
export interface FileWriteOptions {
  /** Whether to create backup before write */
  createBackup?: boolean;
  /** Whether to create parent directories if missing */
  createParents?: boolean;
  /** Whether operation should be atomic (rollback on failure) */
  atomic?: boolean;
}

/**
 * Result of a file operation.
 */
export interface FileOperationResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** File handle if operation created/opened a file */
  fileHandle?: FileSystemFileHandle;
  /** Directory handle if operation created/opened a directory */
  directoryHandle?: FileSystemDirectoryHandle;
}

/**
 * Metadata for an encounter folder.
 */
export interface EncounterFolderMetadata {
  /** Unique encounter ID */
  id: string;
  /** Folder name (usually timestamp-based) */
  folderName: string;
  /** When encounter was created */
  created: Date;
  /** When encounter was last modified */
  lastModified: Date;
  /** Encounter type */
  encounterType: string;
  /** Documentation standard used */
  documentationStandard: string;
  /** Speaker context */
  speakerContext: string;
  /** Current status */
  status: 'recording' | 'processing' | 'completed' | 'error';
  /** Audio file name */
  audioFileName: string;
  /** Audio file size in bytes */
  audioSize: number;
  /** Audio duration in seconds */
  audioDuration: number;
}

/**
 * Triage data saved after Stage 1.
 */
export interface TriageData {
  /** Detected encounter type */
  encounterType: string;
  /** Detected documentation standard */
  documentationStandard: string;
  /** Detected speaker context */
  speakerContext: string;
  /** When triage was detected */
  detectedAt: Date;
  /** Confidence score if available */
  confidence?: number;
}

/**
 * Diarized transcript chunk with speaker labels.
 */
export interface DiarizedChunk {
  /** Speaker label */
  speaker: string;
  /** Spoken text */
  text: string;
  /** Timestamp if available */
  timestamp?: number;
}

/**
 * Transcript data structure for persistence.
 */
export interface TranscriptData {
  /** Version number (0 = original) */
  version: number;
  /** Array of diarized chunks */
  content: DiarizedChunk[];
  /** When transcript was created */
  createdAt: Date;
  /** When transcript was last modified */
  modifiedAt?: Date;
  /** Who created/modified (system or user) */
  createdBy?: 'system' | 'user';
}

/**
 * Medical note section structure.
 */
export interface StorageNoteSection {
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Section order */
  order?: number;
}

/**
 * Medical note content structure.
 */
export interface NoteContent {
  /** Note format type */
  format: string;
  /** Array of note sections */
  sections: StorageNoteSection[];
  /** Chief complaint if applicable */
  chiefComplaint?: string;
  /** Key findings summary */
  keyFindings?: string;
  /** Plan summary */
  plan?: string;
  /** Follow-up instructions */
  followUp?: string;
}

/**
 * Medical note data structure for persistence.
 */
export interface MedicalNoteData {
  /** Version number (0 = original) */
  version: number;
  /** Encounter type */
  encounterType: string;
  /** Documentation standard */
  documentationStandard: string;
  /** Note content */
  noteContent: NoteContent;
  /** When note was created */
  createdAt: Date;
  /** When note was last modified */
  modifiedAt?: Date;
  /** Who created/modified (system or user) */
  createdBy?: 'system' | 'user';
}

/**
 * Version metadata for tracking file versions.
 */
export interface VersionMetadata {
  /** File type being versioned */
  fileType: 'transcript' | 'note';
  /** Version number */
  version: number;
  /** When version was created */
  createdAt: Date;
  /** Who created version */
  createdBy: 'system' | 'user';
  /** Action that created version */
  action: 'created' | 'edited' | 'regenerated';
  /** File size in bytes */
  fileSize: number;
  /** File name */
  fileName: string;
}

/**
 * Version history tracking for a file.
 */
export interface VersionHistory {
  /** Current version number */
  currentVersion: number;
  /** Array of version metadata */
  versions: VersionMetadata[];
  /** Maximum versions to keep */
  maxVersions: number;
}

/**
 * Audio file metadata.
 */
export interface AudioFileMetadata {
  /** Audio file name */
  fileName: string;
  /** Audio format (webm, wav, etc.) */
  format: string;
  /** File size in bytes */
  size: number;
  /** Duration in seconds */
  duration: number;
  /** Sample rate if known */
  sampleRate?: number;
  /** When audio was recorded */
  recordedAt: Date;
}

/**
 * List of encounters with pagination support.
 */
export interface EncounterList {
  /** Array of encounter metadata */
  encounters: EncounterFolderMetadata[];
  /** Total number of encounters */
  total: number;
  /** Current page (if paginated) */
  page?: number;
  /** Page size (if paginated) */
  pageSize?: number;
}

/**
 * Query options for listing encounters.
 */
export interface EncounterQueryOptions {
  /** Filter by encounter type */
  encounterType?: string;
  /** Filter by status */
  status?: 'recording' | 'processing' | 'completed' | 'error';
  /** Filter by date range start */
  dateFrom?: Date;
  /** Filter by date range end */
  dateTo?: Date;
  /** Search term for content search */
  searchTerm?: string;
  /** Sort field */
  sortBy?: 'created' | 'lastModified' | 'encounterType';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Page number for pagination */
  page?: number;
  /** Page size for pagination */
  pageSize?: number;
}

/**
 * Storage statistics and quota information.
 */
export interface StorageStats {
  /** Total space used in bytes */
  used: number;
  /** Available space in bytes */
  available: number;
  /** Total quota in bytes */
  quota: number;
  /** Number of encounters stored */
  encounterCount: number;
  /** Total audio size in bytes */
  totalAudioSize: number;
}

/**
 * Error types for storage operations.
 */
export const StorageErrorType = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  WRITE_FAILED: 'WRITE_FAILED',
  READ_FAILED: 'READ_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  INVALID_DATA: 'INVALID_DATA',
  UNSUPPORTED: 'UNSUPPORTED',
  UNKNOWN: 'UNKNOWN'
} as const;

export type StorageErrorType = typeof StorageErrorType[keyof typeof StorageErrorType];

/**
 * Storage error with detailed information.
 */
export class StorageError extends Error {
  public type: StorageErrorType;
  public details?: Record<string, unknown>;
  
  constructor(
    type: StorageErrorType,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StorageError';
    this.type = type;
    this.details = details;
  }
}

