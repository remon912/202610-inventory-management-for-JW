import { useId, useRef, useState } from 'react';
import Combobox from './Combobox.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { useCreateMovement } from '../hooks/useMovements.js';
import { useCreateUsagePlace, useUsagePlaces } from '../hooks/useUsagePlaces.js';
import { formatNumber, formatWon, parseIntInput, parseMoneyInput } from '../lib/format.js';
import styles from './MovementForm.module.css';

const MAX_QTY = 1_000_000;

function validate(values, type, currentQty, placeNames) {
  const errors = {};
  const qty = parseIntInput(values.quantity);
  if (values.quantity.trim() === '') errors.quantity = '수량을 입력해 주세요.';
  else if (Number.isNaN(qty)) errors.quantity = '수량은 1 이상의 정수로 입력해 주세요.';
  else if (qty < 1) errors.quantity = '수량은 1 이상이어야 합니다.';
  else if (qty > MAX_QTY) errors.quantity = `수량은 ${formatNumber(MAX_QTY)} 이하여야 합니다.`;
  else if (type === 'out' && qty > currentQty)
    errors.quantity = `출고 수량이 현재 보유수량(${formatNumber(currentQty)}개)보다 많습니다.`;

  const place = values.usagePlace.trim();
  if (!place) errors.usagePlace = `${type === 'in' ? '입고처' : '사용처'}를 입력해 주세요.`;
  else if (place.length > 100) errors.usagePlace = '100자 이하로 입력해 주세요.';
  else if (type === 'out' && !placeNames.includes(place))
    errors.usagePlace =
      '등록된 사용처만 선택할 수 있습니다. 목록에서 고르거나 + 추가를 눌러 주세요.';

  if (values.memo.trim().length > 500) errors.memo = '500자 이하로 입력해 주세요.';

  if (Number.isNaN(parseMoneyInput(values.unitPrice)))
    errors.unitPrice = '0 이상의 숫자로, 소수점 2자리까지 입력해 주세요.';

  return errors;
}

/**
 * 입출고 등록 폼
 * initial: { type: 'in' | 'out', quantity, usagePlace, memo } (정정 기록 등에서 미리 채움)
 */
