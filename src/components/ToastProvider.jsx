import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from '../hooks/useToast.js';
import styles from './Toast.module.css';

const DURATION = 4000;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message, { variant = 'success' } = {}) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, variant }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={`${styles.region} no-print`} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.variant]}`}>
            <span aria-hidden="true" className={styles.icon}>
              {t.variant === 'error' ? '!' : '✓'}
            </span>
            <p className={styles.message}>{t.message}</p>
            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(t.id)}
              aria-label="알림 닫기"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
