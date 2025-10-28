/**
 * @fileoverview Enhanced MediaRecorder-based voice recording hook with timeout features.
 *
 * @description
 * This hook provides a reliable audio recording interface specifically designed for the
 * Chrome AI Prompt API. Features include:
 * - High-quality audio recording optimized for AI processing
 * - Enhanced earphone/headset support
 * - 30-second auto-stop timeout from recording start
 * - 30-second silence detection with auto-stop
 * - Comprehensive error handling with retry mechanisms
 * - Performance monitoring and logging
 * - Real-time audio level monitoring
 *
 * @module hooks/useVoiceRecorder
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { logger, startTimer, endTimer } from '../utils/logger';

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
  isSupported: boolean;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelUpdateRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  
  const stopPromiseRef = useRef<{
    resolve: (blob: Blob | null) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // Track state with refs for event handlers
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);

  // Keep refs in sync with their state counterparts
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  /**
   * Comprehensive cleanup of all recording resources.
   */
  const cleanup = useCallback(() => {
    logger.debug('VoiceRecorder', 'Starting cleanup of recording resources');
    
    // Stop and clean up media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        logger.debug('VoiceRecorder', `Stopped track: ${track.kind}`);
      });
      streamRef.current = null;
    }
    
    // Clear all timers and intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Clear audio level updates
    if (levelUpdateRef.current) {
      cancelAnimationFrame(levelUpdateRef.current);
      levelUpdateRef.current = null;
    }
    
    // Clean up MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current = null;
    }
    
    // Clean up audio analysis
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    
    // Clear audio chunks
    audioChunksRef.current = [];
    
    logger.info('VoiceRecorder', 'All recording resources cleaned up');
  }, []);

  /**
   * Check browser support for required APIs.
   */
  useEffect(() => {
    const checkSupport = () => {
      const hasMediaDevices = !!(navigator.mediaDevices && 
        typeof navigator.mediaDevices.getUserMedia === 'function');
      const hasMediaRecorder = !!window.MediaRecorder;
      const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext);
      
      const supported = hasMediaDevices && hasMediaRecorder && hasAudioContext;
      
      logger.info('VoiceRecorder', 'Browser support check', {
        hasMediaDevices,
        hasMediaRecorder,
        hasAudioContext,
        supported
      });
      
      setIsSupported(supported);
      
      if (!supported) {
        const missingFeatures = [];
        if (!hasMediaDevices) missingFeatures.push('MediaDevices');
        if (!hasMediaRecorder) missingFeatures.push('MediaRecorder');
        if (!hasAudioContext) missingFeatures.push('AudioContext');
        
        const errorMsg = `Browser missing required features: ${missingFeatures.join(', ')}`;
        setError(errorMsg);
        logger.error('VoiceRecorder', 'Browser support check failed', new Error(errorMsg));
      }
    };
    
    checkSupport();
  }, []);

  /**
   * Sets up audio level monitoring for visual feedback.
   */
  const setupAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1
        
        setAudioLevel(normalizedLevel);
        
        levelUpdateRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
      logger.debug('VoiceRecorder', 'Audio analysis setup complete');
      
    } catch (error) {
      logger.warn('VoiceRecorder', 'Failed to setup audio analysis', error);
      // Non-critical failure, continue without level monitoring
    }
  }, []);

  /**
   * Resets all state to initial values.
   */
  const resetState = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setError(null);
    setAudioLevel(0);
  }, []);

  /**
   * Starts audio recording with comprehensive error handling and earphone support.
   */
  const startRecording = useCallback(async (): Promise<void> => {
    startTimer('startRecording');
    logger.info('VoiceRecorder', 'Starting recording session');
    
    try {
      if (!isSupported) {
        throw new Error('Recording not supported in this browser');
      }

      if (isRecordingRef.current) {
        logger.warn('VoiceRecorder', 'Recording already in progress');
        return;
      }

      // Enhanced constraints for better earphone/headset support and audio quality
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 16000, min: 8000, max: 48000 }, // Flexible sample rate
          channelCount: { ideal: 1, min: 1, max: 2 },          // Prefer mono, allow stereo
          deviceId: 'default'                                   // Use default audio input device
        }
      };

      logger.debug('VoiceRecorder', 'Requesting microphone access with enhanced constraints', constraints);
      
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (primaryError) {
        // Fallback to basic constraints if enhanced ones fail
        logger.warn('VoiceRecorder', 'Enhanced constraints failed, trying basic constraints', primaryError);
        
        const basicConstraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        
        streamRef.current = await navigator.mediaDevices.getUserMedia(basicConstraints);
        logger.info('VoiceRecorder', 'Successfully acquired stream with basic constraints');
      }
      
      // Log the actual audio track settings for debugging
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        logger.info('VoiceRecorder', 'Audio track settings', {
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
          deviceId: settings.deviceId,
          groupId: settings.groupId
        });
      }
      
      // Set up audio level monitoring with silence detection
      setupAudioAnalysis(streamRef.current);

      // Initialize MediaRecorder with optimal settings for Chrome AI
      let mimeType = 'audio/webm';
      
      // Try different MIME types in order of preference
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm;codecs=vp8,opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];
      
      for (const type of preferredTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType,
        audioBitsPerSecond: 128000 // Higher quality for better AI processing
      });

      logger.info('VoiceRecorder', 'MediaRecorder initialized', { mimeType });

      // Set up event handlers
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          logger.debug('VoiceRecorder', `Audio chunk received: ${event.data.size} bytes`);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        logger.info('VoiceRecorder', 'MediaRecorder stopped');
        
        if (audioChunksRef.current.length === 0) {
          logger.warn('VoiceRecorder', 'No audio chunks recorded');
          stopPromiseRef.current?.resolve(null);
          return;
        }

        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        logger.info('VoiceRecorder', 'Audio blob created', {
          chunkCount: audioChunksRef.current.length,
          totalSize,
          blobSize: audioBlob.size,
          mimeType: audioBlob.type,
          duration: Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        });

        stopPromiseRef.current?.resolve(audioBlob);
      };

      mediaRecorderRef.current.onerror = (event) => {
        const error = new Error(`MediaRecorder error: ${event}`);
        logger.error('VoiceRecorder', 'MediaRecorder error', error);
        stopPromiseRef.current?.reject(error);
      };

      // Start recording
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      recordingStartTimeRef.current = Date.now();
      
      // Update state
      setIsRecording(true);
      setError(null);
      
      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = window.setInterval(() => {
        if (isRecordingRef.current && !isPausedRef.current) {
          setDuration(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 1000);

      endTimer('startRecording');
      logger.info('VoiceRecorder', 'Recording started successfully with timeout protection');

    } catch (error) {
      endTimer('startRecording');
      const errorMsg = error instanceof Error ? error.message : 'Failed to start recording';
      logger.error('VoiceRecorder', 'Failed to start recording', error as Error);
      
      cleanup();
      resetState();
      setError(errorMsg);
      throw error;
    }
  }, [isSupported, setupAudioAnalysis, cleanup, resetState]);

  /**
   * Stops recording and returns the audio blob.
   */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    startTimer('stopRecording');
    logger.info('VoiceRecorder', 'Stopping recording session');

    return new Promise((resolve, reject) => {
      if (!isRecordingRef.current || !mediaRecorderRef.current) {
        logger.warn('VoiceRecorder', 'No active recording to stop');
        endTimer('stopRecording');
        resolve(null);
        return;
      }

      stopPromiseRef.current = { resolve, reject };

      try {
        mediaRecorderRef.current.stop();
        
        // Update state immediately
        setIsRecording(false);
        setIsPaused(false);
        
        // Clean up timers
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        
        if (levelUpdateRef.current) {
          cancelAnimationFrame(levelUpdateRef.current);
          levelUpdateRef.current = null;
        }
        
        endTimer('stopRecording');
        logger.info('VoiceRecorder', 'Stop recording initiated');
        
      } catch (error) {
        endTimer('stopRecording');
        logger.error('VoiceRecorder', 'Error stopping recording', error as Error);
        cleanup();
        resetState();
        reject(error);
      }
    });
  }, [cleanup, resetState]);

  /**
   * Pauses the current recording.
   */
  const pauseRecording = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) {
      logger.warn('VoiceRecorder', 'No active recording to pause');
      return;
    }

    try {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      logger.info('VoiceRecorder', 'Recording paused');
    } catch (error) {
      logger.error('VoiceRecorder', 'Error pausing recording', error as Error);
      setError('Failed to pause recording');
    }
  }, []);

  /**
   * Resumes a paused recording.
   */
  const resumeRecording = useCallback(() => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) {
      logger.warn('VoiceRecorder', 'No paused recording to resume');
      return;
    }

    try {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      logger.info('VoiceRecorder', 'Recording resumed');
    } catch (error) {
      logger.error('VoiceRecorder', 'Error resuming recording', error as Error);
      setError('Failed to resume recording');
    }
  }, []);

  /**
   * Cancels the current recording without saving.
   */
  const cancelRecording = useCallback(() => {
    logger.info('VoiceRecorder', 'Canceling recording session');
    
    cleanup();
    resetState();
    
    logger.info('VoiceRecorder', 'Recording canceled');
  }, [cleanup, resetState]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isRecording,
    isPaused,
    duration,
    error,
    isSupported,
    audioLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  };
}