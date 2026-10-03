import { Link } from 'react-router-dom';
import ItemThumb from './ItemThumb.jsx';
import { photoUrl } from '../lib/api.js';
import { formatDateTime, formatDelta, formatWon } from '../lib/format.js';
import styles from './MovementList.module.css';

/** 정정 기록: 반대 부호, 같은 수량으로 입출고 폼을 미리 채운다 (원장은 삭제하지 않음) */
function correctionUrl(m) {
  const sp = new URLSearchParams({
    type: m.delta > 0 ? 'out' : 'in',
    qty: String(Math.abs(m.delta)),
    place: m.usagePlace,
    correct: String(m.id),
  });
  return `/items/${m.itemId}/move?${sp}`;
}

export default function MovementList({ movements, readOnly = false }) {
  return (
    <ol className={styles.list}>
      {movements.map((m) => {
        const isIn = m.delta > 0;
        return (
          <li key={m.id} className={`${styles.entry} ${isIn ? styles.in : styles.out}`}>
            <span className={`badge ${isIn ? 'badge-in' : 'badge-out'} ${styles.badge}`}>
              {isIn ? '+ 입고' : '− 출고'}
            </span>
            <div className={styles.body}>
              <p className={styles.main}>
                <strong className={`num ${styles.delta}`}>{formatDelta(m.delta)}개</strong>
                <span className={styles.place}>{m.usagePlace}</span>
              </p>
              {m.memo && <p className={styles.memo}>{m.memo}</p>}
              <p className={styles.meta}>
                <span>{m.userName ?? '알 수 없음'}</span>
                <time dateTime={m.createdAt}>{formatDateTime(m.createdAt)}</time>
                {m.unitPrice !== null && (
                  <span>
                    {isIn ? '입고단가' : '납품단가'} {formatWon(m.unitPrice)}
                  </span>
                )}
                <span>#{m.id}</span>
              </p>
            </div>
            {m.photoId ? (
              <a
                href={photoUrl(m.photoId)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.photo}
              >
                <ItemThumb photoId={m.photoId} size={72} alt="입고 사진 (새 창에서 원본 보기)" />
              </a>
            ) : (
              <span className={styles.photo} aria-hidden="true" />
            )}
            {readOnly ? (
              <span className={styles.fix} aria-hidden="true" />
            ) : (
              <Link
                to={correctionUrl(m)}
                className={`btn btn-ghost btn-sm ${styles.fix}`}
                aria-label={`이력 #${m.id} 정정 기록 추가`}
              >
                정정
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
