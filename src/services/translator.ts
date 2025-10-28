/**
 * @fileoverview Chrome Translator API service for multi-language support.
 *
 * @description
 * This module provides robust on-device translation capabilities by leveraging Chrome's
 * built-in Translator API. It is designed to facilitate multi-language support
 * within DocScribe, particularly for translating clinical summaries.
 *
 * @module services/translator
 */

import type { MedicalNote, ClinicalSummary, TranscriptSegment, NoteSection } from '../types';

/**
 * Defines the structure for a supported language option.
 */
export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

/**
 * A list of languages supported by the translator service.
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
];

/**
 * Checks if the Translator API is available in the browser.
 * 
 * @returns {Promise<boolean>} True if Translator API is available and ready
 */
export async function isTranslatorAvailable(): Promise<boolean> {
  if (typeof window.Translator === 'undefined') {
    console.warn('Chrome AI: Translator not found in global scope');
    return false;
  }
  try {
    // Check availability for English to Spanish translation as a test
    // The API requires source and target language parameters
    const availability = await window.Translator.availability({
      sourceLanguage: 'en',
      targetLanguage: 'es'
    });
    return availability === 'available' || availability === 'downloadable';
  } catch (error) {
    console.error('Translator availability check failed:', error);
    return false;
  }
}

/**
 * Checks if translation is available for a specific language pair.
 * 
 * @param sourceLanguage - Source language code
 * @param targetLanguage - Target language code
 * @returns {Promise<'available' | 'downloadable' | 'unavailable'>} Availability status
 */
export async function checkLanguagePairAvailability(
  sourceLanguage: string,
  targetLanguage: string
): Promise<'available' | 'downloadable' | 'unavailable'> {
  if (typeof window.Translator === 'undefined') {
    return 'unavailable';
  }
  
  try {
    return await window.Translator.availability({
      sourceLanguage,
      targetLanguage
    });
  } catch (error) {
    console.error(`Failed to check availability for ${sourceLanguage} -> ${targetLanguage}:`, error);
    return 'unavailable';
  }
}

/**
 * Creates a cached translator session for repeated use.
 * 
 * This function implements session caching to improve performance when
 * translating multiple pieces of content with the same language pair.
 * 
 * @param sourceLanguage - Source language code
 * @param targetLanguage - Target language code
 * @returns {Promise<any>} A cached translator session
 * 
 * @throws {Error} If Translator API is not available
 */
const translatorCache = new Map<string, any>();

export async function getCachedTranslator(
  sourceLanguage: string = 'en',
  targetLanguage: string
): Promise<any> {
  const cacheKey = `${sourceLanguage}-${targetLanguage}`;
  
  if (translatorCache.has(cacheKey)) {
    return translatorCache.get(cacheKey);
  }

  if (!(await isTranslatorAvailable())) {
    throw new Error('Translator API is not available. Please ensure Chrome 138+ with built-in AI features.');
  }

  try {
    if (!window.Translator) {
      throw new Error('Translator API is not available');
    }
    const translator = await window.Translator.create({
      sourceLanguage,
      targetLanguage
    });
    translatorCache.set(cacheKey, translator);
    return translator;
  } catch (error) {
    console.error(`Failed to create translator (${sourceLanguage} -> ${targetLanguage}):`, error);
    throw new Error(`Translator creation failed: ${(error as Error).message}`);
  }
}

/**
 * Clears the translator cache and destroys all sessions.
 * 
 * Call this function to free resources when translation is complete
 * or when switching to different language pairs.
 */
export async function clearTranslatorCache(): Promise<void> {
  for (const [key, translator] of translatorCache.entries()) {
    try {
      if (translator && typeof translator.destroy === 'function') {
        await translator.destroy();
      }
    } catch (error) {
      console.warn(`Failed to destroy translator ${key}:`, error);
    }
  }
  translatorCache.clear();
}

/**
 * Translates text using the built-in Translator API with caching.
 *
 * @param text The text to translate.
 * @param targetLanguage The language to translate to.
 * @param sourceLanguage The language to translate from (defaults to 'en').
 * @returns The translated text.
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage = 'en'
): Promise<string> {
  if (!text || !targetLanguage || sourceLanguage === targetLanguage) {
    return text;
  }

  try {
    const translator = await getCachedTranslator(sourceLanguage, targetLanguage);
    const translatedText = await translator.translate(text);
    return translatedText;
  } catch (error) {
    console.error('Translation failed:', error);
    throw new Error(`Failed to translate text to ${targetLanguage}: ${(error as Error).message}`);
  }
}

/**
 * Translates a patient summary with medical context preservation.
 * 
 * This function uses specialized prompting to ensure medical accuracy
 * and patient-friendly language preservation during translation.
 * 
 * @param summaryText - The patient summary text to translate
 * @param targetLanguage - Target language code
 * @param sourceLanguage - Source language code (defaults to 'en')
 * @returns {Promise<string>} The translated patient summary
 * 
 * @throws {Error} If translation fails or API is unavailable
 */
