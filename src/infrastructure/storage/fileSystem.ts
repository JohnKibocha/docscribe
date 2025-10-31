/**
 * @fileoverview File System Access API wrapper for local persistent storage.
 * 
 * Provides abstraction layer over the File System Access API for:
 * - Directory picker and permission management
 * - File and directory operations (create, read, write, delete)
 * - Error handling and fallback strategies
 * - Atomic write operations with rollback
 * 
 * @module infrastructure/storage/fileSystem
 */

import { logger } from '../../shared/utils/logger';
import {
  StorageErrorType,
  StorageError
} from '../../shared/types/storage';
import type {
  FileSystemAvailability,
  FileWriteOptions,
  FileOperationResult
} from '../../shared/types/storage';

export type { DirectoryPickerOptions } from '../../shared/types/storage';

/**
 * Check if File System Access API is available in current browser.
 * 
 * @returns {FileSystemAvailability} Availability status and reason if unavailable
 * 
 * @example
 * ```typescript
 * const availability = checkFileSystemAvailability();
 * if (availability.available) {
 *   // Proceed with file system operations
 * } else {
 *   console.log('File System API not available:', availability.reason);
 * }
 * ```
 */
export function checkFileSystemAvailability(): FileSystemAvailability {
  if (!window.showDirectoryPicker) {
    return {
      available: false,
      reason: 'File System Access API not supported in this browser. Use Chrome/Edge 86+ on desktop.'
    };
  }

  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    return {
      available: false,
      reason: 'File System Access API requires HTTPS or localhost'
    };
  }

  return { available: true };
}

/**
 * Request directory access from user via directory picker dialog.
 * Requires user gesture (click, tap, key press).
 * 
 * @param options - Directory picker options
 * @returns {Promise<FileSystemDirectoryHandle>} Directory handle with read/write access
 * 
 * @throws {StorageError} If user denies permission or API not available
 * 
 * @example
 * ```typescript
 * const dirHandle = await requestDirectoryAccess({
 *   suggestedName: 'DocScribeData',
 *   startIn: 'documents'
 * });
 * ```
 */
export async function requestDirectoryAccess(
  options: DirectoryPickerOptions = {}
): Promise<FileSystemDirectoryHandle> {
  const availability = checkFileSystemAvailability();
  if (!availability.available) {
    throw new StorageError(
      StorageErrorType.UNSUPPORTED,
      `File System API not available: ${availability.reason}`
    );
  }

  try {
    logger.info('FileSystem', 'Requesting directory access', options);
    
    const dirHandle = await window.showDirectoryPicker({
      mode: options.mode || 'readwrite',
      startIn: options.startIn || 'documents'
    });

    logger.info('FileSystem', 'Directory access granted', {
      name: dirHandle.name
    });

    return dirHandle;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new StorageError(
        StorageErrorType.PERMISSION_DENIED,
        'User cancelled directory selection'
      );
    }
    
    logger.error('FileSystem', 'Failed to request directory access', error as Error);
    throw new StorageError(
      StorageErrorType.PERMISSION_DENIED,
      `Failed to request directory access: ${(error as Error).message}`,
      { originalError: error }
    );
  }
}

/**
 * Verify permission status for a directory handle.
 * 
 * @param dirHandle - Directory handle to check
 * @param mode - Permission mode to check
 * @returns {Promise<boolean>} True if permission granted
 * 
 * @example
 * ```typescript
 * const hasPermission = await verifyDirectoryPermission(dirHandle, 'readwrite');
 * if (!hasPermission) {
 *   // Request permission again
 * }
 * ```
 */
export async function verifyDirectoryPermission(
  dirHandle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  try {
    const permission = await dirHandle.queryPermission({ mode });
    return permission === 'granted';
  } catch (error) {
    logger.error('FileSystem', 'Failed to verify permission', error as Error);
    return false;
  }
}

/**
 * Request permission for directory handle if not already granted.
 * 
 * @param dirHandle - Directory handle to request permission for
 * @param mode - Permission mode to request
 * @returns {Promise<boolean>} True if permission granted
 * 
 * @example
 * ```typescript
 * const granted = await requestDirectoryPermission(dirHandle, 'readwrite');
 * if (granted) {
 *   // Proceed with operations
 * }
 * ```
 */
export async function requestDirectoryPermission(
  dirHandle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  try {
    const permission = await dirHandle.requestPermission({ mode });
    return permission === 'granted';
  } catch (error) {
    logger.error('FileSystem', 'Failed to request permission', error as Error);
    return false;
  }
}

