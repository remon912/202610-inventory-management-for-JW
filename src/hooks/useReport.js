import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useReport(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: ({ signal }) => api.getReport(params, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: false, // 출력 중 화면이 바뀌지 않도록 자동 갱신 끔
  });
}
