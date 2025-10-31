/**
 * @fileoverview Configuration service for business-level configuration management.
 * 
 * Provides high-level configuration operations:
 * - Load/save configuration
 * - Get/update specific settings
 * - Manage encounter types and documentation standards
 * - Configuration validation
 * 
 * @module business/services/configurationService
 */

import {
  loadConfiguration,
  saveConfiguration,
  resetConfiguration,
  exportConfiguration,
  importConfiguration,
  updateConfigurationSection
} from '../../infrastructure/storage/configurationStorage';
import { logger } from '../../shared/utils/logger';
import type { 
  AppConfig, 
  EncounterTypeConfig, 
  DocumentationStandardConfig,
  AIPipelineConfig,
  AudioRecordingConfig,
  UserPreferencesConfig
} from '../../shared/types/configuration';

/**
 * Configuration service for managing application configuration.
 */
export class ConfigurationService {
  private config: AppConfig;

  constructor() {
    this.config = loadConfiguration();
  }

  /**
   * Get current configuration.
   * 
   * @returns {AppConfig} Current configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Update configuration.
   * 
   * @param updates - Partial configuration updates
   * @returns {boolean} True if updated successfully
   */
  updateConfig(updates: Partial<AppConfig>): boolean {
    try {
      this.config = {
        ...this.config,
        ...updates,
        lastUpdated: new Date()
      };

      return saveConfiguration(this.config);
    } catch (error) {
      logger.error('ConfigurationService', 'Failed to update configuration', error as Error);
      return false;
    }
  }

  /**
   * Reset configuration to defaults.
   * 
   * @returns {AppConfig} Default configuration
   */
  reset(): AppConfig {
    this.config = resetConfiguration();
    return this.config;
  }

  /**
   * Export configuration as JSON.
   * 
   * @returns {string} Configuration JSON
   */
  export(): string {
    return exportConfiguration();
  }

  /**
   * Import configuration from JSON.
   * 
   * @param json - Configuration JSON
   * @returns {boolean} True if imported successfully
   */
  import(json: string): boolean {
    const success = importConfiguration(json);
    if (success) {
      this.config = loadConfiguration();
    }
    return success;
  }

  /**
   * Get AI pipeline configuration.
   * 
   * @returns {AIPipelineConfig} AI pipeline config
   */
  getAIPipelineConfig(): AIPipelineConfig {
    return this.config.aiPipeline;
  }

  /**
   * Update AI pipeline configuration.
   * 
   * @param updates - Partial updates
   * @returns {boolean} True if updated successfully
   */
  updateAIPipelineConfig(updates: Partial<AIPipelineConfig>): boolean {
    const success = updateConfigurationSection('aiPipeline', updates);
    if (success) {
      this.config = loadConfiguration();
    }
    return success;
  }

  /**
   * Get audio recording configuration.
   * 
   * @returns {AudioRecordingConfig} Audio config
   */
  getAudioConfig(): AudioRecordingConfig {
    return this.config.audioRecording;
  }

  /**
   * Update audio recording configuration.
   * 
   * @param updates - Partial updates
   * @returns {boolean} True if updated successfully
   */
  updateAudioConfig(updates: Partial<AudioRecordingConfig>): boolean {
    const success = updateConfigurationSection('audioRecording', updates);
    if (success) {
      this.config = loadConfiguration();
    }
    return success;
  }

  /**
   * Get user preferences.
   * 
   * @returns {UserPreferencesConfig} User preferences
   */
  getUserPreferences(): UserPreferencesConfig {
    return this.config.userPreferences;
  }

  /**
   * Update user preferences.
   * 
   * @param updates - Partial updates
   * @returns {boolean} True if updated successfully
   */
  updateUserPreferences(updates: Partial<UserPreferencesConfig>): boolean {
    const success = updateConfigurationSection('userPreferences', updates);
    if (success) {
      this.config = loadConfiguration();
    }
    return success;
  }

