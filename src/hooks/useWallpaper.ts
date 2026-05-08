import { useState, useEffect, useCallback, useRef } from "react";
import { callable } from "@decky/api";
import { useSettings } from "./useSettings";
import type { WallpaperProvider, WallpaperState } from "../types";

const fetchWallpaperCall = callable<[provider: string], { success: boolean; url: string | null; provider_status?: string; last_fetch?: string }>("fetch_wallpaper");
const checkProviderCall = callable<[provider: string], { reachable: boolean; message?: string }>("check_wallpaper_provider");

export interface WallpaperStatus {
    reachable: boolean | null;
    checking: boolean;
    lastFetch: string | null;
    errorMessage: string | null;
}

export function useWallpaper(show: boolean): WallpaperState & { refresh: () => void; loading: boolean; error: boolean; status: WallpaperStatus } {
    const { settings } = useSettings();
    const provider = (settings.screensaver_wallpaper_provider || "picsum") as WallpaperProvider;
    const interval = settings.screensaver_wallpaper_interval || 300;
    const [state, setState] = useState<WallpaperState>({ url: null, provider: "none" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [status, setStatus] = useState<WallpaperStatus>({ reachable: null, checking: false, lastFetch: null, errorMessage: null });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkProvider = useCallback(async () => {
        if (provider === "none") {
            setStatus({ reachable: null, checking: false, lastFetch: null, errorMessage: null });
            return;
        }
        setStatus(prev => ({ ...prev, checking: true, errorMessage: null }));
        try {
            const result = await checkProviderCall(provider);
            setStatus(prev => ({ ...prev, reachable: result.reachable, checking: false, errorMessage: result.reachable ? null : (result.message || "Unreachable") }));
        } catch (e) {
            console.error("[AlarMe] Failed to check wallpaper provider:", e);
            setStatus(prev => ({ ...prev, reachable: false, checking: false, errorMessage: "Check failed" }));
        }
    }, [provider]);

    const fetchWallpaper = useCallback(async () => {
        if (provider === "none") {
            setState({ url: null, provider: "none" });
            return;
        }
        setLoading(true);
        setError(false);
        try {
            const result = await fetchWallpaperCall(provider);
            if (result.success && result.url) {
                setState({ url: result.url, provider });
                setError(false);
                const now = new Date().toLocaleString();
                setStatus(prev => ({ ...prev, lastFetch: now, errorMessage: null }));
            } else {
                setError(true);
                setStatus(prev => ({ ...prev, errorMessage: result.provider_status || "Fetch failed" }));
            }
        } catch (e) {
            console.error("[AlarMe] Failed to fetch wallpaper:", e);
            setError(true);
            setStatus(prev => ({ ...prev, errorMessage: "Network error" }));
        } finally {
            setLoading(false);
        }
    }, [provider]);

    useEffect(() => {
        if (!show || provider === "none") {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setState({ url: null, provider: "none" });
            setLoading(false);
            setError(false);
            return;
        }

        fetchWallpaper();
        checkProvider();

        intervalRef.current = setInterval(fetchWallpaper, interval * 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [show, provider, fetchWallpaper, interval]);

    useEffect(() => {
        if (provider === "none") {
            setStatus({ reachable: null, checking: false, lastFetch: null, errorMessage: null });
            return;
        }
        checkProvider();
    }, [provider]);

    const refresh = useCallback(() => fetchWallpaper(), [fetchWallpaper]);

    return { ...state, refresh, loading, error, status };
}