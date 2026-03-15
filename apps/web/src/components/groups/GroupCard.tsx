'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Group } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { formatRelativeTime } from '@/utils/format';

interface GroupCardProps {
  group: Group;
  memberCount?: number;
}

export function GroupCard({ group, memberCount }: GroupCardProps) {
  const router = useRouter();

  return (
    <Card
      hoverable
      onClick={() => router.push(`/groups/${group.groupId}`)}
      className="flex flex-col gap-3"
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 font-bold text-base">
              {group.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 leading-tight">{group.name}</h3>
            {group.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{group.description}</p>
            )}
          </div>
        </div>
        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
          {group.currency}
        </span>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-50">
        {memberCount !== undefined && (
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
        )}
        <span>Updated {formatRelativeTime(group.updatedAt)}</span>
      </div>
    </Card>
  );
}
