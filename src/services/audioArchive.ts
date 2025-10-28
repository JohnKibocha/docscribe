/**
 * @fileoverview Audio recording preservation and retrieval system.
 * 
 * Manages original audio recordings alongside medical notes for future reference,
 * verification, and re-processing. Essential for legal compliance and quality assurance.
 * 
 * @module services/audioArchive
 */

import { logger } from '../utils/logger';

interface AudioArchiveEntry {
  id: string;
  encounterId: string;
  timestamp: string;
  audioBlob: Blob;
  duration: number;
  size: number;
  metadata: {
    encounterType?: string;
    speakerContext?: string;
    recordingQuality?: 'high' | 'medium' | 'low';
    hasTranscript: boolean;
  };
}

interface AudioMetrics {
  totalRecordings: number;
  totalSize: number;
  averageDuration: number;
  oldestRecording?: string;
}

/**
 * Audio archive service for preserving original recordings with medical notes.
 * 
 * Features:
 * - IndexedDB storage for large audio files
 * - Automatic cleanup policies
 * - Export capabilities for legal compliance
 * - Quality metrics and validation
 * - Cross-reference with medical notes
 * 
 * Storage Strategy:
 * - Recent recordings (last 30 days): Full quality
 * - Older recordings (30-90 days): Compressed
 * - Archive recordings (90+ days): User choice to keep/delete
 */
export class AudioArchiveService {
  private dbName = 'DocScribeAudioArchive';
  private dbVersion = 1;
  private storeName = 'recordings';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initializeDB();
  }

  /**
   * Initialize IndexedDB for audio storage
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        logger.error('AudioArchive', 'Failed to initialize audio database', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info('AudioArchive', 'Audio database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('encounterId', 'encounterId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          logger.info('AudioArchive', 'Created audio recordings object store');
        }
      };
    });
  }

  /**
   * Store audio recording with metadata
   */
  async storeRecording(
    encounterId: string, 
    audioBlob: Blob, 
    metadata: Partial<AudioArchiveEntry['metadata']> = {}
  ): Promise<string> {
    if (!this.db) {
      await this.initializeDB();
    }

    const recordingId = `audio_${encounterId}_${Date.now()}`;
    const duration = await this.estimateAudioDuration(audioBlob);
    
    const entry: AudioArchiveEntry = {
      id: recordingId,
      encounterId,
      timestamp: new Date().toISOString(),
      audioBlob,
      duration,
      size: audioBlob.size,
      metadata: {
        recordingQuality: this.assessAudioQuality(audioBlob),
        hasTranscript: false,
        ...metadata
      }
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(entry);

      request.onsuccess = () => {
        logger.info('AudioArchive', `Stored audio recording: ${recordingId}`, {
          encounterId,
          duration,
          size: audioBlob.size
        });
        resolve(recordingId);
      };

      request.onerror = () => {
        logger.error('AudioArchive', 'Failed to store audio recording', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Retrieve audio recording by ID
   */
  async getRecording(recordingId: string): Promise<AudioArchiveEntry | null> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(recordingId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        logger.error('AudioArchive', 'Failed to retrieve audio recording', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all recordings for a specific encounter
   */
  async getRecordingsForEncounter(encounterId: string): Promise<AudioArchiveEntry[]> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('encounterId');
      const request = index.getAll(encounterId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        logger.error('AudioArchive', 'Failed to retrieve encounter recordings', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get audio archive metrics
   */
  async getArchiveMetrics(): Promise<AudioMetrics> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const recordings = request.result || [];
        
        const metrics: AudioMetrics = {
          totalRecordings: recordings.length,
          totalSize: recordings.reduce((sum, r) => sum + r.size, 0),
          averageDuration: recordings.length > 0 
            ? recordings.reduce((sum, r) => sum + r.duration, 0) / recordings.length 
            : 0
        };

        if (recordings.length > 0) {
          const sortedByDate = recordings.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          metrics.oldestRecording = sortedByDate[0].timestamp;
        }

        resolve(metrics);
      };

      request.onerror = () => {
        logger.error('AudioArchive', 'Failed to retrieve archive metrics', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Export audio recording for external use
   */
  async exportRecording(recordingId: string, format: 'blob' | 'url' = 'blob'): Promise<Blob | string> {
    const entry = await this.getRecording(recordingId);
    
    if (!entry) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (format === 'url') {
      return URL.createObjectURL(entry.audioBlob);
    }

    return entry.audioBlob;
  }

  /**
   * Update recording metadata (e.g., when transcript is generated)
   */
  async updateRecordingMetadata(
    recordingId: string, 
    metadata: Partial<AudioArchiveEntry['metadata']>
  ): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // First get the existing entry
      const getRequest = store.get(recordingId);
      
      getRequest.onsuccess = () => {
        const entry = getRequest.result;
        if (!entry) {
          reject(new Error(`Recording not found: ${recordingId}`));
          return;
        }

        // Update metadata
        entry.metadata = { ...entry.metadata, ...metadata };
        
        // Save updated entry
        const putRequest = store.put(entry);
        
        putRequest.onsuccess = () => {
          logger.info('AudioArchive', `Updated recording metadata: ${recordingId}`, metadata);
          resolve();
        };

        putRequest.onerror = () => {
          logger.error('AudioArchive', 'Failed to update recording metadata', putRequest.error);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        logger.error('AudioArchive', 'Failed to retrieve recording for update', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * Clean up old recordings based on retention policy
   */
  async cleanupOldRecordings(retentionDays: number = 90): Promise<number> {
    if (!this.db) {
      await this.initializeDB();
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate.toISOString()));
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          logger.info('AudioArchive', `Cleaned up ${deletedCount} old recordings`, {
            retentionDays,
            cutoffDate: cutoffDate.toISOString()
          });
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        logger.error('AudioArchive', 'Failed to cleanup old recordings', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Estimate audio duration from blob (rough calculation)
   */
  private async estimateAudioDuration(audioBlob: Blob): Promise<number> {
    // This is a rough estimation. For precise duration, we'd need to decode the audio
    // For WebM audio at ~128kbps: roughly 16KB per second
    const estimatedBitrate = 16000; // bytes per second
    return Math.round(audioBlob.size / estimatedBitrate);
  }

  /**
   * Assess audio quality based on file size and type
   */
  private assessAudioQuality(audioBlob: Blob): 'high' | 'medium' | 'low' {
    const sizePerSecond = audioBlob.size / this.estimateAudioDuration(audioBlob);
    
    if (sizePerSecond > 20000) return 'high';    // >20KB/sec
    if (sizePerSecond > 10000) return 'medium';  // 10-20KB/sec
    return 'low';                                // <10KB/sec
  }

  /**
   * Create downloadable backup of recordings
   */
  async createBackupArchive(encounterId?: string): Promise<Blob> {
    const recordings = encounterId 
      ? await this.getRecordingsForEncounter(encounterId)
      : await this.getAllRecordings();

    // Create a simple manifest for the backup
    const manifest = {
      created: new Date().toISOString(),
      version: '1.0',
      recordings: recordings.map(r => ({
        id: r.id,
        encounterId: r.encounterId,
        timestamp: r.timestamp,
        duration: r.duration,
        size: r.size,
        metadata: r.metadata
      }))
    };

    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/json'
    });

    // For now, return just the manifest. In a full implementation,
    // we'd create a ZIP file with all audio files and manifest
    return manifestBlob;
  }

  /**
   * Get all recordings (internal helper)
   */
  private async getAllRecordings(): Promise<AudioArchiveEntry[]> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Export singleton instance
export const audioArchive = new AudioArchiveService();