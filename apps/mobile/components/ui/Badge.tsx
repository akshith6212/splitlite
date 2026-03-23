import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

type BadgeVariant = 'pending' | 'paid' | 'admin' | 'member' | 'equal' | 'exact' | 'percentage' | 'shares' | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: Colors.warning },
  paid: { bg: '#D1FAE5', text: Colors.success },
  admin: { bg: '#EEF2FF', text: Colors.primary },
  member: { bg: '#F3F4F6', text: Colors.textSecondary },
  equal: { bg: '#EEF2FF', text: Colors.primary },
  exact: { bg: '#F0FDF4', text: Colors.success },
  percentage: { bg: '#FFF7ED', text: '#C2410C' },
  shares: { bg: '#F5F3FF', text: '#7C3AED' },
  default: { bg: '#F3F4F6', text: Colors.textSecondary },
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const { bg, text } = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
