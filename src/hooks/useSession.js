import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export const SESSION_KEY = ['session'];

/** 관리자 로그인 상태: { user: { id, name, role } | null } */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: ({ signal }) => api.me({ signal }),
    staleTime: 60_000,
    refetchInterval: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: (data) => qc.setQueryData(SESSION_KEY, data),
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.changePassword,
    onSuccess: (data) => qc.setQueryData(SESSION_KEY, data),
  });
}
