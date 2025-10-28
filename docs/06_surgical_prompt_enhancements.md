# Surgical Call-and-Response Prompt Enhancements

**Created:** 2025-10-28  
**Last Updated:** 2025-10-28  
**Phase:** Production Optimization

## Overview

Enhanced all AI prompts to properly recognize and handle surgical/procedural call-and-response patterns where instruments and procedures are repeated between Provider and Nurse for safety confirmation.

## Problem Context

In surgical/procedural encounters, standard OR safety protocol requires call-and-response patterns:
- **Provider:** "10-blade"
- **Nurse:** "10-blade" (confirmation)
- **Provider:** "Begin cooling procedure to 32"
- **Nurse:** "Cooling patient temperature to 32 degrees" (confirmation)

The AI system was incorrectly treating these as transcription errors or false starts instead of recognizing them as intentional safety confirmations between different speakers.

## Implementation Details

### 1. Updated Triage Prompt (PROMPT_1_TRIAGE.md + mainThreadAI.ts)

**Enhanced Operative Definition:**
```markdown
2. **Operative**
   * **SURGICAL CALL-AND-RESPONSE:** May include repetitive instrument requests and confirmations ("10-blade" "10-blade", "Suture" "Suture") - this is standard OR safety protocol, not a transcription error.
```

**Enhanced Provider-with-Team Context:**
```markdown
2. **Provider-with-Team**
   * **SURGICAL CONTEXT:** Often includes call-and-response patterns for safety ("10-blade" "10-blade", "Cooling to 32" "Patient temperature to 32 degrees"). Repetition indicates confirmation between team members.
```

### 2. Updated Clean Prompt (PROMPT_2_CLEAN.md + mainThreadAI.ts)

**Enhanced RULE 2 - Repetition Handling:**
```markdown
**RULE 2: REMOVE FALSE STARTS AND REPETITIONS**
Keep only the completed thought, BUT preserve intentional surgical/procedural call-and-response patterns.

**PRESERVE Surgical Call-and-Response (DO NOT remove these repetitions):**
In operative/procedural contexts, repetition often indicates safety confirmation between Provider and Nurse. Preserve these patterns:
* **Example Input:** "10-blade 10-blade" (instrument request + confirmation)
* **Example Output:** "10-blade. 10-blade." (Keep both - different speakers)
* **Example Input:** "cooling patient to 32 patient temperature to 32 degrees" (procedure + confirmation) 
* **Example Output:** "Cooling patient to 32. Patient temperature to 32 degrees." (Keep both - safety protocol)
```

### 3. Updated Diarize Prompt (PROMPT_3_DIARIZE.md + mainThreadAI.ts)

**Enhanced Provider-with-Team Logic:**
```markdown
* **CRITICAL - SURGICAL CALL-AND-RESPONSE PATTERN:** In operative/procedural encounters, you will see intentional repetition where the Provider requests an instrument and the Nurse repeats it back for confirmation. This is NOT a transcription error - it is standard surgical protocol. Examples:
    * `Provider: 10-blade.` followed by `Nurse: 10-blade.` (instrument confirmation)
    * `Provider: Cooling patient to 32 degrees.` followed by `Nurse: Patient temperature to 32 degrees.` (procedure confirmation)
* **DO NOT** label these repetitions as the same speaker. The repetition indicates two different people for safety confirmation.
```

**Added Comprehensive Example:**
```markdown
**Example 4 (Context: Provider-with-Team - Surgical Call-and-Response)**
* **Input:** "10-blade. 10-blade. Begin cooling procedure to 32. Cooling patient temperature to 32 degrees. Suture. Suture. Cross-clamp. Cross-clamp is on."
* **Output:**
    `Provider: 10-blade.`
    `Nurse: 10-blade.`
    `Provider: Begin cooling procedure to 32.`
    `Nurse: Cooling patient temperature to 32 degrees.`
    `Provider: Suture.`
    `Nurse: Suture.`
    `Provider: Cross-clamp.`
    `Nurse: Cross-clamp is on.`
    *(Note: Repetitions are intentional surgical safety confirmations, not transcription errors.)*
```

## Files Modified

### Prompt Files (.github/prompts/)
1. **PROMPT_1_TRIAGE.md** - Enhanced Operative and Provider-with-Team definitions
2. **PROMPT_2_CLEAN.md** - Updated repetition handling rules with surgical examples
3. **PROMPT_3_DIARIZE.md** - Added surgical call-and-response pattern recognition

### Code Files (src/services/)
1. **mainThreadAI.ts** - Updated inline prompts in:
   - `getTriagePrompt()` method
   - `getCleanPrompt()` method  
   - `getDiarizePrompt()` method

## Expected Behavior Changes

### Before Enhancement:
- **Input:** "10-blade 10-blade cooling to 32 patient temperature to 32 degrees"
- **Clean Output:** "10-blade cooling to 32 degrees" (repetitions removed as errors)
- **Diarize Output:** `Provider: 10-blade cooling to 32 degrees` (single speaker)

### After Enhancement:
- **Input:** "10-blade 10-blade cooling to 32 patient temperature to 32 degrees"
- **Clean Output:** "10-blade. 10-blade. Cooling to 32. Patient temperature to 32 degrees." (repetitions preserved)
- **Diarize Output:** 
  ```
  Provider: 10-blade.
  Nurse: 10-blade.
  Provider: Cooling to 32.
  Nurse: Patient temperature to 32 degrees.
  ```

## Testing Verification

The surgical transcript example provided by the user includes these exact patterns:
- "10-blade. 10-blade."
- "Cross-clamp. Cross-clamp is on."
- "Suture. Suture."
- "Cooling. Patient is at 32 degrees."

These should now be properly recognized as Provider-Nurse confirmations rather than transcription errors.

## Technical Implementation Status

- ✅ Prompt files updated in `.github/prompts/` directory
- ✅ Inline prompts updated in `mainThreadAI.ts` 
- ✅ Build successful with no compilation errors
- ✅ Ready for testing with surgical transcripts

## References

- [User-provided surgical transcript sample](../samples/cardiac_surgery_example.md) (if saved)
- [Chrome AI Challenge competition requirements](../.github/Chrome_AI_Challenge_2025_Ultimate_Guide_2025_Oct_18.md)
- [Main action plan](../.github/action-plan.md) - Phase 2 medical accuracy requirements

## Notes

This enhancement addresses a critical gap in medical transcription accuracy for surgical specialties. Proper recognition of call-and-response patterns is essential for:

1. **Patient Safety Documentation** - Preserves the verbal confirmation chain
2. **Legal Compliance** - Maintains complete procedural records
3. **Clinical Accuracy** - Distinguishes between team communication vs individual dictation
4. **Competition Advantage** - Demonstrates sophisticated understanding of medical workflow patterns

The implementation preserves the existing 5-stage AI pipeline while adding surgical context awareness to each stage.