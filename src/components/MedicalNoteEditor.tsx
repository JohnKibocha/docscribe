/**
 * @fileoverview Medical note editing system with version control and original preservation.
 * 
 * Provides a comprehensive editing interface that allows users to refine AI-generated
 * medical notes while preserving the original version and maintaining an audit trail.
 * Essential for clinical accuracy and legal compliance.
 * 
 * @module components/MedicalNoteEditor
 */

import React, { useState, useCallback } from 'react';
import { 
  Edit3, 
  Save, 
  RotateCcw, 
  History, 
  FileText, 
  AlertCircle, 
  Check,
  Eye,
  Download
} from 'lucide-react';
import type { MedicalNote, TranscriptSegment } from '../types';

interface MedicalNoteEditorProps {
  /**
   * The original AI-generated medical note
   */
  originalNote: MedicalNote;
  
  /**
   * Callback when user saves edits
   */
  onSave: (editedNote: MedicalNote, changesSummary: string) => void;
  
  /**
   * Whether editing is currently enabled
   */
  isEditing?: boolean;
  
  /**
   * Callback to toggle editing mode
   */
  onToggleEditing?: () => void;
}

interface EditVersion {
  id: string;
  timestamp: string;
  note: MedicalNote;
  changesSummary: string;
  editedBy: string;
}

/**
 * Medical note editor with version control and audit trail.
 * 
 * Features:
 * - Non-destructive editing (original always preserved)
 * - Version history with change summaries
 * - Section-by-section editing for focused changes
 * - Real-time change tracking
 * - Export capabilities for all versions
 * 
 * @param props - Component props
 * @returns Medical note editor interface
 */
