/**
 * @fileoverview Medical AI service integrating Summarizer and Translator APIs.
 * 
 * This module provides a unified interface for generating patient-friendly summaries
 * and translating medical content using Chrome's built-in AI APIs. It orchestrates
 * the Summarizer and Translator APIs to provide comprehensive medical AI capabilities.
 * 
 * @module infrastructure/ai/medicalAI
 */

import type { MedicalNote } from '../../shared/types';
import { generatePatientSummary, generateClinicalSummary, getChromeAIReadiness } from './chromeAI';
import { 
  translatePatientSummary, 
  translateClinicalText, 
  isTranslatorAvailable, 
  clearTranslatorCache,
  SUPPORTED_LANGUAGES,
  type LanguageOption 
} from '../translation/translator';

/**
 * Configuration for medical AI processing.
 */
export interface MedicalAIConfig {
  generateSummary: boolean;
  targetLanguage?: string;
  sourceLanguage?: string;
  summaryType: 'patient' | 'clinical' | 'both';
}

/**
 * Result from medical AI processing.
 */
export interface MedicalAIResult {
  patientSummary?: string;
  clinicalSummary?: string;
  translatedPatientSummary?: string;
  translatedClinicalSummary?: string;
  targetLanguage?: string;
  processingTime: number;
  warnings: string[];
}

/**
 * Checks the overall readiness of medical AI capabilities.
 * 
 * @returns {Promise<{ready: boolean, capabilities: object, warnings: string[]}>}
 *   Comprehensive status of all medical AI capabilities
 */
export async function getMedicalAIReadiness(): Promise<{
  ready: boolean;
  capabilities: {
    languageModel: boolean;
    summarizer: boolean;
    translator: boolean;
  };
  warnings: string[];
}> {
  const startTime = performance.now();
  const warnings: string[] = [];

  try {
    const [chromeAIStatus, translatorReady] = await Promise.all([
      getChromeAIReadiness(),
      isTranslatorAvailable()
    ]);

    const capabilities = {
      languageModel: chromeAIStatus.languageModel,
      summarizer: chromeAIStatus.summarizer,
      translator: translatorReady
    };

    // Add warnings for missing capabilities
    if (!capabilities.languageModel) {
      warnings.push('Chrome AI LanguageModel not available - core transcription will not work');
    }
    if (!capabilities.summarizer) {
      warnings.push('Chrome AI Summarizer not available - patient summaries will not be generated');
    }
    if (!capabilities.translator) {
      warnings.push('Chrome AI Translator not available - multi-language support will not work');
    }

    const ready = capabilities.languageModel; // Minimum requirement
    const processingTime = performance.now() - startTime;

    console.log(`Medical AI readiness check completed in ${processingTime.toFixed(2)}ms`, capabilities);

    return {
      ready,
      capabilities,
      warnings
    };

  } catch (error) {
    console.error('Medical AI readiness check failed:', error);
    return {
      ready: false,
      capabilities: {
        languageModel: false,
        summarizer: false,
        translator: false
      },
      warnings: [`Medical AI readiness check failed: ${(error as Error).message}`]
    };
  }
}

/**
 * Processes a medical note to generate summaries and translations.
 * 
 * This function orchestrates the complete medical AI workflow:
 * 1. Generates patient and/or clinical summaries using Summarizer API
 * 2. Translates summaries to target language using Translator API
 * 3. Returns comprehensive results with performance metrics
 * 
 * @param medicalNote - The medical note to process
 * @param config - Configuration for AI processing
 * @returns {Promise<MedicalAIResult>} Complete processing results
 * 
 * @throws {Error} If critical AI services are unavailable
 * 
 * @example
 * ```typescript
 * const note = { encounterType: 'Consultation', refinedNote: {...} };
 * const result = await processMedicalNote(note, {
 *   generateSummary: true,
 *   targetLanguage: 'es',
 *   summaryType: 'both'
 * });
 * console.log('Patient summary:', result.patientSummary);
 * console.log('Spanish translation:', result.translatedPatientSummary);
 * ```
 */
