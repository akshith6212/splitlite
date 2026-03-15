'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { GroupForm } from '@/components/groups/GroupForm';
import { useCreateGroup } from '@/hooks/useGroups';
import { CreateGroupInput } from '@/lib/api';

export default function NewGroupPage() {
  const router = useRouter();
  const createGroup = useCreateGroup();

  async function handleSubmit(data: CreateGroupInput) {
    const group = await createGroup.mutateAsync(data);
    router.push(`/groups/${group.groupId}`);
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <button
          onClick={() => router.push('/groups')}
          className="hover:text-gray-700 transition-colors"
        >
          Groups
        </button>
        <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium">New Group</span>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Create a new group</h1>
        <p className="text-sm text-gray-500 mb-6">
          Set up a group to start splitting expenses with others.
        </p>

        <GroupForm
          onSubmit={handleSubmit}
          isLoading={createGroup.isPending}
          submitLabel="Create Group"
        />
      </div>
    </div>
  );
}
