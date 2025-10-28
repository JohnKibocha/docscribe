/**
 * @fileoverview TypeScript declarations for Chrome's built-in Translator API.
 *
 * @description
 * This file provides type definitions for the Chrome Translator API,
 * which is part of Chrome's built-in AI capabilities.
 */

declare global {
  interface Window {
    Translator?: ChromeTranslatorAPI;
  }

  interface ChromeTranslatorAPI {
    availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<'available' | 'downloadable' | 'unavailable'>;
    create(options: { sourceLanguage: string; targetLanguage: string }): Promise<ChromeTranslator>;
  }

  interface ChromeTranslator {
    translate(text: string): Promise<string>;
    destroy(): void;
  }
}

export {};