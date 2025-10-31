/**
 * @fileoverview Encounter storage service for managing encounter folders and files.
 * 
 * Provides high-level operations for:
 * - Creating and managing encounter folders
 * - Saving and loading encounter metadata
 * - Managing encounter files (triage, transcript, note, audio)
 * - Listing and querying encounters
 * 
 * @module infrastructure/storage/encounterStorage
 */

import type { DirectoryPickerOptions } from './fileSystem';
import {
  requestDirectoryAccess,
  verifyDirectoryPermission,
  createDirectory,
  getDirectory,
  writeFile,
  readFile,
  deleteDirectory,
  listDirectory,
} from './fileSystem';
import { logger } from '../../shared/utils/logger';
import type {
  EncounterFolderMetadata,
  EncounterList,
  EncounterQueryOptions,
  StorageStats
} from '../../shared/types/storage';
import { StorageError, StorageErrorType } from '../../shared/types/storage';

/**
 * Encounter storage manager for file system operations.
 */
export class EncounterStorageService {
  private rootDirectoryHandle: FileSystemDirectoryHandle | null = null;
  private encountersDirectoryHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Initialize storage service by requesting directory access from user.
   * 
   * @param options - Directory picker options
   * @returns {Promise<boolean>} True if initialization successful
   * 
   * @example
   * ```typescript
   * const storage = new EncounterStorageService();
   * const initialized = await storage.initialize();
   * if (initialized) {
   *   // Can now save/load encounters
   * }
   * ```
   */
  async initialize(options: DirectoryPickerOptions = {}): Promise<boolean> {
    try {
      logger.info('EncounterStorage', 'Initializing storage service');

      this.rootDirectoryHandle = await requestDirectoryAccess(options);

      const hasPermission = await verifyDirectoryPermission(this.rootDirectoryHandle, 'readwrite');
      if (!hasPermission) {
        throw new StorageError(
          StorageErrorType.PERMISSION_DENIED,
          'Write permission not granted for directory'
        );
      }

      const encountersResult = await createDirectory(this.rootDirectoryHandle, 'encounters');
      if (!encountersResult.success || !encountersResult.directoryHandle) {
        throw new StorageError(
          StorageErrorType.WRITE_FAILED,
          'Failed to create encounters directory'
        );
      }

      this.encountersDirectoryHandle = encountersResult.directoryHandle;

      logger.info('EncounterStorage', 'Storage service initialized', {
        rootDir: this.rootDirectoryHandle.name
      });

      return true;
    } catch (error) {
      logger.error('EncounterStorage', 'Failed to initialize storage', error as Error);
      return false;
    }
  }

  /**
   * Check if storage service is initialized and ready.
   * 
   * @returns {boolean} True if initialized
   */
  isInitialized(): boolean {
    return this.rootDirectoryHandle !== null && this.encountersDirectoryHandle !== null;
  }

  /**
   * Get root directory handle.
   * 
   * @returns {FileSystemDirectoryHandle | null} Root directory handle
   * @throws {StorageError} If not initialized
   */
  getRootDirectory(): FileSystemDirectoryHandle {
    if (!this.rootDirectoryHandle) {
      throw new StorageError(
        StorageErrorType.UNSUPPORTED,
        'Storage not initialized. Call initialize() first.'
      );
    }
    return this.rootDirectoryHandle;
  }

  /**
   * Get encounters directory handle.
   * 
   * @returns {FileSystemDirectoryHandle} Encounters directory handle
   * @throws {StorageError} If not initialized
   */
  getEncountersDirectory(): FileSystemDirectoryHandle {
    if (!this.encountersDirectoryHandle) {
      throw new StorageError(
        StorageErrorType.UNSUPPORTED,
        'Storage not initialized. Call initialize() first.'
      );
    }
    return this.encountersDirectoryHandle;
  }

