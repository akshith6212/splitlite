import React, { useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroups } from '@/hooks/useGroups';
import { GroupCard } from '@/components/groups/GroupCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Colors } from '@/constants/colors';
import { Group } from '@/lib/api';

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const { data: groups, isLoading, isRefetching, error, refetch } = useGroups();

  const isBackendPending =
    error && ((error as { statusCode?: number }).statusCode === 404 || (error as { statusCode?: number }).statusCode === 501);

  const handleGroupPress = useCallback((groupId: string) => {
    router.push(`/(tabs)/groups/${groupId}`);
  }, []);

  const renderGroup = useCallback(
    ({ item }: { item: Group }) => (
      <GroupCard
        group={item}
        onPress={() => handleGroupPress(item.groupId)}
      />
    ),
    [handleGroupPress]
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.headerTitle}>Groups</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/(tabs)/groups/new')}
      >
        <Ionicons name="add" size={24} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <Spinner fullScreen text="Loading groups..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {isBackendPending ? (
        <View style={styles.banner}>
          <Ionicons name="construct-outline" size={16} color={Colors.warning} />
          <Text style={styles.bannerText}>
            Groups feature is coming soon. Create a group to get started!
          </Text>
        </View>
      ) : null}

      <FlatList
        data={groups ?? []}
        keyExtractor={(item) => item.groupId}
        renderItem={renderGroup}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="people-outline"
              title="No groups yet"
              description="Create a group to start splitting expenses with friends and family."
              actionLabel="Create Group"
              onAction={() => router.push('/(tabs)/groups/new')}
            />
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 90 }]}
        onPress={() => router.push('/(tabs)/groups/new')}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
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
