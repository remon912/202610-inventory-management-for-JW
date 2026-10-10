import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import StatusView from '../components/StatusView.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { itemKeys, useBulkCreateItems, useItems } from '../hooks/useItems.js';
import { useToast } from '../hooks/useToast.js';
import { api } from '../lib/api.js';
import { formatNumber } from '../lib/format.js';
import { prepareImage } from '../lib/image.js';
import {
  COLUMNS,
  MAX_ROWS,
  applyPaste,
  attachPhotosByName,
  downloadTemplate,
  dupKey,
  emptyRow,
  isBlank,
  isImageFile,
  parseTsv,
  readItemFile,
  toPayload,
  validateRow,
} from '../lib/itemSheet.js';
import styles from './ItemBulk.module.css';

const INITIAL_ROWS = 5;
const INPUT_MODE = { unitCost: 'decimal', quantity: 'numeric', minQuantity: 'numeric' };
const PLACEHOLDER = {
  name: '예: A4 복사용지',
  location: '예: 창고A-선반1',
  supplier: '예: ○○상사',
  unitCost: '4500',
  quantity: '0',
  minQuantity: '0',
};

const makeRows = (n) => Array.from({ length: n }, () => emptyRow());
const revoke = (url) => url && URL.revokeObjectURL(url);

