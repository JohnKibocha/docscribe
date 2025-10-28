/**
 * @fileoverview Production-grade voice dictation interface with stable WebSpeech and AI processing.
 *
 * CRITICAL: This component follows the stable architecture patterns to prevent Chrome Canary crashes:
 * - Uses StableWebSpeechHandler with interimResults=false to prevent browser flooding
 * - Processes AI on main thread with async yielding to prevent UI freezing
 * - Implements real-time chunking for responsive transcription
 * - Provides comprehensive error handling and user feedback
 * - Supports surgical-length procedures with HH:MM:SS duration tracking
 *
 * Features:
 * - WebSpeechAPI auto-restart with 2-minute silence detection
 * - Pause/resume functionality independent of auto-stop timer
 * - Real-time audio monitoring using AudioContext/AnalyserNode
 * - Duration tracking suitable for multi-hour surgical procedures
 * - Intelligent silence detection with visual countdown
 *
 * Architecture:
 * - Main Thread: UI, WebSpeechAPI, AI processing with yielding
 * - Real-time chunking for immediate transcript display
 * - Fallback AI processing when Web Workers unavailable
 * - Production-ready error handling and status management
 *
 * @module components/VoiceDictation
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { Mic, Square, Loader2, CheckCircle, XCircle, AlertCircle, Pause, Play } from 'lucide-react';
import { StableWebSpeechHandler, isWebSpeechAvailable } from '../services/webSpeechAPI';
import { MainThreadAIProcessor } from '../services/mainThreadAI';
import { processMedicalNote } from '../services/medicalAI';
import { extractAndParseJSON } from '../utils/jsonParser';
import { useSessionStore } from '../store/sessionStore';
import { useToast } from '../hooks/use-toast';
import { ExportManager } from './ExportManager';
import type { MedicalNote, NoteFormat } from '../types';

// Constants for audio monitoring and auto-stop functionality
const SILENCE_TIMEOUT_MS = 120000; // 2 minutes in milliseconds
const SILENCE_CHECK_INTERVAL_MS = 1000; // Update countdown every 1 second

/**
 * Status states for the voice dictation interface.
 */
type DictationStatus = 'idle' | 'initializing' | 'listening' | 'paused' | 'processing' | 'complete' | 'error';

/**
 * Audio monitoring state for intelligent auto-stop functionality.
 */
interface AudioMonitoringState {
  isMonitoring: boolean;
  lastSoundTime: number;
  silenceTimerId: number | null;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  dataArray: Uint8Array | null;
  soundThreshold: number;
}

/**
 * Production-grade voice dictation component with stable WebSpeech and AI processing.
 * 
 * Features:
 * - Crash-proof WebSpeech (interimResults=false) to prevent Chrome Canary crashes
 * - Real-time chunking for immediate transcript display
 * - Main thread AI processing with async yielding to prevent UI blocking
 * - Comprehensive error handling and user feedback
 * - Production-ready status management and accessibility
 * - Integration with session store for note persistence
 *
 * @returns {JSX.Element} Production voice dictation interface
 */
