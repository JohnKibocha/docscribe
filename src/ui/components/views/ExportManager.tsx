/**
 * @fileoverview Professional export manager component for medical notes.
 * 
 * This component provides a comprehensive interface for exporting medical notes
 * in multiple formats with customizable options. Features include:
 * - Multi-format export (JSON, TXT, CSV, DOCX, PDF)
 * - Export configuration options
 * - Real-time export progress
 * - Error handling and user feedback
 * - Professional UI with medical branding
 * 
 * @module components/ExportManager
 */

import React, { useState, useCallback } from 'react';
import { Download, FileText, File, Table, FileType, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { useToast } from '../../hooks/ui/use-toast';
import { exportMedicalNote, DEFAULT_EXPORT_CONFIG, type ExportConfig } from '../../../shared/utils/exportHelpers';
import type { MedicalNote } from '../../../shared/types';

/**
 * Export format configuration with icons and descriptions.
 */
const EXPORT_FORMATS = [
  {
    id: 'json' as const,
    name: 'JSON',
    description: 'Structured data format for EHR systems',
    icon: FileType,
    recommended: false,
    fileSize: 'Small'
  },
  {
    id: 'txt' as const,
    name: 'Text',
    description: 'Clean, readable text format',
    icon: FileText,
    recommended: false,
    fileSize: 'Small'
  },
  {
    id: 'csv' as const,
    name: 'CSV',
    description: 'Spreadsheet format for data analysis',
    icon: Table,
    recommended: false,
    fileSize: 'Small'
  },
  {
    id: 'docx' as const,
    name: 'Word Document',
    description: 'Professional medical document',
    icon: File,
    recommended: true,
    fileSize: 'Medium'
  },
  {
    id: 'pdf' as const,
    name: 'PDF',
    description: 'Printable document with formatting',
    icon: FileText,
    recommended: true,
    fileSize: 'Medium'
  }
] as const;

/**
 * Props for the ExportManager component.
 */
interface ExportManagerProps {
  note: MedicalNote;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Export status for tracking progress.
 */
type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

/**
 * Professional export manager component.
 * 
 * @param props - Component props
 * @returns {JSX.Element} Export manager interface
 */
export function ExportManager({ note, trigger, disabled = false }: ExportManagerProps): React.JSX.Element {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'txt' | 'csv' | 'docx' | 'pdf'>('docx');
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [config, setConfig] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG);
  const [customFilename, setCustomFilename] = useState('');

  /**
   * Handles the export process for the selected format.
   */
  const handleExport = useCallback(async () => {
    if (!note) {
      toast({
        title: "Export Error",
        description: "No medical note available for export",
        variant: "destructive"
      });
      return;
    }

    setExportStatus('exporting');

    try {
      // Generate filename
      const filename = customFilename.trim() || 
        `DocScribe_${note.encounterType || 'Note'}_${new Date().toISOString().split('T')[0]}`;

      // Perform export
      await exportMedicalNote(note, selectedFormat, config, filename);

      setExportStatus('success');

      // Show success notification
      toast({
        title: "Export Successful",
        description: `Medical note exported as ${EXPORT_FORMATS.find(f => f.id === selectedFormat)?.name}`,
        variant: "default"
      });

      // Auto-close dialog after success
      setTimeout(() => {
        setIsOpen(false);
        setExportStatus('idle');
      }, 1500);

    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');

      toast({
        title: "Export Failed",
        description: (error as Error).message || "An unexpected error occurred during export",
        variant: "destructive"
      });

      // Reset status after error
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
    }
  }, [note, selectedFormat, config, customFilename, toast]);

  /**
   * Updates the export configuration.
   */
  const updateConfig = useCallback((key: keyof ExportConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  /**
   * Gets the appropriate icon based on export status.
   */
  const getStatusIcon = () => {
    switch (exportStatus) {
      case 'exporting':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Download className="h-4 w-4" />;
    }
  };

  /**
   * Gets the export button text based on status.
   */
  const getButtonText = () => {
    switch (exportStatus) {
      case 'exporting':
        return 'Exporting...';
      case 'success':
        return 'Exported Successfully';
      case 'error':
        return 'Export Failed';
      default:
        return `Export as ${EXPORT_FORMATS.find(f => f.id === selectedFormat)?.name}`;
    }
  };

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Export
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Export Medical Note
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Note Information */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Note Information</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p><strong>Type:</strong> {note.encounterType || note.refinedNote.format}</p>
              <p><strong>Date:</strong> {new Date(note.timestamp).toLocaleDateString()}</p>
              <p><strong>Sections:</strong> {note.refinedNote.sections.length}</p>
              {note.patientSummary && <p><strong>AI Summary:</strong> Available</p>}
              {note.translatedSummary && <p><strong>Translation:</strong> {note.targetLanguage}</p>}
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Export Format</Label>
            <div className="grid grid-cols-1 gap-3">
              {EXPORT_FORMATS.map((format) => {
                const Icon = format.icon;
                const isSelected = selectedFormat === format.id;
                
                return (
                  <div
                    key={format.id}
                    className={`
                      relative cursor-pointer rounded-lg border p-4 transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                    onClick={() => setSelectedFormat(format.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {format.name}
                          </h4>
                          {format.recommended && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                          {format.description}
                        </p>
                        <p className={`text-xs mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                          File size: {format.fileSize}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Filename */}
          <div className="space-y-2">
            <Label htmlFor="filename" className="text-base font-semibold">
              Custom Filename (Optional)
            </Label>
            <Input
              id="filename"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              placeholder={`DocScribe_${note.encounterType || 'Note'}_${new Date().toISOString().split('T')[0]}`}
              className="font-mono text-sm"
            />
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Export Options</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeHeader"
                    checked={config.includeHeader}
                    onCheckedChange={(checked) => updateConfig('includeHeader', checked)}
                  />
                  <Label htmlFor="includeHeader" className="text-sm">Include header</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeBranding"
                    checked={config.includeBranding}
                    onCheckedChange={(checked) => updateConfig('includeBranding', checked)}
                  />
                  <Label htmlFor="includeBranding" className="text-sm">Include branding</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeTimestamp"
                    checked={config.includeTimestamp}
                    onCheckedChange={(checked) => updateConfig('includeTimestamp', checked)}
                  />
                  <Label htmlFor="includeTimestamp" className="text-sm">Include timestamp</Label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includePatientSummary"
                    checked={config.includePatientSummary}
                    onCheckedChange={(checked) => updateConfig('includePatientSummary', checked)}
                    disabled={!note.patientSummary}
                  />
                  <Label htmlFor="includePatientSummary" className="text-sm">
                    Include patient summary
                    {!note.patientSummary && <span className="text-gray-400 ml-1">(Not available)</span>}
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeClinicalSummary"
                    checked={config.includeClinicalSummary}
                    onCheckedChange={(checked) => updateConfig('includeClinicalSummary', checked)}
                    disabled={!note.clinicalSummaryText}
                  />
                  <Label htmlFor="includeClinicalSummary" className="text-sm">
                    Include clinical summary
                    {!note.clinicalSummaryText && <span className="text-gray-400 ml-1">(Not available)</span>}
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeTranscript"
                    checked={config.includeTranscript}
                    onCheckedChange={(checked) => updateConfig('includeTranscript', checked)}
                  />
                  <Label htmlFor="includeTranscript" className="text-sm">Include transcript</Label>
                </div>
              </div>
            </div>

            {/* Clinic and Provider Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinicName" className="text-sm">Clinic Name</Label>
                <Input
                  id="clinicName"
                  value={config.clinicName || ''}
                  onChange={(e) => updateConfig('clinicName', e.target.value)}
                  placeholder="Medical Practice"
                  className="text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="physicianName" className="text-sm">Provider Name</Label>
                <Input
                  id="physicianName"
                  value={config.physicianName || ''}
                  onChange={(e) => updateConfig('physicianName', e.target.value)}
                  placeholder="Healthcare Provider"
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleExport}
              disabled={exportStatus === 'exporting' || !note}
              className="w-full gap-2"
              size="lg"
            >
              {getStatusIcon()}
              {getButtonText()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}