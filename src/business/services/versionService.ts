/**
 * @fileoverview Version control service for business-level version management.
 * 
 * Orchestrates version control operations for transcripts and medical notes,
 * providing high-level business operations on top of infrastructure storage.
 * 
 * @module business/services/versionService
 */

import {
  saveVersion,
  loadVersion,
  listVersions,
  getVersionHistory,
  restoreVersion,
  deleteVersion,
  compareVersions
} from '../../infrastructure/storage/versionStorage';
import { encounterStorage } from '../../infrastructure/storage/encounterStorage';
import { logger } from '../../shared/utils/logger';
import type { VersionMetadata, VersionHistory } from '../../shared/types/storage';

/**
 * Version control service for managing file versions.
 */
export class VersionService {
  /**
   * Save current state as new version before editing.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @param content - Current file content
   * @param currentVersion - Current version number
   * @param createdBy - Who is creating the version
   * @returns {Promise<number>} New version number
   */
  async createVersion(
    encounterFolderName: string,
    fileType: 'transcript' | 'note',
    content: string,
    currentVersion: number,
    createdBy: 'system' | 'user' = 'user'
  ): Promise<number> {
    try {
      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        throw new Error(`Encounter directory not found: ${encounterFolderName}`);
      }

      const newVersion = await saveVersion(
        encounterDir,
        fileType,
        content,
        currentVersion,
        createdBy,
        'edited'
      );

      logger.info('VersionService', 'Version created', {
        encounterFolderName,
        fileType,
        newVersion
      });

      return newVersion;
    } catch (error) {
      logger.error('VersionService', 'Failed to create version', error as Error);
      throw error;
    }
  }

  /**
   * Load a specific version.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @param version - Version number
   * @returns {Promise<any | null>} Parsed version content
   */
  async loadVersionContent(
    encounterFolderName: string,
    fileType: 'transcript' | 'note',
    version: number
  ): Promise<any | null> {
    try {
      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        return null;
      }

      const content = await loadVersion(encounterDir, fileType, version);
      if (!content) {
        return null;
      }

      return JSON.parse(content);
    } catch (error) {
      logger.error('VersionService', 'Failed to load version', error as Error);
      return null;
    }
  }

  /**
   * Get all versions for a file.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @returns {Promise<VersionMetadata[]>} Array of version metadata
   */
  async getVersions(
    encounterFolderName: string,
    fileType: 'transcript' | 'note'
  ): Promise<VersionMetadata[]> {
    try {
      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        return [];
      }

      return listVersions(encounterDir, fileType);
    } catch (error) {
      logger.error('VersionService', 'Failed to get versions', error as Error);
      return [];
    }
  }

  /**
   * Get version history with current version.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @param currentVersion - Current version number
   * @returns {Promise<VersionHistory>} Version history
   */
  async getHistory(
    encounterFolderName: string,
    fileType: 'transcript' | 'note',
    currentVersion: number
  ): Promise<VersionHistory> {
    try {
      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        return {
          currentVersion,
          versions: [],
          maxVersions: 4
        };
      }

      return getVersionHistory(encounterDir, fileType, currentVersion);
    } catch (error) {
      logger.error('VersionService', 'Failed to get history', error as Error);
      return {
        currentVersion,
        versions: [],
        maxVersions: 4
      };
    }
  }

  /**
   * Restore a previous version.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @param versionToRestore - Version to restore
   * @param currentVersion - Current version number
   * @returns {Promise<number>} New version number after restoration
   */
  async restoreVersion(
    encounterFolderName: string,
    fileType: 'transcript' | 'note',
    versionToRestore: number,
    currentVersion: number
  ): Promise<number> {
    try {
      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        throw new Error(`Encounter directory not found: ${encounterFolderName}`);
      }

      const newVersion = await restoreVersion(
        encounterDir,
        fileType,
        versionToRestore,
        currentVersion
      );

      logger.info('VersionService', 'Version restored', {
        encounterFolderName,
        fileType,
        versionToRestore,
        newVersion
      });

      return newVersion;
    } catch (error) {
      logger.error('VersionService', 'Failed to restore version', error as Error);
      throw error;
    }
  }

  /**
   * Delete a specific version.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @param version - Version to delete
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteVersion(
    encounterFolderName: string,
    fileType: 'transcript' | 'note',
    version: number
  ): Promise<boolean> {
    try {
      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        return false;
      }

      return deleteVersion(encounterDir, fileType, version);
    } catch (error) {
      logger.error('VersionService', 'Failed to delete version', error as Error);
      return false;
    }
  }

  /**
   * Compare two versions.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @param version1 - First version
   * @param version2 - Second version
   * @returns {Promise<{version1: any, version2: any} | null>} Comparison result
   */
  async compareVersions(
    encounterFolderName: string,
    fileType: 'transcript' | 'note',
    version1: number,
    version2: number
  ): Promise<{ version1: any; version2: any } | null> {
    try {
      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        return null;
      }

      return compareVersions(encounterDir, fileType, version1, version2);
    } catch (error) {
      logger.error('VersionService', 'Failed to compare versions', error as Error);
      return null;
    }
  }

  /**
   * Get version count for a file.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @returns {Promise<number>} Number of versions
   */
  async getVersionCount(
    encounterFolderName: string,
    fileType: 'transcript' | 'note'
  ): Promise<number> {
    const versions = await this.getVersions(encounterFolderName, fileType);
    return versions.length;
  }

  /**
   * Check if max versions limit is reached.
   * 
   * @param encounterFolderName - Encounter folder name
   * @param fileType - Type of file
   * @returns {Promise<boolean>} True if at max limit
   */
  async isAtMaxVersions(
    encounterFolderName: string,
    fileType: 'transcript' | 'note'
  ): Promise<boolean> {
    const count = await this.getVersionCount(encounterFolderName, fileType);
    return count >= 4;
  }
}

/**
 * Singleton instance of version service.
 */
export const versionService = new VersionService();