  /**
   * Get all encounter types.
   * 
   * @param includeDisabled - Whether to include disabled types
   * @returns {EncounterTypeConfig[]} Encounter types
   */
  getEncounterTypes(includeDisabled = false): EncounterTypeConfig[] {
    if (includeDisabled) {
      return this.config.encounterTypes;
    }
    return this.config.encounterTypes.filter(t => t.enabled);
  }

  /**
   * Get encounter type by ID.
   * 
   * @param id - Encounter type ID
   * @returns {EncounterTypeConfig | undefined} Encounter type
   */
  getEncounterType(id: string): EncounterTypeConfig | undefined {
    return this.config.encounterTypes.find(t => t.id === id);
  }

  /**
   * Add or update encounter type.
   * 
   * @param encounterType - Encounter type configuration
   * @returns {boolean} True if updated successfully
   */
  setEncounterType(encounterType: EncounterTypeConfig): boolean {
    const index = this.config.encounterTypes.findIndex(t => t.id === encounterType.id);
    
    if (index >= 0) {
      this.config.encounterTypes[index] = encounterType;
    } else {
      this.config.encounterTypes.push(encounterType);
    }

    return this.updateConfig(this.config);
  }

  /**
   * Remove encounter type.
   * 
   * @param id - Encounter type ID
   * @returns {boolean} True if removed successfully
   */
  removeEncounterType(id: string): boolean {
    this.config.encounterTypes = this.config.encounterTypes.filter(t => t.id !== id);
    return this.updateConfig(this.config);
  }

  /**
   * Get all documentation standards.
   * 
   * @param includeDisabled - Whether to include disabled standards
   * @returns {DocumentationStandardConfig[]} Documentation standards
   */
  getDocumentationStandards(includeDisabled = false): DocumentationStandardConfig[] {
    if (includeDisabled) {
      return this.config.documentationStandards;
    }
    return this.config.documentationStandards.filter(s => s.enabled);
  }

  /**
   * Get documentation standard by ID.
   * 
   * @param id - Standard ID
   * @returns {DocumentationStandardConfig | undefined} Documentation standard
   */
  getDocumentationStandard(id: string): DocumentationStandardConfig | undefined {
    return this.config.documentationStandards.find(s => s.id === id);
  }

  /**
   * Add or update documentation standard.
   * 
   * @param standard - Documentation standard configuration
   * @returns {boolean} True if updated successfully
   */
  setDocumentationStandard(standard: DocumentationStandardConfig): boolean {
    const index = this.config.documentationStandards.findIndex(s => s.id === standard.id);
    
    if (index >= 0) {
      this.config.documentationStandards[index] = standard;
    } else {
      this.config.documentationStandards.push(standard);
    }

    return this.updateConfig(this.config);
  }

  /**
   * Remove documentation standard.
   * 
   * @param id - Standard ID
   * @returns {boolean} True if removed successfully
   */
  removeDocumentationStandard(id: string): boolean {
    this.config.documentationStandards = this.config.documentationStandards.filter(s => s.id !== id);
    return this.updateConfig(this.config);
  }

  /**
   * Get default encounter type.
   * 
   * @returns {EncounterTypeConfig | undefined} Default encounter type
   */
  getDefaultEncounterType(): EncounterTypeConfig | undefined {
    const defaultId = this.config.userPreferences.defaultEncounterType;
    return this.getEncounterType(defaultId);
  }

  /**
   * Get default documentation standard.
   * 
   * @returns {DocumentationStandardConfig | undefined} Default documentation standard
   */
  getDefaultDocumentationStandard(): DocumentationStandardConfig | undefined {
    const defaultId = this.config.userPreferences.defaultDocumentationStandard;
    return this.getDocumentationStandard(defaultId);
  }
}

/**
 * Singleton instance of configuration service.
 */
export const configurationService = new ConfigurationService();

