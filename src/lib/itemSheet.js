// 품목 일괄 등록: 엑셀/CSV 읽기, 붙여넣기(TSV) 처리, 양식 만들기, 줄별 검사
import { formatNumber, parseIntInput, parseMoneyInput } from './format.js';

export const MAX_ROWS = 500;
const MAX_QTY = 1_000_000;

/**
 * 열 정의 (입력표·양식의 열 순서). 자주 쓰는 품목명·수량·입고단가를 앞에 둔다.
 * aliases는 엑셀 열 제목으로 인정하는 다른 이름, hint는 열 제목 아래 설명
 */
export const COLUMNS = [
  {
    key: 'name',
    label: '품목명',
    required: true,
    width: 26,
    aliases: ['품목', '품명', '이름', 'name'],
  },
  {
    key: 'quantity',
    label: '수량',
    hint: '초기 보유수량',
    width: 10,
    aliases: ['초기 보유수량', '보유수량', '초기수량', '재고', '재고수량', 'quantity', 'qty'],
  },
  {
    key: 'unitCost',
    label: '입고단가',
    required: true,
    width: 12,
    aliases: ['단가', '가격', 'unitcost'],
  },
  { key: 'location', label: '보관 위치', width: 16, aliases: ['위치', '보관장소', 'location'] },
  {
    key: 'supplier',
    label: '구입처',
    width: 16,
    aliases: ['구매처', '거래처', '입고처', 'supplier'],
  },
  {
    key: 'minQuantity',
    label: '재고 부족 기준',
    width: 14,
    aliases: ['부족기준', '최소수량', '안전재고', 'minquantity'],
  },
];

const KEYS = COLUMNS.map((c) => c.key);
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // "품목명(필수)" → "품목명"
    .replace(/[\s_\-*·:]/g, '');

const HEADER_LOOKUP = new Map(
  COLUMNS.flatMap((c) => [c.label, ...c.aliases].map((name) => [norm(name), c.key])),
);

let nextId = 1;
/** 입력표 한 줄. photo는 첨부한 사진 파일(File), photoUrl은 미리보기 주소 */
export function emptyRow(values = {}) {
  const row = { id: nextId++, photo: values.photo ?? null, photoUrl: values.photoUrl ?? null };
  for (const k of KEYS) row[k] = values[k] ?? '';
  return row;
}

export const isBlank = (row) => !row.photo && KEYS.every((k) => String(row[k] ?? '').trim() === '');

/** 중복 품목명 비교 키 (서버와 같은 기준: 앞뒤 공백·대소문자 무시) */
export const dupKey = (s) =>
  String(s ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase();

/** 사진 파일 이름 ↔ 품목명 연결용 키: 모든 공백·대소문자 무시, 맥 파일 이름(NFD 한글)도 같게 */
export const nameKey = (s) =>
  String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '');

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;
export const isImageFile = (file) => file.type.startsWith('image/') || IMAGE_EXT.test(file.name);

/**
 * 여러 장의 사진을 파일 이름으로 줄에 연결한다. (예: 물티슈.jpg → '물티슈' 줄)
 * - 이름이 같은 줄이 있으면 그 줄의 사진으로 (이미 사진이 있으면 바꿈)
 * - 없으면 파일 이름을 품목명으로 새 줄을 만든다
 * - 이미지가 아닌 파일은 건너뛴다
 * makeUrl(file)은 미리보기 주소를 만든다 (브라우저: URL.createObjectURL)
 */
