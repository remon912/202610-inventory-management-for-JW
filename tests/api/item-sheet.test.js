// 일괄 등록 화면의 엑셀/CSV/붙여넣기 처리 (src/lib/itemSheet.js)
import writeXlsxFile from 'write-excel-file/node';
import { readSheet } from 'read-excel-file/node';
import { check, done } from './harness.js';
import {
  applyPaste,
  attachPhotosByName,
  dupKey,
  nameKey,
  emptyRow,
  isBlank,
  parseTsv,
  readItemFile,
  sheetToRows,
  toPayload,
  validateRow,
} from '../../src/lib/itemSheet.js';

// ── 실제 .xlsx: 양식과 같은 열 제목(필수 표시 포함), 숫자 칸, 빈 줄 ──
const header = [
  '품목명(필수)',
  '보관 위치',
  '구입처',
  '입고단가(필수)',
  '초기 보유수량',
  '재고 부족 기준',
];
const buf = await writeXlsxFile([
  header.map((value) => ({ value })),
  ['A4 복사용지', '창고A', '한국제지', 4500, 40, 10].map((value) => ({ value })),
  [null, null, null, null, null, null].map((value) => ({ value })),
  ['볼펜', null, null, 350.5, null, null].map((value) => ({ value })),
]).toBuffer();
let rows = sheetToRows(await readSheet(buf));
check('xlsx: 빈 줄 건너뛰고 2줄', rows.length === 2, rows);
check(
  'xlsx: 열 제목에 맞춰 값이 들어감 (숫자 → 글자)',
  rows[0].name === 'A4 복사용지' &&
    rows[0].supplier === '한국제지' &&
    rows[0].unitCost === '4500' &&
    rows[0].quantity === '40',
  rows[0],
);
check(
  'xlsx: 비어 있는 칸은 빈 글자',
  rows[1].location === '' && rows[1].unitCost === '350.5',
  rows[1],
);

// ── 열 순서가 다르고 이름이 조금 달라도 인식, 위에 제목 줄이 있어도 찾음 ──
rows = sheetToRows([
  ['2026년 10월 품목 목록'],
  ['단가', '품명', '수량', '거래처'],
  [1200, '테이프', 5, '문구사'],
]);
check(
  '다른 이름의 열 제목(품명·단가·수량·거래처) 인식',
  rows.length === 1 &&
    rows[0].name === '테이프' &&
    rows[0].unitCost === '1200' &&
    rows[0].quantity === '5' &&
    rows[0].supplier === '문구사',
  rows,
);
let threw = null;
try {
  sheetToRows([
    ['가', '나'],
    [1, 2],
  ]);
} catch (e) {
  threw = e.message;
}
check('열 제목이 없으면 안내 메시지', threw?.includes('열 제목'), threw);

// ── CSV: 엑셀 기본 저장(EUC-KR) / UTF-8(BOM) / 따옴표 칸 ──
const csvText = '품목명,입고단가,구입처\r\n"물티슈, 대용량",2300,쿠팡\r\n종이컵,"12,000",\r\n';
const utf8Bom = Buffer.from(String.fromCharCode(0xfeff) + csvText, 'utf8'); // UTF-8 + BOM
rows = await readItemFile(new File([utf8Bom], '목록.csv'));
check(
  'CSV(UTF-8+BOM): 따옴표 안 쉼표 유지',
  rows.length === 2 && rows[0].name === '물티슈, 대용량',
  rows,
);
check(
  'CSV: "12,000" 같은 천 단위 쉼표 값',
  rows[1].unitCost === '12,000' && toPayload(rows[1]).unitCost === 12000,
  rows[1],
);

// EUC-KR: '품목명,입고단가\n볼트,100' 을 EUC-KR 바이트로 직접 구성
const euc = new Uint8Array([
  0xc7, 0xb0, 0xb8, 0xf1, 0xb8, 0xed, 0x2c, 0xc0, 0xd4, 0xb0, 0xed, 0xb4, 0xdc, 0xb0, 0xa1, 0x0a,
  0xba, 0xbc, 0xc6, 0xae, 0x2c, 0x31, 0x30, 0x30,
]);
rows = await readItemFile(new File([euc], '엑셀저장.csv'));
check(
  'CSV(EUC-KR, 엑셀 기본 저장 형식) 한글 깨짐 없음',
  rows.length === 1 && rows[0].name === '볼트' && rows[0].unitCost === '100',
  rows,
);

threw = null;
try {
  await readItemFile(new File([new Uint8Array([1])], '옛날.xls'));
} catch (e) {
  threw = e.message;
}
check('.xls는 .xlsx로 저장하라고 안내', threw?.includes('.xlsx'), threw);

// ── 붙여넣기(엑셀에서 복사 = 탭 구분) ──
let table = [emptyRow(), emptyRow()];
table = applyPaste(table, 0, 'name', parseTsv('가위\t5\t1200\r\n풀\t10\t500\r\n칼\t\t\r\n'));
check(
  '붙여넣기: 화면 열 순서(품목명→수량→입고단가)대로, 줄이 모자라면 추가',
  table.length === 3 &&
    table[0].name === '가위' &&
    table[0].quantity === '5' &&
    table[0].unitCost === '1200' &&
    table[2].name === '칼',
  table,
);
table = applyPaste([emptyRow()], 0, 'unitCost', parseTsv('500\t창고B'));
check(
  '붙여넣기: 입고단가 칸부터 → 단가·보관 위치',
  table[0].unitCost === '500' && table[0].location === '창고B' && table[0].name === '',
  table[0],
);
table = applyPaste([emptyRow()], 0, 'quantity', parseTsv('수량(초기 보유수량)\t품목명\n7\t집게'));
check(
  '붙여넣기: "수량(초기 보유수량)" 열 제목도 수량으로 인식',
  table[0].quantity === '7' && table[0].name === '집게',
  table[0],
);
table = applyPaste([emptyRow()], 0, 'location', parseTsv('입고단가\t품목명\n700\t자'));
check(
  '붙여넣기: 첫 줄이 열 제목이면 제목에 맞춤',
  table[0].name === '자' && table[0].unitCost === '700',
  table[0],
);