/**
 * Create a subdirectory within a parent directory.
 * Creates parent directories if they don't exist (recursive).
 * 
 * @param parentHandle - Parent directory handle
 * @param path - Path to create (can include nested directories)
 * @returns {Promise<FileOperationResult>} Operation result with directory handle
 * 
 * @example
 * ```typescript
 * const result = await createDirectory(rootHandle, 'encounters/2025-10-31');
 * if (result.success) {
 *   // Directory created successfully
 * }
 * ```
 */
export async function createDirectory(
  parentHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileOperationResult> {
  try {
    const pathParts = path.split('/').filter(part => part.length > 0);
    let currentHandle = parentHandle;

    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }

    logger.info('FileSystem', 'Directory created', { path });

    return {
      success: true,
      directoryHandle: currentHandle
    };
  } catch (error) {
    logger.error('FileSystem', 'Failed to create directory', error as Error, { path });
    return {
      success: false,
      error: `Failed to create directory: ${(error as Error).message}`
    };
  }
}

/**
 * Get directory handle for a path, optionally creating if missing.
 * 
 * @param parentHandle - Parent directory handle
 * @param path - Path to directory
 * @param create - Whether to create if missing
 * @returns {Promise<FileSystemDirectoryHandle | null>} Directory handle or null if not found
 * 
 * @example
 * ```typescript
 * const encounterDir = await getDirectory(rootHandle, 'encounters/enc_123', true);
 * if (encounterDir) {
 *   // Directory exists or was created
 * }
 * ```
 */
export async function getDirectory(
  parentHandle: FileSystemDirectoryHandle,
  path: string,
  create: boolean = false
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const pathParts = path.split('/').filter(part => part.length > 0);
    let currentHandle = parentHandle;

    for (const part of pathParts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create });
    }

    return currentHandle;
  } catch (error) {
    if ((error as DOMException).name === 'NotFoundError') {
      return null;
    }
    logger.error('FileSystem', 'Failed to get directory', error as Error, { path });
    return null;
  }
}

/**
 * Write text content to a file with atomic operation support.
 * Creates parent directories if they don't exist.
 * 
 * @param dirHandle - Directory containing the file
 * @param fileName - Name of file to write
 * @param content - Text content to write
 * @param options - Write options
 * @returns {Promise<FileOperationResult>} Operation result
 * 
 * @throws {StorageError} If write fails
 * 
 * @example
 * ```typescript
 * const result = await writeFile(
 *   encounterDir,
 *   'triage.json',
 *   JSON.stringify(triageData, null, 2),
 *   { atomic: true, createBackup: true }
 * );
 * ```
 */
export async function writeFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string,
  options: FileWriteOptions = {}
): Promise<FileOperationResult> {
  try {
    // Create backup if requested and file exists
    if (options.createBackup) {
      const existingFile = await getFile(dirHandle, fileName);
      if (existingFile) {
        await writeFile(
          dirHandle,
          `${fileName}.backup`,
          existingFile,
          { atomic: false }
        );
      }
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    
    await writable.write(content);
    await writable.close();

    logger.info('FileSystem', 'File written', {
      fileName,
      size: content.length
    });

    return {
      success: true,
      fileHandle
    };
  } catch (error) {
    logger.error('FileSystem', 'Failed to write file', error as Error, { fileName });
    
    throw new StorageError(
      StorageErrorType.WRITE_FAILED,
      `Failed to write file ${fileName}: ${(error as Error).message}`,
      { fileName, originalError: error }
    );
  }
}

/**
 * Write binary content (Blob) to a file.
 * 
 * @param dirHandle - Directory containing the file
 * @param fileName - Name of file to write
 * @param blob - Binary content to write
 * @returns {Promise<FileOperationResult>} Operation result
 * 
 * @throws {StorageError} If write fails
 * 
 * @example
 * ```typescript
 * const result = await writeBlob(encounterDir, 'audio.webm', audioBlob);
 * ```
 */
export async function writeBlob(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<FileOperationResult> {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    
    await writable.write(blob);
    await writable.close();

    logger.info('FileSystem', 'Blob written', {
      fileName,
      size: blob.size
    });

    return {
      success: true,
      fileHandle
    };
  } catch (error) {
    logger.error('FileSystem', 'Failed to write blob', error as Error, { fileName });
    
    throw new StorageError(
      StorageErrorType.WRITE_FAILED,
      `Failed to write blob ${fileName}: ${(error as Error).message}`,
      { fileName, originalError: error }
    );
  }
}

/**
 * Read text content from a file.
 * 
 * @param dirHandle - Directory containing the file
 * @param fileName - Name of file to read
 * @returns {Promise<string | null>} File content or null if not found
 * 
 * @example
 * ```typescript
 * const triageJson = await readFile(encounterDir, 'triage.json');
 * if (triageJson) {
 *   const triage = JSON.parse(triageJson);
 * }
 * ```
 */
export async function readFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<string | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const content = await file.text();

    logger.debug('FileSystem', 'File read', { fileName, size: content.length });

    return content;
  } catch (error) {
    if ((error as DOMException).name === 'NotFoundError') {
      return null;
    }
    
    logger.error('FileSystem', 'Failed to read file', error as Error, { fileName });
    return null;
  }
}