export default function MovementForm({ item, initial = {}, onSuccess }) {
  const uid = useId();
  const formRef = useRef(null);
  const { user, isAdmin } = useCurrentUser();
  const mutation = useCreateMovement();
  const placesQuery = useUsagePlaces();
  const createPlace = useCreateUsagePlace();
  const placeNames = (placesQuery.data ?? []).map((p) => p.name);
  const supplier = item.supplier ?? '';

  const initialType = initial.type === 'out' ? 'out' : 'in';
  const [type, setType] = useState(initialType);
  const [values, setValues] = useState({
    quantity: initial.quantity ?? '',
    // 입고처는 품목의 구입처로 미리 채운다
    usagePlace: initial.usagePlace || (initialType === 'in' ? supplier : ''),
    memo: initial.memo ?? '',
    unitPrice: '',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  const qty = parseIntInput(values.quantity);
  const delta = Number.isNaN(qty) ? null : type === 'in' ? qty : -qty;
  const after = delta === null ? null : item.quantity + delta;

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
  };

  const setUsagePlace = (text) => {
    setValues((v) => ({ ...v, usagePlace: text }));
    if (errors.usagePlace) setErrors(({ usagePlace: _removed, ...rest }) => rest);
  };

  const changeType = (next) => {
    setType(next);
    setErrors({});
    setValues((v) => {
      // 입고처(구입처) 값을 출고 사용처로 넘기지 않고, 반대로도 마찬가지
      if (next === 'out' && v.usagePlace === supplier) return { ...v, usagePlace: '' };
      if (next === 'in' && !v.usagePlace) return { ...v, usagePlace: supplier };
      return v;
    });
  };

  const addPlace = (name) => {
    setSubmitError(null);
    if (!user) {
      setSubmitError('사용처를 추가하려면 화면 위쪽에서 사용자를 먼저 선택해 주세요.');
      return;
    }
    createPlace.mutate(name.trim(), {
      onSuccess: (place) => setUsagePlace(place.name),
      onError: (err) => setErrors((prev) => ({ ...prev, usagePlace: err.message })),
    });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!user) {
      setSubmitError('화면 위쪽에서 사용자를 먼저 선택해 주세요.');
      return;
    }
    const errs = validate(values, type, item.quantity, placeNames);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      formRef.current.elements.namedItem(first)?.focus();
      return;
    }
    mutation.mutate(
      {
        itemId: item.id,
        delta,
        usagePlace: values.usagePlace.trim(),
        memo: values.memo.trim() || null,
        unitPrice: parseMoneyInput(values.unitPrice),
      },
      {
        onSuccess: (data) => onSuccess?.(data),
        onError: (err) => setSubmitError(err.message),
      },
    );
  };

  const field = (name) => ({
    id: `${uid}-${name}`,
    name,
    value: values[name],
    onChange: set(name),
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `${uid}-${name}-err` : undefined,
  });
  const errorText = (name) =>
    errors[name] && (
      <p id={`${uid}-${name}-err`} className="field-error">
        {errors[name]}
      </p>
    );

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
      <fieldset className={styles.toggle}>
        <legend className="field-label">구분</legend>
        <div className={styles.segments}>
          {[
            { value: 'in', label: '입고', sign: '+' },
            { value: 'out', label: '출고', sign: '−' },
          ].map((opt) => (
            <label key={opt.value} className={`${styles.segment} ${styles[opt.value]}`}>
              <input
                type="radio"
                name="type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => changeType(opt.value)}
              />
              <span className={styles.sign} aria-hidden="true">
                {opt.sign}
              </span>
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor={`${uid}-quantity`} className="field-label">
          수량
        </label>
        <div className={styles.qtyRow}>
          <input
            {...field('quantity')}
            className={`input num ${styles.qtyInput}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="0"
            required
          />
          <span className={styles.qtyUnit}>개</span>
        </div>
        {errorText('quantity')}
        <p className={styles.preview} aria-live="polite">
          현재 <strong className="num">{formatNumber(item.quantity)}</strong>개
          {after !== null && delta !== 0 && (
            <>
              {' → 등록 후 '}
              <strong className={`num ${after < 0 ? styles.negative : ''}`}>
                {formatNumber(after)}
              </strong>
              개
            </>
          )}
        </p>
      </div>

      {type === 'in' ? (
        <div className="field">
          <label htmlFor={`${uid}-usagePlace`} className="field-label">
            입고처
          </label>
          <input
            {...field('usagePlace')}
            className="input"
            type="text"
            maxLength={100}
            placeholder="예: ○○상사"
            required
          />
          {supplier && (
            <p className="field-hint">품목의 구입처({supplier})가 기본으로 입력됩니다.</p>
          )}
          {errorText('usagePlace')}
        </div>
      ) : (
        <div className="field">
          <label htmlFor={`${uid}-usagePlace`} className="field-label">
            사용처
          </label>
          <Combobox
            id={`${uid}-usagePlace`}
            name="usagePlace"
            value={values.usagePlace}
            onChange={setUsagePlace}
            options={placeNames}
            onCreate={isAdmin ? addPlace : undefined}
            creating={createPlace.isPending}
            createLabel={(text) => `+ '${text}' 새 사용처로 추가`}
            placeholder={placesQuery.isPending ? '사용처 목록을 불러오는 중…' : '사용처 검색'}
            emptyText={
              isAdmin
                ? '등록된 사용처가 없습니다. 이름을 입력하고 + 추가를 눌러 주세요.'
                : '일치하는 사용처가 없습니다. 관리자에게 등록을 요청하세요.'
            }
            invalid={Boolean(errors.usagePlace)}
            describedBy={`${uid}-usagePlace-hint${errors.usagePlace ? ` ${uid}-usagePlace-err` : ''}`}
            maxLength={100}
          />
          <p id={`${uid}-usagePlace-hint`} className="field-hint">
            {isAdmin
              ? '등록된 사용처 중에서 선택합니다. 목록에 없으면 이름을 입력하고 + 추가를 누르세요.'
              : '등록된 사용처 중에서 선택합니다. 새 사용처는 관리자만 등록할 수 있습니다.'}
          </p>
          {placesQuery.isError && (
            <p className="field-error">
              사용처 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          )}
          {errorText('usagePlace')}
        </div>
      )}

      <div className="field">
        <label htmlFor={`${uid}-memo`} className="field-label">
          내용<span className="optional">(선택)</span>
        </label>
        <textarea {...field('memo')} className="input" maxLength={500} rows={3} />
        {errorText('memo')}
      </div>

      <div className="field">
        <label htmlFor={`${uid}-unitPrice`} className="field-label">
          {type === 'in' ? '입고단가' : '납품단가'}
          <span className="optional">(선택, 원)</span>
        </label>
        <input
          {...field('unitPrice')}
          className="input num"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={type === 'in' ? `현재 입고단가 ${formatWon(item.unitCost)}` : '예: 12000'}
        />
        {errorText('unitPrice')}
      </div>

      {submitError && (
        <p className="alert" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        className={`btn ${type === 'in' ? 'btn-in' : 'btn-out'} ${styles.submit}`}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? '등록 중…' : `${type === 'in' ? '+ 입고' : '− 출고'} 등록`}
      </button>
    </form>
  );
}
