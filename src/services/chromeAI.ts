/**
 * @fileoverview Streamlined Chrome AI service using correct LanguageModel API patterns.
 * 
 * CRITICAL: This service uses the correct LanguageModel API pattern from download-gemini-nano.html
 * instead of the deprecated ai.languageModel pattern. It provides utility functions for
 * checking AI availability and creating sessions with proper error handling.
 * 
 * NOTE: The actual AI processing pipeline now runs in the Web Worker (aiWorker.ts) to
 * prevent UI freezing. This service only provides availability checking and session
 * creation helpers for components that need direct AI access.
 * 
 * @module services/chromeAI
 */

// CRITICAL: Use correct Chrome AI API declarations from download-gemini-nano.html
declare const LanguageModel: any;
declare const Summarizer: any;

/**
 * Available states for Chrome AI LanguageModel.
 * Based on the updated Chrome AI API documentation.
 */
type AIAvailabilityStatus = 'readily-available' | 'available' | 'after-download' | 'no';

/**
 * Configuration options for creating LanguageModel sessions.
 */
interface LanguageModelConfig {
  /** System prompt to guide the AI's behavior */
  systemPrompt: string;
  /** Temperature for response randomness (if supported) */
  temperature?: number;
  /** Maximum tokens for response length (if supported) */
  maxTokens?: number;
}

/**
 * Configuration options for creating Summarizer sessions.
 */
interface SummarizerConfig {
  /** Type of summarization: 'key-points' | 'tl;dr' | 'teaser' | 'headline' */
  type: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
  /** Output format: 'markdown' | 'plain-text' */
  format: 'markdown' | 'plain-text';
  /** Length of summary: 'short' | 'medium' | 'long' */
  length: 'short' | 'medium' | 'long';
}

/**
 * Asynchronously checks if the Chrome AI LanguageModel is available and ready for use.
 * 
 * This function uses the correct availability check pattern from download-gemini-nano.html
 * and provides detailed status information for troubleshooting.
 * 
 * @returns {Promise<boolean>} True if LanguageModel is available, false otherwise
 * 
 * @example
 * ```typescript
 * const isAvailable = await isChromeAIAvailable();
 * if (isAvailable) {
 *   // Proceed with AI operations
 * } else {
 *   // Show fallback UI or error message
 * }
 * ```
 */
export async function isChromeAIAvailable(): Promise<boolean> {
  try {
    // Check if LanguageModel is defined in global scope
    if (typeof LanguageModel === 'undefined') {
      console.warn('Chrome AI: LanguageModel not found in global scope');
      return false;
    }

    // Check availability using correct API pattern
    const availability = await LanguageModel.availability();
    console.log('Chrome AI availability status:', availability);
    
    // Consider both 'readily-available' and 'available' as usable
    return availability === 'readily-available' || availability === 'available';
    
  } catch (error) {
    console.error('Chrome AI availability check failed:', error);
    return false;
  }
}

/**
 * Gets detailed availability status for Chrome AI LanguageModel.
 * 
 * This provides more granular information than the boolean check,
 * useful for showing specific user guidance.
 * 
 * @returns {Promise<AIAvailabilityStatus>} The detailed availability status
 * 
 * @throws {Error} If LanguageModel API is not available
 */
export async function getChromeAIStatus(): Promise<AIAvailabilityStatus> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error('LanguageModel API not found. Please ensure Chrome AI flags are enabled.');
  }

  try {
    const status = await LanguageModel.availability();
    return status as AIAvailabilityStatus;
  } catch (error) {
    console.error('Failed to get Chrome AI status:', error);
    throw new Error(`Chrome AI status check failed: ${(error as Error).message}`);
  }
}

/**
 * Creates a new LanguageModel session with the specified configuration.
 * 
 * This function uses the correct session creation pattern from download-gemini-nano.html
 * and includes proper error handling for common failure modes.
 * 
 * @param config - Configuration options for the LanguageModel session
 * @returns {Promise<any>} A configured LanguageModel session
 * 
 * @throws {Error} If LanguageModel is not available or session creation fails
 * 
 * @example
 * ```typescript
 * const session = await createLanguageModelSession({
 *   systemPrompt: 'You are a helpful medical AI assistant.'
 * });
 * const response = await session.prompt('Explain hypertension');
 * await session.destroy();
 * ```
 */
export async function createLanguageModelSession(config: LanguageModelConfig): Promise<any> {
  // Ensure LanguageModel is available
  const isAvailable = await isChromeAIAvailable();
  if (!isAvailable) {
    throw new Error('Chrome AI LanguageModel is not available. Please check your browser settings.');
  }

  try {
    // Create session using correct API pattern
    const session = await LanguageModel.create({
      systemPrompt: config.systemPrompt,
      // Include optional parameters if provided
      ...(config.temperature && { temperature: config.temperature }),
      ...(config.maxTokens && { maxTokens: config.maxTokens })
    });

    console.log('LanguageModel session created successfully');
    return session;
    
  } catch (error) {
    console.error('Failed to create LanguageModel session:', error);
    throw new Error(`Session creation failed: ${(error as Error).message}`);
  }
}

/**
 * Checks if the Chrome AI Summarizer is available.
 * 
 * @returns {Promise<boolean>} True if Summarizer is available, false otherwise
 */
export async function isSummarizerAvailable(): Promise<boolean> {
  try {
    if (typeof Summarizer === 'undefined') {
      console.warn('Chrome AI: Summarizer not found in global scope');
      return false;
    }

    // The Summarizer API may not have an availability() method in all versions
    // So we try to create a test instance to check availability
    try {
      const testSummarizer = await Summarizer.create({
        type: 'key-points',
        format: 'plain-text',
        length: 'short'
      });
      await testSummarizer.destroy();
      return true;
    } catch {
      return false;
    }
    
  } catch (error) {
    console.error('Summarizer availability check failed:', error);
    return false;
  }
}

