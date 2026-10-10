import ConfirmButton from './ConfirmButton.jsx';
import ItemPhotoEditor from './ItemPhotoEditor.jsx';
import ItemThumb from './ItemThumb.jsx';
import { useDeletePhoto, useItemPhotos } from '../hooks/useItems.js';
import { useToast } from '../hooks/useToast.js';
import { photoUrl } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import styles from './Photo.module.css';

/**
 * 품목 수정 화면의 사진 관리 (관리자): 사진 추가 + 등록된 사진 전체 보기·삭제.
 * 가장 최근 사진이 대표 사진이며, 대표를 지우면 바로 이전 사진이 대표가 된다.
 */
export default function ItemPhotoManager({ item }) {
  const photosQuery = useItemPhotos(item.id);
  const del = useDeletePhoto(item.id);
  const { toast } = useToast();
  const photos = photosQuery.data ?? [];

  const remove = (p, isMain) =>
    del
      .mutateAsync(p.id)
      .then((res) =>
        toast(
          isMain && res.photoId
            ? '대표 사진을 삭제했습니다. 이전 사진이 대표 사진이 됩니다.'
            : '사진을 삭제했습니다.',
        ),
      )
      .catch((err) => toast(err.message, { variant: 'error' }));

  return (
    <div className={styles.manager}>
      <ItemPhotoEditor item={item} showThumb={false} label="📷 사진 추가" />

      {photosQuery.isPending ? (
        <p className={styles.caption}>사진을 불러오는 중…</p>
      ) : photosQuery.isError ? (
        <p className="field-error">사진 목록을 불러오지 못했습니다.</p>
      ) : photos.length === 0 ? (
        <p className={styles.caption}>등록된 사진이 없습니다.</p>
      ) : (
        <ul className={styles.managerList} aria-label="등록된 사진">
          {photos.map((p, i) => {
            const when = formatDateTime(p.createdAt);
            return (
              <li key={p.id} className={styles.managerItem}>
                <a
                  href={photoUrl(p.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.managerThumb}
                >
                  <ItemThumb photoId={p.id} size={112} alt={`${when} 사진 (새 창에서 원본 보기)`} />
                  {i === 0 && <span className={styles.mainBadge}>대표</span>}
                </a>
                <span className={styles.caption}>
                  {when}
                  <br />
                  {p.userName}
                  {p.movementId ? ' · 입고 시' : ''}
                </span>
                <ConfirmButton
                  label="🗑 삭제"
                  confirmLabel="삭제"
                  message="삭제할까요?"
                  ariaLabel={`${when} 사진 삭제${i === 0 ? ' (대표 사진)' : ''}`}
                  pending={del.isPending}
                  onConfirm={() => remove(p, i === 0)}
                />
              </li>
            );
          })}
        </ul>
      )}
      <p className="field-hint">
        가장 최근 사진이 대표 사진입니다. 대표 사진을 삭제하면 바로 이전 사진이 대표가 됩니다.
        사진을 지워도 입출고 기록(수량)은 그대로 남습니다.
      </p>
    </div>
  );
}
