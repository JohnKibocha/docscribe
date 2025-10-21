/**
 * @fileoverview TypeScript declarations for Chrome's built-in AI APIs.
 * 
 * These declarations provide type safety for the experimental Chrome AI APIs
 * including LanguageModel, Summarizer, Translator, and related interfaces.
 * 
 * IMPORTANT: These APIs are experimental and may change. Always check the
 * official Chrome documentation for the latest API surface.
 *
 * @see https://developer.chrome.com/docs/ai/built-in-apis
 */

/**
 * Availability status for Chrome AI features.
 */
type AIAvailabilityStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

/**
 * Configuration for AI session creation.
 */
interface AISessionOptions {
  /**
   * Output language code (en, es, or ja).
   */
  outputLanguage?: 'en' | 'es' | 'ja';

  /**
   * System prompt to guide AI behavior.
   */
  systemPrompt?: string;

  /**
   * Temperature for response randomness (0.0 to 1.0).
   */
  temperature?: number;

  /**
   * Top-K sampling parameter.
   */
  topK?: number;

  /**
   * Optional monitor callback for download progress.
   */
  monitor?: (monitor: AIDownloadMonitor) => void;
}

/**
 * Download progress monitor for model downloads.
 */
interface AIDownloadMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: AIDownloadProgressEvent) => void
  ): void;
}

/**
 * Download progress event.
 */
interface AIDownloadProgressEvent extends Event {
  /**
   * Progress as a decimal between 0 and 1.
   */
  loaded: number;
}

/**
 * Prompt constraint for structured output.
 */
interface AIPromptConstraint {
  /**
   * Response type constraint (currently only 'json' is supported).
   */
  type: 'json';
}

/**
 * Options for the prompt method.
 */
interface AIPromptOptions {
  /**
   * Additional input data (e.g., images, audio blobs).
   */
  input?: Blob[];

  /**
   * Response format constraint.
   */
  responseConstraint?: AIPromptConstraint;
}

/**
 * AI session interface for the LanguageModel API.
 */
interface AILanguageModelSession {
  /**
   * Sends a prompt to the AI and returns the response.
   * 
   * @param prompt - The text prompt to send.
   * @param options - Optional configuration for the prompt.
   * @returns Promise that resolves to the AI's response as a string.
   */
  prompt(prompt: string, options?: AIPromptOptions): Promise<string>;

  /**
   * Destroys the session and frees resources.
   */
  destroy(): Promise<void>;
}

/**
 * Global LanguageModel interface.
 */
interface LanguageModelStatic {
  /**
   * Checks the availability status of the language model.
   * 
   * @returns Promise that resolves to the availability status.
   */
  availability(): Promise<AIAvailabilityStatus>;

  /**
   * Creates a new AI session.
   * 
   * @param options - Configuration options for the session.
   * @returns Promise that resolves to a new session instance.
   */
  create(options?: AISessionOptions): Promise<AILanguageModelSession>;
}

/**
 * Declare the global LanguageModel object.
 */
declare const LanguageModel: LanguageModelStatic;
