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
 * Checks if the built-in Translator API is available.
 *
 * @returns {Promise<boolean>} True if the API is available.
 */
export async function isTranslatorAvailable(): Promise<boolean> {
  if (typeof window.Translator === 'undefined') {
    return false;
  }
  try {
    const availability = await window.Translator.availability();
    return availability === 'readily' || availability === 'after-download';
  } catch {
    return false;
  }
}

/**
 * Translates text using the built-in Translator API.
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
  if (!(await isTranslatorAvailable())) {
    throw new Error('Translator API is not available.');
  }

  if (!text || !targetLanguage || sourceLanguage === targetLanguage) {
    return text;
  }

  try {
    if (!window.Translator) {
      throw new Error('Translator API is not available');
    }
    const translator = await window.Translator.create(sourceLanguage, targetLanguage);
    const translatedText = await translator.translate(text);
    translator.destroy();
    return translatedText;
  } catch (error) {
    console.error('Translation failed:', error);
    throw new Error(`Failed to translate text to ${targetLanguage}.`);
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
