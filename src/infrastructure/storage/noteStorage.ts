/**
 * @fileoverview Medical note storage service for managing generated medical notes.
 * 
 * Handles:
 * - Saving medical notes after Stage 5 (Assemble)
 * - Loading notes for display and editing
 * - Managing note versions (via version storage)
 * 
 * @module infrastructure/storage/noteStorage
 */

import { writeFile, readFile } from './fileSystem';
import { logger } from '../../shared/utils/logger';
import type {
  MedicalNoteData
} from '../../shared/types/storage';
import { StorageError, StorageErrorType } from '../../shared/types/storage';

/**
 * Save medical note to encounter folder.
 * 
 * @param encounterDir - Encounter directory handle
 * @param noteData - Medical note data
 * @param version - Version number (default 0 for original)
 * @returns {Promise<boolean>} True if save successful
 * 
 * @example
 * ```typescript
 * const saved = await saveMedicalNote(encounterDir, {
 *   version: 0,
 *   encounterType: 'Consultation',
 *   documentationStandard: 'SOAP',
 *   noteContent: { format: 'SOAP', sections: [...] },
 *   createdAt: new Date(),
 *   createdBy: 'system'
 * });
 * ```
 */
export async function saveMedicalNote(
  encounterDir: FileSystemDirectoryHandle,
  noteData: MedicalNoteData,
  version: number = 0
): Promise<boolean> {
  try {
    logger.info('NoteStorage', 'Saving medical note', {
      version,
      encounterType: noteData.encounterType,
      sections: noteData.noteContent.sections.length
    });

    const fileName = 'medical_note.json';
    const content = JSON.stringify(noteData, null, 2);

    await writeFile(encounterDir, fileName, content, {
      createBackup: version > 0,
      atomic: true
    });

    logger.info('NoteStorage', 'Medical note saved', { version });

    return true;
  } catch (error) {
    logger.error('NoteStorage', 'Failed to save medical note', error as Error);
    return false;
  }
}

/**
 * Load medical note from encounter folder.
 * 
 * @param encounterDir - Encounter directory handle
 * @returns {Promise<MedicalNoteData | null>} Note data or null if not found
 * 
 * @example
 * ```typescript
 * const note = await loadMedicalNote(encounterDir);
 * if (note) {
 *   console.log(`Note type: ${note.encounterType}`);
 * }
 * ```
 */
export async function loadMedicalNote(
  encounterDir: FileSystemDirectoryHandle
): Promise<MedicalNoteData | null> {
  try {
    const fileName = 'medical_note.json';
    const content = await readFile(encounterDir, fileName);

    if (!content) {
      return null;
    }

    const noteData = JSON.parse(content) as MedicalNoteData;
    
    // Convert date strings back to Date objects
    noteData.createdAt = new Date(noteData.createdAt);
    if (noteData.modifiedAt) {
      noteData.modifiedAt = new Date(noteData.modifiedAt);
    }

    logger.info('NoteStorage', 'Medical note loaded', {
      version: noteData.version,
      encounterType: noteData.encounterType
    });

    return noteData;
  } catch (error) {
    logger.error('NoteStorage', 'Failed to load medical note', error as Error);
    return null;
  }
}

/**
 * Validate medical note structure before saving.
 * 
 * @param noteData - Note data to validate
 * @returns {boolean} True if valid
 * 
 * @throws {StorageError} If validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   validateMedicalNote(noteData);
 *   // Note is valid, proceed with save
 * } catch (error) {
 *   // Handle validation error
 * }
 * ```
 */
export function validateMedicalNote(noteData: MedicalNoteData): boolean {
  if (!noteData.encounterType || noteData.encounterType.trim().length === 0) {
    throw new StorageError(
      StorageErrorType.INVALID_DATA,
      'Medical note must have an encounter type'
    );
  }

  if (!noteData.documentationStandard || noteData.documentationStandard.trim().length === 0) {
    throw new StorageError(
      StorageErrorType.INVALID_DATA,
      'Medical note must have a documentation standard'
    );
  }

  if (!noteData.noteContent || !noteData.noteContent.sections) {
    throw new StorageError(
      StorageErrorType.INVALID_DATA,
      'Medical note must have content sections'
    );
  }

  if (noteData.noteContent.sections.length === 0) {
    throw new StorageError(
      StorageErrorType.INVALID_DATA,
      'Medical note must have at least one section'
    );
  }

  for (const section of noteData.noteContent.sections) {
    if (!section.title || section.title.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.INVALID_DATA,
        'All note sections must have a title'
      );
    }
    if (!section.content || section.content.trim().length === 0) {
      throw new StorageError(
        StorageErrorType.INVALID_DATA,
        'All note sections must have content'
      );
    }
  }

  return true;
}

/**
 * Format medical note as plain text for display or export.
 * 
 * @param noteData - Medical note data
 * @returns {string} Formatted plain text
 * 
 * @example
 * ```typescript
 * const text = formatNoteAsText(noteData);
 * // Returns formatted text with sections
 * ```
 */
export function formatNoteAsText(noteData: MedicalNoteData): string {
  const lines: string[] = [];

  lines.push(`Encounter Type: ${noteData.encounterType}`);
  lines.push(`Documentation Standard: ${noteData.documentationStandard}`);
  lines.push(`Created: ${noteData.createdAt.toLocaleString()}`);
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('');

  for (const section of noteData.noteContent.sections) {
    lines.push(section.title.toUpperCase());
    lines.push('-'.repeat(section.title.length));
    lines.push(section.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format medical note as HTML for display.
 * 
 * @param noteData - Medical note data
 * @returns {string} Formatted HTML
 * 
 * @example
 * ```typescript
 * const html = formatNoteAsHTML(noteData);
 * // Returns HTML with proper formatting
 * ```
 */
export function formatNoteAsHTML(noteData: MedicalNoteData): string {
  const sections = noteData.noteContent.sections
    .map(section => `
      <div class="note-section">
        <h3>${section.title}</h3>
        <div class="section-content">${section.content.replace(/\n/g, '<br>')}</div>
      </div>
    `)
    .join('');

  return `
    <div class="medical-note">
      <div class="note-header">
        <div><strong>Encounter Type:</strong> ${noteData.encounterType}</div>
        <div><strong>Documentation Standard:</strong> ${noteData.documentationStandard}</div>
        <div><strong>Created:</strong> ${noteData.createdAt.toLocaleString()}</div>
      </div>
      <div class="note-body">
        ${sections}
      </div>
    </div>
  `;
}

/**
 * Extract clinical summary from medical note.
 * 
 * @param noteData - Medical note data
 * @returns {string} Clinical summary text
 * 
 * @example
 * ```typescript
 * const summary = extractClinicalSummary(noteData);
 * ```
 */
export function extractClinicalSummary(noteData: MedicalNoteData): string {
  const summaryParts: string[] = [];

  if (noteData.noteContent.chiefComplaint) {
    summaryParts.push(`Chief Complaint: ${noteData.noteContent.chiefComplaint}`);
  }

  if (noteData.noteContent.keyFindings) {
    summaryParts.push(`Key Findings: ${noteData.noteContent.keyFindings}`);
  }

  if (noteData.noteContent.plan) {
    summaryParts.push(`Plan: ${noteData.noteContent.plan}`);
  }

  return summaryParts.join('\n\n');
}

