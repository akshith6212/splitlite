'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  groupsApi,
  Group,
  CreateGroupInput,
  UpdateGroupInput,
  GroupMember,
} from '@/lib/api';

export const groupKeys = {
  all: ['groups'] as const,
  detail: (groupId: string) => ['groups', groupId] as const,
  members: (groupId: string) => ['groups', groupId, 'members'] as const,
};

export function useGroups() {
  return useQuery<Group[]>({
    queryKey: groupKeys.all,
    queryFn: () => groupsApi.list(),
    retry: (failureCount, error) => {
      // Don't retry on 404/501 - backend not implemented yet
      const apiError = error as { statusCode?: number };
      if (apiError?.statusCode === 404 || apiError?.statusCode === 501) return false;
      return failureCount < 2;
    },
  });
}

export function useGroup(groupId: string) {
  return useQuery<Group>({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => groupsApi.get(groupId),
    enabled: !!groupId,
    retry: (failureCount, error) => {
      const apiError = error as { statusCode?: number };
      if (apiError?.statusCode === 404 || apiError?.statusCode === 501) return false;
      return failureCount < 2;
    },
  });
}

export function useGroupMembers(groupId: string) {
  return useQuery<GroupMember[]>({
    queryKey: groupKeys.members(groupId),
    queryFn: () => groupsApi.getMembers(groupId),
    enabled: !!groupId,
    retry: (failureCount, error) => {
      const apiError = error as { statusCode?: number };
      if (apiError?.statusCode === 404 || apiError?.statusCode === 501) return false;
      return failureCount < 2;
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation<Group, Error, CreateGroupInput>({
    mutationFn: (input) => groupsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<Group, Error, UpdateGroupInput>({
    mutationFn: (input) => groupsApi.update(groupId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(groupKeys.detail(groupId), updated);
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (groupId) => groupsApi.delete(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useAddGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<GroupMember, Error, string>({
    mutationFn: (userIdOrEmail) => groupsApi.addMember(groupId, userIdOrEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
    },
  });
}

export function useRemoveGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (userId) => groupsApi.removeMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
    },
  });
}
