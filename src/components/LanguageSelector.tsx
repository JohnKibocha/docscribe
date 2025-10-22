/**
 * @fileoverview A user interface component for selecting a language and translating clinical summaries.
 *
 * @description
 * This component renders a dropdown menu (a `Select` control) that allows the user to choose a
 * target language for translating a piece of text, typically a clinical summary. It integrates
 * directly with the on-device Chrome Translator API via the `translator` service.
 *
 * The component manages its own state for loading during translation and provides clear
 * feedback to the user. It is designed to be a self-contained unit for adding translation
 * functionality to any part of the application that handles text display.
 *
 * @module components/LanguageSelector
 */

import { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Select, SelectItem } from './ui/Select';
import {
  translateText,
  SUPPORTED_LANGUAGES,
  isTranslatorAvailable,
} from '../services/translator';

/**
 * Defines the properties required by the `LanguageSelector` component.
 */
interface LanguageSelectorProps {
  /**
   * The original, untranslated text (expected to be in English) that will be the source for translation.
   */
  originalText: string;

  /**
   * A callback function that is invoked upon the successful completion of a translation.
   *
   * @param {string} translatedText - The text after it has been translated into the target language.
   * @param {string} languageCode - The ISO 639-1 code of the language the text was translated into.
   * @returns {void}
   */
  onTranslationComplete: (translatedText: string, languageCode: string) => void;

  /**
   * An optional callback function that is invoked if an error occurs during the translation process.
   *
   * @param {string} error - A descriptive error message.
   * @returns {void}
   */
  onTranslationError?: (error: string) => void;
}

/**
 * A component that provides a language selection dropdown to translate a given text string.
 *
 * @description
 * This component renders a `Select` dropdown populated with a list of `SUPPORTED_LANGUAGES`.
 * When a user selects a new language, it triggers the `handleLanguageChange` function.
 * This function orchestrates the translation process by calling the `translateText` service.
 * It manages a local `isTranslating` state to provide visual feedback (a loading spinner)
 * and disable the control during the operation.
 *
 * @param {LanguageSelectorProps} props - The properties for the component, including the text to translate and event callbacks.
 * @returns {JSX.Element} The rendered language selector component, including the dropdown and a loading indicator.
 *
 * @example
 * ```tsx
 * const [translatedSummary, setTranslatedSummary] = useState(note.clinicalSummary.plan);
 * const [translationError, setTranslationError] = useState<string | null>(null);
 *
 * <LanguageSelector
 *   originalText={note.clinicalSummary.plan}
 *   onTranslationComplete={(translated, lang) => {
 *     setTranslatedSummary(translated);
 *     setTranslationError(null);
 *     console.log(`Successfully translated to ${lang}`);
 *   }}
 *   onTranslationError={(error) => {
 *     setTranslationError(error);
 *     console.error(`Translation failed: ${error}`);
 *   }}
 * />
 * ```
 */
export function LanguageSelector({
  originalText,
  onTranslationComplete,
  onTranslationError,
}: LanguageSelectorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState(false);

  /**
   * Handles the change event from the language select dropdown and initiates the translation process.
   *
   * @param {string} languageCode - The ISO 639-1 code of the newly selected language.
   * @returns {Promise<void>}
   */
  const handleLanguageChange = async (languageCode: string) => {
    setSelectedLanguage(languageCode);

    // If the user selects English, immediately return the original text without calling the API.
    if (languageCode === 'en') {
      onTranslationComplete(originalText, 'en');
      return;
    }

    // Before attempting translation, verify that the browser supports the Translator API.
    if (!isTranslatorAvailable()) {
      const errorMsg = 'On-device translation is not available in this browser. Please use a compatible version of Chrome with AI features enabled.';
      onTranslationError?.(errorMsg);
      return;
    }

    setIsTranslating(true);

    try {
      const translatedText = await translateText(
        originalText,
        'en', // Source language is assumed to be English.
        languageCode
      );
      onTranslationComplete(translatedText, languageCode);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Translation failed due to an unknown error.';
      onTranslationError?.(errorMsg);
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-500" aria-hidden="true" />
      <Select
        value={selectedLanguage}
        onValueChange={handleLanguageChange}
        disabled={isTranslating}
        aria-label="Select target language for translation"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name} ({lang.nativeName})
          </SelectItem>
        ))}
      </Select>
      {isTranslating && (
        <Loader2
          className="h-4 w-4 animate-spin text-blue-600"
          aria-label="Translating..."
          role="status"
        />
      )}
    </div>
  );
}
