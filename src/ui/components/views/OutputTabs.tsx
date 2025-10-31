/**
 * @fileoverview A component that displays the full, processed medical note in a clear, card-based layout.
 *
 * @description
 * This component renders the complete output of the transcription pipeline, including the clinical summary,
 * refined note, and various transcript versions. It uses a modern, single-page layout for easy scrolling and comparison.
 * It also integrates comprehensive translation functionality.
 *
 * @module components/views/OutputTabs
 */

import { useState } from 'react';
import { useSessionStore } from '../../../business/store/sessionStore';
import type { MedicalNote, TranscriptSegment } from '../../../shared/types';
import { LanguageSelector } from '../language/LanguageSelector';
import { useToast } from '../../hooks/ui/use-toast';
import { translateMedicalNote } from '../../../infrastructure/translation/translator';
import { Loader2 } from 'lucide-react';

// A reusable card component for consistent styling
function OutputCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 mb-8 ${className}`}>
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">{title}</h3>
      <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

// Displays the final, structured JSON note
function StructuredNote({ note }: { note: MedicalNote['refinedNote'] }) {
  if (!note || !note.sections) {
    return <OutputCard title="Refined Note">Not available.</OutputCard>;
  }
  return (
    <OutputCard title={`Refined Note (Format: ${note.format})`}>
      {note.sections.map((section, idx) => (
        <div key={idx} className="mb-4">
          <h4 className="font-semibold text-md text-gray-700 dark:text-gray-300">{section.heading}</h4>
          <p>{section.body}</p>
        </div>
      ))}
    </OutputCard>
  );
}

// Displays the speaker-labeled transcript
function LabeledTranscript({ segments }: { segments: TranscriptSegment[] }) {
  if (!segments) {
    return <OutputCard title="Labeled Transcript">Not available.</OutputCard>;
  }
  return (
    <OutputCard title="Labeled Transcript">
      <div className="space-y-2 font-mono text-sm">
        {segments.map((segment, idx) => (
          <div key={idx}>
            <span className={`font-bold ${segment.speaker === 'Provider' ? 'text-blue-500' : 'text-green-500'}`}>
              {segment.speaker}:
            </span>
            <span className="ml-2 text-gray-700 dark:text-gray-300">{segment.text}</span>
          </div>
        ))}
      </div>
    </OutputCard>
  );
}

// Main component to display all outputs
export function OutputTabs() {
  const { currentNote } = useSessionStore();
  const [translatedNote, setTranslatedNote] = useState<MedicalNote | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();

  const handleTranslate = async (languageCode: string) => {
    if (!currentNote) return;

    if (languageCode === 'en') {
      setTranslatedNote(null);
      return;
    }

    setIsTranslating(true);
    try {
      const note = await translateMedicalNote(currentNote, languageCode);
      setTranslatedNote(note);
      toast({ title: 'Translation Complete', description: `Note translated to ${languageCode.toUpperCase()}.`, variant: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown translation error';
      toast({ title: 'Translation Failed', description: message, variant: 'destructive' });
    } finally {
      setIsTranslating(false);
    }
  };

  if (!currentNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50 dark:bg-gray-900">
        <p className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No Note Available</p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Record a dictation to see your transcription results here.
        </p>
      </div>
    );
  }

  const displayNote = translatedNote || currentNote;

  return (
    <div className="p-6 sm:p-8 bg-gray-100 dark:bg-gray-900 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Transcription Results</h2>
          <div className="flex items-center gap-2">
            <LanguageSelector onTranslationComplete={handleTranslate} onTranslationError={(err) => toast({ title: 'Error', description: err, variant: 'destructive'})} originalText={currentNote.rawTranscript} />
            {isTranslating && <Loader2 className="w-5 h-5 animate-spin" />}
          </div>
        </div>

        {/* Display Clinical Summary */}
        <OutputCard title="Clinical Summary" className="border-t-4 border-blue-500">
          {displayNote.clinicalSummary ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Chief Complaint</h4>
                <p>{displayNote.clinicalSummary.chiefComplaint || 'Not available'}</p>
              </div>
              <div>
                <h4 className="font-semibold">Key Findings</h4>
                <p>{displayNote.clinicalSummary.keyFindings || 'Not available'}</p>
              </div>
              <div>
                <h4 className="font-semibold">Plan</h4>
                <p>{displayNote.clinicalSummary.plan || 'Not available'}</p>
              </div>
              {displayNote.clinicalSummary.followUp && (
                <div>
                  <h4 className="font-semibold">Follow-Up</h4>
                  <p>{displayNote.clinicalSummary.followUp}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Clinical summary not available for this note.</p>
          )}
        </OutputCard>

        {/* Display Refined Note */}
        <StructuredNote note={displayNote.refinedNote} />

        {/* Display Labeled Transcript */}
        <LabeledTranscript segments={displayNote.labeledTranscript} />

        {/* Raw and Cleaned Transcripts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OutputCard title="Raw Transcript">
            <p className="font-mono text-xs">{currentNote.rawTranscript || 'Not available'}</p>
          </OutputCard>
          <OutputCard title="Cleaned Transcript">
            <p className="font-mono text-xs">{currentNote.cleanedTranscript || 'Not available'}</p>
          </OutputCard>
        </div>
      </div>
    </div>
  );
}
