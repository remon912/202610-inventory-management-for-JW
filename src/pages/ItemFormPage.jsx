import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ItemForm from '../components/ItemForm.jsx';
import ItemSearch from '../components/ItemSearch.jsx';
import StatusView from '../components/StatusView.jsx';
import { useCreateItem, useItem, useItems, useUpdateItem } from '../hooks/useItems.js';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { useToast } from '../hooks/useToast.js';
import styles from './Page.module.css';

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

export default function ItemFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();

  const itemQuery = useItem(id);
  const allQuery = useItems({});
  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem(id);

  // 등록 모드: null이면 검색 단계, 문자열이면 해당 이름으로 새 품목 입력 단계
  const [draftName, setDraftName] = useState(null);

  const allItems = useMemo(() => allQuery.data ?? [], [allQuery.data]);
  const locations = useMemo(() => uniqueSorted(allItems.map((i) => i.location)), [allItems]);
  const suppliers = useMemo(() => uniqueSorted(allItems.map((i) => i.supplier)), [allItems]);

  const backTo = isNew ? '/' : `/items/${id}`;
  const back = (
    <Link to={backTo} className={styles.back}>
      <span aria-hidden="true">←</span> {isNew ? '품목 목록' : '품목 상세'}
    </Link>
  );

  let title = '품목 수정';
  let body;
  if (isNew && !isAdmin) {
    title = '품목 등록';
    body = (
      <StatusView
        kind="error"
        title="품목 등록은 관리자만 할 수 있습니다"
        description="상단의 사용자 선택에서 관리자로 로그인하세요."
      />
    );
  } else if (isNew && draftName === null) {
    title = '품목 등록';
    body = (
      <ItemSearch
        items={allItems}
        isPending={allQuery.isPending}
        isError={allQuery.isError && !allQuery.data}
        onRetry={() => allQuery.refetch()}
        onAdd={setDraftName}
      />
    );
  } else if (isNew) {
    title = '새 품목 추가';
    body = (
      <>
        <button
          type="button"
          className={`btn btn-ghost btn-sm ${styles.backButton}`}
          onClick={() => setDraftName(null)}
        >
          <span aria-hidden="true">←</span> 다시 검색
        </button>
        <ItemForm
          key={draftName}
          initialName={draftName}
          locations={locations}
          suppliers={suppliers}
          mutation={createMutation}
          submitLabel="품목 등록"
          onSuccess={(item) => {
            toast(`‘${item.name}’ 품목을 등록했습니다.`);
            navigate(`/items/${item.id}`, { replace: true });
          }}
        />
      </>
    );
  } else if (itemQuery.isPending) {
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
    body = <StatusView kind="error" title="삭제된 품목입니다" description="수정할 수 없습니다." />;
  } else {
    body = (
      <ItemForm
        key={itemQuery.data.id}
        item={itemQuery.data}
        locations={locations}
        suppliers={suppliers}
        mutation={updateMutation}
        submitLabel="변경 사항 저장"
        onSuccess={(item) => {
          toast(`‘${item.name}’ 품목을 수정했습니다.`);
          navigate(`/items/${item.id}`, { replace: true });
        }}
      />
    );
  }

  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      {back}
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.card}>{body}</div>
    </div>
  );
}
