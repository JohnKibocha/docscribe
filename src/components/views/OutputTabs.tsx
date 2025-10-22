/**
 * @fileoverview A component that displays the transcribed medical note in a tabbed interface.
 *
 * @description
 * This component is a primary consumer of the `currentNote` from the `useSessionStore`.
 * It presents the different parts of a `MedicalNote` in a clear, user-friendly tabbed layout.
 * The component is responsible for rendering the refined note, the raw transcript, and the clinical summary.
 *
 * Key Features:
 * - **Tabbed Interface**: Separates the `refinedNote`, `rawTranscript`, and `clinicalSummary` into distinct, selectable tabs.
 * - **Rich Content Rendering**: Properly formats and displays each section of the note, including speaker labels for the raw transcript and structured sections for the refined note.
 * - **Copy Functionality**: Provides a one-click "Copy" button for the content of the currently active tab.
 * - **Translation Integration**: Incorporates the `LanguageSelector` component within the Summary tab to allow for on-device translation of the clinical summary.
 * - **Empty State**: Displays a helpful message when no `currentNote` is available in the store.
 * - **User Feedback**: Uses the `useToast` hook to provide feedback for translation and copy actions.
 *
 * @module components/views/OutputTabs
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import type { MedicalNote, TranscriptSegment, NoteSection } from '@/types';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useToast } from '@/hooks/use-toast';

/**
 * Defines the possible values for the active tab in the output view.
 */
type TabType = 'refined' | 'raw' | 'summary';

/**
 * Formats the clinical summary object into a single, readable string.
 * This formatted string is used as the input for the translation service.
 *
 * @param {MedicalNote['clinicalSummary']} summary - The clinical summary object from the medical note.
 * @returns {string} A formatted string containing the chief complaint, key findings, and plan.
 */
function formatSummaryForTranslation(summary: MedicalNote['clinicalSummary']): string {
  return `Chief Complaint: ${summary.chiefComplaint}\n\nKey Findings: ${summary.keyFindings}\n\nPlan: ${summary.plan}`;
}

/**
 * A component that displays the current medical note in a tabbed interface.
 *
 * @description
 * This component subscribes to the `useSessionStore` to get the `currentNote`. If a note exists,
 * it renders a tab navigation for 'Refined Note', 'Raw Transcript', and 'Summary'.
 * The component manages local state for the active tab, the copied status of each tab, and the
 * translated summary text and its language.
 *
 * @returns {JSX.Element} The rendered tabbed interface for displaying the medical note.
 */
