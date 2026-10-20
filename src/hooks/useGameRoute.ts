import { Router } from "@decky/ui";
import { useEffect, useState } from "react";

const APP_RUNNING_ROUTE = "/apprunning";
const POLL_MS = 500;

let warnedUnreadable = false;

interface MainWindowRouter {
    LocationPathName?: string;
    BRouteMatch?: (path: string) => boolean;
}

/** True when the Steam main window shows the running game with no page on top; null when Steam does not expose the route. */
export function readOnGameRoute(): boolean | null {
    const main = Router.WindowStore?.GamepadUIMainWindowInstance as unknown as MainWindowRouter | undefined;
    if (!main) return null;
    try {
        if (typeof main.BRouteMatch === "function") return !!main.BRouteMatch(APP_RUNNING_ROUTE);
        if (typeof main.LocationPathName === "string") return main.LocationPathName.startsWith(APP_RUNNING_ROUTE);
    } catch (e) {
        console.warn("[AlarMe] Failed to read the Steam route", e);
    }
    return null;
}

/**
 * Tracks whether the in-game screen is showing. Polls only while `active`.
 * An unreadable route reports false so callers never claim the screen from Steam's own pages.
 */
export function useOnGameRoute(active: boolean): boolean {
    const [onGameRoute, setOnGameRoute] = useState(false);

    useEffect(() => {
        if (!active) {
            setOnGameRoute(false);
            return;
        }

        const update = () => {
            const route = readOnGameRoute();
            if (route === null && !warnedUnreadable) {
                warnedUnreadable = true;
                console.warn("[AlarMe] Steam route is not readable; the overlay HUD will not request composition");
            }
            setOnGameRoute(route === true);
        };

        update();
        const timer = window.setInterval(update, POLL_MS);
        return () => window.clearInterval(timer);
    }, [active]);

    return onGameRoute;
}
