import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { Spinner } from '@/components/ui/Spinner';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useGroup, useGroupMembers } from '@/hooks/useGroups';
import { useAuthContext } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { CreateTransactionInput } from '@/lib/api';

export default function NewTransactionScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuthContext();
  const { data: group } = useGroup(groupId);
  const { data: members, isLoading: membersLoading } = useGroupMembers(groupId);
  const createTransaction = useCreateTransaction(groupId);

  const handleSubmit = async (values: CreateTransactionInput) => {
    await createTransaction.mutateAsync(values);
    router.back();
  };

  if (membersLoading || !group) {
    return <Spinner fullScreen text="Loading..." />;
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Add Transaction"
        showBack
        rightLabel="Cancel"
        onRightPress={() => router.back()}
      />
      <TransactionForm
        groupId={groupId}
        groupCurrency={group.currency}
        members={members ?? []}
        currentUserId={user?.userId ?? ''}
        onSubmit={handleSubmit}
        submitLabel="Add Transaction"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
