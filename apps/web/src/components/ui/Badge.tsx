import React from 'react';
import clsx from 'clsx';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'pending'
  | 'paid';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Preset badges
export function PendingBadge() {
  return <Badge variant="pending">PENDING</Badge>;
}

export function PaidBadge() {
  return <Badge variant="paid">PAID</Badge>;
}

export function AdminBadge() {
  return <Badge variant="purple">ADMIN</Badge>;
}

export function MemberBadge() {
  return <Badge variant="default">MEMBER</Badge>;
}

export function SplitTypeBadge({ type }: { type: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    EQUAL: 'info',
    EXACT: 'default',
    PERCENTAGE: 'purple',
    SHARES: 'warning',
  };
  return <Badge variant={variantMap[type] || 'default'}>{type}</Badge>;
}
