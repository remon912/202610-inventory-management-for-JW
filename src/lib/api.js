// 모든 API 호출은 이 파일을 경유한다. 응답 형식: { ok, data } / { ok: false, error: { code, message } }

const USER_KEY = 'inventory.userId';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getStoredUserId() {
  try {
    return localStorage.getItem(USER_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredUserId(id) {
  try {
    if (id) localStorage.setItem(USER_KEY, id);
    else localStorage.removeItem(USER_KEY);
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 세션 동안만 유지
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const userId = getStoredUserId();
  if (userId) headers['X-User-Id'] = userId;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.');
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // JSON이 아닌 응답 (프록시 오류 등)
  }

  if (!res.ok || !payload?.ok) {
    const e = payload?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'INTERNAL_ERROR',
      e?.message ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      e?.details,
    );
  }
  return payload.data;
}

function query(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** 사진 주소. size='thumb'이면 미리보기 */
export const photoUrl = (id, size) => `/api/photos/${id}${size === 'thumb' ? '?size=thumb' : ''}`;

export const api = {
  listItems: ({ q, location } = {}, opts) => request(`/items${query({ q, location })}`, opts),
  getItem: (id, opts) => request(`/items/${id}`, opts),
  createItem: (input) => request('/items', { method: 'POST', body: input }),
  bulkCreateItems: (items) => request('/items/bulk', { method: 'POST', body: { items } }),
  updateItem: (id, input) => request(`/items/${id}`, { method: 'PATCH', body: input }),
  listMovements: (itemId, opts) => request(`/items/${itemId}/movements`, opts),
  listItemPhotos: (itemId, opts) => request(`/items/${itemId}/photos`, opts),
  deletePhoto: (id) => request(`/photos/${id}`, { method: 'DELETE' }),
  addItemPhoto: (itemId, photo) =>
    request(`/items/${itemId}/photos`, { method: 'POST', body: { photo } }),
  createMovement: (input) => request('/movements', { method: 'POST', body: input }),
  listUsers: (opts) => request('/users', opts),
  createUser: (input) => request('/users', { method: 'POST', body: input }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  updateUser: (id, input) => request(`/users/${id}`, { method: 'PATCH', body: input }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  me: (opts) => request('/auth/me', opts),
  login: (input) => request('/auth/login', { method: 'POST', body: input }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (input) => request('/auth/password', { method: 'POST', body: input }),
  getReport: (params, opts) => request(`/reports${query(params)}`, opts),
  listUsagePlaces: (opts) => request('/usage-places', opts),
  createUsagePlace: (name) => request('/usage-places', { method: 'POST', body: { name } }),
  deleteUsagePlace: (id) => request(`/usage-places/${id}`, { method: 'DELETE' }),
  updateUsagePlace: (id, name) =>
    request(`/usage-places/${id}`, { method: 'PATCH', body: { name } }),
};
