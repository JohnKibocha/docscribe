/**
 * @fileoverview Version control storage service for managing file versions.
 * 
 * Implements version control for transcript and medical note files:
 * - Maintains last 4 versions per file
 * - Automatic version pruning
 * - Version metadata tracking
 * - Version restoration
 * 
 * @module infrastructure/storage/versionStorage
 */

import { writeFile, readFile, deleteFile, createDirectory, getDirectory, listDirectory } from './fileSystem';
import { logger } from '../../shared/utils/logger';
import type { VersionMetadata, VersionHistory } from '../../shared/types/storage';
import { StorageError, StorageErrorType } from '../../shared/types/storage';

/**
 * Maximum number of versions to keep per file.
 */
const MAX_VERSIONS = 4;

/**
 * Save a new version of a file.
 * Automatically prunes old versions if max limit exceeded.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileType - Type of file (transcript or note)
 * @param content - File content to save
 * @param currentVersion - Current version number
 * @param createdBy - Who created the version
 * @param action - Action that created version
 * @returns {Promise<number>} New version number
 * 
 * @throws {StorageError} If save fails
 * 
 * @example
 * ```typescript
 * const newVersion = await saveVersion(
 *   encounterDir,
 *   'transcript',
 *   transcriptContent,
 *   4,
 *   'user',
 *   'edited'
 * );
 * // Returns: 5
 * ```
 */
export async function saveVersion(
  encounterDir: FileSystemDirectoryHandle,
  fileType: 'transcript' | 'note',
  content: string,
  currentVersion: number,
  _createdBy: 'system' | 'user',
  _action: 'created' | 'edited' | 'regenerated'
): Promise<number> {
  try {
    const newVersion = currentVersion + 1;
    
    // Ensure versions directory exists
    const versionsResult = await createDirectory(encounterDir, 'versions');
    if (!versionsResult.success || !versionsResult.directoryHandle) {
      throw new StorageError(
        StorageErrorType.WRITE_FAILED,
        'Failed to create versions directory'
      );
    }
    const versionsDir = versionsResult.directoryHandle;

    // Determine file name
    const baseFileName = fileType === 'transcript' 
      ? 'transcript_diarized' 
      : 'medical_note';
    const versionFileName = `${baseFileName}_v${currentVersion}.json`;

    // Save current version to versions directory
    if (currentVersion > 0) {
      await writeFile(versionsDir, versionFileName, content);
      
      logger.info('VersionStorage', 'Version saved', {
        fileType,
        version: currentVersion
      });
    }

    // Prune old versions if needed
    await pruneOldVersions(versionsDir, baseFileName);

    logger.info('VersionStorage', 'New version created', {
      fileType,
      newVersion
    });

    return newVersion;
  } catch (error) {
    logger.error('VersionStorage', 'Failed to save version', error as Error);
    throw new StorageError(
      StorageErrorType.WRITE_FAILED,
      `Failed to save version: ${(error as Error).message}`,
      { fileType, currentVersion, originalError: error }
    );
  }
}

/**
 * Prune old versions to maintain max limit.
 * Keeps only the most recent MAX_VERSIONS versions.
 * 
 * @param versionsDir - Versions directory handle
 * @param baseFileName - Base file name (without version suffix)
 */
async function pruneOldVersions(
  versionsDir: FileSystemDirectoryHandle,
  baseFileName: string
): Promise<void> {
  try {
    const entries = await listDirectory(versionsDir);
    
    // Filter for this file type's versions
    const versionFiles = entries
      .filter(e => e.kind === 'file' && e.name.startsWith(baseFileName) && e.name.includes('_v'))
      .map(e => {
        const match = e.name.match(/_v(\d+)\.json$/);
        return {
          name: e.name,
          version: match ? parseInt(match[1], 10) : 0
        };
      })
      .sort((a, b) => b.version - a.version); // Sort descending

    // Delete versions beyond MAX_VERSIONS
    if (versionFiles.length > MAX_VERSIONS) {
      const toDelete = versionFiles.slice(MAX_VERSIONS);
      
      for (const file of toDelete) {
        await deleteFile(versionsDir, file.name);
        logger.info('VersionStorage', 'Old version pruned', {
          fileName: file.name,
          version: file.version
        });
      }
    }
  } catch (error) {
    logger.error('VersionStorage', 'Failed to prune old versions', error as Error);
  }
}

