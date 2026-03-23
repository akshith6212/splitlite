import React, { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettlements, useMarkSettlementPaid } from '@/hooks/useSettlements';
import { useGroupMembers } from '@/hooks/useGroups';
import { SettlementCard } from '@/components/settlements/SettlementCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/colors';
import { SettlementStatus, Settlement } from '@/lib/api';
import { useAuthContext } from '@/context/AuthContext';

type FilterTab = 'ALL' | SettlementStatus;
const FILTER_TABS: FilterTab[] = ['ALL', 'PENDING', 'PAID'];

export default function SettlementsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const status = filter === 'ALL' ? undefined : filter;
  const { data: settlements, isLoading, isRefetching, refetch } = useSettlements(groupId, status);
  const { data: members } = useGroupMembers(groupId);
  const markPaid = useMarkSettlementPaid(groupId);

  const memberMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    (members ?? []).forEach((m) => {
      map[m.userId] = m.name ?? m.email ?? m.userId.substring(0, 8);
    });
    return map;
  }, [members]);

  const handleMarkPaid = async (settlementId: string) => {
    setMarkingPaidId(settlementId);
    try {
      await markPaid.mutateAsync(settlementId);
    } catch {
      // Error handled silently - could add toast notification here
    } finally {
      setMarkingPaidId(null);
    }
  };

  const renderSettlement = ({ item }: { item: Settlement }) => (
    <SettlementCard
      settlement={item}
      fromName={item.fromUserId === user?.userId ? 'You' : memberMap[item.fromUserId]}
      toName={item.toUserId === user?.userId ? 'You' : memberMap[item.toUserId]}
      currentUserId={user?.userId}
      onMarkPaid={handleMarkPaid}
      isMarkingPaid={markingPaidId === item.settlementId}
    />
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settlements" showBack />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <Spinner fullScreen text="Loading settlements..." />
      ) : (
        <FlatList
          data={settlements ?? []}
          keyExtractor={(item) => item.settlementId}
          renderItem={renderSettlement}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="swap-horizontal-outline"
              title={filter === 'ALL' ? 'No settlements yet' : `No ${filter.toLowerCase()} settlements`}
              description={
                filter === 'ALL'
                  ? 'Settlements are calculated automatically when transactions are added.'
                  : `There are no ${filter.toLowerCase()} settlements at this time.`
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.white,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
});