export function MedicalNoteEditor({
  originalNote,
  onSave,
  isEditing = false,
  onToggleEditing
}: MedicalNoteEditorProps) {
  
  const [editedNote, setEditedNote] = useState<MedicalNote>(originalNote);
  const [versions, setVersions] = useState<EditVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<string>('original');
  const [changesSummary, setChangesSummary] = useState<string>('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  /**
   * Calculate changes between original and edited versions
   */
  const getChangesSummary = useCallback((): string[] => {
    const changes: string[] = [];
    
    // Check clinical summary changes
    if (originalNote.clinicalSummary.chiefComplaint !== editedNote.clinicalSummary.chiefComplaint) {
      changes.push('Chief complaint modified');
    }
    if (originalNote.clinicalSummary.keyFindings !== editedNote.clinicalSummary.keyFindings) {
      changes.push('Key findings updated');
    }
    if (originalNote.clinicalSummary.plan !== editedNote.clinicalSummary.plan) {
      changes.push('Plan modified');
    }
    if (originalNote.clinicalSummary.followUp !== editedNote.clinicalSummary.followUp) {
      changes.push('Follow-up instructions changed');
    }
    
    // Check transcript changes
    if (originalNote.labeledTranscript.length !== editedNote.labeledTranscript.length) {
      changes.push('Speaker segments modified');
    } else {
      // Check for speaker or text changes
      originalNote.labeledTranscript.forEach((orig, index) => {
        const edited = editedNote.labeledTranscript[index];
        if (orig.speaker !== edited.speaker) {
          changes.push(`Speaker label changed (segment ${index + 1})`);
        }
        if (orig.text !== edited.text) {
          changes.push(`Text modified (segment ${index + 1})`);
        }
      });
    }
    
    // Check refined note changes
    if (originalNote.refinedNote.content !== editedNote.refinedNote.content) {
      changes.push('Note content revised');
    }
    
    return changes;
  }, [originalNote, editedNote]);
  
  /**
   * Save the current edits as a new version
   */
  const handleSave = useCallback(() => {
    if (!changesSummary.trim()) {
      // Auto-generate summary if none provided
      const autoSummary = getChangesSummary().join(', ') || 'Minor corrections';
      setChangesSummary(autoSummary);
    }
    
    const newVersion: EditVersion = {
      id: `v${versions.length + 1}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      note: editedNote,
      changesSummary: changesSummary || getChangesSummary().join(', '),
      editedBy: 'Current User' // In real app, would be actual user
    };
    
    setVersions(prev => [...prev, newVersion]);
    setActiveVersion(newVersion.id);
    setChangesSummary('');
    
    onSave(editedNote, newVersion.changesSummary);
    
    if (onToggleEditing) {
      onToggleEditing();
    }
  }, [editedNote, changesSummary, versions, onSave, onToggleEditing, getChangesSummary]);
  
  /**
   * Revert to original version
   */
  const handleRevertToOriginal = useCallback(() => {
    setEditedNote(originalNote);
    setActiveVersion('original');
    setChangesSummary('');
  }, [originalNote]);
  
  /**
   * Switch to a specific version
   */
  const handleSwitchVersion = useCallback((versionId: string) => {
    if (versionId === 'original') {
      setEditedNote(originalNote);
    } else {
      const version = versions.find(v => v.id === versionId);
      if (version) {
        setEditedNote(version.note);
      }
    }
    setActiveVersion(versionId);
  }, [originalNote, versions]);
  
  /**
   * Update a specific section of the clinical summary
   */
  const updateClinicalSection = useCallback((field: keyof typeof editedNote.clinicalSummary, value: string) => {
    setEditedNote(prev => ({
      ...prev,
      clinicalSummary: {
        ...prev.clinicalSummary,
        [field]: value
      }
    }));
  }, []);
  
  /**
   * Update a transcript segment
   */
  const updateTranscriptSegment = useCallback((index: number, updates: Partial<TranscriptSegment>) => {
    setEditedNote(prev => ({
      ...prev,
      labeledTranscript: prev.labeledTranscript.map((segment, i) => 
        i === index ? { ...segment, ...updates } : segment
      )
    }));
  }, []);
  
  const hasChanges = getChangesSummary().length > 0;
  
  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Medical Note Editor</h3>
            <p className="text-sm text-gray-600">
              {isEditing ? 'Editing mode active' : 'View mode'} • 
              Version: {activeVersion === 'original' ? 'Original AI' : activeVersion}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVersionHistory(!showVersionHistory)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            <History className="w-4 h-4" />
            History ({versions.length})
          </button>
          
          {isEditing && (
            <>
              <button
                onClick={handleRevertToOriginal}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                disabled={!hasChanges}
              >
                <RotateCcw className="w-4 h-4" />
                Revert
              </button>
              
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                disabled={!hasChanges}
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </>
          )}
          
          {onToggleEditing && (
            <button
              onClick={onToggleEditing}
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 
                ${isEditing 
                  ? 'border border-gray-300 hover:bg-gray-50' 
                  : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              {isEditing ? 'View' : 'Edit'}
            </button>
          )}
        </div>
      </div>
      
      {/* Changes indicator */}
      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Unsaved Changes Detected</span>
          </div>
          <div className="text-sm text-amber-600 mt-1">
            <p>Changes: {getChangesSummary().join(', ')}</p>
            {isEditing && (
              <input
                type="text"
                placeholder="Add change summary (optional)"
                value={changesSummary}
                onChange={(e) => setChangesSummary(e.target.value)}
                className="mt-2 w-full px-2 py-1 border border-amber-300 rounded text-amber-900 placeholder-amber-500"
              />
            )}
          </div>
        </div>
      )}
      
      {/* Version history panel */}
      {showVersionHistory && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Version History</h4>
          <div className="space-y-2">
            <button
              onClick={() => handleSwitchVersion('original')}
              className={`w-full text-left p-3 rounded border transition-colors ${
                activeVersion === 'original' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Original AI Version</span>
                {activeVersion === 'original' && <Check className="w-4 h-4 text-blue-600" />}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Generated: {new Date(originalNote.timestamp).toLocaleString()}
              </p>
            </button>
            
            {versions.map((version) => (
              <button
                key={version.id}
                onClick={() => handleSwitchVersion(version.id)}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  activeVersion === version.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{version.id}</span>
                  {activeVersion === version.id && <Check className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {version.changesSummary} • {new Date(version.timestamp).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Editing interface */}
      {isEditing ? (
        <div className="space-y-6">
          {/* Clinical Summary Editing */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-4">Clinical Summary</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chief Complaint
                </label>
                <textarea
                  value={editedNote.clinicalSummary.chiefComplaint}
                  onChange={(e) => updateClinicalSection('chiefComplaint', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Findings
                </label>
                <textarea
                  value={editedNote.clinicalSummary.keyFindings}
                  onChange={(e) => updateClinicalSection('keyFindings', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plan
                </label>
                <textarea
                  value={editedNote.clinicalSummary.plan}
                  onChange={(e) => updateClinicalSection('plan', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Follow-up
                </label>
                <textarea
                  value={editedNote.clinicalSummary.followUp}
                  onChange={(e) => updateClinicalSection('followUp', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>
          </div>
          
          {/* Transcript Editing */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-4">Transcript Segments</h4>
            <div className="space-y-3">
              {editedNote.labeledTranscript.map((segment, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-sm font-medium text-gray-700">Speaker:</label>
                    <select
                      value={segment.speaker}
                      onChange={(e) => updateTranscriptSegment(index, { speaker: e.target.value as any })}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="Provider">Provider</option>
                      <option value="Patient">Patient</option>
                      <option value="Nurse">Nurse</option>
                      <option value="Family">Family</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <textarea
                    value={segment.text}
                    onChange={(e) => updateTranscriptSegment(index, { text: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* View mode - show the current version */
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-4">Clinical Summary</h4>
            <div className="prose max-w-none">
              <div className="mb-4">
                <h5 className="font-medium text-gray-700">Chief Complaint:</h5>
                <p className="text-gray-900 mt-1">{editedNote.clinicalSummary.chiefComplaint}</p>
              </div>
              <div className="mb-4">
                <h5 className="font-medium text-gray-700">Key Findings:</h5>
                <p className="text-gray-900 mt-1">{editedNote.clinicalSummary.keyFindings}</p>
              </div>
              <div className="mb-4">
                <h5 className="font-medium text-gray-700">Plan:</h5>
                <p className="text-gray-900 mt-1">{editedNote.clinicalSummary.plan}</p>
              </div>
              <div>
                <h5 className="font-medium text-gray-700">Follow-up:</h5>
                <p className="text-gray-900 mt-1">{editedNote.clinicalSummary.followUp}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-4">Transcript</h4>
            <div className="space-y-3">
              {editedNote.labeledTranscript.map((segment, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4">
                  <div className="text-sm font-medium text-blue-600 mb-1">
                    {segment.speaker}
                  </div>
                  <p className="text-gray-900">{segment.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}