import { useEffect, useState, useCallback } from "react";
import { addEventListener, removeEventListener, callable } from "@decky/api";
import { Navigation } from "@decky/ui";
import { useSettings } from "./useSettings";
import type { ScreensaverMode, SleepInhibitorItem, SleepInhibitorStatus } from "../types";

const getScreensaverState = callable<
    [],
    {
        active: boolean;
        items: SleepInhibitorItem[];
        screensaver_mode: string;
        screensaver_dim_opacity: number;
        screensaver_idle_seconds: number;
        overlay_during_screensaver: boolean;
    }
>("get_screensaver_state");
const setScreensaverModeCall = callable<
    [mode: string, dim_opacity?: number],
    { success: boolean; screensaver_mode: string }
>("set_screensaver_mode");

// --- Module-level state ---

let sharedIsIdle = false;
let sharedIdleTimer: ReturnType<typeof setTimeout> | null = null;

// Standalone: interval-based idle detection.
let sharedStandaloneIdle = false;
let sharedStandaloneInterval: ReturnType<typeof setInterval> | null = null;
let sharedLastActivity = 0;

// Synced copies of React state so reportActivity always sees latest values.
let sharedScreensaverArmed = false;
let sharedIdleSeconds = 15;

// Preview
let sharedPreviewActive = false;
let sharedPreviewLockoutUntil = 0; // wakeUp is ignored until this timestamp

const idleListeners = new Set<() => void>();
const previewListeners = new Set<() => void>();

function notifyIdleListeners() {
    idleListeners.forEach((fn) => fn());
}

function notifyPreviewListeners() {
    previewListeners.forEach((fn) => fn());
}

// --- Inhibitor idle timer ---

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

// --- Standalone idle detection (interval-based) ---

function startStandaloneTimer(seconds: number) {
    stopStandaloneTimer();
    sharedLastActivity = Date.now();
    sharedStandaloneInterval = setInterval(() => {
        const idleMs = Date.now() - sharedLastActivity;
        if (idleMs >= seconds * 1000 && !sharedStandaloneIdle) {
            sharedStandaloneIdle = true;
            notifyIdleListeners();
        }
    }, 500);
}

function stopStandaloneTimer() {
    if (sharedStandaloneInterval) {
        clearInterval(sharedStandaloneInterval);
        sharedStandaloneInterval = null;
    }
}

// --- reportActivity ---

function reportActivity() {
    sharedLastActivity = Date.now();

    if (sharedStandaloneIdle) {
        sharedStandaloneIdle = false;
    }
    if (sharedIsIdle) {
        sharedIsIdle = false;
    }

    if (sharedScreensaverArmed) {
        startSharedIdleTimer(sharedIdleSeconds);
    }

    notifyIdleListeners();
}

// --- Preview ---

export function triggerScreensaverPreview() {
    stopStandaloneTimer();
    stopSharedIdleTimer();

    sharedPreviewActive = true;
    sharedPreviewLockoutUntil = Date.now() + 500;
    sharedIsIdle = false;
    sharedStandaloneIdle = false;
    notifyIdleListeners();
    notifyPreviewListeners();
}

const PREVIEW_QAM_CLOSE_MS = 100;

export function triggerScreensaverPreviewAfterClosingMenus() {
    Navigation.CloseSideMenus?.();
    window.setTimeout(() => {
        triggerScreensaverPreview();
    }, PREVIEW_QAM_CLOSE_MS);
}

export function dismissScreensaverPreview() {
    sharedPreviewActive = false;
    notifyIdleListeners();
    notifyPreviewListeners();
}

function hasScreensaverItem(items: SleepInhibitorItem[] | undefined): boolean {
    return (items ?? []).some((item) => !!item.screensaver_mode && item.screensaver_mode !== "off");
}

// --- React hook ---

