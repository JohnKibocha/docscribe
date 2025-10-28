/**
 * @fileoverview AI Web Worker for background medical transcription processing.
 * 
 * CRITICAL: This worker runs in a separate thread from the main UI to prevent
 * freezing and enable true async operation. It implements the 4-stage AI pipeline:
 * 1. TRIAGE - Determine encounter type and speaker context (first 3 chunks)
 * 2. CLEAN - Remove filler words and correct grammar per chunk
 * 3. DIARIZE - Add speaker labels and structure per chunk  
 * 4. EXTRACT - Extract clinical snippets with context per chunk
 * 5. ASSEMBLE - Combine all snippets into final structured note
 * 
 * The worker uses the correct LanguageModel API pattern from download-gemini-nano.html
 * and processes chunks sequentially to maintain context continuity.
 * 
 * @module workers/aiWorker
 */

// CRITICAL: Use correct Chrome AI API declarations from download-gemini-nano.html
// Note: Chrome AI APIs might not be available in Web Worker context
declare const LanguageModel: any;
declare const Summarizer: any;

/**
 * State object for managing individual encounter processing.
 * Each encounter has its own state to allow concurrent processing.
 */
interface EncounterState {
  /** Whether triage phase is complete */
  triageComplete: boolean;
  /** Chunks collected for triage analysis */
  triageChunks: string[];
  /** Detected encounter type from triage */
  detectedEncounterType: string;
  /** Detected documentation standard from triage */
  detectedDocumentationStandard: string;
  /** Detected speaker context from triage */
  detectedSpeakerContext: string;
  /** Cumulative context summary for maintaining continuity */
  processingContext: string;
  /** All processed chunks for real-time transcript */
  allCleanedDiarizedChunks: string[];
  /** All extracted clinical snippets for final assembly */
  allNoteSnippets: any[];
  /** Global processing lock for ALL AI operations */
  isProcessing: boolean;
  /** Queue for chunks received during processing */
  pendingChunks: string[];
  /** Flag if final note generation is requested */
  pendingFinalNote: boolean;
  /** Flag to reject new chunks after stop is requested */
  isStopping: boolean;
  // Enhanced contextual awareness
  /** Rolling summary of the encounter for context */
  encounterSummary: string;
  /** Extracted medical terms for context-aware cleaning */
  keyMedicalTerms: string[];
  /** Inferred clinical scenario (e.g., "TB consultation", "cardiac surgery") */
  clinicalContext: string;
}

// Global worker state
let aiSession: any = null;
let encounters: Record<string, EncounterState> = {};

