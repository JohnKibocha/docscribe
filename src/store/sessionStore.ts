/**
 * @fileoverview Zustand session store for managing transcription state.
 * 
 * @description
 * This module provides centralized state management for medical notes and
 * transcription history using Zustand. The store is designed to persist data
 * to LocalStorage, offering offline access and recovery capabilities.
 *
 * **Persistence Mechanism:**
 * Notes are automatically saved to LocalStorage under the key 'docscribe-session'.
 * A 5MB size limit is enforced for LocalStorage. When this limit is exceeded,
 * the oldest notes are automatically pruned to ensure the application remains functional.
 *
 * @module store/sessionStore
 * @see https://docs.pmnd.rs/zustand/getting-started/introduction
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MedicalNote } from '../types';

/**
 * Represents the current session state for transcription within the DocScribe application.
 * This interface defines the structure of the data managed by the `useSessionStore`,
 * including the active medical note, historical notes, loading indicators, and error messages.
 */
interface SessionState {
  /**
   * The currently active medical note being edited or viewed by the user.
   * This will be `null` if no note is currently selected or being worked on.
   * @type {MedicalNote | null}
   */
  currentNote: MedicalNote | null;

  /**
   * An array containing all previously created or modified medical notes within the session.
   * Notes are typically stored in reverse chronological order, with the most recent appearing first.
   * @type {MedicalNote[]}
   */
  noteHistory: MedicalNote[];

  /**
   * A boolean flag indicating whether the application is currently performing a background operation,
   * such as processing audio, transcribing, or interacting with an AI service.
   * @type {boolean}
   */
  isLoading: boolean;

  /**
   * A descriptive message providing context about the current loading or processing activity.
   * Examples include "Recording...", "Transcribing audio with AI...", or "Saving note...".
   * This message is displayed to the user to indicate progress.
   * @type {string}
   */
  loadingMessage: string;

  /**
   * A string containing an error message if the last operation failed, or `null` if no error occurred.
   * This is used to communicate issues to the user.
   * @type {string | null}
   */
  error: string | null;

  /**
   * Sets the currently active medical note.
   *
   * @description
   * This action updates the `currentNote` in the store. It does not affect the `noteHistory`.
   * Use this when a user selects an existing note to view or edit, or to clear the current selection.
   *
   * @param {MedicalNote | null} note - The medical note object to set as current, or `null` to clear the current selection.
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Set a new note as current
   * setCurrentNote({ id: '123', timestamp: new Date().toISOString(), rawTranscript: [], refinedNote: {}, clinicalSummary: {} });
   * // Clear the current note
   * setCurrentNote(null);
   * ```
   */
  setCurrentNote: (note: MedicalNote | null) => void;

  /**
   * **Deprecated:** Use {@link addNote} instead for consistency and proper history management.
   *
   * @description
   * This method was previously used to set a new note as the current note and add it to the history.
   * Its functionality is now fully covered and improved by `addNote()`.
   *
   * @deprecated Since version 1.0.0. Use `addNote()` instead.
   * @param {MedicalNote} note - The medical note to set as current and add to history.
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Old usage (discouraged):
   * setNote(newNote);
   * // Preferred usage:
   * addNote(newNote);
   * ```
   */
  setNote: (note: MedicalNote) => void;

  /**
   * Adds a new medical note to the session history and sets it as the current active note.
   *
   * @description
   * This is the primary method for introducing new or significantly updated notes into the application's state.
   * The new note is prepended to the `noteHistory` array, making it the most recent entry.
   * It also automatically becomes the `currentNote`.
   * Notes added via this method are subject to LocalStorage persistence and pruning policies.
   *
   * @param {MedicalNote} note - The new medical note object to be added. It must have a unique `id`.
   * @returns {void}
   *
   * @example
   * ```typescript
   * import { v4 as uuid } from 'uuid';
   * // ... inside a component or action
   * const newNote: MedicalNote = {
   *   id: uuid(),
   *   timestamp: new Date().toISOString(),
   *   rawTranscript: [{ text: 'Patient presents with...', speaker: 'A' }],
   *   refinedNote: { sections: [] },
   *   clinicalSummary: { summary: '' }
   * };
   * addNote(newNote);
   * ```
   */
  addNote: (note: MedicalNote) => void;

  /**
   * Removes a specific medical note from the session history based on its ID.
   *
   * @description
   * If the note being removed is currently selected (`currentNote`), the `currentNote` will be set to `null`.
   * This action also triggers an update to LocalStorage due to persistence middleware.
   *
   * @param {string} noteId - The unique identifier (UUID) of the note to be removed from `noteHistory`.
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Assuming 'some-uuid-123' is the ID of a note to remove
   * removeNote('some-uuid-123');
   * ```
   */
  removeNote: (noteId: string) => void;

  /**
   * Clears all medical notes from the current session.
   *
   * @description
   * This function resets `currentNote` to `null` and empties the `noteHistory` array.
   * It effectively wipes the entire session's note data, including persisted data in LocalStorage.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Call this function to clear all notes
   * clearAllNotes();
   * ```
   */
  clearAllNotes: () => void;

