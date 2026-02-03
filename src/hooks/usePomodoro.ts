import { useEffect, useState, useCallback } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { PomodoroState, PomodoroTickEvent } from '../types';

// Backend callables
const startPomodoroCall = callable<[], PomodoroState>('start_pomodoro');
const stopPomodoroCall = callable<[], boolean>('stop_pomodoro');
const skipPhaseCall = callable<[], PomodoroState>('skip_pomodoro_phase');
const getPomodoroStateCall = callable<[], PomodoroState>('get_pomodoro_state');
const resetStatsCall = callable<[], boolean>('reset_pomodoro_stats');

export function usePomodoro() {
    const [state, setState] = useState<PomodoroState>({
        active: false,
        is_break: false,
        current_session: 0,
        end_time: null,
        duration: 0,
        remaining: 0
    });
    const [loading, setLoading] = useState(true);

    // Load initial state
    const loadState = useCallback(async () => {
        try {
            const pomodoroState = await getPomodoroStateCall();
            setState(pomodoroState);
        } catch (e) {
            console.error('Failed to load Pomodoro state:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Start Pomodoro
    const startPomodoro = useCallback(async () => {
        try {
            const newState = await startPomodoroCall();
            setState(newState);
        } catch (e) {
            console.error('Failed to start Pomodoro:', e);
        }
    }, []);

    // Stop Pomodoro
    const stopPomodoro = useCallback(async () => {
        try {
            await stopPomodoroCall();
            // Only reset timer-related fields, preserve stats
            setState(prev => ({
                ...prev,
                active: false,
                is_break: false,
                current_session: 0,
                end_time: null,
                duration: 0,
                remaining: 0
            }));
        } catch (e) {
            console.error('Failed to stop Pomodoro:', e);
        }
    }, []);

    // Skip current phase
    const skipPhase = useCallback(async () => {
        try {
            const newState = await skipPhaseCall();
            setState(newState);
        } catch (e) {
            console.error('Failed to skip phase:', e);
        }
    }, []);

    // Event handlers
    useEffect(() => {
        const handleTick = (event: PomodoroTickEvent) => {
            setState(prev => ({
                ...prev,
                remaining: event.remaining,
                is_break: event.is_break,
                current_session: event.session,
                current_cycle: event.cycle,
                // Calculate elapsed time this phase for live stats display
                elapsed_this_phase: prev.duration > 0 ? prev.duration - event.remaining : 0
            }));
        };

        const handlePhaseChange = (newState: PomodoroState) => {
            setState(newState);
        };

        const handleStopped = (newState: PomodoroState) => {
            setState(newState);
        };

        addEventListener('alarme_pomodoro_tick', handleTick);
        addEventListener('alarme_pomodoro_started', handlePhaseChange);
        addEventListener('alarme_pomodoro_phase_changed', handlePhaseChange);
        addEventListener('alarme_pomodoro_work_ended', handlePhaseChange);
        addEventListener('alarme_pomodoro_break_ended', handlePhaseChange);
        addEventListener('alarme_pomodoro_stopped', handleStopped);

        // Load initial data
        loadState();

        return () => {
            removeEventListener('alarme_pomodoro_tick', handleTick);
            removeEventListener('alarme_pomodoro_started', handlePhaseChange);
            removeEventListener('alarme_pomodoro_phase_changed', handlePhaseChange);
            removeEventListener('alarme_pomodoro_work_ended', handlePhaseChange);
            removeEventListener('alarme_pomodoro_break_ended', handlePhaseChange);
            removeEventListener('alarme_pomodoro_stopped', handleStopped);
        };
    }, [loadState]);

    // Reset Stats
    const resetStats = useCallback(async () => {
        try {
            await resetStatsCall();
            await loadState(); // Refresh stats
        } catch (e) {
            console.error('Failed to reset stats:', e);
        }
    }, [loadState]);

    return {
        state,
        stats: state.stats,
        loading,
        isActive: state.active,
        isBreak: state.is_break,
        currentSession: state.current_session,
        currentCycle: state.current_cycle || 1,
        remaining: state.remaining || 0,
        elapsedThisPhase: state.elapsed_this_phase || 0,
        startPomodoro,
        stopPomodoro,
        skipPhase,
        resetStats,
        refresh: loadState
    };
}
