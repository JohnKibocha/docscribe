/**
 * @fileoverview Audio storage service for saving audio recordings to file system.
 * 
 * Handles:
 * - Saving audio blobs to encounter folders
 * - Loading audio files for playback
 * - Managing audio metadata
 * 
 * @module infrastructure/storage/audioStorage
 */

import { writeBlob, readBlob, fileExists } from './fileSystem';
import { logger } from '../../shared/utils/logger';
import type { AudioFileMetadata } from '../../shared/types/storage';
import { StorageError, StorageErrorType } from '../../shared/types/storage';

/**
 * Determine audio format from blob MIME type.
 * 
 * @param blob - Audio blob
 * @returns {string} Audio format (webm, wav, mp3, etc.)
 * 
 * @example
 * ```typescript
 * const format = getAudioFormat(audioBlob);
 * // Returns: "webm"
 * ```
 */
export function getAudioFormat(blob: Blob): string {
  const mimeType = blob.type;
  
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('m4a')) return 'm4a';
  
  // Default to webm if unknown
  return 'webm';
}

/**
 * Generate audio file name with format extension.
 * 
 * @param format - Audio format
 * @returns {string} File name
 * 
 * @example
 * ```typescript
 * const fileName = generateAudioFileName('webm');
 * // Returns: "audio.webm"
 * ```
 */
export function generateAudioFileName(format: string): string {
  return `audio.${format}`;
}

/**
 * Estimate audio duration from blob size and format.
 * This is an approximation; actual duration may vary.
 * 
 * @param blob - Audio blob
 * @returns {Promise<number>} Estimated duration in seconds
 * 
 * @example
 * ```typescript
 * const duration = await estimateAudioDuration(audioBlob);
 * console.log(`Estimated duration: ${duration} seconds`);
 * ```
 */
export async function estimateAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        // Rough estimate: assume 128kbps bitrate
        const estimatedDuration = (blob.size * 8) / (128 * 1000);
        resolve(estimatedDuration);
      });
      
      audio.src = url;
    } catch (error) {
      logger.error('AudioStorage', 'Failed to estimate audio duration', error as Error);
      // Fallback estimate
      const estimatedDuration = (blob.size * 8) / (128 * 1000);
      resolve(estimatedDuration);
    }
  });
}

/**
 * Save audio blob to encounter folder.
 * 
 * @param encounterDir - Encounter directory handle
 * @param audioBlob - Audio recording blob
 * @param metadata - Optional audio metadata
 * @returns {Promise<AudioFileMetadata>} Saved audio metadata
 * 
 * @throws {StorageError} If save fails
 * 
 * @example
 * ```typescript
 * const metadata = await saveAudioBlob(encounterDir, audioBlob, {
 *   recordedAt: new Date()
 * });
 * console.log(`Saved audio: ${metadata.fileName}, ${metadata.duration}s`);
 * ```
 */
export async function saveAudioBlob(
  encounterDir: FileSystemDirectoryHandle,
  audioBlob: Blob,
  metadata?: Partial<AudioFileMetadata>
): Promise<AudioFileMetadata> {
  try {
    const format = getAudioFormat(audioBlob);
    const fileName = generateAudioFileName(format);
    
    logger.info('AudioStorage', 'Saving audio blob', {
      fileName,
      size: audioBlob.size,
      format
    });

    // Estimate duration if not provided
    let duration = metadata?.duration;
    if (duration === undefined) {
      duration = await estimateAudioDuration(audioBlob);
    }

    // Save audio file
    await writeBlob(encounterDir, fileName, audioBlob);

    const audioMetadata: AudioFileMetadata = {
      fileName,
      format,
      size: audioBlob.size,
      duration,
      sampleRate: metadata?.sampleRate,
      recordedAt: metadata?.recordedAt || new Date()
    };

    logger.info('AudioStorage', 'Audio blob saved', {
      fileName,
      duration,
      size: audioBlob.size
    });

    return audioMetadata;
  } catch (error) {
    logger.error('AudioStorage', 'Failed to save audio blob', error as Error);
    throw new StorageError(
      StorageErrorType.WRITE_FAILED,
      `Failed to save audio blob: ${(error as Error).message}`,
      { originalError: error }
    );
  }
}

