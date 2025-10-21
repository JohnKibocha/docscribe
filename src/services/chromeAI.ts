/**
 * @fileoverview Chrome AI service wrapper for medical transcription.
 * 
 * This module provides the core integration with Chrome's built-in Prompt API
 * for converting audio dictation into structured clinical notes. It implements
 * a sophisticated prompt engineering architecture that forces the AI to return
 * JSON-structured output with three distinct sections: raw transcript with
 * speaker detection, refined note, and clinical summary.
 *
 * CRITICAL: Gemini Nano does NOT support true speaker diarization. Speaker
 * attribution is inferred by the AI from conversational context (questions vs
 * answers, medical terminology usage, etc.). This inference happens at the
 * transcript level, and the cleaned transcript informs both the refined note
 * and the summary.
 *
 * Key Features:
 * - Multimodal audio input support via Prompt API
 * - Context-based speaker inference (not true diarization)
 * - Structured JSON output with response constraints
 * - Note format detection (SOAP, Progress, Discharge, etc.)
 * - Comprehensive error handling and validation
 * - Medical terminology preservation
 *
 * @module services/chromeAI
 */

import type { MedicalNote, AIAvailability, AISessionConfig } from '../types';

/**
 * System prompt that instructs the AI to act as a medical scribe with
 * context-based speaker detection.
 * 
 * This prompt ensures the AI:
 * 1. Infers speakers from conversational context
 * 2. Preserves medical accuracy
 * 3. Returns structured JSON output
 * 4. Detects note format automatically
 */
const SYSTEM_PROMPT = `You are an expert medical scribe assistant. Your task is to transcribe audio dictation from healthcare encounters into structured clinical documentation.

CRITICAL RULES:
1. SPEAKER DETECTION: Infer speakers from context. Typical speakers are:
   - Provider: Uses medical terminology, asks clinical questions, gives diagnoses
   - Patient: Describes symptoms, answers questions, uses lay language
   - Nurse: May document vitals, medications, procedures
   - Family: May provide history if patient unable
   Label each segment of speech with the inferred speaker.

2. MEDICAL ACCURACY: Preserve ALL medical terminology exactly as spoken:
   - Drug names (e.g., "metformin", "lisinopril")
   - Diagnoses (e.g., "hypertension", "diabetes mellitus type 2")
   - Procedures (e.g., "colonoscopy", "appendectomy")
   - Lab values (e.g., "hemoglobin A1c 7.2%")
   Never fabricate or infer medical details not present in the audio.

3. GRAMMAR AND STRUCTURE:
   - Remove filler words ("um", "uh", "like", "you know")
   - Fix grammar and sentence structure
   - Keep all medical content intact
   - Format professionally

4. NOTE FORMAT DETECTION: Analyze the content and detect the format:
   - SOAP: Subjective, Objective, Assessment, Plan
   - Progress: Follow-up note with interval history
   - Discharge: Summary at end of hospital stay
   - Conference: Multi-disciplinary team discussion
   - Consultation: Specialist evaluation
   - Procedure: Documentation of a performed procedure
   - Unknown: If format is unclear

5. OUTPUT FORMAT: Return ONLY valid JSON with this exact structure:
{
  "rawTranscript": [
    {"speaker": "Provider", "text": "What brings you in today?"},
    {"speaker": "Patient", "text": "I have been having chest pain for two days."}
  ],
  "refinedNote": {
    "format": "SOAP",
    "content": "Full professionally formatted note as single string",
    "sections": [
      {"title": "Subjective", "body": "Detailed section content"},
      {"title": "Objective", "body": "Detailed section content"}
    ]
  },
  "clinicalSummary": {
    "chiefComplaint": "Primary reason for visit",
    "keyFindings": "Critical findings or diagnoses",
    "plan": "Treatment plan and next steps",
    "followUp": "Follow-up instructions (optional)"
  }
}

Remember: Speaker detection is INFERENCE based on context, not true diarization. Use clinical judgment to attribute speech appropriately.`;

