/**
 * @fileoverview Transcript storage service for managing diarized transcripts.
 * 
 * Handles:
 * - Saving diarized transcripts after Stage 3
 * - Loading transcripts for display and editing
 * - Managing transcript versions (via version storage)
 * 
 * @module infrastructure/storage/transcriptStorage
 */

import { writeFile, readFile } from './fileSystem';
import { logger } from '../../shared/utils/logger';
import type {
  TranscriptData,
  DiarizedChunk
} from '../../shared/types/storage';
import { StorageError, StorageErrorType } from '../../shared/types/storage';

/**
 * Save diarized transcript to encounter folder.
 * 
 * @param encounterDir - Encounter directory handle
 * @param transcript - Diarized transcript data
 * @param version - Version number (default 0 for original)
 * @returns {Promise<boolean>} True if save successful
 * 
 * @example
 * ```typescript
 * const saved = await saveTranscript(encounterDir, {
 *   version: 0,
 *   content: diarizedChunks,
 *   createdAt: new Date(),
 *   createdBy: 'system'
 * });
 * ```
 */
export async function saveTranscript(
  encounterDir: FileSystemDirectoryHandle,
  transcript: TranscriptData,
  version: number = 0
): Promise<boolean> {
  try {
    logger.info('TranscriptStorage', 'Saving transcript', {
      version,
      chunks: transcript.content.length
    });

    const fileName = 'transcript_diarized.json';
    const content = JSON.stringify(transcript, null, 2);

    await writeFile(encounterDir, fileName, content, {
      createBackup: version > 0,
      atomic: true
    });

    logger.info('TranscriptStorage', 'Transcript saved', { version });

    return true;
  } catch (error) {
    logger.error('TranscriptStorage', 'Failed to save transcript', error as Error);
    return false;
  }
}

/**
 * Load diarized transcript from encounter folder.
 * 
 * @param encounterDir - Encounter directory handle
 * @returns {Promise<TranscriptData | null>} Transcript data or null if not found
 * 
 * @example
 * ```typescript
 * const transcript = await loadTranscript(encounterDir);
 * if (transcript) {
 *   console.log(`Loaded ${transcript.content.length} chunks`);
 * }
 * ```
 */
export async function loadTranscript(
  encounterDir: FileSystemDirectoryHandle
): Promise<TranscriptData | null> {
  try {
    const fileName = 'transcript_diarized.json';
    const content = await readFile(encounterDir, fileName);

    if (!content) {
      return null;
    }

    const transcript = JSON.parse(content) as TranscriptData;
    
    // Convert date strings back to Date objects
    transcript.createdAt = new Date(transcript.createdAt);
    if (transcript.modifiedAt) {
      transcript.modifiedAt = new Date(transcript.modifiedAt);
    }

    logger.info('TranscriptStorage', 'Transcript loaded', {
      version: transcript.version,
      chunks: transcript.content.length
    });

    return transcript;
  } catch (error) {
    logger.error('TranscriptStorage', 'Failed to load transcript', error as Error);
    return null;
  }
}

/**
 * Save triage data to encounter folder.
 * Triage data is saved after Stage 1 and is read-only.
 * 
 * @param encounterDir - Encounter directory handle
 * @param triageData - Triage results from Stage 1
 * @returns {Promise<boolean>} True if save successful
 * 
 * @example
 * ```typescript
 * const saved = await saveTriageData(encounterDir, {
 *   encounterType: 'Consultation',
 *   documentationStandard: 'SOAP',
 *   speakerContext: 'Provider-Patient',
 *   detectedAt: new Date()
 * });
 * ```
 */
export async function saveTriageData(
  encounterDir: FileSystemDirectoryHandle,
  triageData: {
    encounterType: string;
    documentationStandard: string;
    speakerContext: string;
    detectedAt: Date;
    confidence?: number;
  }
): Promise<boolean> {
  try {
    logger.info('TranscriptStorage', 'Saving triage data', {
      encounterType: triageData.encounterType
    });

    const fileName = 'triage.json';
    const content = JSON.stringify(triageData, null, 2);

    await writeFile(encounterDir, fileName, content);

    logger.info('TranscriptStorage', 'Triage data saved');

    return true;
  } catch (error) {
    logger.error('TranscriptStorage', 'Failed to save triage data', error as Error);
    return false;
  }
}

/**
 * Load triage data from encounter folder.
 * 
 * @param encounterDir - Encounter directory handle
 * @returns {Promise<object | null>} Triage data or null if not found
 * 
 * @example
 * ```typescript
 * const triage = await loadTriageData(encounterDir);
 * if (triage) {
 *   console.log(`Encounter type: ${triage.encounterType}`);
 * }
 * ```
 */
export async function loadTriageData(
  encounterDir: FileSystemDirectoryHandle
): Promise<{
  encounterType: string;
  documentationStandard: string;
  speakerContext: string;
  detectedAt: Date;
  confidence?: number;
} | null> {
  try {
    const fileName = 'triage.json';
    const content = await readFile(encounterDir, fileName);

    if (!content) {
      return null;
    }

    const triageData = JSON.parse(content);
    
    // Convert date string back to Date object
    triageData.detectedAt = new Date(triageData.detectedAt);

    logger.info('TranscriptStorage', 'Triage data loaded', {
      encounterType: triageData.encounterType
    });

    return triageData;
  } catch (error) {
    logger.error('TranscriptStorage', 'Failed to load triage data', error as Error);
    return null;
  }
}

/**
 * Create formatted transcript text from diarized chunks.
 * Useful for display and export.
 * 
 * @param chunks - Array of diarized chunks
 * @returns {string} Formatted transcript text
 * 
 * @example
 * ```typescript
 * const text = formatTranscriptText(transcript.content);
 * // Returns:
 * // [Provider]: Patient presents with chest pain
 * // [Patient]: Started about 2 hours ago
 * ```
 */
export function formatTranscriptText(chunks: DiarizedChunk[]): string {
  return chunks
    .map(chunk => `[${chunk.speaker}]: ${chunk.text}`)
    .join('\n');
}

/**
 * Parse formatted transcript text back into diarized chunks.
 * Used when loading edited transcripts.
 * 
 * @param text - Formatted transcript text
 * @returns {DiarizedChunk[]} Array of diarized chunks
 * 
 * @example
 * ```typescript
 * const chunks = parseTranscriptText(editedText);
 * ```
 */
export function parseTranscriptText(text: string): DiarizedChunk[] {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const chunks: DiarizedChunk[] = [];

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]:\s*(.+)$/);
    if (match) {
      chunks.push({
        speaker: match[1],
        text: match[2]
      });
    }
  }

  return chunks;
}

/**
 * Validate transcript structure before saving.
 * 
 * @param transcript - Transcript data to validate
 * @returns {boolean} True if valid
 * 
 * @throws {StorageError} If validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   validateTranscript(transcript);
 *   // Transcript is valid, proceed with save
 * } catch (error) {
 *   // Handle validation error
 * }
 * ```
 */
export function validateTranscript(transcript: TranscriptData): boolean {
  if (!transcript.content || transcript.content.length === 0) {
    throw new StorageError(
      StorageErrorType.INVALID_DATA,
      'Transcript content cannot be empty'
    );
  }

  for (const chunk of transcript.content) {
    if (!chunk.speaker || chunk.speaker.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.INVALID_DATA,
        'All transcript chunks must have a speaker label'
      );
    }
    if (!chunk.text || chunk.text.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.INVALID_DATA,
        'All transcript chunks must have text content'
      );
    }
  }

  return true;
}

