import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as authService from '../services/auth.service';
import { getAuthToken, clearAuthToken, SESSION_EXPIRED_EVENT } from '../lib/apiClient';
import type { User } from '../types/user.types';

// Types
export interface AuthUser {
 id: string;
 email: string;
 name: string;
 roleId: string;
 roleName: string;
 roleLevel: string;
 /** Module IDs this role can access; '*' = all. From backend /me. */
 allowedModules?: string[];
 loginTime: string;
}

export interface LoginOutcome {
 success: boolean;
 message: string;
 /** From login response when status is OTP_SENT (may be empty if backend stops echoing). */
 devOtp?: string;
 /** User id for POST /otp/verifyotp */
 otpUserid?: number;
}

interface AuthContextType {
 user: AuthUser | null;
 isAuthenticated: boolean;
 isLoading: boolean;
 login: (email: string, password: string) => Promise<LoginOutcome>;
 verifyOtpLogin: (userid: number, otp: string) => Promise<LoginOutcome>;
 logout: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'eisthetic_auth_user';

function userToAuthUser(u: User): AuthUser {
 return {
  id: u.id,
  email: u.email ?? '',
  name: (u.fullName || u.email || 'User').trim() || 'User',
  roleId: String(u.roleId ?? ''),
  roleName: u.roleName ?? '',
  roleLevel: u.roleLevel ?? '',
  allowedModules: u.allowedModules,
  loginTime: new Date().toISOString(),
 };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
 const [user, setUser] = useState<AuthUser | null>(null);
 const [isLoading, setIsLoading] = useState(true);

 const loadUserFromToken = useCallback(async () => {
  const token = getAuthToken();
  if (!token) {
   setUser(null);
   setIsLoading(false);
   return;
  }
  try {
   const result = await authService.getCurrentUser();
   if (result.success && result.data) {
    const authUser = userToAuthUser(result.data);
    setUser(authUser);
    try {
     localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    } catch {
     // ignore
    }
   } else {
    clearAuthToken();
    setUser(null);
   }
  } catch {
   clearAuthToken();
   setUser(null);
  } finally {
   setIsLoading(false);
  }
 }, []);

 useEffect(() => {
  loadUserFromToken();
 }, [loadUserFromToken]);

 useEffect(() => {
  const onSessionExpired = () => {
   clearAuthToken();
   setUser(null);
   try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
   } catch {
    // ignore
   }
  };
  window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
 }, []);

 const login = async (email: string, password: string): Promise<LoginOutcome> => {
  try {
   const result = await authService.login({
    username: email,
    password,
   });
   if (result.success && result.data && 'needsOtp' in result.data && result.data.needsOtp) {
    return {
     success: false,
     message: 'OTP sent.',
     devOtp: result.data.otp,
     otpUserid: result.data.userid,
    };
   }
   if (result.success && result.data && 'user' in result.data && result.data.user) {
    const authUser = userToAuthUser(result.data.user);
    setUser(authUser);
    try {
     localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    } catch {
     // ignore
    }
    return { success: true, message: 'Login successful!' };
   }
   return {
    success: false,
    message: (result.error as any)?.message ?? (typeof result.error === 'string' ? result.error : 'Invalid email or password. Please try again.'),
   };
  } catch (err) {
   return {
    success: false,
    message: err instanceof Error ? err.message : 'An error occurred during login.',
   };
  }
 };

 const verifyOtpLogin = async (userid: number, otp: string): Promise<LoginOutcome> => {
  try {
   const result = await authService.verifyOtpLogin(userid, otp);
   if (result.success && result.data?.user) {
    const authUser = userToAuthUser(result.data.user);
    setUser(authUser);
    try {
     localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    } catch {
     // ignore
    }
    return { success: true, message: 'Login successful!' };
   }
   return {
    success: false,
    message: (result.error as any)?.message ?? (typeof result.error === 'string' ? result.error : 'Invalid OTP. Please try again.'),
   };
  } catch (err) {
   return {
    success: false,
    message: err instanceof Error ? err.message : 'OTP verification failed.',
   };
  }
 };

 const logout = async () => {
  await authService.logout();
  setUser(null);
  try {
   localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
   // ignore
  }
 };

 const value: AuthContextType = {
  user,
  isAuthenticated: !!user,
  isLoading,
  login,
  verifyOtpLogin,
  logout,
 };

 return (
  <AuthContext.Provider value={value}>
   {children}
  </AuthContext.Provider>
 );
};

export const useAuth = (): AuthContextType => {
 const context = useContext(AuthContext);
 if (context === undefined) {
  throw new Error('useAuth must be used within an AuthProvider');
 }
 return context;
};

export default AuthContext;