export default function ItemBulkPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();
  const allQuery = useItems({});
  const mutation = useBulkCreateItems();
  const fileRef = useRef(null);
  const photosRef = useRef(null);
  const rowPhotoRef = useRef(null);
  const rowPhotoTarget = useRef(null);
  const tableRef = useRef(null);

  const [rows, setRows] = useState(() => makeRows(INITIAL_ROWS));
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState({}); // { rowId: { 칸: 메시지 } }
  const [message, setMessage] = useState(null); // { kind: 'error' | 'info', text }
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(null); // { done, total } 사진 올리는 중

  // 화면을 떠날 때 사진 미리보기 주소 정리
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  useEffect(() => () => rowsRef.current.forEach((r) => revoke(r.photoUrl)), []);

  const existingNames = useMemo(
    () => new Set((allQuery.data ?? []).map((i) => dupKey(i.name))),
    [allQuery.data],
  );

  // 입력된 줄만 검사 (완전히 빈 줄은 등록에서 제외)
  const filled = rows.filter((r) => !isBlank(r));
  const photoCount = filled.filter((r) => r.photo).length;
  const errorsById = useMemo(() => {
    const counts = new Map();
    for (const r of rows) {
      if (isBlank(r)) continue;
      const k = dupKey(r.name);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const duplicateNames = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
    const out = {};
    for (const r of rows) {
      if (isBlank(r)) continue;
      const errs = { ...validateRow(r, { existingNames, duplicateNames }), ...serverErrors[r.id] };
      if (Object.keys(errs).length) out[r.id] = errs;
    }
    return out;
  }, [rows, existingNames, serverErrors]);
  const errorCount = Object.keys(errorsById).length;
  const busy = mutation.isPending || Boolean(uploading);

  if (!isAdmin) {
    return (
      <StatusView
        kind="error"
        title="품목 일괄 등록은 관리자만 할 수 있습니다"
        description="상단의 사용자 선택에서 관리자로 로그인하세요."
      />
    );
  }

  const updateCell = (id, key, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    if (serverErrors[id]) {
      setServerErrors(({ [id]: _removed, ...rest }) => rest);
    }
  };

  const addRows = (n) => {
    if (rows.length >= MAX_ROWS) {
      setMessage({
        kind: 'error',
        text: `한 번에 ${formatNumber(MAX_ROWS)}줄까지 입력할 수 있습니다.`,
      });
      return;
    }
    setRows((prev) => [...prev, ...makeRows(Math.min(n, MAX_ROWS - prev.length))]);
  };

  const removeRow = (id) => {
    const target = rows.find((r) => r.id === id);
    revoke(target?.photoUrl);
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : makeRows(1)));
  };

  const clearBlankRows = () => {
    setRows((prev) => {
      const kept = prev.filter((r) => !isBlank(r));
      return kept.length ? kept : makeRows(1);
    });
  };

  /** 엑셀 파일 첨부: 이미 입력한 줄은 두고 뒤에 붙인다 */
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReading(true);
    setMessage(null);
    try {
      const imported = await readItemFile(file);
      if (imported.length === 0) {
        setMessage({ kind: 'error', text: '파일에 등록할 품목 줄이 없습니다.' });
        return;
      }
      const kept = rows.filter((r) => !isBlank(r));
      const merged = [...kept, ...imported];
      if (merged.length > MAX_ROWS) {
        setMessage({
          kind: 'error',
          text: `한 번에 ${formatNumber(MAX_ROWS)}줄까지 등록할 수 있습니다. 파일을 나눠서 올려 주세요. (현재 ${formatNumber(merged.length)}줄)`,
        });
        return;
      }
      setRows(merged);
      setServerErrors({});
      setShowErrors(true);
      toast(`‘${file.name}’에서 ${formatNumber(imported.length)}개 줄을 불러왔습니다.`);
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setReading(false);
    }
  };

  /** 사진 여러 장: 파일 이름과 같은 품목명 줄에 연결, 없으면 새 줄 */
  const onPhotos = (e) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length === 0) return;
    const result = attachPhotosByName(rows, files, (f) => URL.createObjectURL(f));
    result.replaced.forEach(revoke);
    setRows(result.rows);
    setServerErrors({});
    const parts = [];
    if (result.matched.length) parts.push(`${result.matched.length}장은 같은 이름의 줄에 연결`);
    if (result.added.length) parts.push(`${result.added.length}장은 파일 이름으로 새 줄 추가`);
    toast(`사진 ${files.length - result.skipped.length}장: ${parts.join(', ')}했습니다.`);
    if (result.skipped.length) {
      setMessage({
        kind: 'error',
        text: `사진이 아니거나 줄 수 한도를 넘어 건너뛴 파일: ${result.skipped.join(', ')}`,
      });
    } else if (result.added.length) {
      setMessage({
        kind: 'info',
        text: '새로 추가된 줄은 입고단가 등 나머지 칸을 채워 주세요.',
      });
      setShowErrors(true);
    }
  };

  /** 줄 하나의 사진 선택·변경 */
  const pickRowPhoto = (id) => {
    rowPhotoTarget.current = id;
    rowPhotoRef.current?.click();
  };
  const onRowPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = rowPhotoTarget.current;
    if (!file || id === null) return;
    if (!isImageFile(file)) {
      setMessage({ kind: 'error', text: '이미지 파일만 사진으로 등록할 수 있습니다.' });
      return;
    }
    const url = URL.createObjectURL(file);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        revoke(r.photoUrl);
        return { ...r, photo: file, photoUrl: url };
      }),
    );
  };
  const removeRowPhoto = (id) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        revoke(r.photoUrl);
        return { ...r, photo: null, photoUrl: null };
      }),
    );

  /** 엑셀에서 여러 칸을 복사해 붙여넣으면 표에 채운다 */
  const onPaste = (rowIndex, key) => (e) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return; // 한 칸 붙여넣기는 기본 동작
    e.preventDefault();
    const grid = parseTsv(text);
    if (grid.length === 0) return;
    setRows((prev) => applyPaste(prev, rowIndex, key, grid));
    setServerErrors({});
    toast(`${formatNumber(grid.length)}줄을 붙여넣었습니다.`);
  };

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      tableRef.current?.querySelector('[aria-invalid="true"]')?.focus();
    });
  };

  /** 등록된 품목에 사진을 한 장씩 올린다. 실패한 품목명 목록을 돌려준다. */
  const uploadPhotos = async (createdItems) => {
    const idByName = new Map(createdItems.map((it) => [dupKey(it.name), it.id]));
    const jobs = filled.filter((r) => r.photo);
    const failed = [];
    setUploading({ done: 0, total: jobs.length });
    for (const [i, row] of jobs.entries()) {
      const id = idByName.get(dupKey(row.name));
      try {
        if (!id) throw new Error('품목을 찾지 못함');
        const { image, thumb } = await prepareImage(row.photo);
        await api.addItemPhoto(id, { image, thumb });
      } catch {
        failed.push(row.name.trim());
      }
      setUploading({ done: i + 1, total: jobs.length });
    }
    setUploading(null);
    qc.invalidateQueries({ queryKey: itemKeys.all });
    return failed;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setShowErrors(true);
    setMessage(null);
    if (filled.length === 0) {
      setMessage({ kind: 'error', text: '등록할 품목을 한 줄 이상 입력해 주세요.' });
      return;
    }
    if (errorCount > 0) {
      setMessage({
        kind: 'error',
        text: `${formatNumber(errorCount)}개 줄에 확인할 내용이 있습니다. 빨간 칸을 고쳐 주세요.`,
      });
      focusFirstError();
      return;
    }
    mutation.mutate(filled.map(toPayload), {
      onSuccess: async (data) => {
        const failed = photoCount > 0 ? await uploadPhotos(data.items) : [];
        const uploaded = photoCount - failed.length;
        toast(
          `${formatNumber(data.count)}개 품목을 등록했습니다.` +
            (photoCount > 0 ? ` (사진 ${formatNumber(uploaded)}장)` : ''),
        );
        if (failed.length > 0) {
          toast(
            `사진 ${failed.length}장을 올리지 못했습니다: ${failed.join(', ')}. 입출고 화면의 📷 버튼으로 다시 추가하세요.`,
            { variant: 'error' },
          );
        }
        navigate('/', { replace: true });
      },
      onError: (err) => {
        // 서버가 알려준 줄 번호(입력된 줄 기준)를 입력표 줄에 표시
        const next = {};
        const mark = (index, key, msg) => {
          const row = filled[index];
          if (row) next[row.id] = { ...next[row.id], [key]: msg };
        };
        for (const r of err.details?.rows ?? []) {
          mark(
            r.row,
            'name',
            err.code === 'DUPLICATE_ITEMS'
              ? '이미 등록된 품목입니다.'
              : '목록 안에 같은 이름이 있습니다.',
          );
        }
        for (const issue of err.details?.issues ?? []) {
          const [, index, key] = issue.field.split('.');
          if (index !== undefined) mark(Number(index), key ?? 'name', issue.message);
        }
        setServerErrors(next);
        setMessage({ kind: 'error', text: err.message });
        focusFirstError();
      },
    });
  };

  let submitLabel = `${formatNumber(filled.length)}개 품목 등록`;
  if (photoCount > 0) submitLabel += ` (사진 ${formatNumber(photoCount)}장)`;
  if (mutation.isPending) submitLabel = '품목 등록 중…';
  if (uploading) submitLabel = `사진 올리는 중 ${uploading.done}/${uploading.total}…`;

  return (
    <div className={styles.page}>
      <Link to="/items/new" className={styles.back}>
        <span aria-hidden="true">←</span> 품목 등록
      </Link>
      <div>
        <h1 className={styles.title}>품목 일괄 등록</h1>
        <p className={styles.desc}>
          엑셀 파일을 첨부하거나, 아래 표에 여러 품목을 한꺼번에 입력해 등록합니다. 사진도 함께
          등록할 수 있습니다.
        </p>
      </div>

      <section className={styles.card} aria-labelledby="bulk-file">
        <h2 id="bulk-file" className={styles.cardTitle}>
          ① 엑셀 파일·사진 가져오기
        </h2>
        <p className={styles.hint}>
          첫 줄에 열 제목(품목명, 수량, 입고단가, 보관 위치, 구입처, 재고 부족 기준)이 있는 .xlsx
          또는 .csv 파일을 올리면 아래 표에 채워집니다. 품목명과 입고단가는 필수이고, 수량은 비워
          두면 0개로 등록됩니다. 열 순서는 달라도 됩니다.
        </p>
        <div className={styles.fileActions}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            hidden
            onChange={onFile}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={reading || busy}
          >
            {reading ? '파일 읽는 중…' : '📄 엑셀 파일 첨부'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              downloadTemplate().catch(() =>
                toast('양식을 만들지 못했습니다.', { variant: 'error' }),
              )
            }
          >
            ⬇ 엑셀 양식 내려받기
          </button>
        </div>

        <div className={styles.photoBox}>
          <input ref={photosRef} type="file" accept="image/*" multiple hidden onChange={onPhotos} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => photosRef.current?.click()}
            disabled={busy}
          >
            🖼 사진 여러 장 첨부
          </button>
          <p className={styles.hint}>
            사진 <strong>파일 이름을 품목명과 같게</strong> 하면 그 줄에 자동으로 연결됩니다. (예:{' '}
            <code>물티슈.jpg</code> → &lsquo;물티슈&rsquo; 줄) 같은 이름의 줄이 없으면 파일 이름으로
            새 줄을 만듭니다.
          </p>
        </div>
      </section>

      <form className={styles.card} onSubmit={onSubmit} noValidate aria-labelledby="bulk-table">
        <div className={styles.cardHead}>
          <h2 id="bulk-table" className={styles.cardTitle}>
            ② 입력표에서 확인·수정
          </h2>
          <p className={styles.hint}>
            <strong>+ 행 추가</strong>로 줄을 늘려 입력하세요. 엑셀에서 여러 칸을 복사해 표의 칸에
            붙여넣어도 됩니다. 사진 칸의 📷를 누르면 줄마다 사진을 넣을 수 있습니다.
          </p>
        </div>

        <input ref={rowPhotoRef} type="file" accept="image/*" hidden onChange={onRowPhoto} />
        <div className={styles.tableWrap}>
          <table ref={tableRef} className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.no}>
                  #
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                    {c.required && (
                      <span className={styles.req} aria-label="필수">
                        *
                      </span>
                    )}
                    {c.hint && <span className={styles.colHint}>{c.hint}</span>}
                  </th>
                ))}
                <th scope="col">사진</th>
                <th scope="col">
                  <span className="visually-hidden">줄 삭제</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const errs = showErrors ? (errorsById[row.id] ?? {}) : (serverErrors[row.id] ?? {});
                const hasError = Object.keys(errs).length > 0;
                const label = row.name.trim() || `${i + 1}번째 줄`;
                return (
                  <tr key={row.id} className={hasError ? styles.errorRow : ''}>
                    <th scope="row" className={styles.no}>
                      {i + 1}
                    </th>
                    {COLUMNS.map((c) => {
                      const errId = `bulk-${row.id}-${c.key}-err`;
                      return (
                        <td key={c.key} className={styles[`col_${c.key}`]}>
                          <input
                            className={`input ${styles.cell}`}
                            type="text"
                            value={row[c.key]}
                            onChange={(e) => updateCell(row.id, c.key, e.target.value)}
                            onPaste={onPaste(i, c.key)}
                            inputMode={INPUT_MODE[c.key]}
                            placeholder={i === 0 ? PLACEHOLDER[c.key] : undefined}
                            maxLength={100}
                            autoComplete="off"
                            disabled={busy}
                            aria-label={`${i + 1}번째 줄 ${c.label}${c.hint ? ` (${c.hint})` : ''}`}
                            aria-invalid={errs[c.key] ? 'true' : undefined}
                            aria-describedby={errs[c.key] ? errId : undefined}
                          />
                          {errs[c.key] && (
                            <p id={errId} className={styles.cellError}>
                              {errs[c.key]}
                            </p>
                          )}
                        </td>
                      );
                    })}
                    <td className={styles.col_photo}>
                      {/* 📷(또는 미리보기 사진)을 누르면 사진 선택, ×로 빼기 */}
                      <div className={styles.photoCell}>
                        <button
                          type="button"
                          className={`${styles.photoButton} ${row.photoUrl ? '' : styles.photoEmpty}`}
                          onClick={() => pickRowPhoto(row.id)}
                          disabled={busy}
                          aria-label={`${label} 사진 ${row.photo ? '변경' : '등록'}`}
                          title={row.photo ? '눌러서 사진 바꾸기' : '눌러서 사진 등록'}
                        >
                          {row.photoUrl ? (
                            <img src={row.photoUrl} alt="" className={styles.thumb} />
                          ) : (
                            <span aria-hidden="true">📷</span>
                          )}
                        </button>
                        {row.photo && (
                          <button
                            type="button"
                            className={styles.photoRemove}
                            onClick={() => removeRowPhoto(row.id)}
                            disabled={busy}
                            aria-label={`${label} 사진 빼기`}
                            title="사진 빼기"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeRow(row.id)}
                        disabled={busy}
                        aria-label={`${i + 1}번째 줄 삭제`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.rowActions}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => addRows(1)}
            disabled={busy}
          >
            + 행 추가
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => addRows(10)}
            disabled={busy}
          >
            + 10행 추가
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearBlankRows}
            disabled={busy}
          >
            빈 줄 정리
          </button>
        </div>

        <div className={styles.submitBar}>
          <p className={styles.summary} aria-live="polite">
            입력된 품목 <strong className="num">{formatNumber(filled.length)}</strong>개
            {photoCount > 0 && <> · 사진 {formatNumber(photoCount)}장</>}
            {showErrors && errorCount > 0 && (
              <>
                {' · '}
                <span className={styles.bad}>확인 필요 {formatNumber(errorCount)}개</span>
              </>
            )}
          </p>
          <button
            type="submit"
            className={`btn btn-primary ${styles.submit}`}
            disabled={busy || filled.length === 0}
          >
            {submitLabel}
          </button>
        </div>
        {uploading && (
          <p className={styles.hint} role="status">
            품목은 등록되었습니다. 사진을 올리는 동안 이 화면을 닫지 마세요.
          </p>
        )}
        {message && (
          <p className={message.kind === 'error' ? 'alert' : styles.hint} role="alert">
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
