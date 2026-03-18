import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'user' | 'evaluator' | 'admin';

interface AppState {
    // Auth
    mockToken: string | null;
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

    // Actions
    setMockToken: (token: string | null) => void;
    setCurrentUser: (user: AppState['currentUser']) => void;
    setActiveCompany: (id: string) => void;
    setRole: (role: UserRole) => void;
    toggleSidebar: () => void;
    logout: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            mockToken: null,
            currentUser: null,
            activeCompanyId: 'company-1',
            sidebarCollapsed: false,

            setMockToken: (token) => set({ mockToken: token }),
            setCurrentUser: (user) => set({ currentUser: user }),
            setActiveCompany: (id) => set({ activeCompanyId: id }),
            setRole: (role) =>
                set((s) => ({
                    currentUser: s.currentUser ? { ...s.currentUser, role } : null,
                })),
            toggleSidebar: () =>
                set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
            logout: () =>
                set({ mockToken: null, currentUser: null }),
        }),
        {
            name: 'tenderguard-app-state',
            partialize: (s) => ({
                mockToken: s.mockToken,
                currentUser: s.currentUser,
                activeCompanyId: s.activeCompanyId,
            }),
        }
    )
);
