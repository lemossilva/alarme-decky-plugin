import { useState, useEffect, useRef } from "react";
import { callable } from "@decky/api";
import type { WifiInfo } from "../types";

const getWifiInfoCall = callable<[], WifiInfo>("get_wifi_info");

export function useWifiInfo(show: boolean): WifiInfo {
    const [info, setInfo] = useState<WifiInfo>({ ssid: null, signal: null });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!show) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
        }

        const fetch = async () => {
            try {
                const data = await getWifiInfoCall();
                setInfo(data);
            } catch (e) {
                console.error("[AlarMe] Failed to fetch Wi-Fi info:", e);
            }
        };

        fetch();
        intervalRef.current = setInterval(fetch, 30000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [show]);

    return info;
}