export async function translatePatientSummary(
  summaryText: string,
  targetLanguage: string,
  sourceLanguage: string = 'en'
): Promise<string> {
  if (!summaryText || sourceLanguage === targetLanguage) {
    return summaryText;
  }

  try {
    const translator = await getCachedTranslator(sourceLanguage, targetLanguage);
    
    // Add medical translation context to preserve accuracy
    const contextualText = `Medical Patient Summary (translate while preserving medical accuracy and patient-friendly tone):

${summaryText}`;

    const translatedText = await translator.translate(contextualText);
    
    // Remove the context prefix from the translation
    return translatedText.replace(/^.*?Summary.*?:/i, '').trim();
    
  } catch (error) {
    console.error('Patient summary translation failed:', error);
    throw new Error(`Failed to translate patient summary to ${targetLanguage}: ${(error as Error).message}`);
  }
}

/**
 * Translates clinical content while preserving medical terminology.
 * 
 * @param clinicalText - The clinical text to translate
 * @param targetLanguage - Target language code
 * @param sourceLanguage - Source language code (defaults to 'en')
 * @returns {Promise<string>} The translated clinical text
 */
export async function translateClinicalText(
  clinicalText: string,
  targetLanguage: string,
  sourceLanguage: string = 'en'
): Promise<string> {
  if (!clinicalText || sourceLanguage === targetLanguage) {
    return clinicalText;
  }

  try {
    const translator = await getCachedTranslator(sourceLanguage, targetLanguage);
    
    // Add clinical context to preserve medical terminology
    const contextualText = `Clinical Medical Text (preserve medical terminology accuracy):

${clinicalText}`;

    const translatedText = await translator.translate(contextualText);
    return translatedText.replace(/^.*?Text.*?:/i, '').trim();
    
  } catch (error) {
    console.error('Clinical text translation failed:', error);
    throw new Error(`Failed to translate clinical text to ${targetLanguage}: ${(error as Error).message}`);
  }
}

/**
 * Translates the relevant fields of a medical note.
 *
 * @param note The medical note to translate.
 * @param targetLanguage The language to translate the note to.
 * @returns A new medical note object with translated fields.
 */
export async function translateMedicalNote(
  note: MedicalNote,
  targetLanguage: string
): Promise<MedicalNote> {
  const translatedNote: MedicalNote = JSON.parse(JSON.stringify(note));

  // 1. Translate Clinical Summary
  const summary = translatedNote.clinicalSummary;
  const translatedSummary: ClinicalSummary = {
    ...summary,
    chiefComplaint: await translateText(summary.chiefComplaint, targetLanguage),
    keyFindings: await translateText(summary.keyFindings, targetLanguage),
    plan: await translateText(summary.plan, targetLanguage),
    followUp: summary.followUp ? await translateText(summary.followUp, targetLanguage) : '',
  };
  translatedNote.clinicalSummary = translatedSummary;

  // 2. Translate Refined Note Sections
  if (translatedNote.refinedNote) {
    const translatedSections: NoteSection[] = await Promise.all(
      translatedNote.refinedNote.sections.map(async (section) => ({
        ...section,
        body: await translateText(section.body, targetLanguage),
      }))
    );
    translatedNote.refinedNote.sections = translatedSections;
  }

  // 3. Translate Labeled Transcript
  if (translatedNote.labeledTranscript) {
    const translatedLabeledTranscript: TranscriptSegment[] = await Promise.all(
      translatedNote.labeledTranscript.map(async (segment) => ({
        ...segment,
        text: await translateText(segment.text, targetLanguage),
      }))
    );
    translatedNote.labeledTranscript = translatedLabeledTranscript;
  }

  // 4. Set translation metadata
  translatedNote.translatedSummary = Object.values(translatedSummary).join('\n\n');
  translatedNote.targetLanguage = targetLanguage;

  return translatedNote;
}

/**
 * Gets the English name of a language from its code.
 *
 * @param code The language code.
 * @returns The English name of the language.
 */
export function getLanguageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code)?.name || code;
}
