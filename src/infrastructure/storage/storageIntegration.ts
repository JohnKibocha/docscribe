/**
 * @fileoverview Storage integration service for connecting pipeline to file system.
 * 
 * Integrates storage services with the existing AI pipeline without modifying
 * pipeline logic. Saves outputs after each stage completes.
 * 
 * @module infrastructure/storage/storageIntegration
 */

import { encounterStorage } from './encounterStorage';
import { saveTriageData, saveTranscript } from './transcriptStorage';
import { saveMedicalNote } from './noteStorage';
import { saveAudioBlob } from './audioStorage';
import { logger } from '../../shared/utils/logger';
import type {
  EncounterFolderMetadata,
  TranscriptData,
  MedicalNoteData,
  DiarizedChunk
} from '../../shared/types/storage';

/**
 * Storage integration manager for pipeline outputs.
 * Manages saving data at appropriate pipeline stages.
 */
export class StorageIntegration {
  private encounterMetadata: Map<string, EncounterFolderMetadata> = new Map();

  /**
   * Initialize storage and request directory access.
   * 
   * @returns {Promise<boolean>} True if initialization successful
   * 
   * @example
   * ```typescript
   * const integration = new StorageIntegration();
   * const initialized = await integration.initialize();
   * ```
   */
  async initialize(): Promise<boolean> {
    try {
      const initialized = await encounterStorage.initialize({
        suggestedName: 'DocScribeData',
        startIn: 'documents'
      });

      if (initialized) {
        logger.info('StorageIntegration', 'Storage integration initialized');
      }

      return initialized;
    } catch (error) {
      logger.error('StorageIntegration', 'Failed to initialize storage integration', error as Error);
      return false;
    }
  }

  /**
   * Check if storage is initialized.
   * 
   * @returns {boolean} True if initialized
   */
  isInitialized(): boolean {
    return encounterStorage.isInitialized();
  }

  /**
   * Start a new encounter and create its folder.
   * 
   * @param encounterId - Unique encounter ID
   * @param encounterType - Type of encounter
   * @param timestamp - Encounter timestamp
   * @returns {Promise<string | null>} Folder name or null if failed
   * 
   * @example
   * ```typescript
   * const folderName = await integration.startEncounter(
   *   'enc_123',
   *   'Consultation',
   *   new Date()
   * );
   * ```
   */
  async startEncounter(
    encounterId: string,
    encounterType: string = 'Consultation',
    timestamp: Date = new Date()
  ): Promise<string | null> {
    if (!this.isInitialized()) {
      logger.warn('StorageIntegration', 'Storage not initialized');
      return null;
    }

    try {
      const metadata: EncounterFolderMetadata = {
        id: encounterId,
        folderName: '',
        created: timestamp,
        lastModified: timestamp,
        encounterType,
        documentationStandard: '',
        speakerContext: '',
        status: 'recording',
        audioFileName: '',
        audioSize: 0,
        audioDuration: 0
      };

      const folderName = await encounterStorage.createEncounterFolder(metadata);
      metadata.folderName = folderName;
      this.encounterMetadata.set(encounterId, metadata);

      logger.info('StorageIntegration', 'Encounter started', {
        encounterId,
        folderName
      });

      return folderName;
    } catch (error) {
      logger.error('StorageIntegration', 'Failed to start encounter', error as Error);
      return null;
    }
  }

  /**
   * Save triage results after Stage 1 completes.
   * 
   * @param encounterId - Encounter ID
   * @param triageData - Triage results from Stage 1
   * @returns {Promise<boolean>} True if save successful
   * 
   * @example
   * ```typescript
   * await integration.saveTriageResults('enc_123', {
   *   encounterType: 'Consultation',
   *   documentationStandard: 'SOAP',
   *   speakerContext: 'Provider-Patient',
   *   detectedAt: new Date()
   * });
   * ```
   */
  async saveTriageResults(
    encounterId: string,
    triageData: {
      encounterType: string;
      documentationStandard: string;
      speakerContext: string;
      detectedAt: Date;
      confidence?: number;
    }
  ): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      const metadata = this.encounterMetadata.get(encounterId);
      if (!metadata) {
        logger.error('StorageIntegration', 'Encounter metadata not found', undefined, { encounterId });
        return false;
      }

      const encounterDir = await encounterStorage.getEncounterDirectory(metadata.folderName);
      if (!encounterDir) {
        logger.error('StorageIntegration', 'Encounter directory not found', undefined, {
          folderName: metadata.folderName
        });
        return false;
      }

      const saved = await saveTriageData(encounterDir, triageData);

      if (saved) {
        // Update encounter metadata
        await encounterStorage.updateEncounterMetadata(metadata.folderName, {
          encounterType: triageData.encounterType,
          documentationStandard: triageData.documentationStandard,
          speakerContext: triageData.speakerContext,
          status: 'processing'
        });

        logger.info('StorageIntegration', 'Triage results saved', {
          encounterId,
          encounterType: triageData.encounterType
        });
      }

