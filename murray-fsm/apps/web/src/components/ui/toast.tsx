// Murray's FSM - Toast Notification System
// ==========================================

'use client';

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

// ---- Config ----

const DEFAULT_DURATION = 5000;

const typeConfig: Record<ToastType, { icon: typeof CheckCircle; styles: string }> = {
  success: {
    icon: CheckCircle,
    styles: 'bg-green-50 border-green-200 text-green-800',
  },
  error: {
    icon: AlertCircle,
    styles: 'bg-red-50 border-red-200 text-red-800',
  },
  warning: {
    icon: AlertTriangle,
    styles: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  },
  info: {
    icon: Info,
    styles: 'bg-blue-50 border-blue-200 text-blue-800',
  },
};

// ---- Context ----

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

// ---- Single Toast Item ----

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const config = typeConfig[t.type];
  const Icon = config.icon;

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(t.id), 200);
    }, t.duration);

    return () => clearTimeout(timerRef.current);
  }, [t.duration, t.id, onDismiss]);

  const handleDismiss = () => {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onDismiss(t.id), 200);
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 w-80 px-4 py-3 rounded-lg border shadow-lg',
        'transition-all duration-200',
        exiting
          ? 'opacity-0 translate-x-4'
          : 'opacity-100 translate-x-0 animate-slide-in-right',
        config.styles
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-medium">{t.message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={handleDismiss}
        className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---- Provider ----

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, options?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: Toast = {
      id,
      type: options?.type ?? 'info',
      message,
      duration: options?.duration ?? DEFAULT_DURATION,
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: useCallback((msg, dur) => addToast(msg, { type: 'success', duration: dur }), [addToast]),
    error: useCallback((msg, dur) => addToast(msg, { type: 'error', duration: dur }), [addToast]),
    warning: useCallback((msg, dur) => addToast(msg, { type: 'warning', duration: dur }), [addToast]),
    info: useCallback((msg, dur) => addToast(msg, { type: 'info', duration: dur }), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container -- bottom-right */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
