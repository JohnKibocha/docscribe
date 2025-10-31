/**
 * @fileoverview TypeScript declarations for Chrome's built-in AI APIs.
 * 
 * @description
 * These declarations provide type safety for the global `LanguageModel` and `Translator` APIs.
 *
 * @see https://developer.chrome.com/docs/ai/built-in-apis
 * @module types/chrome-ai
 */

declare global {
  /**
   * Represents the availability status of a built-in AI model.
   */
  type AIAvailabilityStatus = 'readily' | 'available' | 'after-download' | 'downloadable' | 'downloading' | 'no' | 'unavailable';

  /**
   * Represents an active language model session.
   */
  interface AILanguageModelSession {
    prompt(input: string, options?: { audio?: Blob; signal?: AbortSignal }): Promise<string>;
    destroy(): void;
  }

  /**
   * Input/Output specification for multimodal capabilities.
   */
  interface AIModalitySpec {
    type: 'text' | 'audio' | 'image';
    mimeTypes?: string[];
    languages?: string[];
  }

  /**
   * Options for creating a language model session.
   */
  interface AILanguageModelCreateOptions {
    systemPrompt?: string;
    outputLanguage?: string;
    expectedInputs?: AIModalitySpec[];
    expectedOutputs?: AIModalitySpec[];
    signal?: AbortSignal;
    monitor?: (monitor: any) => void;
  }

  /**
   * The global `LanguageModel` object for interacting with Chrome's built-in language model.
   */
  const LanguageModel: {
    availability(): Promise<AIAvailabilityStatus>;
    create(options?: AILanguageModelCreateOptions): Promise<AILanguageModelSession>;
  };

  /**
   * Represents an active translator session.
   */
  interface AITranslator {
    translate(text: string): Promise<string>;
    destroy(): void;
  }

  /**
   * The global `Translator` object for on-device text translation.
   */
  const Translator: {
    availability(): Promise<AIAvailabilityStatus>;
    create(sourceLanguage: string, targetLanguage: string): Promise<AITranslator>;
  };
}

export {};
