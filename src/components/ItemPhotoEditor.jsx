import { useRef, useState } from 'react';
import ItemThumb from './ItemThumb.jsx';
import { useAddItemPhoto } from '../hooks/useItems.js';
import { useToast } from '../hooks/useToast.js';
import { prepareImage } from '../lib/image.js';
import styles from './Photo.module.css';

/**
 * 기존 품목의 대표 사진 + 사진 등록/변경 버튼.
 * 사진을 고르면 바로 저장되고, 새 사진이 대표 사진이 된다 (이전 사진은 상세 화면에 보존).
 */
export default function ItemPhotoEditor({ item, size = 96, showThumb = true, label }) {
  const fileRef = useRef(null);
  const add = useAddItemPhoto(item.id);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 change가 발생하도록
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { image, thumb } = await prepareImage(file);
      await add.mutateAsync({ image, thumb });
      toast(item.photoId ? '사진을 변경했습니다.' : '사진을 등록했습니다.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.editor}>
      {showThumb && (
        <ItemThumb
          photoId={item.photoId}
          name={item.name}
          size={size}
          alt={item.photoId ? `${item.name} 대표 사진` : ''}
        />
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        {busy ? '사진 올리는 중…' : (label ?? (item.photoId ? '📷 사진 변경' : '📷 사진 등록'))}
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
