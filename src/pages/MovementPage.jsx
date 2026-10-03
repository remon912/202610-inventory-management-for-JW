import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MovementForm from '../components/MovementForm.jsx';
import StatusView from '../components/StatusView.jsx';
import ItemPhotoEditor from '../components/ItemPhotoEditor.jsx';
import StockBadge from '../components/StockBadge.jsx';
import { useItem } from '../hooks/useItems.js';
import { useToast } from '../hooks/useToast.js';
import { formatDelta, formatNumber } from '../lib/format.js';
import styles from './Page.module.css';

export default function MovementPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const itemQuery = useItem(id);

  const correctId = params.get('correct');
  const initial = {
    type: params.get('type'),
    quantity: params.get('qty') ?? '',
    usagePlace: params.get('place') ?? '',
    memo: correctId ? `[정정] 이력 #${correctId} 정정` : '',
  };

  const back = (
    <Link to={`/items/${id}`} className={styles.back}>
      <span aria-hidden="true">←</span> 품목 상세
    </Link>
  );

  let body;
  if (itemQuery.isPending) {
    body = <StatusView kind="loading" />;
  } else if (itemQuery.isError && !itemQuery.data) {
    body = (
      <StatusView
        kind="error"
        title="품목을 불러오지 못했습니다"
        description={itemQuery.error.message}
        onRetry={itemQuery.error.code === 'ITEM_NOT_FOUND' ? undefined : () => itemQuery.refetch()}
      />
    );
  } else if (itemQuery.data.deletedAt) {
    body = (
      <StatusView
        kind="error"
        title="삭제된 품목입니다"
        description="입출고를 등록할 수 없습니다."
      />
    );
  } else {
    const item = itemQuery.data;
    body = (
      <>
        <div className={styles.titleRow}>
          <div className={styles.itemHead}>
            <div className={styles.itemInfo}>
              <p className={styles.subtitle}>{item.location ?? '위치 미지정'}</p>
              <p className={styles.sectionTitle}>{item.name}</p>
              <StockBadge item={item} />
            </div>
            <ItemPhotoEditor item={item} />
          </div>
        </div>
        {correctId && (
          <p className={styles.hint}>
            이력 #{correctId}을(를) 상쇄하는 반대 기록을 추가합니다. 원래 기록은 그대로 남습니다.
          </p>
        )}
        <div className={styles.card}>
          <MovementForm
            key={params.toString()}
            item={item}
            initial={initial}
            onSuccess={({ movement, item: updated }) => {
              toast(
                `${movement.delta > 0 ? '입고' : '출고'} ${formatDelta(movement.delta)}개 등록 완료 · 현재 보유수량 ${formatNumber(updated.quantity)}개`,
              );
              navigate(`/items/${id}`, { replace: true });
            }}
          />
        </div>
      </>
    );
  }

  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      {back}
      <h1 className={styles.title}>입출고 등록</h1>
      {body}
    </div>
  );
}
