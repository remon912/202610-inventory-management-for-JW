import { z } from 'zod';

const MAX_MONEY = 9999999999999.99; // NUMERIC(15,2)
const MAX_COUNT = 1_000_000;

const money = (label) =>
  z
    .number({ error: `${label}는 숫자여야 합니다.` })
    .min(0, `${label}는 0 이상이어야 합니다.`)
    .max(MAX_MONEY, `${label}가 너무 큽니다.`)
    .refine(
      (v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6,
      `${label}는 소수점 2자리까지 입력할 수 있습니다.`,
    );

/** 빈 문자열은 null로 취급 */
const optionalText = (max, label) =>
  z
    .string({ error: `${label}은(는) 문자열이어야 합니다.` })
    .trim()
    .max(max, `${label}은(는) ${max}자 이하로 입력해 주세요.`)
    .nullish()
    .transform((v) => (v ? v : null));

const requiredText = (max, label) =>
  z
    .string({ error: `${label}을(를) 입력해 주세요.` })
    .trim()
    .min(1, `${label}을(를) 입력해 주세요.`)
    .max(max, `${label}은(는) ${max}자 이하로 입력해 주세요.`);

const count = (label) =>
  z
    .number({ error: `${label}은(는) 숫자여야 합니다.` })
    .int(`${label}은(는) 정수여야 합니다.`)
    .min(0, `${label}은(는) 0 이상이어야 합니다.`)
    .max(MAX_COUNT, `${label}은(는) ${MAX_COUNT.toLocaleString('ko-KR')} 이하여야 합니다.`);

// 사진 (base64 JPEG). 원본은 브라우저에서 긴 변 1280px로 줄여 보낸다.
const MAX_IMAGE_B64 = 3_000_000; // 약 2.2MB
const MAX_THUMB_B64 = 300_000; // 약 220KB
const jpegBase64 = (max, label) =>
  z
    .string({ error: `${label} 데이터가 없습니다.` })
    .max(max, `${label} 용량이 너무 큽니다.`)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, `${label} 형식이 올바르지 않습니다.`)
    .refine((v) => v.startsWith('/9j/'), `${label}은(는) JPEG 형식이어야 합니다.`); // FF D8 FF

const photoObject = z.object(
  {
    image: jpegBase64(MAX_IMAGE_B64, '사진'),
    thumb: jpegBase64(MAX_THUMB_B64, '미리보기 사진'),
  },
  { error: '사진을 선택해 주세요.' },
);

export const photoInput = photoObject.nullish().transform((v) => v ?? null);

/** 품목 사진 등록·변경 (POST /api/items/:id/photos) */
export const photoCreate = z.object({ photo: photoObject });

export const idParam = z.coerce
  .number({ error: '잘못된 ID입니다.' })
  .int('잘못된 ID입니다.')
  .positive('잘못된 ID입니다.');

export const itemListQuery = z.object({
  q: optionalText(100, '검색어'),
  location: optionalText(100, '위치'),
});

export const itemCreate = z.object({
  name: requiredText(100, '품목명'),
  location: optionalText(100, '보관 위치'),
  supplier: optionalText(100, '구입처'),
  unitCost: money('입고단가'),
  quantity: count('초기 보유수량').default(0),
  minQuantity: count('재고 부족 기준').default(0),
  photo: photoInput,
});

/** 품목 일괄 등록 (엑셀 업로드·여러 줄 입력): 최대 500개, 사진 제외 */
export const MAX_BULK_ITEMS = 500;
export const itemBulkCreate = z.object({
  items: z
    .array(itemCreate.omit({ photo: true }), { error: '등록할 품목 목록이 없습니다.' })
    .min(1, '등록할 품목이 없습니다.')
    .max(MAX_BULK_ITEMS, `한 번에 ${MAX_BULK_ITEMS}개까지 등록할 수 있습니다.`),
});

export const itemUpdate = z.strictObject(
  {
    name: requiredText(100, '품목명').optional(),
    location: optionalText(100, '보관 위치'),
    supplier: optionalText(100, '구입처'),
    unitCost: money('입고단가').optional(),
    minQuantity: count('재고 부족 기준').optional(),
  },
  { error: '수정할 수 없는 항목입니다. 보유수량은 입출고로만 변경할 수 있습니다.' },
);

