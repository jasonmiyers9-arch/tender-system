import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';

export function useNotifications(limit = 20) {
    return useQuery({
        queryKey: ['notifications', limit],
        queryFn: () => notificationsApi.list(false, limit),
        refetchInterval: 60000,
    });
}

export function useUnreadNotifications(limit = 10) {
    return useQuery({
        queryKey: ['notifications-unread', limit],
        queryFn: () => notificationsApi.list(true, limit),
        refetchInterval: 30000,
    });
}

export function useMarkNotificationRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationsApi.markRead(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['notifications-unread'] });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => notificationsApi.markAllRead(),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['notifications-unread'] });
        },
    });
}
