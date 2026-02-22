import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { SleepInhibitorStatus } from '../types';

// Backend callable
const getSleepInhibitorStatus = callable<[], SleepInhibitorStatus>('get_sleep_inhibitor_status');

export function useSleepInhibitor() {
    const [status, setStatus] = useState<SleepInhibitorStatus>({ active: false });

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
        refresh: loadStatus
    };
}
