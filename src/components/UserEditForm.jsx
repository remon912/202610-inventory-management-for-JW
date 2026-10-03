import { useId, useState } from 'react';
import { useUpdateUser } from '../hooks/useUsers.js';
import styles from './EditForm.module.css';

/**
 * 관리 화면 사용자 줄 안에서 쓰는 수정 폼.
 * - 본인: 이름만 수정 (권한·비밀번호는 '내 비밀번호 변경')
 * - 일반 → 관리자: 비밀번호 필수 / 관리자: 비밀번호는 바꿀 때만 입력
 */
export default function UserEditForm({ user, isMe, isLastAdmin, onDone, onCancel }) {
  const uid = useId();
  const mutation = useUpdateUser();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);

  const roleLocked = isMe || (isLastAdmin && user.role === 'admin');
  const promoting = user.role === 'member' && role === 'admin';
  const showPassword = role === 'admin' && !isMe;

  const onSubmit = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return setError('이름을 입력해 주세요.');
    if (v.length > 50) return setError('이름은 50자 이하로 입력해 주세요.');
    if (showPassword && (promoting || password)) {
      if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.');
      if (password !== confirm) return setError('비밀번호 확인이 일치하지 않습니다.');
    }

    const input = {};
    if (v !== user.name) input.name = v;
    if (role !== user.role) input.role = role;
    if (showPassword && password) input.password = password;
    if (Object.keys(input).length === 0) return onCancel();

    setError(null);
    mutation.mutate(
      { id: user.id, input },
      {
        onSuccess: (saved) => onDone?.(saved, input),
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label={`${user.name} 수정`}>
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
            autoFocus
          />
        </div>
        <fieldset className={styles.roles} disabled={roleLocked}>
          <legend className="field-label">권한</legend>
          {[
            ['member', '일반'],
            ['admin', '관리자'],
          ].map(([value, label]) => (
            <label key={value} className={styles.radio}>
              <input
                type="radio"
                name={`${uid}-role`}
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
              />
              {label}
            </label>
          ))}
          {roleLocked && (
            <p className="field-hint">
              {isMe
                ? '본인의 권한은 바꿀 수 없습니다.'
                : '마지막 관리자는 일반으로 바꿀 수 없습니다.'}
            </p>
          )}
        </fieldset>
      </div>

      {showPassword && (
        <div className={styles.grid}>
          <div className="field">
            <label htmlFor={`${uid}-pw`} className="field-label">
              {promoting ? '관리자 비밀번호' : '새 비밀번호'}
              {!promoting && <span className="optional">(바꿀 때만)</span>}
            </label>
            <input
              id={`${uid}-pw`}
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={200}
              placeholder="8자 이상"
            />
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
      {user.role === 'admin' && role === 'member' && (
        <p className="field-hint">
          일반으로 바꾸면 이 사용자의 관리자 비밀번호와 로그인이 해제됩니다.
        </p>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={mutation.isPending}>
          {mutation.isPending ? '저장 중…' : '저장'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}
