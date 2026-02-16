import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { Timer, TimerTickEvent } from '../types';

// Backend callables
const createTimerCall = callable<[seconds: number, label: string, subtle_mode?: boolean, auto_suspend?: boolean], string>('create_timer');
const cancelTimerCall = callable<[timer_id: string], boolean>('cancel_timer');
const pauseTimerCall = callable<[timer_id: string], boolean>('pause_timer');
const resumeTimerCall = callable<[timer_id: string], boolean>('resume_timer');
const getActiveTimersCall = callable<[], Timer[]>('get_active_timers');
const getRecentTimersCall = callable<[], RecentTimer[]>('get_recent_timers');

// Recent timer type (simplified timer for quick access)
export interface RecentTimer {
    seconds: number;
    label: string;
}

export function useTimers() {
    const [timers, setTimers] = useState<Timer[]>([]);
    const [recentTimers, setRecentTimers] = useState<RecentTimer[]>([]);
    const [loading, setLoading] = useState(true);

    // Load initial timers
    const loadTimers = useCallback(async () => {
        try {
            const activeTimers = await getActiveTimersCall();
            setTimers(activeTimers);
        } catch (e) {
            console.error('Failed to load timers:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load recent timers
    const loadRecentTimers = useCallback(async () => {
        try {
            const recent = await getRecentTimersCall();
            setRecentTimers(recent);
        } catch (e) {
            console.error('Failed to load recent timers:', e);
        }
    }, []);

    // Create a new timer
    const createTimer = useCallback(async (
        seconds: number,
        label: string = '',
        subtleMode?: boolean,
        autoSuspend?: boolean
    ) => {
        try {
            await createTimerCall(seconds, label, subtleMode, autoSuspend);
            // Reload recent timers after creating
            loadRecentTimers();
        } catch (e) {
            console.error('Failed to create timer:', e);
        }
    }, [loadRecentTimers]);

    // Cancel a timer
    const cancelTimer = useCallback(async (timerId: string) => {
        try {
            await cancelTimerCall(timerId);
        } catch (e) {
            console.error('Failed to cancel timer:', e);
        }
    }, []);

    // Pause a timer
    const pauseTimer = useCallback(async (timerId: string) => {
        try {
            await pauseTimerCall(timerId);
        } catch (e) {
            console.error('Failed to pause timer:', e);
        }
    }, []);

    // Resume a timer
    const resumeTimer = useCallback(async (timerId: string) => {
        try {
            await resumeTimerCall(timerId);
        } catch (e) {
            console.error('Failed to resume timer:', e);
        }
    }, []);

    // Event handlers
    useEffect(() => {
        const handleTimersUpdated = (updatedTimers: Timer[]) => {
            setTimers(updatedTimers);
        };

        const handleTimerTick = (event: TimerTickEvent) => {
            setTimers(prev => prev.map(timer =>
                timer.id === event.id
                    ? { ...timer, remaining: event.remaining }
                    : timer
            ));
        };

        addEventListener('alarme_timers_updated', handleTimersUpdated);
        addEventListener('alarme_timer_tick', handleTimerTick);

        // Load initial data
        loadTimers();
        loadRecentTimers();

        return () => {
            removeEventListener('alarme_timers_updated', handleTimersUpdated);
            removeEventListener('alarme_timer_tick', handleTimerTick);
        };
    }, [loadTimers, loadRecentTimers]);

    return {
        timers,
        recentTimers,
        loading,
        createTimer,
        cancelTimer,
        pauseTimer,
        resumeTimer,
        refresh: loadTimers,
        refreshRecent: loadRecentTimers
    };
}
