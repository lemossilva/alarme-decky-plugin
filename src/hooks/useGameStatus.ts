import { useState, useEffect } from "react";
import { callable } from "@decky/api";

const getGameStatusCall = callable<[], boolean>('get_game_status');

declare const SteamClient: any;

export function useGameStatus() {
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        getGameStatusCall().then(setIsRunning);

        let unregister: any;

        const onGameLifetime = (update: any) => {
            if (update.bRunning !== undefined) {
                setIsRunning(update.bRunning);
            }
        };

        try {
            if (SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications) {
                unregister = SteamClient.GameSessions.RegisterForAppLifetimeNotifications(onGameLifetime);
            }
        } catch (e) {
            console.error("AlarMe: useGameStatus failed", e);
        }

        return () => {
            if (unregister) {
                if (typeof unregister === 'function') {
                    unregister();
                } else if (unregister.unregister) {
                    unregister.unregister();
                }
            }
        };
    }, []);

    return isRunning;
}