export function OutputTabs() {
  const { currentNote } = useSessionStore();
  const [activeTab, setActiveTab] = useState<TabType>('refined');
  const [copiedTab, setCopiedTab] = useState<TabType | null>(null);
  const [translatedSummary, setTranslatedSummary] = useState<string | null>(null);
  const [translationLanguage, setTranslationLanguage] = useState<string>('en');
  const { toast } = useToast();

  /**
   * Callback function invoked when the `LanguageSelector` successfully completes a translation.
   * It updates the local state with the translated text and language, and shows a confirmation toast.
   * @param {string} translated - The translated text.
   * @param {string} languageCode - The language the text was translated into.
   */
  const handleTranslationComplete = (translated: string, languageCode: string) => {
    setTranslatedSummary(translated);
    setTranslationLanguage(languageCode);
    toast({
      title: 'Translation Complete',
      description: `Summary has been translated to ${languageCode.toUpperCase()}.`,
      variant: 'success',
    });
  };

  /**
   * Callback function invoked when the `LanguageSelector` encounters an error during translation.
   * It displays an error toast to the user.
   * @param {string} error - The error message from the translation service.
   */
  const handleTranslationError = (error: string) => {
    toast({
      title: 'Translation Failed',
      description: error,
      variant: 'destructive',
    });
  };

  /**
   * Copies the text content of the currently active tab to the user's clipboard.
   * Provides visual feedback by changing the copy button's state for 2 seconds.
   * @param {string} text - The text to be copied.
   * @param {TabType} tab - The identifier of the tab being copied.
   */
  const handleCopy = async (text: string, tab: TabType) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      toast({ title: 'Copied to Clipboard', description: `The ${tab} content has been copied.` });
      setTimeout(() => setCopiedTab(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast({ title: 'Copy Failed', description: 'Could not copy text to clipboard.', variant: 'destructive' });
    }
  };

  if (!currentNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center" aria-labelledby="empty-state-title">
        <p id="empty-state-title" className="text-gray-500 dark:text-gray-400 mb-2">
          No Note Available
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Record a dictation to see your transcription results here.
        </p>
      </div>
    );
  }

  const { rawTranscript, refinedNote, clinicalSummary } = currentNote;

  /**
   * Renders the raw transcript with professional medical formatting.
   * The format is: `[HH:MM:SS] SPEAKER: Dialogue text`
   * @returns {JSX.Element}
   */
  const renderRawTranscript = () => {
    if (!rawTranscript?.length) {
      return <p className="text-gray-500 dark:text-gray-400">No transcript available.</p>;
    }

    return (
      <div className="space-y-3 font-mono text-sm">
        {rawTranscript.map((segment, index) => (
          <div key={index} className="leading-relaxed">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              [{segment.timestamp || '00:00:00'}]
            </span>{' '}
            <span className="font-bold text-gray-900 dark:text-gray-200 uppercase">
              {segment.speaker}:
            </span>{' '}
            <span className="text-gray-700 dark:text-gray-300">{segment.text}</span>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the refined note view, displaying the detected format and each structured section.
   * @returns {JSX.Element}
   */
  const renderRefinedNote = () => {
    if (!refinedNote || !Array.isArray(refinedNote.sections)) {
      return (
        <p className="text-gray-500 dark:text-gray-400">
          Refined note is not available or is malformed.
        </p>
      );
    }

    return (
      <div className="space-y-6">
        <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
          {refinedNote.format} Note
        </div>
        
        {refinedNote.sections.map((section: NoteSection, index: number) => (
          <div key={index} className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {section.title}
            </h3>
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {section.body}
            </p>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Retrieves the appropriate text content for the currently active tab.
   * This function is used to supply the correct string to the `handleCopy` function.
   * @returns {string} The text content of the active tab.
   */
  const getActiveTabContent = (): string => {
    switch (activeTab) {
      case 'raw':
        return rawTranscript.map((s: TranscriptSegment) => `[${s.timestamp || '00:00:00'}] ${s.speaker.toUpperCase()}: ${s.text}`).join('\n\n');
      case 'refined':
        return refinedNote.content;
      case 'summary':
        if (translationLanguage !== 'en' && translatedSummary) {
          return translatedSummary;
        }
        return formatSummaryForTranslation(clinicalSummary) + (clinicalSummary.followUp ? `\n\nFollow-Up: ${clinicalSummary.followUp}` : '');
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div role="tablist" aria-label="Transcription Outputs">
          <button
            onClick={() => setActiveTab('refined')}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 focus:outline-none ${activeTab === 'refined' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            aria-selected={activeTab === 'refined'}
            role="tab"
          >
            Refined Note
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 focus:outline-none ${activeTab === 'raw' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            aria-selected={activeTab === 'raw'}
            role="tab"
          >
            Raw Transcript
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 focus:outline-none ${activeTab === 'summary' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            aria-selected={activeTab === 'summary'}
            role="tab"
          >
            Summary
          </button>
        </div>

        <button
          onClick={() => handleCopy(getActiveTabContent(), activeTab)}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`Copy ${activeTab} to clipboard`}
        >
          {copiedTab === activeTab ? (
            <><Check className="w-4 h-4 text-green-600" /><span>Copied!</span></>
          ) : (
            <><Copy className="w-4 h-4" /><span>Copy</span></>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6" role="tabpanel">
        {activeTab === 'refined' && renderRefinedNote()}
        {activeTab === 'raw' && renderRawTranscript()}
        {activeTab === 'summary' && currentNote && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Translate Summary
              </h3>
              <LanguageSelector
                originalText={formatSummaryForTranslation(currentNote.clinicalSummary)}
                onTranslationComplete={handleTranslationComplete}
                onTranslationError={handleTranslationError}
              />
            </div>

            {translationLanguage === 'en' || !translatedSummary ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Chief Complaint</h3>
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{clinicalSummary.chiefComplaint}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Key Findings</h3>
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{clinicalSummary.keyFindings}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Plan</h3>
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{clinicalSummary.plan}</p>
                </div>
                {clinicalSummary.followUp && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Follow-Up</h3>
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{clinicalSummary.followUp}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{translatedSummary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