/**
 * Creates a new Summarizer session with the specified configuration.
 * 
 * @param config - Configuration options for the Summarizer session
 * @returns {Promise<any>} A configured Summarizer session
 * 
 * @throws {Error} If Summarizer is not available or session creation fails
 * 
 * @example
 * ```typescript
 * const summarizer = await createSummarizerSession({
 *   type: 'key-points',
 *   format: 'markdown',
 *   length: 'medium'
 * });
 * const summary = await summarizer.summarize(longText);
 * await summarizer.destroy();
 * ```
 */
export async function createSummarizerSession(config: SummarizerConfig): Promise<any> {
  if (typeof Summarizer === 'undefined') {
    throw new Error('Summarizer API not found. Please ensure Chrome AI flags are enabled.');
  }

  try {
    const summarizer = await Summarizer.create({
      type: config.type,
      format: config.format,
      length: config.length
    });

    console.log('Summarizer session created successfully');
    return summarizer;
    
  } catch (error) {
    console.error('Failed to create Summarizer session:', error);
    throw new Error(`Summarizer creation failed: ${(error as Error).message}`);
  }
}

/**
 * Generates a patient-friendly summary of a medical note using Chrome AI Summarizer.
 * 
 * This function creates a concise, non-technical summary suitable for patient
 * understanding. It processes the complete medical note and extracts key points
 * in plain language, avoiding medical jargon where possible.
 * 
 * @param medicalNoteText - The complete medical note text to summarize
 * @param encounterType - Type of medical encounter (e.g., 'Consultation', 'Emergency')
 * @returns {Promise<string>} A patient-friendly summary of the medical note
 * 
 * @throws {Error} If Summarizer is not available or summarization fails
 * 
 * @example
 * ```typescript
 * const noteText = 'Patient presents with chest pain...';
 * const summary = await generatePatientSummary(noteText, 'Emergency');
 * console.log('Patient summary:', summary);
 * ```
 */
export async function generatePatientSummary(
  medicalNoteText: string, 
  encounterType: string = 'General'
): Promise<string> {
  const isAvailable = await isSummarizerAvailable();
  if (!isAvailable) {
    throw new Error('Chrome AI Summarizer is not available. Patient summaries require Chrome 138+ with AI features enabled.');
  }

  if (!medicalNoteText || medicalNoteText.trim().length === 0) {
    throw new Error('Medical note text is required for summary generation.');
  }

  try {
    const summarizer = await createSummarizerSession({
      type: 'key-points',
      format: 'plain-text',
      length: 'medium'
    });

    // Prepare patient-friendly context for the summarizer
    const contextualNote = `Medical ${encounterType} Summary for Patient Review:

${medicalNoteText}

Please provide a clear, patient-friendly summary avoiding complex medical terminology.`;

    // Generate patient-friendly summary
    const summary = await summarizer.summarize(contextualNote);
    
    // Clean up the summarizer session
    await summarizer.destroy();
    
    // Post-process to ensure patient-friendly language
    return summary.trim();
    
  } catch (error) {
    console.error('Failed to generate patient summary:', error);
    
    // Provide specific error context for debugging
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('Medical note is too long for summarization. Please try with a shorter note.');
    }
    
    throw new Error(`Summary generation failed: ${(error as Error).message}`);
  }
}

/**
 * Generates a clinical summary optimized for healthcare professionals.
 * 
 * This function creates a concise clinical summary retaining medical terminology
 * and professional context, suitable for physician review and clinical handoffs.
 * 
 * @param medicalNoteText - The complete medical note text to summarize
 * @param encounterType - Type of medical encounter
 * @returns {Promise<string>} A clinical summary for healthcare professionals
 * 
 * @throws {Error} If Summarizer is not available or summarization fails
 */
export async function generateClinicalSummary(
  medicalNoteText: string,
  encounterType: string = 'General'
): Promise<string> {
  const isAvailable = await isSummarizerAvailable();
  if (!isAvailable) {
    throw new Error('Chrome AI Summarizer is not available for clinical summaries.');
  }

  try {
    const summarizer = await createSummarizerSession({
      type: 'key-points',
      format: 'markdown',
      length: 'short'
    });

    // Prepare clinical context for the summarizer
    const clinicalContext = `Clinical ${encounterType} Summary for Healthcare Provider Review:

${medicalNoteText}

Provide a concise clinical summary retaining medical terminology and key clinical details.`;

    const summary = await summarizer.summarize(clinicalContext);
    await summarizer.destroy();
    
    return summary.trim();
    
  } catch (error) {
    console.error('Failed to generate clinical summary:', error);
    throw new Error(`Clinical summary generation failed: ${(error as Error).message}`);
  }
}

/**
 * Utility function to check overall Chrome AI readiness.
 * 
 * This function checks both LanguageModel and Summarizer availability
 * and returns a comprehensive status report.
 * 
 * @returns {Promise<{languageModel: boolean, summarizer: boolean, ready: boolean}>} 
 *   Availability status for both AI services
 */
export async function getChromeAIReadiness(): Promise<{
  languageModel: boolean;
  summarizer: boolean;
  ready: boolean;
}> {
  const [languageModelReady, summarizerReady] = await Promise.all([
    isChromeAIAvailable(),
    isSummarizerAvailable()
  ]);

  return {
    languageModel: languageModelReady,
    summarizer: summarizerReady,
    ready: languageModelReady && summarizerReady
  };
}