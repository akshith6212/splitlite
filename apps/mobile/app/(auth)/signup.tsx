import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '@/context/AuthContext';
import { resendConfirmation } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'register' | 'confirm';

function getCognitoErrorMessage(code: string, message: string): string {
  switch (code) {
    case 'UsernameExistsException':
      return 'An account with this email already exists.';
    case 'InvalidPasswordException':
      return 'Password must be at least 8 characters with uppercase, lowercase, and numbers.';
    case 'InvalidParameterException':
      return 'Please check your email address format.';
    case 'CodeMismatchException':
      return 'Invalid verification code. Please check and try again.';
    case 'ExpiredCodeException':
      return 'This verification code has expired. Please request a new one.';
    case 'TooManyRequestsException':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return message || 'Something went wrong. Please try again.';
  }
}

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { signUp, confirmSignUp } = useAuthContext();

  const [step, setStep] = useState<Step>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, name.trim());
      setStep('confirm');
    } catch (err) {
      const authErr = err as { code?: string; message?: string };
      setError(getCognitoErrorMessage(authErr.code ?? '', authErr.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code.trim()) {
      setError('Please enter the verification code.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await confirmSignUp(email.trim().toLowerCase(), code.trim());
      router.replace('/(auth)/login');
    } catch (err) {
      const authErr = err as { code?: string; message?: string };
      setError(getCognitoErrorMessage(authErr.code ?? '', authErr.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setSuccess('');
    try {
      await resendConfirmation(email.trim().toLowerCase());
      setSuccess('Verification code resent! Check your inbox.');
    } catch (err) {
      const authErr = err as { code?: string; message?: string };
      setError(getCognitoErrorMessage(authErr.code ?? '', authErr.message ?? ''));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="people" size={36} color={Colors.white} />
          </View>
          <Text style={styles.appName}>SplitLite</Text>
        </View>

        {/* Step 1: Registration */}
        {step === 'register' ? (
          <View style={styles.form}>
            <Text style={styles.heading}>Create account</Text>
            <Text style={styles.subheading}>Start splitting expenses with friends</Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Full Name"
              placeholder="Jane Smith"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              leftIcon="person-outline"
            />

            <Input
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
            />

            <Input
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon="lock-closed-outline"
              helper="Use uppercase, lowercase, and numbers"
            />

            <Input
              label="Confirm Password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              leftIcon="lock-closed-outline"
            />

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              size="lg"
              style={styles.mainButton}
            />
          </View>
        ) : (
          /* Step 2: Email Confirmation */
          <View style={styles.form}>
            <View style={styles.emailIconWrapper}>
              <Ionicons name="mail" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.heading}>Check your email</Text>
            <Text style={styles.subheading}>
              We sent a 6-digit verification code to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                <Text style={styles.successBannerText}>{success}</Text>
              </View>
            ) : null}

            <Input
              label="Verification Code"
              placeholder="123456"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              leftIcon="key-outline"
              autoFocus
            />

            <Button
              title="Verify Email"
              onPress={handleConfirm}
              loading={loading}
              size="lg"
              style={styles.mainButton}
            />

            <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendButton}>
              <Text style={styles.resendText}>
                {resending ? 'Sending...' : "Didn't receive it? Resend code"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.footerLink}> Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  emailIconWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.danger,
    fontWeight: '500',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500',
  },
  mainButton: {
    marginTop: 8,
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '700',
  },
});
