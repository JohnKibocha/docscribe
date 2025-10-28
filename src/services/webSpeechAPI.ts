/**
 * @fileoverview Stable Web Speech API service that prevents Chrome Canary crashes.
 * 
 * CRITICAL: This implementation uses interimResults=false to prevent word-by-word
 * processing that floods the browser with events and causes crashes. The stable
 * pattern processes only final chunks when the user pauses, delivering manageable
 * "dirty chunks" to the AI pipeline.
 * 
 * @module services/webSpeechAPI
 */

import { logger } from '../utils/logger';

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

/**
 * Represents a stable chunk of finalized speech recognition result.
 * This is only fired when the user pauses, preventing browser flooding.
 */
interface FinalChunkResult {
  /** The complete finalized text chunk from the user's pause */
  transcript: string;
  /** Confidence score from the speech recognition engine */
  confidence: number;
  /** Always true - we only process final chunks for stability */
  isFinal: true;
}

/**
 * Configuration options for the stable WebSpeech handler.
 * CRITICAL: interimResults is hardcoded to false for stability.
 */
interface StableWebSpeechOptions {
  /** Keep listening continuously (recommended: true) */
  continuous: boolean;
  /** Language code for recognition (default: 'en-US') */
  language: string;
  /** Maximum number of alternative transcriptions */
  maxAlternatives: number;
}

/**
 * Stable WebSpeechAPI implementation that prevents Chrome Canary crashes.
 * CRITICAL: interimResults=false prevents word-by-word flooding that causes browser crashes.
 * 
 * This service processes speech in stable chunks delivered when the user pauses,
 * providing manageable input to the AI pipeline without overwhelming the browser.
 */
export class StableWebSpeechHandler {
  private recognition: any = null;
  private isRecording = false;
  private shouldContinue = false;
  private lastErrorType: string | null = null; // Track last error to handle restarts properly
  
  // Callbacks for chunk processing
  private onChunkReceived: ((chunk: FinalChunkResult) => void) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  /**
   * Check if Web Speech API is available in this browser.
   * @returns {boolean} True if WebSpeech is supported, false otherwise.
   */
  static isSupported(): boolean {
    const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    logger.info('StableWebSpeech', 'Browser support check', { hasWebSpeech });
    return hasWebSpeech;
  }

  /**
   * Creates a new stable WebSpeech handler with crash-prevention settings.
   * 
   * @param options - Configuration options for speech recognition
   * @throws {Error} If Web Speech API is not supported in this browser
   */
  constructor(options: Partial<StableWebSpeechOptions> = {}) {
    if (!StableWebSpeechHandler.isSupported()) {
      throw new Error('Web Speech API not supported in this browser');
    }

    const defaultOptions: StableWebSpeechOptions = {
      continuous: true,
      language: 'en-US',
      maxAlternatives: 1
    };

    const config = { ...defaultOptions, ...options };
    this.initializeSpeechRecognition(config);
    
    logger.info('StableWebSpeech', 'Service initialized with stable settings', config);
  }

  /**
   * Initialize the speech recognition with stable settings that prevent crashes.
   * CRITICAL: These exact settings prevent Chrome Canary crashes.
   * 
   * @param config - The validated configuration options
   */
  private initializeSpeechRecognition(config: StableWebSpeechOptions): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // CRITICAL: These exact settings prevent crashes
    this.recognition.continuous = config.continuous;
    this.recognition.interimResults = false; // NEVER set to true - causes crashes
    this.recognition.lang = config.language;
    this.recognition.maxAlternatives = config.maxAlternatives;

