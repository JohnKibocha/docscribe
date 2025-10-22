import { useToast } from '../../hooks/use-toast';
import { X } from 'lucide-react';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const variantClasses = {
          destructive: 'bg-red-50 border-red-500 text-red-900',
          success: 'bg-green-50 border-green-500 text-green-900',
          default: 'bg-white border-blue-500 text-gray-900',
        };
        const className = `
          toast-item
          flex items-start gap-3 p-4 rounded-lg shadow-lg
          border-l-4 animate-slide-in
          ${variantClasses[toast.variant || 'default']}
        `;

        return (
          <div key={toast.id} className={className} role="alert">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm mb-1">{toast.title}</h4>
              <p className="text-sm opacity-90">{toast.description}</p>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
