'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useGroups } from '@/hooks/useGroups';
import { GroupCard } from '@/components/groups/GroupCard';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { EmptyState, GroupIcon } from '@/components/ui/EmptyState';

export default function GroupsPage() {
  const router = useRouter();
  const { data: groups, isLoading, error } = useGroups();

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader onCreateClick={() => router.push('/groups/new')} />
        <CenteredSpinner />
      </div>
    );
  }

  const isBackendPending =
    error &&
    ((error as { statusCode?: number }).statusCode === 404 ||
      (error as { statusCode?: number }).statusCode === 501 ||
      (error as { statusCode?: number }).statusCode === 500);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader onCreateClick={() => router.push('/groups/new')} />

      {error && !isBackendPending && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6">
          Failed to load groups. Please try again.
        </div>
      )}

      {isBackendPending && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700 mb-6 flex items-start gap-3">
          <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-medium">Groups feature coming soon</p>
            <p className="mt-0.5 text-amber-600">The Groups API is not yet deployed. Check back later.</p>
          </div>
        </div>
      )}

      {!error && (!groups || groups.length === 0) ? (
        <EmptyState
          icon={<GroupIcon />}
          title="No groups yet"
          description="Create a group to start splitting expenses with friends, family, or coworkers."
          action={{
            label: 'Create your first group',
            onClick: () => router.push('/groups/new'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups?.map((group) => (
            <GroupCard key={group.groupId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeader({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your expense groups</p>
      </div>
      <Button
        variant="primary"
        onClick={onCreateClick}
        leftIcon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        }
      >
        New Group
      </Button>
    </div>
  );
}
