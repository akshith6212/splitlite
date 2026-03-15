'use client';

import React, { useState } from 'react';
import { Settlement } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PendingBadge, PaidBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/utils/format';
import { useMarkSettlementAsPaid } from '@/hooks/useSettlements';
import { useAuth } from '@/hooks/useAuth';

interface SettlementCardProps {
  settlement: Settlement;
  groupId: string;
}

function UserAvatar({ userId, name }: { userId: string; name?: string }) {
  const label = name ? name.charAt(0).toUpperCase() : userId.charAt(0).toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-semibold text-indigo-700">{label}</span>
    </div>
  );
}

function shortId(userId: string) {
  return userId.length > 12 ? userId.slice(0, 12) + '...' : userId;
}

export function SettlementCard({ settlement, groupId }: SettlementCardProps) {
  const { user } = useAuth();
  const markAsPaid = useMarkSettlementAsPaid(groupId);
  const [showModal, setShowModal] = useState(false);

  const isInvolved =
    user?.userId === settlement.fromUserId || user?.userId === settlement.toUserId;
  const canMarkPaid = isInvolved && settlement.status === 'PENDING';

  async function handleMarkPaid() {
    await markAsPaid.mutateAsync(settlement.settlementId);
    setShowModal(false);
  }

  return (
    <>
      <Card className="flex items-center gap-4">
        {/* From user */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <UserAvatar userId={settlement.fromUserId} />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">From</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.userId === settlement.fromUserId ? 'You' : shortId(settlement.fromUserId)}
            </p>
          </div>
        </div>

        {/* Arrow + amount */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(settlement.amount, settlement.currency)}
          </span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>

        {/* To user */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-xs text-gray-500">To</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.userId === settlement.toUserId ? 'You' : shortId(settlement.toUserId)}
            </p>
          </div>
          <UserAvatar userId={settlement.toUserId} />
        </div>

        {/* Status + action */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
          {settlement.status === 'PENDING' ? <PendingBadge /> : <PaidBadge />}
          {settlement.status === 'PAID' && settlement.paidAt && (
            <p className="text-xs text-gray-400">{formatDate(settlement.paidAt)}</p>
          )}
          {canMarkPaid && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowModal(true)}
              isLoading={markAsPaid.isPending}
            >
              Mark Paid
            </Button>
          )}
        </div>
      </Card>

      <ConfirmModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleMarkPaid}
        title="Mark as Paid"
        description={`Confirm that ${
          user?.userId === settlement.fromUserId ? 'you have' : `${shortId(settlement.fromUserId)} has`
        } paid ${formatCurrency(settlement.amount, settlement.currency)} to ${
          user?.userId === settlement.toUserId ? 'you' : shortId(settlement.toUserId)
        }.`}
        confirmLabel="Mark as Paid"
        isLoading={markAsPaid.isPending}
      />
    </>
  );
}
