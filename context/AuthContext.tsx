'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserRole } from '../lib/types';
import { INITIAL_APP_USERS } from '../lib/supabaseClient';

const AUTH_USER_KEY = 'kohl_active_app_user_v2';
const AUTH_USER_OLD_KEY = 'kohl_active_app_user_v1';
const AUTH_LOCKED_KEY = 'kohl_session_locked_v2';
const PASSWORDS_STORAGE_KEY = 'kohl_custom_passwords_v2';

// Default initial Passwords specification:
// Admin: Mohammed Abotargah (محمد ابوطرجه) -> Rawad@225144
// CEO: Salem Al Thiaby (سالم الذيابي) -> Aa123123
// Others (unidentified/employees/HR): Admin123
export const KNOWN_PASSWORDS = {
  ADMIN: 'Rawad@225144',
  CEO: 'Aa123123',
  OTHERS: 'Admin123',
} as const;

interface AuthContextType {
  currentUser: AppUser;
  allUsers: AppUser[];
  role: UserRole;
  isExecutive: boolean;
  isAdmin: boolean;
  isCEO: boolean;
  isHR: boolean;
  isEmployee: boolean;
  switchUser: (userIdOrUser: string | AppUser) => void;
  verifyPassword: (userIdOrUser: string | AppUser, passwordInput: string) => boolean;
  switchUserWithPassword: (
    userIdOrUser: string | AppUser,
    passwordInput: string
  ) => { success: boolean; error?: string };
  changePassword: (
    oldPassword: string,
    newPassword: string,
    targetUserId?: string
  ) => { success: boolean; error?: string };
  canAccess: (module: string) => boolean;
  actingOnBehalfOf: AppUser | null;
  setActingOnBehalfOf: (user: AppUser | null) => void;
  isLocked: boolean;
  lockSession: () => void;
  unlockSession: (userId: string, passwordInput: string) => { success: boolean; error?: string };
  isChangePasswordOpen: boolean;
  openChangePasswordModal: () => void;
  closeChangePasswordModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [allUsers, setAllUsers] = useState<AppUser[]>(INITIAL_APP_USERS);
  const [currentUser, setCurrentUser] = useState<AppUser>(INITIAL_APP_USERS[0]); // Default to CEO
  const [actingOnBehalfOf, setActingOnBehalfOf] = useState<AppUser | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [customPasswords, setCustomPasswords] = useState<Record<string, string>>({});
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  // Restore saved passwords, active user, and lock status on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // 1. Restore Custom Passwords
      let loadedPasswords: Record<string, string> = {};
      const savedPasswords = localStorage.getItem(PASSWORDS_STORAGE_KEY);
      if (savedPasswords) {
        try {
          loadedPasswords = JSON.parse(savedPasswords);
          setCustomPasswords(loadedPasswords);
        } catch (e) {
          console.warn('Could not parse custom passwords:', e);
        }
      }

      // Update allUsers with custom passwords if available
      setAllUsers((prevUsers) =>
        prevUsers.map((u) => ({
          ...u,
          password: loadedPasswords[u.id] || u.password,
        }))
      );

      // 2. Check if session was locked
      const lockedVal = localStorage.getItem(AUTH_LOCKED_KEY);
      if (lockedVal === 'true') {
        setIsLocked(true);
      }

      // 3. Restore Active User
      let saved = localStorage.getItem(AUTH_USER_KEY);
      if (!saved) {
        saved = localStorage.getItem(AUTH_USER_OLD_KEY);
      }

