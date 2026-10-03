import styles from './StatusView.module.css';

/**
 * 로딩 / 빈 상태 / 에러 상태 공통 화면
 * kind: 'loading' | 'empty' | 'error'
 */
export default function StatusView({ kind, title, description, action, onRetry }) {
  if (kind === 'loading') {
    return (
      <div className={styles.box} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.title}>{title ?? '불러오는 중…'}</p>
      </div>
    );
  }

  const isError = kind === 'error';
  return (
    <div
      className={`${styles.box} ${isError ? styles.error : ''}`}
      role={isError ? 'alert' : undefined}
    >
      <span className={styles.icon} aria-hidden="true">
        {isError ? '!' : '∅'}
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.desc}>{description}</p>}
      <div className={styles.actions}>
        {onRetry && (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            다시 시도
          </button>
        )}
        {action}
      </div>
    </div>
  );
}
