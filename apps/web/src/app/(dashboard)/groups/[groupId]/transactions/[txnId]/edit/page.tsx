'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGroup, useGroupMembers } from '@/hooks/useGroups';
import { useTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { UpdateTransactionInput, CreateTransactionInput } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function EditTransactionPage() {
  const params = useParams<{ groupId: string; txnId: string }>();
  const { groupId, txnId } = params;
  const router = useRouter();
  const { user } = useAuth();

  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: members, isLoading: membersLoading } = useGroupMembers(groupId);
  const { data: transaction, isLoading: txnLoading } = useTransaction(groupId, txnId);
  const updateTransaction = useUpdateTransaction(groupId, txnId);

  if (groupLoading || membersLoading || txnLoading) {
    return (
      <div className="p-6">
        <CenteredSpinner />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Transaction not found.
        </div>
      </div>
    );
  }

  const currency = group?.currency ?? transaction.currency ?? 'USD';
  const resolvedMembers = members ?? [];
  const currentUserId = user?.userId ?? '';

  const effectiveMembers =
    resolvedMembers.length === 0 && currentUserId
      ? [
          {
            groupId,
            userId: currentUserId,
            role: 'MEMBER' as const,
            joinedAt: new Date().toISOString(),
            name: user?.name,
            email: user?.email,
          },
        ]
      : resolvedMembers;

  async function handleSubmit(data: CreateTransactionInput) {
    const updateData: UpdateTransactionInput = {
      description: data.description,
      amount: data.amount,
      paidBy: data.paidBy,
      splitType: data.splitType,
      splits: data.splits,
      notes: data.notes,
    };
    await updateTransaction.mutateAsync(updateData);
    router.push(`/groups/${groupId}`);
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
        <button
          onClick={() => router.push('/groups')}
          className="hover:text-gray-700 transition-colors"
        >
          Groups
        </button>
        <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <button
          onClick={() => router.push(`/groups/${groupId}`)}
          className="hover:text-gray-700 transition-colors"
        >
          {group?.name ?? groupId}
        </button>
        <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium">Edit Transaction</span>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Edit Transaction</h1>
        <p className="text-sm text-gray-500 mb-6">
          Update the details of this expense.
        </p>

        <TransactionForm
          groupId={groupId}
          groupCurrency={currency}
          members={effectiveMembers}
          currentUserId={currentUserId}
          initialValues={transaction}
          onSubmit={handleSubmit}
          isLoading={updateTransaction.isPending}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