/**
 * Load audio blob from encounter folder.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileName - Audio file name (default: auto-detect)
 * @returns {Promise<Blob | null>} Audio blob or null if not found
 * 
 * @example
 * ```typescript
 * const audioBlob = await loadAudioBlob(encounterDir);
 * if (audioBlob) {
 *   const url = URL.createObjectURL(audioBlob);
 *   audioElement.src = url;
 * }
 * ```
 */
export async function loadAudioBlob(
  encounterDir: FileSystemDirectoryHandle,
  fileName?: string
): Promise<Blob | null> {
  try {
    // If no filename provided, try common formats
    if (!fileName) {
      const formats = ['webm', 'wav', 'mp3', 'ogg', 'mp4', 'm4a'];
      
      for (const format of formats) {
        const testFileName = generateAudioFileName(format);
        const exists = await fileExists(encounterDir, testFileName);
        
        if (exists) {
          fileName = testFileName;
          break;
        }
      }
      
      if (!fileName) {
        logger.warn('AudioStorage', 'No audio file found in encounter');
        return null;
      }
    }

    const audioBlob = await readBlob(encounterDir, fileName);

    if (audioBlob) {
      logger.info('AudioStorage', 'Audio blob loaded', {
        fileName,
        size: audioBlob.size
      });
    }

    return audioBlob;
  } catch (error) {
    logger.error('AudioStorage', 'Failed to load audio blob', error as Error);
    return null;
  }
}

/**
 * Check if audio file exists in encounter folder.
 * 
 * @param encounterDir - Encounter directory handle
 * @returns {Promise<boolean>} True if audio file exists
 * 
 * @example
 * ```typescript
 * const hasAudio = await audioFileExists(encounterDir);
 * ```
 */
export async function audioFileExists(
  encounterDir: FileSystemDirectoryHandle
): Promise<boolean> {
  const formats = ['webm', 'wav', 'mp3', 'ogg', 'mp4', 'm4a'];
  
  for (const format of formats) {
    const fileName = generateAudioFileName(format);
    const exists = await fileExists(encounterDir, fileName);
    
    if (exists) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create audio URL for playback from blob.
 * Remember to revoke the URL when done to prevent memory leaks.
 * 
 * @param audioBlob - Audio blob
 * @returns {string} Object URL
 * 
 * @example
 * ```typescript
 * const url = createAudioURL(audioBlob);
 * audioElement.src = url;
 * // Later:
 * URL.revokeObjectURL(url);
 * ```
 */
export function createAudioURL(audioBlob: Blob): string {
  return URL.createObjectURL(audioBlob);
}

/**
 * Get audio file metadata without loading entire blob.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileName - Audio file name
 * @returns {Promise<Partial<AudioFileMetadata> | null>} Audio metadata or null
 * 
 * @example
 * ```typescript
 * const metadata = await getAudioMetadata(encounterDir, 'audio.webm');
 * if (metadata) {
 *   console.log(`Audio size: ${metadata.size} bytes`);
 * }
 * ```
 */
export async function getAudioMetadata(
  encounterDir: FileSystemDirectoryHandle,
  fileName: string
): Promise<Partial<AudioFileMetadata> | null> {
  try {
    const exists = await fileExists(encounterDir, fileName);
    if (!exists) {
      return null;
    }

    // To get metadata without loading entire file, we need to get the file handle
    const fileHandle = await encounterDir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    
    const format = getAudioFormat(file);

    return {
      fileName,
      format,
      size: file.size
    };
  } catch (error) {
    logger.error('AudioStorage', 'Failed to get audio metadata', error as Error);
    return null;
  }
}