// AI Prompts (loaded from .github/prompts/)
const PROMPT_1_TRIAGE = `You are a Senior Clinical Informatics Analyst. Your sole function is to analyze the first few minutes of a medical transcript to definitively determine the \`encounterType\` and \`documentationStandard\`. You must follow all rules precisely. Your output must be *only* a valid JSON object and nothing else.

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
    * **Example:** A patient visiting their primary care doctor for a cough. A specialist seeing a patient for a new-onset rash.

2.  **Operative**
    * **Definition:** The dictation of a surgical procedure, often dictated by a single surgeon *during* or *immediately after* the case. It is a narrative of actions.
    * **Keywords & Patterns:** "Scalpel," "Incision," "Dissection," "Hemostasis achieved," "We then identified the...", "Findings include...", "Closure was performed...". Often uses first-person ("I," "We").
    * **SURGICAL CALL-AND-RESPONSE:** May include repetitive instrument requests and confirmations ("10-blade" "10-blade", "Suture" "Suture") - this is standard OR safety protocol, not a transcription error.
    * **Example:** "We began with a midline incision. Dissection was carried down through...".

3.  **Procedure**
    * **Definition:** A non-surgical or minimally invasive procedure, often done outside a formal operating room.
    * **Keywords & Patterns:** "We will now perform the...", "Consent was obtained," "The area was prepped and draped," "Needle was inserted...".
    * **Example:** A central line placement, a lumbar puncture, an endoscopy ("Scope was advanced..."), or a skin biopsy.

4.  **SpecialistConsult**
    * **Definition:** A specialist provides their opinion on a patient at the request of another provider. The note is structured as a formal reply.
    * **Keywords & Patterns:** "Thank you for the consult," "Patient seen at the request of...", "My recommendations are...", "Impression: ...".
    * **Example:** A cardiologist seeing an inpatient for chest pain at the request of the hospitalist.

5.  **Emergency**
    * **Definition:** An urgent, acute encounter in an Emergency Department setting. Focus is on rapid triage, workup, and disposition.
    * **Keywords & Patterns:** "Arrived by ambulance," "Chief complaint is...", "Triage vitals...", "Patient is acute...". The dialogue is fast-paced and action-oriented.
    * **Example:** "Patient presents with acute shortness of breath. Vitals are... Get me an EKG and a chest x-ray, stat."

6.  **Progress**
    * **Definition:** A daily follow-up note for an *admitted* inpatient. It reviews events over the last 24 hours.
    * **Keywords & Patterns:** "Hospital day number three," "Overnight, the patient...", "Patient reports feeling...", "Plan for today is...".
    * **Example:** "This is hospital day 4. Overnight, the patient's fever resolved. Vitals are stable."

7.  **Autopsy**
    * **Definition:** A post-mortem examination. The language is highly specific and descriptive of a deceased person.
    * **Keywords & Patterns:** "Cause of death," "External examination reveals...", "Internal examination of the...", "The heart weighed...".
    * **Example:** "External examination of the body reveals...".

---
### **DEFINITIONS: DOCUMENTATION STANDARDS (Choose One)**
You must identify the *documentation format* being used.

1.  **SOAP**
    * **Definition:** Subjective, Objective, Assessment, Plan format commonly used for consultations and routine encounters.
    * **Keywords & Patterns:** Clear subjective complaints, objective findings, clinical assessment, and treatment plan.
    * **Example:** Most outpatient visits and routine consultations.

2.  **Operative_Report**
    * **Definition:** Structured surgical documentation including preop diagnosis, procedure performed, findings, and postop plan.
    * **Keywords & Patterns:** Procedure steps, surgical findings, anatomical descriptions, technique details.
    * **Example:** Surgical procedures and operative dictations.

3.  **Narrative**
    * **Definition:** Free-form documentation without strict structural requirements.
    * **Keywords & Patterns:** Conversational flow, mixed topics, informal documentation style.
    * **Example:** Emergency notes, progress notes, informal consultations.

---
### **DEFINITIONS: SPEAKER CONTEXTS (Choose One)**
You must classify the *primary social interaction* into one of these 5 categories. This is separate from the \`encounterType\`.

1.  **Provider-to-Patient**
    * **Definition:** A provider (doctor, NP, PA) is interviewing a patient.
    * **Pattern:** A clear question-and-answer flow. Provider uses medical terms, then often simplifies them. Patient uses lay terms ("hurts," "dizzy").
    * **Example:** "Does the pain radiate anywhere?" "Yes, down my left arm."

2.  **Provider-with-Team**
    * **Definition:** A provider is speaking to other clinical staff (Nurse, Resident, Medical Assistant).
    * **Pattern:** This is collaborative or directive. "What are the vitals?", "Let's give 50 of heparin.", "Sponge count correct?". One provider is clearly leading.
    * **SURGICAL CONTEXT:** Often includes call-and-response patterns for safety ("10-blade" "10-blade", "Cooling to 32" "Patient temperature to 32 degrees"). Repetition indicates confirmation between team members.
    * **Example:** "Get me a 10-blade. Vitals stable?" "Yes, 120 over 80."

3.  **Operative-Dictation**
    * **Definition:** A *single* provider is narrating their actions as they perform them, or dictating a note for a typist.
    * **Pattern:** Almost 100% one-sided. Uses "I" or "We." No questions are being asked to a patient. It's a descriptive monologue.
    * **Example:** "I am making a 4cm incision... Dissection is carried down... The appendix is identified..."

4.  **Family-Discussion**
    * **Definition:** A provider is speaking with a patient's family members, who may or may not be present with the patient.
    * **Pattern:** You will hear third-person pronouns ("He reported...", "She is...") and labels like "Family" or "Patient's daughter."
    * **Example:** "How long has he been like this?" "About 3 days, Doctor. He's not himself."

5.  **Provider-to-Colleague**
    * **Definition:** A peer-to-peer discussion. This includes handoffs, sign-outs, or two doctors discussing a case.
    * **Pattern:** Highly technical language. Both speakers use medical jargon. It is informational, not directive or interview-style.
    * **Example:** "The patient in 302 is a 55-year-old with ACS, trops are pending..."

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
{{FIRST_3_CHUNKS}}`;