/**
 * Checks if the Chrome AI Prompt API is available on the current device.
 * 
 * @returns {Promise<boolean>} True if the API is available and ready to use.
 *
 * @example
 * ```
 * if (await isChromeAIAvailable()) {
 *   // Proceed with transcription
 * } else {
 *   alert('Chrome AI is not available. Please check your browser settings.');
 * }
 * ```
 */
export async function isChromeAIAvailable(): Promise<boolean> {
  try {
    if (typeof LanguageModel === 'undefined') {
      return false;
    }

    const availability = await LanguageModel.availability();
    return availability === 'available';
  } catch (error) {
    console.error('Error checking Chrome AI availability:', error);
    return false;
  }
}

/**
 * Gets the current status of the Chrome AI model.
 * 
 * @returns {Promise<AIAvailability>} One of: "available", "downloadable", "downloading", "unavailable"
 *
 * @throws {Error} If the LanguageModel API is not defined in the browser.
 *
 * @example
 * ```
 * const status = await getChromeAIStatus();
 * if (status === 'downloadable') {
 *   alert('Please download the AI model first.');
 * }
 * ```
 */
export async function getChromeAIStatus(): Promise<AIAvailability> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error('LanguageModel API is not available in this browser');
  }

  return (await LanguageModel.availability()) as AIAvailability;
}

/**
 * Transcribes medical dictation audio into a structured clinical note
 * using Chrome's built-in Prompt API with multimodal audio input.
 *
 * This function performs the following steps:
 * 1. Validates Chrome AI API availability
 * 2. Validates audio blob is not empty
 * 3. Creates an AI session with medical scribe system prompt
 * 4. Sends audio blob to Prompt API with JSON response constraint
 * 5. Parses and validates the structured JSON response
 * 6. Enriches response with metadata (ID, timestamp)
 * 7. Destroys session to free resources
 *
 * SPEAKER DETECTION: The AI infers speakers from conversational context.
 * This is NOT true diarization. Speaker labels are best-effort estimates
 * based on language patterns, medical terminology usage, and conversation flow.
 *
 * @param audioBlob - The recorded audio blob from the microphone.
 *                    Must be in a format supported by the Prompt API
 *                    (typically 'audio/webm' or 'audio/ogg').
 *
 * @returns {Promise<MedicalNote>} A promise that resolves to a structured
 *                                  medical note containing raw transcript with
 *                                  speaker attribution, refined formatted note,
 *                                  and clinical summary.
 *
 * @throws {Error} If audioBlob is null, undefined, or has zero size.
 *                 Error message: "Invalid audio data provided."
 *
 * @throws {Error} If Chrome AI is not available or not properly configured.
 *                 Error message: "Chrome AI is not available. Please check your browser settings."
 *
 * @throws {Error} If the AI returns invalid JSON that cannot be parsed.
 *                 Error message: "AI returned invalid JSON. Please try recording again."
 *                 The raw AI response is logged to console for debugging.
 *
 * @throws {Error} If the AI returns JSON missing required fields.
 *                 Error message: "AI returned incomplete data. Please try recording again."
 *
 * @throws {Error} If the AI session creation or prompt fails.
 *                 Error message includes details from the underlying error.
 *
 * @example
 * ```
 * import { transcribeMedicalDictation } from './services/chromeAI';
 * import { useVoiceRecorder } from './hooks/useVoiceRecorder';
 * 
 * const { audioBlob } = useVoiceRecorder();
 * 
 * try {
 *   const note = await transcribeMedicalDictation(audioBlob);
 *   console.log('Transcript:', note.rawTranscript);
 *   console.log('Refined:', note.refinedNote.content);
 *   console.log('Summary:', note.clinicalSummary);
 * } catch (error) {
 *   console.error('Transcription failed:', error.message);
 *   alert('Failed to transcribe audio. Please try again.');
 * }
 * ```
 *
 * @see MedicalNote interface in src/types/index.ts
 * @see useVoiceRecorder hook in src/hooks/useVoiceRecorder.ts
 * @see Chrome Prompt API documentation: https://developer.chrome.com/docs/ai/prompt-api
 */
