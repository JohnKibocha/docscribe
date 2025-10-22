/**
 * @fileoverview TypeScript declarations for Chrome's built-in AI APIs.
 * 
 * @description
 * These declarations provide type safety and auto-completion for the experimental
 * Chrome AI APIs, including `LanguageModel`, `Translator`, and their related interfaces.
 * They are crucial for developing applications that leverage on-device AI capabilities
 * within the Chrome browser.
 *
 * @important
 * It is crucial to note that these APIs are experimental and subject to change without prior notice.
 * Developers should always consult the official Chrome documentation for the latest API surface,
 * behavior, and best practices to ensure compatibility and stability.
 *
 * @see https://developer.chrome.com/docs/ai/built-in-apis
 * @module types/chrome-ai
 */

/**
 * Represents the availability status of Chrome AI features or models.
 *
 * @description
 * This type reflects the actual string values returned by Chrome's internal AI APIs.
 * It indicates whether a model is ready for immediate use, requires a download, or is entirely unavailable.
 *
 * @property {'readily' | 'available' | 'after-download' | 'no'} status - The availability status.
 *   - `readily`: The AI model is available and ready for immediate use.
 *   - `available`: (Potentially older or alternative term for `readily`) The AI model is available.
 *   - `after-download`: The AI model is not currently present but can be downloaded by the browser.
 *   - `no`: The AI model is not available on the current device or browser configuration.
 */
type AIAvailabilityStatus = 'readily' | 'available' | 'after-download' | 'no';

/**
 * Defines the configuration options that can be passed when creating an AI session.
 * These options allow for fine-tuning the behavior and characteristics of the AI model's responses.
 */
interface AISessionOptions {
  /**
   * An optional system prompt to guide the AI's behavior, role, and output style.
   * This prompt is typically used to set the context or persona for the AI.
   * @type {string | undefined}
   */
  systemPrompt?: string;

  /**
   * Controls the randomness of the AI's output. A value between 0.0 and 1.0.
   * Lower values (e.g., 0.2) make the output more deterministic and focused.
   * Higher values (e.g., 0.8) encourage more creative and diverse responses.
   * @type {number | undefined}
   */
  temperature?: number;

  /**
   * The Top-K sampling parameter. This limits the number of highest-probability tokens
   * the model considers at each step when generating text. A lower `topK` value
   * (e.g., 1) results in more predictable output, while a higher value allows for more variety.
   * @type {number | undefined}
   */
  topK?: number;
}

/**
 * Represents an active language model session with the Chrome AI.
 * This interface provides methods to interact with the AI model, such as sending prompts.
 */
interface AILanguageModelSession {
  /**
   * Sends a text prompt to the AI model and asynchronously returns its generated response.
   *
   * @param {string} input - The text prompt to send to the AI model.
   * @returns {Promise<string>} A promise that resolves with the AI's generated text response.
   */
  prompt(input: string): Promise<string>;

  /**
   * Destroys the current AI language model session and releases any associated resources.
   * It is important to call this method when the session is no longer needed to prevent resource leaks.
   * @returns {void}
   */
  destroy(): void;
}

/**
 * Factory interface for creating on-device language translation sessions via Chrome AI.
 * This interface allows checking translation availability and initiating translation sessions.
 */
interface AITranslatorFactory {
  /**
   * Checks the availability of translation capabilities for a given source and target language pair.
   *
   * @param {string} sourceLanguage - The BCP 47 language tag of the source text (e.g., 'en', 'es').
   * @param {string} targetLanguage - The BCP 47 language tag of the desired target translation (e.g., 'fr', 'de').
   * @returns {Promise<AIAvailabilityStatus>} A promise that resolves with the availability status of the translation model for the specified languages.
   */
  canTranslate(
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<AIAvailabilityStatus>;

  /**
   * Creates a new translator session for a specific source and target language pair.
   *
   * @param {string} sourceLanguage - The BCP 47 language tag of the source text.
   * @param {string} targetLanguage - The BCP 47 language tag of the desired target translation.
   * @returns {Promise<AITranslator>} A promise that resolves with an `AITranslator` instance configured for the specified languages.
   */
  create(
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<AITranslator>;
}

/**
 * Represents an active translator session for performing text translations.
 * Once created, this session can be used to translate multiple text strings efficiently.
 */
interface AITranslator {
  /**
   * Translates the given text from the session's source language to its target language.
   *
   * @param {string} text - The text string to be translated.
   * @returns {Promise<string>} A promise that resolves with the translated text.
   */
  translate(text: string): Promise<string>;

  /**
   * Destroys the translator session and releases any associated resources.
   * It is important to call this method when the session is no longer needed.
   * @returns {void}
   */
  destroy(): void;
}

/**
 * Global declarations for Chrome's built-in AI APIs.
 *
 * @description
 * This `declare global` block makes the `LanguageModel` object and the `window.ai`
 * property available globally within the TypeScript environment, reflecting their
 * presence in the Chrome browser when AI features are enabled.
 */
declare global {
  /**
   * The global `LanguageModel` object provides the primary interface for interacting
   * with Chrome's built-in AI language model capabilities.
   */
  const LanguageModel: {
    /**
     * Asynchronously checks the availability status of the underlying language model.
     *
     * @returns {Promise<AIAvailabilityStatus>} A promise that resolves to an `AIAvailabilityStatus`
     * indicating whether the model is `readily` available, `after-download` available, or `no`t available.
     */
    availability(): Promise<AIAvailabilityStatus>;

    /**
     * Asynchronously creates a new language model session with optional configuration.
     *
     * @param {AISessionOptions} [options] - Optional configuration parameters for the AI session.
     * @returns {Promise<AILanguageModelSession>} A promise that resolves with a new `AILanguageModelSession` instance.
     */
    create(options?: AISessionOptions): Promise<AILanguageModelSession>;
  };

  /**
   * The `window.ai` object (optional) provides access to experimental Chrome AI features,
   * including `translator` and `languageModel` capabilities. This interface is included
   * for broader compatibility with potential legacy or alternative API access patterns.
   */
  interface Window {
    ai?: {
      /**
       * An optional factory for creating `AITranslator` instances.
       * @type {AITranslatorFactory | undefined}
       */
      translator?: AITranslatorFactory;
      /**
       * An optional object providing language model capabilities, potentially mirroring the global `LanguageModel`.
       * @type {object | undefined}
       */
      languageModel?: {
        /**
         * Asynchronously retrieves the capabilities and availability of the language model.
         * @returns {Promise<{ available: AIAvailabilityStatus }>} A promise resolving to an object indicating availability.
         */
        capabilities(): Promise<{ available: AIAvailabilityStatus }>;
        /**
         * Asynchronously creates a new language model session.
         * @param {AISessionOptions} [options] - Optional configuration for the session.
         * @returns {Promise<AILanguageModelSession>} A promise resolving to a new `AILanguageModelSession`.
         */
        create(options?: AISessionOptions): Promise<AILanguageModelSession>;
      };
    };
  }
}

export {};