const PROMPT_2_CLEAN = `You are a medical transcript cleaning specialist with advanced contextual awareness. Your sole function is to clean a *single chunk* of a raw medical transcript using the full encounter context to make aggressive medical corrections. You must follow every instruction exactly as written. Your output must be *only* the cleaned text and nothing else.

**INPUT:**
1.  **\`{{SPEAKER_CONTEXT}}\`:** A context key (e.g., "Operative-Dictation", "Provider-to-Patient") to guide your corrections.
2.  **\`{{DIRTY_CHUNK}}\`:** A single, raw, unpunctuated transcript chunk containing errors.
3.  **\`{{ENCOUNTER_CONTEXT}}\`:** Full encounter summary for contextual correction.
4.  **\`{{CLINICAL_CONTEXT}}\`:** Specific clinical scenario (e.g., "TB consultation", "cardiac surgery").
5.  **\`{{KEY_MEDICAL_TERMS}}\`:** Relevant medical terms for this encounter.
6.  **\`{{PREVIOUS_CHUNKS}}\`:** Last 3 processed chunks for conversation flow context.

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
Use context to fix clear speech-to-text errors.`;

const PROMPT_3_DIARIZE = `You are a medical transcript speaker identification specialist. Your sole function is to add speaker labels to a *single, cleaned* medical transcript chunk. You must follow every instruction exactly. Your output must be *only* the labeled text and nothing else.

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
* **Context:** {{SPEAKER_CONTEXT}}
* **Clean Chunk:** {{CLEANED_CHUNK}}`;

const PROMPT_4_EXTRACT = `You are a Medical Documentation Specialist. Your function is to process *one single diarized chunk* of a medical transcript and extract two specific items:
1.  A \`note_snippet\` containing *only* the new clinical information from this chunk.
2.  A \`next_context_summary\` (a "memory" string) for the *next* chunk to use.

You must follow all instructions. Your output must be *only* a valid JSON object.

**INPUT:**
1.  **\`{{DETECTED_NOTE_TYPE}}\`:** The overall note type (e.g., "SOAP", "Operative").
2.  **\`{{PREVIOUS_CONTEXT_SUMMARY}}\`:** The memory from the *last* chunk. This will be empty for the first chunk.
3.  **\`{{CURRENT_DIARIZED_CHUNK}}\`:** The single, speaker-labeled chunk to process.

**OUTPUT:**
You MUST return *only* a valid JSON object in the following format. Do not write any other text.
{
  "note_snippet": {
    "subjective": "[Patient statements, or null]",
    "objective": "[Provider findings/vitals, or null]",
    "assessment": "[Provider diagnoses, or null]",
    "plan": "[Provider plans/orders, or null]",
    "procedure_details": "[Operative/Procedure steps, or null]",
    "autopsy_findings": "[Autopsy findings, or null]"
  },
  "next_context_summary": "[Your 1-sentence summary of this chunk for the next loop]"
}

---
### **CORE EXTRACTION RULES**

**RULE 1: THIS IS *NOT* A SUMMARY. IT IS A DETAILED EXTRACTION.**
Your developer has been clear: a medical note requires *full detail*. Do not summarize. You must extract the clinical information *verbatim* or as close as possible, sorted into the correct category.
* **Input:** \`Patient: I have a crushing pressure in my chest.\`
* **Correct \`subjective\`:** \`"crushing pressure in my chest"\`
* **INCORRECT:** \`"chest pain"\` (This is summarization and is forbidden.)

**RULE 2: POPULATE THE \`note_snippet\` BASED ON \`{{DETECTED_NOTE_TYPE}}\`**
Use the \`noteType\` to know *what* to look for.

* **IF \`noteType\` is "SOAP", "Emergency", "Consultation", or "Progress":**
    * \`Patient\` statements -> go into \`subjective\`.
    * \`Nurse\` statements (vitals) -> go into \`objective\`.
    * \`Provider\` physical exam findings -> go into \`objective\`.
    * \`Provider\` diagnoses ("This is pneumonia") -> go into \`assessment\`.
    * \`Provider\` orders ("Let's get a CBC") -> go into \`plan\`.
    * Leave other snippet keys (e.g., \`procedure_details\`) as \`null\`.

* **IF \`noteType\` is "Operative" or "Procedure":**
    * \`Provider\` statements about actions ("Incision made...") -> go into \`procedure_details\`.
    * \`Provider\` statements about findings ("Appendix is inflamed") -> go into \`procedure_details\`.
    * Leave \`subjective\`, \`objective\`, etc., as \`null\`.

**RULE 3: UPDATE THE \`next_context_summary\`**
Write a 1-sentence summary of the *new* clinical information in this chunk. This becomes the "memory" for the next chunk.
* **Purpose:** To maintain continuity. The next chunk will know "where we left off."
* **Example:** "Provider is currently examining the patient's cardiovascular system and has noted irregular heart sounds."
* **Keep it brief but informative.**`;

