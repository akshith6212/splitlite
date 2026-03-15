'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, TextArea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CreateGroupInput, Group } from '@/lib/api';

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
  { value: 'SGD', label: 'SGD - Singapore Dollar (S$)' },
  { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
  { value: 'CHF', label: 'CHF - Swiss Franc (Fr)' },
  { value: 'MXN', label: 'MXN - Mexican Peso (MX$)' },
];

interface GroupFormProps {
  initialValues?: Partial<Group>;
  onSubmit: (data: CreateGroupInput) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

interface FormErrors {
  name?: string;
  currency?: string;
}

export function GroupForm({
  initialValues,
  onSubmit,
  isLoading = false,
  submitLabel = 'Create Group',
}: GroupFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [currency, setCurrency] = useState(initialValues?.currency || 'USD');
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = 'Group name is required';
    if (name.trim().length > 100) newErrors.name = 'Group name must be 100 characters or fewer';
    if (!currency) newErrors.currency = 'Currency is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    try {
      await onSubmit({
        name: name.trim(),
        currency,
        description: description.trim() || undefined,
      });
    } catch (err) {
      const error = err as { message?: string };
      setServerError(error.message || 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <Input
        label="Group Name"
        placeholder="e.g. Trip to Paris, Apartment expenses"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
        maxLength={100}
      />

      <TextArea
        label="Description"
        placeholder="Optional: what is this group for?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        maxLength={500}
      />

      <Select
        label="Default Currency"
        options={CURRENCY_OPTIONS}
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        error={errors.currency}
        required
      />

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/groups')}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
