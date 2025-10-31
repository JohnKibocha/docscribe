/**
 * @fileoverview Encounter service for high-level business operations.
 * 
 * Orchestrates encounter CRUD operations, connecting domain entities
 * with infrastructure storage services.
 * 
 * @module business/services/encounterService
 */

import { Encounter, EncounterStatus } from '../domain/encounter';
import { encounterStorage } from '../../infrastructure/storage/encounterStorage';
import { logger } from '../../shared/utils/logger';
import type {
  EncounterList,
  EncounterQueryOptions,
  StorageStats
} from '../../shared/types/storage';

/**
 * Encounter service for business operations.
 */
export class EncounterService {
  /**
   * Initialize storage system.
   */
  async initialize(): Promise<boolean> {
    return encounterStorage.initialize({
      suggestedName: 'DocScribeData',
      startIn: 'documents'
    });
  }

  /**
   * Check if storage is initialized.
   */
  isInitialized(): boolean {
    return encounterStorage.isInitialized();
  }

  /**
   * Create a new encounter.
   */
  async createEncounter(
    encounterId: string,
    encounterType: string = 'Consultation'
  ): Promise<Encounter | null> {
    try {
      const now = new Date();
      const encounter = new Encounter({
        id: encounterId,
        folderName: '',
        created: now,
        lastModified: now,
        encounterType,
        documentationStandard: '',
        speakerContext: '',
        status: 'recording',
        audioFileName: '',
        audioSize: 0,
        audioDuration: 0
      });

      const folderName = await encounterStorage.createEncounterFolder(encounter.toMetadata());
      encounter.folderName = folderName;

      logger.info('EncounterService', 'Encounter created', { encounterId, folderName });

      return encounter;
    } catch (error) {
      logger.error('EncounterService', 'Failed to create encounter', error as Error);
      return null;
    }
  }

  /**
   * Get encounter by folder name.
   */
  async getEncounter(folderName: string): Promise<Encounter | null> {
    try {
      const metadata = await encounterStorage.loadEncounterMetadata(folderName);
      if (!metadata) {
        return null;
      }

      return Encounter.fromMetadata(metadata);
    } catch (error) {
      logger.error('EncounterService', 'Failed to get encounter', error as Error);
      return null;
    }
  }

  /**
   * Update encounter.
   */
  async updateEncounter(encounter: Encounter): Promise<boolean> {
    try {
      return encounterStorage.updateEncounterMetadata(
        encounter.folderName,
        encounter.toMetadata()
      );
    } catch (error) {
      logger.error('EncounterService', 'Failed to update encounter', error as Error);
      return false;
    }
  }

  /**
   * Delete encounter.
   */
  async deleteEncounter(folderName: string): Promise<boolean> {
    try {
      return encounterStorage.deleteEncounter(folderName);
    } catch (error) {
      logger.error('EncounterService', 'Failed to delete encounter', error as Error);
      return false;
    }
  }

  /**
   * List all encounters.
   */
  async listEncounters(options?: EncounterQueryOptions): Promise<EncounterList> {
    try {
      const list = await encounterStorage.listEncounters(options);
      return list;
    } catch (error) {
      logger.error('EncounterService', 'Failed to list encounters', error as Error);
      return { encounters: [], total: 0 };
    }
  }

  /**
   * Get encounters by status.
   */
  async getEncountersByStatus(status: EncounterStatus): Promise<Encounter[]> {
    const list = await this.listEncounters({ status });
    return list.encounters.map(m => Encounter.fromMetadata(m));
  }

  /**
   * Get recent encounters (within last 7 days).
   */
  async getRecentEncounters(): Promise<Encounter[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const list = await this.listEncounters({
      dateFrom: sevenDaysAgo,
      sortBy: 'created',
      sortDirection: 'desc'
    });

    return list.encounters.map(m => Encounter.fromMetadata(m));
  }

  /**
   * Search encounters by content or type.
   */
  async searchEncounters(searchTerm: string): Promise<Encounter[]> {
    const list = await this.listEncounters({
      searchTerm
    });

    return list.encounters.map(m => Encounter.fromMetadata(m));
  }

  /**
   * Get storage statistics.
   */
  async getStorageStats(): Promise<StorageStats> {
    return encounterStorage.getStorageStats();
  }

  /**
   * Check storage quota and warn if low.
   */
  async checkStorageQuota(): Promise<{
    ok: boolean;
    percentUsed: number;
    message?: string;
  }> {
    const stats = await this.getStorageStats();

    if (stats.quota === 0) {
      return { ok: true, percentUsed: 0 };
    }

    const percentUsed = (stats.used / stats.quota) * 100;

    if (percentUsed > 90) {
      return {
        ok: false,
        percentUsed,
        message: 'Storage is over 90% full. Consider deleting old encounters.'
      };
    }

    if (percentUsed > 75) {
      return {
        ok: true,
        percentUsed,
        message: 'Storage is over 75% full.'
      };
    }

    return { ok: true, percentUsed };
  }
}

/**
 * Singleton instance of encounter service.
 */
export const encounterService = new EncounterService();