const PROMPT_5_ASSEMBLE = `You are a medical documentation specialist. Your sole function is to convert a list of clinical snippets into complete, professional, EHR-ready medical notes in structured JSON format. You must follow every instruction exactly as written.

**INPUT SPECIFICATION:**
You will receive a list of "note snippets" extracted chunk-by-chunk from a transcript. You must synthesize these snippets into the single, final, comprehensive medical note.
* **Encounter Type:** \`{{DETECTED_NOTE_TYPE}}\`
* **Combined Snippets:**
\`{{COMBINED_SNIPPETS}}\`

**Instructions:**
Assemble a complete, comprehensive, and professionally formatted medical note in JSON.
- Structure the final output according to the JSON schema for the detected 'Encounter Type'.
- Synthesize all the snippets, remove redundancy, and ensure it is a coherent final document.
- Populate all fields in the JSON schema based *only* on the provided snippets. Use null for any information not present.

**OUTPUT FORMAT REQUIREMENT:**
You must begin your response immediately with valid JSON. Do not write any introductory text. Do not write "Here is the medical note" or "I will now generate" or any similar statement. Do not write any concluding text after the JSON. Output only valid JSON and nothing else. Do not wrap the JSON in markdown code blocks.

**CORE PRINCIPLES:**

PRINCIPLE 1: COMPLETENESS OVER BREVITY
You must include ALL clinical information from the transcript snippets. Do NOT summarize. Do NOT condense. Do NOT omit details. Medical-legal standards require complete documentation.

PRINCIPLE 2: VERBATIM CLINICAL DETAILS
Preserve exact medical terminology, dosages, measurements, and patient statements from the snippets. If a snippet contains "crushing chest pain radiating to my left arm," write exactly that, not "chest pain with radiation."

PRINCIPLE 3: PROFESSIONAL MEDICAL LANGUAGE
Write in professional medical documentation style. Use complete sentences. Use proper medical terminology. Maintain objective clinical tone.

**JSON OUTPUT STRUCTURE:**

ALL ENCOUNTER TYPES MUST INCLUDE THIS TOP-LEVEL STRUCTURE:
{
  "encounterType": "[Consultation|Operative|SpecialistConsult|Emergency|Progress|Autopsy|Procedure]",
  "encounterDate": "[extracted from transcript if mentioned, otherwise null]",
  "encounterTime": "[extracted from transcript if mentioned, otherwise null]",
  "providers": ["[list all providers mentioned by name or 'Provider' if no names given]"],
  "patient": {
    "demographics": "[any demographic info mentioned: age, sex, race]",
    "identifiers": "[any patient identifiers mentioned: MRN, account number]"
  },
  "noteContent": {
    [Format varies by encounter type - see below]
  },
  "metadata": {
    "completenessScore": "[percentage estimate of how many expected fields were filled]",
    "processingNotes": "[any notable limitations or gaps in the source data]"
  }
}

**FOR SOAP NOTES (noteContent structure):**
{
  "chiefComplaint": "[primary reason for visit]",
  "historyOfPresentIllness": "[detailed HPI]",
  "reviewOfSystems": "[any ROS mentioned]",
  "pastMedicalHistory": "[PMH mentioned]",
  "medications": ["[list of medications]"],
  "allergies": "[allergies mentioned]",
  "socialHistory": "[social history details]",
  "familyHistory": "[family history mentioned]",
  "physicalExam": {
    "vitalSigns": "[vital signs from snippets]",
    "generalAppearance": "[general appearance notes]",
    "systems": {
      "[system]": "[findings for that system]"
    }
  },
  "assessment": "[primary and secondary diagnoses]",
  "plan": "[treatment plan, orders, follow-up]"
}`;

