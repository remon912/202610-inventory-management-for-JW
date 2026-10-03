import { useId, useState } from 'react';
import { useLogin } from '../hooks/useSession.js';
import styles from './AdminLoginForm.module.css';

/** 관리자 비밀번호 입력. 성공하면 onSuccess(user) */
export default function AdminLoginForm({ user, onSuccess, onCancel }) {
  const uid = useId();
  const mutation = useLogin();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const onSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!password) {
      setError('비밀번호를 입력해 주세요.');
      return;
    }
    setError(null);
    mutation.mutate(
      { userId: user.id, password },
      {
        onSuccess: (data) => {
          setPassword('');
          onSuccess?.(data.user);
        },
        onError: (err) => {
          setPassword('');
          setError(err.message);
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <p className={styles.title}>
        <span aria-hidden="true">🔒</span> 관리자 <strong>{user.name}</strong> 로그인
      </p>
      <label htmlFor={`${uid}-pw`} className="field-label">
        비밀번호
      </label>
      <div className={styles.row}>
        <input
          id={`${uid}-pw`}
          className="input"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          autoComplete="current-password"
          autoFocus
          maxLength={200}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${uid}-err` : undefined}
        />
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? '확인 중…' : '로그인'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
      {error && (
        <p id={`${uid}-err`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
