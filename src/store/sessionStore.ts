/**
 * @fileoverview Zustand session store for managing transcription state.
 *
 * @description
 * This module provides centralized state management for medical notes and
 * transcription history using Zustand. The store is designed to persist data
 * to LocalStorage.
 *
 * @module store/sessionStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MedicalNote } from '../types';

/**
 * Represents the current session state for transcription within the DocScribe application.
 */
export interface SessionState {
  currentNote: MedicalNote | null;
  notes: MedicalNote[];
  isProcessing: boolean;
  error: string | null;

  setCurrentNote: (note: MedicalNote | null) => void;
  addNote: (note: MedicalNote) => void;
  deleteNote: (id: string) => void;
  clearNotes: () => void;
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Creates and exports the Zustand session store with persistence.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentNote: null,
      notes: [],
      isProcessing: false,
      error: null,

      setCurrentNote: (note) => set({ currentNote: note }),

      addNote: (note) =>
        set((state) => ({
          notes: [note, ...state.notes],
          currentNote: note,
        })),

      deleteNote: (id) =>
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
          currentNote: state.currentNote?.id === id ? null : state.currentNote,
        })),

      clearNotes: () => set({ notes: [], currentNote: null }),

      setProcessing: (isProcessing) => set({ isProcessing }),

      setError: (error) => set({ error }),
    }),
    {
      name: 'docscribe-session',
      partialize: (state) => ({ notes: state.notes, currentNote: state.currentNote }),
    }
  )
);
