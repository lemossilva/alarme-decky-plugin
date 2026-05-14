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

function normalize(data: unknown): BatteryInfo {
    if (!data || typeof data !== "object") return { ...emptyInfo };
    const d = data as Record<string, unknown>;
    return {
        percent: typeof d.percent === "number" && Number.isFinite(d.percent) ? d.percent : null,
        charging: typeof d.charging === "boolean" ? d.charging : null,
        time_to_empty_sec:
            typeof d.time_to_empty_sec === "number" && Number.isFinite(d.time_to_empty_sec)
                ? d.time_to_empty_sec
                : null,
        time_to_full_sec:
            typeof d.time_to_full_sec === "number" && Number.isFinite(d.time_to_full_sec)
                ? d.time_to_full_sec
                : null,
        ok: Boolean(d.ok),
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
                setInfo(normalize(data));
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
