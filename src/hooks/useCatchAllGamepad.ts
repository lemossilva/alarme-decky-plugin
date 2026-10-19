import { useCallback, useRef } from "react";

type GamepadHandler = (...args: unknown[]) => void;

/**
 * Captures all gamepad input through SteamUI's NavigationManager.
 *
 * Current Steam clients keep a stack of catch-all handlers: `SetCatchAllGamepadInput`
 * pushes and returns `{ Unregister }`, and the dispatcher calls every entry on each
 * button event without a guard. Pushing `null` or throwing from a handler breaks
 * controller input until Steam restarts. Older clients used a single slot cleared
 * with `null` and returned nothing.
 *
 * The plugin can mount before SteamUI finishes wiring up its NavigationManager
 * (typically right after a Steam Deck reboot), so subscribe rebinds when the
 * `SteamUIStore.NavigationManager` instance changed and is a no-op otherwise.
 */
export const useCatchAllGamepad = () => {
    const releaseRef = useRef<(() => void) | null>(null);
    const navManagerRef = useRef<any>(null);
    const handlerRef = useRef<GamepadHandler | null>(null);

    const release = useCallback(() => {
        const releaseHandle = releaseRef.current;
        releaseRef.current = null;
        navManagerRef.current = null;
        handlerRef.current = null;
        if (!releaseHandle) return;
        try {
            releaseHandle();
        } catch (e) {
            console.warn("[AlarMe] Failed to release gamepad capture", e);
        }
    }, []);

    const subscribe = useCallback((handler: GamepadHandler) => {
        const navManager = (window as any)?.SteamUIStore?.NavigationManager;
        if (!navManager?.SetCatchAllGamepadInput) {
            return false;
        }

        handlerRef.current = handler;
        if (releaseRef.current && navManagerRef.current === navManager) {
            return true;
        }

        release();
        handlerRef.current = handler;

        const guarded = (...args: unknown[]) => {
            try {
                handlerRef.current?.(...args);
            } catch (e) {
                console.error("[AlarMe] Gamepad handler error", e);
            }
            return false;
        };

        const registration = navManager.SetCatchAllGamepadInput(guarded);
        navManagerRef.current = navManager;

        if (typeof registration === "function") {
            releaseRef.current = registration;
        } else if (typeof registration?.Unregister === "function") {
            releaseRef.current = () => registration.Unregister();
        } else {
            releaseRef.current = () => {
                if (navManager.m_rgCatchAllGamepadInput === undefined) {
                    navManager.SetCatchAllGamepadInput(null);
                }
            };
        }

        return true;
    }, [release]);

    return { subscribe, release };
};
