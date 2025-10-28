/**
 * @fileoverview Main thread AI processor fallback for when Web Worker AI is not available.
 * 
 * CRITICAL: This fallback processes AI on the main thread but uses async/await with
 * setTimeout to yield control back to the UI, preventing freezing while still
 * providing the 4-stage AI pipeline functionality.
 * 
 * This is used when Chrome AI APIs are not available in Web Worker context.
 * 
 * @module services/mainThreadAI
 */

import { isChromeAIAvailable, createLanguageModelSession } from './chromeAI';
import { safeParseJSON } from '../utils/jsonParser';

/**
 * State for a main-thread encounter processing session.
 */
interface MainThreadEncounterState {
  triageComplete: boolean;
  triageChunks: string[];
  detectedEncounterType: string;
  detectedDocumentationStandard: string;
  detectedSpeakerContext: string;
  processingContext: string;
  allCleanedDiarizedChunks: string[];
  allNoteSnippets: any[];
  isProcessing: boolean; // Global processing lock for ALL AI operations
  pendingChunks: string[]; // Queue for chunks received during processing
  pendingFinalNote: boolean; // Flag if final note generation is requested
  // Enhanced contextual awareness
  encounterSummary: string; // Rolling summary of the encounter for context
  keyMedicalTerms: string[]; // Extracted medical terms for context-aware cleaning
  clinicalContext: string; // Inferred clinical scenario (e.g., "TB consultation", "cardiac surgery")
  isStopping: boolean; // Flag to reject new chunks after stop is requested
}

/**
 * Main thread AI processor that provides the same interface as the Web Worker
 * but processes on the main thread with yield points to prevent UI freezing.
 */
export class MainThreadAIProcessor {
  private encounters: Record<string, MainThreadEncounterState> = {};
  private aiSession: any = null;
  private isInitialized = false;
  
  // Callbacks for communicating with the UI
  private onTriageComplete: ((payload: any) => void) | null = null;
  private onChunkUpdate: ((payload: any) => void) | null = null;
  private onFinalComplete: ((payload: any) => void) | null = null;
  private onError: ((payload: any) => void) | null = null;

  /**
   * Initialize the main thread AI processor.
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize(): Promise<boolean> {
    try {
      const available = await isChromeAIAvailable();
      if (!available) {
        throw new Error('Chrome AI not available on main thread either');
      }

      this.aiSession = await createLanguageModelSession({
        systemPrompt: 'You are an expert medical AI assistant specialized in clinical documentation. Follow all instructions precisely and return only the requested format.'
      });

      this.isInitialized = true;
      console.log('Main thread AI processor initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Main thread AI initialization failed:', error);
      this.onError?.({ message: `Main thread AI initialization failed: ${(error as Error).message}` });
      return false;
    }
  }

  /**
   * Start a new encounter for processing.
   */
  startEncounter(encounterID: string): void {
    this.encounters[encounterID] = {
      triageComplete: false,
      triageChunks: [],
      detectedEncounterType: "Consultation",
      detectedDocumentationStandard: "SOAP",
      detectedSpeakerContext: "Provider-to-Patient",
      processingContext: "",
      allCleanedDiarizedChunks: [],
      allNoteSnippets: [],
      isProcessing: false,
      pendingChunks: [],
      pendingFinalNote: false,
      // Enhanced contextual awareness
      encounterSummary: "",
      keyMedicalTerms: [],
      clinicalContext: "",
      isStopping: false
    };
    
    console.log('Started main thread encounter:', encounterID);
  }

  /**
   * Process a single chunk with async yielding to prevent UI blocking.
   */
  async processChunk(encounterID: string, dirtyChunk: string): Promise<void> {
    console.log(`AI PROCESSOR: processChunk called with encounterID=${encounterID}, chunk="${dirtyChunk.substring(0, 50)}..."`);
    
    if (!this.isInitialized || !this.aiSession) {
      console.error('AI PROCESSOR: Not initialized', { isInitialized: this.isInitialized, hasSession: !!this.aiSession });
      this.onError?.({ message: 'AI processor not initialized' });
      return;
    }

    const state = this.encounters[encounterID];
    if (!state) {
      console.error(`AI PROCESSOR: Encounter ${encounterID} not found`, { availableEncounters: Object.keys(this.encounters) });
      this.onError?.({ message: `Encounter ${encounterID} not found` });
      return;
    }

    // If encounter is stopping, reject new chunks
    if (state.isStopping) {
      console.log(`AI PROCESSOR: Encounter ${encounterID} is stopping, rejecting new chunk`);
      return;
    }

    // If currently processing, queue this chunk for later
    if (state.isProcessing) {
      console.log(`AI PROCESSOR: Encounter ${encounterID} is processing, queueing chunk`);
      state.pendingChunks.push(dirtyChunk);
      return;
    }

    // Set processing flag to prevent parallel processing
    state.isProcessing = true;

    try {
      console.log(`AI PROCESSOR: Ready to process chunk for encounter ${encounterID}`);
      await this.processChunkInternal(encounterID, dirtyChunk);
      
      // Process any queued chunks (process ALL chunks regardless of stopping state)
      // The stopping state only prevents NEW chunks from being added, not processing existing ones
      while (state.pendingChunks.length > 0) {
        const nextChunk = state.pendingChunks.shift()!;
        console.log(`AI PROCESSOR: Processing queued chunk for encounter ${encounterID}`);
        await this.processChunkInternal(encounterID, nextChunk);
      }

      // REMOVED: No longer discard chunks when stopping - they should all be processed above
      // The stopping state is only for preventing NEW chunks from being queued

      // If final note generation was requested while processing, handle it now
      if (state.pendingFinalNote) {
        console.log(`AI PROCESSOR: Processing queued final note generation for encounter ${encounterID}`);
        state.pendingFinalNote = false;
        await this.generateFinalNoteInternal(encounterID);
      }
    } finally {
      // Always clear the processing flag
      if (this.encounters[encounterID]) {
        this.encounters[encounterID].isProcessing = false;
      }
    }
  }