export function useScreensaver() {
    const { settings } = useSettings();

    const effectiveMode: ScreensaverMode = settings.screensaver_mode || "dim";

    const [dimOpacity, setDimOpacity] = useState(0.92);
    const [inhibitorActive, setInhibitorActive] = useState(false);
    // Prevent Sleep can run without a screensaver; only items with their toggle on arm it.
    const [screensaverArmed, setScreensaverArmed] = useState(false);
    const [idleSeconds, setIdleSeconds] = useState(15);
    const [overlayDuring, setOverlayDuring] = useState(true);
    const [isIdle, setIsIdle] = useState(sharedIsIdle);
    const [isStandaloneIdle, setIsStandaloneIdle] =
        useState(sharedStandaloneIdle);
    const [, setIsPreview] = useState(sharedPreviewActive);

    const standaloneEnabled = settings.screensaver_standalone_enabled ?? false;
    const standaloneIdleSeconds =
        settings.screensaver_standalone_idle_seconds ?? 60;

    useEffect(() => {
        // Clean runtime-only screensaver state when plugin UI mounts.
        stopSharedIdleTimer();
        stopStandaloneTimer();
        sharedIsIdle = false;
        sharedStandaloneIdle = false;
        sharedPreviewActive = false;
        sharedPreviewLockoutUntil = 0;
        sharedLastActivity = Date.now();
        notifyIdleListeners();
        notifyPreviewListeners();
    }, []);

    // Sync module-level vars on every render so reportActivity sees latest values.
    useEffect(() => {
        sharedScreensaverArmed = screensaverArmed && !standaloneEnabled;
        sharedIdleSeconds = idleSeconds;
    });

    useEffect(() => {
        const listener = () => {
            setIsIdle(sharedIsIdle);
            setIsStandaloneIdle(sharedStandaloneIdle);
            setIsPreview(sharedPreviewActive);
        };
        idleListeners.add(listener);
        previewListeners.add(listener);
        return () => {
            idleListeners.delete(listener);
            previewListeners.delete(listener);
        };
    }, []);

    const wakeUp = useCallback(() => {
        if (Date.now() < sharedPreviewLockoutUntil) return;
        reportActivity();
        if (sharedPreviewActive) {
            dismissScreensaverPreview();
        }
    }, []);

    const overlayVisible =
        sharedPreviewActive ||
        (!standaloneEnabled && screensaverArmed && isIdle) ||
        (standaloneEnabled && isStandaloneIdle);

    // Gamepad activity resets the idle timers and dismisses the overlay. The
    // catch-all handler never consumes events, so navigation keeps working.
    const shouldListen = screensaverArmed || overlayVisible || standaloneEnabled;

    const changeScreensaverMode = useCallback(
        async (mode: ScreensaverMode) => {
            try {
                await setScreensaverModeCall(mode);
            } catch (e) {
                console.error("[AlarMe] Failed to set screensaver mode:", e);
            }
        },
        [],
    );

    const changeDimOpacity = useCallback(
        async (opacity: number) => {
            try {
                await setScreensaverModeCall(effectiveMode, opacity);
            } catch (e) {
                console.error("[AlarMe] Failed to set dim opacity:", e);
            }
        },
        [effectiveMode],
    );

    useEffect(() => {
        const handleStatusUpdate = (status: SleepInhibitorStatus) => {
            setInhibitorActive(status.active);
            setScreensaverArmed(status.active && hasScreensaverItem(status.items));
            if (status.screensaver_idle_seconds !== undefined) {
                setIdleSeconds(status.screensaver_idle_seconds);
            }
            if (status.overlay_during_screensaver !== undefined) {
                setOverlayDuring(status.overlay_during_screensaver);
            }
            if (status.active) {
                setDimOpacity(status.screensaver_dim_opacity ?? 0.92);
            } else {
                sharedIsIdle = false;
                setIsIdle(false);
                stopSharedIdleTimer();
                notifyIdleListeners();
            }
        };

        addEventListener("alarme_sleep_inhibitor_updated", handleStatusUpdate);

        getScreensaverState()
            .then((state) => {
                setInhibitorActive(!!state.active);
                setScreensaverArmed(!!state.active && hasScreensaverItem(state.items));
                setDimOpacity(state.screensaver_dim_opacity ?? 0.92);
                setIdleSeconds(state.screensaver_idle_seconds ?? 15);
                setOverlayDuring(state.overlay_during_screensaver ?? true);
            })
            .catch((e) =>
                console.error("[AlarMe] Failed to load screensaver state:", e),
            );

        return () => {
            removeEventListener(
                "alarme_sleep_inhibitor_updated",
                handleStatusUpdate,
            );
        };
    }, []);

    // Inhibitor idle timer — skipped when standalone is enabled
    // (standalone mode takes over screensaver responsibility)
    useEffect(() => {
        if (screensaverArmed && !standaloneEnabled) {
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
    }, [screensaverArmed, idleSeconds, standaloneEnabled]);

    // Standalone idle timer
    useEffect(() => {
        if (standaloneEnabled && !sharedPreviewActive && !screensaverArmed) {
            sharedStandaloneIdle = false;
            setIsStandaloneIdle(false);
            startStandaloneTimer(standaloneIdleSeconds);
            notifyIdleListeners();
        }
        if (!standaloneEnabled || sharedPreviewActive || screensaverArmed) {
            stopStandaloneTimer();
            sharedStandaloneIdle = false;
            setIsStandaloneIdle(false);
            notifyIdleListeners();
        }
    }, [
        standaloneEnabled,
        standaloneIdleSeconds,
        screensaverArmed,
        sharedPreviewActive,
    ]);

    return {
        effectiveMode,
        dimOpacity,
        inhibitorActive,
        screensaverArmed,
        isIdle,
        isStandaloneIdle,
        overlayVisible,
        overlayDuring,
        shouldListen,
        wakeUp,
        reportActivity,
        setScreensaverMode: changeScreensaverMode,
        setDimOpacity: changeDimOpacity,
        isPreview: sharedPreviewActive,
        standaloneEnabled,
    };
}
