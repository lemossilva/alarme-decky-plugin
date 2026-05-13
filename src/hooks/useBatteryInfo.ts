import { useState, useEffect, useRef } from "react";
import { callable } from "@decky/api";
import type { BatteryInfo } from "../types";

const getBatteryInfoCall = callable<[], BatteryInfo>("get_battery_info");

const emptyInfo: BatteryInfo = {
    percent: null,
    charging: null,
    time_to_empty_sec: null,
    time_to_full_sec: null,
    ok: false,
};

function normalize(data: Record<string, unknown> | null | undefined): BatteryInfo {
    if (!data || typeof data !== "object") return { ...emptyInfo };
    return {
        percent: typeof data.percent === "number" && Number.isFinite(data.percent) ? data.percent : null,
        charging: typeof data.charging === "boolean" ? data.charging : null,
        time_to_empty_sec:
            typeof data.time_to_empty_sec === "number" && Number.isFinite(data.time_to_empty_sec)
                ? data.time_to_empty_sec
                : null,
        time_to_full_sec:
            typeof data.time_to_full_sec === "number" && Number.isFinite(data.time_to_full_sec)
                ? data.time_to_full_sec
                : null,
        ok: Boolean(data.ok),
    };
}

export function useBatteryInfo(show: boolean): BatteryInfo {
    const [info, setInfo] = useState<BatteryInfo>(emptyInfo);
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
                const data = await getBatteryInfoCall();
                setInfo(normalize(data as Record<string, unknown>));
            } catch (e) {
                console.error("[AlarMe] Failed to fetch battery info:", e);
                setInfo(emptyInfo);
            }
        };

        void fetch();
        intervalRef.current = setInterval(() => void fetch(), 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [show]);

    return info;
}