export function attachPhotosByName(rows, files, makeUrl) {
  const next = rows.map((r) => ({ ...r }));
  const byName = new Map();
  next.forEach((r, i) => {
    const k = nameKey(r.name);
    if (k && !byName.has(k)) byName.set(k, i);
  });
  const result = { rows: next, matched: [], added: [], skipped: [], replaced: [] };
  for (const file of files) {
    if (!isImageFile(file)) {
      result.skipped.push(file.name);
      continue;
    }
    const base = file.name.replace(/\.[^.]+$/, '').trim();
    const k = nameKey(base);
    const url = makeUrl(file);
    if (byName.has(k)) {
      const row = next[byName.get(k)];
      if (row.photoUrl) result.replaced.push(row.photoUrl);
      row.photo = file;
      row.photoUrl = url;
      result.matched.push(file.name);
    } else {
      if (next.length >= MAX_ROWS) {
        result.skipped.push(file.name);
        continue;
      }
      // 빈 줄이 있으면 그 줄을 쓰고, 없으면 새 줄
      const blank = next.findIndex((r) => isBlank(r));
      const row = emptyRow({ name: base, photo: file, photoUrl: url });
      if (blank >= 0) next[blank] = row;
      else next.push(row);
      byName.set(k, blank >= 0 ? blank : next.length - 1);
      result.added.push(file.name);
    }
  }
  return result;
}

const cellText = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

/** 열 제목 줄이면 [열 번호 → key] 배열, 아니면 null (품목명 열이 있어야 제목 줄로 인정) */
function headerMap(cells) {
  const map = cells.map((c) => HEADER_LOOKUP.get(norm(c)) ?? null);
  return map.includes('name') ? map : null;
}

/**
 * 표 데이터(2차원 배열) → 입력표 줄 목록.
 * 열 제목 줄을 찾아 열을 맞추고, 빈 줄은 건너뛴다.
 */
export function sheetToRows(data) {
  const headerIndex = data.findIndex((cells) => headerMap(cells.map(cellText)));
  if (headerIndex < 0) {
    throw new Error(
      '열 제목 줄을 찾지 못했습니다. 첫 줄에 품목명, 입고단가 등 열 제목을 넣어 주세요. (양식 내려받기 참고)',
    );
  }
  const map = headerMap(data[headerIndex].map(cellText));
  const rows = [];
  for (const cells of data.slice(headerIndex + 1)) {
    const values = {};
    map.forEach((key, i) => {
      if (key && values[key] === undefined) values[key] = cellText(cells[i]);
    });
    const row = emptyRow(values);
    if (!isBlank(row)) rows.push(row);
  }
  return rows;
}

/** CSV 한 덩어리 → 2차원 배열 (따옴표·줄바꿈 포함 칸 지원) */
function parseCsv(text) {
  const out = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

/** CSV 파일 글자 인코딩: UTF-8이 아니면 엑셀 기본 저장 형식(EUC-KR)으로 읽는다 */
function decodeText(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer); // BOM은 TextDecoder가 제거
  } catch {
    return new TextDecoder('euc-kr').decode(buffer);
  }
}

/** 첨부 파일(.xlsx / .csv) → 입력표 줄 목록 */
export async function readItemFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xls')) {
    throw new Error(
      '엑셀 97-2003 형식(.xls)은 읽을 수 없습니다. 엑셀에서 .xlsx로 저장한 뒤 올려 주세요.',
    );
  }
  if (name.endsWith('.csv')) {
    return sheetToRows(parseCsv(decodeText(await file.arrayBuffer())));
  }
  if (!name.endsWith('.xlsx')) {
    throw new Error('엑셀 파일(.xlsx) 또는 CSV 파일(.csv)만 올릴 수 있습니다.');
  }
  const { readSheet } = await import('read-excel-file/browser');
  let data;
  try {
    data = await readSheet(file);
  } catch {
    throw new Error(
      '엑셀 파일을 읽지 못했습니다. 파일이 손상되지 않았는지, 암호가 걸려 있지 않은지 확인해 주세요.',
    );
  }
  return sheetToRows(data);
}

/** 엑셀에서 복사한 글자(탭으로 칸 구분) → 2차원 배열 */
export function parseTsv(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.map((line) => line.split('\t'));
}

/**
 * 붙여넣은 표를 입력표에 반영한다.
 * - 첫 줄이 열 제목이면 제목에 맞춰 채우고, 아니면 붙여넣은 칸부터 오른쪽으로 채운다.
 */