export function VoiceDictation() {
  const { currentNote, addNote } = useSessionStore();
  const { toast } = useToast();

  // Component state
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to record');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isWebSpeechSupported, setIsWebSpeechSupported] = useState(false);
  const [isAIAvailable, setIsAIAvailable] = useState(false);
  const [currentEncounterID, setCurrentEncounterID] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [silenceCountdown, setSilenceCountdown] = useState(0);

  // References for stable operation
  const speechHandlerRef = useRef<StableWebSpeechHandler | null>(null);
  const aiProcessorRef = useRef<MainThreadAIProcessor | null>(null);
  const isInitializedRef = useRef(false);
  const isAutoRestartingRef = useRef(false); // Track auto-restart state to prevent UI issues
  const audioMonitoringRef = useRef<AudioMonitoringState>({
    isMonitoring: false,
    lastSoundTime: 0,
    silenceTimerId: null,
    audioContext: null,
    analyser: null,
    dataArray: null,
    soundThreshold: 30 // Adjust based on testing
  });
  const durationTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null); // For silence countdown updates
  const mediaStreamRef = useRef<MediaStream | null>(null);

  /**
   * Initialize the component on mount - check capabilities and setup AI.
   * CRITICAL: This follows the stable initialization pattern to prevent crashes.
   */
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initializeComponent = async () => {
      try {
        setStatus('initializing');
        setStatusMessage('Checking browser capabilities...');

        // Check WebSpeech API support
        const speechSupported = isWebSpeechAvailable();
        setIsWebSpeechSupported(speechSupported);
        
        if (!speechSupported) {
          setStatus('error');
          setStatusMessage('Web Speech API not supported in this browser');
          toast({
            title: "Browser Not Supported",
            description: "Please use Chrome with WebSpeech enabled for voice dictation.",
            variant: "destructive"
          });
          return;
        }

        // Initialize AI processor
        setStatusMessage('Initializing AI processor...');
        aiProcessorRef.current = new MainThreadAIProcessor();
        
        // Set up AI processor callbacks
        aiProcessorRef.current.setOnTriageComplete((payload) => {
          setStatusMessage(`Encounter detected: ${payload.noteType} (${payload.context})`);
          toast({
            title: "Encounter Detected",
            description: `Processing as ${payload.noteType} note`,
          });
        });

        aiProcessorRef.current.setOnChunkUpdate((payload) => {
          // Update transcript from AI processing (cleaned and diarized)
          setCurrentTranscript(payload.fullTranscript);
        });

        aiProcessorRef.current.setOnFinalComplete((payload) => {
          handleFinalNoteComplete(payload);
        });

        aiProcessorRef.current.setOnError((payload) => {
          setStatus('error');
          setStatusMessage(`AI Error: ${payload.message}`);
          toast({
            title: "AI Processing Error",
            description: payload.message,
            variant: "destructive"
          });
        });

        // Initialize AI
        const aiInitialized = await aiProcessorRef.current.initialize();
        setIsAIAvailable(aiInitialized);
        
        if (aiInitialized) {
          setStatus('idle');
          setStatusMessage('Ready to record clinical notes');
          console.log('VoiceDictation: All systems initialized successfully');
        } else {
          setStatus('error');
          setStatusMessage('AI initialization failed - Chrome AI not available');
          toast({
            title: "AI Initialization Failed",
            description: "Chrome AI is not available. Please check your browser settings and AI flags.",
            variant: "destructive"
          });
        }
        
      } catch (error) {
        console.error('VoiceDictation initialization failed:', error);
        setStatus('error');
        setStatusMessage('Initialization failed');
        toast({
          title: "Initialization Error",
          description: "Failed to initialize voice dictation system",
          variant: "destructive"
        });
      }
    };

    initializeComponent();
    
    return () => {
      // Cleanup on unmount
      if (speechHandlerRef.current) {
        speechHandlerRef.current.destroy();
      }
      if (aiProcessorRef.current) {
        aiProcessorRef.current.destroy();
      }
      stopAudioMonitoring();
      stopSilenceTimer();
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [toast]);

  /**
   * Start audio level monitoring for intelligent auto-stop functionality.
   * CRITICAL: This monitors actual audio levels, not just speech recognition events.
   */
  const startAudioMonitoring = useCallback(async (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      audioMonitoringRef.current = {
        isMonitoring: true,
        lastSoundTime: Date.now(),
        silenceTimerId: null,
        audioContext,
        analyser,
        dataArray,
        soundThreshold: 30
      };
      
      // Start monitoring loop
      monitorAudioLevels();
      
      console.log('Audio monitoring started with 2-minute auto-stop');
      
    } catch (error) {
      console.error('Failed to start audio monitoring:', error);
    }
  }, []);

  /**
   * Monitor audio levels in real-time to detect sound vs silence.
   * Uses RAF for smooth monitoring without blocking the UI.
   */
  const monitorAudioLevels = useCallback(() => {
    const monitoring = audioMonitoringRef.current;
    
    if (!monitoring.isMonitoring || !monitoring.analyser || !monitoring.dataArray) {
      return;
    }
    
    // Create a new Uint8Array with proper ArrayBuffer type
    const dataBuffer = new Uint8Array(monitoring.analyser.frequencyBinCount);
    monitoring.analyser.getByteFrequencyData(dataBuffer);
    
    // Calculate average audio level
    const average = dataBuffer.reduce((sum, value) => sum + value, 0) / dataBuffer.length;
    
    // Check if sound detected above threshold
    if (average > monitoring.soundThreshold) {
      const now = Date.now();
      
      // Only reset timer if it's been more than 5 seconds since last reset (debounce)
      if (now - monitoring.lastSoundTime > 5000) {
        monitoring.lastSoundTime = now;
        console.log('Sound detected, resetting silence timer');
        resetSilenceTimer(); // Actually reset the silence timer
      }
    }
    
    // Continue monitoring if still active
    if (monitoring.isMonitoring) {
      requestAnimationFrame(monitorAudioLevels);
    }
  }, []);

  /**
   * Stop audio monitoring and cleanup resources.
   */
  const stopAudioMonitoring = useCallback(() => {
    const monitoring = audioMonitoringRef.current;
    
    monitoring.isMonitoring = false;
    
    if (monitoring.silenceTimerId) {
      clearTimeout(monitoring.silenceTimerId);
      monitoring.silenceTimerId = null;
    }
    
    if (monitoring.audioContext) {
      monitoring.audioContext.close();
      monitoring.audioContext = null;
    }
    
    monitoring.analyser = null;
    monitoring.dataArray = null;
    setSilenceCountdown(0);
    
    console.log('Audio monitoring stopped');
  }, []);

  /**
   * Start the 2-minute silence timer that will auto-stop recording.
   */
  const startSilenceTimer = useCallback(() => {
    const monitoring = audioMonitoringRef.current;
    
    // Clear any existing silence timer
    if (monitoring.silenceTimerId) {
      clearTimeout(monitoring.silenceTimerId);
    }
    
    // Clear any existing countdown timer
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    
    // Set the main silence timeout (2 minutes)
    monitoring.silenceTimerId = window.setTimeout(() => {
      console.log('Silence timeout reached, auto-stopping recording');
      handleStopRecording();
    }, SILENCE_TIMEOUT_MS);
    
    // Start countdown display timer
    setSilenceCountdown(SILENCE_TIMEOUT_MS / 1000); // Convert to seconds
    countdownTimerRef.current = window.setInterval(() => {
      setSilenceCountdown(prev => {
        const newValue = prev - 1;
        if (newValue <= 0) {
          // Countdown reached zero, clear the interval
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return newValue;
      });
    }, SILENCE_CHECK_INTERVAL_MS);
    
    console.log('Silence timer started - 2 minute auto-stop enabled');
  }, []);

  /**
   * Reset the silence timer when sound is detected.
   */
  const resetSilenceTimer = useCallback(() => {
    console.log('Sound detected, resetting silence timer');
    startSilenceTimer(); // Restart the timer
  }, [startSilenceTimer]);

  /**
   * Stop and clear the silence timer.
   */
  const stopSilenceTimer = useCallback(() => {
    const monitoring = audioMonitoringRef.current;
    
    if (monitoring.silenceTimerId) {
      clearTimeout(monitoring.silenceTimerId);
      monitoring.silenceTimerId = null;
    }
    
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    
    setSilenceCountdown(0);
    console.log('Silence timer stopped');
  }, []);

  /**
   * Start recording duration timer.
   */
  const startDurationTimer = useCallback(() => {
    setRecordingDuration(0);
    durationTimerRef.current = window.setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  }, []);

  /**
   * Stop recording duration timer.
   */
  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  /**
   * Format duration in HH:MM:SS format for surgical and long procedures.
   * CRITICAL: Medical procedures can last many hours, especially surgeries.
   */
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Pause the current recording session.
   * CRITICAL: This pauses transcription but keeps audio monitoring active.
   */
  const handlePauseRecording = useCallback(async () => {
    if (status !== 'listening') return;
    
    try {
      setStatus('paused');
      
      // Stop speech recognition but keep audio monitoring active
      if (speechHandlerRef.current) {
        speechHandlerRef.current.stop();
      }
      
      console.log('Recording paused, audio monitoring continues');
      
    } catch (error) {
      console.error('Error pausing recording:', error);
      toast({
        title: "Pause Error",
        description: "Failed to pause recording",
        variant: "destructive",
      });
    }
  }, [status, toast]);

  /**
   * Resume the paused recording session.
   * CRITICAL: This resumes transcription and resets silence timer.
   */
  const handleResumeRecording = useCallback(async () => {
    if (status !== 'paused') return;
    
    try {
      setStatus('listening');
      
      // Restart speech recognition
      if (speechHandlerRef.current) {
        speechHandlerRef.current.start();
      }
      
      // Reset audio monitoring timer when resuming
      if (audioMonitoringRef.current.isMonitoring) {
        audioMonitoringRef.current.lastSoundTime = Date.now();
        console.log('Recording resumed, silence timer reset');
      }
      
      console.log('Recording resumed');
      
    } catch (error) {
      console.error('Error resuming recording:', error);
      toast({
        title: "Resume Error", 
        description: "Failed to resume recording",
        variant: "destructive",
      });
      setStatus('error');
    }
  }, [status, toast]);

  /**
   * Initialize the stable WebSpeech handler with crash-prevention settings.
   * CRITICAL: Uses interimResults=false to prevent Chrome Canary crashes.
   */
  const initializeStableWebSpeech = useCallback(() => {
    try {
      if (speechHandlerRef.current) {
        speechHandlerRef.current.destroy();
      }

      speechHandlerRef.current = new StableWebSpeechHandler({
        continuous: true,
        language: 'en-US',
        maxAlternatives: 1
      });

      // Set up status updates
      speechHandlerRef.current.onStatus((statusMsg) => {
        setStatusMessage(statusMsg);
        
        // CRITICAL: Manage auto-restart state to prevent UI issues
        if (statusMsg.includes('Auto-restarting')) {
          isAutoRestartingRef.current = true;
          console.log('WebSpeech auto-restarting, maintaining listening state and UI controls');
          // Don't change status - the component should remain in 'listening' state
          // This ensures the buttons don't disappear during restart
        } else if (statusMsg.includes('Listening')) {
          // When actually listening again after restart, clear auto-restart flag
          isAutoRestartingRef.current = false;
          if (status !== 'listening' && currentEncounterID) {
            console.log('WebSpeech confirmed listening, setting status to listening');
            setStatus('listening');
          }
        } else if (statusMsg.includes('Recording stopped') && !currentEncounterID && !isAutoRestartingRef.current) {
          // Only change to idle if we don't have an active encounter and not auto-restarting
          setStatus('idle');
        }
      });

      // Set up error handling
      speechHandlerRef.current.onErrorCallback((error) => {
        console.error('WebSpeech error:', error);
        
        // CRITICAL: Don't change status to error during auto-restart or for transient/normal errors
        if (isAutoRestartingRef.current) {
          console.log('Ignoring error during auto-restart:', error);
          setStatusMessage('Reconnecting...');
        } else if (error.includes('no-speech')) {
          // no-speech is normal silence, not an error - just update status message
          console.log('No speech detected - normal silence period');
          setStatusMessage('Listening... (no speech detected)');
          // Don't change status to error for no-speech
        } else if (!error.includes('aborted') && !error.includes('network') && !error.includes('not-allowed')) {
          // Only real errors that need user attention
          setStatus('error');
          setStatusMessage(`Speech error: ${error}`);
          toast({
            title: "Speech Recognition Error",
            description: error,
            variant: "destructive"
          });
        } else {
          console.log('Transient WebSpeech error, ignoring:', error);
          setStatusMessage('Reconnecting...');
        }
      });

      console.log('StableWebSpeech initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize stable WebSpeech:', error);
      setStatus('error');
      setStatusMessage('Failed to initialize speech recognition');
      toast({
        title: "Speech Initialization Error",
        description: "Failed to set up speech recognition",
        variant: "destructive"
      });
    }
  }, [currentEncounterID, toast]);

  /**
   * Handle completion of final note processing from AI.
   * Creates a properly structured MedicalNote, processes with medical AI services,
   * and saves to session store with enhanced summaries and translations.
   * CRITICAL: Allows immediate new recordings while processing continues.
   */
  const handleFinalNoteComplete = useCallback(async (payload: any) => {
    try {
      console.log('Processing final note:', payload);
      
      // Use robust JSON extraction to handle code fences and raw JSON
      const finalNote = extractAndParseJSON(payload.finalNoteJSON);
      
      // Create properly structured MedicalNote
      const noteId = `note_${Date.now()}`;
      const baseMedicalNote: MedicalNote = {
        id: noteId,
        timestamp: new Date().toISOString(),
        encounterType: finalNote.encounterType || 'SOAP',
        rawTranscript: payload.fullTranscript,
        cleanedTranscript: payload.fullTranscript,
        labeledTranscript: [], // TODO: Extract from diarized transcript
        refinedNote: {
          format: (finalNote.encounterType || 'SOAP') as NoteFormat,
          sections: finalNote.noteContent?.sections || []
        },
        clinicalSummary: {
          chiefComplaint: finalNote.noteContent?.chiefComplaint || '',
          keyFindings: finalNote.noteContent?.keyFindings || '',
          plan: finalNote.noteContent?.plan || '',
          followUp: finalNote.noteContent?.followUp || ''
        }
      };

      // Save the base note immediately to allow new recordings
      addNote(baseMedicalNote);

      // Show initial success notification
      toast({
        title: "Medical Note Complete",
        description: `Your ${finalNote.encounterType || 'SOAP'} note has been generated and saved.`,
        variant: "default"
      });

      console.log('Base note saved successfully:', baseMedicalNote);

      // Process enhanced medical AI features in background
      try {
        const medicalAIResult = await processMedicalNote(baseMedicalNote, {
          generateSummary: true,
          summaryType: 'both',
          targetLanguage: undefined, // TODO: Get from user preferences
          sourceLanguage: 'en'
        });

        // Update the note with AI-enhanced content
        if (medicalAIResult.patientSummary || medicalAIResult.clinicalSummary) {
          const enhancedNote: MedicalNote = {
            ...baseMedicalNote,
            patientSummary: medicalAIResult.patientSummary,
            clinicalSummaryText: medicalAIResult.clinicalSummary,
            translatedSummary: medicalAIResult.translatedPatientSummary,
            targetLanguage: medicalAIResult.targetLanguage,
            aiProcessingTime: medicalAIResult.processingTime
          };

          // Update the stored note with enhanced content
          addNote(enhancedNote);

          // Show enhancement completion notification
          if (medicalAIResult.patientSummary) {
            toast({
              title: "AI Summary Generated",
              description: "Patient-friendly summary has been added to your note",
              variant: "default"
            });
          }

          console.log('Enhanced note with AI summaries:', enhancedNote);
        }

        // Log any warnings from medical AI processing
        if (medicalAIResult.warnings.length > 0) {
          console.warn('Medical AI processing warnings:', medicalAIResult.warnings);
        }

      } catch (aiError) {
        console.error('Medical AI enhancement failed:', aiError);
        // Don't show error to user - the base note is already saved
        // This is a non-critical enhancement that failed
      }
      
      // CRITICAL: Don't change component status - allow immediate new recordings
      // The component should remain in 'idle' state for concurrent processing
      
    } catch (error) {
      console.error('Failed to process final note:', error);
      toast({
        title: "Note Processing Error",
        description: "Failed to save the completed medical note",
        variant: "destructive"
      });
    }
  }, [addNote, toast]);

  /**
   * Start a new recording session with full error handling.
   * CRITICAL: Follows stable patterns to prevent crashes.
   */
  const handleStartRecording = useCallback(async () => {
    if (!isWebSpeechSupported || !isAIAvailable) {
      toast({
        title: "System Not Ready",
        description: "Speech recognition or AI processing not available",
        variant: "destructive"
      });
      return;
    }

    try {
      // CRITICAL: Reset any error state from previous sessions
      isAutoRestartingRef.current = false;
      setStatus('initializing');
      setStatusMessage('Initializing recording...');
      
      // Get microphone access for audio monitoring
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });
      
      // Store the media stream for pause/resume functionality
      mediaStreamRef.current = stream;
      
      // Start audio monitoring for intelligent auto-stop
      await startAudioMonitoring(stream);
      
      // Start recording duration timer
      startDurationTimer();
      
      // Initialize WebSpeech if not already done
      if (!speechHandlerRef.current) {
        initializeStableWebSpeech();
      }
      
      if (!speechHandlerRef.current || !aiProcessorRef.current) {
        toast({
          title: "Not Ready",
          description: "Speech recognition or AI processor not initialized",
          variant: "destructive"
        });
        return;
      }

      // Generate unique encounter ID
      const encounterID = `enc_${Date.now()}`;
      setCurrentEncounterID(encounterID);
      
      // Reset state for new recording
      setCurrentTranscript('');
      setStatus('listening');
      setStatusMessage('Listening... Speak clearly for medical transcription');
      
      // Initialize encounter in AI processor
      aiProcessorRef.current.startEncounter(encounterID);
      
      // Update chunk processing to use the fresh encounterID
      if (speechHandlerRef.current) {
        speechHandlerRef.current.onChunk((chunk) => {
          console.log('Stable chunk received:', chunk.transcript);
          
          // DEBUG: Check AI processor state
          console.log('CHUNK FORWARDING DEBUG:', {
            encounterID: encounterID, // Use fresh encounterID, not state
            hasAIProcessor: !!aiProcessorRef.current,
            chunkLength: chunk.transcript.length
          });
          
          // Update real-time display (raw speech chunks)
          setCurrentTranscript(prev => {
            const newTranscript = prev + (prev ? ' ' : '') + chunk.transcript;
            return newTranscript;
          });
          
          // Send chunk to AI processor for cleaning and structuring
          if (encounterID && aiProcessorRef.current) {
            console.log('FORWARDING CHUNK to AI processor:', chunk.transcript.substring(0, 50) + '...');
            aiProcessorRef.current.processChunk(encounterID, chunk.transcript);
          } else {
            console.error('CHUNK NOT FORWARDED:', {
              missingEncounterID: !encounterID,
              missingAIProcessor: !aiProcessorRef.current
            });
          }
        });
      }
      
      // Start stable speech recognition
      speechHandlerRef.current.start();
      
      // Start silence timer for auto-stop after 2 minutes
      startSilenceTimer();
      
      console.log('Started new recording session with audio monitoring and silence timer:', encounterID);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      
      // Clean up on error
      stopAudioMonitoring();
      stopSilenceTimer();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      setStatus('error');
      setStatusMessage('Failed to start recording');
      toast({
        title: "Recording Error",
        description: "Failed to start speech recognition",
        variant: "destructive"
      });
    }
  }, [isWebSpeechSupported, isAIAvailable, initializeStableWebSpeech, toast, startAudioMonitoring, startDurationTimer]);

  /**
   * Stop recording and generate the final medical note.
   * CRITICAL: Allows immediate new recordings while AI processes in background.
   */
  const handleStopRecording = useCallback(() => {
    if (!speechHandlerRef.current || !aiProcessorRef.current || !currentEncounterID) {
      return;
    }

    try {
      // Clear auto-restart flag to prevent any lingering restart behavior
      isAutoRestartingRef.current = false;
      
      // Stop speech recognition
      speechHandlerRef.current.stop();
      
      // Stop audio monitoring and cleanup
      stopAudioMonitoring();
      stopDurationTimer();
      stopSilenceTimer();
      
      // Clean up media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Request final note generation from AI processor (background processing)
      aiProcessorRef.current.generateFinalNote(currentEncounterID);
      
      // Reset encounter ID and status for immediate new recording capability
      setCurrentEncounterID(null);
      setStatus('idle');
      setStatusMessage('Ready for next recording');
      
      toast({
        title: "Processing Note",
        description: "Generating your medical note in the background. You can start a new recording immediately.",
      });
      
      console.log('Stopped recording, processing final note in background');
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setStatus('error');
      setStatusMessage('Failed to stop recording');
      toast({
        title: "Stop Recording Error",
        description: "Failed to properly stop the recording",
        variant: "destructive"
      });
    }
  }, [currentEncounterID, toast]);

  /**
   * Get the appropriate icon for the current status.
   */
  const getStatusIcon = () => {
    switch (status) {
      case 'initializing':
        return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'listening':
        return <Mic className="w-6 h-6 text-red-500 animate-pulse" />;
      case 'paused':
        return <Pause className="w-6 h-6 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Mic className="w-6 h-6 text-gray-500" />;
    }
  };

  /**
   * Get the appropriate button styling for the current status.
   */
  const getButtonClass = () => {
    const baseClass = "flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 ";
    
    switch (status) {
      case 'initializing':
        return baseClass + "bg-blue-100 text-blue-500 cursor-not-allowed";
      case 'listening':
        return baseClass + "bg-red-500 hover:bg-red-600 text-white shadow-lg scale-110";
      case 'paused':
        return baseClass + "bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg";
      case 'processing':
        return baseClass + "bg-blue-500 text-white cursor-not-allowed";
      case 'complete':
        return baseClass + "bg-green-100 text-green-500 cursor-not-allowed";
      case 'error':
        return baseClass + "bg-red-100 text-red-500 cursor-not-allowed";
      default:
        return baseClass + "bg-gray-100 hover:bg-gray-200 text-gray-700";
    }
  };

  /**
   * Check if the recording button should be disabled.
   * Allow clicking when in error state to enable recovery.
   */
  const isRecordingDisabled = () => {
    return !isWebSpeechSupported || !isAIAvailable || 
           status === 'initializing' || status === 'processing';
    // NOTE: Removed 'error' from disabled states to allow recovery by clicking
  };

  return (
    <div className="flex flex-col items-center space-y-6 p-8">
      {/* Status Display */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Voice Dictation
        </h2>
        <p className="text-gray-600 mb-2">{statusMessage}</p>
        
        {/* System Status Indicators */}
        <div className="flex items-center justify-center space-x-4 text-sm">
          <div className={`flex items-center space-x-1 ${isWebSpeechSupported ? 'text-green-600' : 'text-red-600'}`}>
            {isWebSpeechSupported ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>Speech Recognition</span>
          </div>
          <div className={`flex items-center space-x-1 ${isAIAvailable ? 'text-green-600' : 'text-red-600'}`}>
            {isAIAvailable ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>AI Processing</span>
          </div>
        </div>
      </div>

      {/* Main Recording Button */}
      <div className="relative">
        <button
          onClick={
            status === 'listening' ? handleStopRecording : 
            status === 'paused' ? handleResumeRecording : 
            // For idle, error, complete, or any other state, start recording
            handleStartRecording
          }
          disabled={isRecordingDisabled()}
          className={getButtonClass()}
          aria-label={
            status === 'listening' ? 'Stop recording' : 
            status === 'paused' ? 'Resume recording' :
            status === 'error' ? 'Reset and start recording' :
            'Start recording'
          }
        >
          {getStatusIcon()}
        </button>
        
        {(status === 'listening' || status === 'paused') && (
          <div className={`absolute inset-0 rounded-full border-4 ${
            status === 'listening' ? 'border-red-300 animate-ping' : 'border-yellow-300 animate-pulse'
          }`} />
        )}
      </div>

      {/* Recording Controls */}
      {(status === 'listening' || status === 'paused') && (
        <div className="flex flex-col items-center space-y-4">
          {/* Duration and Countdown Display */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2 text-gray-600">
              <span className="font-medium">Duration:</span>
              <span className="font-mono text-blue-600" title="Recording duration in hours:minutes:seconds format">{formatDuration(recordingDuration)}</span>
            </div>
            {silenceCountdown > 0 && (
              <div className="flex items-center space-x-2 text-gray-600">
                <span className="font-medium">Auto-stop in:</span>
                <span className="font-mono text-orange-600" title="Time remaining until auto-stop">{formatDuration(silenceCountdown)}</span>
              </div>
            )}
          </div>
          
          {/* Control Buttons */}
          <div className="flex space-x-4">
            {status === 'listening' && (
              <button
                onClick={handlePauseRecording}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                aria-label="Pause recording"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}
            
            {status === 'paused' && (
              <button
                onClick={handleResumeRecording}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                aria-label="Resume recording"
              >
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </button>
            )}
            
            <button
              onClick={handleStopRecording}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
              aria-label="Stop recording and generate note"
            >
              <Square className="w-4 h-4" />
              <span>Stop & Generate Note</span>
            </button>
          </div>
        </div>
      )}

      {/* Real-time Transcript Display */}
      {currentTranscript && (
        <div className="w-full max-w-2xl">
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            Live Transcript
          </h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {currentTranscript}
            </div>
          </div>
        </div>
      )}

      {/* System Warnings */}
      {(!isWebSpeechSupported || !isAIAvailable) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <h3 className="text-lg font-medium text-yellow-800 mb-1">
            System Requirements
          </h3>
          <div className="text-sm text-yellow-600 space-y-1">
            {!isWebSpeechSupported && (
              <p>• WebSpeech API not available - use Chrome with speech enabled</p>
            )}
            {!isAIAvailable && (
              <p>• Chrome AI not available - enable AI flags in chrome://flags</p>
            )}
          </div>
        </div>
      )}

      {/* Export Options */}
      {currentNote && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Medical Note Ready
          </h3>
          <p className="text-sm text-green-600 mb-4">
            Your {currentNote.encounterType || 'medical'} note has been generated and is ready for export.
          </p>
          <div className="space-y-3">
            <ExportManager 
              note={currentNote}
              trigger={
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Export Medical Note
                </button>
              }
            />
            <p className="text-xs text-green-600">
              Export as Word, PDF, or other formats
            </p>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="max-w-2xl text-center text-sm text-gray-500">
        <p>
          Click the microphone to start recording clinical notes. Speak clearly and naturally.
          The AI will process your speech in real-time and generate a structured medical note.
        </p>
        <p className="mt-2">
          <strong>Supports:</strong> SOAP notes, Progress notes, Operative reports, Consultations, and more.
        </p>
      </div>
    </div>
  );
}
