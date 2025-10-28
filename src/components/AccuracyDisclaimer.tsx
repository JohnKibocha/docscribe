/**
 * @fileoverview Medical accuracy disclaimer component with user education.
 * 
 * Provides transparent communication about AI limitations and user responsibilities
 * for medical documentation accuracy. Essential for legal compliance and user trust.
 * 
 * @module components/AccuracyDisclaimer
 */

import React from 'react';
import { AlertTriangle, Shield, Edit3, Clock } from 'lucide-react';

interface AccuracyDisclaimerProps {
  /**
   * Estimated accuracy percentage based on current processing results
   */
  estimatedAccuracy: number;
  
  /**
   * Whether to show the disclaimer in expanded or compact mode
   */
  variant?: 'expanded' | 'compact';
  
  /**
   * Callback when user acknowledges the disclaimer
   */
  onAcknowledge?: () => void;
}

/**
 * Medical accuracy disclaimer component that educates users about AI limitations
 * and provides guidance on verification responsibilities.
 * 
 * This component is crucial for:
 * - Legal compliance (inform users of AI limitations)
 * - User education (set proper expectations)
 * - Trust building (transparent about capabilities)
 * - Workflow guidance (encourage verification)
 * 
 * @param props - Component props
 * @returns Disclaimer UI component
 */
export function AccuracyDisclaimer({ 
  estimatedAccuracy, 
  variant = 'expanded',
  onAcknowledge 
}: AccuracyDisclaimerProps) {
  
  /**
   * Get accuracy status and recommendations based on percentage
   */
  const getAccuracyStatus = (accuracy: number) => {
    if (accuracy >= 90) {
      return {
        level: 'high',
        color: 'green',
        message: 'High accuracy detected',
        recommendation: 'Review recommended for medical terminology'
      };
    } else if (accuracy >= 75) {
      return {
        level: 'medium',
        color: 'yellow',
        message: 'Moderate accuracy detected',
        recommendation: 'Careful review required, especially medical terms'
      };
    } else {
      return {
        level: 'low',
        color: 'red',
        message: 'Lower accuracy detected',
        recommendation: 'Thorough review and verification essential'
      };
    }
  };

  const status = getAccuracyStatus(estimatedAccuracy);

  if (variant === 'compact') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-medium">AI Accuracy: ~{estimatedAccuracy}%</span>
        </div>
        <p className="text-amber-600 mt-1">
          {status.recommendation}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-500 mt-0.5" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Medical Documentation Accuracy Notice
          </h3>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium 
            ${status.color === 'green' ? 'bg-green-100 text-green-700' : 
              status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 
              'bg-red-100 text-red-700'}`}>
            <div className={`w-2 h-2 rounded-full 
              ${status.color === 'green' ? 'bg-green-500' : 
                status.color === 'yellow' ? 'bg-yellow-500' : 
                'bg-red-500'}`} />
            Estimated Accuracy: {estimatedAccuracy}%
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
          <Edit3 className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Review Required</h4>
            <p className="text-sm text-blue-700 mt-1">
              All AI-generated notes require human verification before clinical use
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
          <Shield className="w-5 h-5 text-purple-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-purple-900">Privacy First</h4>
            <p className="text-sm text-purple-700 mt-1">
              All processing happens on-device. No data leaves your browser
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
          <Clock className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-900">Time Savings</h4>
            <p className="text-sm text-green-700 mt-1">
              Reduces documentation time by ~60% while maintaining quality
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Recommended Workflow:</h4>
        <ol className="text-sm text-gray-700 space-y-1">
          <li>1. Use DocScribe for initial draft generation</li>
          <li>2. Review all medical terminology and dosages</li>
          <li>3. Verify speaker attribution accuracy</li>
          <li>4. Edit and finalize before clinical submission</li>
          <li>5. Keep original audio recording for reference</li>
        </ol>
      </div>

      {onAcknowledge && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-gray-600">
            By continuing, you acknowledge these limitations and commit to proper verification.
          </p>
          <button
            onClick={onAcknowledge}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            I Understand
          </button>
        </div>
      )}
    </div>
  );
}