export const movementCreate = z
  .object({
    itemId: idParam,
    delta: z
      .number({ error: '수량은 숫자여야 합니다.' })
      .int('수량은 정수여야 합니다.')
      .refine((v) => v !== 0, '수량은 0일 수 없습니다.')
      .refine(
        (v) => Math.abs(v) <= MAX_COUNT,
        `수량은 ${MAX_COUNT.toLocaleString('ko-KR')} 이하여야 합니다.`,
      ),
    usagePlace: requiredText(100, '사용처'),
    memo: optionalText(500, '내용'),
    unitPrice: money('단가')
      .nullish()
      .transform((v) => v ?? null),
    photo: photoInput,
  })
  .refine((m) => !m.photo || m.delta > 0, {
    message: '사진은 입고할 때만 등록할 수 있습니다.',
    path: ['photo'],
  });

export const usagePlaceCreate = z.object({
  name: requiredText(100, '사용처'),
});

const password = (label) =>
  z
    .string({ error: `${label}를 입력해 주세요.` })
    .min(8, `${label}는 8자 이상이어야 합니다.`)
    .max(200, `${label}는 200자 이하로 입력해 주세요.`);

export const uuidParam = z.string().uuid('잘못된 ID입니다.');

export const userCreate = z
  .object({
    name: requiredText(50, '이름'),
    role: z
      .enum(['admin', 'member'], { error: '권한은 관리자 또는 일반입니다.' })
      .default('member'),
    password: password('비밀번호').optional(),
  })
  .refine((u) => u.role !== 'admin' || u.password, {
    message: '관리자는 비밀번호가 필요합니다.',
    path: ['password'],
  });

export const userUpdate = z
  .strictObject(
    {
      name: requiredText(50, '이름').optional(),
      role: z.enum(['admin', 'member'], { error: '권한은 관리자 또는 일반입니다.' }).optional(),
      password: password('비밀번호').optional(),
    },
    { error: '수정할 수 없는 항목입니다.' },
  )
  .refine((u) => u.name !== undefined || u.role !== undefined || u.password !== undefined, {
    message: '수정할 내용이 없습니다.',
  });

export const usagePlaceUpdate = z.object({
  name: requiredText(100, '사용처'),
});

export const loginInput = z.object({
  userId: uuidParam,
  password: z
    .string({ error: '비밀번호를 입력해 주세요.' })
    .min(1, '비밀번호를 입력해 주세요.')
    .max(200),
});

export const passwordChange = z.object({
  current: z
    .string({ error: '현재 비밀번호를 입력해 주세요.' })
    .min(1, '현재 비밀번호를 입력해 주세요.')
    .max(200),
  next: password('새 비밀번호'),
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateParam = (label) =>
  z
    .string({ error: `${label}을(를) 입력해 주세요.` })
    .regex(DATE_RE, `${label}은(는) YYYY-MM-DD 형식이어야 합니다.`)
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, `${label}이(가) 올바른 날짜가 아닙니다.`);

const emptyToUndefined = (v) => (v === '' || v === null ? undefined : v);
const DAY_MS = 86_400_000;

export const reportQuery = z
  .object({
    from: dateParam('시작일'),
    to: dateParam('종료일'),
    group: z.enum(['day', 'month'], { error: '집계 단위는 일별 또는 월별입니다.' }).default('day'),
    by: z
      .enum(['item', 'place'], { error: '보기 기준은 품목별 또는 사용처별입니다.' })
      .default('item'),
    itemId: z.preprocess(emptyToUndefined, idParam.optional()),
    place: optionalText(100, '사용처'),
    detail: z.preprocess(emptyToUndefined, z.enum(['0', '1']).optional()),
  })
  .refine((q) => q.from <= q.to, { message: '시작일이 종료일보다 늦습니다.', path: ['from'] })
  .refine(
    (q) => {
      const days = (Date.parse(q.to) - Date.parse(q.from)) / DAY_MS + 1;
      return q.group === 'day' ? days <= 366 : days <= 366 * 5;
    },
    { message: '일별은 최대 1년, 월별은 최대 5년까지 조회할 수 있습니다.', path: ['to'] },
  );

export const movementListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
