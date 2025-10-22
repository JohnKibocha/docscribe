/**
 * @fileoverview Provides an advanced service for processing medical dictations using Chrome's built-in AI and the Web Speech API.
 *
 * @description
 * This module orchestrates a sophisticated, multi-step pipeline to transform raw audio
 * into a structured, comprehensive medical note. The process is designed to be robust
 * and handle long-form dictations by intelligently chunking the input to fit within
 * the context window of on-device AI models like Gemini Nano.
 *
 * @module services/chromeAI
 */

import type { MedicalNote, TranscriptSegment, SpeakerRole } from '../types';

declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
  }

  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

/**
 * The maximum number of words to include in each text chunk sent to the AI.
 */
const MAX_WORDS_PER_CHUNK = 400;

/**
 * The system prompt sent to the AI when processing an individual chunk of the transcript.
 */
const CHUNK_SYSTEM_PROMPT = `You are an expert medical scribe processing a portion of a clinical encounter transcript. Your task is to extract key information from the CURRENT CHUNK ONLY and return it in a valid JSON format. Do not use markdown. The JSON object must have this exact structure: {"speakers": [{"speaker": "Provider", "text": "The exact words spoken by the provider in this chunk."}, {"speaker": "Patient", "text": "The exact words spoken by the patient in this chunk."}], "clinicalInfo": {"symptoms": ["symptom 1"], "diagnoses": ["diagnosis 1"], "treatments": ["treatment 1"], "orders": ["lab order 1"]}, "summary": "A brief, one-sentence summary of the key events in this chunk to provide context for the next chunk."}`;

/**
 * The system prompt sent to the AI for the final synthesis step.
 */
const SYNTHESIS_PROMPT = `You are an expert medical scribe tasked with creating a final, comprehensive clinical note from a collection of transcribed dialogue and extracted clinical details. Your task is to synthesize all the provided information into a single, valid JSON object. Do not use markdown. The JSON object must have this exact structure: {"rawTranscript": [{"speaker": "Provider", "text": "Complete dialogue of the provider."}, {"speaker": "Patient", "text": "Complete dialogue of the patient."}], "refinedNote": {"format": "SOAP", "content": "The full, formatted clinical note as a single string.", "sections": [{"title": "Subjective", "body": "Patient's complaints and history of present illness."}, {"title": "Objective", "body": "Physical exam findings, vital signs, and test results."}, {"title": "Assessment", "body": "The primary diagnosis or differential diagnoses."}, {"title": "Plan", "body": "The treatment plan, including medications, therapies, and follow-up."}]}, "clinicalSummary": {"chiefComplaint": "The primary reason for the visit.", "keyFindings": "A summary of the most critical clinical findings.", "plan": "A concise overview of the treatment plan."}}`;

/**
 * Defines the structure of the JSON object expected from the AI after processing a single chunk.
 */
interface ChunkResult {
  speakers: Array<{ speaker: string; text: string }>;
  clinicalInfo: {
    symptoms: string[];
    diagnoses: string[];
    treatments: string[];
    orders: string[];
    [key: string]: unknown;
  };
  summary: string;
}

/**
 * Asynchronously checks if the Chrome AI LanguageModel is available and ready for use.
 */
export async function isChromeAIAvailable(): Promise<boolean> {
  try {
    if (typeof LanguageModel === 'undefined') {
      return false;
    }
    const availability = await LanguageModel.availability();
    return availability === 'readily' || availability === 'available';
  } catch (error) {
    console.error('Error checking Chrome AI availability:', error);
    return false;
  }
}

/**
 * Transcribes an audio blob into a raw text string using the Web Speech API.
 */
async function transcribeAudioWithSpeechAPI(audioBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return reject(new Error('Speech Recognition API is not supported in this browser.'));
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    const INITIAL_SILENCE_TIMEOUT = 15000;
    const ROLLING_SILENCE_TIMEOUT = 15000;
    let finalTranscript = '';
    let isProcessing = false;
    let silenceTimer: number | null = null;
    let initialTimer: number | null = null;
    let hasReceivedSpeech = false;
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    const cleanup = () => {
      isProcessing = true;
      URL.revokeObjectURL(audioUrl);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (initialTimer) clearTimeout(initialTimer);
    };
    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(() => {
        if (!isProcessing) {
          recognition.stop();
        }
      }, ROLLING_SILENCE_TIMEOUT);
    };
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
          if (!hasReceivedSpeech) {
            hasReceivedSpeech = true;
            if (initialTimer) clearTimeout(initialTimer);
            initialTimer = null;
          }
        }
      }
      if (hasReceivedSpeech) {
        resetSilenceTimer();
      }
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      cleanup();
      reject(new Error(`Speech recognition failed: ${event.error}. Please check microphone permissions.`));
    };
    recognition.onend = () => {
      cleanup();
      const trimmedTranscript = finalTranscript.trim();
      if (trimmedTranscript.length === 0) {
        reject(new Error('No speech was detected. Please ensure your microphone is working and try again.'));
      } else {
        resolve(trimmedTranscript);
      }
    };
    try {
      recognition.start();
      initialTimer = window.setTimeout(() => {
        if (!hasReceivedSpeech && !isProcessing) {
          recognition.stop();
        }
      }, INITIAL_SILENCE_TIMEOUT);
      audio.play().catch((err) => {
        console.error('Audio playback error:', err);
        recognition.stop();
        reject(new Error('Failed to process the provided audio.'));
      });
    } catch (err) {
      cleanup();
      reject(new Error('Failed to start the speech recognition service.'));
    }
  });
}

