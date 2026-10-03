import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const KEY = ['usage-places'];

export function useUsagePlaces() {
  return useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => api.listUsagePlaces({ signal }),
    staleTime: 60_000,
  });
}

export function useUpdateUsagePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }) => api.updateUsagePlace(id, name),
    onSuccess: (place) => {
      qc.setQueryData(KEY, (prev = []) =>
        prev
          .map((p) => (p.id === place.id ? place : p))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
      );
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteUsagePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteUsagePlace,
    onSuccess: (place) => {
      qc.setQueryData(KEY, (prev = []) => prev.filter((p) => p.id !== place.id));
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useCreateUsagePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createUsagePlace,
    onSuccess: (place) => {
      qc.setQueryData(KEY, (prev = []) =>
        prev.some((p) => p.id === place.id)
          ? prev
          : [...prev, place].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
      );
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
