/**
 * @fileoverview Custom React hook for voice recording functionality.
 *
 * @description
 * This hook provides a complete interface for recording audio from the user's
 * microphone using the Web MediaRecorder API. It encapsulates all the logic for:
 * - Requesting microphone permissions.
 * - Managing recording state (recording, paused, stopped).
 * - Tracking recording duration.
 * - Handling various recording events (data available, stop, error).
 * - Assembling the final audio data into a Blob.
 * - Performing automatic resource cleanup (stopping media tracks, clearing intervals).
 *
 * The hook is designed to be robust, providing clear error states and checking for
 * browser support. It aims for optimal speech recording quality by configuring the
 * audio stream with echo cancellation and noise suppression.
 *
 * @module hooks/useVoiceRecorder
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder_API
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Describes the state and control functions returned by the {@link useVoiceRecorder} hook.
 */
interface UseVoiceRecorderReturn {
  /**
   * A boolean state indicating if the recording is currently active.
   * `true` when recording, `false` otherwise.
   */
  isRecording: boolean;

  /**
   * A boolean state indicating if the active recording is paused.
   * `true` when paused, `false` otherwise.
   */
  isPaused: boolean;

  /**
   * The recorded audio data as a Blob object.
   * This state is populated after `stopRecording` is called and the recording is fully processed.
   * It will be `null` before the first recording or while a recording is in progress.
   * The Blob is in 'audio/webm' format, making it suitable for use with APIs like Chrome AI.
   */
  audioBlob: Blob | null;

  /**
   * The elapsed duration of the current or last recording, in whole seconds.
   * This state updates every second while recording is active.
   */
  recordingDuration: number;

  /**
   * A string containing an error message if an issue occurred, or `null` if there are no errors.
   * This can report issues like lack of browser support, microphone permission denial, or recording failures.
   */
  error: string | null;

  /**
   * A boolean indicating whether the browser has the necessary APIs (`MediaRecorder`, `getUserMedia`) to support recording.
   * This is checked once on component mount.
   */
  isSupported: boolean;

  /**
   * Asynchronously starts the audio recording process.
   *
   * @description
   * This function requests microphone access from the user. If permission is granted,
   * it initializes a `MediaRecorder` instance and begins capturing audio.
   * It resets any previous recording data and error states.
   *
   * @returns {Promise<void>} A promise that resolves when the recording has successfully started.
   *
   * @throws Will set the `error` state if microphone access is denied, no microphone is found,
   * or another error occurs during initialization. It does not throw a JavaScript error but updates the hook's `error` state.
   *
   * @example
   * ```typescript
   * const { startRecording, error } = useVoiceRecorder();
   *
   * const handleRecordClick = async () => {
   *   await startRecording();
   *   if (error) {
   *     console.error('Failed to start recording:', error);
   *   }
   * };
   * ```
   */
  startRecording: () => Promise<void>;

  /**
   * Stops the current audio recording.
   *
   * @description
   * This function stops the `MediaRecorder` instance. The `onstop` event handler
   * will then process the collected audio chunks, create a Blob, and update the `audioBlob` state.
   * It also stops the recording duration timer and cleans up the media stream.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * const { stopRecording, audioBlob } = useVoiceRecorder();
   *
   * // In a component effect:
   * useEffect(() => {
   *   if (audioBlob) {
   *     console.log('Recording stopped. Blob is available:', audioBlob);
   *     // You can now upload or play the audioBlob
   *   }
   * }, [audioBlob]);
   *
   * // In an event handler:
   * const handleStopClick = () => {
   *   stopRecording();
   * };
   * ```
   */
  stopRecording: () => void;

  /**
   * Pauses the currently active recording.
   *
   * @description
   * If a recording is in progress and not already paused, this function will pause it
   * and also stop the duration timer.
   *
   * @returns {void}
   */
  pauseRecording: () => void;

  /**
   * Resumes a previously paused recording.
   *
   * @description
   * If a recording is paused, this function will resume it and restart the duration timer.
   *
   * @returns {void}
   */
  resumeRecording: () => void;

  /**
   * Clears the recorded audio data and resets associated state.
   *
   * @description
   * This function sets `audioBlob` to `null`, resets `recordingDuration` to 0,
   * and clears any existing error messages. It does not affect an active recording session.
   * Useful for when the user wants to discard a finished recording and start fresh.
   *
   * @returns {void}
   */
  clearRecording: () => void;

  /**
   * Cancels the active recording session immediately.
   *
   * @description
   * This function stops the recording without processing the audio data, meaning `audioBlob` will not be created.
   * It resets all recording-related state and releases the microphone.
   *
   * @returns {void}
   */
  cancelRecording: () => void;
}

/**
 * A custom React hook for managing voice recording functionality.
 *
 * @description
 * This hook abstracts the complexity of using the `MediaRecorder` API for audio recording.
 * It manages state for recording status, pause status, recording duration, the final audio Blob,
 * and any errors that occur. It uses `useRef` to hold instances of `MediaRecorder`, the media stream,
 * and other non-state variables to prevent re-renders. `useEffect` is used for checking browser
 * support on mount and for cleaning up resources (media stream, interval timers) when the component unmounts.
 *
 * All control functions (`startRecording`, `stopRecording`, etc.) are wrapped in `useCallback`
 * for performance optimization, preventing them from being recreated on every render unless their dependencies change.
 *
 * @returns {UseVoiceRecorderReturn} An object containing the recording state and control functions.
 *
 * @example
 * ```tsx
 * import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
 * import { useEffect } from 'react';
 *
 * function VoiceRecorderComponent() {
 *   const {
 *     isRecording,
 *     isPaused,
 *     audioBlob,
 *     recordingDuration,
 *     startRecording,
 *     stopRecording,
 *     pauseRecording,
 *     resumeRecording,
 *     error,
 *     isSupported
 *   } = useVoiceRecorder();
 *
 *   useEffect(() => {
 *     if (audioBlob) {
 *       // e.g., upload the blob or play it
 *       console.log(`New recording available: ${URL.createObjectURL(audioBlob)}`);
 *     }
 *   }, [audioBlob]);
 *
 *   if (!isSupported) {
 *     return <p>Audio recording is not supported in your browser.</p>;
 *   }
 *
 *   if (error) {
 *     return <p>Error: {error}</p>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Recording: {isRecording ? 'Yes' : 'No'}, Paused: {isPaused ? 'Yes' : 'No'}</p>
 *       <p>Duration: {recordingDuration}s</p>
 *       <button onClick={startRecording} disabled={isRecording}>
 *         Start Recording
 *       </button>
 *       <button onClick={stopRecording} disabled={!isRecording}>
 *         Stop Recording
 *       </button>
 *       <button onClick={pauseRecording} disabled={!isRecording || isPaused}>
 *         Pause
 *       </button>
 *       <button onClick={resumeRecording} disabled={!isRecording || !isPaused}>
 *         Resume
 *       </button>
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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

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

        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

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
      mediaRecorder.start(100); 
      setIsRecording(true);

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