/**
 * Load a specific version of a file.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileType - Type of file (transcript or note)
 * @param version - Version number to load
 * @returns {Promise<string | null>} File content or null if not found
 * 
 * @example
 * ```typescript
 * const content = await loadVersion(encounterDir, 'transcript', 3);
 * if (content) {
 *   const data = JSON.parse(content);
 * }
 * ```
 */
export async function loadVersion(
  encounterDir: FileSystemDirectoryHandle,
  fileType: 'transcript' | 'note',
  version: number
): Promise<string | null> {
  try {
    const versionsDir = await getDirectory(encounterDir, 'versions');
    if (!versionsDir) {
      return null;
    }

    const baseFileName = fileType === 'transcript' 
      ? 'transcript_diarized' 
      : 'medical_note';
    const versionFileName = `${baseFileName}_v${version}.json`;

    const content = await readFile(versionsDir, versionFileName);

    if (content) {
      logger.info('VersionStorage', 'Version loaded', {
        fileType,
        version
      });
    }

    return content;
  } catch (error) {
    logger.error('VersionStorage', 'Failed to load version', error as Error);
    return null;
  }
}

/**
 * List all versions of a file.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileType - Type of file (transcript or note)
 * @returns {Promise<VersionMetadata[]>} Array of version metadata
 * 
 * @example
 * ```typescript
 * const versions = await listVersions(encounterDir, 'transcript');
 * console.log(`Found ${versions.length} versions`);
 * ```
 */
export async function listVersions(
  encounterDir: FileSystemDirectoryHandle,
  fileType: 'transcript' | 'note'
): Promise<VersionMetadata[]> {
  try {
    const versionsDir = await getDirectory(encounterDir, 'versions');
    if (!versionsDir) {
      return [];
    }

    const baseFileName = fileType === 'transcript' 
      ? 'transcript_diarized' 
      : 'medical_note';

    const entries = await listDirectory(versionsDir);
    
    const versions: VersionMetadata[] = [];

    for (const entry of entries) {
      if (entry.kind === 'file' && entry.name.startsWith(baseFileName) && entry.name.includes('_v')) {
        const match = entry.name.match(/_v(\d+)\.json$/);
        if (match) {
          const version = parseInt(match[1], 10);
          
          // Get file metadata
          const fileHandle = await versionsDir.getFileHandle(entry.name);
          const file = await fileHandle.getFile();

          versions.push({
            fileType,
            version,
            createdAt: new Date(file.lastModified),
            createdBy: 'system', // Default, could be enhanced
            action: 'edited', // Default, could be enhanced
            fileSize: file.size,
            fileName: entry.name
          });
        }
      }
    }

    // Sort by version number descending
    versions.sort((a, b) => b.version - a.version);

    logger.info('VersionStorage', 'Versions listed', {
      fileType,
      count: versions.length
    });

    return versions;
  } catch (error) {
    logger.error('VersionStorage', 'Failed to list versions', error as Error);
    return [];
  }
}

/**
 * Get version history for a file.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileType - Type of file (transcript or note)
 * @param currentVersion - Current version number
 * @returns {Promise<VersionHistory>} Version history
 * 
 * @example
 * ```typescript
 * const history = await getVersionHistory(encounterDir, 'transcript', 5);
 * console.log(`Current version: ${history.currentVersion}`);
 * console.log(`Total versions: ${history.versions.length}`);
 * ```
 */
export async function getVersionHistory(
  encounterDir: FileSystemDirectoryHandle,
  fileType: 'transcript' | 'note',
  currentVersion: number
): Promise<VersionHistory> {
  const versions = await listVersions(encounterDir, fileType);

  return {
    currentVersion,
    versions,
    maxVersions: MAX_VERSIONS
  };
}

/**
 * Restore a specific version to main file.
 * Creates a backup of current version before restoring.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileType - Type of file (transcript or note)
 * @param versionToRestore - Version number to restore
 * @param currentVersion - Current version number
 * @returns {Promise<number>} New version number after restoration
 * 
 * @throws {StorageError} If restoration fails
 * 
 * @example
 * ```typescript
 * const newVersion = await restoreVersion(encounterDir, 'transcript', 3, 5);
 * // Restores v3 as new v6, saves current v5 to versions
 * ```
 */
