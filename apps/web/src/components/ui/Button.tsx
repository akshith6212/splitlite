'use client';

import React from 'react';
import clsx from 'clsx';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 border-transparent disabled:bg-indigo-300',
  secondary:
    'bg-white text-gray-700 hover:bg-gray-50 focus:ring-indigo-500 border-gray-300 disabled:text-gray-400 disabled:bg-gray-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border-transparent disabled:bg-red-300',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-indigo-500 border-transparent disabled:text-gray-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg border',
        'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {isLoading ? (
        <Spinner size="sm" color={variant === 'secondary' || variant === 'ghost' ? 'gray' : 'white'} />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}