/**
 * Initialize the AI session using the correct LanguageModel API pattern.
 * CRITICAL: Uses LanguageModel directly, not deprecated ai.languageModel
 */
async function initializeAI(): Promise<void> {
  try {
    // Check if LanguageModel is available in this Web Worker context
    if (typeof LanguageModel === 'undefined') {
      throw new Error('LanguageModel API is not available in this Web Worker context. Chrome AI flags may not be properly enabled.');
    }

    // Check availability using correct pattern from download-gemini-nano.html
    const availability = await LanguageModel.availability();
    if (availability !== 'readily-available' && availability !== 'available') {
      throw new Error(`LanguageModel not ready: ${availability}. Please ensure Chrome AI is properly configured.`);
    }

    // Create session with medical system prompt
    aiSession = await LanguageModel.create({
      systemPrompt: 'You are an expert medical AI assistant specialized in clinical documentation. Follow all instructions precisely and return only the requested format.'
    });

    // Notify main thread that worker is ready
    self.postMessage({ type: 'workerReady' });
    
  } catch (error) {
    console.error('AI Worker initialization failed:', error);
    self.postMessage({ 
      type: 'error', 
      payload: { message: `AI initialization failed: ${(error as Error).message}` }
    });
  }
}

/**
 * Process a single chunk through the AI pipeline.
 * Implements the sequential 4-stage process: Clean -> Diarize -> Extract
 */
async function processChunk(encounterID: string, dirtyChunk: string): Promise<void> {
  const state = encounters[encounterID];
  if (!state || !aiSession) return;

  try {
    // STAGE 1: TRIAGE (only for first 3 chunks)
    if (!state.triageComplete) {
      state.triageChunks.push(dirtyChunk);
      
      if (state.triageChunks.length === 3) {
        const triageInput = state.triageChunks.join("\\n\\n");
        const triagePrompt = PROMPT_1_TRIAGE.replace("{{FIRST_3_CHUNKS}}", triageInput);
        
        const triageResult = await aiSession.prompt(triagePrompt);
        const triageJson = JSON.parse(triageResult);
        
        state.detectedEncounterType = triageJson.encounterType;
        state.detectedDocumentationStandard = triageJson.documentationStandard;
        state.detectedSpeakerContext = triageJson.speakerContext;
        state.triageComplete = true;
        
        // Extract clinical context from triage chunks for better downstream processing
        const triageText = state.triageChunks.join(' ').toLowerCase();
        state.clinicalContext = inferClinicalContext(triageText, state.detectedEncounterType);
        state.encounterSummary = `${state.detectedEncounterType} - ${state.clinicalContext}`;
        state.keyMedicalTerms = extractKeyMedicalTerms(triageText);
        
        // Notify main thread of triage completion
        self.postMessage({ 
          type: 'triageComplete', 
          payload: { 
            noteType: triageJson.encounterType,
            context: triageJson.speakerContext
          }
        });
        
        // Re-process the first 3 chunks through the pipeline
        const chunksToProcess = [...state.triageChunks];
        state.triageChunks = [];
        
        for (const chunk of chunksToProcess) {
          await processChunk(encounterID, chunk);
        }
        return;
      } else {
        return; // Wait for more chunks for triage
      }
    }

    // STAGE 2: CLEAN
    const cleanPrompt = PROMPT_2_CLEAN
      .replace("{{SPEAKER_CONTEXT}}", state.detectedSpeakerContext)
      .replace("{{DIRTY_CHUNK}}", dirtyChunk)
      .replace("{{ENCOUNTER_CONTEXT}}", state.encounterSummary)
      .replace("{{CLINICAL_CONTEXT}}", state.clinicalContext)
      .replace("{{KEY_MEDICAL_TERMS}}", state.keyMedicalTerms.join(', '))
      .replace("{{PREVIOUS_CHUNKS}}", state.allCleanedDiarizedChunks.slice(-3).join(' | '));
    const cleanedChunk = await aiSession.prompt(cleanPrompt);

    // STAGE 3: DIARIZE
    const diarizePrompt = PROMPT_3_DIARIZE
      .replace("{{SPEAKER_CONTEXT}}", state.detectedSpeakerContext)
      .replace("{{CLEANED_CHUNK}}", cleanedChunk);
    const diarizedChunk = await aiSession.prompt(diarizePrompt);
    
    state.allCleanedDiarizedChunks.push(diarizedChunk);
    
    // Send real-time transcript update to main thread
    self.postMessage({
      type: 'diarizedChunkUpdate',
      payload: {
        encounterID: encounterID,
        fullTranscript: state.allCleanedDiarizedChunks.join("\\n\\n")
      }
    });

    // STAGE 4: EXTRACT
    const extractPrompt = PROMPT_4_EXTRACT
      .replace("{{DETECTED_NOTE_TYPE}}", state.detectedEncounterType)
      .replace("{{PREVIOUS_CONTEXT_SUMMARY}}", state.processingContext)
      .replace("{{CURRENT_DIARIZED_CHUNK}}", diarizedChunk);
      
    const snippetResponse = await aiSession.prompt(extractPrompt);
    const snippetJson = JSON.parse(snippetResponse);
    
    state.allNoteSnippets.push(snippetJson.note_snippet);
    state.processingContext = snippetJson.next_context_summary;
    
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      payload: { message: `Chunk processing failed: ${(error as Error).message}` }
    });
  }
}

