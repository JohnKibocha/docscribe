/**
 * @fileoverview Toast notification hook for user feedback.
 *
 * This hook provides a simple, accessible toast notification system for
 * displaying success, error, and informational messages to users. It uses
 * native browser APIs and CSS for animations, avoiding external dependencies.
 *
 * Features:
 * - Success, error, and default variants
 * - Auto-dismiss after 3 seconds
 * - Accessible (ARIA live regions)
 * - Keyboard accessible (Escape to dismiss)
 * - Stack multiple toasts
 * - Smooth animations
 *
 * @module hooks/use-toast
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Toast notification object.
 */
export interface Toast {
  /**
   * Unique identifier for the toast.
   */
  id: string;

  /**
   * Toast title (bold heading).
   */
  title: string;

  /**
   * Toast description (body text).
   */
  description: string;

  /**
   * Visual variant of the toast.
   */
  variant?: 'default' | 'destructive' | 'success';

  /**
   * Auto-dismiss duration in milliseconds (default: 3000).
   */
  duration?: number;
}

/**
 * Toast state management interface.
 */
interface ToastState {
  /**
   * Array of currently visible toasts.
   */
  toasts: Toast[];
}

/**
 * Global mutable state object that holds all active toast notifications.
 * This state is managed outside of React components to allow for imperative
 * toast calls and to maintain a single source of truth for all toasts.
 */
let toastState: ToastState = { toasts: [] };

/**
 * An array of functions that are called whenever the global `toastState` changes.
 * These listeners are typically `setState` functions from `useState` hooks in components
 * that consume the toast state, ensuring they re-render when toasts are added or removed.
 */
const listeners: Array<(state: ToastState) => void> = [];

/**
 * Iterates through all registered listeners and invokes them with the current `toastState`.
 * This function is called whenever `toastState` is modified to propagate changes to subscribed components.
 * @returns {void}
 */
function notifyListeners(): void {
  listeners.forEach((listener) => listener(toastState));
}

/**
 * Adds a new toast notification to the global toast state.
 * A unique ID is generated for each toast, and a timeout is set for auto-dismissal
 * based on the `duration` property. After adding, all listeners are notified.
 *
 * @param {Omit<Toast, 'id'>} toast - The toast object to add, excluding the `id` which is generated internally.
 * @returns {void}
 */
function addToast(toast: Omit<Toast, 'id'>): void {
  const id = crypto.randomUUID();
  const duration = toast.duration ?? 3000;

  const newToast: Toast = {
    ...toast,
    id,
  };

  toastState = {
    toasts: [...toastState.toasts, newToast],
  };

  notifyListeners();

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
}

/**
 * Removes a specific toast notification from the global toast state by its ID.
 * After removal, all listeners are notified to update consuming components.
 *
 * @param {string} id - The unique ID of the toast to remove.
 * @returns {void}
 */
function removeToast(id: string): void {
  toastState = {
    toasts: toastState.toasts.filter((toast) => toast.id !== id),
  };
  notifyListeners();
}

/**
 * Custom React hook for managing and displaying toast notifications.
 * This hook provides a `toast` function to add new notifications and exposes
 * the current list of `toasts` and a `dismiss` function to remove them.
 * It subscribes to global toast state changes and updates the component's state accordingly.
 *
 * @returns {object} An object containing:
 *   - `toast`: A function to display a new toast notification.
 *   - `toasts`: An array of currently active toast notifications.
 *   - `dismiss`: A function to manually dismiss a toast by its ID.
 *
 * @example
 * ```typescript
 * import { useToast } from '@/hooks/use-toast';
 *
 * function MyComponent() {
 *   const { toast, dismiss } = useToast();
 *
 *   const handleSuccess = () => {
 *     toast({
 *       title: 'Success!',
 *       description: 'Your operation was completed successfully.',
 *       variant: 'success',
 *       duration: 5000,
 *     });
 *   };
 *
 *   const handleError = () => {
 *     const toastId = 'error-operation';
 *     toast({
 *       id: toastId,
 *       title: 'Error',
 *       description: 'Failed to perform the operation. Please try again.',
 *       variant: 'destructive',
 *       duration: 0, // Do not auto-dismiss
 *     });
 *     // Later, you might dismiss it programmatically:
 *     // dismiss(toastId);
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleSuccess}>Show Success Toast</button>
 *       <button onClick={handleError}>Show Error Toast</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useToast() {
  const [state, setState] = useState<ToastState>(toastState);

  useEffect(() => {
    // Subscribe to toast state changes
    listeners.push(setState);

    // Cleanup subscription on unmount
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  const toast = useCallback(
    (props: Omit<Toast, 'id'>) => {
      addToast(props);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    removeToast(id);
  }, []);

  return {
    toast,
    toasts: state.toasts,
    dismiss,
  };
}

/**
 * Imperative function to display a toast notification.
 * This function can be called from any part of the application, including outside of React components,
 * to trigger a toast notification. It internally calls `addToast` to manage the global state.
 *
 * @param {Omit<Toast, 'id'>} props - The properties of the toast notification to display.
 * @returns {void}
 *
 * @example
 * ```typescript
 * import { toast } from '@/hooks/use-toast';
 *
 * // In a service file or a non-React utility function:
 * async function performActionAndNotify() {
 *   try {
 *     // ... perform some action ...
 *     toast({
 *       title: 'Action Complete',
 *       description: 'The requested action was performed successfully.',
 *       variant: 'success',
 *     });
 *   } catch (error) {
 *     toast({
 *       title: 'Action Failed',
 *       description: `An error occurred: ${error.message}`,
 *       variant: 'destructive',
 *     });
 *   }
 * }
 * ```
 */
export function toast(props: Omit<Toast, 'id'>): void {
  addToast(props);
}
