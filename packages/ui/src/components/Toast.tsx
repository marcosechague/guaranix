import { CircleAlert, CircleCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, type ReactNode, use, useCallback, useMemo, useRef, useState } from 'react';
import { classNames } from '../lib/class-names';

type ToastTone = 'success' | 'error';

interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VISIBLE_MS = 3200;

export interface ToastProviderProps {
  children: ReactNode;
  /** Extra bottom offset, e.g. to sit above a tab bar. */
  offsetClassName?: string;
}

/** Short confirmations ("Reservaste 19:00") announced politely to screen readers. */
export function ToastProvider({ children, offsetClassName = 'bottom-6' }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);
  const show = useCallback((text: string, tone: ToastTone = 'success') => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current.slice(-1), { id, text, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      VISIBLE_MS,
    );
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className={classNames(
          'pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4',
          offsetClassName,
        )}
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={classNames(
                'flex max-w-sm items-center gap-2.5 rounded-pill border px-4 py-2.5 text-sm font-semibold shadow-xl',
                'border-border bg-text text-background',
              )}
            >
              {toast.tone === 'error' ? (
                <CircleAlert aria-hidden="true" size={18} className="shrink-0 text-warning" />
              ) : (
                <CircleCheck aria-hidden="true" size={18} className="shrink-0 text-success" />
              )}
              {toast.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
