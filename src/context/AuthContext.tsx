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

interface UserCredential {
  id: string;
  email: string;
  password: string;
  name: string;
  roleId: string;
  roleName: string;
  roleLevel: string;
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
const USERS_STORAGE_KEY = 'eisthetic_system_users';

// Default users with credentials for each role
// Common password: Eisthetic@123 for all users
const DEFAULT_SYSTEM_USERS: UserCredential[] = [
  // Admin Users
  {
    id: 'USR_SA001',
    email: 'superadmin@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'Super Administrator',
    roleId: 'ROLE001',
    roleName: 'Super Admin',
    roleLevel: 'admin',
  },
  {
    id: 'USR_AD001',
    email: 'admin@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'Administrator',
    roleId: 'ROLE002',
    roleName: 'Admin',
    roleLevel: 'admin',
  },
  // Manager Users
  {
    id: 'USR_BD001',
    email: 'bdmanager@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'BD Manager',
    roleId: 'ROLE003',
    roleName: 'BD Manager',
    roleLevel: 'manager',
  },
  {
    id: 'USR_QA001',
    email: 'qamanager@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'QA Manager',
    roleId: 'ROLE004',
    roleName: 'QA Manager',
    roleLevel: 'manager',
  },
  {
    id: 'USR_RD001',
    email: 'rdlead@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'R&D Lead',
    roleId: 'ROLE005',
    roleName: 'R&D Lead',
    roleLevel: 'manager',
  },
  // Staff Users
  {
    id: 'USR_PROC001',
    email: 'procurement@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'Procurement Officer',
    roleId: 'ROLE006',
    roleName: 'Procurement',
    roleLevel: 'staff',
  },
  {
    id: 'USR_MFG001',
    email: 'manufacturing@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'Manufacturing Lead',
    roleId: 'ROLE007',
    roleName: 'Manufacturing and Production',
    roleLevel: 'staff',
  },
  {
    id: 'USR_SALES001',
    email: 'sales@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'Sales Executive',
    roleId: 'ROLE008',
    roleName: 'Sales',
    roleLevel: 'staff',
  },
  {
    id: 'USR_LOG001',
    email: 'logistics@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'Logistics Officer',
    roleId: 'ROLE009',
    roleName: 'Logistics',
    roleLevel: 'staff',
  },
  {
    id: 'USR_DESIGN001',
    email: 'design@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'Design Specialist',
    roleId: 'ROLE010',
    roleName: 'Design',
    roleLevel: 'staff',
  },
  {
    id: 'USR_RDS001',
    email: 'rdstaff@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'R&D Scientist',
    roleId: 'ROLE011',
    roleName: 'R&D Staff',
    roleLevel: 'staff',
  },
  {
    id: 'USR_QAS001',
    email: 'qastaff@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'QA Tester',
    roleId: 'ROLE012',
    roleName: 'QA Staff',
    roleLevel: 'staff',
  },
  {
    id: 'USR_BDS001',
    email: 'bdstaff@eisthetic.com',
    password: 'Eisthetic@123',
    name: 'BD Associate',
    roleId: 'ROLE013',
    roleName: 'BD Staff',
    roleLevel: 'staff',
  },
];

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize default users in localStorage if not present
const initializeDefaultUsers = () => {
  try {
    const existingUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (!existingUsers) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_SYSTEM_USERS));
    }
  } catch (error) {
    console.error('Error initializing users:', error);
  }
};

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize users on provider mount
  useEffect(() => {
    initializeDefaultUsers();
  }, []);

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

    // Get all system users from storage
    try {
      const usersData = localStorage.getItem(USERS_STORAGE_KEY);
      const users: UserCredential[] = usersData ? JSON.parse(usersData) : DEFAULT_SYSTEM_USERS;

      // Find user with matching email and password
      const foundUser = users.find(
        user => user.email.toLowerCase() === normalizedEmail && user.password === password
      );

      if (foundUser) {
        const authUser: AuthUser = {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          roleId: foundUser.roleId,
          roleName: foundUser.roleName,
          roleLevel: foundUser.roleLevel,
          loginTime: new Date().toISOString(),
        };

        // Store in localStorage
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
        setUser(authUser);

        return { success: true, message: 'Login successful!' };
      }

      return { success: false, message: 'Invalid email or password. Please try again.' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'An error occurred during login. Please try again.' };
    }
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