    this.setupEventHandlers();
  }

  /**
   * Set up stable event handlers that process only final chunks.
   * This prevents the word-by-word flooding that crashes Chrome Canary.
   */
  private setupEventHandlers(): void {
    this.recognition.onstart = () => {
      this.isRecording = true;
      logger.info('StableWebSpeech', 'Started listening');
      this.onStatusChange?.('Listening... (Speak now)');
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      logger.info('StableWebSpeech', 'Speech recognition ended');
      
      // Auto-restart if we should continue listening AND it wasn't a no-speech error
      if (this.shouldContinue && this.recognition) {
        if (this.lastErrorType === 'no-speech') {
          // Don't auto-restart immediately after no-speech errors
          // This prevents the infinite restart loop
          logger.debug('StableWebSpeech', 'Not restarting due to no-speech error');
          this.onStatusChange?.('Listening... (no speech - waiting)');
          // Clear the error after a delay and then restart
          setTimeout(() => {
            if (this.shouldContinue && this.lastErrorType === 'no-speech') {
              this.lastErrorType = null; // Clear the error
              this.recognition.start();
            }
          }, 2000); // Wait 2 seconds before restart
        } else {
          // Normal restart for other cases
          logger.debug('StableWebSpeech', 'Auto-restarting recognition');
          this.onStatusChange?.('Auto-restarting speech recognition...');
          setTimeout(() => {
            if (this.shouldContinue) {
              this.lastErrorType = null; // Clear any previous error
              this.recognition.start();
            }
          }, 100);
        }
      } else {
        this.onStatusChange?.('Recording stopped');
      }
    };

    this.recognition.onerror = (event: any) => {
      const errorMessage = `Speech recognition error: ${event.error}`;
      this.lastErrorType = event.error; // Track the error type for restart logic
      logger.error('StableWebSpeech', 'Recognition error', new Error(errorMessage));
      
      // CRITICAL: Handle different error types appropriately
      if (event.error === 'no-speech') {
        // no-speech is normal when there's silence - don't treat as error
        logger.debug('StableWebSpeech', 'No speech detected - normal silence period');
        this.onStatusChange?.('Listening... (no speech detected)');
        // Don't call onError callback for no-speech - it's normal
      } else if (event.error === 'network') {
        // Network errors during auto-restart are transient
        logger.debug('StableWebSpeech', 'Network error - likely during restart');
        this.onStatusChange?.('Reconnecting...');
        // Don't call onError callback for network errors during restart
      } else {
        // Real errors that need user attention
        this.onError?.(errorMessage);
        this.onStatusChange?.(`Error: ${event.error}`);
      }
    };

    // CRITICAL: Only process final results to prevent crashes
    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      
      // Only process final results - this prevents browser flooding
      if (result.isFinal) {
        const finalChunk = result[0].transcript.trim();
        const confidence = result[0].confidence || 0;
        
        if (finalChunk) {
          logger.debug('StableWebSpeech', 'Final chunk received', { 
            chunk: finalChunk, 
            confidence 
          });
          
          // Deliver stable chunk to the AI pipeline
          this.onChunkReceived?.({
            transcript: finalChunk,
            confidence,
            isFinal: true
          });
        }
      }
    };
  }

  /**
   * Start listening for speech with stable settings.
   * This begins the continuous listening mode that delivers chunks on user pauses.
   */
  start(): void {
    if (this.isRecording) {
      logger.warn('StableWebSpeech', 'Already recording');
      return;
    }

    try {
      this.shouldContinue = true;
      this.lastErrorType = null; // Clear any previous error state
      this.recognition.start();
      logger.info('StableWebSpeech', 'Started continuous listening');
    } catch (error) {
      logger.error('StableWebSpeech', 'Failed to start recognition', error as Error);
      this.onError?.(`Failed to start: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Stop listening for speech and cease auto-restart.
   */
  stop(): void {
    this.shouldContinue = false;
    
    if (!this.isRecording) {
      logger.warn('StableWebSpeech', 'Not currently recording');
      return;
    }

    try {
      this.recognition.stop();
      logger.info('StableWebSpeech', 'Stopped listening');
    } catch (error) {
      logger.error('StableWebSpeech', 'Failed to stop recognition', error as Error);
      this.onError?.(`Failed to stop: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Check if currently recording.
   * @returns {boolean} True if actively listening for speech
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Set callback for when a final speech chunk is received.
   * This is the primary way to receive stable transcript chunks for AI processing.
   * 
   * @param callback - Function to call when a final chunk is available
   */
  onChunk(callback: (chunk: FinalChunkResult) => void): void {
    this.onChunkReceived = callback;
  }

  /**
   * Set callback for status changes (listening, stopped, error).
   * 
   * @param callback - Function to call when status changes
   */
  onStatus(callback: (status: string) => void): void {
    this.onStatusChange = callback;
  }

  /**
   * Set callback for error handling.
   * 
   * @param callback - Function to call when errors occur
   */
  onErrorCallback(callback: (error: string) => void): void {
    this.onError = callback;
  }

  /**
   * Clean up resources and stop recognition.
   */
  destroy(): void {
    if (this.isRecording) {
      this.stop();
    }
    
    this.onChunkReceived = null;
    this.onStatusChange = null;
    this.onError = null;
    
    logger.info('StableWebSpeech', 'Service destroyed');
  }
}

/**
 * Create a stable Web Speech service instance optimized for medical dictation.
 * This factory function provides the recommended settings for healthcare use.
 * 
 * @returns {StableWebSpeechHandler} A configured stable speech handler
 */
export function createStableMedicalSpeechService(): StableWebSpeechHandler {
  return new StableWebSpeechHandler({
    continuous: true,
    language: 'en-US',
    maxAlternatives: 1
  });
}

/**
 * Quick function to check Web Speech API availability.
 * 
 * @returns {boolean} True if WebSpeech is available in this browser
 */
export function isWebSpeechAvailable(): boolean {
  return StableWebSpeechHandler.isSupported();
}