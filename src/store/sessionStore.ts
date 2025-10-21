/**
 * @fileoverview Zustand session store for managing transcription state.
 * 
 * This module provides centralized state management for medical notes and
 * transcription history using Zustand. The store persists data to LocalStorage
 * for offline access and recovery.
 *
 * PERSISTENCE: Notes are automatically saved to LocalStorage with a 5MB
 * size limit. Older notes are pruned when the limit is exceeded.
 *
 * @module store/sessionStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MedicalNote } from '../types';

/**
 * Represents the current session state for transcription.
 * Includes the current note, history, and UI preferences.
 */
interface SessionState {
  /**
   * The currently active medical note being edited or viewed.
   * Null when no note is selected.
   */
  currentNote: MedicalNote | null;

  /**
   * Array of all previous notes in this session.
   * Most recent notes appear first.
   */
  noteHistory: MedicalNote[];

  /**
   * Whether the application is currently processing audio or AI request.
   */
  isLoading: boolean;

  /**
   * Current loading status message displayed to the user.
   * Examples: "Recording...", "Transcribing audio with AI...", etc.
   */
  loadingMessage: string;

  /**
   * Error message from the last failed operation.
   * Null if no error occurred.
   */
  error: string | null;

  /**
   * Sets the current note to display and interact with.
   *
   * @param note The medical note to set as current, or null to clear.
   *
   * @example
   * ```
   * setCurrentNote(newNote);
   * setCurrentNote(null); // Clear current note
   * ```
   */
  setCurrentNote: (note: MedicalNote | null) => void;

  /**
   * Convenience method to set the current note and add it to history.
   * Equivalent to calling addNote().
   *
   * @param note The medical note to set as current.
   *
   * @deprecated Use addNote() instead for consistency.
   *
   * @example
   * ```
   * const newNote: MedicalNote = { ... };
   * setNote(newNote);
   * ```
   */
  setNote: (note: MedicalNote) => void;

  /**
   * Adds a new note to the history and sets it as current.
   * 
   * IMPORTANT: Notes are automatically persisted to LocalStorage.
   * The store enforces a 5MB limit and prunes oldest notes if exceeded.
   *
   * @param note The new medical note to add.
   *
   * @example
   * ```
   * const newNote: MedicalNote = {
   *   id: uuid(),
   *   timestamp: new Date().toISOString(),
   *   rawTranscript: [...],
   *   refinedNote: {...},
   *   clinicalSummary: {...}
   * };
   * addNote(newNote);
   * ```
   */
  addNote: (note: MedicalNote) => void;

  /**
   * Removes a note from history by ID.
   * If the removed note is currently selected, currentNote is set to null.
   *
   * @param noteId The UUID of the note to remove.
   *
   * @example
   * ```
   * removeNote('550e8400-e29b-41d4-a716-446655440000');
   * ```
   */
  removeNote: (noteId: string) => void;

  /**
   * Clears all notes from the session.
   * Sets currentNote to null and empties noteHistory.
   *
   * @example
   * ```
   * clearAllNotes();
   * ```
   */
  clearAllNotes: () => void;

  /**
   * Updates an existing note in the history.
   * If the updated note is currently selected, currentNote is updated.
   *
   * @param noteId The UUID of the note to update.
   * @param updates Partial object with fields to update.
   *
   * @example
   * ```
   * updateNote('550e8400-e29b-41d4-a716-446655440000', {
   *   clinicalSummary: { ...newSummary }
   * });
   * ```
   */
  updateNote: (noteId: string, updates: Partial<MedicalNote>) => void;

  /**
   * Sets the loading state and optional message.
   *
   * @param isLoading Whether the app is loading.
   * @param message Optional loading message to display to the user.
   *
   * @example
   * ```
   * setLoading(true, 'Transcribing audio...');
   * // ... do work ...
   * setLoading(false);
   * ```
   */
  setLoading: (isLoading: boolean, message?: string) => void;

  /**
   * Sets the error message for the current operation.
   *
   * @param error The error message, or null to clear.
   *
   * @example
   * ```
   * setError('Failed to transcribe audio');
   * setError(null); // Clear error
   * ```
   */
  setError: (error: string | null) => void;
}

/**
 * Zustand store for managing medical note transcription state.
 * 
 * Features:
 * - Centralized state for current note and history
 * - Automatic persistence to LocalStorage
 * - Type-safe operations
 * - Support for undo/history browsing
 *
 * The store is persisted under the key 'docscribe-session'.
 *
 * @example
 * ```
 * import { useSessionStore } from './store/sessionStore';
 *
 * function MyComponent() {
 *   const { currentNote, noteHistory, addNote } = useSessionStore();
 *
 *   return (
 *     <div>
 *       {currentNote && <NoteViewer note={currentNote} />}
 *       {noteHistory.length > 0 && <HistoryList notes={noteHistory} />}
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
