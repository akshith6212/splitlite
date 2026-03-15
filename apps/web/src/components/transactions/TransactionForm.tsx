'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input, TextArea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  CreateTransactionInput,
  SplitType,
  SplitInput,
  GroupMember,
  Transaction,
} from '@/lib/api';
import { dollarsToCents, centsToDisplayDollars } from '@/utils/format';

interface TransactionFormProps {
  groupId: string;
  groupCurrency: string;
  members: GroupMember[];
  currentUserId: string;
  initialValues?: Transaction;
  onSubmit: (data: CreateTransactionInput) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

const SPLIT_TYPE_OPTIONS = [
  { value: 'EQUAL', label: 'Equal — split evenly among all members' },
  { value: 'EXACT', label: 'Exact — specify exact amount per person' },
  { value: 'PERCENTAGE', label: 'Percentage — specify % per person' },
  { value: 'SHARES', label: 'Shares — specify shares per person' },
];

interface FormErrors {
  description?: string;
  amount?: string;
  paidBy?: string;
  splits?: string;
}

export function TransactionForm({
  groupId,
  groupCurrency,
  members,
  currentUserId,
  initialValues,
  onSubmit,
  isLoading = false,
  submitLabel = 'Add Transaction',
}: TransactionFormProps) {
  const router = useRouter();

  const [description, setDescription] = useState(initialValues?.description || '');
  const [amountDisplay, setAmountDisplay] = useState(
    initialValues ? centsToDisplayDollars(initialValues.amount) : ''
  );
  const [currency, setCurrency] = useState(initialValues?.currency || groupCurrency);
  const [paidBy, setPaidBy] = useState(initialValues?.paidBy || currentUserId);
  const [splitType, setSplitType] = useState<SplitType>(initialValues?.splitType || 'EQUAL');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');

  // Initialize split values when members or splitType changes
  useEffect(() => {
    if (splitType === 'EQUAL') {
      setSplitValues({});
      return;
    }
    const defaults: Record<string, string> = {};
    members.forEach((m) => {
      if (splitType === 'PERCENTAGE') {
        defaults[m.userId] = (100 / members.length).toFixed(2);
      } else if (splitType === 'SHARES') {
        defaults[m.userId] = '1';
      } else if (splitType === 'EXACT') {
        defaults[m.userId] = '';
      }
    });
    setSplitValues(defaults);
  }, [splitType, members]);

  const memberOptions = members.map((m) => ({
    value: m.userId,
    label: m.name || m.email || m.userId,
  }));

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!description.trim()) newErrors.description = 'Description is required';
    const amount = parseFloat(amountDisplay);
    if (!amountDisplay || isNaN(amount) || amount <= 0) {
      newErrors.amount = 'Please enter a valid positive amount';
    }
    if (!paidBy) newErrors.paidBy = 'Please select who paid';

    if (splitType === 'PERCENTAGE') {
      const total = members.reduce(
        (sum, m) => sum + (parseFloat(splitValues[m.userId] || '0') || 0),
        0
      );
      if (Math.abs(total - 100) > 0.01) {
        newErrors.splits = `Percentages must add up to 100% (currently ${total.toFixed(2)}%)`;
      }
    }

    if (splitType === 'EXACT') {
      const totalCents = members.reduce(
        (sum, m) => sum + dollarsToCents(splitValues[m.userId] || '0'),
        0
      );
      const amountCents = dollarsToCents(amountDisplay);
      if (totalCents !== amountCents) {
        newErrors.splits = `Exact amounts must equal the total (${amountDisplay}). Currently: ${(totalCents / 100).toFixed(2)}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function buildSplits(): SplitInput[] {
    if (splitType === 'EQUAL') {
      return members.map((m) => ({ userId: m.userId }));
    }
    return members.map((m) => {
      const val = parseFloat(splitValues[m.userId] || '0') || 0;
      if (splitType === 'EXACT') {
        return { userId: m.userId, amount: dollarsToCents(val) };
      }
      if (splitType === 'PERCENTAGE') {
        return { userId: m.userId, percentage: val };
      }
      if (splitType === 'SHARES') {
        return { userId: m.userId, shares: val };
      }
      return { userId: m.userId };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    try {
      await onSubmit({
        description: description.trim(),
        amount: dollarsToCents(amountDisplay),
        currency,
        paidBy,
        splitType,
        splits: buildSplits(),
        notes: notes.trim() || undefined,
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
        label="Description"
        placeholder="e.g. Dinner at Nobu, Groceries, Uber to airport"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
        required
        maxLength={200}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount"
          type="number"
          placeholder="0.00"
          value={amountDisplay}
          onChange={(e) => setAmountDisplay(e.target.value)}
          error={errors.amount}
          required
          min="0.01"
          step="0.01"
          leftAddon={<span>{currency}</span>}
        />
        <Input
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          placeholder="USD"
          maxLength={3}
        />
      </div>

      <Select
        label="Paid By"
        options={memberOptions.length > 0 ? memberOptions : [{ value: currentUserId, label: 'You' }]}
        value={paidBy}
        onChange={(e) => setPaidBy(e.target.value)}
        error={errors.paidBy}
        required
      />

      <Select
        label="How to Split"
        options={SPLIT_TYPE_OPTIONS}
        value={splitType}
        onChange={(e) => setSplitType(e.target.value as SplitType)}
        required
      />

      {/* Dynamic split inputs */}
      {splitType !== 'EQUAL' && members.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {splitType === 'EXACT' && 'Enter amount per person'}
            {splitType === 'PERCENTAGE' && 'Enter percentage per person'}
            {splitType === 'SHARES' && 'Enter shares per person'}
          </p>
          {errors.splits && (
            <p className="text-sm text-red-600">{errors.splits}</p>
          )}
          <div className="space-y-2 bg-gray-50 rounded-lg p-3">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-indigo-700">
                    {(member.name || member.email || member.userId).charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="flex-1 text-sm text-gray-700 truncate">
                  {member.name || member.email || member.userId.slice(0, 12) + '...'}
                </span>
                <div className="w-28">
                  <Input
                    type="number"
                    placeholder={splitType === 'EXACT' ? '0.00' : splitType === 'PERCENTAGE' ? '0' : '1'}
                    value={splitValues[member.userId] || ''}
                    onChange={(e) =>
                      setSplitValues((prev) => ({
                        ...prev,
                        [member.userId]: e.target.value,
                      }))
                    }
                    min="0"
                    step={splitType === 'EXACT' ? '0.01' : '1'}
                    rightAddon={
                      splitType === 'PERCENTAGE' ? (
                        <span>%</span>
                      ) : splitType === 'SHARES' ? (
                        <span>sh</span>
                      ) : undefined
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {splitType === 'EQUAL' && members.length > 0 && (
        <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-700">
          Split equally among {members.length} member{members.length !== 1 ? 's' : ''}
          {amountDisplay && !isNaN(parseFloat(amountDisplay)) && (
            <span className="font-medium">
              {' '}— {(parseFloat(amountDisplay) / members.length).toFixed(2)} {currency} each
            </span>
          )}
        </div>
      )}

      <TextArea
        label="Notes (optional)"
        placeholder="Any additional details..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={500}
      />

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/groups/${groupId}`)}
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