export async function restoreVersion(
  encounterDir: FileSystemDirectoryHandle,
  fileType: 'transcript' | 'note',
  versionToRestore: number,
  currentVersion: number
): Promise<number> {
  try {
    // Load the version to restore
    const content = await loadVersion(encounterDir, fileType, versionToRestore);
    if (!content) {
      throw new StorageError(
        StorageErrorType.NOT_FOUND,
        `Version ${versionToRestore} not found`
      );
    }

    // Read current main file to save as backup
    const baseFileName = fileType === 'transcript' 
      ? 'transcript_diarized.json' 
      : 'medical_note.json';
    const currentContent = await readFile(encounterDir, baseFileName);

    // Save current version to versions directory
    if (currentContent) {
      await saveVersion(
        encounterDir,
        fileType,
        currentContent,
        currentVersion,
        'user',
        'edited'
      );
    }

    // Write restored content to main file
    const newVersion = currentVersion + 1;
    const restoredData = JSON.parse(content);
    restoredData.version = newVersion;
    restoredData.modifiedAt = new Date();

    await writeFile(
      encounterDir,
      baseFileName,
      JSON.stringify(restoredData, null, 2)
    );

    logger.info('VersionStorage', 'Version restored', {
      fileType,
      versionToRestore,
      newVersion
    });

    return newVersion;
  } catch (error) {
    logger.error('VersionStorage', 'Failed to restore version', error as Error);
    throw new StorageError(
      StorageErrorType.WRITE_FAILED,
      `Failed to restore version: ${(error as Error).message}`,
      { fileType, versionToRestore, originalError: error }
    );
  }
}

/**
 * Delete a specific version.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileType - Type of file (transcript or note)
 * @param version - Version number to delete
 * @returns {Promise<boolean>} True if deleted successfully
 * 
 * @example
 * ```typescript
 * const deleted = await deleteVersion(encounterDir, 'transcript', 2);
 * ```
 */
export async function deleteVersion(
  encounterDir: FileSystemDirectoryHandle,
  fileType: 'transcript' | 'note',
  version: number
): Promise<boolean> {
  try {
    const versionsDir = await getDirectory(encounterDir, 'versions');
    if (!versionsDir) {
      return false;
    }

    const baseFileName = fileType === 'transcript' 
      ? 'transcript_diarized' 
      : 'medical_note';
    const versionFileName = `${baseFileName}_v${version}.json`;

    const deleted = await deleteFile(versionsDir, versionFileName);

    if (deleted) {
      logger.info('VersionStorage', 'Version deleted', {
        fileType,
        version
      });
    }

    return deleted;
  } catch (error) {
    logger.error('VersionStorage', 'Failed to delete version', error as Error);
    return false;
  }
}

/**
 * Compare two versions of a file.
 * Returns both versions for comparison.
 * 
 * @param encounterDir - Encounter directory handle
 * @param fileType - Type of file (transcript or note)
 * @param version1 - First version number
 * @param version2 - Second version number
 * @returns {Promise<{version1: any, version2: any} | null>} Parsed content of both versions
 * 
 * @example
 * ```typescript
 * const comparison = await compareVersions(encounterDir, 'transcript', 3, 5);
 * if (comparison) {
 *   console.log('Version 3:', comparison.version1);
 *   console.log('Version 5:', comparison.version2);
 * }
 * ```
 */
export async function compareVersions(
  encounterDir: FileSystemDirectoryHandle,
  fileType: 'transcript' | 'note',
  version1: number,
  version2: number
): Promise<{ version1: any; version2: any } | null> {
  try {
    const content1 = await loadVersion(encounterDir, fileType, version1);
    const content2 = await loadVersion(encounterDir, fileType, version2);

    if (!content1 || !content2) {
      return null;
    }

    return {
      version1: JSON.parse(content1),
      version2: JSON.parse(content2)
    };
  } catch (error) {
    logger.error('VersionStorage', 'Failed to compare versions', error as Error);
    return null;
  }
}

