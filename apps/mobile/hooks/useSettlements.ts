import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settlementsApi, Settlement, SettlementStatus } from '@/lib/api';

export const settlementKeys = {
  all: (groupId: string) => ['settlements', groupId] as const,
  filtered: (groupId: string, status?: SettlementStatus) =>
    ['settlements', groupId, status ?? 'ALL'] as const,
  detail: (groupId: string, settlementId: string) =>
    ['settlements', groupId, settlementId] as const,
};

export function useSettlements(groupId: string, status?: SettlementStatus) {
  return useQuery<Settlement[]>({
    queryKey: settlementKeys.filtered(groupId, status),
    queryFn: () => settlementsApi.list(groupId, status),
    enabled: !!groupId,
  });
}

export function useSettlement(groupId: string, settlementId: string) {
  return useQuery<Settlement>({
    queryKey: settlementKeys.detail(groupId, settlementId),
    queryFn: () => settlementsApi.get(groupId, settlementId),
    enabled: !!groupId && !!settlementId,
  });
}

export function useMarkSettlementPaid(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<Settlement, Error, string>({
    mutationFn: (settlementId) => settlementsApi.markAsPaid(groupId, settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settlementKeys.all(groupId) });
    },
  });
}
