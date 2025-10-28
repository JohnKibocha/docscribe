/**
 * @fileoverview Chrome AI Setup Guide component for DocScribe.
 * 
 * @description
 * This component provides a comprehensive setup guide for enabling Chrome's built-in AI
 * capabilities. It checks the current API availability status and provides step-by-step
 * instructions to help users configure their browser correctly.
 * 
 * @module components/ChromeAISetup
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, Settings, Download } from 'lucide-react';
import { isChromeAIAvailable, getChromeAIStatus } from '../services/chromeAI';
import { logger } from '../utils/logger';

/**
 * Chrome AI availability status type.
 */
type AIAvailabilityStatus = 'available' | 'readily' | 'after-download' | 'downloading' | 'no' | 'unavailable' | 'unknown';

/**
 * Setup step configuration interface.
 */
interface SetupStep {
  id: string;
  title: string;
  description: string;
  action?: {
    text: string;
    url?: string;
    onClick?: () => void;
  };
  completed: boolean;
}

/**
 * Chrome AI Setup Guide component.
 * 
 * Provides users with step-by-step instructions to enable Chrome's built-in AI capabilities
 * and troubleshoot common configuration issues.
 * 
 * @returns {JSX.Element} The setup guide interface
 */
export function ChromeAISetup() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [status, setStatus] = useState<AIAvailabilityStatus>('unknown');
  const [steps, setSteps] = useState<SetupStep[]>([]);

  /**
   * Checks Chrome AI availability and updates component state.
   */
  const checkAIAvailability = async () => {
    setIsChecking(true);
    logger.info('ChromeAISetup', 'Checking AI availability');
    
    try {
      // Use the Chrome AI service to check availability
      const availability = await getChromeAIStatus();
      setStatus(availability as AIAvailabilityStatus);
      
      const available = await isChromeAIAvailable();
      setIsAvailable(available);
      updateSteps(availability as AIAvailabilityStatus);
      
      logger.info('ChromeAISetup', `AI availability check completed`, {
        status: availability,
        isAvailable: available
      });
      
    } catch (error) {
      logger.error('ChromeAISetup', 'Failed to check AI availability', error as Error);
      setStatus('unavailable');
      setIsAvailable(false);
      updateSteps('unavailable');
    } finally {
      setIsChecking(false);
    }
  };

  /**
   * Updates the setup steps based on the current AI availability status.
   */
  const updateSteps = (currentStatus: AIAvailabilityStatus) => {
    const baseSteps: SetupStep[] = [
      {
        id: 'browser',
        title: 'Use Chrome Canary',
        description: 'Chrome AI requires Chrome Canary version 143 or later.',
        action: {
          text: 'Download Chrome Canary',
          url: 'https://www.google.com/chrome/canary/'
        },
        completed: typeof LanguageModel !== 'undefined'
      },
      {
        id: 'flags',
        title: 'Enable AI Flags',
        description: 'Enable the required Chrome flags for built-in AI functionality and multimodal capabilities.',
        action: {
          text: 'Open Chrome Flags',
          url: 'chrome://flags/#prompt-api-for-gemini-nano'
        },
        completed: typeof LanguageModel !== 'undefined'
      },
      {
        id: 'multimodal',
        title: 'Enable Multimodal Audio (Origin Trial)',
        description: 'For audio transcription, enable experimental multimodal features.',
        action: {
          text: 'Open Multimodal Flag',
          url: 'chrome://flags/#prompt-api-for-gemini-nano-multimodal-input'
        },
        completed: currentStatus === 'readily' || currentStatus === 'available'
      },
      {
        id: 'model',
        title: 'Download Gemini Nano',
        description: 'The Gemini Nano model needs to be downloaded for AI functionality.',
        action: {
          text: 'Download Model',
          onClick: () => {
            window.open('/src/utils/download-gemini-nano.html', '_blank');
          }
        },
        completed: currentStatus === 'readily' || currentStatus === 'available'
      }
    ];

    // Add restart step if needed
    if (currentStatus === 'unavailable' && typeof LanguageModel !== 'undefined') {
      baseSteps.push({
        id: 'restart',
        title: 'Restart Chrome',
        description: 'After enabling flags, restart Chrome for changes to take effect.',
        completed: false
      });
    }

    setSteps(baseSteps);
  };

  useEffect(() => {
    checkAIAvailability();
  }, []);

  if (isAvailable) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="text-lg font-semibold text-green-800">Chrome AI Ready</h3>
            <p className="text-green-700">
              Gemini Nano is configured and ready for medical transcription.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Chrome AI Setup Required</h3>
          <p className="text-gray-600">
            Configure Chrome's built-in AI to use DocScribe's medical transcription features.
          </p>
        </div>
      </div>

      {isChecking ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Checking AI availability...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">Current Status</h4>
            <div className="flex items-center gap-2">
              {status === 'readily' || status === 'available' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : status === 'downloading' ? (
                <Download className="w-5 h-5 text-blue-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              )}
              <span className="text-sm text-gray-700">
                {status === 'readily' || status === 'available' ? 'AI is ready' :
                 status === 'downloading' ? 'Model is downloading' :
                 status === 'after-download' ? 'Model download required' :
                 'AI not available'}
              </span>
            </div>
          </div>

          {/* Setup Steps */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">Setup Steps</h4>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  step.completed 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex-shrink-0 mt-1">
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">{index + 1}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-800">{step.title}</h5>
                  <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                  {step.action && !step.completed && (
                    <div className="mt-2">
                      {step.action.url ? (
                        <a
                          href={step.action.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        >
                          {step.action.text}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : step.action.onClick ? (
                        <button
                          onClick={step.action.onClick}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        >
                          {step.action.text}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Refresh Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={checkAIAvailability}
              disabled={isChecking}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isChecking ? 'Checking...' : 'Check Again'}
            </button>
          </div>

          {/* Troubleshooting */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Troubleshooting</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Make sure you're using Chrome Canary (not regular Chrome)</li>
              <li>• Restart Chrome completely after enabling flags</li>
              <li>• Ensure you have at least 22 GB of free disk space</li>
              <li>• Check that your system meets the hardware requirements</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}