export async function processMedicalNote(
  medicalNote: MedicalNote,
  config: MedicalAIConfig
): Promise<MedicalAIResult> {
  const startTime = performance.now();
  const warnings: string[] = [];
  const result: MedicalAIResult = {
    processingTime: 0,
    warnings
  };

  // Check AI readiness
  const readiness = await getMedicalAIReadiness();
  if (!readiness.ready) {
    throw new Error('Medical AI services are not available. Please ensure Chrome 138+ with AI features enabled.');
  }

  try {
    // Extract medical note text for processing
    const noteText = extractMedicalNoteText(medicalNote);
    if (!noteText) {
      throw new Error('No medical note content available for processing.');
    }

    const encounterType = medicalNote.encounterType || 'General';

    // Generate summaries based on configuration
    if (config.generateSummary && readiness.capabilities.summarizer) {
      const summaryPromises: Promise<void>[] = [];

      if (config.summaryType === 'patient' || config.summaryType === 'both') {
        summaryPromises.push(
          generatePatientSummary(noteText, encounterType)
            .then(summary => { result.patientSummary = summary; })
            .catch(error => {
              warnings.push(`Patient summary generation failed: ${error.message}`);
            })
        );
      }

      if (config.summaryType === 'clinical' || config.summaryType === 'both') {
        summaryPromises.push(
          generateClinicalSummary(noteText, encounterType)
            .then(summary => { result.clinicalSummary = summary; })
            .catch(error => {
              warnings.push(`Clinical summary generation failed: ${error.message}`);
            })
        );
      }

      await Promise.all(summaryPromises);
    } else if (config.generateSummary && !readiness.capabilities.summarizer) {
      warnings.push('Summary generation requested but Summarizer API not available');
    }

    // Translate summaries if target language specified
    if (config.targetLanguage && config.targetLanguage !== 'en' && readiness.capabilities.translator) {
      const translationPromises: Promise<void>[] = [];

      if (result.patientSummary) {
        translationPromises.push(
          translatePatientSummary(result.patientSummary, config.targetLanguage, config.sourceLanguage)
            .then(translated => { 
              result.translatedPatientSummary = translated;
              result.targetLanguage = config.targetLanguage;
            })
            .catch(error => {
              warnings.push(`Patient summary translation failed: ${error.message}`);
            })
        );
      }

      if (result.clinicalSummary) {
        translationPromises.push(
          translateClinicalText(result.clinicalSummary, config.targetLanguage, config.sourceLanguage)
            .then(translated => { 
              result.translatedClinicalSummary = translated;
              result.targetLanguage = config.targetLanguage;
            })
            .catch(error => {
              warnings.push(`Clinical summary translation failed: ${error.message}`);
            })
        );
      }

      await Promise.all(translationPromises);
    } else if (config.targetLanguage && !readiness.capabilities.translator) {
      warnings.push('Translation requested but Translator API not available');
    }

  } catch (error) {
    console.error('Medical AI processing failed:', error);
    warnings.push(`Processing failed: ${(error as Error).message}`);
  } finally {
    result.processingTime = performance.now() - startTime;
    result.warnings = warnings;
  }

  return result;
}

/**
 * Extracts readable text from a medical note for AI processing.
 * 
 * @param medicalNote - The medical note object
 * @returns {string} Extracted text suitable for AI processing
 */
function extractMedicalNoteText(medicalNote: MedicalNote): string {
  const textParts: string[] = [];

  // Add encounter type
  if (medicalNote.encounterType) {
    textParts.push(`Encounter Type: ${medicalNote.encounterType}`);
  }

  // Add refined note sections
  if (medicalNote.refinedNote?.sections) {
    medicalNote.refinedNote.sections.forEach(section => {
      textParts.push(`${section.heading}: ${section.body}`);
    });
  }

  // Add clinical summary if available
  if (medicalNote.clinicalSummary) {
    const summary = medicalNote.clinicalSummary;
    if (summary.chiefComplaint) textParts.push(`Chief Complaint: ${summary.chiefComplaint}`);
    if (summary.keyFindings) textParts.push(`Key Findings: ${summary.keyFindings}`);
    if (summary.plan) textParts.push(`Plan: ${summary.plan}`);
    if (summary.followUp) textParts.push(`Follow-up: ${summary.followUp}`);
  }

  return textParts.join('\n\n');
}

/**
 * Cleans up medical AI resources.
 * 
 * Call this function when medical AI processing is complete to free up resources.
 */
export async function cleanupMedicalAI(): Promise<void> {
  try {
    await clearTranslatorCache();
    console.log('Medical AI resources cleaned up successfully');
  } catch (error) {
    console.warn('Failed to cleanup medical AI resources:', error);
  }
}

/**
 * Gets the list of supported languages for medical translation.
 * 
 * @returns {LanguageOption[]} Array of supported language options
 */
export function getSupportedLanguages(): LanguageOption[] {
  return SUPPORTED_LANGUAGES;
}

/**
 * Validates if a language code is supported for medical translation.
 * 
 * @param languageCode - The language code to validate
 * @returns {boolean} True if the language is supported
 */
export function isLanguageSupported(languageCode: string): boolean {
  return SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode);
}