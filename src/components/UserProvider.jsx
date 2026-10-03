import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getStoredUserId, setStoredUserId } from '../lib/api.js';
import { CurrentUserContext } from '../hooks/useCurrentUser.js';
import { SESSION_KEY, useSession } from '../hooks/useSession.js';
import { useUsers } from '../hooks/useUsers.js';

/**
 * 현재 사용자
 * - 일반 사용자: 이름만 선택하면 사용 가능
 * - 관리자: 선택한 관리자로 로그인한 세션이 있어야 사용 가능
 */
export default function UserProvider({ children }) {
  const qc = useQueryClient();
  const usersQuery = useUsers();
  const sessionQuery = useSession();
  const [userId, setUserIdState] = useState(getStoredUserId);

  const setUserId = useCallback((id) => {
    setStoredUserId(id);
    setUserIdState(id);
  }, []);

  const clearSession = useCallback(async () => {
    qc.setQueryData(SESSION_KEY, { user: null });
    try {
      await api.logout();
    } catch {
      // 네트워크 오류여도 화면에서는 로그아웃 처리 (쿠키는 12시간 후 만료)
    }
  }, [qc]);

  /** 일반 사용자 선택: 관리자 세션이 남아 있으면 정리한다 */
  const selectMember = useCallback(
    (id) => {
      if (qc.getQueryData(SESSION_KEY)?.user) clearSession();
      setUserId(id);
    },
    [qc, clearSession, setUserId],
  );

  const logout = useCallback(async () => {
    await clearSession();
    setUserId('');
  }, [clearSession, setUserId]);

  const value = useMemo(() => {
    const users = usersQuery.data ?? [];
    const session = sessionQuery.data?.user ?? null;
    const selected = users.find((u) => u.id === userId) ?? null;
    const adminOk = selected?.role === 'admin' && session?.id === selected.id;
    const user = selected && (selected.role !== 'admin' || adminOk) ? selected : null;
    return {
      user,
      selected,
      users,
      usersQuery,
      sessionQuery,
      session,
      isAdmin: user?.role === 'admin',
      setUserId,
      selectMember,
      logout,
    };
  }, [usersQuery, sessionQuery, userId, setUserId, selectMember, logout]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}