  /**
   * Internal chunk processing logic (separated for queue management).
   */
  private async processChunkInternal(encounterID: string, dirtyChunk: string): Promise<void> {
    const state = this.encounters[encounterID];
    if (!state) return;

    try {
      // STAGE 1: ENHANCED TRIAGE (collect sufficient context before classification)
      if (!state.triageComplete) {
        state.triageChunks.push(dirtyChunk);
        
        // Calculate total context for intelligent triage threshold
        const allTriageText = state.triageChunks.join(" ");
        const wordCount = allTriageText.split(' ').filter(word => word.trim().length > 0).length;
        const charCount = allTriageText.length;
        
        // DEBUG: Log current collection status
        console.log(`TRIAGE DEBUG: Chunk ${state.triageChunks.length} received`);
        console.log(`TRIAGE DEBUG: Current text: "${allTriageText.substring(0, 200)}..."`);
        console.log(`TRIAGE DEBUG: Word count: ${wordCount}/80, Char count: ${charCount}/400`);
        
        // SMART TRIAGE TRIGGERS:
        // Option 1: Sufficient content (80+ words OR 400+ characters) - REDUCED for faster response
        // Option 2: Safety fallback (3 chunks max to prevent infinite waiting) - REDUCED for reliability
        // Option 3: Medical keywords detected (emergency indicators)
        const hasSufficientContent = wordCount >= 80 || charCount >= 400;
        const hasMaxChunks = state.triageChunks.length >= 3;
        const hasEmergencyKeywords = this.detectEmergencyKeywords(allTriageText);
        
        console.log(`TRIAGE DEBUG: Triggers - Content: ${hasSufficientContent}, MaxChunks: ${hasMaxChunks}, Emergency: ${hasEmergencyKeywords}`);
        
        if (hasSufficientContent || hasMaxChunks || hasEmergencyKeywords) {
          console.log(`TRIAGE TRIGGERED: words=${wordCount}, chunks=${state.triageChunks.length}, emergency=${hasEmergencyKeywords}`);
          await this.runTriage(encounterID);
          
          // CRITICAL FIX: Re-process ALL chunks (triage + queued) with triage context
          const triageChunkCount = state.triageChunks.length;
          const pendingChunkCount = state.pendingChunks.length;
          const chunksToProcess = [...state.triageChunks, ...state.pendingChunks];
          state.triageChunks = [];
          state.pendingChunks = []; // Clear pending chunks as they'll be processed now
          
          console.log(`Processing ${chunksToProcess.length} accumulated chunks after triage (${triageChunkCount} triage + ${pendingChunkCount} queued)`);
          for (const chunk of chunksToProcess) {
            await this.yieldToUI(); // Prevent blocking
            await this.processChunkInternal(encounterID, chunk);
          }
          return;
        } else {
          // Continue collecting context - don't process yet
          console.log(`COLLECTING TRIAGE CONTEXT: ${wordCount}/80 words, ${state.triageChunks.length}/3 chunks`);
          return;
        }
      }

      // STAGES 2-4: Process the chunk through the ATOMIC pipeline
      // CRITICAL: All stages must complete successfully or none are applied
      await this.yieldToUI(); // Yield before heavy processing
      
      const pipelineStartTime = Date.now();
      console.log(`PIPELINE STARTED at ${new Date().toLocaleTimeString()} for encounter ${encounterID} - Processing chunk ${state.allCleanedDiarizedChunks.length + 1}`);
      
      const cleanedChunk = await this.cleanChunk(dirtyChunk, state.detectedSpeakerContext, state);
      await this.yieldToUI();
      
      const diarizedChunk = await this.diarizeChunk(cleanedChunk, state.detectedSpeakerContext);
      await this.yieldToUI();
      
      const extractedSnippet = await this.extractSnippet(diarizedChunk, state);
      await this.yieldToUI();
      
      const pipelineEndTime = Date.now();
      const pipelineTime = pipelineEndTime - pipelineStartTime;
      
      // ATOMIC STATE UPDATE: All stages completed successfully
      state.allCleanedDiarizedChunks.push(diarizedChunk);
      state.allNoteSnippets.push(extractedSnippet.note_snippet);
      state.processingContext = extractedSnippet.next_context_summary;
      
      console.log(`PIPELINE COMPLETED at ${new Date().toLocaleTimeString()} for encounter ${encounterID} (took ${pipelineTime}ms / ${(pipelineTime/1000).toFixed(1)}s)`);
      console.log(`PROGRESS: ${state.allCleanedDiarizedChunks.length} chunks processed total`);
      
      // Send real-time update
      this.onChunkUpdate?.({
        encounterID,
        fullTranscript: state.allCleanedDiarizedChunks.join("\\n\\n")
      });
      
    } catch (error) {
      console.error('Chunk processing failed:', error);
      
      // Provide specific error context for different failure types
      let errorMessage = 'Chunk processing failed';
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        errorMessage = 'AI returned invalid JSON format. This may indicate a temporary issue with the AI model.';
      } else if (error instanceof Error) {
        errorMessage = `Chunk processing failed: ${error.message}`;
      }
      
      // CRITICAL: Don't disable UI - allow continued recording
      this.onError?.({ 
        message: errorMessage,
        recoverable: true // Signal that recording can continue
      });
    }
  }

  /**
   * Generate the final medical note for an encounter.
   */
  async generateFinalNote(encounterID: string): Promise<void> {
    const state = this.encounters[encounterID];
    if (!state || !this.aiSession) {
      this.onError?.({ message: 'Cannot generate final note - encounter or AI not available' });
      return;
    }

    // Set stopping flag to prevent new chunks from being accepted
    state.isStopping = true;
    console.log(`FINAL NOTE: Encounter ${encounterID} marked as stopping, no new chunks will be accepted`);

    // If currently processing chunks, queue the final note generation
    if (state.isProcessing) {
      console.log(`FINAL NOTE: Encounter ${encounterID} is processing chunks, queueing final note generation`);
      state.pendingFinalNote = true;
      return;
    }

    // Set processing flag to prevent new chunks during final note generation
    state.isProcessing = true;

    try {
      await this.generateFinalNoteInternal(encounterID);
    } finally {
      // Always clear the processing flag
      if (this.encounters[encounterID]) {
        this.encounters[encounterID].isProcessing = false;
      }
    }
  }

  /**
   * Internal final note generation logic (separated for queue management).
   */
  private async generateFinalNoteInternal(encounterID: string): Promise<void> {
    const state = this.encounters[encounterID];
    if (!state || !this.aiSession) {
      this.onError?.({ message: 'Cannot generate final note - encounter or AI not available' });
      return;
    }

    try {
      const finalNoteStartTime = Date.now();
      console.log(`FINAL NOTE GENERATION STARTED at ${new Date().toLocaleTimeString()} for encounter ${encounterID}`);
      console.log(`INPUT DATA: ${state.allNoteSnippets.length} processed snippets, ${state.allCleanedDiarizedChunks.length} total chunks`);
      
      // CRITICAL: Force triage completion if recording ended before thresholds met
      if (!state.triageComplete && state.triageChunks.length > 0) {
        console.log(`FORCE TRIAGE: Recording ended with ${state.triageChunks.length} unprocessed chunks`);
        await this.forceTriageCompletion(encounterID);
      }

      await this.yieldToUI();
      
      const snippets = JSON.stringify(state.allNoteSnippets, null, 2);
      const assemblyPrompt = this.getAssemblyPrompt(state.detectedEncounterType, snippets);
      
      const finalNoteJSONRaw = await this.aiSession.prompt(assemblyPrompt);
      
      const finalNoteEndTime = Date.now();
      const finalNoteTime = finalNoteEndTime - finalNoteStartTime;
      
      console.log(`FINAL NOTE GENERATION COMPLETED at ${new Date().toLocaleTimeString()} (took ${finalNoteTime}ms / ${(finalNoteTime/1000).toFixed(1)}s)`);
      
      // Use robust JSON parser for final note assembly
      const finalNoteJSON = safeParseJSON(finalNoteJSONRaw, {
        encounterType: state.detectedEncounterType || 'Consultation',
        documentationStandard: state.detectedDocumentationStandard || 'SOAP',
        noteContent: {
          sections: [
            {
              title: 'Raw Transcript',
              content: state.allCleanedDiarizedChunks.join("\\n\\n") || 'No transcript available'
            }
          ],
          chiefComplaint: 'Processing fallback - see raw transcript',
          keyFindings: 'Processing fallback - see raw transcript', 
          plan: 'Processing fallback - see raw transcript',
          followUp: 'Not specified'
        }
      });
      
      // Check if assembly parsing failed
      if (finalNoteJSON.parseError) {
        console.warn('ASSEMBLY PARSING FAILED, using fallback structure:', finalNoteJSON.errorMessage);
      }
      
      // Send completion notification with stringified result
      this.onFinalComplete?.({
        encounterID,
        finalNoteJSON: JSON.stringify(finalNoteJSON),
        fullTranscript: state.allCleanedDiarizedChunks.join("\\n\\n")
      });
      
      // Calculate and log total processing time summary
      console.log(`ENCOUNTER PROCESSING COMPLETE for ${encounterID} at ${new Date().toLocaleTimeString()}`);
      console.log(`PERFORMANCE SUMMARY: Processed ${state.allCleanedDiarizedChunks.length} chunks through 4-stage pipeline + final assembly`);
      
      // Cleanup
      delete this.encounters[encounterID];
      
    } catch (error) {
      console.error('Final note generation failed:', error);
      
      // Provide specific error context for different failure types
      let errorMessage = 'Final note generation failed';
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        errorMessage = 'AI returned invalid JSON format for final note. Raw transcript is preserved.';
      } else if (error instanceof Error) {
        errorMessage = `Final note generation failed: ${error.message}`;
      }
      
      // CRITICAL: Always provide fallback data even if final assembly fails
      this.onFinalComplete?.({
        encounterID,
        finalNoteJSON: JSON.stringify({
          encounterType: state.detectedEncounterType || 'Consultation',
          noteContent: {
            sections: [
              {
                title: 'Raw Transcript',
                content: state.allCleanedDiarizedChunks.join("\\n\\n") || 'No transcript available'
              }
            ],
            chiefComplaint: 'Processing error - see raw transcript',
            keyFindings: 'Processing error - see raw transcript',
            plan: 'Processing error - see raw transcript',
            followUp: 'Not specified'
          },
          processingError: true,
          errorMessage
        }),
        fullTranscript: state.allCleanedDiarizedChunks.join("\\n\\n")
      });
      
      // Cleanup even on error
      delete this.encounters[encounterID];
      
      this.onError?.({ 
        message: errorMessage,
        recoverable: false // Final note errors are not recoverable
      });
    }
  }

  /**
   * Force triage completion when recording ends prematurely.
   * CRITICAL: Ensures no data is lost due to threshold requirements.
   */
  private async forceTriageCompletion(encounterID: string): Promise<void> {
    const state = this.encounters[encounterID];
    if (!state || state.triageComplete) return;

    const allTriageText = state.triageChunks.join(" ");
    const wordCount = allTriageText.split(' ').filter(word => word.trim().length > 0).length;
    
    console.log(`FORCE TRIAGE: Processing ${wordCount} words from ${state.triageChunks.length} chunks`);
    
    if (wordCount < 20) {
      // Very short recording - treat as single chunk with generic classification
      console.log(`SHORT RECORDING: Treating as single chunk (${wordCount} words)`);
      
      // Set conservative defaults for very short recordings
      state.detectedEncounterType = "Progress"; // Most flexible note type
      state.detectedSpeakerContext = "Provider-to-Patient"; // Most common context
      state.triageComplete = true;
      
      // Process all chunks as one unit
      const combinedChunk = state.triageChunks.join(" ");
      state.triageChunks = [];
      
      await this.processChunk(encounterID, combinedChunk);
      
    } else {
      // Sufficient content for proper triage
      console.log(`SUFFICIENT CONTENT: Running proper triage (${wordCount} words)`);
      await this.runTriage(encounterID);
      
      // Process accumulated chunks
      const chunksToProcess = [...state.triageChunks];
      state.triageChunks = [];
      
      for (const chunk of chunksToProcess) {
        await this.yieldToUI();
        await this.processChunk(encounterID, chunk);
      }
    }
  }

  /**
   * Yield control back to the UI to prevent blocking.
   */
  private async yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Detect emergency medical keywords that should trigger immediate triage.
   * CRITICAL: In emergency situations, we cannot wait for 120 words.
   */
  private detectEmergencyKeywords(text: string): boolean {
    const emergencyTerms = [
      // Cardiac emergencies
      'cardiac arrest', 'heart attack', 'chest pain', 'myocardial infarction', 'mi',
      // Respiratory emergencies  
      'respiratory arrest', 'can\'t breathe', 'difficulty breathing', 'shortness of breath',
      // Trauma
      'trauma', 'accident', 'bleeding', 'hemorrhage', 'unconscious', 'unresponsive',
      // Neurological
      'stroke', 'seizure', 'head injury', 'altered mental status',
      // Infectious disease concerns (TB symptoms)
      'blood in sputum', 'hemoptysis', 'night sweats', 'weight loss', 'tuberculosis', 'tb',
      // General emergency indicators
      'emergency', 'urgent', 'stat', 'code blue', 'code red', 'ambulance'
    ];
    
    const lowerText = text.toLowerCase();
    const detected = emergencyTerms.some(term => lowerText.includes(term));
    
    if (detected) {
      console.log(`EMERGENCY KEYWORDS DETECTED in: "${text.substring(0, 100)}..."`);
    }
    
    return detected;
  }

  /**
   * Run triage analysis on the accumulated chunks.
   */
  private async runTriage(encounterID: string): Promise<void> {
    const state = this.encounters[encounterID];
    const triageInput = state.triageChunks.join("\\n\\n");
    
    const triageStartTime = Date.now();
    console.log(`TRIAGE STARTED at ${new Date().toLocaleTimeString()} for encounter ${encounterID}`);
    console.log(`RUNNING TRIAGE on ${state.triageChunks.length} chunks, ${triageInput.length} characters`);
    console.log(`TRIAGE INPUT: "${triageInput.substring(0, 200)}..."`);
    
    const triagePrompt = this.getTriagePrompt(triageInput);
    
    const triageResult = await this.aiSession.prompt(triagePrompt);
    const triageEndTime = Date.now();
    const triageTime = triageEndTime - triageStartTime;
    
    console.log(`TRIAGE COMPLETED at ${new Date().toLocaleTimeString()} (took ${triageTime}ms / ${(triageTime/1000).toFixed(1)}s)`);
    console.log(`TRIAGE RESULT: ${triageResult}`);
    
    // Use robust JSON parser to handle code fences and mixed content
    const triageJson = safeParseJSON(triageResult, {
      encounterType: 'Consultation',
      documentationStandard: 'SOAP',
      speakerContext: 'Provider-to-Patient'
    });
    
    // Check if parsing failed and log warning
    if (triageJson.parseError) {
      console.warn('TRIAGE PARSING FAILED, using fallback values:', triageJson.errorMessage);
    }
    
    state.detectedEncounterType = triageJson.encounterType;
    state.detectedDocumentationStandard = triageJson.documentationStandard || 'SOAP';
    state.detectedSpeakerContext = triageJson.speakerContext;
    state.triageComplete = true;
    
    // Extract clinical context from triage chunks for better downstream processing
    const triageText = state.triageChunks.join(' ').toLowerCase();
    state.clinicalContext = this.inferClinicalContext(triageText, state.detectedEncounterType);
    state.encounterSummary = `${state.detectedEncounterType} - ${state.clinicalContext}`;
    state.keyMedicalTerms = this.extractKeyMedicalTerms(triageText);
    
    console.log(`TRIAGE COMPLETE: Type=${state.detectedEncounterType}, Standard=${state.detectedDocumentationStandard}, Context=${state.detectedSpeakerContext}`);
    console.log(`CLINICAL CONTEXT: ${state.clinicalContext}`);
    console.log(`KEY MEDICAL TERMS: ${state.keyMedicalTerms.join(', ')}`);
    
    this.onTriageComplete?.({
      noteType: triageJson.encounterType,
      documentationStandard: triageJson.documentationStandard || 'SOAP',
      context: triageJson.speakerContext
    });
  }

  /**
   * Clean a chunk of dirty transcript with full encounter context for better accuracy.
   */
  private async cleanChunk(dirtyChunk: string, speakerContext: string, state: MainThreadEncounterState): Promise<string> {
    const cleanPrompt = this.getCleanPrompt(speakerContext, dirtyChunk, state);
    const rawResponse = await this.aiSession.prompt(cleanPrompt);
    
    // Extract text content, handling potential code fences
    return this.extractTextContent(rawResponse, dirtyChunk);
  }

  /**
   * Add speaker labels to a cleaned chunk.
   */
  private async diarizeChunk(cleanedChunk: string, speakerContext: string): Promise<string> {
    const diarizePrompt = this.getDiarizePrompt(speakerContext, cleanedChunk);
    const rawResponse = await this.aiSession.prompt(diarizePrompt);
    
    // Extract text content, handling potential code fences  
    return this.extractTextContent(rawResponse, cleanedChunk);
  }

  /**
   * Extract clinical snippets from a diarized chunk.
   */
  private async extractSnippet(diarizedChunk: string, state: MainThreadEncounterState): Promise<any> {
    const extractPrompt = this.getExtractPrompt(state.detectedEncounterType, state.processingContext, diarizedChunk);
    const snippetResponse = await this.aiSession.prompt(extractPrompt);
    
    // Use robust JSON parser to handle code fences and mixed content
    const snippetJson = safeParseJSON(snippetResponse, {
      snippets: [],
      context: 'unknown'
    });
    
    // Check if parsing failed and log warning
    if (snippetJson.parseError) {
      console.warn('SNIPPET PARSING FAILED, using fallback values:', snippetJson.errorMessage);
    }
    
    return snippetJson;
  }

  /**
   * Extract text content from AI response, handling code fences and mixed content.
   * For text-based stages (Clean, Diarize) that might return wrapped responses.
   */
  private extractTextContent(rawResponse: string, fallbackText: string): string {
    if (!rawResponse || typeof rawResponse !== 'string') {
      console.warn('TEXT EXTRACTION: Invalid response, using fallback');
      return fallbackText;
    }

    // Remove common code fence patterns
    const cleanedResponse = rawResponse
      .replace(/```(?:text|markdown|)?\s*\n?([\s\S]*?)\n?```/gi, '$1') // Remove text/markdown fences
      .replace(/```\s*\n?([\s\S]*?)\n?```/gi, '$1') // Remove generic fences
      .trim();

    // Return cleaned response or fallback if empty
    const result = cleanedResponse || fallbackText;
    
    if (cleanedResponse !== rawResponse) {
      console.log('TEXT EXTRACTION: Removed code fences from response');
    }
    
    return result;
  }

  /**
   * Manually force completion of pending triage (useful for testing or emergency stops).
   */
  async forceCompleteEncounter(encounterID: string): Promise<void> {
    const state = this.encounters[encounterID];
    if (!state) {
      this.onError?.({ message: `Encounter ${encounterID} not found` });
      return;
    }

    if (!state.triageComplete && state.triageChunks.length > 0) {
      console.log(`MANUAL FORCE COMPLETION: ${encounterID}`);
      await this.forceTriageCompletion(encounterID);
    }
  }

  // Set callback handlers
  setOnTriageComplete(callback: (payload: any) => void): void {
    this.onTriageComplete = callback;
  }

  setOnChunkUpdate(callback: (payload: any) => void): void {
    this.onChunkUpdate = callback;
  }

  setOnFinalComplete(callback: (payload: any) => void): void {
    this.onFinalComplete = callback;
  }

  setOnError(callback: (payload: any) => void): void {
    this.onError = callback;
  }

  /**
   * Cleanup the processor and destroy the AI session.
   */
  async destroy(): Promise<void> {
    if (this.aiSession) {
      try {
        await this.aiSession.destroy();
      } catch (error) {
        console.error('Error destroying AI session:', error);
      }
    }
    this.encounters = {};
    this.isInitialized = false;
  }

  // Prompt template methods using actual prompts from .github/prompts/
  private getTriagePrompt(chunks: string): string {
    const triagePrompt = `You are a Senior Clinical Informatics Analyst. Your sole function is to analyze the first few minutes of a medical transcript to definitively determine the \`encounterType\` and \`documentationStandard\`. You must follow all rules precisely. Your output must be *only* a valid JSON object and nothing else.

**INPUT:**
You will receive the first 2-3 minutes of a raw, uncleaned transcript, identified as \`{{FIRST_3_CHUNKS}}\`.

**OUTPUT:**
You MUST return *only* a valid JSON object in the following format:
{
  "encounterType": "[One of the 7 types defined below]",
  "documentationStandard": "[One of the 3 standards defined below]",
  "speakerContext": "[One of the 5 contexts defined below]"
}

---
### **DEFINITIONS: ENCOUNTER TYPES (Choose One)**
You must classify the *primary medical activity* into one of these 7 categories.

1.  **Consultation**
    * **Definition:** A standard outpatient or inpatient encounter focused on a patient's complaint. Includes new patient visits, follow-ups, and specialist evaluations.
    * **Keywords & Patterns:** "Chief complaint," "What brings you in?", "Patient reports...", "Physical exam reveals...", "My assessment is...", "The plan is...". It's a structured interview and examination.

2.  **Operative**
    * **Definition:** The dictation of a surgical procedure, often dictated by a single surgeon *during* or *immediately after* the case. It is a narrative of actions.
    * **Keywords & Patterns:** "Scalpel," "Incision," "Dissection," "Hemostasis achieved," "We then identified the...", "Findings include...", "Closure was performed...". Often uses first-person ("I," "We").
    * **SURGICAL CALL-AND-RESPONSE:** May include repetitive instrument requests and confirmations ("10-blade" "10-blade", "Suture" "Suture") - this is standard OR safety protocol, not a transcription error.

3.  **Procedure**
    * **Definition:** A non-surgical or minimally invasive procedure, often done outside a formal operating room.
    * **Keywords & Patterns:** "We will now perform the...", "Consent was obtained," "The area was prepped and draped," "Needle was inserted...".

4.  **SpecialistConsult**
    * **Definition:** A specialist provides their opinion on a patient at the request of another provider. The note is structured as a formal reply.
    * **Keywords & Patterns:** "Thank you for the consult," "Patient seen at the request of...", "My recommendations are...", "Impression: ...".

5.  **Emergency**
    * **Definition:** An urgent, acute encounter in an Emergency Department setting. Focus is on rapid triage, workup, and disposition.
    * **Keywords & Patterns:** "Arrived by ambulance," "Chief complaint is...", "Triage vitals...", "Patient is acute...". The dialogue is fast-paced and action-oriented.

6.  **Progress**
    * **Definition:** A daily follow-up note for an *admitted* inpatient. It reviews events over the last 24 hours.
    * **Keywords & Patterns:** "Hospital day number three," "Overnight, the patient...", "Patient reports feeling...", "Plan for today is...".

7.  **Autopsy**
    * **Definition:** A post-mortem examination. The language is highly specific and descriptive of a deceased person.
    * **Keywords & Patterns:** "Cause of death," "External examination reveals...", "Internal examination of the...", "The heart weighed...".

---
### **DEFINITIONS: DOCUMENTATION STANDARDS (Choose One)**
You must identify the *documentation format* being used.

1.  **SOAP**
    * **Definition:** Subjective, Objective, Assessment, Plan format commonly used for consultations and routine encounters.
    * **Keywords & Patterns:** Clear subjective complaints, objective findings, clinical assessment, and treatment plan.

2.  **Operative_Report**
    * **Definition:** Structured surgical documentation including preop diagnosis, procedure performed, findings, and postop plan.
    * **Keywords & Patterns:** Procedure steps, surgical findings, anatomical descriptions, technique details.

3.  **Narrative**
    * **Definition:** Free-form documentation without strict structural requirements.
    * **Keywords & Patterns:** Conversational flow, mixed topics, informal documentation style.

---
### **DEFINITIONS: SPEAKER CONTEXTS (Choose One)**
You must classify the *primary social interaction* into one of these 5 categories.

1.  **Provider-to-Patient**
    * **Definition:** A provider (doctor, NP, PA) is interviewing a patient.
    * **Pattern:** A clear question-and-answer flow. Provider uses medical terms, then often simplifies them. Patient uses lay terms ("hurts," "dizzy").

2.  **Provider-with-Team**
    * **Definition:** A provider is speaking to other clinical staff (Nurse, Resident, Medical Assistant).
    * **Pattern:** This is collaborative or directive. "What are the vitals?", "Let's give 50 of heparin.", "Sponge count correct?". One provider is clearly leading.
    * **SURGICAL CONTEXT:** Often includes call-and-response patterns for safety ("10-blade" "10-blade", "Cooling to 32" "Patient temperature to 32 degrees"). Repetition indicates confirmation between team members.

3.  **Operative-Dictation**
    * **Definition:** A *single* provider is narrating their actions as they perform them, or dictating a note for a typist.
    * **Pattern:** Almost 100% one-sided. Uses "I" or "We." No questions are being asked to a patient. It's a descriptive monologue.

4.  **Family-Discussion**
    * **Definition:** A provider is speaking with a patient's family members, who may or may not be present with the patient.
    * **Pattern:** You will hear third-person pronouns ("He reported...", "She is...") and labels like "Family" or "Patient's daughter."

5.  **Provider-to-Colleague**
    * **Definition:** A peer-to-peer discussion. This includes handoffs, sign-outs, or two doctors discussing a case.
    * **Pattern:** Highly technical language. Both speakers use medical jargon. It is informational, not directive or interview-style.

---
### **RULES & EXAMPLES**
1.  **Analyze All Chunks:** You must base your decision on the *entirety* of the \`{{FIRST_3_CHUNKS}}\`. Do not just use the first few lines.
2.  **Prioritize Action:** \`encounterType\` is the *medical action*. \`speakerContext\` is the *social interaction*. A surgeon talking to a nurse is \`encounterType: Operative\` and \`speakerContext: Provider-with-Team\`.
3.  **Informed Guesswork:** Use keywords to make a definitive choice.

**Example 1:**
* **Input:** "scalpel please okay making the midline incision... suction... dissection is carried down through the subcutaneous... Nurse, what was that last blood pressure? 110 over 70, Doctor."
* **Analysis:** Keywords "scalpel," "incision," "dissection" clearly mean \`Operative\`. The interaction "Nurse, what was...?" is a provider directing a team.
* **Output:** \`{ "encounterType": "Operative", "documentationStandard": "Operative_Report", "speakerContext": "Provider-with-Team" }\`

**Example 2:**
* **Input:** "alright what brings you in today... I've had this bad cough for about three weeks... okay any fever with that? yes, on and off... alright let's take a listen..."
* **Analysis:** Clear "what brings you in" interview format is \`Consultation\`. The question/answer flow is \`Provider-to-Patient\`. The structured format suggests \`SOAP\`.
* **Output:** \`{ "encounterType": "Consultation", "documentationStandard": "SOAP", "speakerContext": "Provider-to-Patient" }\`

**Example 3:**
* **Input:** "This is Dr. Smith dictating the operative note for patient Jane Doe... Pre-op diagnosis was acute cholecystitis... The patient was brought to the OR... I then inserted the trocars..."
* **Analysis:** "Dictating the operative note" and "I then inserted..." are definitive. This is \`Operative\` and the context is \`Operative-Dictation\`.
* **Output:** \`{ "encounterType": "Operative", "documentationStandard": "Operative_Report", "speakerContext": "Operative-Dictation" }\`

---
**BEGIN ANALYSIS.**
Input Transcript:
${chunks}`;

    return triagePrompt;
  }

  private getCleanPrompt(speakerContext: string, dirtyChunk: string, state: MainThreadEncounterState): string {
    const cleanPrompt = `You are a medical transcript cleaning specialist with advanced contextual awareness. Your sole function is to clean a *single chunk* of a raw medical transcript using the full encounter context to make aggressive medical corrections. You must follow every instruction exactly as written. Your output must be *only* the cleaned text and nothing else.

**INPUT:**
1.  **SPEAKER_CONTEXT:** ${speakerContext}
2.  **DIRTY_CHUNK:** ${dirtyChunk}
3.  **ENCOUNTER_CONTEXT:** ${state.encounterSummary}
4.  **CLINICAL_CONTEXT:** ${state.clinicalContext}
5.  **KEY_MEDICAL_TERMS:** ${state.keyMedicalTerms.join(', ')}
6.  **PREVIOUS_CHUNKS:** ${state.allCleanedDiarizedChunks.slice(-3).join(' | ')}

**OUTPUT:**
You must begin your response *immediately* with the cleaned transcript chunk. Do not write any introductory text. Do not write "Here is the cleaned chunk." Output *only* the cleaned text.

---
### **CORE CLEANING RULES**

**RULE 0: INTELLIGENT CONTEXTUAL INFERENCE (MOST IMPORTANT)**
You are not just cleaning grammar - you are an intelligent medical scribe who uses ALL available context to infer what was actually meant, even when the speech-to-text is severely corrupted.

**CRITICAL MINDSET:** The raw text may be completely wrong. Your job is to use medical intelligence to figure out what the speaker ACTUALLY said based on:
- The clinical scenario (CLINICAL_CONTEXT)
- What makes medical sense (KEY_MEDICAL_TERMS)  
- The conversation flow (PREVIOUS_CHUNKS)
- The speaker type (SPEAKER_CONTEXT)

**INTELLIGENT INFERENCE EXAMPLES:**

**Example 1 - TB Consultation Context:**
- **Previous chunks:** "Patient reports persistent cough with blood"
- **Current chunk:** "we need spirit him samples and TV antigens testing"
- **Inference:** TB consultation + respiratory symptoms + "samples" = Must be SPUTUM samples
- **Correction:** "we need sputum samples and TB antigens testing"
- **Logic:** "spirit him" makes no medical sense, but "sputum" fits perfectly with TB workup

**Example 2 - Cardiac Surgery Context:**
- **Previous chunks:** "Patient prepared for cardiac surgery, sterile field ready"
- **Current chunk:** "nurse please hand me the 10 play"
- **Inference:** Surgery context + instrument request = Must be "10-blade"
- **Correction:** "nurse please hand me the 10-blade"
- **Logic:** "10 play" makes no sense in surgery, but "10-blade" is standard surgical instrument

**Example 3 - Blood Pressure Context:**
- **Previous chunks:** "Patient complains of headaches and dizziness"
- **Current chunk:** "blood pleasure is elevated at 160 over 90"
- **Inference:** Cardiovascular context + numbers = Must be "blood pressure"
- **Correction:** "blood pressure is elevated at 160 over 90"
- **Logic:** "blood pleasure" is nonsensical, but "blood pressure" with vitals makes perfect sense

**Example 4 - Medication Context:**
- **Previous chunks:** "Patient has diabetes, needs insulin management"
- **Current chunk:** "start met for min twice daily"
- **Inference:** Diabetes context + twice daily = Must be "metformin"
- **Correction:** "start metformin twice daily"
- **Logic:** "met for min" is garbled, but "metformin" is standard diabetes medication

**RULE 0A: USE ALL CONTEXT LAYERS**
Layer your inference using multiple context sources:

**RULE 0A: USE ALL CONTEXT LAYERS**
Layer your inference using multiple context sources:

1. **CONVERSATION FLOW (PREVIOUS_CHUNKS):**
   - What was just discussed that gives clues about current garbled text?
   - If previous chunks mention "cough" and "blood", then "spirit him samples" clearly means "sputum samples"
   - If previous chunks discuss surgery prep, then "10 play" clearly means "10-blade"

2. **MEDICAL LOGIC (CLINICAL_CONTEXT + KEY_MEDICAL_TERMS):**
   - What medical terms/procedures make sense in this clinical scenario?
   - TB consultation context + "samples" = sputum samples (not urine samples)
   - Cardiac surgery context + instrument request = surgical instruments (not toys)

3. **SPEAKER KNOWLEDGE (SPEAKER_CONTEXT):**
   - What would this type of speaker realistically say?
   - Provider in surgery: Uses technical medical terms and instrument names
   - Patient in interview: Uses lay terms for symptoms, asks questions

4. **PHONETIC SIMILARITY:**
   - What sounds similar to the garbled text but makes medical sense?
   - "TV antigens" sounds like "TB antigens" and TB context confirms it
   - "husband samples" might be garbled "sputum samples" in respiratory context

**RULE 1: REMOVE ALL FILLER WORDS**
Remove all non-clinical hesitations: um, uh, er, ah, like (as filler), you know, I mean, sort of, kind of, basically, actually, well (as a starter).

**RULE 2: REMOVE FALSE STARTS AND REPETITIONS**
Keep only the completed thought, BUT preserve intentional surgical/procedural call-and-response patterns.
In operative/procedural contexts, repetition often indicates safety confirmation between Provider and Nurse. 
Preserve patterns like: "10-blade 10-blade" (instrument request + confirmation), "cooling patient to 32 patient temperature to 32 degrees" (procedure + confirmation).
Standard repetition removal still applies: "we decided to we decided to start" -> "We decided to start".

**RULE 3: CORRECT PUNCTUATION AND CAPITALIZATION**
Add proper punctuation. Capitalize proper nouns and sentence beginnings.

**RULE 4: PRESERVE MEDICAL TERMINOLOGY**
Keep all clinical terms intact. Do not change medical abbreviations.

**RULE 5: FIX OBVIOUS TRANSCRIPTION ERRORS**
Use context to fix clear speech-to-text errors.

---
**BEGIN CLEANING.**
Speaker Context: ${speakerContext}
Encounter Context: ${state.encounterSummary}
Clinical Context: ${state.clinicalContext}  
Key Medical Terms: ${state.keyMedicalTerms.join(', ')}
Previous Chunks: ${state.allCleanedDiarizedChunks.slice(-3).join(' | ')}
Raw Chunk: ${dirtyChunk}`;

    return cleanPrompt;
  }

  private getDiarizePrompt(speakerContext: string, cleanedChunk: string): string {
    const diarizePrompt = `You are a medical transcript speaker identification specialist. Your sole function is to add speaker labels to a *single, cleaned* medical transcript chunk. You must follow every instruction exactly. Your output must be *only* the labeled text and nothing else.

**INPUT:**
1.  **{{SPEAKER_CONTEXT}}:** A context key (e.g., "Operative-Dictation", "Provider-to-Patient") to guide your labeling.
2.  **{{CLEANED_CHUNK}}:** A single, cleaned, punctuated transcript chunk.

**OUTPUT:**
You must begin your response *immediately* with the speaker-labeled transcript. Do not write any introductory text. Do not write "Here is the labeled chunk." Output *only* the labeled text, using the exact format: [Label]: [Text].

---
### **CORE DIARIZATION RULES**

**RULE 0: ENCOUNTER-SPECIFIC SPEAKER IDENTIFICATION (MOST IMPORTANT)**
You must use both {{SPEAKER_CONTEXT}} AND the encounter type to determine appropriate speakers. Different medical encounters have different speaker patterns.

### **CONSULTATION ENCOUNTERS** (Provider-to-Patient)
**Expected Speakers:** Provider and Patient (primary), occasionally Nurse or Family
* **Provider Pattern:** Questions ("What brings you in?"), clinical assessments ("Your blood pressure is high"), medical explanations ("This medication will help"), examination descriptions ("I can hear a murmur")
* **Patient Pattern:** Symptom descriptions ("I have chest pain"), personal history ("I've never had this"), responses to questions ("It started yesterday"), concerns ("I'm worried about...")
* **Nurse Pattern:** Vital signs ("Blood pressure is 140 over 90"), administrative tasks ("Please step on the scale"), medication administration ("I'm giving you the injection now")
* **Family Pattern:** Third-person reports about patient ("He's been like this for days"), questions about patient care ("When can she go home?")

### **OPERATIVE ENCOUNTERS** (Operative-Dictation OR Provider-with-Team)
**Expected Speakers:** Provider (primary), Nurse, Anesthesiologist, occasionally Student or Resident

* **IF "Operative-Dictation" (Solo dictation):**
    * **95-100% Provider:** "I am making the incision", "The appendix is identified", "Hemostasis is achieved"
    * **Rarely others:** Only brief interruptions

* **IF "Provider-with-Team" (Live surgery):**
    * **Provider/Surgeon:** Commands ("Scalpel"), procedure narration ("Dissecting through fascia"), requests ("What's the blood pressure?")
    * **Nurse/Scrub Tech:** Instrument confirmations ("Ten blade"), counts ("Sponge count correct"), status updates ("Suture ready")
    * **Anesthesiologist:** Patient status ("Patient stable"), drug administration ("Giving propofol"), vital signs ("BP dropping to 90")
    * **CRITICAL - CALL-AND-RESPONSE:** "Provider: 10-blade" followed by "Nurse: 10-blade" are TWO different speakers for safety confirmation

### **EMERGENCY ENCOUNTERS** (Provider-with-Team)
**Expected Speakers:** Provider, Nurse, Paramedic, occasionally Patient or Family
* **Provider:** Treatment decisions ("Start two large bore IVs"), assessments ("This looks like STEMI"), orders ("Get me EKG stat")
* **Nurse:** Vital signs ("Pressure 80 over 50"), medication confirmation ("Epi given"), procedure updates ("IV established")
* **Paramedic:** Report giving ("42-year-old male found down"), transport details ("ETA 5 minutes"), field interventions ("CPR in progress")
* **Patient:** If conscious, symptom reports ("Can't breathe"), pain descriptions ("Crushing chest pain")

### **SPECIALIST CONSULTATION** (Provider-to-Colleague)
**Expected Speakers:** Provider (referring), Specialist, occasionally Nurse
* **Referring Provider:** Case presentation ("Sending 45-year-old with chest pain"), questions ("Need your opinion on management")
* **Specialist:** Recommendations ("I would suggest cardiac cath"), assessments ("This appears to be unstable angina")
* **Nurse:** Administrative support ("Here's the chart"), vital signs if present

### **FAMILY DISCUSSION** (Family-Discussion)
**Expected Speakers:** Provider, Family, sometimes Patient
* **Provider:** Medical explanations ("The surgery went well"), prognosis discussions ("Recovery will take 6 weeks")
* **Family:** Questions about patient ("How is he doing?"), third-person descriptions ("She hasn't been eating")
* **Patient:** If present and able, personal input ("I feel much better")

**RULE 1: EXPANDED SPEAKER LABELS FOR MEDICAL ACCURACY**
Use these speaker labels based on encounter type:

**CORE SPEAKERS (All encounters):**
* Provider - Primary attending physician, surgeon, specialist
* Patient - The individual receiving care
* Unknown - Use ONLY if truly ambiguous even with context

**CLINICAL TEAM SPEAKERS (Operative, Emergency, Inpatient):**
* Nurse - RN, LPN, charge nurse, scrub nurse
* Anesthesiologist - Anesthesia provider, CRNA
* Resident - Medical resident, intern, fellow
* Student - Medical student, nursing student
* Technician - Surgical tech, radiology tech, lab tech

**SUPPORT SPEAKERS (Consultations, Family meetings):**
* Family - Spouse, children, parents, significant others
* Specialist - Consulting physician (different from primary Provider)
* Paramedic - EMS personnel giving report

**RULE 2: MANDATORY SPEAKER FORMAT**
Every speaker's line MUST follow this exact format:
[SpeakerLabel]: [Statement text]

**CORRECT Examples:**
* Provider: When did the pain start?
* Nurse: Blood pressure is 120 over 80
* Anesthesiologist: Patient is stable under anesthesia
* Family: He's been like this for three days

**INCORRECT Examples:**
* Provider - When did the pain start? (wrong separator)
* [Provider] When did the pain start? (wrong bracket style)
* Dr. Smith: When did the pain start? (use role, not name)

**RULE 3: IDENTIFICATION PATTERNS**
Use these patterns, guided by RULE 0.

* **Provider:**
    * Asks diagnostic questions ("How long?", "Does it radiate?").
    * Uses clinical terms ("This appears to be...").
    * Gives commands or dictates actions ("Scalpel.", "Order a CBC.", "Plan is to...").
    * Explains a diagnosis or plan.

* **Patient:**
    * Describes symptoms ("I have pain," "It hurts...").
    * Uses lay terms ("pressure," "sick to my stomach").
    * Answers provider's questions ("Yesterday.", "No.").
    * Asks questions about their health ("Is it serious?").

* **Nurse:**
    * Reports vital signs ("BP is 120 over 80.", "Sats are 95%.").
    * Confirms a task ("IV started.", "Suture ready.").
    * Provides patient-facing instructions ("The doctor will be in soon.").

* **Family:**
    * Speaks *about* the patient in the third person ("He's been sick...", "She fell...").
    * Asks questions *on behalf of* the patient ("When can she go home?").

**RULE 4: HANDLE MONOLOGUES**
If the *same speaker* says multiple sentences in a row (common in Operative-Dictation), keep them under the *same label* or repeat the label for each new line. Either is acceptable, but be consistent.

* **Correct (Option A):**
    Provider: Scalpel. Making the incision now. Dissection is carried down.
* **Correct (Option B):**
    Provider: Scalpel.
    Provider: Making the incision now.
    Provider: Dissection is carried down.
    (Use Option B for better readability in dialogue.)

---
### **COMPREHENSIVE EXAMPLES**

**Example 1 (Context: Provider-to-Patient)**
* **{{CLEANED_CHUNK}}:** "What brings you in today? I've had this bad pressure in my chest for three days. It's pretty bad. Does it go anywhere? Yes, down my arm."
* **Output:**
    Provider: What brings you in today?
    Patient: I've had this bad pressure in my chest for three days. It's pretty bad.
    Provider: Does it go anywhere?
    Patient: Yes, down my arm.

**Example 2 (Context: Operative-Dictation)**
* **{{CLEANED_CHUNK}}:** "Scalpel. Making the midline incision now. Dissection is carried down to the fascia. More anesthesia, please. Yes, thank you. We can see the appendix is inflamed."
* **Output:**
    Provider: Scalpel.
    Provider: Making the midline incision now.
    Provider: Dissection is carried down to the fascia.
    Provider: More anesthesia, please.
    Nurse: Yes, thank you.
    Provider: We can see the appendix is inflamed.
    *(Note the "informed guess" that "Yes, thank you" is the Nurse responding to the Provider's request.)*

**Example 3 (Context: Provider-with-Team)**
* **{{CLEANED_CHUNK}}:** "What are her sats? Pulse ox is 92 percent on room air. Okay, let's start her on 2 liters nasal cannula and get a blood gas. Right away."
* **Output:**
    Provider: What are her sats?
    Nurse: Pulse ox is 92 percent on room air.
    Provider: Okay, let's start her on 2 liters nasal cannula and get a blood gas.
    Nurse: Right away.

**Example 4 (Context: Provider-with-Team - Surgical Call-and-Response)**
* **{{CLEANED_CHUNK}}:** "10-blade. 10-blade. Begin cooling procedure to 32. Cooling patient temperature to 32 degrees. Suture. Suture. Cross-clamp. Cross-clamp is on."
* **Output:**
    Provider: 10-blade.
    Nurse: 10-blade.
    Provider: Begin cooling procedure to 32.
    Nurse: Cooling patient temperature to 32 degrees.
    Provider: Suture.
    Nurse: Suture.
    Provider: Cross-clamp.
    Nurse: Cross-clamp is on.
    *(Note: Repetitions are intentional surgical safety confirmations, not transcription errors.)*

---
**BEGIN DIARIZATION.**
* **Context:** ${speakerContext}
* **Clean Chunk:** ${cleanedChunk}`;

    return diarizePrompt;
  }

  private getExtractPrompt(noteType: string, context: string, diarizedChunk: string): string {
    const extractPrompt = `You are a clinical information extraction specialist. Your sole function is to extract structured clinical snippets from a *single, diarized* medical transcript chunk. You must follow every instruction exactly. Your output must be *only* valid JSON and nothing else.

**INPUT:**
1.  **NOTE_TYPE:** ${noteType}
2.  **PREVIOUS_CONTEXT:** ${context}
3.  **DIARIZED_CHUNK:** ${diarizedChunk}

**OUTPUT:**
You MUST return *only* a valid JSON object in the following format:
{
  "note_snippet": {
    "subjective": null,
    "objective": null,
    "assessment": null,
    "plan": null,
    "procedure_details": null,
    "autopsy_findings": null
  },
  "next_context_summary": "Brief summary of clinical context for next chunk"
}

---
### **EXTRACTION RULES**

**RULE 1: NOTE TYPE-SPECIFIC EXTRACTION**
Extract information based on the NOTE_TYPE:

* **IF NOTE_TYPE is "SOAP":**
    * Focus on: subjective complaints, objective findings, assessments, plans
    * Extract patient-reported symptoms into \`subjective\`
    * Extract physical exam findings, vitals into \`objective\`
    * Extract diagnoses, impressions into \`assessment\`
    * Extract treatment plans, prescriptions into \`plan\`

* **IF NOTE_TYPE is "Operative" or "Procedure":**
    * Focus on: surgical steps, findings, complications
    * Extract procedural details into \`procedure_details\`
    * Extract complications or findings into \`objective\`

* **IF NOTE_TYPE is "Progress":**
    * Focus on: interval changes, current status, plans
    * Extract patient's overnight events into \`subjective\`
    * Extract current exam/vitals into \`objective\`
    * Extract updated assessments into \`assessment\`
    * Extract today's plan into \`plan\`

**RULE 2: USE PREVIOUS CONTEXT**
Consider the PREVIOUS_CONTEXT to maintain continuity and avoid duplicate information.

**RULE 3: STRUCTURED OUTPUT**
Only populate fields relevant to this chunk. Leave others as null.

---
**BEGIN EXTRACTION.**
Note Type: ${noteType}
Previous Context: ${context}
Diarized Chunk: ${diarizedChunk}`;

    return extractPrompt;
  }

  private getAssemblyPrompt(noteType: string, snippets: string): string {
    const assemblyPrompt = `You are a medical note assembly specialist. Your sole function is to create a complete, structured medical note from extracted clinical snippets. You must follow every instruction exactly. Your output must be *only* valid JSON and nothing else.

**INPUT:**
1.  **NOTE_TYPE:** ${noteType}
2.  **CLINICAL_SNIPPETS:** ${snippets}

**OUTPUT:**
You MUST return *only* a valid JSON object in the following format:
{
  "encounterType": "${noteType}",
  "noteContent": {
    "sections": [
      {
        "title": "Section Name",
        "content": "Section content"
      }
    ],
    "chiefComplaint": "Primary complaint or reason for visit",
    "keyFindings": "Most important clinical findings",
    "plan": "Treatment plan and next steps",
    "followUp": "Follow-up instructions"
  }
}

---
### **ASSEMBLY RULES**

**RULE 1: NOTE TYPE-SPECIFIC STRUCTURE**
Create sections appropriate for the NOTE_TYPE:

* **IF NOTE_TYPE is "SOAP":**
    * Sections: "Subjective", "Objective", "Assessment", "Plan"
    * Combine all subjective snippets into coherent subjective section
    * Combine all objective findings into organized objective section
    * Synthesize assessments into clear diagnostic impressions
    * Create comprehensive plan from all plan snippets

* **IF NOTE_TYPE is "Operative":**
    * Sections: "Preoperative Diagnosis", "Procedure", "Findings", "Postoperative Plan"
    * Focus on procedural narrative and findings

* **IF NOTE_TYPE is "Progress":**
    * Sections: "Interval History", "Physical Examination", "Assessment", "Plan"
    * Focus on changes since last note

**RULE 2: CLINICAL COHERENCE**
Ensure the note reads as a coherent medical document. Remove duplicates and organize logically.

**RULE 3: PRESERVE CLINICAL ACCURACY**
Do not invent information not present in the snippets. Mark unclear items appropriately.

---
**BEGIN ASSEMBLY.**
Note Type: ${noteType}
Clinical Snippets: ${snippets}`;

    return assemblyPrompt;
  }

  /**
   * Infer clinical context from triage text to guide downstream processing.
   * This helps the AI make better contextual corrections during cleaning.
   */
  private inferClinicalContext(triageText: string, encounterType: string): string {
    const text = triageText.toLowerCase();
    
    // Look for specific clinical scenarios
    if (text.includes('cough') && (text.includes('blood') || text.includes('hemoptysis') || text.includes('night sweats') || text.includes('weight loss'))) {
      return 'TB consultation - respiratory symptoms with hemoptysis';
    }
    
    if (text.includes('chest pain') && (text.includes('cardiac') || text.includes('heart') || text.includes('ekg') || text.includes('troponin'))) {
      return 'Cardiac consultation - chest pain evaluation';
    }
    
    if (text.includes('surgery') || text.includes('operative') || text.includes('incision') || text.includes('scalpel')) {
      return 'Surgical procedure';
    }
    
    if (text.includes('emergency') || text.includes('acute') || text.includes('urgent')) {
      return 'Emergency consultation';
    }
    
    if (text.includes('follow up') || text.includes('return visit') || text.includes('hospital day')) {
      return 'Follow-up visit';
    }
    
    // Default based on encounter type
    return `${encounterType} encounter`;
  }

  /**
   * Extract key medical terms from triage text to help with contextual cleaning.
   * These terms guide the AI to make better medical corrections.
   */
  private extractKeyMedicalTerms(triageText: string): string[] {
    const text = triageText.toLowerCase();
    const medicalTerms: string[] = [];
    
    // Respiratory terms
    if (text.includes('cough') || text.includes('sputum') || text.includes('hemoptysis')) {
      medicalTerms.push('sputum', 'hemoptysis', 'respiratory');
    }
    
    // Tuberculosis terms
    if (text.includes('tuberculosis') || text.includes('tb') || text.includes('mycobacterium')) {
      medicalTerms.push('tuberculosis', 'sputum', 'AFB', 'mycobacterial', 'IGRA');
    }
    
    // Cardiac terms
    if (text.includes('cardiac') || text.includes('heart') || text.includes('chest pain')) {
      medicalTerms.push('cardiac', 'ECG', 'troponin', 'chest');
    }
    
    // Surgical terms
    if (text.includes('surgery') || text.includes('operative') || text.includes('incision')) {
      medicalTerms.push('surgical', 'incision', 'suture', 'hemostasis');
    }
    
    // Common medical tests
    if (text.includes('radiograph') || text.includes('xray') || text.includes('chest x')) {
      medicalTerms.push('radiograph', 'chest X-ray');
    }
    
    return medicalTerms;
  }
}