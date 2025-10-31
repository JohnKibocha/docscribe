/**
 * @fileoverview Regeneration service for partial pipeline execution.
 * 
 * Handles re-execution of pipeline stages 4-5 when transcript is edited.
 * Does NOT re-run stages 1-3 (triage, clean, diarize).
 * 
 * @module business/services/regenerationService
 */

import { loadTriageData } from '../../infrastructure/storage/transcriptStorage';
import { encounterStorage } from '../../infrastructure/storage/encounterStorage';
import { saveMedicalNote } from '../../infrastructure/storage/noteStorage';
import { saveTranscript } from '../../infrastructure/storage/transcriptStorage';
import { logger } from '../../shared/utils/logger';
import type { TranscriptData, MedicalNoteData, DiarizedChunk } from '../../shared/types/storage';

/**
 * Regeneration service for partial pipeline execution.
 * 
 * This service re-executes Stages 4-5 when transcript is edited:
 * - Stage 4: Extract clinical snippets from edited transcript
 * - Stage 5: Assemble new medical note from snippets
 * 
 * Does NOT re-run Stages 1-3 (triage, clean, diarize).
 */
export class RegenerationService {
  /**
   * Regenerate medical note from edited transcript.
   * 
   * Flow:
   * 1. Save current transcript as new version
   * 2. Load saved triage data
   * 3. Re-run Stage 4 (Extract) - placeholder for now
   * 4. Re-run Stage 5 (Assemble) - placeholder for now
   * 5. Save new medical note version
   * 
   * @param encounterFolderName - Encounter folder name
   * @param editedTranscript - Edited transcript data
   * @returns {Promise<MedicalNoteData | null>} Regenerated medical note
   * 
   * @example
   * ```typescript
   * const newNote = await regenerationService.regenerateFromTranscript(
   *   '2025-10-31_09-15-23_consultation',
   *   editedTranscriptData
   * );
   * ```
   */
  async regenerateFromTranscript(
    encounterFolderName: string,
    editedTranscript: TranscriptData
  ): Promise<MedicalNoteData | null> {
    try {
      logger.info('RegenerationService', 'Starting regeneration from edited transcript', {
        encounterFolderName,
        chunks: editedTranscript.content.length
      });

      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        throw new Error(`Encounter directory not found: ${encounterFolderName}`);
      }

      // Step 1: Save edited transcript as new version
      const currentVersion = editedTranscript.version;
      const newTranscriptVersion = currentVersion + 1;
      
      const updatedTranscript: TranscriptData = {
        ...editedTranscript,
        version: newTranscriptVersion,
        modifiedAt: new Date(),
        createdBy: 'user'
      };

      await saveTranscript(encounterDir, updatedTranscript, newTranscriptVersion);

      logger.info('RegenerationService', 'Transcript saved as new version', {
        version: newTranscriptVersion
      });

      // Step 2: Load saved triage data (read-only)
      const triageData = await loadTriageData(encounterDir);
      if (!triageData) {
        throw new Error('Triage data not found. Cannot regenerate without triage context.');
      }

      logger.info('RegenerationService', 'Triage data loaded', {
        encounterType: triageData.encounterType,
        documentationStandard: triageData.documentationStandard
      });

      // Step 3: Re-run Stage 4 (Extract)
      // NOTE: This is a placeholder. In full implementation, this would call
      // the AI pipeline to extract clinical snippets from edited transcript.
      // For now, we create a stub that shows the pattern.
      const extractedSnippets = await this.extractClinicalSnippets(
        updatedTranscript.content,
        triageData.encounterType,
        triageData.documentationStandard
      );

      logger.info('RegenerationService', 'Clinical snippets extracted (Stage 4)', {
        snippetCount: extractedSnippets.length
      });

      // Step 4: Re-run Stage 5 (Assemble)
      // NOTE: This is a placeholder. In full implementation, this would call
      // the AI pipeline to assemble the final medical note.
      const medicalNote = await this.assembleMedicalNote(
        extractedSnippets,
        triageData.encounterType,
        triageData.documentationStandard
      );

      logger.info('RegenerationService', 'Medical note assembled (Stage 5)');

      // Step 5: Save new medical note version
      await saveMedicalNote(encounterDir, medicalNote, medicalNote.version);

      logger.info('RegenerationService', 'Regeneration complete', {
        encounterFolderName,
        noteVersion: medicalNote.version
      });

      return medicalNote;
    } catch (error) {
      logger.error('RegenerationService', 'Failed to regenerate from transcript', error as Error);
      return null;
    }
  }

  /**
   * Extract clinical snippets from transcript (Stage 4 placeholder).
   * 
   * In full implementation, this would call the AI pipeline.
   * For now, returns a stub structure.
   * 
   * @private
   */
  private async extractClinicalSnippets(
    transcriptChunks: DiarizedChunk[],
    encounterType: string,
    documentationStandard: string
  ): Promise<any[]> {
    // Placeholder: In full implementation, this would invoke the AI pipeline
    // to extract clinical information based on the documentation standard
    
    logger.info('RegenerationService', 'Extracting clinical snippets (placeholder)', {
      chunkCount: transcriptChunks.length,
      encounterType,
      documentationStandard
    });

    // Return stub data
    return [
      {
        section: 'subjective',
        content: 'Patient presents with edited transcript content'
      },
      {
        section: 'objective',
        content: 'Findings from edited transcript'
      },
      {
        section: 'assessment',
        content: 'Assessment from edited transcript'
      },
      {
        section: 'plan',
        content: 'Plan from edited transcript'
      }
    ];
  }

  /**
   * Assemble medical note from snippets (Stage 5 placeholder).
   * 
   * In full implementation, this would call the AI pipeline.
   * For now, returns a stub structure.
   * 
   * @private
   */
  private async assembleMedicalNote(
    snippets: any[],
    encounterType: string,
    documentationStandard: string
  ): Promise<MedicalNoteData> {
    // Placeholder: In full implementation, this would invoke the AI pipeline
    // to assemble the final medical note
    
    logger.info('RegenerationService', 'Assembling medical note (placeholder)', {
      snippetCount: snippets.length,
      encounterType,
      documentationStandard
    });

    // Return stub medical note
    return {
      version: 1, // Will be incremented by caller
      encounterType,
      documentationStandard,
      noteContent: {
        format: documentationStandard,
        sections: snippets.map((snippet, index) => ({
          title: snippet.section.toUpperCase(),
          content: snippet.content,
          order: index
        })),
        chiefComplaint: 'From regenerated transcript',
        keyFindings: 'Regenerated from edited transcript',
        plan: 'Updated plan from regeneration'
      },
      createdAt: new Date(),
      createdBy: 'system'
    };
  }

  /**
   * Check if regeneration is possible for an encounter.
   * 
   * Requires:
   * - Triage data exists (from Stage 1)
   * - Transcript exists (from Stage 3)
   * 
   * @param encounterFolderName - Encounter folder name
   * @returns {Promise<{possible: boolean, reason?: string}>} Whether regeneration is possible
   */
  async canRegenerate(
    encounterFolderName: string
  ): Promise<{ possible: boolean; reason?: string }> {
    try {
      const encounterDir = await encounterStorage.getEncounterDirectory(encounterFolderName);
      if (!encounterDir) {
        return {
          possible: false,
          reason: 'Encounter directory not found'
        };
      }

      // Check for triage data
      const triageData = await loadTriageData(encounterDir);
      if (!triageData) {
        return {
          possible: false,
          reason: 'Triage data not found. Cannot regenerate without triage context.'
        };
      }

      // Check for transcript
      // In full implementation, would check for transcript file
      // For now, assume it exists if triage exists

      return { possible: true };
    } catch (error) {
      logger.error('RegenerationService', 'Failed to check regeneration possibility', error as Error);
      return {
        possible: false,
        reason: `Error checking: ${(error as Error).message}`
      };
    }
  }
}

/**
 * Singleton instance of regeneration service.
 */
export const regenerationService = new RegenerationService();

