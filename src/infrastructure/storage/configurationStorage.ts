/**
 * @fileoverview Configuration storage service using localStorage.
 * 
 * Manages persistence of application configuration:
 * - Load/save configuration
 * - Configuration validation
 * - Migration support
 * - Default fallback
 * 
 * @module infrastructure/storage/configurationStorage
 */

import { logger } from '../../shared/utils/logger';
import type { AppConfig } from '../../shared/types/configuration';
import { DEFAULT_APP_CONFIG } from '../../shared/types/configuration';

/**
 * Storage key for application configuration.
 */
const CONFIG_STORAGE_KEY = 'docscribe-config';

/**
 * Load application configuration from localStorage.
 * Falls back to defaults if not found or invalid.
 * 
 * @returns {AppConfig} Application configuration
 * 
 * @example
 * ```typescript
 * const config = loadConfiguration();
 * console.log(config.aiPipeline.temperature);
 * ```
 */
export function loadConfiguration(): AppConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    
    if (!stored) {
      logger.info('ConfigurationStorage', 'No configuration found, using defaults');
      return DEFAULT_APP_CONFIG;
    }

    const parsed = JSON.parse(stored);
    
    // Convert date strings back to Date objects
    if (parsed.lastUpdated) {
      parsed.lastUpdated = new Date(parsed.lastUpdated);
    }

    // Validate and merge with defaults to handle missing fields
    const config = {
      ...DEFAULT_APP_CONFIG,
      ...parsed,
      aiPipeline: {
        ...DEFAULT_APP_CONFIG.aiPipeline,
        ...parsed.aiPipeline
      },
      audioRecording: {
        ...DEFAULT_APP_CONFIG.audioRecording,
        ...parsed.audioRecording
      },
      storage: {
        ...DEFAULT_APP_CONFIG.storage,
        ...parsed.storage
      },
      userPreferences: {
        ...DEFAULT_APP_CONFIG.userPreferences,
        ...parsed.userPreferences
      }
    };

    logger.info('ConfigurationStorage', 'Configuration loaded', {
      version: config.configVersion
    });

    return config;
  } catch (error) {
    logger.error('ConfigurationStorage', 'Failed to load configuration, using defaults', error as Error);
    return DEFAULT_APP_CONFIG;
  }
}

/**
 * Save application configuration to localStorage.
 * 
 * @param config - Configuration to save
 * @returns {boolean} True if saved successfully
 * 
 * @example
 * ```typescript
 * const config = loadConfiguration();
 * config.aiPipeline.temperature = 0.8;
 * saveConfiguration(config);
 * ```
 */
export function saveConfiguration(config: AppConfig): boolean {
  try {
    const toSave = {
      ...config,
      lastUpdated: new Date()
    };

    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(toSave, null, 2));

    logger.info('ConfigurationStorage', 'Configuration saved', {
      version: toSave.configVersion
    });

    return true;
  } catch (error) {
    logger.error('ConfigurationStorage', 'Failed to save configuration', error as Error);
    return false;
  }
}

/**
 * Reset configuration to defaults.
 * 
 * @returns {AppConfig} Default configuration
 * 
 * @example
 * ```typescript
 * const config = resetConfiguration();
 * ```
 */
export function resetConfiguration(): AppConfig {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    
    logger.info('ConfigurationStorage', 'Configuration reset to defaults');

    return DEFAULT_APP_CONFIG;
  } catch (error) {
    logger.error('ConfigurationStorage', 'Failed to reset configuration', error as Error);
    return DEFAULT_APP_CONFIG;
  }
}

/**
 * Export configuration as JSON string.
 * 
 * @returns {string} Configuration JSON
 * 
 * @example
 * ```typescript
 * const json = exportConfiguration();
 * // Save to file or clipboard
 * ```
 */
export function exportConfiguration(): string {
  const config = loadConfiguration();
  return JSON.stringify(config, null, 2);
}

/**
 * Import configuration from JSON string.
 * 
 * @param json - Configuration JSON
 * @returns {boolean} True if imported successfully
 * 
 * @example
 * ```typescript
 * const json = '{ "configVersion": 1, ... }';
 * const success = importConfiguration(json);
 * ```
 */
export function importConfiguration(json: string): boolean {
  try {
    const config = JSON.parse(json) as AppConfig;
    
    // Validate basic structure
    if (!config.configVersion || !config.aiPipeline || !config.encounterTypes) {
      throw new Error('Invalid configuration structure');
    }

    return saveConfiguration(config);
  } catch (error) {
    logger.error('ConfigurationStorage', 'Failed to import configuration', error as Error);
    return false;
  }
}

/**
 * Update a specific configuration section.
 * 
 * @param section - Section name
 * @param updates - Partial updates to apply
 * @returns {boolean} True if updated successfully
 * 
 * @example
 * ```typescript
 * updateConfigurationSection('aiPipeline', { temperature: 0.9 });
 * ```
 */
export function updateConfigurationSection<K extends keyof AppConfig>(
  section: K,
  updates: Partial<AppConfig[K]>
): boolean {
  try {
    const config = loadConfiguration();
    
    const currentSection = config[section] as unknown as Record<string, unknown>;
    const updatesObj = updates as unknown as Record<string, unknown>;
    const updatedSection = { ...currentSection, ...updatesObj };
    config[section] = updatedSection as unknown as AppConfig[K];

    return saveConfiguration(config);
  } catch (error) {
    logger.error('ConfigurationStorage', 'Failed to update configuration section', error as Error);
    return false;
  }
}

/**
 * Get a specific configuration section.
 * 
 * @param section - Section name
 * @returns {T} Section configuration
 * 
 * @example
 * ```typescript
 * const aiConfig = getConfigurationSection('aiPipeline');
 * console.log(aiConfig.temperature);
 * ```
 */
export function getConfigurationSection<K extends keyof AppConfig>(
  section: K
): AppConfig[K] {
  const config = loadConfiguration();
  return config[section];
}

