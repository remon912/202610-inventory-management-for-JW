import { useId, useRef, useState } from 'react';
import styles from './Combobox.module.css';

/**
 * 목록에 있는 값만 선택할 수 있는 자동완성 입력 (WAI-ARIA combobox 패턴)
 * - 입력하면 options 중 포함 검색 결과를 보여준다.
 * - 목록에 없는 값은 onCreate(텍스트)로 새로 추가해야 선택된다.
 *
 * value: 입력란 텍스트 / onChange(text): 텍스트 변경
 */
export default function Combobox({
  id,
  name,
  value,
  onChange,
  options,
  onCreate,
  creating = false,
  createLabel = (text) => `+ '${text}' 추가`,
  placeholder,
  invalid,
  describedBy,
  maxLength,
  emptyText = '등록된 항목이 없습니다.',
}) {
  const listId = useId();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const text = value.trim();
  const lower = text.toLowerCase();
  const matches = text ? options.filter((o) => o.toLowerCase().includes(lower)) : options;
  const exact = options.some((o) => o === text);
  const canCreate = Boolean(onCreate && text && !exact);

  // 화면에 보이는 선택지: 일치 항목 + (필요 시) 추가 항목
  const entries = [
    ...matches.map((o) => ({ kind: 'option', value: o })),
    ...(canCreate ? [{ kind: 'create', value: text }] : []),
  ];

  const choose = (entry) => {
    if (entry.kind === 'create') {
      onCreate(entry.value);
    } else {
      onChange(entry.value);
    }
    setOpen(false);
    setActive(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (entries.length ? (i + 1) % entries.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (entries.length ? (i <= 0 ? entries.length - 1 : i - 1) : -1));
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && entries[active]) {
        e.preventDefault();
        choose(entries[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  const showList = open && (entries.length > 0 || options.length === 0);
  const optionId = (i) => `${listId}-opt-${i}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <input
          ref={inputRef}
          id={id}
          name={name}
          className="input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {onCreate && (
          <button
            type="button"
            className={`btn btn-secondary ${styles.add}`}
            onClick={() => onCreate(text)}
            disabled={!canCreate || creating}
            aria-label={
              canCreate ? `'${text}' 새로 추가` : '새로 추가 (목록에 없는 이름을 입력하세요)'
            }
          >
            {creating ? '추가 중…' : '+ 추가'}
          </button>
        )}
      </div>

      <ul id={listId} role="listbox" className={styles.list} hidden={!showList}>
        {entries.length === 0 && (
          <li className={styles.empty} role="presentation">
            {emptyText}
          </li>
        )}
        {entries.map((entry, i) => (
          <li
            key={`${entry.kind}-${entry.value}`}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            className={`${styles.option} ${entry.kind === 'create' ? styles.create : ''} ${
              i === active ? styles.active : ''
            }`}
            // blur보다 먼저 선택되도록 mousedown 사용
            onMouseDown={(e) => {
              e.preventDefault();
              choose(entry);
            }}
          >
            {entry.kind === 'create' ? createLabel(entry.value) : entry.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
