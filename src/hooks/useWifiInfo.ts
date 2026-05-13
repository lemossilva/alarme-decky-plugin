import { useState, useEffect, useRef } from "react";
import { callable } from "@decky/api";
import type { WifiInfo } from "../types";

const getWifiInfoCall = callable<[], WifiInfo>("get_wifi_info");

const emptyInfo: WifiInfo = {
    ssid: null,
    signal: null,
    connection_type: "none",
    link_speed_mbps: null,
    ipv4: null,
    ipv6: [],
};

export function useWifiInfo(show: boolean): WifiInfo {
    const [info, setInfo] = useState<WifiInfo>(emptyInfo);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!show) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setInfo(emptyInfo);
            return;
        }

        const fetch = async () => {
            try {
                const data = await getWifiInfoCall();
                setInfo({
                    ssid: data?.ssid ?? null,
                    signal: data?.signal ?? null,
                    connection_type: data?.connection_type ?? "none",
                    link_speed_mbps: data?.link_speed_mbps ?? null,
                    ipv4: data?.ipv4 ?? null,
                    ipv6: Array.isArray(data?.ipv6) ? data.ipv6 : [],
                });
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
