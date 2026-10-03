import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import ItemThumb from './ItemThumb.jsx';
import StockBadge from './StockBadge.jsx';
import { formatNumber } from '../lib/format.js';
import styles from './ItemSearch.module.css';

const MAX_RESULTS = 20;

/**
 * 품목 등록 1단계: 기존 품목을 먼저 검색하고, 없을 때만 + 추가로 새 품목을 만든다.
 * onAdd(name): 새 품목 입력 폼으로 넘어간다.
 */
export default function ItemSearch({
  items,
  isPending,
  isError,
  onRetry,
  initialText = '',
  onAdd,
}) {
  const uid = useId();
  const [text, setText] = useState(initialText);

  const q = text.trim();
  const lower = q.toLowerCase();
  const matches = q ? items.filter((i) => i.name.toLowerCase().includes(lower)) : [];
  const exact = matches.some((i) => i.name.trim().toLowerCase() === lower);

  const add = () => {
    if (q) onAdd(q);
  };

  return (
    <div className={styles.wrap}>
      <div className="field">
        <label htmlFor={`${uid}-q`} className="field-label">
          품목명 검색
        </label>
        <div className={styles.row}>
          <input
            id={`${uid}-q`}
            className="input"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // 일치하는 품목이 없을 때 Enter로 바로 추가
              if (e.key === 'Enter' && q && matches.length === 0) {
                e.preventDefault();
                add();
              }
            }}
            placeholder="예: A4 복사용지"
            maxLength={100}
            autoFocus
            aria-describedby={`${uid}-hint`}
          />
          <button type="button" className="btn btn-primary" onClick={add} disabled={!q}>
            + 추가
          </button>
        </div>
        <p id={`${uid}-hint`} className="field-hint">
          이미 등록된 품목이 있는지 먼저 확인하세요. 없으면 + 추가로 새 품목을 등록합니다.
        </p>
      </div>

      <div aria-live="polite">
        {isPending && <p className={styles.note}>품목 목록을 불러오는 중…</p>}
        {isError && (
          <p className="field-error">
            품목 목록을 불러오지 못했습니다.{' '}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
              다시 시도
            </button>
          </p>
        )}

        {q && !isPending && matches.length === 0 && (
          <div className={styles.none}>
            <p>
              <strong>&lsquo;{q}&rsquo;</strong> 품목이 없습니다.
            </p>
            <button type="button" className="btn btn-primary" onClick={add}>
              + &lsquo;{q}&rsquo; 새 품목으로 추가
            </button>
          </div>
        )}

        {matches.length > 0 && (
          <>
            <p className={styles.note}>
              기존 품목 {formatNumber(matches.length)}개
              {matches.length > MAX_RESULTS && ` (상위 ${MAX_RESULTS}개 표시)`}
              {exact && ' · 같은 이름의 품목이 이미 있습니다. 입고는 기존 품목에서 등록하세요.'}
            </p>
            <ul className={styles.results} aria-label="검색된 기존 품목">
              {matches.slice(0, MAX_RESULTS).map((item) => (
                <li key={item.id} className={styles.result}>
                  <div className={styles.info}>
                    <Link to={`/items/${item.id}`} className={styles.name}>
                      {item.name}
                    </Link>
                    <p className={styles.meta}>
                      {[item.location ?? '위치 미지정', item.supplier].filter(Boolean).join(' · ')}
                      {' · '}보유 <span className="num">{formatNumber(item.quantity)}</span>개
                    </p>
                    <StockBadge item={item} />
                  </div>
                  <ItemThumb photoId={item.photoId} name={item.name} size={96} />
                  <Link
                    to={`/items/${item.id}/move?type=in`}
                    className="btn btn-in btn-sm"
                    aria-label={`${item.name} 입고 등록`}
                  >
                    + 입고
                  </Link>
                </li>
              ))}
            </ul>
            {!exact && (
              <button type="button" className={`btn btn-secondary ${styles.addMore}`} onClick={add}>
                찾는 품목이 없나요? + &lsquo;{q}&rsquo; 새 품목으로 추가
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
