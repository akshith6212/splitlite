import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { CreateGroupInput } from '@/lib/api';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];

interface GroupFormProps {
  initialValues?: Partial<CreateGroupInput>;
  onSubmit: (values: CreateGroupInput) => Promise<void>;
  submitLabel?: string;
}

export function GroupForm({ initialValues, onSubmit, submitLabel = 'Create Group' }: GroupFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [currency, setCurrency] = useState(initialValues?.currency ?? 'USD');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; general?: string }>({});

  const validate = () => {
    const newErrors: { name?: string } = {};
    if (!name.trim()) newErrors.name = 'Group name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await onSubmit({ name: name.trim(), currency, description: description.trim() || undefined });
    } catch (err) {
      const e = err as { message?: string };
      setErrors({ general: e.message || 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Input
        label="Group Name"
        placeholder="e.g. Trip to Paris, Apartment"
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoFocus
      />

      <Input
        label="Description (optional)"
        placeholder="What is this group for?"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        style={styles.multilineInput}
      />

      <Text style={styles.label}>Currency</Text>
      <View style={styles.currencyGrid}>
        {CURRENCIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.currencyOption, currency === c && styles.currencySelected]}
            onPress={() => setCurrency(c)}
          >
            <Text style={[styles.currencyText, currency === c && styles.currencyTextSelected]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {errors.general ? (
        <Text style={styles.errorText}>{errors.general}</Text>
      ) : null}

      <Button
        title={submitLabel}
        onPress={handleSubmit}
        loading={loading}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  currencyOption: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  currencySelected: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  currencyTextSelected: {
    color: Colors.primary,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 8,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
});