/**
 * Generate the final medical note by assembling all snippets.
 * This is the 5th and final stage of the AI pipeline.
 */
async function generateFinalNote(encounterID: string): Promise<void> {
  const state = encounters[encounterID];
  if (!state || !aiSession) return;

  try {
    const snippets = JSON.stringify(state.allNoteSnippets, null, 2);
    
    // STAGE 5: ASSEMBLE
    const assemblyPrompt = PROMPT_5_ASSEMBLE
      .replace("{{DETECTED_NOTE_TYPE}}", state.detectedEncounterType)
      .replace("{{COMBINED_SNIPPETS}}", snippets);
      
    const finalNoteJSON = await aiSession.prompt(assemblyPrompt);
    
    // Send the complete result back to main thread
    self.postMessage({
      type: 'finalNoteComplete',
      payload: {
        encounterID: encounterID,
        finalNoteJSON: finalNoteJSON,
        fullTranscript: state.allCleanedDiarizedChunks.join("\\n\\n")
      }
    });
    
    // Clean up this encounter to save memory
    delete encounters[encounterID];
    
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      payload: { message: `Final assembly failed: ${(error as Error).message}` }
    });
  }
}

/**
 * Main message handler for processing commands from the main thread.
 * Handles encounter lifecycle: start -> process chunks -> generate final note
 */
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    if (type === 'startEncounter') {
      // Create new encounter state
      encounters[payload.encounterID] = {
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
        isStopping: false,
        // Enhanced contextual awareness
        encounterSummary: "",
        keyMedicalTerms: [],
        clinicalContext: ""
      };
    } else if (type === 'processChunk') {
      await processChunk(payload.encounterID, payload.dirtyChunk);
    } else if (type === 'generateFinalNote') {
      await generateFinalNote(payload.encounterID);
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      payload: { message: `Worker error: ${(error as Error).message}` }
    });
  }
};

/**
 * Infer clinical context from triage text to guide downstream processing.
 * This helps the AI make better contextual corrections during cleaning.
 */
function inferClinicalContext(triageText: string, encounterType: string): string {
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
function extractKeyMedicalTerms(triageText: string): string[] {
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

// Initialize the AI when worker starts
initializeAI();