      return saved;
    } catch (error) {
      logger.error('StorageIntegration', 'Failed to save triage results', error as Error);
      return false;
    }
  }

  /**
   * Save diarized transcript after Stage 3 completes.
   * 
   * @param encounterId - Encounter ID
   * @param diarizedChunks - Array of diarized chunks
   * @returns {Promise<boolean>} True if save successful
   * 
   * @example
   * ```typescript
   * await integration.saveDiarizedTranscript('enc_123', diarizedChunks);
   * ```
   */
  async saveDiarizedTranscript(
    encounterId: string,
    diarizedChunks: DiarizedChunk[]
  ): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      const metadata = this.encounterMetadata.get(encounterId);
      if (!metadata) {
        logger.error('StorageIntegration', 'Encounter metadata not found', undefined, { encounterId });
        return false;
      }

      const encounterDir = await encounterStorage.getEncounterDirectory(metadata.folderName);
      if (!encounterDir) {
        logger.error('StorageIntegration', 'Encounter directory not found', undefined, {
          folderName: metadata.folderName
        });
        return false;
      }

      const transcriptData: TranscriptData = {
        version: 0,
        content: diarizedChunks,
        createdAt: new Date(),
        createdBy: 'system'
      };

      const saved = await saveTranscript(encounterDir, transcriptData);

      if (saved) {
        logger.info('StorageIntegration', 'Diarized transcript saved', {
          encounterId,
          chunks: diarizedChunks.length
        });
      }

      return saved;
    } catch (error) {
      logger.error('StorageIntegration', 'Failed to save diarized transcript', error as Error);
      return false;
    }
  }

  /**
   * Save medical note after Stage 5 completes.
   * 
   * @param encounterId - Encounter ID
   * @param noteContent - Medical note content
   * @param encounterType - Encounter type
   * @param documentationStandard - Documentation standard
   * @returns {Promise<boolean>} True if save successful
   * 
   * @example
   * ```typescript
   * await integration.saveMedicalNoteResults('enc_123', noteContent, 'Consultation', 'SOAP');
   * ```
   */
  async saveMedicalNoteResults(
    encounterId: string,
    noteContent: any,
    encounterType: string,
    documentationStandard: string
  ): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      const metadata = this.encounterMetadata.get(encounterId);
      if (!metadata) {
        logger.error('StorageIntegration', 'Encounter metadata not found', undefined, { encounterId });
        return false;
      }

      const encounterDir = await encounterStorage.getEncounterDirectory(metadata.folderName);
      if (!encounterDir) {
        logger.error('StorageIntegration', 'Encounter directory not found', undefined, {
          folderName: metadata.folderName
        });
        return false;
      }

      const noteData: MedicalNoteData = {
        version: 0,
        encounterType,
        documentationStandard,
        noteContent,
        createdAt: new Date(),
        createdBy: 'system'
      };

      const saved = await saveMedicalNote(encounterDir, noteData);

      if (saved) {
        // Update encounter status to completed
        await encounterStorage.updateEncounterMetadata(metadata.folderName, {
          status: 'completed'
        });

        logger.info('StorageIntegration', 'Medical note saved', {
          encounterId,
          encounterType
        });
      }

      return saved;
    } catch (error) {
      logger.error('StorageIntegration', 'Failed to save medical note', error as Error);
      return false;
    }
  }

  /**
   * Save audio blob after recording stops.
   * 
   * @param encounterId - Encounter ID
   * @param audioBlob - Audio recording blob
   * @returns {Promise<boolean>} True if save successful
   * 
   * @example
   * ```typescript
   * await integration.saveAudio('enc_123', audioBlob);
   * ```
   */
  async saveAudio(
    encounterId: string,
    audioBlob: Blob
  ): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      const metadata = this.encounterMetadata.get(encounterId);
      if (!metadata) {
        logger.error('StorageIntegration', 'Encounter metadata not found', undefined, { encounterId });
        return false;
      }

      const encounterDir = await encounterStorage.getEncounterDirectory(metadata.folderName);
      if (!encounterDir) {
        logger.error('StorageIntegration', 'Encounter directory not found', undefined, {
          folderName: metadata.folderName
        });
        return false;
      }

      const audioMetadata = await saveAudioBlob(encounterDir, audioBlob, {
        recordedAt: new Date()
      });

      // Update encounter metadata with audio info
      await encounterStorage.updateEncounterMetadata(metadata.folderName, {
        audioFileName: audioMetadata.fileName,
        audioSize: audioMetadata.size,
        audioDuration: audioMetadata.duration
      });

      logger.info('StorageIntegration', 'Audio saved', {
        encounterId,
        fileName: audioMetadata.fileName,
        size: audioMetadata.size
      });

      return true;
    } catch (error) {
      logger.error('StorageIntegration', 'Failed to save audio', error as Error);
      return false;
    }
  }

  /**
   * Mark encounter as having an error.
   * 
   * @param encounterId - Encounter ID
   * @returns {Promise<boolean>} True if update successful
   */
  async markEncounterError(encounterId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      const metadata = this.encounterMetadata.get(encounterId);
      if (!metadata) {
        return false;
      }

      await encounterStorage.updateEncounterMetadata(metadata.folderName, {
        status: 'error'
      });

      logger.info('StorageIntegration', 'Encounter marked as error', { encounterId });

      return true;
    } catch (error) {
      logger.error('StorageIntegration', 'Failed to mark encounter error', error as Error);
      return false;
    }
  }

  /**
   * Get encounter folder name for an ID.
   * 
   * @param encounterId - Encounter ID
   * @returns {string | null} Folder name or null
   */
  getEncounterFolder(encounterId: string): string | null {
    const metadata = this.encounterMetadata.get(encounterId);
    return metadata?.folderName || null;
  }

  /**
   * Clean up encounter metadata from memory.
   * Call this when encounter is complete and no longer needed.
   * 
   * @param encounterId - Encounter ID
   */
  cleanupEncounter(encounterId: string): void {
    this.encounterMetadata.delete(encounterId);
    logger.debug('StorageIntegration', 'Encounter cleaned up', { encounterId });
  }
}

/**
 * Singleton instance of storage integration.
 */
export const storageIntegration = new StorageIntegration();

