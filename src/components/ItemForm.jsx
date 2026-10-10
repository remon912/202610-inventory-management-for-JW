import { useId, useRef, useState } from 'react';
import ItemPhotoManager from './ItemPhotoManager.jsx';
import PhotoInput from './PhotoInput.jsx';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { formatNumber, parseIntInput, parseMoneyInput } from '../lib/format.js';
import styles from './ItemForm.module.css';

const MAX_QTY = 1_000_000;
const HINTS = new Set(['supplier', 'unitCost', 'quantity', 'minQuantity']);

function validate(values, isNew) {
  const errors = {};
  const name = values.name.trim();
  if (!name) errors.name = '품목명을 입력해 주세요.';
  else if (name.length > 100) errors.name = '100자 이하로 입력해 주세요.';

  if (values.location.trim().length > 100) errors.location = '100자 이하로 입력해 주세요.';
  if (values.supplier.trim().length > 100) errors.supplier = '100자 이하로 입력해 주세요.';

  const cost = parseMoneyInput(values.unitCost);
  if (cost === null) errors.unitCost = '입고단가를 입력해 주세요.';
  else if (Number.isNaN(cost)) errors.unitCost = '0 이상의 숫자로, 소수점 2자리까지 입력해 주세요.';

  const intField = (key, label) => {
    const v = parseIntInput(values[key] === '' ? '0' : values[key]);
    if (Number.isNaN(v)) errors[key] = `${label}은(는) 0 이상의 정수로 입력해 주세요.`;
    else if (v > MAX_QTY) errors[key] = `${formatNumber(MAX_QTY)} 이하로 입력해 주세요.`;
  };
  if (isNew) intField('quantity', '초기 보유수량');
  intField('minQuantity', '재고 부족 기준');
  return errors;
}

/**
 * 품목 등록·수정 폼. item이 없으면 등록 모드.
 * 보유수량은 등록 시 초기값만 입력하고, 이후에는 입출고로만 변경한다.
 */
export default function ItemForm({
  item,
  initialName = '',
  locations = [],
  suppliers = [],
  mutation,
  onSuccess,
  submitLabel,
}) {
  const uid = useId();
  const formRef = useRef(null);
  const { user } = useCurrentUser();
  const isNew = !item;

  const [values, setValues] = useState({
    name: item?.name ?? initialName,
    location: item?.location ?? '',
    supplier: item?.supplier ?? '',
    unitCost: item ? String(item.unitCost) : '',
    quantity: '',
    minQuantity: item ? String(item.minQuantity) : '',
  });
  const [photo, setPhoto] = useState(null); // 사진은 등록 시에만 (수정 화면에서는 입력 없음)
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!user) {
      setSubmitError('화면 위쪽에서 사용자를 먼저 선택해 주세요.');
      return;
    }
    const errs = validate(values, isNew);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      formRef.current.elements.namedItem(first)?.focus();
      return;
    }
    const input = {
      name: values.name.trim(),
      location: values.location.trim() || null,
      supplier: values.supplier.trim() || null,
      unitCost: parseMoneyInput(values.unitCost),
      minQuantity: parseIntInput(values.minQuantity || '0'),
    };
    if (isNew) {
      input.quantity = parseIntInput(values.quantity || '0');
      if (photo) input.photo = { image: photo.image, thumb: photo.thumb };
    }
    mutation.mutate(input, {
      onSuccess: (saved) => onSuccess?.(saved),
      onError: (err) => setSubmitError(err.message),
    });
  };

  const field = (name) => ({
    id: `${uid}-${name}`,
    name,
    value: values[name],
    onChange: set(name),
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby':
      [errors[name] && `${uid}-${name}-err`, HINTS.has(name) && `${uid}-${name}-hint`]
        .filter(Boolean)
        .join(' ') || undefined,
  });
  const errorText = (name) =>
    errors[name] && (
      <p id={`${uid}-${name}-err`} className="field-error">
        {errors[name]}
      </p>
    );

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
      {!isNew && (
        <div className="field">
          <span className="field-label">사진</span>
          <ItemPhotoManager item={item} />
        </div>
      )}

      <div className="field">
        <label htmlFor={`${uid}-name`} className="field-label">
          품목명
        </label>
        <input {...field('name')} className="input" type="text" maxLength={100} required />
        {errorText('name')}
      </div>

      {isNew && <PhotoInput value={photo} onChange={setPhoto} disabled={mutation.isPending} />}

      <div className="field">
        <label htmlFor={`${uid}-location`} className="field-label">
          보관 위치<span className="optional">(선택)</span>
        </label>
        <input
          {...field('location')}
          className="input"
          type="text"
          maxLength={100}
          list={`${uid}-locations`}
          placeholder="예: 창고A-선반3"
        />
        <datalist id={`${uid}-locations`}>
          {locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        {errorText('location')}
      </div>

      <div className="field">
        <label htmlFor={`${uid}-supplier`} className="field-label">
          구입처<span className="optional">(선택)</span>
        </label>
        <input
          {...field('supplier')}
          className="input"
          type="text"
          maxLength={100}
          list={`${uid}-suppliers`}
          placeholder="예: ○○상사"
        />
        <datalist id={`${uid}-suppliers`}>
          {suppliers.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <p id={`${uid}-supplier-hint`} className="field-hint">
          입고 등록 시 입고처로 자동 입력됩니다.
        </p>
        {errorText('supplier')}
      </div>

      <div className="field">
        <label htmlFor={`${uid}-unitCost`} className="field-label">
          입고단가 (원)
        </label>
        <input
          {...field('unitCost')}
          className="input num"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="예: 12000"
          required
        />
        <p id={`${uid}-unitCost-hint`} className="field-hint">
          소수점 2자리까지 입력할 수 있습니다.
        </p>
        {errorText('unitCost')}
      </div>

      <div className={styles.row}>
        {isNew ? (
          <div className="field">
            <label htmlFor={`${uid}-quantity`} className="field-label">
              초기 보유수량<span className="optional">(선택)</span>
            </label>
            <input
              {...field('quantity')}
              className="input num"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="0"
            />
            <p id={`${uid}-quantity-hint`} className="field-hint">
              입력한 수량은 &lsquo;초기 재고&rsquo; 입고 이력으로 기록됩니다.
            </p>
            {errorText('quantity')}
          </div>
        ) : (
          <div className="field">
            <span className="field-label">보유수량</span>
            <p className={styles.readonly}>
              <strong className="num">{formatNumber(item.quantity)}</strong>개
            </p>
            <p className="field-hint">보유수량은 입출고 등록으로만 변경됩니다.</p>
          </div>
        )}

        <div className="field">
          <label htmlFor={`${uid}-minQuantity`} className="field-label">
            재고 부족 기준<span className="optional">(선택)</span>
          </label>
          <input
            {...field('minQuantity')}
            className="input num"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="0"
          />
          <p id={`${uid}-minQuantity-hint`} className="field-hint">
            보유수량이 이 값 이하이면 &lsquo;재고 부족&rsquo;으로 표시합니다.
          </p>
          {errorText('minQuantity')}
        </div>
      </div>

      {submitError && (
        <p className="alert" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        className={`btn btn-primary ${styles.submit}`}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? '저장 중…' : submitLabel}
      </button>
    </form>
  );
}
