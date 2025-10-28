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

import { useState, useEffect } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Select, SelectItem } from './ui/Select';
import {
  SUPPORTED_LANGUAGES,
  isTranslatorAvailable,
  translateText,
} from '../services/translator';

/**
 * Defines the properties required by the `LanguageSelector` component.
 */
interface LanguageSelectorProps {
  originalText: string;
  onTranslationComplete: (translatedText: string) => void;
  onTranslationError: (error: string) => void;
}

/**
 * A component that provides a language selection dropdown to translate a given text string.
 */
export function LanguageSelector({
  originalText,
  onTranslationComplete,
  onTranslationError,
}: LanguageSelectorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isApiAvailable, setIsApiAvailable] = useState(false);

  useEffect(() => {
    isTranslatorAvailable().then(setIsApiAvailable);
  }, []);

  const handleLanguageChange = async (languageCode: string) => {
    setSelectedLanguage(languageCode);
    setIsTranslating(true);
    try {
      const translatedText = await translateText(originalText, languageCode);
      onTranslationComplete(translatedText);
    } catch (error) {
      onTranslationError('Failed to translate text.');
    } finally {
      setIsTranslating(false);
    }
  };

  if (!isApiAvailable) {
    return null; // Don't render the component if the API is not available
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-gray-500" />
      <Select
        value={selectedLanguage}
        onValueChange={handleLanguageChange}
        disabled={isTranslating}
        className="w-[180px]"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </Select>
      {isTranslating && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  );
}
