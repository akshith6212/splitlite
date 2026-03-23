import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  transactionsApi,
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '@/lib/api';

export const transactionKeys = {
  all: (groupId: string) => ['transactions', groupId] as const,
  detail: (groupId: string, txnId: string) => ['transactions', groupId, txnId] as const,
};

export function useTransactions(groupId: string) {
  return useQuery<Transaction[]>({
    queryKey: transactionKeys.all(groupId),
    queryFn: () => transactionsApi.list(groupId),
    enabled: !!groupId,
  });
}

export function useTransaction(groupId: string, txnId: string) {
  return useQuery<Transaction>({
    queryKey: transactionKeys.detail(groupId, txnId),
    queryFn: () => transactionsApi.get(groupId, txnId),
    enabled: !!groupId && !!txnId,
  });
}

export function useCreateTransaction(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<Transaction, Error, CreateTransactionInput>({
    mutationFn: (input) => transactionsApi.create(groupId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all(groupId) });
    },
  });
}

export function useUpdateTransaction(groupId: string, txnId: string) {
  const queryClient = useQueryClient();
  return useMutation<Transaction, Error, UpdateTransactionInput>({
    mutationFn: (input) => transactionsApi.update(groupId, txnId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(transactionKeys.detail(groupId, txnId), updated);
      queryClient.invalidateQueries({ queryKey: transactionKeys.all(groupId) });
    },
  });
}

export function useDeleteTransaction(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (txnId) => transactionsApi.delete(groupId, txnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all(groupId) });
    },
  });
}
