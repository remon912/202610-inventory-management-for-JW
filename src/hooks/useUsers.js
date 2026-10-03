import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const KEY = ['users'];

export function useUsers() {
  return useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => api.listUsers({ signal }),
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
}

/** 사용자 수정 (관리자 전용): { id, input: { name?, role?, password? } } */
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => api.updateUser(id, input),
    onSuccess: (user) => {
      qc.setQueryData(KEY, (prev = []) =>
        prev
          .map((u) => (u.id === user.id ? user : u))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
      );
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['session'] }); // 본인 이름이 바뀌었을 수 있음
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteUser,
    onSuccess: (user) => {
      qc.setQueryData(KEY, (prev = []) => prev.filter((u) => u.id !== user.id));
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

/** input: { name, role, password? } (관리자 전용) */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createUser,
    onSuccess: (user) => {
      qc.setQueryData(KEY, (prev = []) =>
        [...prev, user].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
      );
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
