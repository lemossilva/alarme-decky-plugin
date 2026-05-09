import { useState, useEffect, useRef } from "react";
import { callable } from "@decky/api";
import type { SystemStats } from "../types";

const getSystemStatsCall = callable<[], SystemStats>("get_system_stats");

export function useSystemStats(show: boolean): SystemStats {
    const [stats, setStats] = useState<SystemStats>({
        cpu_temp: null, cpu_usage: null, ram_used_gb: null,
        ram_total_gb: null, gpu_temp: null, fan_rpm: null
    });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!show) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
        }

        const fetch = async () => {
            try {
                const data = await getSystemStatsCall();
                setStats(data);
            } catch (e) {
                console.error("[AlarMe] Failed to fetch system stats:", e);
            }
        };

        fetch();
        intervalRef.current = setInterval(fetch, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [show]);

    return stats;
}