/**
 * Splits a long transcript into smaller chunks suitable for AI processing.
 */
function chunkTranscript(transcript: string): string[] {
  const sentences = transcript.split(/([.!?]+\s+)/g);
  const chunks: string[] = [];
  let currentChunk = '';
  let wordCount = 0;
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || '');
    const sentenceWords = sentence.trim().split(/\s+/).length;
    if (wordCount + sentenceWords > MAX_WORDS_PER_CHUNK && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      wordCount = sentenceWords;
    } else {
      currentChunk += sentence;
      wordCount += sentenceWords;
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

/**
 * Uses the AI to clean up a raw transcript by adding punctuation and fixing common errors.
 */
async function cleanupTranscript(rawTranscript: string): Promise<string> {
  const session = await LanguageModel.create({
    systemPrompt: `You are a transcript editor. Your only task is to add proper punctuation (periods, commas, question marks) and correct obvious speech recognition errors in a medical transcript. Preserve all medical terminology exactly. Do not summarize, change meaning, or add information. Return only the cleaned transcript text.`,
    temperature: 0.1,
    topK: 5,
  });
  const result = await session.prompt(`Clean this transcript:\n\n${rawTranscript}`);
  session.destroy();
  return result.trim();
}

/**
 * Processes a single transcript chunk using the AI, incorporating context from the previous chunk.
 */
async function processChunk(chunk: string, chunkIndex: number, previousContext: string | null): Promise<ChunkResult> {
  const session = await LanguageModel.create({ systemPrompt: CHUNK_SYSTEM_PROMPT, temperature: 0.3, topK: 10 });
  const contextPrefix = previousContext ? `PREVIOUS CONTEXT (for reference only):\n${previousContext}\n\n` : '';
  const userPrompt = `${contextPrefix}CURRENT CHUNK TO PROCESS:\n${chunk}`;
  const result = await session.prompt(userPrompt);
  session.destroy();
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`No valid JSON object found in AI response for chunk ${chunkIndex + 1}:`, result);
    throw new Error(`AI chunk processing failed at chunk ${chunkIndex + 1}.`);
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error(`Failed to parse JSON for chunk ${chunkIndex + 1}:`, error, 'AI Response:', result);
    throw new Error(`AI chunk processing failed at chunk ${chunkIndex + 1} due to a parsing error.`);
  }
}

/**
 * Formats a duration in seconds into a `HH:MM:SS` string format.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
}

/**
 * Adds estimated timestamps to transcript segments based on word count.
 */
function addTimestampsToTranscript(segments: Array<{ speaker: string; text: string }>): TranscriptSegment[] {
  const WORDS_PER_SECOND = 2.5;
  let currentTime = 0;

  return segments.map((segment): TranscriptSegment => {
    const wordCount = segment.text.trim().split(/\s+/).length;
    const segmentDuration = wordCount / WORDS_PER_SECOND;
    
    const timestamp = formatDuration(currentTime);
    const startTime = Math.floor(currentTime * 1000);
    
    currentTime += segmentDuration;

    const newSegment: TranscriptSegment = {
      speaker: segment.speaker as SpeakerRole,
      text: segment.text,
      timestamp,
      startTime
    };
    return newSegment;
  });
}

/**
 * Synthesizes the final, structured medical note from all aggregated chunk data.
 */
