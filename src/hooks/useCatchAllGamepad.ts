import { useCallback, useRef } from "react";

type ReleaseHandle = (() => void) | null;

/**
 * Captures all gamepad input through SteamUI's NavigationManager.
 *
 * The plugin can mount before SteamUI finishes wiring up its NavigationManager
 * (typically right after a Steam Deck reboot). Caching the first reference we
 * see leaves us bound to a stale manager that never delivers events, so every
 * subscribe call rebinds against a fresh `SteamUIStore.NavigationManager`.
 */
export const useCatchAllGamepad = () => {
    const releaseRef = useRef<ReleaseHandle>(null);
    const navManagerRef = useRef<any>(null);
    const handlerRef = useRef<((navEvent: unknown, rawEvent: unknown) => void) | null>(null);

    const release = useCallback(() => {
        if (releaseRef.current) {
            try {
                releaseRef.current();
            } catch {
                // ignore; SteamUI may already have detached the handler
            }
        } else if (navManagerRef.current?.SetCatchAllGamepadInput) {
            try {
                navManagerRef.current.SetCatchAllGamepadInput(null);
            } catch {
                // ignore
            }
        }

        navManagerRef.current = null;
        releaseRef.current = null;
        handlerRef.current = null;
    }, []);

    const subscribe = useCallback((handler: (navEvent: unknown, rawEvent: unknown) => void) => {
        const navManager = (window as any)?.SteamUIStore?.NavigationManager;
        if (!navManager?.SetCatchAllGamepadInput) {
            return false;
        }

        // Drop any prior binding so we always attach to the current manager.
        if (releaseRef.current) {
            try {
                releaseRef.current();
            } catch {
                // ignore
            }
        } else if (navManagerRef.current?.SetCatchAllGamepadInput) {
            try {
                navManagerRef.current.SetCatchAllGamepadInput(null);
            } catch {
                // ignore
            }
        }
        releaseRef.current = null;
        navManagerRef.current = null;

        navManagerRef.current = navManager;
        handlerRef.current = handler;
        const releaseHandle = navManager.SetCatchAllGamepadInput(handler);

        if (typeof releaseHandle === "function") {
            releaseRef.current = releaseHandle;
        } else {
            releaseRef.current = () => {
                try {
                    navManager.SetCatchAllGamepadInput(null);
                } catch {
                    // ignore
                }
            };
        }

        return true;
    }, []);

    return { subscribe, release };
};