export async function transcribeMedicalDictation(
  audioBlob: Blob
): Promise<MedicalNote> {
  // Validate audio blob
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Invalid audio data provided.');
  }

  // Check Chrome AI availability
  const isAvailable = await isChromeAIAvailable();
  if (!isAvailable) {
    const status = await getChromeAIStatus();
    if (status === 'downloadable') {
      throw new Error('AI model not downloaded. Please run the setup utility first.');
    } else if (status === 'downloading') {
      throw new Error('AI model is currently downloading. Please wait and try again.');
    } else {
      throw new Error('Chrome AI is not available. Please check your browser settings.');
    }
  }

  try {
    // Create AI session with medical scribe configuration
    const session = await LanguageModel.create({
      outputLanguage: 'en',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.3, // Lower temperature for more deterministic medical transcription
      topK: 10,
    } as AISessionConfig);

    // Prompt the AI with audio input and JSON constraint
    const userPrompt = `Transcribe this medical audio recording. Identify speakers from context, clean up the transcript, format it professionally, and provide a clinical summary. Return structured JSON output.`;

    const result = await session.prompt(userPrompt, {
      input: [audioBlob],
      responseConstraint: { type: 'json' },
    });

    // Parse and validate the JSON response
    let parsedNote: Omit<MedicalNote, 'id' | 'timestamp' | 'audioBlob'>;
    try {
      parsedNote = JSON.parse(result);
    } catch (parseError) {
      console.error('Raw AI response:', result);
      console.error('JSON parse error:', parseError);
      throw new Error('AI returned invalid JSON. Please try recording again.');
    }

    // Validate required fields are present
    if (
      !parsedNote.rawTranscript ||
      !Array.isArray(parsedNote.rawTranscript) ||
      !parsedNote.refinedNote ||
      !parsedNote.clinicalSummary
    ) {
      console.error('Incomplete note structure:', parsedNote);
      throw new Error('AI returned incomplete data. Please try recording again.');
    }

    // Validate rawTranscript has proper structure
    if (parsedNote.rawTranscript.length === 0) {
      throw new Error('No transcript generated. Please ensure audio is clear and try again.');
    }

    for (const segment of parsedNote.rawTranscript) {
      if (!segment.speaker || !segment.text) {
        console.error('Invalid transcript segment:', segment);
        throw new Error('Invalid transcript structure. Please try recording again.');
      }
    }

    // Destroy session to free resources
    await session.destroy();

    // Enrich with metadata and return
    const enrichedNote: MedicalNote = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      rawTranscript: parsedNote.rawTranscript,
      refinedNote: parsedNote.refinedNote,
      clinicalSummary: parsedNote.clinicalSummary,
      audioBlob: audioBlob,
    };

    return enrichedNote;
  } catch (error) {
    // Re-throw with more context if it's not already our custom error
    if (error instanceof Error) {
      // If it's already one of our custom errors, just re-throw
      if (
        error.message.includes('Invalid audio') ||
        error.message.includes('AI returned') ||
        error.message.includes('Chrome AI is not') ||
        error.message.includes('No transcript')
      ) {
        throw error;
      }

      // Otherwise, wrap it
      throw new Error(`Transcription failed: ${error.message}`);
    }

    // Unknown error type
    throw new Error('Failed to transcribe audio. Please try again.');
  }
}

/**
 * Helper function to format recording duration as HH:MM:SS.
 * Useful for displaying recording time in UI, especially for longer recordings.
 *
 * @param seconds - Duration in seconds.
 * @returns Formatted string in HH:MM:SS format (e.g., "00:01:05", "01:01:01").
 *
 * @example
 * ```
 * formatDuration(65); // Returns "00:01:05"
 * formatDuration(3661); // Returns "01:01:01"
 * formatDuration(7325); // Returns "02:02:05"
 * ```
 */
export function formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [
        hrs.toString().padStart(2, '0'),
        mins.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
    ].join(':');
}
