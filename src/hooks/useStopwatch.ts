import { useEffect, useState, useCallback, useRef } from 'react';
import { callable } from '@decky/api';
import type { StopwatchState, StopwatchLap } from '../types';

const getStateCall = callable<[], StopwatchState & { auto_reset?: boolean }>('stopwatch_get_state');
const startCall = callable<[], StopwatchState>('stopwatch_start');
const pauseCall = callable<[], StopwatchState>('stopwatch_pause');
const resetCall = callable<[], StopwatchState>('stopwatch_reset');
const lapCall = callable<[], StopwatchState & { lap_limit_reached?: boolean }>('stopwatch_lap');
const getLapsTextCall = callable<[], string>('stopwatch_get_laps_text');
const setPreventSleepCall = callable<[prevent_sleep: boolean], StopwatchState>('stopwatch_set_prevent_sleep');

interface UseStopwatchReturn {
    status: StopwatchState['status'];
    elapsed: number;
    currentLapElapsed: number;
    laps: StopwatchLap[];
    preventSleep: boolean;
    loading: boolean;
    autoReset: boolean;
    lapLimitReached: boolean;
    start: () => Promise<void>;
    pause: () => Promise<void>;
    reset: () => Promise<void>;
    lap: () => Promise<void>;
    copyLaps: () => Promise<string>;
    setPreventSleep: (value: boolean) => Promise<void>;
}

export function useStopwatch(): UseStopwatchReturn {
    const [state, setState] = useState<StopwatchState>({
        status: 'idle',
        start_time: null,
        elapsed_ms: 0,
        laps: []
    });
    const [loading, setLoading] = useState(true);
    const [displayElapsed, setDisplayElapsed] = useState(0);
    const [autoReset, setAutoReset] = useState(false);
    const [lapLimitReached, setLapLimitReached] = useState(false);
    const intervalRef = useRef<number | null>(null);
    const mountedRef = useRef(true);

    const loadInitialState = useCallback(async () => {
        try {
            const initialState = await getStateCall();
            if (mountedRef.current) {
                setState(initialState);
                setDisplayElapsed((initialState as any).current_elapsed_ms || initialState.elapsed_ms || 0);
                if ((initialState as any).auto_reset) {
                    setAutoReset(true);
                }
            }
        } catch (e) {
            console.error('Failed to load stopwatch state:', e);
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    const startTicking = useCallback(() => {
        if (intervalRef.current) return;

        const tick = () => {
            setState(prev => {
                if (prev.status !== 'running' || !prev.start_time) return prev;
                const runningMs = (Date.now() / 1000 - prev.start_time) * 1000;
                const total = (prev.elapsed_ms || 0) + runningMs;
                setDisplayElapsed(total);
                return prev;
            });
        };

        intervalRef.current = window.setInterval(tick, 10);
    }, []);

    const stopTicking = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        loadInitialState();

        return () => {
            mountedRef.current = false;
            stopTicking();
        };
    }, [loadInitialState, stopTicking]);

    useEffect(() => {
        if (state.status === 'running') {
            startTicking();
        } else {
            stopTicking();
            setDisplayElapsed((state as any).current_elapsed_ms || state.elapsed_ms || 0);
        }
    }, [state.status, state.start_time, startTicking, stopTicking]);

    const start = useCallback(async () => {
        try {
            const newState = await startCall();
            if (mountedRef.current) {
                setState(newState);
            }
        } catch (e) {
            console.error('Failed to start stopwatch:', e);
        }
    }, []);

    const pause = useCallback(async () => {
        try {
            const newState = await pauseCall();
            if (mountedRef.current) {
                setState(newState);
            }
        } catch (e) {
            console.error('Failed to pause stopwatch:', e);
        }
    }, []);

    const reset = useCallback(async () => {
        try {
            const newState = await resetCall();
            if (mountedRef.current) {
                setState(newState);
                setDisplayElapsed(0);
            }
        } catch (e) {
            console.error('Failed to reset stopwatch:', e);
        }
    }, []);

    const recordLap = useCallback(async () => {
        try {
            const newState = await lapCall();
            if (mountedRef.current) {
                setState(newState);
                if ((newState as any).lap_limit_reached) {
                    setLapLimitReached(true);
                }
            }
        } catch (e) {
            console.error('Failed to record lap:', e);
        }
    }, []);

    const copyLaps = useCallback(async (): Promise<string> => {
        try {
            return await getLapsTextCall();
        } catch (e) {
            console.error('Failed to get laps text:', e);
            return '';
        }
    }, []);

    const setPreventSleep = useCallback(async (value: boolean) => {
        try {
            const newState = await setPreventSleepCall(value);
            if (mountedRef.current) {
                setState(newState);
            }
        } catch (e) {
            console.error('Failed to set prevent sleep:', e);
        }
    }, []);

    const currentLapElapsed = (() => {
        const laps = state.laps || [];
        if (laps.length === 0) {
            return displayElapsed;
        }
        const lastLapAbsolute = laps[laps.length - 1].absolute_ms || 0;
        return Math.max(0, displayElapsed - lastLapAbsolute);
    })();

    return {
        status: state.status,
        elapsed: displayElapsed,
        currentLapElapsed,
        laps: state.laps || [],
        preventSleep: state.prevent_sleep || false,
        loading,
        autoReset,
        lapLimitReached,
        start,
        pause,
        reset,
        lap: recordLap,
        copyLaps,
        setPreventSleep
    };
}
