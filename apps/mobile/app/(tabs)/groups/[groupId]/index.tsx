import React, { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroup, useGroupMembers } from '@/hooks/useGroups';
import { useTransactions } from '@/hooks/useTransactions';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { formatCurrency } from '@/utils/format';
import { Transaction } from '@/lib/api';
import { useAuthContext } from '@/context/AuthContext';

type Tab = 'transactions' | 'balances';

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<Tab>('transactions');

  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: members } = useGroupMembers(groupId);
  const {
    data: transactions,
    isLoading: txnLoading,
    isRefetching,
    refetch,
  } = useTransactions(groupId);

  const memberMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    (members ?? []).forEach((m) => {
      map[m.userId] = m.name ?? m.email ?? m.userId.substring(0, 8);
    });
    return map;
  }, [members]);

  // Calculate balances per user
  const balances = React.useMemo(() => {
    if (!transactions || !members) return [];
    const net: Record<string, number> = {};
    (members ?? []).forEach((m) => (net[m.userId] = 0));

    transactions.forEach((txn) => {
      // Person who paid gets credit
      if (net[txn.paidBy] !== undefined) {
        net[txn.paidBy] += txn.amount;
      }
      // Each member owes their share (equal split assumed for display)
      const share = Math.round(txn.amount / (members?.length ?? 1));
      (members ?? []).forEach((m) => {
        if (net[m.userId] !== undefined) {
          net[m.userId] -= share;
        }
      });
    });

    return Object.entries(net).map(([userId, balance]) => ({
      userId,
      name: memberMap[userId] ?? userId.substring(0, 8),
      balance,
    }));
  }, [transactions, members, memberMap]);

  if (groupLoading) {
    return <Spinner fullScreen text="Loading group..." />;
  }

  if (!group) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Group not found"
          description="This group doesn't exist or you don't have access to it."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TransactionCard
      transaction={item}
      paidByName={item.paidBy === user?.userId ? 'You' : memberMap[item.paidBy]}
      onPress={() =>
        router.push(`/(tabs)/groups/${groupId}/transactions/${item.txnId}/edit`)
      }
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
          <View style={styles.headerMeta}>
            <Badge label={group.currency} variant="admin" />
            {members ? (
              <Text style={styles.memberCount}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          style={styles.settlementsButton}
          onPress={() => router.push(`/(tabs)/groups/${groupId}/settlements`)}
        >
          <Ionicons name="swap-horizontal" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transactions' && styles.tabActive]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>
            Transactions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
          onPress={() => setActiveTab('balances')}
        >
          <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
            Balances
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'transactions' ? (
        <FlatList
          data={transactions ?? []}
          keyExtractor={(item) => item.txnId}
          renderItem={renderTransaction}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching || txnLoading}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            !txnLoading ? (
              <EmptyState
                icon="receipt-outline"
                title="No transactions yet"
                description="Add a transaction to start splitting expenses with your group."
                actionLabel="Add Transaction"
                onAction={() => router.push(`/(tabs)/groups/${groupId}/transactions/new`)}
              />
            ) : null
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />
          }
        >
          {balances.length === 0 ? (
            <EmptyState
              icon="bar-chart-outline"
              title="No balances"
              description="Add some transactions to see balance information."
            />
          ) : (
            balances.map((b) => (
              <View key={b.userId} style={styles.balanceRow}>
                <View style={styles.balanceAvatar}>
                  <Text style={styles.balanceAvatarText}>
                    {b.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.balanceName}>{b.userId === user?.userId ? 'You' : b.name}</Text>
                <Text
                  style={[
                    styles.balanceAmount,
                    b.balance > 0
                      ? styles.balancePositive
                      : b.balance < 0
                      ? styles.balanceNegative
                      : styles.balanceNeutral,
                  ]}
                >
                  {b.balance > 0 ? '+' : ''}
                  {formatCurrency(b.balance, group.currency)}
                </Text>
              </View>
            ))
          )}

          <TouchableOpacity
            style={styles.viewSettlementsBtn}
            onPress={() => router.push(`/(tabs)/groups/${groupId}/settlements`)}
          >
            <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
            <Text style={styles.viewSettlementsText}>View Settlements</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => router.push(`/(tabs)/groups/${groupId}/transactions/new`)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  memberCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  settlementsButton: {
    padding: 6,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  balanceRow: {
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
  balanceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  balanceAvatarText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  balanceName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  balancePositive: {
    color: Colors.success,
  },
  balanceNegative: {
    color: Colors.danger,
  },
  balanceNeutral: {
    color: Colors.textSecondary,
  },
  viewSettlementsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    gap: 8,
  },
  viewSettlementsText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
