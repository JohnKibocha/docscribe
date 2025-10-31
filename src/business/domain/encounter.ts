/**
 * @fileoverview Encounter domain entity and business logic.
 * 
 * Represents a medical encounter with associated metadata, state management,
 * and business rules. Provides entity methods for state transitions and validation.
 * 
 * @module business/domain/encounter
 */

import type { EncounterFolderMetadata } from '../../shared/types/storage';

/**
 * Encounter status enum for type safety.
 */
export const EncounterStatus = {
  RECORDING: 'recording',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

export type EncounterStatus = typeof EncounterStatus[keyof typeof EncounterStatus];

/**
 * Encounter entity representing a medical encounter.
 * Contains business logic for state management and validation.
 */
export class Encounter {
  public id: string;
  public folderName: string;
  public created: Date;
  public lastModified: Date;
  public encounterType: string;
  public documentationStandard: string;
  public speakerContext: string;
  public status: EncounterStatus;
  public audioFileName: string;
  public audioSize: number;
  public audioDuration: number;

  constructor(metadata: EncounterFolderMetadata) {
    this.id = metadata.id;
    this.folderName = metadata.folderName;
    this.created = metadata.created;
    this.lastModified = metadata.lastModified;
    this.encounterType = metadata.encounterType;
    this.documentationStandard = metadata.documentationStandard;
    this.speakerContext = metadata.speakerContext;
    this.status = this.mapStatus(metadata.status);
    this.audioFileName = metadata.audioFileName;
    this.audioSize = metadata.audioSize;
    this.audioDuration = metadata.audioDuration;
  }

  /**
   * Map string status to enum.
   */
  private mapStatus(status: string): EncounterStatus {
    switch (status) {
      case 'recording':
        return EncounterStatus.RECORDING;
      case 'processing':
        return EncounterStatus.PROCESSING;
      case 'completed':
        return EncounterStatus.COMPLETED;
      case 'error':
        return EncounterStatus.ERROR;
      default:
        return EncounterStatus.RECORDING;
    }
  }

  /**
   * Check if encounter is in recording state.
   */
  isRecording(): boolean {
    return this.status === EncounterStatus.RECORDING;
  }

  /**
   * Check if encounter is currently being processed.
   */
  isProcessing(): boolean {
    return this.status === EncounterStatus.PROCESSING;
  }

  /**
   * Check if encounter is completed.
   */
  isCompleted(): boolean {
    return this.status === EncounterStatus.COMPLETED;
  }

  /**
   * Check if encounter has an error.
   */
  hasError(): boolean {
    return this.status === EncounterStatus.ERROR;
  }

  /**
   * Check if encounter can be edited.
   * Only completed encounters can be edited.
   */
  canEdit(): boolean {
    return this.isCompleted();
  }

  /**
   * Check if encounter can be deleted.
   * Any encounter except processing can be deleted.
   */
  canDelete(): boolean {
    return !this.isProcessing();
  }

  /**
   * Transition to processing state.
   */
  startProcessing(): void {
    if (!this.isRecording()) {
      throw new Error('Can only start processing from recording state');
    }
    this.status = EncounterStatus.PROCESSING;
    this.lastModified = new Date();
  }

  /**
   * Mark encounter as completed.
   */
  markCompleted(): void {
    if (!this.isProcessing()) {
      throw new Error('Can only complete from processing state');
    }
    this.status = EncounterStatus.COMPLETED;
    this.lastModified = new Date();
  }

  /**
   * Mark encounter as having an error.
   */
  markError(): void {
    this.status = EncounterStatus.ERROR;
    this.lastModified = new Date();
  }

  /**
   * Update triage information.
   */
  updateTriage(
    encounterType: string,
    documentationStandard: string,
    speakerContext: string
  ): void {
    this.encounterType = encounterType;
    this.documentationStandard = documentationStandard;
    this.speakerContext = speakerContext;
    this.lastModified = new Date();
  }

  /**
   * Update audio information.
   */
  updateAudio(fileName: string, size: number, duration: number): void {
    this.audioFileName = fileName;
    this.audioSize = size;
    this.audioDuration = duration;
    this.lastModified = new Date();
  }

  /**
   * Get formatted duration string.
   */
  getFormattedDuration(): string {
    if (this.audioDuration === 0) {
      return '0:00';
    }

    const minutes = Math.floor(this.audioDuration / 60);
    const seconds = Math.floor(this.audioDuration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get formatted file size string.
   */
  getFormattedSize(): string {
    if (this.audioSize === 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this.audioSize;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get days since encounter was created.
   */
  getDaysOld(): number {
    const now = new Date();
    const diff = now.getTime() - this.created.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if encounter is recent (within last 7 days).
   */
  isRecent(): boolean {
    return this.getDaysOld() <= 7;
  }

  /**
   * Convert to metadata object for storage.
   */
  toMetadata(): EncounterFolderMetadata {
    return {
      id: this.id,
      folderName: this.folderName,
      created: this.created,
      lastModified: this.lastModified,
      encounterType: this.encounterType,
      documentationStandard: this.documentationStandard,
      speakerContext: this.speakerContext,
      status: this.status,
      audioFileName: this.audioFileName,
      audioSize: this.audioSize,
      audioDuration: this.audioDuration
    };
  }

  /**
   * Create Encounter from metadata.
   */
  static fromMetadata(metadata: EncounterFolderMetadata): Encounter {
    return new Encounter(metadata);
  }

  /**
   * Validate encounter metadata.
   */
  static validate(metadata: Partial<EncounterFolderMetadata>): boolean {
    if (!metadata.id || metadata.id.trim().length === 0) {
      throw new Error('Encounter ID is required');
    }

    if (!metadata.created) {
      throw new Error('Encounter creation date is required');
    }

    return true;
  }
}

