import { photoUrl } from '../lib/api.js';
import styles from './Photo.module.css';

/**
 * 품목 미리보기 사진. 사진이 없으면 품목명 첫 글자를 보여준다.
 * 품목명이 바로 옆에 표시되는 곳에서 쓰므로 기본은 장식용(alt="").
 */
export default function ItemThumb({ photoId, name = '', size = 56, alt = '' }) {
  const box = { width: size, height: size };
  if (!photoId) {
    return (
      <span className={styles.thumbEmpty} style={box} aria-hidden="true">
        {name.trim().slice(0, 1) || '·'}
      </span>
    );
  }
  return (
    <img
      className={styles.thumb}
      style={box}
      src={photoUrl(photoId, 'thumb')}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}
