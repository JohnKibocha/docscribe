/**
 * @fileoverview Storage services index - exports all storage functionality.
 * 
 * Central export point for all storage-related services and functions.
 * 
 * @module infrastructure/storage
 */

// File System wrapper
export * from './fileSystem';

// Storage services
export * from './encounterStorage';
export * from './transcriptStorage';
export * from './noteStorage';
export * from './audioStorage';
export * from './versionStorage';
export * from './configurationStorage';

// Storage integration
export * from './storageIntegration';

