import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastMsg } from '../types';

interface ToastContextType {
  toasts: ToastMsg[];
  pushToast: (type: ToastMsg['type'], msg: string) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastIdCounter = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (type: ToastMsg['type'], msg: string) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, type, msg }]);
      setTimeout(() => {
        removeToast(id);
      }, 3500);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, pushToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => {
          let bgClass = 'bg-emerald-600';
          if (toast.type === 'success') bgClass = 'bg-emerald-600';
          else if (toast.type === 'error') bgClass = 'bg-red-600';
          return (
            <div
              key={toast.id}
              className={'px-4 py-3 rounded-lg shadow-lg text-white min-w-[250px] max-w-md transition-all ' + bgClass}
            >
              <div className="flex justify-between items-start gap-3">
                <p className="text-sm font-medium">{toast.msg}</p>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-white/80 hover:text-white text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