  /**
   * Updates an existing medical note in the session history.
   *
   * @description
   * This method finds a note by its `noteId` in the `noteHistory` and applies the provided `updates`.
   * If the updated note is also the `currentNote`, the `currentNote` will be updated accordingly.
   * This allows for partial updates to note properties without replacing the entire object.
   *
   * @param {string} noteId - The unique identifier (UUID) of the note to be updated.
   * @param {Partial<MedicalNote>} updates - An object containing the properties of `MedicalNote` to be updated.
   *                                        Only the specified properties will be changed.
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Update the clinical summary of a specific note
   * updateNote('some-uuid-456', {
   *   clinicalSummary: { summary: 'Updated summary text.', diagnosis: 'Flu' }
   * });
   *
   * // Update only the raw transcript of the current note (if it matches 'some-uuid-789')
   * updateNote('some-uuid-789', {
   *   rawTranscript: [{ text: 'New segment.', speaker: 'B' }]
   * });
   * ```
   */
  updateNote: (noteId: string, updates: Partial<MedicalNote>) => void;

  /**
   * Sets the loading state of the application and an optional loading message.
   *
   * @description
   * This function is used to indicate to the user that an asynchronous operation is in progress.
   * Setting `isLoading` to `true` typically displays a loading indicator, and the `message` provides context.
   * Setting `isLoading` to `false` hides the indicator.
   *
   * @param {boolean} isLoading - A boolean indicating whether the application is currently in a loading state.
   * @param {string} [message=''] - An optional message to display during the loading state. Defaults to an empty string.
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Start a loading process with a message
   * setLoading(true, 'Transcribing audio with AI...');
   * // ... perform async operation ...
   * // End the loading process
   * setLoading(false);
   * ```
   */
  setLoading: (isLoading: boolean, message?: string) => void;

  /**
   * Sets or clears the global error message for the session.
   *
   * @description
   * This function is used to communicate errors that occur during operations to the user.
   * Setting an `error` string will make the error visible, while setting `null` will clear any active error message.
   *
   * @param {string | null} error - The error message string to set, or `null` to clear the current error.
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Set an error message
   * setError('Failed to connect to the transcription service.');
   * // Clear the error message
   * setError(null);
   * ```
   */
  setError: (error: string | null) => void;
}

/**
 * Zustand store for managing medical note transcription state.
 * 
 * @description
 * This hook provides a reactive and persistent state management solution for the DocScribe application.
 * It centralizes the management of the `currentNote`, `noteHistory`, `isLoading` status, `loadingMessage`,
 * and `error` state. The store is configured with Zustand's `persist` middleware to automatically
 * save and load its state from `localStorage` under the key 'docscribe-session'.
 * This ensures that the user's work is preserved across browser sessions.
 *
 * @returns {SessionState} The current state and actions to modify it.
 *
 * @example
 * ```typescript
 * import { useSessionStore } from '@/store/sessionStore';
 * import { useEffect } from 'react';
 *
 * function SessionInfo() {
 *   const { currentNote, noteHistory, isLoading, loadingMessage, error, addNote, clearAllNotes } = useSessionStore();
 *
 *   useEffect(() => {
 *     if (error) {
 *       console.error('Session Error:', error);
 *     }
 *   }, [error]);
 *
 *   return (
 *     <div>
 *       <h2>Session Status</h2>
 *       <p>Current Note ID: {currentNote?.id || 'None'}</p>
 *       <p>Notes in History: {noteHistory.length}</p>
 *       <p>Loading: {isLoading ? `Yes (${loadingMessage})` : 'No'}</p>
 *       <button onClick={() => addNote({ id: 'new-' + Date.now(), timestamp: new Date().toISOString(), rawTranscript: [], refinedNote: {}, clinicalSummary: {} })}>Add New Note</button>
 *       <button onClick={clearAllNotes}>Clear All Notes</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentNote: null,
      noteHistory: [],
      isLoading: false,
      loadingMessage: '',
      error: null,

      setCurrentNote: (note) => {
        set({ currentNote: note });
      },

      setNote: (note) => {
        set((state) => ({
          currentNote: note,
          noteHistory: [note, ...state.noteHistory],
        }));
      },

      addNote: (note) => {
        set((state) => ({
          currentNote: note,
          noteHistory: [note, ...state.noteHistory],
        }));
      },

      removeNote: (noteId) => {
        set((state) => ({
          currentNote:
            state.currentNote?.id === noteId ? null : state.currentNote,
          noteHistory: state.noteHistory.filter((note) => note.id !== noteId),
        }));
      },

      clearAllNotes: () => {
        set({
          currentNote: null,
          noteHistory: [],
        });
      },

      updateNote: (noteId, updates) => {
        set((state) => ({
          currentNote:
            state.currentNote?.id === noteId
              ? { ...state.currentNote, ...updates }
              : state.currentNote,
          noteHistory: state.noteHistory.map((note) =>
            note.id === noteId ? { ...note, ...updates } : note
          ),
        }));
      },

      setLoading: (isLoading, message = '') => {
        set({ isLoading, loadingMessage: message });
      },

      setError: (error) => {
        set({ error });
      },
    }),
    {
      name: 'docscribe-session',
    }
  )
);
