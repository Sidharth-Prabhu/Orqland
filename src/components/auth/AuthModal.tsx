'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ArrowRight,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultMode?: 'login' | 'signup';
  canClose?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
  canClose = true,
}) => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    error: authError,
    clearError,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(defaultMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setLocalError(null);
    setSuccessMessage(null);
    clearError();
  };

  const switchMode = (newMode: 'login' | 'signup' | 'forgot') => {
    resetForm();
    setMode(newMode);
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      if (onClose) onClose();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to sign in with Google');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    // Basic Validations
    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      setIsSubmitting(true);
      try {
        await sendPasswordReset(email);
        setSuccessMessage('Password reset link sent to your email. Please check your inbox.');
      } catch (err: unknown) {
        setLocalError(err instanceof Error ? err.message : 'Could not send reset link. Please check your email.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setLocalError('Please enter a password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        if (onClose) onClose();
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, name);
        if (onClose) onClose();
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedError = localError || authError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-[440px] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button if permitted */}
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors z-10"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        )}

        {/* Modal Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          {/* Logo and signature dots */}
          <div className="inline-flex flex-col items-center select-none mb-3">
            <span className="text-3xl font-extrabold tracking-tight text-black font-sans">
              Orqland
            </span>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b22]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffd026]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#10e588]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#1fd5f9]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#9d5cf7]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff2d87]" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'login' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {mode === 'login' && 'Log in to access your business & client messages'}
            {mode === 'signup' && 'Join Orqland to start collaborating seamlessly'}
            {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {/* Navigation Tabs (Sign In / Sign Up) */}
        {mode !== 'forgot' && (
          <div className="px-8 mb-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>
        )}

        <div className="px-8 pb-8 pt-1">
          {/* Alerts */}
          {displayedError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200/80 rounded-xl flex items-start gap-2.5 text-xs text-red-700 leading-relaxed">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{displayedError}</div>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  clearError();
                }}
                className="text-red-400 hover:text-red-700"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200/80 rounded-xl flex items-start gap-2.5 text-xs text-green-700 leading-relaxed">
              <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* Google Auth Button (only for Login & Signup) */}
          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50/80 rounded-xl font-medium text-sm text-gray-800 shadow-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
              >
                {/* Authentic Google Icon */}
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>
                  {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                </span>
              </button>

              {/* Separator */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-gray-400 font-medium">
                    or continue with email
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                />
              </div>
            </div>

            {/* Password Field (Login & Signup) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-black hover:bg-gray-800 text-white rounded-xl font-semibold text-sm shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'login' && 'Sign In'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Send Reset Email'}
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Forgot mode back button */}
          {mode === 'forgot' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs font-bold text-gray-600 hover:text-black transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          )}

          {/* Footer note */}
          <p className="mt-5 text-center text-[11px] text-gray-400">
            By continuing, you agree to Orqland&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};
