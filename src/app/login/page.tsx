'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  Building2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    error: authError,
    clearError,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is already authenticated, redirect immediately to root page
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

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
      router.replace('/');
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      setIsSubmitting(true);
      try {
        await sendPasswordReset(email);
        setSuccessMessage('Password reset instructions sent to your email. Please check your inbox.');
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
        router.replace('/');
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, name);
        router.replace('/');
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  const displayedError = localError || authError;

  // Show clean spinner while Firebase checks existing session
  if (authLoading || user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-extrabold tracking-tight text-black font-sans">
            Orqland
          </span>
          <div className="flex items-center gap-1.5 mt-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b22] animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffd026] animate-bounce [animation-delay:-0.2s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#10e588] animate-bounce [animation-delay:-0.1s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#1fd5f9] animate-bounce" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#9d5cf7] animate-bounce [animation-delay:0.1s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff2d87] animate-bounce [animation-delay:0.2s]" />
          </div>
          <p className="text-xs font-semibold text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-[#f8f9fb] px-4 py-8 relative overflow-y-auto">
      {/* Background Decorative Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-64 bg-gradient-to-b from-blue-50/60 to-transparent pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-gray-100/90 overflow-hidden p-8 sm:p-10 my-auto">
        {/* Brand Header */}
        <div className="text-center mb-6">
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

          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {mode === 'login' && 'Enter your credentials to access your conversations'}
            {mode === 'signup' && 'Get started with Orqland business and client messaging'}
            {mode === 'forgot' && 'Enter your registered email to receive a password reset link'}
          </p>
        </div>

        {/* Mode Selector Tabs (Sign In / Sign Up) */}
        {mode !== 'forgot' && (
          <div className="mb-6">
            <div className="flex bg-[#f1f3f5] p-1 rounded-2xl border border-gray-200/50">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* Alerts */}
        {displayedError && (
          <div className="mb-5 p-3.5 bg-red-50/90 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 leading-relaxed">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{displayedError}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3.5 bg-green-50/90 border border-green-200 rounded-xl flex items-start gap-2.5 text-xs text-green-700 leading-relaxed">
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{successMessage}</div>
          </div>
        )}

        {/* Google Authentication Button */}
        {mode !== 'forgot' && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50/80 rounded-2xl font-semibold text-sm text-gray-800 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
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
            <div className="relative my-5">
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

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name (Sign Up only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <UserIcon
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#fbfbfb] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#fbfbfb] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
              />
            </div>
          </div>

          {/* Password (Login & Signup) */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#fbfbfb] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#fbfbfb] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 bg-black hover:bg-gray-800 text-white rounded-2xl font-bold text-sm shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Please wait...</span>
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
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-xs font-bold text-gray-600 hover:text-black transition-colors cursor-pointer"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center">
            <ShieldCheck size={16} className="text-blue-600 mb-1" />
            <span className="text-[10px] font-semibold text-gray-500">Secure Auth</span>
          </div>
          <div className="flex flex-col items-center">
            <MessageSquare size={16} className="text-green-600 mb-1" />
            <span className="text-[10px] font-semibold text-gray-500">Real-time Chat</span>
          </div>
          <div className="flex flex-col items-center">
            <Building2 size={16} className="text-purple-600 mb-1" />
            <span className="text-[10px] font-semibold text-gray-500">Workspaces</span>
          </div>
        </div>
      </div>
    </div>
  );
}

