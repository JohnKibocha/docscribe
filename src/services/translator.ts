/**
 * @fileoverview Chrome Translator API service for multi-language support.
 *
 * @description
 * This module provides robust on-device translation capabilities by leveraging Chrome's
 * experimental Translator API. It is designed to facilitate multi-language support
 * within DocScribe, particularly for translating clinical summaries to assist
 * in international healthcare settings and communication with non-English-speaking patients.
 *
 * Key Features:
 * - **On-device Translation**: All translation processing occurs locally on the user's device,
 *   ensuring privacy and reducing latency.
 * - **Offline Capability**: After the initial model download, translation can be performed
 *   without an active internet connection.
 * - **Broad Language Support**: Designed to support a range of major world languages relevant
 *   to healthcare contexts.
 * - **Resource Management**: Includes proper session management and cleanup to optimize device resources.
 *
 * @module services/translator
 * @requires types/chrome-ai
 */

import type { MedicalNote } from '../types';

/**
 * Defines the structure for a supported language option within the translator service.
 */
export interface LanguageOption {
  /**
   * The ISO 639-1 language code (e.g., 'en' for English, 'es' for Spanish, 'zh' for Chinese).
   * This code is used to identify the language for translation operations.
   */
  code: string;

  /**
   * The display name of the language in English, suitable for user interface elements.
   * @example 'Spanish'
   */
  name: string;

  /**
   * The native name of the language, providing a better user experience for native speakers.
   * @example 'Español'
   */
  nativeName: string;
}

/**
 * A comprehensive list of languages supported by the DocScribe translator service.
 * These languages are selected based on their relevance in global healthcare contexts.
 * The list is ordered for consistent display in user interfaces.
 * @type {LanguageOption[]}
 */
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
];

/**
 * Checks the availability of the Chrome Translator API in the current browser environment.
 *
 * @remark
 * The Chrome Translator API is an experimental feature and its availability depends on
 * the Chrome version and whether specific feature flags are enabled.
 * This function should always be called before attempting any translation operations.
 *
 * @returns {boolean} `true` if the `window.ai.translator` object is available, `false` otherwise.
 */
export function isTranslatorAvailable(): boolean {
  return (
    'ai' in globalThis &&
    (globalThis as any).ai.translator &&
    typeof (globalThis as any).ai.translator === 'object'
  );
}

/**
 * Translates a given text string from a source language to a target language
 * using Chrome's on-device Translator API.
 *
 * @param {string} text - The input text to be translated.
 * @param {string} sourceLanguage - The ISO 639-1 language code of the original text.
 * @param {string} targetLanguage - The ISO 639-1 language code for the desired translation output.
 * 
 * @returns {Promise<string>} A promise that resolves with the translated text.
 * 
 * @throws {Error} If the API is unavailable, the language pair is unsupported, or the translation fails.
 */
export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  if (!isTranslatorAvailable()) {
    throw new Error('Chrome Translator API is not available. Please use a compatible browser with the required flags enabled.');
  }

  const ai = (globalThis as any).ai;
  
  try {
    const canTranslate = await ai.translator.canTranslate(sourceLanguage, targetLanguage);

    if (canTranslate === 'no') {
      throw new Error(`Translation from ${sourceLanguage} to ${targetLanguage} is not available on this device.`);
    }

    const translator = await ai.translator.create(sourceLanguage, targetLanguage);
    const translatedText = await translator.translate(text);
    translator.destroy();

    return translatedText;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Chrome Translator API') || error.message.includes('Translation from')) {
        throw error;
      }
      throw new Error(`Translation failed: ${error.message}`);
    }
    throw new Error('Translation failed due to an unknown error.');
  }
}

/**
 * Translates the content of an entire medical note into a specified target language.
 *
 * @description
 * This function ensures immutability by creating a deep copy of the original note before
 * adding the translated fields. It translates the clinical summary, the refined note (both full
 * content and individual sections), and the raw transcript. The original note is never modified.
 *
 * @param {MedicalNote} note - The original, immutable medical note to be translated.
 * @param {string} targetLanguage - The ISO 639-1 language code for the translation (e.g., "es").
 * @returns {Promise<MedicalNote>} A promise that resolves to a new `MedicalNote` object containing all original data plus the translations.
 * @throws {Error} If the Translator API is not available or if any part of the translation process fails.
 */
export async function translateMedicalNote(
  note: MedicalNote,
  targetLanguage: string
): Promise<MedicalNote> {
  if (!isTranslatorAvailable()) {
    throw new Error('Translator API not available');
  }

  // Create a deep copy to ensure the original note remains immutable.
  const translatedNote: MedicalNote = JSON.parse(JSON.stringify(note));

  try {
    const sourceLanguage = 'en'; // Assuming the original content is always English.

    // 1. Translate Clinical Summary (patient-facing)
    translatedNote.clinicalSummary.translatedChiefComplaint = 
      await translateText(note.clinicalSummary.chiefComplaint, sourceLanguage, targetLanguage);
    
    translatedNote.clinicalSummary.translatedKeyFindings = 
      await translateText(note.clinicalSummary.keyFindings, sourceLanguage, targetLanguage);
    
    translatedNote.clinicalSummary.translatedPlan = 
      await translateText(note.clinicalSummary.plan, sourceLanguage, targetLanguage);

    if (note.clinicalSummary.followUp) {
      translatedNote.clinicalSummary.translatedFollowUp = 
        await translateText(note.clinicalSummary.followUp, sourceLanguage, targetLanguage);
    }

    // 2. Translate Refined Note (provider-facing)
    translatedNote.refinedNote.translatedContent = 
      await translateText(note.refinedNote.content, sourceLanguage, targetLanguage);

    translatedNote.refinedNote.translatedSections = await Promise.all(
      note.refinedNote.sections.map(async (section) => ({
        title: section.title, // Section titles remain in the original language for consistency.
        body: await translateText(section.body, sourceLanguage, targetLanguage)
      }))
    );

    // 3. Translate Raw Transcript (optional, for documentation)
    translatedNote.translatedTranscript = await Promise.all(
      note.rawTranscript.map(async (segment) => ({
        ...segment,
        text: await translateText(segment.text, sourceLanguage, targetLanguage),
      }))
    );

    // 4. Set the translation language on the new note object.
    translatedNote.translationLanguage = targetLanguage;

    return translatedNote;
  } catch (error) {
    console.error('Full medical note translation failed:', error);
    throw new Error(`The translation process for the note failed for language code "${targetLanguage}".`);
  }
}

/**
 * Retrieves the human-readable English display name for a given ISO 639-1 language code.
 *
 * @param {string} code - The ISO 639-1 language code.
 * @returns {string} The English display name of the language, or the code itself if not found.
 */
export function getLanguageName(code: string): string {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === code);
  return language?.name || code;
}
