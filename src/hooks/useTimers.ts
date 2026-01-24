import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { Timer, TimerTickEvent } from '../types';

// Backend callables
const createTimerCall = callable<[seconds: number, label: string], string>('create_timer');
const cancelTimerCall = callable<[timer_id: string], boolean>('cancel_timer');
const getActiveTimersCall = callable<[], Timer[]>('get_active_timers');

export function useTimers() {
    const [timers, setTimers] = useState<Timer[]>([]);
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

    // Create a new timer
    const createTimer = useCallback(async (seconds: number, label: string = '') => {
        try {
            await createTimerCall(seconds, label);
        } catch (e) {
            console.error('Failed to create timer:', e);
        }
    }, []);

    // Cancel a timer
    const cancelTimer = useCallback(async (timerId: string) => {
        try {
            await cancelTimerCall(timerId);
        } catch (e) {
            console.error('Failed to cancel timer:', e);
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

        return () => {
            removeEventListener('alarme_timers_updated', handleTimersUpdated);
            removeEventListener('alarme_timer_tick', handleTimerTick);
        };
    }, [loadTimers]);

    return {
        timers,
        loading,
        createTimer,
        cancelTimer,
        refresh: loadTimers
    };
}
