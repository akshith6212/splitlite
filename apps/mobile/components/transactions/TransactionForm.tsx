import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { CreateTransactionInput, GroupMember, SplitInput, SplitType } from '@/lib/api';
import { dollarsToCents, formatCurrency, getCurrencySymbol } from '@/utils/format';

const SPLIT_TYPES: SplitType[] = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'];

interface TransactionFormProps {
  groupId: string;
  groupCurrency: string;
  members: GroupMember[];
  currentUserId: string;
  initialValues?: Partial<CreateTransactionInput & { amountDollars?: string }>;
  onSubmit: (values: CreateTransactionInput) => Promise<void>;
  submitLabel?: string;
}

export function TransactionForm({
  groupCurrency,
  members,
  currentUserId,
  initialValues,
  onSubmit,
  submitLabel = 'Add Transaction',
}: TransactionFormProps) {
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [amountStr, setAmountStr] = useState(
    initialValues?.amount ? (initialValues.amount / 100).toFixed(2) : ''
  );
  const [currency, setCurrency] = useState(initialValues?.currency ?? groupCurrency);
  const [paidBy, setPaidBy] = useState(initialValues?.paidBy ?? currentUserId);
  const [splitType, setSplitType] = useState<SplitType>(initialValues?.splitType ?? 'EQUAL');
  const [splits, setSplits] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize splits when members change or split type changes
  useEffect(() => {
    const initial: Record<string, string> = {};
    members.forEach((m) => {
      initial[m.userId] = '';
    });
    setSplits(initial);
  }, [members, splitType]);

  const buildSplitInputs = (): SplitInput[] => {
    if (splitType === 'EQUAL') {
      return members.map((m) => ({ userId: m.userId }));
    }
    return members.map((m) => {
      const val = parseFloat(splits[m.userId] || '0') || 0;
      if (splitType === 'EXACT') return { userId: m.userId, amount: dollarsToCents(val) };
      if (splitType === 'PERCENTAGE') return { userId: m.userId, percentage: val };
      return { userId: m.userId, shares: val };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!description.trim()) newErrors.description = 'Description is required';
    const amount = parseFloat(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) newErrors.amount = 'Enter a valid amount';
    if (splitType === 'PERCENTAGE') {
      const total = members.reduce((s, m) => s + (parseFloat(splits[m.userId] || '0') || 0), 0);
      if (Math.abs(total - 100) > 0.01) newErrors.splits = `Percentages must total 100% (currently ${total.toFixed(1)}%)`;
    }
    if (splitType === 'EXACT') {
      const amount = parseFloat(amountStr) || 0;
      const total = members.reduce((s, m) => s + (parseFloat(splits[m.userId] || '0') || 0), 0);
      if (Math.abs(total - amount) > 0.01) newErrors.splits = `Exact amounts must total ${getCurrencySymbol(currency)}${amount.toFixed(2)}`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await onSubmit({
        description: description.trim(),
        amount: dollarsToCents(parseFloat(amountStr)),
        currency,
        paidBy,
        splitType,
        splits: buildSplitInputs(),
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      const e = err as { message?: string };
      setErrors({ general: e.message || 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const memberName = (userId: string) =>
    members.find((m) => m.userId === userId)?.name ?? userId.substring(0, 8);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Input
          label="Description"
          placeholder="What was this for?"
          value={description}
          onChangeText={setDescription}
          error={errors.description}
          autoFocus
        />

        <Input
          label={`Amount (${getCurrencySymbol(currency)})`}
          placeholder="0.00"
          value={amountStr}
          onChangeText={setAmountStr}
          keyboardType="decimal-pad"
          error={errors.amount}
        />

        <Text style={styles.label}>Paid By</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {members.map((m) => (
            <TouchableOpacity
              key={m.userId}
              style={[styles.pill, paidBy === m.userId && styles.pillSelected]}
              onPress={() => setPaidBy(m.userId)}
            >
              <Text style={[styles.pillText, paidBy === m.userId && styles.pillTextSelected]}>
                {m.userId === currentUserId ? 'You' : (m.name ?? m.userId.substring(0, 8))}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Split Type</Text>
        <View style={styles.segmented}>
          {SPLIT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.segment, splitType === type && styles.segmentActive]}
              onPress={() => setSplitType(type)}
            >
              <Text style={[styles.segmentText, splitType === type && styles.segmentTextActive]}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {splitType !== 'EQUAL' ? (
          <View style={styles.splitsSection}>
            <Text style={styles.label}>
              {splitType === 'EXACT' ? 'Amounts' : splitType === 'PERCENTAGE' ? 'Percentages' : 'Shares'}
            </Text>
            {members.map((m) => (
              <View key={m.userId} style={styles.splitRow}>
                <View style={styles.memberCircle}>
                  <Text style={styles.memberInitial}>
                    {(m.name ?? m.email ?? 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.userId === currentUserId ? 'You' : memberName(m.userId)}
                </Text>
                <Input
                  placeholder={splitType === 'PERCENTAGE' ? '0' : '0.00'}
                  value={splits[m.userId] ?? ''}
                  onChangeText={(v) => setSplits((prev) => ({ ...prev, [m.userId]: v }))}
                  keyboardType="decimal-pad"
                  style={styles.splitInput}
                />
                <Text style={styles.splitSuffix}>
                  {splitType === 'PERCENTAGE' ? '%' : splitType === 'SHARES' ? 'sh' : getCurrencySymbol(currency)}
                </Text>
              </View>
            ))}
            {errors.splits ? <Text style={styles.errorText}>{errors.splits}</Text> : null}
          </View>
        ) : (
          <View style={styles.equalNote}>
            <Text style={styles.equalNoteText}>
              Split equally among {members.length} members
              {amountStr && parseFloat(amountStr) > 0
                ? ` (${formatCurrency(dollarsToCents(parseFloat(amountStr) / members.length), currency)} each)`
                : ''}
            </Text>
          </View>
        )}

        <Input
          label="Notes (optional)"
          placeholder="Any additional details..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={styles.notesInput}
        />

        {errors.general ? <Text style={styles.errorText}>{errors.general}</Text> : null}

        <Button
          title={submitLabel}
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: 8,
  },
  pillSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pillTextSelected: {
    color: Colors.primary,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: Colors.background,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.white,
  },
  splitsSection: {
    marginBottom: 4,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  memberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  memberName: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  splitInput: {
    width: 90,
    marginBottom: 0,
  },
  splitSuffix: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    width: 20,
  },
  equalNote: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  equalNoteText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 24,
  },
});
