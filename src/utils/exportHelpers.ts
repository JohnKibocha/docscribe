/**
 * @fileoverview Enterprise-grade export system for medical documentation.
 * 
 * This module provides production-quality document generation capabilities
 * including DOCX, PDF, CSV, JSON, and TXT formats. All exports are designed
 * for professional medical use with proper formatting, page flow, and EHR
 * compatibility.
 * 
 * Key Features:
 * - Professional medical document formatting
 * - Intelligent page break management
 * - Medical branding with Caduceus symbol
 * - EHR-compatible structured data
 * - Enterprise-grade error handling
 * - 100% client-side processing
 * 
 * @module utils/exportHelpers
 */

import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { exportMedicalNoteDOCX } from './exportDOCX';
import { exportMedicalNotePDF } from './exportPDF';
import type { MedicalNote } from '../types';

/**
 * Export configuration options for document generation.
 */
export interface ExportConfig {
  includeHeader: boolean;
  includeBranding: boolean;
  includeTimestamp: boolean;
  includePatientSummary: boolean;
  includeClinicalSummary: boolean;
  includeTranscript: boolean;
  pageBreakBetweenSections: boolean;
  clinicName?: string;
  physicianName?: string;
}

/**
 * Default export configuration for medical documents.
 */
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  includeHeader: true,
  includeBranding: true,
  includeTimestamp: true,
  includePatientSummary: true,
  includeClinicalSummary: true,
  includeTranscript: false,
  pageBreakBetweenSections: false,
  clinicName: 'Medical Practice',
  physicianName: 'Healthcare Provider'
};

/**
 * Professional medical color scheme for documents.
 */
export const MEDICAL_COLORS = {
  primary: '#0066CC',        // Professional medical blue
  secondary: '#2E7D32',      // Medical green
  accent: '#1565C0',         // Darker blue for headers
  text: '#212529',           // Near black for body text
  muted: '#6C757D',          // Gray for secondary text
  background: '#F8F9FA',     // Light gray background
  caduceus: '#0066CC'        // Blue for medical symbol
} as const;

/**
 * Generates a clean, structured JSON export of the medical note.
 * 
 * @param note - The medical note to export
 * @param config - Export configuration options
 * @returns {string} Formatted JSON string ready for download
 */
