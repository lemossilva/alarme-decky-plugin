import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { SleepInhibitorStatus } from '../types';

// Backend callable
const getSleepInhibitorStatus = callable<[], SleepInhibitorStatus>('get_sleep_inhibitor_status');

const DEFAULT_STATUS: SleepInhibitorStatus = {
    active: false,
    items: [],
    screensaver_mode: 'off',
    screensaver_dim_opacity: 0.92
};

export function useSleepInhibitor() {
    const [status, setStatus] = useState<SleepInhibitorStatus>(DEFAULT_STATUS);

    // Load initial status
    const loadStatus = useCallback(async () => {
        try {
            const currentStatus = await getSleepInhibitorStatus();
            setStatus(currentStatus);
        } catch (e) {
            console.error('Failed to load sleep inhibitor status:', e);
        }
    }, []);

    useEffect(() => {
        const handleStatusUpdate = (newStatus: SleepInhibitorStatus) => {
            setStatus(newStatus);
        };

        addEventListener('alarme_sleep_inhibitor_updated', handleStatusUpdate);
        loadStatus();

        return () => {
            removeEventListener('alarme_sleep_inhibitor_updated', handleStatusUpdate);
        };
    }, [loadStatus]);

    return {
        isActive: status.active,
        reason: status.reason,
        items: status.items || [],
        screensaverMode: status.screensaver_mode || 'off',
        screensaverDimOpacity: status.screensaver_dim_opacity ?? 0.92,
        refresh: loadStatus
    };
}
