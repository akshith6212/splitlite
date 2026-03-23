import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Transaction, SplitType } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { formatCurrency, formatRelativeTime } from '@/utils/format';

interface TransactionCardProps {
  transaction: Transaction;
  paidByName?: string;
  onPress?: () => void;
}

const splitTypeBadgeMap: Record<SplitType, 'equal' | 'exact' | 'percentage' | 'shares'> = {
  EQUAL: 'equal',
  EXACT: 'exact',
  PERCENTAGE: 'percentage',
  SHARES: 'shares',
};

export function TransactionCard({ transaction, paidByName, onPress }: TransactionCardProps) {
  const amountFormatted = formatCurrency(transaction.amount, transaction.currency);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.leftColumn}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{transaction.description.charAt(0).toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.description} numberOfLines={1}>{transaction.description}</Text>
        <Text style={styles.paidBy}>
          Paid by {paidByName ?? transaction.paidBy}
        </Text>
        <View style={styles.footer}>
          <Badge
            label={transaction.splitType}
            variant={splitTypeBadgeMap[transaction.splitType]}
          />
          <Text style={styles.date}>{formatRelativeTime(transaction.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.amountContainer}>
        <Text style={styles.amount}>{amountFormatted}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  leftColumn: {
    marginRight: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  description: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  paidBy: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
