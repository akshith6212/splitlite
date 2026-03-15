'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useGroup, useGroupMembers } from '@/hooks/useGroups';
import { useTransactions } from '@/hooks/useTransactions';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { EmptyState, TransactionIcon, SettlementIcon } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { Transaction, GroupMember } from '@/lib/api';

type Tab = 'transactions' | 'balances' | 'settlements';

export default function GroupDetailPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('transactions');

  const { data: group, isLoading: groupLoading, error: groupError } = useGroup(groupId);
  const { data: members } = useGroupMembers(groupId);
  const { data: transactions, isLoading: txLoading } = useTransactions(groupId);

  if (groupLoading) {
    return (
      <div className="p-6">
        <CenteredSpinner />
      </div>
    );
  }

  if (groupError || !group) {
    const isNotFound = (groupError as { statusCode?: number })?.statusCode === 404;
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/groups')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Groups
        </button>
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {isNotFound
            ? 'Group not found. It may have been deleted or you do not have access.'
            : 'Failed to load group. Please try again.'}
        </div>
      </div>
    );
  }

  const memberCount = members?.length ?? 1;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/groups')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All Groups
      </button>

      {/* Group Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">
                {group.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
              {group.description && (
                <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {group.currency}
                </span>
                <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {(['transactions', 'balances', 'settlements'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors',
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'transactions' && (
        <TransactionsTab
          groupId={groupId}
          transactions={transactions}
          isLoading={txLoading}
          onAddTransaction={() => router.push(`/groups/${groupId}/transactions/new`)}
        />
      )}

      {activeTab === 'balances' && (
        <BalancesTab
          transactions={transactions ?? []}
          members={members ?? []}
          currentUserId={user?.userId ?? ''}
          currency={group.currency}
        />
      )}

      {activeTab === 'settlements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Settlements</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/groups/${groupId}/settlements`)}
            >
              View all settlements
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            View and manage who owes whom in this group.
          </p>
          <Button
            variant="primary"
            onClick={() => router.push(`/groups/${groupId}/settlements`)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            }
          >
            Go to Settlements
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({
  groupId,
  transactions,
  isLoading,
  onAddTransaction,
}: {
  groupId: string;
  transactions?: Transaction[];
  isLoading: boolean;
  onAddTransaction: () => void;
}) {
  if (isLoading) return <CenteredSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">
          Transactions {transactions && transactions.length > 0 && (
            <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {transactions.length}
            </span>
          )}
        </h2>
        <Button
          variant="primary"
          size="sm"
          onClick={onAddTransaction}
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add Transaction
        </Button>
      </div>

      {!transactions || transactions.length === 0 ? (
        <EmptyState
          icon={<TransactionIcon />}
          title="No transactions yet"
          description="Add the first transaction to start tracking expenses in this group."
          action={{ label: 'Add Transaction', onClick: onAddTransaction }}
        />
      ) : (
        <div className="space-y-3">
          {transactions.map((txn) => (
            <TransactionCard key={txn.txnId} transaction={txn} groupId={groupId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Balances Tab ─────────────────────────────────────────────────────────────

interface Balance {
  userId: string;
  name: string;
  net: number; // positive = owed money, negative = owes money
}

function BalancesTab({
  transactions,
  members,
  currentUserId,
  currency,
}: {
  transactions: Transaction[];
  members: GroupMember[];
  currentUserId: string;
  currency: string;
}) {
  // Calculate net balances from transactions
  // For EQUAL split: payer is owed (amount - their share), each non-payer owes their share
  const memberMap = new Map<string, GroupMember>(members.map((m) => [m.userId, m]));
  const balances = new Map<string, number>();

  // Initialize balances for all known members
  members.forEach((m) => balances.set(m.userId, 0));

  transactions.forEach((txn) => {
    const memberCount = members.length || 1;
    if (txn.splitType === 'EQUAL') {
      const sharePerPerson = txn.amount / memberCount;
      // Payer gains share * (n-1)
      const payerBalance = balances.get(txn.paidBy) ?? 0;
      balances.set(txn.paidBy, payerBalance + txn.amount - sharePerPerson);
      // Others owe their share
      members.forEach((m) => {
        if (m.userId !== txn.paidBy) {
          const b = balances.get(m.userId) ?? 0;
          balances.set(m.userId, b - sharePerPerson);
        }
      });
    }
    // For simplicity, other split types just track payer amount
    // Full balance calc requires splits data from API
  });

  const balanceList: Balance[] = Array.from(balances.entries()).map(([userId, net]) => ({
    userId,
    name: memberMap.get(userId)?.name || memberMap.get(userId)?.email || userId,
    net,
  }));

  if (members.length === 0 && transactions.length === 0) {
    return (
      <EmptyState
        icon={<SettlementIcon />}
        title="No balance data yet"
        description="Add transactions to see the balance breakdown here."
      />
    );
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Balances</h2>
      {balanceList.length === 0 ? (
        <EmptyState
          icon={<SettlementIcon />}
          title="All settled up!"
          description="Everyone is even. No outstanding balances."
        />
      ) : (
        <div className="space-y-2">
          {balanceList.map((b) => (
            <div
              key={b.userId}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-indigo-700">
                    {b.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {b.userId === currentUserId ? 'You' : b.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {b.net === 0
                      ? 'Settled up'
                      : b.net > 0
                      ? 'is owed'
                      : 'owes'}
                  </p>
                </div>
              </div>
              <span
                className={clsx(
                  'text-sm font-bold',
                  b.net > 0 ? 'text-green-600' : b.net < 0 ? 'text-red-600' : 'text-gray-400'
                )}
              >
                {b.net === 0 ? 'Even' : formatCurrency(Math.abs(b.net), currency)}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-gray-400">
        * Balances are estimated based on EQUAL splits. For precise balances including exact/percentage splits, check the Settlements tab.
      </p>
    </div>
  );
}
