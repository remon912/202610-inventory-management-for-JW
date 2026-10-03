import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}

export function fail(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  res.status(status).json({ ok: false, error });
}

/**
 * 메서드별 핸들러를 묶고 에러를 통일된 형식으로 변환한다.
 * SQL 문이나 스택 트레이스는 응답에 포함하지 않고 서버 로그에만 남긴다.
 */
export function route(handlers) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const fn = handlers[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(handlers).join(', '));
      return fail(res, 405, 'METHOD_NOT_ALLOWED', '허용되지 않는 요청 방식입니다.');
    }
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        return fail(res, err.status, err.code, err.message, err.details);
      }
      if (err instanceof ZodError) {
        const issues = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
        return fail(res, 400, 'VALIDATION_ERROR', issues[0]?.message ?? '입력값을 확인해 주세요.', {
          issues,
        });
      }
      if (err?.code === '22003') {
        return fail(res, 400, 'VALIDATION_ERROR', '허용 범위를 넘는 수량 또는 금액입니다.');
      }
      console.error('[api]', req.method, req.url, err);
      return fail(
        res,
        500,
        'INTERNAL_ERROR',
        '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  };
}
