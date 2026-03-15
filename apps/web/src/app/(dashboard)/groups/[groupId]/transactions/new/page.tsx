'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGroup, useGroupMembers } from '@/hooks/useGroups';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { CreateTransactionInput } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function NewTransactionPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const router = useRouter();
  const { user } = useAuth();

  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: members, isLoading: membersLoading } = useGroupMembers(groupId);
  const createTransaction = useCreateTransaction(groupId);

  if (groupLoading || membersLoading) {
    return (
      <div className="p-6">
        <CenteredSpinner />
      </div>
    );
  }

  // Fallback if group or members API is not yet ready
  const currency = group?.currency ?? 'USD';
  const resolvedMembers = members ?? [];
  const currentUserId = user?.userId ?? '';

  // If no members from API (backend not implemented), create a mock member for the current user
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
    await createTransaction.mutateAsync(data);
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
        <span className="text-gray-900 font-medium">New Transaction</span>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Add a Transaction</h1>
        <p className="text-sm text-gray-500 mb-6">
          Record a new expense and split it among group members.
        </p>

        <TransactionForm
          groupId={groupId}
          groupCurrency={currency}
          members={effectiveMembers}
          currentUserId={currentUserId}
          onSubmit={handleSubmit}
          isLoading={createTransaction.isPending}
          submitLabel="Add Transaction"
        />
      </div>
    </div>
  );
}
