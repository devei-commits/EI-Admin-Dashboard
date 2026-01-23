import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  roleLevel: string;
  loginTime: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

// Storage key
const AUTH_STORAGE_KEY = 'eisthetic_auth_user';

// Super Admin credentials (hardcoded for now, will be extended later)
const SUPER_ADMIN_CREDENTIALS = {
  email: 'superadmin@eisthetic.com',
  password: 'SuperAdmin@123',
  user: {
    id: 'USR_SA001',
    name: 'Super Administrator',
    roleId: 'ROLE001',
    roleName: 'Super Admin',
    roleLevel: 'admin',
  }
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as AuthUser;
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Normalize email for comparison
    const normalizedEmail = email.toLowerCase().trim();

    // Check Super Admin credentials
    if (normalizedEmail === SUPER_ADMIN_CREDENTIALS.email.toLowerCase() && 
        password === SUPER_ADMIN_CREDENTIALS.password) {
      const authUser: AuthUser = {
        ...SUPER_ADMIN_CREDENTIALS.user,
        email: SUPER_ADMIN_CREDENTIALS.email,
        loginTime: new Date().toISOString(),
      };

      // Store in localStorage
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);

      return { success: true, message: 'Login successful!' };
    }

    // TODO: Check other roles from localStorage (role users)
    // This will be implemented when adding more roles

    return { success: false, message: 'Invalid email or password. Please try again.' };
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
