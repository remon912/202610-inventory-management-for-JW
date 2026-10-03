import { useId, useState } from 'react';
import { useUpdateUsagePlace } from '../hooks/useUsagePlaces.js';
import styles from './EditForm.module.css';

/** 관리 화면 사용처 줄 안에서 쓰는 이름 수정 폼 */
export default function PlaceEditForm({ place, existingNames, onDone, onCancel }) {
  const uid = useId();
  const mutation = useUpdateUsagePlace();
  const [name, setName] = useState(place.name);
  const [error, setError] = useState(null);

  const onSubmit = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return setError('사용처 이름을 입력해 주세요.');
    if (v.length > 100) return setError('100자 이하로 입력해 주세요.');
    if (v === place.name) return onCancel();
    if (existingNames.includes(v)) return setError('이미 등록된 사용처입니다.');
    setError(null);
    mutation.mutate(
      { id: place.id, name: v },
      {
        onSuccess: (saved) => onDone?.(saved),
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-label={`${place.name} 수정`}>
      <label htmlFor={`${uid}-name`} className="field-label">
        사용처 이름
      </label>
      <div className={styles.inline}>
        <input
          id={`${uid}-name`}
          className="input"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          maxLength={100}
          autoFocus
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={`${uid}-hint`}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={mutation.isPending}>
          {mutation.isPending ? '저장 중…' : '저장'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          취소
        </button>
      </div>
      <p id={`${uid}-hint`} className="field-hint">
        지난 출고 이력에는 기록 당시의 이름이 그대로 남습니다.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
