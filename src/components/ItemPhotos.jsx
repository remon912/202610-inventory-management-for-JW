import ItemThumb from './ItemThumb.jsx';
import { useItemPhotos } from '../hooks/useItems.js';
import { photoUrl } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import styles from './Photo.module.css';

/** 품목 상세: 대표 사진(최신) + 지난 사진 목록. 사진을 누르면 원본을 새 창에서 연다. */
export default function ItemPhotos({ item }) {
  const photosQuery = useItemPhotos(item.photoId ? item.id : null);
  const photos = photosQuery.data ?? [];

  if (!item.photoId) {
    return (
      <p className={styles.caption}>
        등록된 사진이 없습니다. 입출고 화면이나 품목 수정 화면에서 사진을 등록할 수 있습니다.
      </p>
    );
  }

  const latest = photos[0];
  return (
    <figure className={styles.gallery} style={{ margin: 0 }}>
      <a href={photoUrl(item.photoId)} target="_blank" rel="noopener noreferrer">
        <img
          className={styles.main}
          src={photoUrl(item.photoId)}
          alt={`${item.name} 사진 (새 창에서 원본 보기)`}
          decoding="async"
        />
      </a>
      {latest && (
        <figcaption className={styles.caption}>
          대표 사진 · {formatDateTime(latest.createdAt)} · {latest.userName}
          {latest.movementId ? ' (입고 시 등록)' : ' (품목 등록 시 등록)'}
        </figcaption>
      )}
      {photos.length > 1 && (
        <ul className={styles.strip} aria-label="지난 사진">
          {photos.slice(1).map((p) => (
            <li key={p.id}>
              <a
                href={photoUrl(p.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.stripLink}
                title={`${formatDateTime(p.createdAt)} · ${p.userName}`}
              >
                <ItemThumb
                  photoId={p.id}
                  size={96}
                  alt={`${formatDateTime(p.createdAt)} 사진 (새 창에서 원본 보기)`}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
