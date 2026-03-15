'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { SplitTypeBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';
import { formatCurrency, formatRelativeTime } from '@/utils/format';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { useAuth } from '@/hooks/useAuth';

interface TransactionCardProps {
  transaction: Transaction;
  groupId: string;
}

export function TransactionCard({ transaction, groupId }: TransactionCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const deleteTransaction = useDeleteTransaction(groupId);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isOwnTransaction = user?.userId === transaction.createdBy;
  const isPaidByMe = user?.userId === transaction.paidBy;

  async function handleDelete() {
    await deleteTransaction.mutateAsync(transaction.txnId);
    setShowDeleteModal(false);
  }

  return (
    <>
      <Card className="flex items-start justify-between gap-4" padding="md">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 truncate">{transaction.description}</p>
              <SplitTypeBadge type={transaction.splitType} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span>
                {isPaidByMe ? 'You paid' : `Paid by ${transaction.paidBy.slice(0, 8)}...`}
              </span>
              <span>{formatRelativeTime(transaction.createdAt)}</span>
            </div>
            {transaction.notes && (
              <p className="text-xs text-gray-400 mt-1 italic line-clamp-1">{transaction.notes}</p>
            )}
          </div>
        </div>

        {/* Right side: amount + actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-gray-900">
            {formatCurrency(transaction.amount, transaction.currency)}
          </span>
          {isOwnTransaction && (
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  router.push(`/groups/${groupId}/transactions/${transaction.txnId}/edit`)
                }
                className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                title="Edit transaction"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete transaction"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </Card>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        description={`Are you sure you want to delete "${transaction.description}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger
        isLoading={deleteTransaction.isPending}
      />
    </>
  );
}
