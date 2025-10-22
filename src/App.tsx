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
import { Toaster } from './components/ui/Toaster';
import './App.css';

/**
 * The main application component for DocScribe.
 * 
 * This component sets up the primary layout of the application, consisting of a header,
 * a main content area with a two-column grid, and a toast notification system.
 * The left column hosts the {@link VoiceDictation} component for audio input,
 * while the right column displays transcription outputs via the {@link OutputTabs} component.
 * 
 * @returns {JSX.Element} A React functional component that renders the entire DocScribe application interface.
 */
function App() {
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900">DocScribe</h1>
            <p className="text-sm text-gray-600 mt-1">
              Clinical Documentation Assistant
            </p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Voice Dictation */}
            <div className="bg-white rounded-lg shadow p-6">
              <VoiceDictation />
            </div>

            {/* Right Column - Output Tabs */}
            <div className="bg-white rounded-lg shadow p-6">
              <OutputTabs />
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <Toaster />
    </>
  );
}

export default App;
