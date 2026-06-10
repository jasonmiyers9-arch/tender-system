import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'user' | 'evaluator' | 'admin' | 'super_admin';

interface AppState {
    // Auth
    token: string | null;
    currentUser: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        onboardingCompleted?: boolean;
    } | null;

    // Entity
    activeCompanyId: string;

    // UI
    sidebarCollapsed: boolean;

    // Hydration — true once localStorage has been read on first client render
    _hasHydrated: boolean;

    // Actions
    settoken: (token: string | null) => void;
    setCurrentUser: (user: AppState['currentUser']) => void;
    setActiveCompany: (id: string) => void;
    setRole: (role: UserRole) => void;
    toggleSidebar: () => void;
    logout: () => void;
    setHasHydrated: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            token: null,
            currentUser: null,
            activeCompanyId: 'company-1',
            sidebarCollapsed: false,
            _hasHydrated: false,

            settoken: (token) => set({ token }),
            setCurrentUser: (user) => set({ currentUser: user }),
            setActiveCompany: (id) => set({ activeCompanyId: id }),
            setRole: (role) =>
                set((s) => ({
                    currentUser: s.currentUser ? { ...s.currentUser, role } : null,
                })),
            toggleSidebar: () =>
                set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
            logout: () =>
                set({ token: null, currentUser: null }),
            setHasHydrated: (v) => set({ _hasHydrated: v }),
        }),
        {
            name: 'tenderguard-app-state',
            partialize: (s) => ({
                token: s.token,
                currentUser: s.currentUser,
                activeCompanyId: s.activeCompanyId,
            }),
            onRehydrateStorage: () => (state) => {
                // Called once localStorage has been read — safe to make auth decisions now
                state?.setHasHydrated(true);
            },
        }
    )
);
