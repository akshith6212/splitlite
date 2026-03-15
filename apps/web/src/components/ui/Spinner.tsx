import React from 'react';
import clsx from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'gray' | 'indigo';
  className?: string;
}

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

const colorStyles = {
  white: 'text-white',
  gray: 'text-gray-400',
  indigo: 'text-indigo-600',
};

export function Spinner({ size = 'md', color = 'indigo', className }: SpinnerProps) {
  return (
    <svg
      className={clsx('animate-spin', sizeStyles[size], colorStyles[color], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <Spinner size="lg" color="indigo" />
        <p className="mt-3 text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

export function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner size="lg" color="indigo" />
    </div>
  );
}
