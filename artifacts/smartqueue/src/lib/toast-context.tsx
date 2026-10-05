import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type Toast = { text: string; error: boolean };
const ToastContext = createContext<(text: string, error?: boolean) => void>(() => {});
export function useToastMessage() { return useContext(ToastContext); }
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(current => current?.text === text ? null : current), 3800);
  }, []);
  return <ToastContext.Provider value={notify}>{children}{toast && <div className="toast" role={toast.error ? 'alert' : 'status'} data-testid="status-toast">{toast.text}</div>}</ToastContext.Provider>;
}
