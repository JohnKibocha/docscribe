/**
 * @fileoverview Provides the primary user interface for voice dictation and recording control.
 *
 * @description
 * This component serves as the central hub for capturing clinical notes via audio.
 * It integrates the `useVoiceRecorder` hook to manage the microphone and recording state,
 * and it interacts with the `useSessionStore` (Zustand) to manage global application state,
 * such as loading indicators and error messages. When a recording is completed,
 * it orchestrates the transcription process by calling the `transcribeMedicalDictation` service.
 *
 * The component is designed to provide clear, real-time feedback to the user, with visual
 * indicators for recording status (recording, paused, transcribing), a running duration timer,
 * and accessible controls for starting, stopping, and pausing the recording.
 *
 * @module components/VoiceDictation
 */

import { useCallback, useEffect } from 'react';
import { Mic, Square, Pause, Play, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useSessionStore } from '../store/sessionStore';
import { transcribeMedicalDictation, formatDuration } from '../services/chromeAI';

/**
 * A React component that provides a complete user interface for recording and transcribing clinical dictations.
 *
 * @description
 * This component manages the entire voice recording workflow, from capturing audio to displaying the final transcription.
 * It leverages the `useVoiceRecorder` hook for all recording-related logic and state (e.g., `isRecording`, `audioBlob`).
 * It uses the `useSessionStore` to communicate loading states, errors, and to set the final transcribed note
 * in the global state for other components to consume.
 *
 * The user interaction flow is as follows:
 * 1. The user clicks the main record button to initiate recording (`startRecording`).
 * 2. The component displays a live timer and visual cues indicating that recording is active.
 * 3. The user can pause and resume the recording as needed.
 * 4. The user clicks the stop button (`stopRecording`), which finalizes the audio capture and produces an `audioBlob`.
 * 5. An effect hook (`useEffect`) detects the new `audioBlob` and triggers the `handleTranscription` process.
 * 6. The application enters a loading state, and the `audioBlob` is sent to the `transcribeMedicalDictation` service.
 * 7. Upon successful transcription, the resulting `MedicalNote` is saved to the session store (`setNote`).
 * 8. Any errors during recording or transcription are caught and displayed to the user.
 *
 * @returns {JSX.Element} The rendered voice dictation interface, including buttons, status indicators, and error messages.
 *
 * @example
 * ```tsx
 * // In a parent component like App.tsx
 * import { VoiceDictation } from './components/VoiceDictation';
 *
 * function DictationPage() {
 *   return (
 *     <div className="dictation-container">
 *       <h2 className="title">Record a New Note</h2>
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
   * Handles the asynchronous transcription process once an audio blob is available.
   * This function is wrapped in `useCallback` to be memoized, as it is a dependency of a `useEffect` hook.
   */
  const handleTranscription = useCallback(async () => {
    if (!audioBlob) return;

    try {
      setLoading(true, 'Transcribing audio with on-device AI...');
      setError(null);

      // Call the core transcription service with the recorded audio.
      const note = await transcribeMedicalDictation(audioBlob);

      // On success, update the global session store with the new note.
      setNote(note);

      // Clear the local recording state to prepare for the next recording.
      clearRecording();
    } catch (error) {
      console.error('Transcription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during transcription.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [audioBlob, setNote, setLoading, setError, clearRecording]);

  /**
   * An effect hook that automatically triggers the transcription process
   * as soon as the `audioBlob` is created (i.e., when recording stops).
   */
  useEffect(() => {
    if (audioBlob && !isRecording) {
      handleTranscription();
    }
  }, [audioBlob, isRecording, handleTranscription]);

  /**
   * Toggles the recording state. If currently recording, it stops. If not, it starts.
   */
  const handleRecordClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  /**
   * Toggles the pause state of the recording.
   */
  const handlePauseToggle = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  // Render a fallback UI if the browser does not support the required recording APIs.
  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
        <div className="text-red-600 dark:text-red-400 text-center">
          <p className="font-semibold mb-2">Audio Recording Not Supported</p>
          <p className="text-sm">
            Your browser does not support the necessary APIs for audio recording. Please use a modern, compatible browser like Google Chrome.
          </p>
        </div>
      </div>
    );
  }

  // Consolidate errors from both the recorder hook and the session store.
  const displayError = recordingError || storeError;

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* Status Indicator: Displays the current state (Recording, Paused, or Transcribing). */}
      <div className="text-center h-6" aria-live="polite">
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
            <span className="font-semibold">Processing...</span>
          </div>
        )}
      </div>

      {/* Duration Timer: Shows the elapsed recording time. */}
      <div className="text-4xl font-mono font-bold text-gray-900 dark:text-gray-100 h-12 flex items-center">
        {isRecording && formatDuration(recordingDuration)}
      </div>

      {/* Main Action Button: Toggles between Start and Stop recording. */}
      <button
        onClick={handleRecordClick}
        disabled={isLoading}
        className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-4 ${isRecording ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:focus:ring-red-800' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:focus:ring-blue-800'} disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        aria-pressed={isRecording}
      >
        {isRecording ? (
          <Square className="w-12 h-12 text-white" fill="currentColor" />
        ) : (
          <Mic className="w-12 h-12 text-white" />
        )}
      </button>

      {/* Pause/Resume Button: Only visible during an active recording session. */}
      <div className="h-14">
        {isRecording && (
          <button
            onClick={handlePauseToggle}
            className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600 flex items-center space-x-2"
            aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
          >
            {isPaused ? (
              <><Play className="w-5 h-5" /><span>Resume</span></>
            ) : (
              <><Pause className="w-5 h-5" /><span>Pause</span></>
            )}
          </button>
        )}
      </div>

      {/* Instructional Text: Guides the user when in an idle state. */}
      <div className="h-12">
        {!isRecording && !isLoading && (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
            Click the microphone to start recording your clinical dictation.
            Speak naturally and include all relevant details.
          </p>
        )}
      </div>

      {/* Error Display: Shows any errors from recording or transcription. */}
      {displayError && (
        <div className="w-full max-w-md p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>Error:</strong> {displayError}
          </p>
        </div>
      )}
    </div>
  );
}
