import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export const itemKeys = {
  all: ['items'],
  list: (filters) => ['items', 'list', filters],
  detail: (id) => ['items', 'detail', String(id)],
  photos: (id) => ['items', 'photos', String(id)],
};

export function useItems(filters = {}) {
  return useQuery({
    queryKey: itemKeys.list(filters),
    queryFn: ({ signal }) => api.listItems(filters, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useItem(id) {
  return useQuery({
    queryKey: itemKeys.detail(id),
    queryFn: ({ signal }) => api.getItem(id, { signal }),
    enabled: Boolean(id),
  });
}

export function useItemPhotos(id) {
  return useQuery({
    queryKey: itemKeys.photos(id),
    queryFn: ({ signal }) => api.listItemPhotos(id, { signal }),
    enabled: Boolean(id),
    refetchInterval: false,
  });
}

/** 품목 사진 등록·변경 (새 사진이 대표 사진이 됨) */
export function useAddItemPhoto(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photo) => api.addItemPhoto(id, photo),
    onSuccess: (photo) => {
      qc.setQueryData(itemKeys.detail(id), (prev) =>
        prev ? { ...prev, photoId: photo.id } : prev,
      );
      qc.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createItem,
    onSuccess: (item) => {
      qc.setQueryData(itemKeys.detail(item.id), item);
      qc.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
}

export function useDeleteItem(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteItem(id),
    onSuccess: (item) => {
      qc.setQueryData(itemKeys.detail(item.id), item);
      qc.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
}

export function useUpdateItem(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.updateItem(id, input),
    onSuccess: (item) => {
      qc.setQueryData(itemKeys.detail(item.id), item);
      qc.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
}
