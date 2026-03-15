'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Step = 'register' | 'confirm';

export default function SignupPage() {
  const router = useRouter();
  const { signUp, confirmSignUp } = useAuth();

  const [step, setStep] = useState<Step>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    code?: string;
  }>({});

  function validateRegister(): boolean {
    const newErrors: typeof fieldErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Please enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateConfirm(): boolean {
    const newErrors: typeof fieldErrors = {};
    if (!code.trim()) newErrors.code = 'Verification code is required';
    else if (!/^\d{6}$/.test(code.trim())) newErrors.code = 'Code must be 6 digits';
    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validateRegister()) return;

    setIsLoading(true);
    try {
      await signUp(email, password, name);
      setStep('confirm');
    } catch (err) {
      const authErr = err as { message?: string; code?: string };
      if (authErr.code === 'UsernameExistsException') {
        setError('An account with this email already exists.');
      } else if (authErr.code === 'InvalidPasswordException') {
        setError('Password does not meet requirements. Use at least 8 characters with numbers and symbols.');
      } else {
        setError(authErr.message || 'Sign up failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validateConfirm()) return;

    setIsLoading(true);
    try {
      await confirmSignUp(email, code.trim());
      router.push('/login');
    } catch (err) {
      const authErr = err as { message?: string; code?: string };
      if (authErr.code === 'CodeMismatchException') {
        setError('Invalid verification code. Please check and try again.');
      } else if (authErr.code === 'ExpiredCodeException') {
        setError('Verification code has expired. Please request a new one.');
      } else {
        setError(authErr.message || 'Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (step === 'confirm') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-green-100 mb-3">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-500 mt-1">
            We sent a 6-digit verification code to{' '}
            <span className="font-medium text-gray-700">{email}</span>
          </p>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Input
            label="Verification Code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={fieldErrors.code}
            maxLength={6}
            autoComplete="one-time-code"
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            size="lg"
            isLoading={isLoading}
          >
            Verify Email
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setStep('register')}
          >
            Back to sign up
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Already verified?{' '}
          <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create your account</h2>

      <form onSubmit={handleRegister} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Full Name"
          type="text"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          autoComplete="name"
          required
        />

        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          helperText="At least 8 characters"
          autoComplete="new-password"
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          size="lg"
          isLoading={isLoading}
        >
          Create Account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
