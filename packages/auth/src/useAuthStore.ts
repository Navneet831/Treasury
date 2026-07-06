import { create } from 'zustand';

export interface AuthUser {
    email: string;
    features: Record<string, boolean>;
}

export interface AuthState {
    isAuthenticated: boolean;
    isBootstrapping: boolean;
    user: AuthUser | null;
    authError: string | null;
    setAuthenticated: (v: boolean) => void;
    setBootstrapping: (v: boolean) => void;
    setUser: (u: AuthUser | null) => void;
    setAuthError: (e: string | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
    isAuthenticated: false,
    isBootstrapping: true,
    user: null,
    authError: null,
    setAuthenticated: (isAuthenticated: boolean) => set({ isAuthenticated }),
    setBootstrapping: (isBootstrapping: boolean) => set({ isBootstrapping }),
    setUser: (user: AuthUser | null) => set({ user }),
    setAuthError: (authError: string | null) => set({ authError }),
}));
