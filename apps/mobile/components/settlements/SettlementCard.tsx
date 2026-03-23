import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Settlement } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { formatCurrency, formatDate } from '@/utils/format';

interface SettlementCardProps {
  settlement: Settlement;
  fromName?: string;
  toName?: string;
  currentUserId?: string;
  onMarkPaid?: (settlementId: string) => void;
  isMarkingPaid?: boolean;
}

function UserCircle({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View style={styles.userCircle}>
      <Text style={styles.userInitial}>{initial}</Text>
    </View>
  );
}

export function SettlementCard({
  settlement,
  fromName,
  toName,
  currentUserId,
  onMarkPaid,
  isMarkingPaid,
}: SettlementCardProps) {
  const isPending = settlement.status === 'PENDING';
  const isInvolved =
    currentUserId === settlement.fromUserId || currentUserId === settlement.toUserId;
  const canMarkPaid = isPending && isInvolved && !!onMarkPaid;

  const from = fromName ?? settlement.fromUserId.substring(0, 8);
  const to = toName ?? settlement.toUserId.substring(0, 8);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <UserCircle name={from} />
        <View style={styles.arrowContainer}>
          <Text style={styles.names} numberOfLines={1}>
            {settlement.fromUserId === currentUserId ? 'You' : from}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.textSecondary} />
          <Text style={styles.names} numberOfLines={1}>
            {settlement.toUserId === currentUserId ? 'You' : to}
          </Text>
        </View>
        <UserCircle name={to} />
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.amount}>
            {formatCurrency(settlement.amount, settlement.currency)}
          </Text>
          <Text style={styles.date}>
            {formatDate(settlement.paidAt ?? settlement.calculatedAt)}
          </Text>
        </View>
        <View style={styles.footerRight}>
          <Badge label={settlement.status} variant={isPending ? 'pending' : 'paid'} />
          {canMarkPaid ? (
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => onMarkPaid(settlement.settlementId)}
              disabled={isMarkingPaid}
            >
              {isMarkingPaid ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.payButtonText}>Mark Paid</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  arrowContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 12,
  },
  names: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    maxWidth: 70,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  footerLeft: {
    gap: 2,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  payButton: {
    backgroundColor: Colors.success,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  payButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
