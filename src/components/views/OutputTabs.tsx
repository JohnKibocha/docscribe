/**
 * @fileoverview Output tabs component for displaying transcription results.
 * 
 * This component provides a tabbed interface for viewing the three parts
 * of a medical note: raw transcript with speakers, refined formatted note,
 * and clinical summary. It reads from the Zustand store and handles empty
 * states appropriately.
 *
 * Features:
 * - Three-tab interface (Raw/Refined/Summary)
 * - Speaker-attributed transcript display
 * - Formatted note sections
 * - Copyable text outputs
 * - Empty state messaging
 * - Responsive design
 *
 * @module components/views/OutputTabs
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import type { TranscriptSegment, NoteSection } from '../../types';

/**
 * Tab options for the output view.
 */
type TabType = 'refined' | 'raw' | 'summary';

/**
 * Output tabs component for displaying transcription results.
 * 
 * Displays the current note from Zustand store in three different views:
 * 1. Refined: Professionally formatted clinical note
 * 2. Raw: Verbatim transcript with speaker labels
 * 3. Summary: Concise clinical summary with key points
 *
 * @returns {JSX.Element} The tabbed output interface.
 *
 * @example
 * ```
 * import { OutputTabs } from './components/views/OutputTabs';
 * 
 * function App() {
 *   return (
 *     <div>
 *       <OutputTabs />
 *     </div>
 *   );
 * }
 * ```
 */
export function OutputTabs() {
  const { currentNote } = useSessionStore();
  const [activeTab, setActiveTab] = useState<TabType>('refined');
  const [copiedTab, setCopiedTab] = useState<TabType | null>(null);

  /**
   * Handles copying text to clipboard with feedback.
   */
  const handleCopy = async (text: string, tab: TabType) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Empty state when no note is available
  if (!currentNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-2">
          No note available
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Record a dictation to see your transcription here
        </p>
      </div>
    );
  }

  const { rawTranscript, refinedNote, clinicalSummary } = currentNote;

  /**
   * Renders the raw transcript with speaker labels.
   */
  const renderRawTranscript = () => (
    <div className="space-y-4">
      {rawTranscript.map((segment: TranscriptSegment, index: number) => (
        <div key={index} className="flex space-x-3">
          <span className="font-semibold text-blue-600 dark:text-blue-400 min-w-[100px]">
            {segment.speaker}:
          </span>
          <span className="text-gray-800 dark:text-gray-200">
            {segment.text}
          </span>
        </div>
      ))}
    </div>
  );

  /**
   * Renders the refined note with sections.
   */
  const renderRefinedNote = () => (
    <div className="space-y-6">
      <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
        {refinedNote.format}
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

  /**
   * Renders the clinical summary.
   */
  const renderSummary = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Chief Complaint
        </h3>
        <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
          {clinicalSummary.chiefComplaint}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Key Findings
        </h3>
        <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
          {clinicalSummary.keyFindings}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Plan
        </h3>
        <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
          {clinicalSummary.plan}
        </p>
      </div>

      {clinicalSummary.followUp && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Follow-Up
          </h3>
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
            {clinicalSummary.followUp}
          </p>
        </div>
      )}
    </div>
  );

  /**
   * Gets the text content for the active tab for copying.
   */
  const getActiveTabContent = () => {
    switch (activeTab) {
      case 'raw':
        return rawTranscript.map((s: TranscriptSegment) => `${s.speaker}: ${s.text}`).join('\n\n');
      case 'refined':
        return refinedNote.content;
      case 'summary':
        return `Chief Complaint: ${clinicalSummary.chiefComplaint}\n\nKey Findings: ${clinicalSummary.keyFindings}\n\nPlan: ${clinicalSummary.plan}${
          clinicalSummary.followUp ? `\n\nFollow-Up: ${clinicalSummary.followUp}` : ''
        }`;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('refined')}
            className={`
              px-6 py-3 font-medium text-sm transition-colors
              border-b-2 focus:outline-none
              ${
                activeTab === 'refined'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `}
            aria-selected={activeTab === 'refined'}
            role="tab"
          >
            Refined Note
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`
              px-6 py-3 font-medium text-sm transition-colors
              border-b-2 focus:outline-none
              ${
                activeTab === 'raw'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `}
            aria-selected={activeTab === 'raw'}
            role="tab"
          >
            Raw Transcript
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`
              px-6 py-3 font-medium text-sm transition-colors
              border-b-2 focus:outline-none
              ${
                activeTab === 'summary'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `}
            aria-selected={activeTab === 'summary'}
            role="tab"
          >
            Summary
          </button>
        </div>

        {/* Copy Button */}
        <button
          onClick={() => handleCopy(getActiveTabContent(), activeTab)}
          className="
            px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg
            transition-colors flex items-center space-x-2
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
          aria-label="Copy to clipboard"
        >
          {copiedTab === activeTab ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6" role="tabpanel">
        {activeTab === 'refined' && renderRefinedNote()}
        {activeTab === 'raw' && renderRawTranscript()}
        {activeTab === 'summary' && renderSummary()}
      </div>
    </div>
  );
}
