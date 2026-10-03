import { useId, useState } from 'react';
import { useCreateUser } from '../hooks/useUsers.js';
import styles from './AddUserForm.module.css';

/** 사용자 추가 (관리자 전용). 관리자 권한으로 추가하면 비밀번호를 함께 정한다. */
export default function AddUserForm({ onCreated }) {
  const uid = useId();
  const mutation = useCreateUser();
  const [name, setName] = useState('');
  const [role, setRole] = useState('member');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);

  const onSubmit = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return setError('이름을 입력해 주세요.');
    if (v.length > 50) return setError('이름은 50자 이하로 입력해 주세요.');
    if (role === 'admin') {
      if (password.length < 8) return setError('관리자 비밀번호는 8자 이상이어야 합니다.');
      if (password !== confirm) return setError('비밀번호 확인이 일치하지 않습니다.');
    }
    setError(null);
    mutation.mutate(
      { name: v, role, ...(role === 'admin' ? { password } : {}) },
      {
        onSuccess: (user) => {
          setName('');
          setPassword('');
          setConfirm('');
          setRole('member');
          onCreated?.(user);
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.grid}>
        <div className="field">
          <label htmlFor={`${uid}-name`} className="field-label">
            이름
          </label>
          <input
            id={`${uid}-name`}
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            autoComplete="off"
            placeholder="예: 홍길동"
          />
        </div>
        <fieldset className={styles.roles}>
          <legend className="field-label">권한</legend>
          <label className={styles.radio}>
            <input
              type="radio"
              name={`${uid}-role`}
              value="member"
              checked={role === 'member'}
              onChange={() => setRole('member')}
            />
            일반
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              name={`${uid}-role`}
              value="admin"
              checked={role === 'admin'}
              onChange={() => setRole('admin')}
            />
            관리자
          </label>
        </fieldset>
      </div>

      {role === 'admin' && (
        <div className={styles.grid}>
          <div className="field">
            <label htmlFor={`${uid}-pw`} className="field-label">
              관리자 비밀번호
            </label>
            <input
              id={`${uid}-pw`}
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={200}
              aria-describedby={`${uid}-pw-hint`}
            />
            <p id={`${uid}-pw-hint`} className="field-hint">
              8자 이상
            </p>
          </div>
          <div className="field">
            <label htmlFor={`${uid}-pw2`} className="field-label">
              비밀번호 확인
            </label>
            <input
              id={`${uid}-pw2`}
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              maxLength={200}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? '추가 중…' : '+ 사용자 추가'}
        </button>
      </div>
    </form>
  );
}
