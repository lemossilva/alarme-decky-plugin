import { useEffect, useState, useCallback } from "react";
import { addEventListener, removeEventListener, callable } from "@decky/api";
import { Navigation } from "@decky/ui";
import { useSettings } from "./useSettings";
import type { SleepInhibitorStatus } from "../types";

const getScreensaverState = callable<
    [],
    {
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
let sharedInhibitorActive = false;
let sharedEffectiveMode: string = "off";
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

    if (sharedInhibitorActive && sharedEffectiveMode !== "off") {
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

// --- React hook ---

export function useScreensaver() {
    const { settings } = useSettings();

    const effectiveMode =
        (settings.screensaver_mode as "off" | "black" | "dim" | "wallpaper") ||
        "off";

    const [dimOpacity, setDimOpacity] = useState(0.92);
    const [inhibitorActive, setInhibitorActive] = useState(false);
    const [idleSeconds, setIdleSeconds] = useState(15);
    const [overlayDuring, setOverlayDuring] = useState(true);
    const [isIdle, setIsIdle] = useState(sharedIsIdle);
    const [isStandaloneIdle, setIsStandaloneIdle] =
        useState(sharedStandaloneIdle);
    const [, setIsPreview] = useState(sharedPreviewActive);

    const standaloneEnabled = settings.screensaver_standalone_enabled ?? false;
    const standaloneIdleSeconds =
        settings.screensaver_standalone_idle_seconds ?? 60;

    // Sync module-level vars on every render so reportActivity sees latest values.
    useEffect(() => {
        sharedInhibitorActive = inhibitorActive;
        sharedEffectiveMode = effectiveMode;
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
        (!standaloneEnabled &&
            inhibitorActive &&
            effectiveMode !== "off" &&
            isIdle) ||
        (standaloneEnabled && effectiveMode !== "off" && isStandaloneIdle);

    // Gamepad capture: active when inhibitor is running (timer-based screensaver),
    // when overlay is visible (dismiss), OR when standalone is enabled (reset idle timer).
    // This is the same SetCatchAllGamepadInput that the timer-based screensaver uses —
    // it does NOT block Deck navigation because the handler doesn't consume events.
    const shouldListen =
        effectiveMode !== "off" &&
        (inhibitorActive || overlayVisible || standaloneEnabled);

    const changeScreensaverMode = useCallback(
        async (mode: "off" | "black" | "dim" | "wallpaper") => {
            try {
                await setScreensaverModeCall(mode);
            } catch (e) {
                console.error("Failed to set screensaver mode:", e);
            }
        },
        [],
    );

    const changeDimOpacity = useCallback(
        async (opacity: number) => {
            try {
                await setScreensaverModeCall(effectiveMode, opacity);
            } catch (e) {
                console.error("Failed to set dim opacity:", e);
            }
        },
        [effectiveMode],
    );

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
                setDimOpacity(state.screensaver_dim_opacity ?? 0.92);
                setIdleSeconds(state.screensaver_idle_seconds ?? 15);
                setOverlayDuring(state.overlay_during_screensaver ?? true);
            })
            .catch((e) =>
                console.error("Failed to load screensaver state:", e),
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
        if (inhibitorActive && effectiveMode !== "off" && !standaloneEnabled) {
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
    }, [inhibitorActive, effectiveMode, idleSeconds, standaloneEnabled]);

    // Standalone idle timer
    useEffect(() => {
        if (
            standaloneEnabled &&
            effectiveMode !== "off" &&
            !sharedPreviewActive &&
            !inhibitorActive
        ) {
            sharedStandaloneIdle = false;
            setIsStandaloneIdle(false);
            startStandaloneTimer(standaloneIdleSeconds);
            notifyIdleListeners();
        }
        if (
            !standaloneEnabled ||
            effectiveMode === "off" ||
            sharedPreviewActive ||
            inhibitorActive
        ) {
            stopStandaloneTimer();
            sharedStandaloneIdle = false;
            setIsStandaloneIdle(false);
            notifyIdleListeners();
        }
    }, [
        standaloneEnabled,
        effectiveMode,
        standaloneIdleSeconds,
        inhibitorActive,
        sharedPreviewActive,
    ]);

    return {
        effectiveMode,
        dimOpacity,
        inhibitorActive,
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
