import { useId, useRef, useState } from 'react';
import { prepareImage } from '../lib/image.js';
import styles from './Photo.module.css';

/**
 * 사진 선택·촬영 입력 (품목 등록, 입고 화면 전용)
 * value: { image, thumb, previewUrl } | null
 */
export default function PhotoInput({ value, onChange, hint, disabled = false }) {
  const uid = useId();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 change가 발생하도록
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await prepareImage(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field" role="group" aria-labelledby={`${uid}-label`}>
      <span id={`${uid}-label`} className="field-label">
        사진<span className="optional">(선택)</span>
      </span>
      <div className={styles.inputRow}>
        {value ? (
          <img src={value.previewUrl} alt="선택한 사진 미리보기" className={styles.preview} />
        ) : (
          <span className={styles.previewEmpty} aria-hidden="true">
            📷
          </span>
        )}
        <div className={styles.inputActions}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onFile}
            aria-describedby={`${uid}-hint`}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || busy}
          >
            {busy ? '사진 준비 중…' : value ? '사진 바꾸기' : '사진 선택·촬영'}
          </button>
          {value && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(null)}
              disabled={disabled || busy}
            >
              사진 빼기
            </button>
          )}
        </div>
      </div>
      <p id={`${uid}-hint`} className="field-hint">
        {hint ?? '비슷한 품목을 구분할 수 있도록 품목이 잘 보이게 찍어 주세요.'}
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
