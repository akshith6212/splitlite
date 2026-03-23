import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useTransaction, useUpdateTransaction, useDeleteTransaction } from '@/hooks/useTransactions';
import { useGroup, useGroupMembers } from '@/hooks/useGroups';
import { useAuthContext } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { UpdateTransactionInput } from '@/lib/api';

export default function EditTransactionScreen() {
  const { groupId, txnId } = useLocalSearchParams<{ groupId: string; txnId: string }>();
  const { user } = useAuthContext();
  const { data: group } = useGroup(groupId);
  const { data: members, isLoading: membersLoading } = useGroupMembers(groupId);
  const { data: transaction, isLoading: txnLoading } = useTransaction(groupId, txnId);
  const updateTransaction = useUpdateTransaction(groupId, txnId);
  const deleteTransaction = useDeleteTransaction(groupId);

  const handleSubmit = async (values: UpdateTransactionInput) => {
    await updateTransaction.mutateAsync(values);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction.mutateAsync(txnId);
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete transaction. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (txnLoading || membersLoading || !group) {
    return <Spinner fullScreen text="Loading transaction..." />;
  }

  if (!transaction) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Edit Transaction" showBack />
        <Spinner fullScreen text="Transaction not found" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Edit Transaction"
        showBack
        rightLabel="Cancel"
        onRightPress={() => router.back()}
      />
      <TransactionForm
        groupId={groupId}
        groupCurrency={group.currency}
        members={members ?? []}
        currentUserId={user?.userId ?? ''}
        initialValues={{
          description: transaction.description,
          amount: transaction.amount,
          currency: transaction.currency,
          paidBy: transaction.paidBy,
          splitType: transaction.splitType,
          notes: transaction.notes,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
      <View style={styles.deleteContainer}>
        <Button
          title="Delete Transaction"
          variant="danger"
          onPress={handleDelete}
          loading={deleteTransaction.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  deleteContainer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
