/**
 * @fileoverview Main application component for DocScribe.
 * 
 * This is the root component that orchestrates the entire application.
 * It provides the layout structure and integrates all major components.
 *
 * @module App
 */

import { VoiceDictation } from './components/VoiceDictation';
import { OutputTabs } from './components/views/OutputTabs';
import './App.css';

/**
 * Main application component.
 * 
 * Provides a two-column layout:
 * - Left: Voice dictation recording interface
 * - Right: Transcription output tabs
 *
 * @returns {JSX.Element} The main application interface.
 */
function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            DocScribe
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Clinical Documentation Assistant
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
          {/* Left Column - Voice Dictation */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <VoiceDictation />
          </div>

          {/* Right Column - Output Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <OutputTabs />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