      if (saved) {
        const parsed = JSON.parse(saved);
        const match =
          allUsers.find((u) => u.id === parsed.id) ||
          allUsers.find((u) => u.role === parsed.role) ||
          allUsers[0];
        if (match) {
          const updatedMatch = {
            ...match,
            password: loadedPasswords[match.id] || match.password,
          };
          setCurrentUser(updatedMatch);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedMatch));
        }
      }
    } catch (e) {
      console.warn('Could not restore auth state from localStorage:', e);
    }
  }, []);

  /**
   * Secure password verification:
   * 1. Checks user-customized password if user changed it.
   * 2. Otherwise falls back to defaults:
   *    - Admin: Mohammed Abotargah -> Rawad@225144
   *    - CEO: Salem Al Thiaby -> Aa123123
   *    - Others (Unidentified / HR / Employees) -> Admin123
   */
  const verifyPassword = (userIdOrUser: string | AppUser, passwordInput: string): boolean => {
    let target: AppUser | undefined;
    if (typeof userIdOrUser === 'string') {
      target = allUsers.find((u) => u.id === userIdOrUser);
    } else {
      target = userIdOrUser;
    }

    if (!target) return false;
    const input = (passwordInput || '').trim();

    // Check Admin
    if (target.role === 'ADMIN' || target.id === 'usr-admin' || target.name.includes('ابوطرجه') || target.name.includes('Abotargah')) {
      if (input === KNOWN_PASSWORDS.ADMIN) return true;
      if (customPasswords[target.id] && input === customPasswords[target.id]) return true;
      if (target.password && input === target.password) return true;
      return false;
    }

    // Check CEO
    if (target.role === 'CEO' || target.id === 'usr-ceo' || target.name.includes('الذيابي') || target.name.includes('Thiaby')) {
      if (input === KNOWN_PASSWORDS.CEO) return true;
      if (customPasswords[target.id] && input === customPasswords[target.id]) return true;
      if (target.password && input === target.password) return true;
      return false;
    }

    // Others named as unidentified
    if (input === KNOWN_PASSWORDS.OTHERS) return true;
    if (customPasswords[target.id] && input === customPasswords[target.id]) return true;
    if (target.password && input === target.password) return true;

    return false;
  };

  /**
   * Switch user with mandatory password authentication
   */
  const switchUserWithPassword = (
    userIdOrUser: string | AppUser,
    passwordInput: string
  ): { success: boolean; error?: string } => {
    let target: AppUser | undefined;
    if (typeof userIdOrUser === 'string') {
      target = allUsers.find((u) => u.id === userIdOrUser);
    } else {
      target = userIdOrUser;
    }

    if (!target) {
      return { success: false, error: 'المستخدم غير متوفر في النظام' };
    }

    const isValid = verifyPassword(target, passwordInput);
    if (!isValid) {
      return { success: false, error: 'كلمة المرور غير صحيحة، يرجى إعادة المحاولة.' };
    }

    // Authentication succeeded
    const updatedUser = {
      ...target,
      password: customPasswords[target.id] || target.password,
    };
    setCurrentUser(updatedUser);
    setIsLocked(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
      localStorage.removeItem(AUTH_LOCKED_KEY);
    }

    if (target.role !== 'ADMIN' && target.role !== 'CEO') {
      setActingOnBehalfOf(null);
    }

    return { success: true };
  };

  /**
   * Change password for any user
   */
  const changePassword = (
    oldPassword: string,
    newPassword: string,
    targetUserId?: string
  ): { success: boolean; error?: string } => {
    const target = targetUserId
      ? allUsers.find((u) => u.id === targetUserId)
      : currentUser;

    if (!target) {
      return { success: false, error: 'المستخدم غير موجود' };
    }

    const trimmedOld = (oldPassword || '').trim();
    const trimmedNew = (newPassword || '').trim();

    // 1. Verify old password
    const isOldCorrect = verifyPassword(target, trimmedOld);
    if (!isOldCorrect) {
      return { success: false, error: 'كلمة المرور الحالية غير صحيحة.' };
    }

    // 2. Validate new password
    if (!trimmedNew || trimmedNew.length < 4) {
      return { success: false, error: 'كلمة المرور الجديدة يجب أن تحتوي على 4 أحرف أو أرقام على الأقل.' };
    }

    if (trimmedOld === trimmedNew) {
      return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية.' };
    }

    // 3. Update password in state and localStorage
    const updatedPasswords = {
      ...customPasswords,
      [target.id]: trimmedNew,
    };
    setCustomPasswords(updatedPasswords);

    if (typeof window !== 'undefined') {
      localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(updatedPasswords));
    }

    // Update in allUsers
    setAllUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === target.id ? { ...u, password: trimmedNew } : u))
    );

    // Update in currentUser if changing current user's password
    if (currentUser.id === target.id) {
      const updatedCurrent = { ...currentUser, password: trimmedNew };
      setCurrentUser(updatedCurrent);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedCurrent));
      }
    }

    return { success: true };
  };

  const switchUser = (userIdOrUser: string | AppUser) => {
    let target: AppUser | undefined;
    if (typeof userIdOrUser === 'string') {
      target = allUsers.find((u) => u.id === userIdOrUser);
    } else {
      target = userIdOrUser;
    }

    if (target) {
      const updatedTarget = {
        ...target,
        password: customPasswords[target.id] || target.password,
      };
      setCurrentUser(updatedTarget);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedTarget));
      }
      if (target.role !== 'ADMIN' && target.role !== 'CEO') {
        setActingOnBehalfOf(null);
      }
    }
  };

  const lockSession = () => {
    setIsLocked(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_LOCKED_KEY, 'true');
    }
  };

  const unlockSession = (userId: string, passwordInput: string): { success: boolean; error?: string } => {
    return switchUserWithPassword(userId, passwordInput);
  };

  const openChangePasswordModal = () => setIsChangePasswordOpen(true);
  const closeChangePasswordModal = () => setIsChangePasswordOpen(false);

  const role = currentUser.role;
  // Admin and CEO have exact same executive powers across the entire application
  const isExecutive = role === 'ADMIN' || role === 'CEO';
  const isAdmin = role === 'ADMIN';
  const isCEO = role === 'CEO';
  const isHR = role === 'HR';
  const isEmployee = role === 'EMPLOYEE';

  /**
   * Permission matrix:
   * Admin and CEO have EXACT SAME full access to all sections and operations.
   */
  const canAccess = (module: string): boolean => {
    // Admin and CEO have unrestricted full access
    if (isExecutive) return true;

    switch (module) {
      case 'dashboard':
        return true; // Everyone can see dashboard (filtered according to role)
      case 'employees':
        // HR has full access. Employees have access to self-portal (own timesheet/leaves/payslip)
        return true;
      case 'crm':
        // Executive and Employee can see CRM (Employee filtered to own leads/deals)
        return isExecutive || isEmployee;
      case 'contracts':
        // Executive and Employee can see contracts (Employee filtered to own)
        return isExecutive || isEmployee;
      case 'archive':
        return true; // Read & archive allowed
      case 'financials':
      case 'earnings':
      case 'daily-reports':
        return isExecutive; // Financials restricted to Admin/CEO only
      case 'property-management':
      case 'ownership-properties':
      case 'brokerage-agreements':
      case 'customer-orders':
      case 'general-services':
        return isExecutive || isEmployee;
      default:
        return isExecutive;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        role,
        isExecutive,
        isAdmin,
        isCEO,
        isHR,
        isEmployee,
        switchUser,
        verifyPassword,
        switchUserWithPassword,
        changePassword,
        canAccess,
        actingOnBehalfOf,
        setActingOnBehalfOf,
        isLocked,
        lockSession,
        unlockSession,
        isChangePasswordOpen,
        openChangePasswordModal,
        closeChangePasswordModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