export function generateJSONExport(note: MedicalNote, config: ExportConfig = DEFAULT_EXPORT_CONFIG): string {
  const exportData = {
    metadata: {
      documentType: 'Medical Note',
      generatedBy: 'DocScribe',
      exportTimestamp: new Date().toISOString(),
      noteId: note.id,
      encounterTimestamp: note.timestamp,
      encounterType: note.encounterType || 'Unknown',
      ...(config.clinicName && { clinicName: config.clinicName }),
      ...(config.physicianName && { physicianName: config.physicianName })
    },
    clinicalContent: {
      encounterType: note.encounterType || note.refinedNote.format,
      refinedNote: {
        format: note.refinedNote.format,
        sections: note.refinedNote.sections.map(section => ({
          heading: section.heading,
          content: section.body,
          wordCount: section.body.split(' ').length
        }))
      },
      clinicalSummary: {
        chiefComplaint: note.clinicalSummary.chiefComplaint,
        keyFindings: note.clinicalSummary.keyFindings,
        plan: note.clinicalSummary.plan,
        followUp: note.clinicalSummary.followUp
      },
      ...(config.includePatientSummary && note.patientSummary && {
        patientFriendlySummary: note.patientSummary
      }),
      ...(config.includeClinicalSummary && note.clinicalSummaryText && {
        clinicalSummaryText: note.clinicalSummaryText
      })
    },
    ...(config.includeTranscript && {
      transcriptData: {
        rawTranscript: note.rawTranscript,
        cleanedTranscript: note.cleanedTranscript,
        labeledSegments: note.labeledTranscript.map(segment => ({
          speaker: segment.speaker,
          text: segment.text,
          wordCount: segment.text.split(' ').length
        })),
        totalWords: note.rawTranscript.split(' ').length
      }
    }),
    ...(note.translatedSummary && {
      translation: {
        targetLanguage: note.targetLanguage,
        translatedSummary: note.translatedSummary
      }
    }),
    processingMetadata: {
      aiProcessingTime: note.aiProcessingTime,
      exportTime: Date.now()
    }
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generates a professional text export with proper medical formatting.
 * 
 * @param note - The medical note to export
 * @param config - Export configuration options
 * @returns {string} Formatted text ready for download
 */
export function generateTextExport(note: MedicalNote, config: ExportConfig = DEFAULT_EXPORT_CONFIG): string {
  const lines: string[] = [];
  const separator = '=' .repeat(80);
  const sectionSeparator = '-'.repeat(60);

  // Header section
  if (config.includeHeader) {
    lines.push(separator);
    lines.push('DOCSCRIBE MEDICAL DOCUMENTATION SYSTEM');
    lines.push(separator);
    lines.push('');
    
    if (config.clinicName) {
      lines.push(`Clinic: ${config.clinicName}`);
    }
    if (config.physicianName) {
      lines.push(`Provider: ${config.physicianName}`);
    }
    lines.push(`Encounter Type: ${note.encounterType || note.refinedNote.format}`);
    lines.push(`Date: ${new Date(note.timestamp).toLocaleDateString()}`);
    lines.push(`Time: ${new Date(note.timestamp).toLocaleTimeString()}`);
    if (config.includeTimestamp) {
      lines.push(`Generated: ${new Date().toLocaleString()}`);
    }
    lines.push('');
  }

  // Clinical Summary Section
  if (config.includeClinicalSummary) {
    lines.push(sectionSeparator);
    lines.push('CLINICAL SUMMARY');
    lines.push(sectionSeparator);
    lines.push('');
    
    if (note.clinicalSummary.chiefComplaint) {
      lines.push('CHIEF COMPLAINT:');
      lines.push(note.clinicalSummary.chiefComplaint);
      lines.push('');
    }
    
    if (note.clinicalSummary.keyFindings) {
      lines.push('KEY FINDINGS:');
      lines.push(note.clinicalSummary.keyFindings);
      lines.push('');
    }
    
    if (note.clinicalSummary.plan) {
      lines.push('PLAN:');
      lines.push(note.clinicalSummary.plan);
      lines.push('');
    }
    
    if (note.clinicalSummary.followUp) {
      lines.push('FOLLOW-UP:');
      lines.push(note.clinicalSummary.followUp);
      lines.push('');
    }
  }

  // Detailed Note Sections
  lines.push(sectionSeparator);
  lines.push('DETAILED CLINICAL NOTE');
  lines.push(sectionSeparator);
  lines.push('');

  note.refinedNote.sections.forEach((section, index) => {
    lines.push(`${section.heading.toUpperCase()}:`);
    lines.push(section.body);
    if (index < note.refinedNote.sections.length - 1) {
      lines.push('');
    }
  });

  // Patient Summary (if available and requested)
  if (config.includePatientSummary && note.patientSummary) {
    lines.push('');
    lines.push(sectionSeparator);
    lines.push('PATIENT-FRIENDLY SUMMARY');
    lines.push(sectionSeparator);
    lines.push('');
    lines.push(note.patientSummary);
  }

  // Translation (if available)
  if (note.translatedSummary && note.targetLanguage) {
    lines.push('');
    lines.push(sectionSeparator);
    lines.push(`TRANSLATED SUMMARY (${note.targetLanguage.toUpperCase()})`);
    lines.push(sectionSeparator);
    lines.push('');
    lines.push(note.translatedSummary);
  }

  // Transcript (if requested)
  if (config.includeTranscript && note.labeledTranscript.length > 0) {
    lines.push('');
    lines.push(sectionSeparator);
    lines.push('CONVERSATION TRANSCRIPT');
    lines.push(sectionSeparator);
    lines.push('');
    
    note.labeledTranscript.forEach(segment => {
      lines.push(`[${segment.speaker}]: ${segment.text}`);
    });
  }

  // Footer
  lines.push('');
  lines.push(separator);
  lines.push('Generated by DocScribe - AI-Powered Medical Documentation');
  lines.push(`Export Date: ${new Date().toLocaleString()}`);
  lines.push(separator);

  return lines.join('\n');
}

/**
 * Generates an EHR-compatible CSV export with structured medical data.
 * 
 * @param note - The medical note to export
 * @param config - Export configuration options
 * @returns {string} CSV data ready for download
 */
export function generateCSVExport(note: MedicalNote, config: ExportConfig = DEFAULT_EXPORT_CONFIG): string {
  const csvData: any[] = [];

  // Metadata row
  csvData.push({
    Type: 'Metadata',
    Field: 'Note ID',
    Value: note.id,
    Timestamp: note.timestamp,
    EncounterType: note.encounterType || note.refinedNote.format,
    Clinic: config.clinicName || '',
    Provider: config.physicianName || ''
  });

  // Clinical summary rows
  if (note.clinicalSummary.chiefComplaint) {
    csvData.push({
      Type: 'Clinical Summary',
      Field: 'Chief Complaint',
      Value: note.clinicalSummary.chiefComplaint,
      Timestamp: note.timestamp,
      EncounterType: note.encounterType || note.refinedNote.format,
      Clinic: config.clinicName || '',
      Provider: config.physicianName || ''
    });
  }

  if (note.clinicalSummary.keyFindings) {
    csvData.push({
      Type: 'Clinical Summary',
      Field: 'Key Findings',
      Value: note.clinicalSummary.keyFindings,
      Timestamp: note.timestamp,
      EncounterType: note.encounterType || note.refinedNote.format,
      Clinic: config.clinicName || '',
      Provider: config.physicianName || ''
    });
  }

  if (note.clinicalSummary.plan) {
    csvData.push({
      Type: 'Clinical Summary',
      Field: 'Plan',
      Value: note.clinicalSummary.plan,
      Timestamp: note.timestamp,
      EncounterType: note.encounterType || note.refinedNote.format,
      Clinic: config.clinicName || '',
      Provider: config.physicianName || ''
    });
  }

  if (note.clinicalSummary.followUp) {
    csvData.push({
      Type: 'Clinical Summary',
      Field: 'Follow-up',
      Value: note.clinicalSummary.followUp,
      Timestamp: note.timestamp,
      EncounterType: note.encounterType || note.refinedNote.format,
      Clinic: config.clinicName || '',
      Provider: config.physicianName || ''
    });
  }

  // Note sections
  note.refinedNote.sections.forEach(section => {
    csvData.push({
      Type: 'Note Section',
      Field: section.heading,
      Value: section.body,
      Timestamp: note.timestamp,
      EncounterType: note.encounterType || note.refinedNote.format,
      Clinic: config.clinicName || '',
      Provider: config.physicianName || ''
    });
  });

  // AI-generated summaries
  if (config.includePatientSummary && note.patientSummary) {
    csvData.push({
      Type: 'AI Summary',
      Field: 'Patient Summary',
      Value: note.patientSummary,
      Timestamp: note.timestamp,
      EncounterType: note.encounterType || note.refinedNote.format,
      Clinic: config.clinicName || '',
      Provider: config.physicianName || ''
    });
  }

  if (config.includeClinicalSummary && note.clinicalSummaryText) {
    csvData.push({
      Type: 'AI Summary',
      Field: 'Clinical Summary Text',
      Value: note.clinicalSummaryText,
      Timestamp: note.timestamp,
      EncounterType: note.encounterType || note.refinedNote.format,
      Clinic: config.clinicName || '',
      Provider: config.physicianName || ''
    });
  }

  // Translation data
  if (note.translatedSummary && note.targetLanguage) {
    csvData.push({
      Type: 'Translation',
      Field: `Translated Summary (${note.targetLanguage})`,
      Value: note.translatedSummary,
      Timestamp: note.timestamp,
      EncounterType: note.encounterType || note.refinedNote.format,
      Clinic: config.clinicName || '',
      Provider: config.physicianName || ''
    });
  }

  return Papa.unparse(csvData, {
    header: true,
    delimiter: ',',
    newline: '\r\n'
  });
}

/**
 * Exports a medical note in the specified format.
 * 
 * @param note - The medical note to export
 * @param format - The export format
 * @param config - Export configuration options
 * @param filename - Optional custom filename
 */
export async function exportMedicalNote(
  note: MedicalNote,
  format: 'json' | 'txt' | 'csv' | 'docx' | 'pdf',
  config: ExportConfig = DEFAULT_EXPORT_CONFIG,
  filename?: string
): Promise<void> {
  const baseFilename = filename || `DocScribe_${note.encounterType || 'Note'}_${new Date().toISOString().split('T')[0]}`;

  try {
    switch (format) {
      case 'json':
        await exportAsJSON(note, config, baseFilename);
        break;
      case 'txt':
        await exportAsText(note, config, baseFilename);
        break;
      case 'csv':
        await exportAsCSV(note, config, baseFilename);
        break;
      case 'docx':
        await exportMedicalNoteDOCX(note, config, baseFilename);
        break;
      case 'pdf':
        await exportMedicalNotePDF(note, config, baseFilename);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    console.error(`Export failed for format ${format}:`, error);
    throw new Error(`Failed to export as ${format.toUpperCase()}: ${(error as Error).message}`);
  }
}

/**
 * Exports the medical note as a structured JSON file.
 */
async function exportAsJSON(note: MedicalNote, config: ExportConfig, filename: string): Promise<void> {
  const jsonContent = generateJSONExport(note, config);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  saveAs(blob, `${filename}.json`);
}

/**
 * Exports the medical note as a formatted text file.
 */
async function exportAsText(note: MedicalNote, config: ExportConfig, filename: string): Promise<void> {
  const textContent = generateTextExport(note, config);
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${filename}.txt`);
}

/**
 * Exports the medical note as an EHR-compatible CSV file.
 */
async function exportAsCSV(note: MedicalNote, config: ExportConfig, filename: string): Promise<void> {
  const csvContent = generateCSVExport(note, config);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${filename}.csv`);
}

/**
 * Exports the medical note as a professional DOCX document.
 */