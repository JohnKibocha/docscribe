/**
 * @fileoverview Voice dictation component for recording clinical notes.
 * 
 * This component provides a user-friendly interface for recording audio
 * dictation, sending it to Chrome AI for transcription, and displaying
 * the results. It integrates the voice recording hook, Chrome AI service,
 * and Zustand store.
 *
 * Features:
 * - Visual recording indicator with duration
 * - Pause/resume recording capability
 * - Real-time feedback during transcription
 * - Error handling with user-friendly messages
 * - Accessibility support (ARIA labels, keyboard navigation)
 *
 * @module components/VoiceDictation
 */

import { useCallback, useEffect } from 'react';
import { Mic, Square, Pause, Play, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useSessionStore } from '../store/sessionStore';
import { transcribeMedicalDictation, formatDuration } from '../services/chromeAI';

/**
 * Voice dictation component for recording and transcribing clinical notes.
 * 
 * This component manages the complete recording workflow:
 * 1. User clicks record button to start recording
 * 2. Audio is captured via MediaRecorder API
 * 3. User stops recording
 * 4. Audio is sent to Chrome AI for transcription
 * 5. Results are stored in Zustand and displayed
 *
 * @returns {JSX.Element} The voice dictation interface.
 *
 * @example
 * ```
 * import { VoiceDictation } from './components/VoiceDictation';
 * 
 * function App() {
 *   return (
 *     <div>
 *       <VoiceDictation />
 *     </div>
 *   );
 * }
 * ```
 */
export function VoiceDictation() {
  const {
    isRecording,
    isPaused,
    audioBlob,
    recordingDuration,
    error: recordingError,
    isSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  } = useVoiceRecorder();

  const { setNote, setLoading, setError, isLoading, error: storeError } = useSessionStore();

  /**
   * Handles the transcription process after recording stops.
   * Automatically triggers when audioBlob becomes available.
   */
  const handleTranscription = useCallback(async () => {
    if (!audioBlob) return;

    try {
      setLoading(true, 'Transcribing audio with AI...');
      setError(null);

      const note = await transcribeMedicalDictation(audioBlob);
      setNote(note);
      clearRecording();
    } catch (error) {
      console.error('Transcription error:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to transcribe audio. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [audioBlob, setNote, setLoading, setError, clearRecording]);

  /**
   * Auto-trigger transcription when recording completes.
   */
  useEffect(() => {
    if (audioBlob && !isRecording) {
      handleTranscription();
    }
  }, [audioBlob, isRecording, handleTranscription]);

  /**
   * Handles the main record button click.
   * Starts recording if not recording, stops if recording.
   */
  const handleRecordClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  /**
   * Handles pause/resume toggle.
   */
  const handlePauseToggle = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  // Show error if recording is not supported
  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="text-red-600 dark:text-red-400 text-center">
          <p className="font-semibold mb-2">Recording Not Supported</p>
          <p className="text-sm">
            Your browser does not support audio recording. Please use Chrome Canary 143+ or Chrome Dev 140+.
          </p>
        </div>
      </div>
    );
  }

  const displayError = recordingError || storeError;

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* Recording Status */}
      <div className="text-center">
        {isRecording && (
          <div className="flex items-center justify-center space-x-2 text-red-600 dark:text-red-400">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <span className="font-semibold">Recording</span>
          </div>
        )}
        {isPaused && (
          <div className="flex items-center justify-center space-x-2 text-yellow-600 dark:text-yellow-400">
            <Pause className="w-4 h-4" />
            <span className="font-semibold">Paused</span>
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="font-semibold">Transcribing...</span>
          </div>
        )}
      </div>

      {/* Duration Display */}
      {isRecording && (
        <div className="text-4xl font-mono font-bold text-gray-900 dark:text-gray-100">
          {formatDuration(recordingDuration)}
        </div>
      )}

      {/* Main Record Button */}
      <button
        onClick={handleRecordClick}
        disabled={isLoading}
        className={`
          relative w-24 h-24 rounded-full flex items-center justify-center
          transition-all duration-200 focus:outline-none focus:ring-4
          ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:focus:ring-red-800'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:focus:ring-blue-800'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          shadow-lg hover:shadow-xl
        `}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        aria-pressed={isRecording}
      >
        {isRecording ? (
          <Square className="w-12 h-12 text-white" fill="currentColor" />
        ) : (
          <Mic className="w-12 h-12 text-white" />
        )}
      </button>

      {/* Pause/Resume Button (only shown when recording) */}
      {isRecording && (
        <button
          onClick={handlePauseToggle}
          className="
            px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-700
            hover:bg-gray-300 dark:hover:bg-gray-600
            transition-colors focus:outline-none focus:ring-4
            focus:ring-gray-300 dark:focus:ring-gray-600
            flex items-center space-x-2
          "
          aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
        >
          {isPaused ? (
            <>
              <Play className="w-5 h-5" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-5 h-5" />
              <span>Pause</span>
            </>
          )}
        </button>
      )}

      {/* Instructions */}
      {!isRecording && !isLoading && (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
          Click the microphone to start recording your clinical dictation.
          Speak naturally and include all relevant details.
        </p>
      )}

      {/* Error Display */}
      {displayError && (
        <div
          className="
            w-full max-w-md p-4 bg-red-50 dark:bg-red-900/20
            border border-red-200 dark:border-red-800 rounded-lg
          "
          role="alert"
        >
          <p className="text-sm text-red-800 dark:text-red-200">
            {displayError}
          </p>
        </div>
      )}
    </div>
  );
}
