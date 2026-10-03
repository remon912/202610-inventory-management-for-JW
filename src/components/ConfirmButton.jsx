import { useState } from 'react';
import styles from './ConfirmButton.module.css';

/**
 * 두 번 눌러야 실행되는 삭제 버튼. 첫 클릭에 확인 문구와 [삭제][취소]가 나타난다.
 * onConfirm은 Promise를 돌려줄 수 있다.
 */
export default function ConfirmButton({
  label = '삭제',
  confirmLabel = '삭제',
  message = '정말 삭제할까요?',
  onConfirm,
  pending = false,
  disabled = false,
  ariaLabel,
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setAsking(true)}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={styles.confirm} role="group" aria-label="삭제 확인">
      <span className={styles.message}>{message}</span>
      <span className={styles.buttons}>
        <button
          type="button"
          className="btn btn-out btn-sm"
          autoFocus
          disabled={pending}
          onClick={async () => {
            try {
              await onConfirm();
            } finally {
              setAsking(false);
            }
          }}
        >
          {pending ? '처리 중…' : confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>
          취소
        </button>
      </span>
    </span>
  );
}
