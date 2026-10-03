import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmButton from '../components/ConfirmButton.jsx';
import MovementList from '../components/MovementList.jsx';
import StatusView from '../components/StatusView.jsx';
import ItemPhotos from '../components/ItemPhotos.jsx';
import StockBadge from '../components/StockBadge.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { useDeleteItem, useItem } from '../hooks/useItems.js';
import { useToast } from '../hooks/useToast.js';
import { useMovements } from '../hooks/useMovements.js';
import { formatDateTime, formatNumber, formatWon } from '../lib/format.js';
import styles from './Page.module.css';

const backLink = (
  <Link to="/" className={styles.back}>
    <span aria-hidden="true">←</span> 품목 목록
  </Link>
);

export default function ItemDetailPage() {
  const { id } = useParams();
  const itemQuery = useItem(id);
  const navigate = useNavigate();
  const { isAdmin } = useCurrentUser();
  const { toast } = useToast();
  const deleteItem = useDeleteItem(id);
  const movementsQuery = useMovements(id);

  if (itemQuery.isPending) {
    return <StatusView kind="loading" title="품목을 불러오는 중…" />;
  }
  if (itemQuery.isError && !itemQuery.data) {
    const notFound = itemQuery.error.code === 'ITEM_NOT_FOUND';
    return (
      <div className={styles.page}>
        {backLink}
        <StatusView
          kind="error"
          title={notFound ? '품목을 찾을 수 없습니다' : '품목을 불러오지 못했습니다'}
          description={notFound ? '삭제되었거나 잘못된 주소입니다.' : itemQuery.error.message}
          onRetry={notFound ? undefined : () => itemQuery.refetch()}
        />
      </div>
    );
  }

  const item = itemQuery.data;

  let history;
  if (movementsQuery.isPending) {
    history = <StatusView kind="loading" title="이력을 불러오는 중…" />;
  } else if (movementsQuery.isError && !movementsQuery.data) {
    history = (
      <StatusView
        kind="error"
        title="입출고 이력을 불러오지 못했습니다"
        description={movementsQuery.error.message}
        onRetry={() => movementsQuery.refetch()}
      />
    );
  } else if (movementsQuery.data.length === 0) {
    history = (
      <StatusView
        kind="empty"
        title="입출고 이력이 없습니다"
        description="입고 또는 출고를 등록해 보세요."
      />
    );
  } else {
    history = <MovementList movements={movementsQuery.data} readOnly={Boolean(item.deletedAt)} />;
  }

  return (
    <div className={styles.page}>
      {backLink}

      <div className={styles.detailTop}>
        <div className={styles.detailInfo}>
          <div className={styles.titleRow}>
            <div>
              <h1 className={styles.title}>{item.name}</h1>
              <p className={styles.subtitle}>
                {item.location ?? '위치 미지정'}
                {item.supplier && ` · 구입처 ${item.supplier}`}
              </p>
            </div>
            <StockBadge item={item} />
          </div>

          <dl className={styles.stats}>
            <div className={`${styles.stat} ${styles.statMain}`}>
              <dt>보유수량</dt>
              <dd className="num">{formatNumber(item.quantity)}개</dd>
            </div>
            <div className={styles.stat}>
              <dt>입고단가</dt>
              <dd className="num">{formatWon(item.unitCost)}</dd>
            </div>
            <div className={styles.stat}>
              <dt>재고 금액</dt>
              <dd className="num">
                {formatWon(Math.round(item.unitCost * item.quantity * 100) / 100)}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>재고 부족 기준</dt>
              <dd className="num">{formatNumber(item.minQuantity)}개 이하</dd>
            </div>
          </dl>
        </div>
        <ItemPhotos item={item} />
      </div>

      {item.deletedAt ? (
        <p className="alert" role="status">
          삭제된 품목입니다 ({formatDateTime(item.deletedAt)}). 입출고와 수정은 할 수 없고 이력만
          조회할 수 있습니다.
        </p>
      ) : (
        <div className={styles.actions}>
          <Link to={`/items/${item.id}/move?type=in`} className={`btn btn-in ${styles.actionBig}`}>
            + 입고
          </Link>
          <Link
            to={`/items/${item.id}/move?type=out`}
            className={`btn btn-out ${styles.actionBig}`}
          >
            − 출고
          </Link>
          <Link to={`/items/${item.id}/edit`} className="btn btn-secondary">
            품목 수정
          </Link>
          {isAdmin && (
            <ConfirmButton
              label="품목 삭제"
              ariaLabel={`${item.name} 품목 삭제`}
              message={
                item.quantity > 0
                  ? `보유수량 ${formatNumber(item.quantity)}개가 남아 있습니다. 삭제할까요? (이력은 보존)`
                  : '이 품목을 삭제할까요? (이력은 보존)'
              }
              pending={deleteItem.isPending}
              onConfirm={() =>
                deleteItem
                  .mutateAsync()
                  .then(() => {
                    toast(`‘${item.name}’ 품목을 삭제했습니다.`);
                    navigate('/', { replace: true });
                  })
                  .catch((err) => toast(err.message, { variant: 'error' }))
              }
            />
          )}
        </div>
      )}

      <section aria-labelledby="history-title" className={styles.page}>
        <div className={styles.sectionHead}>
          <h2 id="history-title" className={styles.sectionTitle}>
            입출고 이력
          </h2>
          <p className={styles.hint}>
            최신순 · 잘못된 기록은 &lsquo;정정&rsquo;으로 반대 기록을 추가
          </p>
        </div>
        {history}
      </section>
    </div>
  );
}
