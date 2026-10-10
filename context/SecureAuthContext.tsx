'use client';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { portalRequest } from '@/lib/portal/client';
import { roleLabels, PortalProfile } from '@/lib/portal/types';
import { AppUser, UserRole } from '@/lib/types';
type Result = {
    success: boolean;
    error?: string;
};
const anonymous: AppUser = { id: '', name: '', email: '', role: 'EMPLOYEE', role_display: '', avatar_initials: '' };
interface AuthState {
    currentUser: AppUser;
    allUsers: AppUser[];
    role: UserRole;
    loading: boolean;
    authenticated: boolean;
    error: string;
    profile: PortalProfile | null;
    isExecutive: boolean;
    isAdmin: boolean;
    isCEO: boolean;
    isHR: boolean;
    isEmployee: boolean;
    isExternal: boolean;
    canAccess: (module: string) => boolean;
    signOut: () => Promise<void>;
    refresh: () => Promise<void>;
    actingOnBehalfOf: AppUser | null;
    setActingOnBehalfOf: (user: AppUser | null) => void;
    isLocked: boolean;
    lockSession: () => void;
    unlockSession: (id: string, password: string) => Promise<Result>;
    switchUserWithPassword: (target: AppUser | string, password: string) => Promise<Result>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<Result>;
    isChangePasswordOpen: boolean;
    openChangePasswordModal: () => void;
    closeChangePasswordModal: () => void;
}
const AuthContext = createContext<AuthState | undefined>(undefined);
export function AuthProvider({ children }: {
    children: React.ReactNode;
}) {
    const [currentUser, setCurrentUser] = useState(anonymous), [profile, setProfile] = useState<PortalProfile | null>(null);
    const [loading, setLoading] = useState(true), [error, setError] = useState('');
    const [isChangePasswordOpen, setPasswordOpen] = useState(false), [actingOnBehalfOf, setActing] = useState<AppUser | null>(null);
    const generation = useRef(0);
    const refresh = useCallback(async () => {
        const current = ++generation.current;
        try {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                if (current === generation.current) {
                    setCurrentUser(anonymous);
                    setProfile(null);
                }
                return;
            }
            const body = await portalRequest<PortalProfile & {
                email: string;
            }>('/api/portal/me');
            const account = body.account;
            if (current !== generation.current)
                return;
            // External sessions cannot inherit business caches from the legacy app.
            // Back up unsynced legacy records before enabling external access (runbook).
            if (['BROKER', 'OWNER', 'TENANT'].includes(account.role))
                Object.keys(localStorage).filter(key => key.startsWith('kohl_')).forEach(key => localStorage.removeItem(key));
            setCurrentUser({ ...account, email: body.email, role_display: roleLabels[account.role], avatar_initials: account.name.split(' ').map(s => s[0]).slice(0, 2).join('.') });
            setProfile(body);
            setError('');
        }
        catch (e) {
            if (current === generation.current) {
                setCurrentUser(anonymous);
                setProfile(null);
                setError(e instanceof Error ? e.message : 'Access unavailable');
            }
        }
        finally {
            if (current === generation.current)
                setLoading(false);
        }
    }, []);
    useEffect(() => {
        ['kohl_active_app_user_v1', 'kohl_active_app_user_v2', 'kohl_custom_passwords_v2', 'kohl_session_locked_v2'].forEach(key => localStorage.removeItem(key));
        void refresh();
        const { data } = supabase.auth.onAuthStateChange(() => { ++generation.current; setCurrentUser(anonymous); setProfile(null); setActing(null); setLoading(true); setTimeout(() => void refresh(), 0); });
        const timer = setInterval(() => void refresh(), 60000);
        const visible = () => { if (document.visibilityState === 'visible')
            void refresh(); };
        document.addEventListener('visibilitychange', visible);
        return () => { data.subscription.unsubscribe(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
    }, [refresh]);
    const authenticated = !!currentUser.id, role = currentUser.role, isExecutive = authenticated && ['ADMIN', 'CEO'].includes(role), isExternal = authenticated && ['BROKER', 'OWNER', 'TENANT'].includes(role);
    const signOut = async () => { ++generation.current; setCurrentUser(anonymous); setProfile(null); setActing(null); await supabase.auth.signOut(); };
    const verifyOwn = async (password: string): Promise<Result> => {
        if (!authenticated)
            return { success: false, error: 'Sign in required' };
        const { error } = await supabase.auth.signInWithPassword({ email: currentUser.email, password });
        return { success: !error, error: error ? 'كلمة المرور غير صحيحة' : undefined };
    };
    const canAccess = (module: string) => {
        if (!authenticated || isExternal)
            return false;
        if (isExecutive)
            return true;
        if (['dashboard', 'employees', 'archive'].includes(module))
            return true;
        return role === 'EMPLOYEE' && ['bills-forms', 'crm', 'contracts', 'property-management', 'ownership-properties', 'brokerage-agreements', 'customer-orders', 'general-services'].includes(module);
    };
    const value: AuthState = { currentUser, allUsers: authenticated ? [currentUser] : [], role, loading, authenticated, profile, error, isExecutive, isAdmin: authenticated && role === 'ADMIN', isCEO: authenticated && role === 'CEO', isHR: authenticated && role === 'HR', isEmployee: authenticated && role === 'EMPLOYEE', isExternal, canAccess, signOut, refresh, actingOnBehalfOf,
        setActingOnBehalfOf: user => { if (isExecutive)
            setActing(user); }, isLocked: false, lockSession: () => { void signOut(); },
        unlockSession: async (id, password) => id === currentUser.id ? verifyOwn(password) : { success: false, error: 'Sign in with your own account' },
        switchUserWithPassword: async (target, password) => (typeof target === 'string' ? target : target.id) === currentUser.id ? verifyOwn(password) : { success: false, error: 'Sign out to switch accounts' },
        changePassword: async (oldPassword, newPassword) => { if (newPassword.length < 12)
            return { success: false, error: 'استخدم 12 خانة على الأقل' }; const verified = await verifyOwn(oldPassword); if (!verified.success)
            return verified; const { error } = await supabase.auth.updateUser({ password: newPassword }); return { success: !error, error: error ? 'تعذر تغيير كلمة المرور' : undefined }; },
        isChangePasswordOpen, openChangePasswordModal: () => setPasswordOpen(true), closeChangePasswordModal: () => setPasswordOpen(false) };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value)
    throw new Error('AuthProvider required'); return value; }
