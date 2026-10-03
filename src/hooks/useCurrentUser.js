import { createContext, useContext } from 'react';

export const CurrentUserContext = createContext(null);

/** { user, users, usersQuery, setUserId } — user는 선택된 사용자가 목록에 있을 때만 값이 있음 */
export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error('useCurrentUser must be used within UserProvider');
  return ctx;
}
