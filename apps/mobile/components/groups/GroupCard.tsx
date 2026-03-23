import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Group } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';

interface GroupCardProps {
  group: Group;
  memberCount?: number;
  onPress: () => void;
}

export function GroupCard({ group, memberCount, onPress }: GroupCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Ionicons name="people" size={22} color={Colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
        {group.description ? (
          <Text style={styles.description} numberOfLines={1}>{group.description}</Text>
        ) : null}
        <View style={styles.meta}>
          <Badge label={group.currency} variant="admin" />
          {memberCount !== undefined ? (
            <Text style={styles.memberCount}>
              <Ionicons name="person-outline" size={11} color={Colors.textMuted} />{' '}
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
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
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
