/**
 * @fileoverview Custom React hook for voice recording functionality.
 * 
 * This hook provides a complete interface for recording audio from the user's
 * microphone using the Web MediaRecorder API. It handles microphone permissions,
 * recording state management, audio blob creation, and proper resource cleanup.
 *
 * AUDIO FORMAT: Records in 'audio/webm' format for compatibility with Chrome
 * AI's multimodal input API. Configured with optimal settings for speech.
 *
 * @module hooks/useVoiceRecorder
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Return type for the useVoiceRecorder hook.
 */
interface UseVoiceRecorderReturn {
  /**
   * Whether audio is currently being recorded.
   */
  isRecording: boolean;

  /**
   * Whether the recording is paused.
   */
  isPaused: boolean;

  /**
   * The recorded audio blob, available after recording stops.
   * Format: audio/webm, suitable for Chrome AI multimodal input.
   */
  audioBlob: Blob | null;

  /**
   * Duration of the current recording in seconds.
   */
  recordingDuration: number;

  /**
   * Error message if recording failed, null otherwise.
   */
  error: string | null;

  /**
   * Whether the browser supports audio recording.
   */
  isSupported: boolean;

  /**
   * Starts recording audio from the microphone.
   * Requests microphone permission if not already granted.
   *
   * @returns Promise that resolves when recording starts successfully.
   * @throws Will set error state if microphone access is denied or unavailable.
   *
   * @example
   * ```
   * const { startRecording, error } = useVoiceRecorder();
   * 
   * const handleRecord = async () => {
   *   await startRecording();
   *   if (error) console.error('Failed to start recording');
   * };
   * ```
   */
  startRecording: () => Promise<void>;

  /**
   * Stops the current recording and generates an audio blob.
   * The blob will be available in the `audioBlob` state after stopping.
   *
   * @example
   * ```
   * const { stopRecording, audioBlob } = useVoiceRecorder();
   * 
   * stopRecording();
   * // Wait for audioBlob to populate
   * ```
   */
  stopRecording: () => void;

  /**
   * Pauses the current recording without stopping it.
   * Recording can be resumed with resumeRecording().
   *
   * @example
   * ```
   * const { pauseRecording } = useVoiceRecorder();
   * pauseRecording();
   * ```
   */
  pauseRecording: () => void;

  /**
   * Resumes a paused recording.
   *
   * @example
   * ```
   * const { resumeRecording } = useVoiceRecorder();
   * resumeRecording();
   * ```
   */
  resumeRecording: () => void;

  /**
   * Clears the recorded audio blob and resets state.
   * Does not affect an active recording.
   *
   * @example
   * ```
   * const { clearRecording } = useVoiceRecorder();
   * clearRecording();
   * ```
   */
  clearRecording: () => void;

  /**
   * Cancels an active recording without saving the audio.
   * Stops all tracks and clears state.
   *
   * @example
   * ```
   * const { cancelRecording } = useVoiceRecorder();
   * cancelRecording();
   * ```
   */
  cancelRecording: () => void;
}

/**
 * Custom hook for voice recording with microphone access.
 * 
 * Provides a complete interface for recording audio, including state management,
 * error handling, duration tracking, and automatic resource cleanup. Uses the
 * MediaRecorder API with webm audio format for compatibility with Chrome AI's
 * multimodal input.
 *
 * AUDIO CONFIGURATION:
 * - Format: audio/webm (Chrome AI compatible)
 * - Sample rate: 44100 Hz
 * - Echo cancellation: Enabled
 * - Noise suppression: Enabled
 * - Auto gain control: Enabled
 *
 * @returns {UseVoiceRecorderReturn} Recording controls and state.
 *
 * @example
 * ```
 * function RecordButton() {
 *   const {
 *     isRecording,
 *     audioBlob,
 *     recordingDuration,
 *     startRecording,
 *     stopRecording,
 *     error
 *   } = useVoiceRecorder();
 *
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return (
 *     <div>
 *       <button onClick={isRecording ? stopRecording : startRecording}>
 *         {isRecording ? 'Stop' : 'Start'} Recording ({recordingDuration}s)
 *       </button>
 *       {audioBlob && <p>Recording complete! Size: {audioBlob.size} bytes</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  // Check browser support on mount
  useEffect(() => {
    const supported = !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      window.MediaRecorder
    );
    setIsSupported(supported);
    
    if (!supported) {
      setError('Your browser does not support audio recording.');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      setError(null);
      setAudioBlob(null);
      audioChunksRef.current = [];
      setRecordingDuration(0);

      // Request microphone access with optimal speech settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Determine best supported MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else {
        console.warn('Preferred MIME types not supported, using default');
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setIsRecording(false);
        setIsPaused(false);

        // Stop duration tracking
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording failed. Please try again.');
        setIsRecording(false);
        setIsPaused(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

      // Start duration tracking
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please grant permission and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else {
          setError(`Recording failed: ${err.message}`);
        }
      } else {
        setError('Failed to access microphone. Please check your settings.');
      }
    }
  }, [isSupported]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      durationIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  }, [isRecording, isPaused]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setRecordingDuration(0);
    setError(null);
    audioChunksRef.current = [];
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop without saving
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
      setAudioBlob(null);
      setRecordingDuration(0);
      setIsRecording(false);
      setIsPaused(false);
      setError(null);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording]);

  return {
    isRecording,
    isPaused,
    audioBlob,
    recordingDuration,
    error,
    isSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    cancelRecording,
  };
}