export function applyPaste(rows, rowIndex, colKey, grid) {
  let map = headerMap(grid[0].map(cellText));
  let body = grid;
  if (map) body = grid.slice(1);
  else {
    const start = KEYS.indexOf(colKey);
    map = grid[0].map((_, i) => KEYS[start + i] ?? null);
  }
  const next = rows.slice();
  body.forEach((cells, r) => {
    const target = rowIndex + r;
    if (target >= MAX_ROWS) return;
    while (next.length <= target) next.push(emptyRow());
    const updated = { ...next[target] };
    map.forEach((key, i) => {
      if (key) updated[key] = cellText(cells[i]);
    });
    next[target] = updated;
  });
  return next;
}

const cleanNumber = (v) => String(v ?? '').replace(/[₩원개\s]/g, '');

/** 줄 하나 검사 → { 칸: 메시지 } */
export function validateRow(row, { existingNames, duplicateNames }) {
  const errors = {};
  const name = row.name.trim();
  const key = dupKey(name);
  if (!name) errors.name = '품목명을 입력해 주세요.';
  else if (name.length > 100) errors.name = '100자 이하로 입력해 주세요.';
  else if (existingNames.has(key)) errors.name = '이미 등록된 품목입니다.';
  else if (duplicateNames.has(key)) errors.name = '목록 안에 같은 이름이 있습니다.';

  if (row.location.trim().length > 100) errors.location = '100자 이하';
  if (row.supplier.trim().length > 100) errors.supplier = '100자 이하';

  const cost = parseMoneyInput(cleanNumber(row.unitCost));
  if (cost === null) errors.unitCost = '입고단가를 입력해 주세요.';
  else if (Number.isNaN(cost)) errors.unitCost = '0 이상, 소수점 2자리까지';

  for (const k of ['quantity', 'minQuantity']) {
    const raw = cleanNumber(row[k]);
    if (raw === '') continue;
    const v = parseIntInput(raw);
    if (Number.isNaN(v)) errors[k] = '0 이상의 정수';
    else if (v > MAX_QTY) errors[k] = `${formatNumber(MAX_QTY)} 이하`;
  }
  return errors;
}

/** 입력표 줄 → API 요청 형식 */
export function toPayload(row) {
  const qty = cleanNumber(row.quantity);
  const min = cleanNumber(row.minQuantity);
  return {
    name: row.name.trim(),
    location: row.location.trim() || null,
    supplier: row.supplier.trim() || null,
    unitCost: parseMoneyInput(cleanNumber(row.unitCost)),
    quantity: qty === '' ? 0 : parseIntInput(qty),
    minQuantity: min === '' ? 0 : parseIntInput(min),
  };
}

/** 엑셀 양식(.xlsx) 내려받기: 열 제목 + 예시 두 줄 */
export async function downloadTemplate() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const header = COLUMNS.map((c) => ({
    value: `${c.label}${c.required ? '(필수)' : c.hint ? `(${c.hint})` : ''}`,
    fontWeight: 'bold',
    backgroundColor: '#E8EEFC',
  }));
  // 예시 줄: 열 순서(COLUMNS)에 맞춰 key로 채운다
  const sample = [
    {
      name: 'A4 복사용지 (500매)',
      quantity: 40,
      unitCost: 4500,
      location: '창고A-선반1',
      supplier: '한국제지 대리점',
      minQuantity: 10,
    },
    {
      name: '볼펜 (검정)',
      quantity: 100,
      unitCost: 350,
      location: '창고A-선반2',
      supplier: '오피스디포',
      minQuantity: 20,
    },
  ].map((row) => COLUMNS.map((c) => ({ value: row[c.key] })));
  await writeXlsxFile([header, ...sample], {
    sheet: '품목',
    columns: COLUMNS.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
  }).toFile('품목_일괄등록_양식.xlsx');
}
