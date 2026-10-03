import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { itemKeys } from './useItems.js';

export const movementKeys = {
  byItem: (itemId) => ['movements', String(itemId)],
};

export function useMovements(itemId) {
  return useQuery({
    queryKey: movementKeys.byItem(itemId),
    queryFn: ({ signal }) => api.listMovements(itemId, { signal }),
    enabled: Boolean(itemId),
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createMovement,
    onSuccess: ({ item }) => {
      // 변경된 보유수량을 즉시 반영한 뒤 관련 쿼리를 무효화해 최신화
      qc.setQueryData(itemKeys.detail(item.id), (prev) =>
        prev
          ? { ...prev, quantity: item.quantity, isLow: item.quantity <= prev.minQuantity }
          : prev,
      );
      qc.invalidateQueries({ queryKey: itemKeys.all });
      qc.invalidateQueries({ queryKey: movementKeys.byItem(item.id) });
    },
    onError: (err, input) => {
      if (err.code === 'INSUFFICIENT_STOCK') {
        qc.invalidateQueries({ queryKey: itemKeys.detail(input.itemId) });
      }
    },
  });
}
