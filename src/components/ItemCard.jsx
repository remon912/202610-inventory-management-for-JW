import { Link } from 'react-router-dom';
import ItemThumb from './ItemThumb.jsx';
import StockBadge from './StockBadge.jsx';
import { formatNumber, formatWon } from '../lib/format.js';
import styles from './ItemCard.module.css';

export default function ItemCard({ item }) {
  return (
    <article className={`${styles.card} ${item.isLow ? styles.low : ''}`}>
      <div className={styles.head}>
        <div className={styles.titleCol}>
          <h3 className={styles.name}>
            <Link to={`/items/${item.id}`} className={styles.link}>
              {item.name}
            </Link>
          </h3>
          <p className={styles.location}>{item.location ?? '위치 미지정'}</p>
          <StockBadge item={item} />
        </div>
        <ItemThumb photoId={item.photoId} name={item.name} size={84} />
      </div>
      <div className={styles.foot}>
        <p className={styles.qty}>
          <span className="visually-hidden">보유수량 </span>
          <strong className="num">{formatNumber(item.quantity)}</strong>
          <span className={styles.unit}>개</span>
        </p>
        <p className={styles.cost}>
          <span className="visually-hidden">입고단가 </span>
          <span className="num">{formatWon(item.unitCost)}</span>
        </p>
        <Link
          to={`/items/${item.id}/move`}
          className={`btn btn-secondary btn-sm ${styles.move}`}
          aria-label={`${item.name} 입출고 등록`}
        >
          입출고
        </Link>
      </div>
    </article>
  );
}
