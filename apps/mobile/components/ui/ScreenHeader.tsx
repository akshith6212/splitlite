import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  rightLabel?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
}

export function ScreenHeader({ title, showBack = false, rightLabel, rightIcon, onRightPress }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.leftSlot}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.rightSlot}>
        {(rightLabel || rightIcon) && onRightPress ? (
          <TouchableOpacity onPress={onRightPress} style={styles.rightButton}>
            {rightIcon ? (
              <Ionicons name={rightIcon} size={24} color={Colors.primary} />
            ) : (
              <Text style={styles.rightLabel}>{rightLabel}</Text>
            )}
          </TouchableOpacity>
        ) : <View style={styles.spacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  leftSlot: {
    width: 40,
  },
  backButton: {
    padding: 2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rightSlot: {
    width: 40,
    alignItems: 'flex-end',
  },
  rightButton: {
    padding: 2,
  },
  rightLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  spacer: {
    width: 40,
  },
});
