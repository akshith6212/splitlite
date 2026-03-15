'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useGroup } from '@/hooks/useGroups';
import { useSettlements } from '@/hooks/useSettlements';
import { SettlementCard } from '@/components/settlements/SettlementCard';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { EmptyState, SettlementIcon } from '@/components/ui/EmptyState';
import { SettlementStatus } from '@/lib/api';

type Filter = 'ALL' | SettlementStatus;

export default function SettlementsPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');

  const { data: group } = useGroup(groupId);
  const {
    data: settlements,
    isLoading,
    error,
  } = useSettlements(groupId, filter === 'ALL' ? undefined : filter);

  return (
    <div className="p-6 max-w-3xl mx-auto">
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
        <span className="text-gray-900 font-medium">Settlements</span>
      </nav>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settlements</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track who owes whom in {group?.name ?? 'this group'}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {(['ALL', 'PENDING', 'PAID'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors',
              filter === f
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Failed to load settlements. Please try again.
        </div>
      ) : !settlements || settlements.length === 0 ? (
        <EmptyState
          icon={<SettlementIcon />}
          title={
            filter === 'PENDING'
              ? 'No pending settlements'
              : filter === 'PAID'
              ? 'No paid settlements'
              : 'No settlements yet'
          }
          description={
            filter === 'ALL'
              ? 'Settlements are calculated automatically when transactions are added.'
              : `No ${filter.toLowerCase()} settlements found.`
          }
        />
      ) : (
        <div className="space-y-3">
          {settlements.map((settlement) => (
            <SettlementCard
              key={settlement.settlementId}
              settlement={settlement}
              groupId={groupId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
