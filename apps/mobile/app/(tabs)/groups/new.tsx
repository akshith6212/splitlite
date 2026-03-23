import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { GroupForm } from '@/components/groups/GroupForm';
import { useCreateGroup } from '@/hooks/useGroups';
import { Colors } from '@/constants/colors';
import { CreateGroupInput } from '@/lib/api';

export default function NewGroupScreen() {
  const createGroup = useCreateGroup();

  const handleSubmit = async (values: CreateGroupInput) => {
    const group = await createGroup.mutateAsync(values);
    router.replace(`/(tabs)/groups/${group.groupId}`);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="New Group"
        showBack
        rightLabel="Cancel"
        onRightPress={() => router.back()}
      />
      <GroupForm onSubmit={handleSubmit} submitLabel="Create Group" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
