import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ItemCard from '../components/ItemCard.jsx';
import StatusView from '../components/StatusView.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { useItems } from '../hooks/useItems.js';
import { formatNumber, formatTime } from '../lib/format.js';
import styles from './Page.module.css';

const SEARCH_DEBOUNCE_MS = 300;

export default function ItemListPage() {
  const { isAdmin } = useCurrentUser();
  const uid = useId();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const lowOnly = params.get('low') === '1';

  const [search, setSearch] = useState(q);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const updateParam = (key, value) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const onSearchChange = (e) => {
    const v = e.target.value;
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => updateParam('q', v.trim()), SEARCH_DEBOUNCE_MS);
  };

  const filters = useMemo(() => ({ q: q || undefined }), [q]);
  const itemsQuery = useItems(filters);

  const items = useMemo(() => {
    const list = itemsQuery.data ?? [];
    return lowOnly ? list.filter((i) => i.isLow) : list;
  }, [itemsQuery.data, lowOnly]);
  const lowCount = (itemsQuery.data ?? []).filter((i) => i.isLow).length;
  const hasFilter = Boolean(q || lowOnly);

  const resetFilters = () => {
    clearTimeout(timer.current);
    setSearch('');
    setParams({}, { replace: true });
  };

  let content;
  if (itemsQuery.isPending) {
    content = <StatusView kind="loading" title="품목을 불러오는 중…" />;
  } else if (itemsQuery.isError && !itemsQuery.data) {
    content = (
      <StatusView
        kind="error"
        title="품목 목록을 불러오지 못했습니다"
        description={itemsQuery.error.message}
        onRetry={() => itemsQuery.refetch()}
      />
    );
  } else if (items.length === 0) {
    content = hasFilter ? (
      <StatusView
        kind="empty"
        title="조건에 맞는 품목이 없습니다"
        description="검색어나 필터를 바꿔 보세요."
        action={
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>
            필터 초기화
          </button>
        }
      />
    ) : (
      <StatusView
        kind="empty"
        title="아직 등록된 품목이 없습니다"
        description={
          isAdmin
            ? '첫 품목을 등록하면 입출고를 기록할 수 있습니다.'
            : '품목 등록은 관리자만 할 수 있습니다. 관리자에게 요청하세요.'
        }
        action={
          isAdmin && (
            <Link to="/items/new" className="btn btn-primary">
              + 품목 등록
            </Link>
          )
        }
      />
    );
  } else {
    content = (
      <ul className={styles.grid} aria-label="품목 목록">
        {items.map((item) => (
          <li key={item.id}>
            <ItemCard item={item} />
          </li>
        ))}
      </ul>
    );
  }

  const syncState = itemsQuery.isFetching ? 'fetching' : itemsQuery.isError ? 'stale' : '';

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>품목</h1>
        {isAdmin && (
          <Link to="/items/bulk" className="btn btn-secondary btn-sm">
            📄 일괄 등록 (엑셀·여러 줄)
          </Link>
        )}
      </div>

      <search className={styles.filters} aria-label="품목 검색">
        <div className="field">
          <label htmlFor={`${uid}-q`} className="field-label">
            품목명 검색
          </label>
          <input
            id={`${uid}-q`}
            className="input"
            type="search"
            value={search}
            onChange={onSearchChange}
            placeholder="예: A4 용지"
            maxLength={100}
            enterKeyHint="search"
          />
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => updateParam('low', e.target.checked ? '1' : '')}
          />
          재고 부족만 보기
        </label>
      </search>

      {itemsQuery.data && (
        <div className={styles.summary}>
          <p>
            품목 <strong className="num">{formatNumber(items.length)}</strong>개
            {lowCount > 0 && (
              <>
                {' · '}재고 부족 <strong className="num">{formatNumber(lowCount)}</strong>개
              </>
            )}
          </p>
          <p className={styles.sync}>
            <span
              className={`${styles.dot} ${syncState ? styles[syncState] : ''}`}
              aria-hidden="true"
            />
            {itemsQuery.isError
              ? '갱신 실패 · 재시도 중'
              : `자동 갱신 · ${formatTime(itemsQuery.dataUpdatedAt)}`}
          </p>
        </div>
      )}

      {content}

      {isAdmin && (
        <Link to="/items/new" className={`btn btn-primary ${styles.fab}`}>
          + 품목 등록
        </Link>
      )}
    </div>
  );
}
