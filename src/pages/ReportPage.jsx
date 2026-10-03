import { useId, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StatusView from '../components/StatusView.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { useItems } from '../hooks/useItems.js';
import { useReport } from '../hooks/useReport.js';
import { useUsagePlaces } from '../hooks/useUsagePlaces.js';
import {
  PRESETS,
  daysBetween,
  formatBucket,
  listBuckets,
  presetRange,
  todayStr,
} from '../lib/date.js';
import { formatDateTime, formatDelta, formatNumber, formatWon } from '../lib/format.js';
import styles from './Report.module.css';

const BY = { item: '품목별', place: '사용처별' };
const GROUP = { day: '일별', month: '월별' };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function Segmented({ legend, name, value, options, onChange }) {
  return (
    <fieldset className={styles.segmented}>
      <legend className="field-label">{legend}</legend>
      <div className={styles.segments}>
        {Object.entries(options).map(([key, label]) => (
          <label key={key} className={styles.segment}>
            <input
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function validateRange(from, to, group) {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return '시작일과 종료일을 입력해 주세요.';
  if (from > to) return '시작일이 종료일보다 늦습니다.';
  const days = daysBetween(from, to);
  if (group === 'day' && days > 366)
    return '일별 현황은 최대 1년까지 조회할 수 있습니다. 월별을 선택하세요.';
  if (days > 366 * 5) return '월별 현황은 최대 5년까지 조회할 수 있습니다.';
  return null;
}

const sum = (rows, key) => rows.reduce((acc, r) => acc + r[key], 0);

export default function ReportPage() {
  const uid = useId();
  const { user } = useCurrentUser();
  const [params, setParams] = useSearchParams();

  const defaults = presetRange('thisMonth');
  const by = params.get('by') === 'place' ? 'place' : 'item';
  const group = params.get('group') === 'month' ? 'month' : 'day';
  const from = params.get('from') ?? defaults.from;
  const to = params.get('to') ?? defaults.to;
  const itemId = params.get('itemId') ?? '';
  const place = by === 'place' ? (params.get('place') ?? '') : '';
  const detail = params.get('detail') === '1';
  const showEmpty = params.get('empty') === '1';

  const update = (patch) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === '' || v === null || v === undefined || v === false) next.delete(k);
          else next.set(k, v === true ? '1' : v);
        }
        return next;
      },
      { replace: true },
    );

  const rangeError = validateRange(from, to, group);
  const reportParams = { from, to, group, by, itemId, place, detail: detail ? '1' : '' };
  const reportQuery = useReport(reportParams, { enabled: !rangeError });
  const itemsQuery = useItems({});
  const placesQuery = useUsagePlaces();

  const items = itemsQuery.data ?? [];
  const placeNames = (placesQuery.data ?? []).map((p) => p.name);
  const itemName = items.find((i) => String(i.id) === itemId)?.name;
  const data = rangeError ? null : reportQuery.data;

  // 묶음: 기록 없는 기간을 0으로 채우고, 단일 품목이면 재고 추이(누계)를 계산
  const periodRows = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.buckets.map((b) => [b.bucket, b]));
    const keys = listBuckets(data.query.from, data.query.to, data.query.group);
    const single = data.query.by === 'item' && data.query.itemId;
    let balance = single ? (data.rows[0]?.opening ?? 0) : null;
    return keys.map((key) => {
      const b = map.get(key) ?? {
        bucket: key,
        inQty: 0,
        outQty: 0,
        inAmount: 0,
        outAmount: 0,
        count: 0,
      };
      if (balance !== null) balance += b.inQty - b.outQty;
      return { ...b, balance };
    });
  }, [data]);
  const visiblePeriods = showEmpty ? periodRows : periodRows.filter((b) => b.count > 0);
  const hasBalance = periodRows.length > 0 && periodRows[0].balance !== null;

  // 사용처별: 사용처 단위로 묶어 소계 계산
  const placeGroups = useMemo(() => {
    if (!data || data.query.by !== 'place') return [];
    const groups = new Map();
    for (const r of data.rows) {
      if (!groups.has(r.place)) groups.set(r.place, []);
      groups.get(r.place).push(r);
    }
    return [...groups].map(([name, rows]) => ({
      name,
      rows,
      outQty: sum(rows, 'outQty'),
      outAmount: sum(rows, 'outAmount'),
      count: sum(rows, 'count'),
    }));
  }, [data]);

  const conditions = [
    `기간 ${from} ~ ${to}`,
    `${BY[by]} · ${GROUP[group]}`,
    `품목: ${itemId ? (itemName ?? `#${itemId}`) : '전체'}`,
    ...(by === 'place' ? [`사용처: ${place || '전체'}`] : []),
  ];

  let body;
  if (rangeError) {
    body = <StatusView kind="error" title="조회 조건을 확인해 주세요" description={rangeError} />;
  } else if (reportQuery.isPending) {
    body = <StatusView kind="loading" title="집계하는 중…" />;
  } else if (reportQuery.isError && !reportQuery.data) {
    body = (
      <StatusView
        kind="error"
        title="입출고 현황을 불러오지 못했습니다"
        description={reportQuery.error.message}
        onRetry={() => reportQuery.refetch()}
      />
    );
  } else if (data.rows.length === 0 && data.buckets.length === 0) {
    body = (
      <StatusView
        kind="empty"
        title="해당 기간에 입출고 기록이 없습니다"
        description="기간이나 조건을 바꿔 보세요."
      />
    );
  } else {
    const totals =
      data.query.by === 'item'
        ? [
            ['입고 수량', `${formatNumber(sum(data.rows, 'inQty'))}개`],
            ['출고 수량', `${formatNumber(sum(data.rows, 'outQty'))}개`],
            ['입고 금액', formatWon(sum(data.rows, 'inAmount'))],
            ['출고 금액', formatWon(sum(data.rows, 'outAmount'))],
          ]
        : [
            ['출고 수량', `${formatNumber(sum(data.rows, 'outQty'))}개`],
            ['출고 금액', formatWon(sum(data.rows, 'outAmount'))],
            ['사용처 수', `${formatNumber(placeGroups.length)}곳`],
            ['출고 건수', `${formatNumber(sum(data.rows, 'count'))}건`],
          ];

    body = (
      <>
        <dl className={styles.tiles}>
          {totals.map(([label, value]) => (
            <div key={label} className={styles.tile}>
              <dt>{label}</dt>
              <dd className="num">{value}</dd>
            </div>
          ))}
        </dl>

        <section className={styles.section} aria-labelledby={`${uid}-s1`}>
          <h3 id={`${uid}-s1`} className={styles.sectionTitle}>
            {data.query.by === 'item' ? '품목별 현황' : '사용처별 출고 현황'}
          </h3>
          <div className={styles.tableWrap}>
            {data.query.by === 'item' ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">품목</th>
                    <th scope="col">보관 위치</th>
                    <th scope="col" className={styles.r}>
                      기초
                    </th>
                    <th scope="col" className={styles.r}>
                      입고
                    </th>
                    <th scope="col" className={styles.r}>
                      출고
                    </th>
                    <th scope="col" className={styles.r}>
                      기말
                    </th>
                    <th scope="col" className={styles.r}>
                      입고 금액
                    </th>
                    <th scope="col" className={styles.r}>
                      출고 금액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.itemId}>
                      <th scope="row">
                        <Link to={`/items/${r.itemId}`} className={styles.link}>
                          {r.name}
                        </Link>
                        {r.deleted && <span className={styles.deleted}> (삭제됨)</span>}
                      </th>
                      <td>{r.location ?? '—'}</td>
                      <td className={styles.r}>{formatNumber(r.opening)}</td>
                      <td className={`${styles.r} ${styles.in}`}>
                        {r.inQty ? `+${formatNumber(r.inQty)}` : '0'}
                      </td>
                      <td className={`${styles.r} ${styles.out}`}>
                        {r.outQty ? `−${formatNumber(r.outQty)}` : '0'}
                      </td>
                      <td className={`${styles.r} ${styles.strong}`}>{formatNumber(r.closing)}</td>
                      <td className={styles.r}>{formatWon(r.inAmount)}</td>
                      <td className={styles.r}>{formatWon(r.outAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2}>
                      합계 ({formatNumber(data.rows.length)}개 품목)
                    </th>
                    <td className={styles.r}>{formatNumber(sum(data.rows, 'opening'))}</td>
                    <td className={styles.r}>+{formatNumber(sum(data.rows, 'inQty'))}</td>
                    <td className={styles.r}>−{formatNumber(sum(data.rows, 'outQty'))}</td>
                    <td className={styles.r}>{formatNumber(sum(data.rows, 'closing'))}</td>
                    <td className={styles.r}>{formatWon(sum(data.rows, 'inAmount'))}</td>
                    <td className={styles.r}>{formatWon(sum(data.rows, 'outAmount'))}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">사용처</th>
                    <th scope="col">품목</th>
                    <th scope="col" className={styles.r}>
                      출고 수량
                    </th>
                    <th scope="col" className={styles.r}>
                      건수
                    </th>
                    <th scope="col" className={styles.r}>
                      금액
                    </th>
                  </tr>
                </thead>
                {placeGroups.map((g) => (
                  <tbody key={g.name} className={styles.group}>
                    {g.rows.map((r, i) => (
                      <tr key={r.itemId}>
                        {i === 0 && (
                          <th
                            scope="rowgroup"
                            rowSpan={g.rows.length + 1}
                            className={styles.groupHead}
                          >
                            {g.name}
                          </th>
                        )}
                        <td>{r.name}</td>
                        <td className={`${styles.r} ${styles.out}`}>−{formatNumber(r.outQty)}</td>
                        <td className={styles.r}>{formatNumber(r.count)}</td>
                        <td className={styles.r}>{formatWon(r.outAmount)}</td>
                      </tr>
                    ))}
                    <tr className={styles.subtotal}>
                      <td>소계</td>
                      <td className={styles.r}>−{formatNumber(g.outQty)}</td>
                      <td className={styles.r}>{formatNumber(g.count)}</td>
                      <td className={styles.r}>{formatWon(g.outAmount)}</td>
                    </tr>
                  </tbody>
                ))}
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2}>
                      합계 ({formatNumber(placeGroups.length)}곳)
                    </th>
                    <td className={styles.r}>−{formatNumber(sum(data.rows, 'outQty'))}</td>
                    <td className={styles.r}>{formatNumber(sum(data.rows, 'count'))}</td>
                    <td className={styles.r}>{formatWon(sum(data.rows, 'outAmount'))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>

        <section className={styles.section} aria-labelledby={`${uid}-s2`}>
          <h3 id={`${uid}-s2`} className={styles.sectionTitle}>
            {GROUP[data.query.group]} {data.query.by === 'item' ? '입출고' : '출고'} 현황
          </h3>
          {visiblePeriods.length === 0 ? (
            <p className={styles.note}>해당 기간에 기록이 없습니다.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{data.query.group === 'day' ? '날짜' : '월'}</th>
                    {data.query.by === 'item' && (
                      <th scope="col" className={styles.r}>
                        입고
                      </th>
                    )}
                    <th scope="col" className={styles.r}>
                      출고
                    </th>
                    {data.query.by === 'item' && (
                      <th scope="col" className={styles.r}>
                        순증감
                      </th>
                    )}
                    {hasBalance && (
                      <th scope="col" className={styles.r}>
                        재고
                      </th>
                    )}
                    <th scope="col" className={styles.r}>
                      건수
                    </th>
                    {data.query.by === 'item' && (
                      <th scope="col" className={styles.r}>
                        입고 금액
                      </th>
                    )}
                    <th scope="col" className={styles.r}>
                      출고 금액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePeriods.map((b) => {
                    const net = b.inQty - b.outQty;
                    return (
                      <tr key={b.bucket} className={b.count === 0 ? styles.muted : ''}>
                        <th scope="row">{formatBucket(b.bucket, data.query.group)}</th>
                        {data.query.by === 'item' && (
                          <td className={`${styles.r} ${styles.in}`}>
                            {b.inQty ? `+${formatNumber(b.inQty)}` : '0'}
                          </td>
                        )}
                        <td className={`${styles.r} ${styles.out}`}>
                          {b.outQty ? `−${formatNumber(b.outQty)}` : '0'}
                        </td>
                        {data.query.by === 'item' && (
                          <td className={styles.r}>{net ? formatDelta(net) : '0'}</td>
                        )}
                        {hasBalance && (
                          <td className={`${styles.r} ${styles.strong}`}>
                            {formatNumber(b.balance)}
                          </td>
                        )}
                        <td className={styles.r}>{formatNumber(b.count)}</td>
                        {data.query.by === 'item' && (
                          <td className={styles.r}>{formatWon(b.inAmount)}</td>
                        )}
                        <td className={styles.r}>{formatWon(b.outAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {data.details && (
          <section className={styles.section} aria-labelledby={`${uid}-s3`}>
            <h3 id={`${uid}-s3`} className={styles.sectionTitle}>
              상세 내역 ({formatNumber(data.details.rows.length)}건
              {data.details.truncated ? ', 최대 2,000건까지 표시' : ''})
            </h3>
            {data.details.rows.length === 0 ? (
              <p className={styles.note}>해당 기간에 기록이 없습니다.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.compact}`}>
                  <thead>
                    <tr>
                      <th scope="col">일시</th>
                      <th scope="col">품목</th>
                      <th scope="col">구분</th>
                      <th scope="col" className={styles.r}>
                        수량
                      </th>
                      <th scope="col">입고처/사용처</th>
                      <th scope="col" className={styles.r}>
                        단가
                      </th>
                      <th scope="col">기록자</th>
                      <th scope="col">내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.details.rows.map((d) => (
                      <tr key={d.id}>
                        <td className={styles.nowrap}>{formatDateTime(d.createdAt)}</td>
                        <td>{d.itemName}</td>
                        <td className={styles.nowrap}>{d.delta > 0 ? '+ 입고' : '− 출고'}</td>
                        <td className={`${styles.r} ${d.delta > 0 ? styles.in : styles.out}`}>
                          {formatDelta(d.delta)}
                        </td>
                        <td>{d.usagePlace}</td>
                        <td className={styles.r}>
                          {d.unitPrice === null ? '—' : formatWon(d.unitPrice)}
                        </td>
                        <td className={styles.nowrap}>{d.userName}</td>
                        <td>{d.memo ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <p className={styles.note}>
          금액은 입출고 시 입력한 단가 기준이며, 단가가 없는 기록은 품목의 입고단가로 계산합니다.
          날짜는 한국 시간 기준입니다.
        </p>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.titleRow} no-print`}>
        <h1 className={styles.title}>입출고 현황</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
          disabled={!data || reportQuery.isFetching}
        >
          <span aria-hidden="true">🖨</span> 프린트
        </button>
      </div>

      <form
        className={`${styles.filters} no-print`}
        onSubmit={(e) => e.preventDefault()}
        aria-label="조회 조건"
      >
        <div className={styles.filterRow}>
          <Segmented
            legend="보기 기준"
            name="by"
            value={by}
            options={BY}
            onChange={(v) => update({ by: v === 'item' ? '' : v, place: '' })}
          />
          <Segmented
            legend="집계 단위"
            name="group"
            value={group}
            options={GROUP}
            onChange={(v) => update({ group: v === 'day' ? '' : v })}
          />
        </div>

        <fieldset className={styles.period}>
          <legend className="field-label">기간</legend>
          <div className={styles.dates}>
            <label className={styles.dateField}>
              <span className="visually-hidden">시작일</span>
              <input
                className="input"
                type="date"
                value={from}
                max={todayStr()}
                onChange={(e) => update({ from: e.target.value })}
                aria-invalid={rangeError ? 'true' : undefined}
              />
            </label>
            <span aria-hidden="true">~</span>
            <label className={styles.dateField}>
              <span className="visually-hidden">종료일</span>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => update({ to: e.target.value })}
                aria-invalid={rangeError ? 'true' : undefined}
              />
            </label>
          </div>
          <div className={styles.presets}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => update(presetRange(p.key))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.filterRow}>
          <div className="field">
            <label htmlFor={`${uid}-item`} className="field-label">
              품목
            </label>
            <select
              id={`${uid}-item`}
              className="input"
              value={itemId}
              onChange={(e) => update({ itemId: e.target.value })}
            >
              <option value="">전체 품목</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          {by === 'place' && (
            <div className="field">
              <label htmlFor={`${uid}-place`} className="field-label">
                사용처
              </label>
              <select
                id={`${uid}-place`}
                className="input"
                value={place}
                onChange={(e) => update({ place: e.target.value })}
              >
                <option value="">전체 사용처</option>
                {placeNames.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className={styles.checks}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={detail}
              onChange={(e) => update({ detail: e.target.checked })}
            />
            상세 내역 포함
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={showEmpty}
              onChange={(e) => update({ empty: e.target.checked })}
            />
            기록 없는 기간도 표시
          </label>
        </div>
      </form>

      <article
        className={styles.report}
        aria-labelledby={`${uid}-title`}
        aria-busy={reportQuery.isFetching}
      >
        <header className={styles.reportHead}>
          <h2 id={`${uid}-title`} className={styles.reportTitle}>
            입출고 현황 보고서 ({BY[by]} · {GROUP[group]})
          </h2>
          <p className={styles.meta}>{conditions.join(' · ')}</p>
          <p className={`${styles.meta} print-only`}>
            출력 {formatDateTime(new Date().toISOString())} · 출력자 {user?.name}
          </p>
        </header>
        {body}
      </article>
    </div>
  );
}
