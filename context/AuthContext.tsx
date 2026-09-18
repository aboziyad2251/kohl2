'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserRole } from '../lib/types';
import { INITIAL_APP_USERS } from '../lib/supabaseClient';

const AUTH_USER_KEY = 'kohl_active_app_user_v1';

interface AuthContextType {
  currentUser: AppUser;
  allUsers: AppUser[];
  role: UserRole;
  isExecutive: boolean;
  isHR: boolean;
  isEmployee: boolean;
  switchUser: (userIdOrUser: string | AppUser) => void;
  canAccess: (module: string) => boolean;
  actingOnBehalfOf: AppUser | null;
  setActingOnBehalfOf: (user: AppUser | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [allUsers] = useState<AppUser[]>(INITIAL_APP_USERS);
  const [currentUser, setCurrentUser] = useState<AppUser>(INITIAL_APP_USERS[0]); // Default to CEO
  const [actingOnBehalfOf, setActingOnBehalfOf] = useState<AppUser | null>(null);

  // Restore saved active user on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = allUsers.find((u) => u.id === parsed.id);
        if (match) {
          setCurrentUser(match);
        }
      }
    } catch (e) {
      console.warn('Could not restore auth user from localStorage:', e);
    }
  }, [allUsers]);

  const switchUser = (userIdOrUser: string | AppUser) => {
    let target: AppUser | undefined;
    if (typeof userIdOrUser === 'string') {
      target = allUsers.find((u) => u.id === userIdOrUser);
    } else {
      target = userIdOrUser;
    }

    if (target) {
      setCurrentUser(target);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(target));
      }
      // Reset acting on behalf if switching away from Executive
      if (target.role !== 'ADMIN' && target.role !== 'CEO') {
        setActingOnBehalfOf(null);
      }
    }
  };

  const role = currentUser.role;
  const isExecutive = role === 'ADMIN' || role === 'CEO';
  const isHR = role === 'HR';
  const isEmployee = role === 'EMPLOYEE';

  /**
   * Permission matrix matching user requirements:
   * A: Admin / CEO: Access everything.
   * B: HR: Only employees management + Main dashboard.
   * C: Employee: Only sees his own contracts, leaves, payments, deals.
   */
  const canAccess = (module: string): boolean => {
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
        isHR,
        isEmployee,
        switchUser,
        canAccess,
        actingOnBehalfOf,
        setActingOnBehalfOf,
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