async function synthesizeFinalNote(
  allSpeakers: Array<{ speaker: string; text: string }>,
  aggregatedClinicalInfo: { symptoms: string[]; diagnoses: string[]; treatments: string[]; orders: string[]; }
): Promise<Omit<MedicalNote, 'id' | 'timestamp' | 'audioBlob'>> {
  const session = await LanguageModel.create({ systemPrompt: SYNTHESIS_PROMPT, temperature: 0.3, topK: 10 });
  const userPrompt = `Create a final clinical note from the following information.\n\nDIALOGUE:\n${allSpeakers.map((s, i) => `${i + 1}. ${s.speaker}: ${s.text}`).join('\n')}\n\nCLINICAL INFORMATION:\nSymptoms: ${aggregatedClinicalInfo.symptoms.join(', ') || 'None'}\nDiagnoses: ${aggregatedClinicalInfo.diagnoses.join(', ') || 'None'}\nTreatments: ${aggregatedClinicalInfo.treatments.join(', ') || 'None'}\nOrders: ${aggregatedClinicalInfo.orders.join(', ') || 'None'}`;
  const result = await session.prompt(userPrompt);
  session.destroy();

  let parsed: Record<string, any>;
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No valid JSON object found in AI synthesis response:', result);
    throw new Error('Final note synthesis failed because no JSON was found.');
  }
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse final note JSON:', error, 'AI Response:', result);
    throw new Error('Final note synthesis failed due to a parsing error.');
  }

  parsed.rawTranscript = addTimestampsToTranscript(parsed.rawTranscript || allSpeakers);

  if (!Array.isArray(parsed.rawTranscript) || parsed.rawTranscript.length === 0) {
    parsed.rawTranscript = addTimestampsToTranscript(allSpeakers);
  }
  if (!parsed.refinedNote || !Array.isArray(parsed.refinedNote.sections)) {
    const content = typeof parsed.refinedNote === 'string' ? parsed.refinedNote : (parsed.refinedNote?.content || 'Unable to generate refined note.');
    parsed.refinedNote = { format: 'Unknown', content, sections: [{ title: 'Generated Content', body: content }] };
  }
  if (!parsed.clinicalSummary) {
    parsed.clinicalSummary = {
      chiefComplaint: aggregatedClinicalInfo.symptoms[0] || 'Not specified',
      keyFindings: aggregatedClinicalInfo.diagnoses.join(', ') || 'None',
      plan: aggregatedClinicalInfo.treatments.join(', ') || aggregatedClinicalInfo.orders.join(', ') || 'None specified'
    };
  }

  return parsed as Omit<MedicalNote, 'id' | 'timestamp' | 'audioBlob'>;
}

/**
 * The main orchestration function for transcribing a medical dictation.
 */
export async function transcribeMedicalDictation(audioBlob: Blob): Promise<MedicalNote> {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Invalid or empty audio data was provided.');
  }
  if (!(await isChromeAIAvailable())) {
    throw new Error('Chrome AI is not available. Please check browser settings and model availability.');
  }
  try {
    const fullTranscript = await transcribeAudioWithSpeechAPI(audioBlob);
    const cleanedTranscript = await cleanupTranscript(fullTranscript);
    const chunks = chunkTranscript(cleanedTranscript);
    const chunkResults: ChunkResult[] = [];
    let previousContext: string | null = null;
    for (let i = 0; i < chunks.length; i++) {
      const result = await processChunk(chunks[i], i, previousContext);
      chunkResults.push(result);
      previousContext = result.summary;
    }
    const allSpeakers: Array<{ speaker: string; text: string }> = [];
    const aggregatedClinicalInfo = { symptoms: [] as string[], diagnoses: [] as string[], treatments: [] as string[], orders: [] as string[] };
    for (const chunkResult of chunkResults) {
      if (chunkResult.speakers && Array.isArray(chunkResult.speakers)) {
        allSpeakers.push(...chunkResult.speakers);
      }
      const clinicalInfo = chunkResult.clinicalInfo || {};
      if (Array.isArray(clinicalInfo.symptoms)) aggregatedClinicalInfo.symptoms.push(...clinicalInfo.symptoms);
      if (Array.isArray(clinicalInfo.diagnoses)) aggregatedClinicalInfo.diagnoses.push(...clinicalInfo.diagnoses);
      if (Array.isArray(clinicalInfo.treatments)) aggregatedClinicalInfo.treatments.push(...clinicalInfo.treatments);
      if (Array.isArray(clinicalInfo.orders)) aggregatedClinicalInfo.orders.push(...clinicalInfo.orders);
    }
    const finalNote = await synthesizeFinalNote(allSpeakers, aggregatedClinicalInfo);
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      rawTranscript: finalNote.rawTranscript,
      refinedNote: finalNote.refinedNote,
      clinicalSummary: finalNote.clinicalSummary,
      audioBlob: audioBlob,
    };
  } catch (error) {
    console.error('Medical dictation transcription failed:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred during transcription.');
  }
}
