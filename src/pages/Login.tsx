import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../assets/logo/eilogofull.svg';
import { CardSkeleton } from '../components/ui/Skeleton';

const Login: React.FC = () => {
 const navigate = useNavigate();
 const { login, verifyOtpLogin, isAuthenticated, isLoading: authLoading } = useAuth();
 
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState('');
 /** Set only after password login returns OTP_SENT from the API. */
 const [pendingOtpUserId, setPendingOtpUserId] = useState<number | null>(null);
 /** Echoed by backend in login JSON (may be empty if API stops sending it). */
 const [displayedOtpFromApi, setDisplayedOtpFromApi] = useState('');
 const [otpEntry, setOtpEntry] = useState('');
 const [rememberMe, setRememberMe] = useState(false);

 // Redirect if already authenticated
 useEffect(() => {
  if (isAuthenticated && !authLoading) {
   navigate('/', { replace: true });
  }
 }, [isAuthenticated, authLoading, navigate]);

 // Load remembered email
 useEffect(() => {
  const rememberedEmail = localStorage.getItem('eisthetic_remembered_email');
  if (rememberedEmail) {
   setEmail(rememberedEmail);
   setRememberMe(true);
  }
 }, []);

 const clearOtpStep = () => {
  setPendingOtpUserId(null);
  setDisplayedOtpFromApi('');
  setOtpEntry('');
 };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  const form = e.currentTarget as HTMLFormElement;

  if (pendingOtpUserId != null) {
   const code = otpEntry.trim();
   if (!code) {
    setError('Enter the OTP.');
    return;
   }
   setIsLoading(true);
   try {
    const result = await verifyOtpLogin(pendingOtpUserId, code);
    if (result.success) {
     if (rememberMe) {
      localStorage.setItem('eisthetic_remembered_email', email);
     } else {
      localStorage.removeItem('eisthetic_remembered_email');
     }
     clearOtpStep();
     navigate('/', { replace: true });
    } else {
     setError(result.message);
    }
   } catch (_err) {
    setError('An unexpected error occurred. Please try again.');
   } finally {
    setIsLoading(false);
   }
   return;
  }

  clearOtpStep();
  if (!form.reportValidity()) {
   const firstInvalid = form.querySelector(':invalid');
   if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
   return;
  }

  setIsLoading(true);

  try {
   const result = await login(email, password);

   if (result.success) {
    if (rememberMe) {
     localStorage.setItem('eisthetic_remembered_email', email);
    } else {
     localStorage.removeItem('eisthetic_remembered_email');
    }
    navigate('/', { replace: true });
   } else if (result.otpUserid != null) {
    setPendingOtpUserId(result.otpUserid);
    setDisplayedOtpFromApi(result.devOtp ?? '');
    setOtpEntry('');
    setError('');
   } else {
    clearOtpStep();
    setError(result.message);
   }
  } catch (_err) {
   setError('An unexpected error occurred. Please try again.');
  } finally {
   setIsLoading(false);
  }
 };

 // Show loading state while checking auth
 if (authLoading) {
  return (
   <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4">
    <CardSkeleton className="w-full max-w-md" />
   </div>
  );
 }

 return (
  <div className="min-h-screen flex items-center justify-center bg-surface-2 p-4">
   {/* Background Pattern */}
   <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-40 w-80 h-80 bg-surface-3/30 rounded-full blur-3xl"></div>
    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl"></div>
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-warn-soft/20 rounded-full blur-3xl"></div>
   </div>

   {/* Login Card */}
   <div className="relative w-full max-w-md">
    {/* Card */}
    <div className="bg-surface/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-amber-500/10 border border-white/50 overflow-hidden">
     {/* Header */}
     <div className="bg-ink px-8 py-8 text-center">
      <div className="flex justify-center mb-4">
       <div className="bg-surface rounded-2xl p-3 shadow-lg">
        <img 
         src={Logo} 
         alt="Eisthetic Logo" 
         className="h-12 w-auto"
        />
       </div>
      </div>
      <h1 className="text-2xl font-bold text-white mb-1">Welcome Back</h1>
      <p className="text-gray-100 text-sm">Sign in to your admin dashboard</p>
     </div>

     {/* Form */}
     <form onSubmit={handleSubmit} className="p-8 space-y-5">
      {/* Error Message */}
      {error && (
       <div className="bg-err-soft border border-err rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
        <svg className="w-5 h-5 text-err shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-err">{error}</p>
       </div>
      )}

      {/* Email Field */}
      <div>
       <label htmlFor="email" className="block text-sm font-medium text-ink-2 mb-2">
        Email Address <span className="text-err">*</span>
       </label>
       <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
         <svg className="w-5 h-5 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
         </svg>
        </div>
        <input
         id="email"
         type="email"
         value={email}
         onChange={(e) => setEmail(e.target.value)}
         className="w-full pl-12 pr-4 py-3 bg-surface-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border/50 focus:border-slate-800 transition-all duration-200 text-ink placeholder-ink-4 disabled:opacity-60"
         placeholder="Enter your email"
         autoComplete="email"
         required
         disabled={isLoading || pendingOtpUserId != null}
        />
       </div>
      </div>

      {/* Password Field */}
      <div>
       <label htmlFor="password" className="block text-sm font-medium text-ink-2 mb-2">
        Password <span className="text-err">*</span>
       </label>
       <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
         <svg className="w-5 h-5 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
         </svg>
        </div>
        <input
         id="password"
         type={showPassword ? 'text' : 'password'}
         value={password}
         onChange={(e) => setPassword(e.target.value)}
         className="w-full pl-12 pr-12 py-3 bg-surface-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border/50 focus:border-slate-800 transition-all duration-200 text-ink placeholder-ink-4 disabled:opacity-60"
         placeholder="Enter your password"
         autoComplete="current-password"
         required
         disabled={isLoading || pendingOtpUserId != null}
        />
        <button
         type="button"
         onClick={() => setShowPassword(!showPassword)}
         aria-label={showPassword ? 'Hide password' : 'Show password'}
         className="absolute inset-y-0 right-0 pr-4 flex items-center text-ink-4 hover:text-ink-2 transition-colors disabled:pointer-events-none"
         tabIndex={-1}
         disabled={isLoading || pendingOtpUserId != null}
        >
         {showPassword ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
         ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
         )}
        </button>
       </div>
      </div>

      {pendingOtpUserId != null && displayedOtpFromApi && (
       <div className="bg-warn-soft border border-warn rounded-xl p-4 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
        <p className="text-sm font-medium text-warn">One-time password (from server response)</p>
        <p className="text-2xl font-mono font-semibold tracking-[0.2em] text-warn text-center py-1">{displayedOtpFromApi}</p>
        <p className="text-xs text-warn">Also check your email. Enter the same code below to continue.</p>
       </div>
      )}

      {pendingOtpUserId != null && (
       <div>
        <label htmlFor="otp" className="block text-sm font-medium text-ink-2 mb-2">
         Enter OTP <span className="text-err">*</span>
        </label>
        <input
         id="otp"
         type="text"
         inputMode="numeric"
         autoComplete="one-time-code"
         pattern="[0-9]*"
         maxLength={12}
         value={otpEntry}
         onChange={(e) => setOtpEntry(e.target.value.replace(/\D/g, ''))}
         className="w-full px-4 py-3 bg-surface-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-border/50 focus:border-slate-800 transition-all duration-200 text-ink placeholder-ink-4 text-center text-xl font-mono tracking-widest"
         placeholder="6-digit code"
         required
         disabled={isLoading}
        />
       </div>
      )}

      {pendingOtpUserId != null && (
       <button
        type="button"
        onClick={() => {
         clearOtpStep();
         setError('');
        }}
        className="w-full py-2 text-sm font-medium text-ink-2 hover:text-ink underline-offset-2 hover:underline"
       >
        Use a different account
       </button>
      )}

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between">
       <label className="flex items-center gap-2 cursor-pointer group">
        <div className="relative">
         <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="sr-only peer"
          disabled={isLoading || pendingOtpUserId != null}
         />
         <div className="w-5 h-5 border-2 border-border rounded-md peer-checked:border-slate-800 peer-checked:bg-ink transition-all duration-200 flex items-center justify-center">
          <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
         </div>
        </div>
        <span className="text-sm text-ink-2 group-hover:text-ink transition-colors">Remember me</span>
       </label>
       <button
        type="button"
        className="text-sm text-ink hover:text-ink font-medium transition-colors"
        onClick={() => alert('Please contact your administrator to reset your password.')}
       >
        Forgot password?
       </button>
      </div>

      {/* Fill demo credentials */}
      <button
       type="button"
       onClick={() => {
        setEmail('superadmin@example.com');
        setPassword('SuperAdmin@123');
        setError('');
       }}
       disabled={isLoading || pendingOtpUserId != null}
       className="w-full py-2.5 text-sm font-medium text-ink bg-surface-2 border border-border rounded-xl hover:bg-surface-3 hover:border-warn transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
       Fill demo credentials (Super Admin)
      </button>

      {/* Submit Button */}
      <button
       type="submit"
       disabled={isLoading}
       className="w-full py-3.5 bg-ink hover:bg-ink text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
       {isLoading ? (
        <>
         <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
         <span>{pendingOtpUserId != null ? 'Verifying…' : 'Signing in...'}</span>
        </>
       ) : (
        <>
         <span>{pendingOtpUserId != null ? 'Verify OTP' : 'Sign In'}</span>
         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
         </svg>
        </>
       )}
      </button>
     </form>

     {/* Footer */}
     <div className="px-8 pb-6 text-center">
      <p className="text-xs text-ink-4">
       Protected by enterprise-grade security
      </p>
     </div>
    </div>

    {/* Copyright */}
    <p className="mt-6 text-center text-xs text-ink-4">
     © {new Date().getFullYear()} Eisthetic. All rights reserved.
    </p>
   </div>
  </div>
 );
};

export default Login;
