import { useEffect, useState, useCallback } from "react";
import { addEventListener, removeEventListener, callable } from "@decky/api";
import type { SleepInhibitorStatus } from "../types";

const getScreensaverState = callable<[], { screensaver_mode: string; screensaver_dim_opacity: number; screensaver_idle_seconds: number; overlay_during_screensaver: boolean }>('get_screensaver_state');
const setScreensaverModeCall = callable<[mode: string, dim_opacity?: number], { success: boolean; screensaver_mode: string }>('set_screensaver_mode');

// Module-level shared idle timer — all useScreensaver instances share the same timer
let sharedIsIdle = false;
let sharedIdleTimer: ReturnType<typeof setTimeout> | null = null;
const idleListeners = new Set<() => void>();

function notifyIdleListeners() {
    idleListeners.forEach(fn => fn());
}

function startSharedIdleTimer(seconds: number) {
    stopSharedIdleTimer();
    sharedIdleTimer = setTimeout(() => {
        sharedIsIdle = true;
        sharedIdleTimer = null;
        notifyIdleListeners();
    }, seconds * 1000);
}

function stopSharedIdleTimer() {
    if (sharedIdleTimer) {
        clearTimeout(sharedIdleTimer);
        sharedIdleTimer = null;
    }
}

export function useScreensaver() {
    const [effectiveMode, setEffectiveMode] = useState<'off' | 'black' | 'dim'>('off');
    const [dimOpacity, setDimOpacity] = useState(0.92);
    const [inhibitorActive, setInhibitorActive] = useState(false);
    const [idleSeconds, setIdleSeconds] = useState(15);
    const [overlayDuring, setOverlayDuring] = useState(true);
    const [isIdle, setIsIdle] = useState(sharedIsIdle);

    // Sync local isIdle with shared state
    useEffect(() => {
        const listener = () => setIsIdle(sharedIsIdle);
        idleListeners.add(listener);
        return () => { idleListeners.delete(listener); };
    }, []);

    const wakeUp = useCallback(() => {
        sharedIsIdle = false;
        setIsIdle(false);
        if (effectiveMode !== 'off' && inhibitorActive) {
            startSharedIdleTimer(idleSeconds);
        }
        notifyIdleListeners();
    }, [effectiveMode, inhibitorActive, idleSeconds]);

    const overlayVisible = inhibitorActive && effectiveMode !== 'off' && isIdle;
    const shouldListen = inhibitorActive && effectiveMode !== 'off';

    const changeScreensaverMode = useCallback(async (mode: 'off' | 'black' | 'dim') => {
        try {
            await setScreensaverModeCall(mode);
        } catch (e) {
            console.error('Failed to set screensaver mode:', e);
        }
    }, []);

    const changeDimOpacity = useCallback(async (opacity: number) => {
        try {
            await setScreensaverModeCall(effectiveMode, opacity);
        } catch (e) {
            console.error('Failed to set dim opacity:', e);
        }
    }, [effectiveMode]);

    useEffect(() => {
        const handleStatusUpdate = (status: SleepInhibitorStatus) => {
            setInhibitorActive(status.active);
            if (status.screensaver_idle_seconds !== undefined) {
                setIdleSeconds(status.screensaver_idle_seconds);
            }
            if (status.overlay_during_screensaver !== undefined) {
                setOverlayDuring(status.overlay_during_screensaver);
            }
            if (status.active) {
                setEffectiveMode((status.screensaver_mode as 'off' | 'black' | 'dim') || 'off');
                setDimOpacity(status.screensaver_dim_opacity ?? 0.92);
            } else {
                setEffectiveMode('off');
                sharedIsIdle = false;
                setIsIdle(false);
                stopSharedIdleTimer();
                notifyIdleListeners();
            }
        };

        addEventListener('alarme_sleep_inhibitor_updated', handleStatusUpdate);

        getScreensaverState().then(state => {
            setEffectiveMode((state.screensaver_mode as 'off' | 'black' | 'dim') || 'off');
            setDimOpacity(state.screensaver_dim_opacity ?? 0.92);
            setIdleSeconds(state.screensaver_idle_seconds ?? 15);
            setOverlayDuring(state.overlay_during_screensaver ?? true);
        }).catch(e => console.error('Failed to load screensaver state:', e));

        return () => {
            removeEventListener('alarme_sleep_inhibitor_updated', handleStatusUpdate);
        };
    }, []);

    // Shared idle timer control — only one timer runs across all instances
    useEffect(() => {
        if (inhibitorActive && effectiveMode !== 'off') {
            sharedIsIdle = false;
            setIsIdle(false);
            startSharedIdleTimer(idleSeconds);
            notifyIdleListeners();
        } else {
            stopSharedIdleTimer();
            sharedIsIdle = false;
            setIsIdle(false);
            notifyIdleListeners();
        }
    }, [inhibitorActive, effectiveMode, idleSeconds]);

    return {
        effectiveMode,
        dimOpacity,
        inhibitorActive,
        isIdle,
        overlayVisible,
        overlayDuring,
        shouldListen,
        wakeUp,
        setScreensaverMode: changeScreensaverMode,
        setDimOpacity: changeDimOpacity,
    };
}