// ── 줄 검사 ──
const ctx = { existingNames: new Set(['볼펜']), duplicateNames: new Set(['가위']) };
const v = (values) => validateRow(emptyRow(values), ctx);
check(
  '품목명·단가 빈칸 → 오류',
  v({ location: 'x' }).name && v({ location: 'x' }).unitCost,
  v({ location: 'x' }),
);
check(
  '이미 있는 품목 → 오류',
  v({ name: ' 볼펜 ', unitCost: '1' }).name === '이미 등록된 품목입니다.',
  v({ name: '볼펜', unitCost: '1' }),
);
check(
  '목록 안 중복 → 오류',
  v({ name: '가위', unitCost: '1' }).name?.includes('같은 이름'),
  v({ name: '가위', unitCost: '1' }),
);
check(
  '단가 "4,500원" 허용',
  !v({ name: 'a', unitCost: '4,500원' }).unitCost,
  v({ name: 'a', unitCost: '4,500원' }),
);
check('단가 소수 3자리 → 오류', v({ name: 'a', unitCost: '1.234' }).unitCost, null);
check(
  '수량 "10개" 허용, "1.5" 오류',
  !v({ name: 'a', unitCost: '1', quantity: '10개' }).quantity &&
    v({ name: 'a', unitCost: '1', quantity: '1.5' }).quantity,
  null,
);
check(
  'toPayload: 빈 값 기본값 처리',
  JSON.stringify(
    toPayload(emptyRow({ name: ' 자 ', unitCost: '1,000', quantity: '', supplier: ' ' })),
  ) ===
    JSON.stringify({
      name: '자',
      location: null,
      supplier: null,
      unitCost: 1000,
      quantity: 0,
      minQuantity: 0,
    }),
  toPayload(emptyRow({ name: ' 자 ', unitCost: '1,000' })),
);
check(
  '빈 줄 판별',
  isBlank(emptyRow({ name: '  ' })) && !isBlank(emptyRow({ quantity: '1' })),
  null,
);

// ── 사진 여러 장: 파일 이름 = 품목명으로 연결 ──
const img = (name, type = 'image/jpeg') =>
  new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type });
let urlNo = 0;
const makeUrl = () => `blob:test/${++urlNo}`;
const base = [
  emptyRow({ name: '물티슈', unitCost: '2300' }),
  emptyRow({ name: 'A4 용지', unitCost: '1' }),
  emptyRow(),
];
let res = attachPhotosByName(
  base,
  [
    img('물티슈.jpg'),
    img('a4용지.JPG'),
    img('볼트.png'),
    img('메모.txt', 'text/plain'),
    img('사진.heic', ''),
  ],
  makeUrl,
);
check(
  '같은 이름 줄에 연결 (대소문자·공백 무시)',
  res.rows[0].photo?.name === '물티슈.jpg' && res.rows[1].photo?.name === 'a4용지.JPG',
  res.rows.map((r) => r.photo?.name),
);
check(
  '이름이 없는 사진은 빈 줄을 먼저 사용해 새 줄로',
  res.rows[2].name === '볼트' && res.rows[2].photo?.name === '볼트.png',
  res.rows[2],
);
check(
  '확장자만 있는 heic(형식 정보 없음)도 사진으로 인정 → 새 줄',
  res.rows.some((r) => r.name === '사진'),
  res.rows.map((r) => r.name),
);
check('이미지가 아닌 파일은 건너뜀', res.skipped.join() === '메모.txt', res.skipped);
check('결과 요약 (연결 2, 추가 2)', res.matched.length === 2 && res.added.length === 2, res);
check('원래 줄 배열은 바꾸지 않음', base[0].photo === null, base[0]);
res = attachPhotosByName(res.rows, [img('물티슈.webp')], makeUrl);
check(
  '같은 품목에 다시 첨부하면 바꾸고, 예전 미리보기 주소를 정리 대상으로 돌려줌',
  res.rows[0].photo.name === '물티슈.webp' && res.replaced.length === 1,
  res.replaced,
);
const nfd = '물티슈'.normalize('NFD');
check(
  '맥에서 만든 파일 이름(NFD 한글)도 연결',
  nameKey(nfd) === nameKey('물티슈') &&
    attachPhotosByName([emptyRow({ name: '물티슈' })], [img(nfd + '.jpg')], makeUrl).matched
      .length === 1,
  null,
);
check(
  '사진만 있는 줄은 빈 줄이 아님 (품목명 입력 필요)',
  !isBlank(emptyRow({ photo: img('x.jpg') })),
  null,
);
check(
  '중복 검사 키는 서버와 같은 기준 (가운데 공백은 구분)',
  dupKey(' A4 용지 ') === 'a4 용지' && dupKey('A4용지') !== dupKey('A4 용지'),
  null,
);

done();