  /**
   * Generate folder name for encounter based on timestamp and type.
   * 
   * @param encounterType - Type of encounter
   * @param timestamp - Encounter timestamp
   * @returns {string} Folder name
   * 
   * @example
   * ```typescript
   * const folderName = service.generateFolderName('Consultation', new Date());
   * // Returns: "2025-10-31_09-15-23_consultation"
   * ```
   */
  generateFolderName(encounterType: string, timestamp: Date): string {
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const seconds = String(timestamp.getSeconds()).padStart(2, '0');
    
    const typeSlug = encounterType.toLowerCase().replace(/\s+/g, '_');
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}_${typeSlug}`;
  }

  /**
   * Create a new encounter folder with metadata file.
   * 
   * @param metadata - Encounter metadata
   * @returns {Promise<string>} Folder name created
   * @throws {StorageError} If creation fails
   * 
   * @example
   * ```typescript
   * const folderName = await service.createEncounterFolder({
   *   id: 'enc_123',
   *   encounterType: 'Consultation',
   *   documentationStandard: 'SOAP',
   *   ...
   * });
   * ```
   */
  async createEncounterFolder(metadata: EncounterFolderMetadata): Promise<string> {
    const encountersDir = this.getEncountersDirectory();

    try {
      const folderName = metadata.folderName || this.generateFolderName(
        metadata.encounterType,
        metadata.created
      );

      logger.info('EncounterStorage', 'Creating encounter folder', {
        encounterId: metadata.id,
        folderName
      });

      const result = await createDirectory(encountersDir, folderName);
      if (!result.success || !result.directoryHandle) {
        throw new StorageError(
          StorageErrorType.WRITE_FAILED,
          `Failed to create encounter folder: ${folderName}`
        );
      }

      const encounterDir = result.directoryHandle;
      const metadataWithFolder = { ...metadata, folderName };
      
      await writeFile(
        encounterDir,
        'metadata.json',
        JSON.stringify(metadataWithFolder, null, 2)
      );

      logger.info('EncounterStorage', 'Encounter folder created', {
        encounterId: metadata.id,
        folderName
      });

      return folderName;
    } catch (error) {
      logger.error('EncounterStorage', 'Failed to create encounter folder', error as Error);
      throw error;
    }
  }

  /**
   * Get directory handle for a specific encounter.
   * 
   * @param folderName - Encounter folder name
   * @returns {Promise<FileSystemDirectoryHandle | null>} Directory handle or null if not found
   * 
   * @example
   * ```typescript
   * const encounterDir = await service.getEncounterDirectory('2025-10-31_09-15-23_consultation');
   * if (encounterDir) {
   *   // Access encounter files
   * }
   * ```
   */
  async getEncounterDirectory(folderName: string): Promise<FileSystemDirectoryHandle | null> {
    const encountersDir = this.getEncountersDirectory();
    return getDirectory(encountersDir, folderName);
  }

  /**
   * Load encounter metadata from folder.
   * 
   * @param folderName - Encounter folder name
   * @returns {Promise<EncounterFolderMetadata | null>} Metadata or null if not found
   * 
   * @example
   * ```typescript
   * const metadata = await service.loadEncounterMetadata('2025-10-31_09-15-23_consultation');
   * ```
   */
  async loadEncounterMetadata(folderName: string): Promise<EncounterFolderMetadata | null> {
    try {
      const encounterDir = await this.getEncounterDirectory(folderName);
      if (!encounterDir) {
        return null;
      }

      const metadataJson = await readFile(encounterDir, 'metadata.json');
      if (!metadataJson) {
        return null;
      }

      const metadata = JSON.parse(metadataJson) as EncounterFolderMetadata;
      
      // Convert date strings back to Date objects
      metadata.created = new Date(metadata.created);
      metadata.lastModified = new Date(metadata.lastModified);

      return metadata;
    } catch (error) {
      logger.error('EncounterStorage', 'Failed to load encounter metadata', error as Error, {
        folderName
      });
      return null;
    }
  }

  /**
   * Update encounter metadata.
   * 
   * @param folderName - Encounter folder name
   * @param updates - Partial metadata updates
   * @returns {Promise<boolean>} True if update successful
   * 
   * @example
   * ```typescript
   * await service.updateEncounterMetadata(folderName, {
   *   status: 'completed',
   *   lastModified: new Date()
   * });
   * ```
   */
  async updateEncounterMetadata(
    folderName: string,
    updates: Partial<EncounterFolderMetadata>
  ): Promise<boolean> {
    try {
      const metadata = await this.loadEncounterMetadata(folderName);
      if (!metadata) {
        return false;
      }

      const updatedMetadata = {
        ...metadata,
        ...updates,
        lastModified: new Date()
      };

      const encounterDir = await this.getEncounterDirectory(folderName);
      if (!encounterDir) {
        return false;
      }

      await writeFile(
        encounterDir,
        'metadata.json',
        JSON.stringify(updatedMetadata, null, 2),
        { createBackup: true }
      );

      logger.info('EncounterStorage', 'Encounter metadata updated', {
        folderName,
        updates: Object.keys(updates)
      });

      return true;
    } catch (error) {
      logger.error('EncounterStorage', 'Failed to update encounter metadata', error as Error);
      return false;
    }
  }

  /**
   * Delete an encounter folder and all its contents.
   * 
   * @param folderName - Encounter folder name to delete
   * @returns {Promise<boolean>} True if deletion successful
   * 
   * @example
   * ```typescript
   * const deleted = await service.deleteEncounter('2025-10-31_09-15-23_consultation');
   * ```
   */
  async deleteEncounter(folderName: string): Promise<boolean> {
    const encountersDir = this.getEncountersDirectory();

    try {
      const deleted = await deleteDirectory(encountersDir, folderName);
      
      if (deleted) {
        logger.info('EncounterStorage', 'Encounter deleted', { folderName });
      }

      return deleted;
    } catch (error) {
      logger.error('EncounterStorage', 'Failed to delete encounter', error as Error, { folderName });
      return false;
    }
  }

  /**
   * List all encounter folders.
   * 
   * @param options - Query options for filtering and sorting
   * @returns {Promise<EncounterList>} List of encounters with metadata
   * 
   * @example
   * ```typescript
   * const list = await service.listEncounters({
   *   encounterType: 'Consultation',
   *   sortBy: 'created',
   *   sortDirection: 'desc'
   * });
   * ```
   */
  async listEncounters(options: EncounterQueryOptions = {}): Promise<EncounterList> {
    const encountersDir = this.getEncountersDirectory();

    try {
      const entries = await listDirectory(encountersDir);
      const encounterFolders = entries.filter(entry => entry.kind === 'directory');

      const encounters: EncounterFolderMetadata[] = [];

      for (const folder of encounterFolders) {
        const metadata = await this.loadEncounterMetadata(folder.name);
        if (metadata) {
          // Apply filters
          if (options.encounterType && metadata.encounterType !== options.encounterType) {
            continue;
          }
          if (options.status && metadata.status !== options.status) {
            continue;
          }
          if (options.dateFrom && metadata.created < options.dateFrom) {
            continue;
          }
          if (options.dateTo && metadata.created > options.dateTo) {
            continue;
          }

          encounters.push(metadata);
        }
      }

      // Sort encounters
      if (options.sortBy) {
        const sortField = options.sortBy;
        const direction = options.sortDirection === 'asc' ? 1 : -1;
        
        encounters.sort((a, b) => {
          const aVal = a[sortField] as Date | string;
          const bVal = b[sortField] as Date | string;
          
          if (aVal < bVal) return -direction;
          if (aVal > bVal) return direction;
          return 0;
        });
      }

      // Apply pagination
      const page = options.page || 1;
      const pageSize = options.pageSize || encounters.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedEncounters = encounters.slice(start, end);

      logger.info('EncounterStorage', 'Encounters listed', {
        total: encounters.length,
        returned: paginatedEncounters.length
      });

      return {
        encounters: paginatedEncounters,
        total: encounters.length,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('EncounterStorage', 'Failed to list encounters', error as Error);
      return {
        encounters: [],
        total: 0
      };
    }
  }

  /**
   * Get storage statistics.
   * 
   * @returns {Promise<StorageStats>} Storage statistics
   * 
   * @example
   * ```typescript
   * const stats = await service.getStorageStats();
   * console.log(`${stats.encounterCount} encounters, ${stats.totalAudioSize} bytes audio`);
   * ```
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const list = await this.listEncounters();
      
      let totalAudioSize = 0;
      for (const encounter of list.encounters) {
        totalAudioSize += encounter.audioSize || 0;
      }

      // Get storage quota if available
      let quota = 0;
      let used = 0;
      let available = 0;

      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        quota = estimate.quota || 0;
        used = estimate.usage || 0;
        available = quota - used;
      }

      return {
        used,
        available,
        quota,
        encounterCount: list.total,
        totalAudioSize
      };
    } catch (error) {
      logger.error('EncounterStorage', 'Failed to get storage stats', error as Error);
      return {
        used: 0,
        available: 0,
        quota: 0,
        encounterCount: 0,
        totalAudioSize: 0
      };
    }
  }
}

/**
 * Singleton instance of encounter storage service.
 */
export const encounterStorage = new EncounterStorageService();