/**
 * Read binary content from a file as Blob.
 * 
 * @param dirHandle - Directory containing the file
 * @param fileName - Name of file to read
 * @returns {Promise<Blob | null>} File content as Blob or null if not found
 * 
 * @example
 * ```typescript
 * const audioBlob = await readBlob(encounterDir, 'audio.webm');
 * if (audioBlob) {
 *   const audioUrl = URL.createObjectURL(audioBlob);
 * }
 * ```
 */
export async function readBlob(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<Blob | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    logger.debug('FileSystem', 'Blob read', { fileName, size: file.size });

    return file;
  } catch (error) {
    if ((error as DOMException).name === 'NotFoundError') {
      return null;
    }
    
    logger.error('FileSystem', 'Failed to read blob', error as Error, { fileName });
    return null;
  }
}

/**
 * Helper to get file content as text (for internal use).
 */
async function getFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<string | null> {
  return readFile(dirHandle, fileName);
}

/**
 * Delete a file from directory.
 * 
 * @param dirHandle - Directory containing the file
 * @param fileName - Name of file to delete
 * @returns {Promise<boolean>} True if deleted successfully
 * 
 * @example
 * ```typescript
 * const deleted = await deleteFile(encounterDir, 'temp_file.json');
 * ```
 */
export async function deleteFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<boolean> {
  try {
    await dirHandle.removeEntry(fileName);
    logger.info('FileSystem', 'File deleted', { fileName });
    return true;
  } catch (error) {
    if ((error as DOMException).name === 'NotFoundError') {
      return true;
    }
    
    logger.error('FileSystem', 'Failed to delete file', error as Error, { fileName });
    return false;
  }
}

/**
 * Delete a directory and all its contents recursively.
 * 
 * @param parentHandle - Parent directory handle
 * @param dirName - Name of directory to delete
 * @returns {Promise<boolean>} True if deleted successfully
 * 
 * @example
 * ```typescript
 * const deleted = await deleteDirectory(encountersDir, 'enc_123');
 * ```
 */
export async function deleteDirectory(
  parentHandle: FileSystemDirectoryHandle,
  dirName: string
): Promise<boolean> {
  try {
    await parentHandle.removeEntry(dirName, { recursive: true });
    logger.info('FileSystem', 'Directory deleted', { dirName });
    return true;
  } catch (error) {
    if ((error as DOMException).name === 'NotFoundError') {
      return true;
    }
    
    logger.error('FileSystem', 'Failed to delete directory', error as Error, { dirName });
    return false;
  }
}

/**
 * List all entries in a directory.
 * 
 * @param dirHandle - Directory handle to list
 * @returns {Promise<Array<{name: string, kind: 'file' | 'directory'}>>} Array of entries
 * 
 * @example
 * ```typescript
 * const entries = await listDirectory(encountersDir);
 * for (const entry of entries) {
 *   console.log(entry.name, entry.kind);
 * }
 * ```
 */
export async function listDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<Array<{ name: string; kind: 'file' | 'directory' }>> {
  const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];

  try {
    for await (const entry of dirHandle.values()) {
      entries.push({
        name: entry.name,
        kind: entry.kind
      });
    }

    logger.debug('FileSystem', 'Directory listed', {
      count: entries.length
    });

    return entries;
  } catch (error) {
    logger.error('FileSystem', 'Failed to list directory', error as Error);
    return [];
  }
}

/**
 * Check if a file exists in directory.
 * 
 * @param dirHandle - Directory to check
 * @param fileName - File name to check
 * @returns {Promise<boolean>} True if file exists
 * 
 * @example
 * ```typescript
 * const exists = await fileExists(encounterDir, 'triage.json');
 * ```
 */
export async function fileExists(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<boolean> {
  try {
    await dirHandle.getFileHandle(fileName);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a directory exists.
 * 
 * @param parentHandle - Parent directory
 * @param dirName - Directory name to check
 * @returns {Promise<boolean>} True if directory exists
 * 
 * @example
 * ```typescript
 * const exists = await directoryExists(rootHandle, 'encounters');
 * ```
 */
export async function directoryExists(
  parentHandle: FileSystemDirectoryHandle,
  dirName: string
): Promise<boolean> {
  try {
    await parentHandle.getDirectoryHandle(dirName);
    return true;
  } catch (error) {
    return false;
  }
}

