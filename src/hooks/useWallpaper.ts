import { useState, useEffect, useCallback, useRef } from "react";
import { callable } from "@decky/api";
import { useSettings } from "./useSettings";
import type { WallpaperProvider, WallpaperState } from "../types";

/** Must match main.py _WALLPAPER_POOL_MAX */
export const WALLPAPER_POOL_MAX = 20;

const WALLPAPER_POOL_DEBOUNCE_MS = 500;

function shuffledSlotIndices(pool: number): number[] {
    if (pool <= 0) return [];
    if (pool === 1) return [0];
    const indices = Array.from({ length: pool }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const a = indices[i]!;
        const b = indices[j]!;
        indices[i] = b;
        indices[j] = a;
    }
    return indices;
}

export function clampWallpaperPoolSize(raw: number | undefined): number {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n)) return 5;
    return Math.max(1, Math.min(WALLPAPER_POOL_MAX, n));
}

const fetchWallpaperCall = callable<
    [provider: string, slot?: number],
    { success: boolean; url: string | null; provider_status?: string; last_fetch?: string }
>("fetch_wallpaper");
const checkProviderCall = callable<[provider: string], { reachable: boolean; message?: string }>("check_wallpaper_provider");
const prefetchWallpapersCall = callable<[provider: string, count?: number], { success: boolean; provider_status?: string }>(
    "prefetch_wallpapers"
);

export interface WallpaperStatus {
    reachable: boolean | null;
    checking: boolean;
    lastFetch: string | null;
    errorMessage: string | null;
}

export function useWallpaper(show: boolean): WallpaperState & { refresh: () => void; loading: boolean; error: boolean; status: WallpaperStatus } {
    const { settings } = useSettings();
    const screensaverMode = settings.screensaver_mode ?? "dim";
    const provider = (settings.screensaver_wallpaper_provider || "picsum") as WallpaperProvider;
    const interval = settings.screensaver_wallpaper_interval || 300;
    const poolSize = clampWallpaperPoolSize(settings.screensaver_wallpaper_pool_size);
    const autoRotate = settings.screensaver_wallpaper_auto_rotate ?? true;

    const [debouncedPoolSize, setDebouncedPoolSize] = useState(poolSize);
    useEffect(() => {
        const id = window.setTimeout(() => setDebouncedPoolSize(poolSize), WALLPAPER_POOL_DEBOUNCE_MS);
        return () => window.clearTimeout(id);
    }, [poolSize]);

    const [state, setState] = useState<WallpaperState>({ url: null, provider: "none" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [status, setStatus] = useState<WallpaperStatus>({ reachable: null, checking: false, lastFetch: null, errorMessage: null });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const slotRef = useRef(0);
    const rotationOrderRef = useRef<number[]>([0]);
    const rotationPosRef = useRef(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const checkProvider = useCallback(async () => {
        if (provider === "none") {
            if (!mountedRef.current) return;
            setStatus({ reachable: null, checking: false, lastFetch: null, errorMessage: null });
            return;
        }
        if (!mountedRef.current) return;
        setStatus(prev => ({ ...prev, checking: true, errorMessage: null }));
        try {
            const result = await checkProviderCall(provider);
            if (!mountedRef.current) return;
            setStatus(prev => ({
                ...prev,
                reachable: result.reachable,
                checking: false,
                errorMessage: result.reachable ? null : result.message || "Unreachable",
            }));
        } catch (e) {
            console.error("[AlarMe] Failed to check wallpaper provider:", e);
            if (!mountedRef.current) return;
            setStatus(prev => ({ ...prev, reachable: false, checking: false, errorMessage: "Check failed" }));
        }
    }, [provider]);

    const fetchWallpaperAtSlot = useCallback(
        async (slot: number) => {
            if (provider === "none") {
                if (!mountedRef.current) return;
                setState({ url: null, provider: "none" });
                return;
            }
            if (!mountedRef.current) return;
            setLoading(true);
            setError(false);
            try {
                const result = await fetchWallpaperCall(provider, slot);
                if (!mountedRef.current) return;
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
                if (!mountedRef.current) return;
                setError(true);
                setStatus(prev => ({ ...prev, errorMessage: "Network error" }));
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        },
        [provider]
    );

    useEffect(() => {
        if (screensaverMode !== "wallpaper" || provider === "none") return;

        let cancelled = false;
        prefetchWallpapersCall(provider, debouncedPoolSize).catch(e => {
            if (!cancelled) console.error("[AlarMe] prefetch_wallpapers:", e);
        });
        return () => {
            cancelled = true;
        };
    }, [screensaverMode, provider, debouncedPoolSize]);

    useEffect(() => {
        if (!show || provider === "none") {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setState({ url: null, provider: "none" });
            setLoading(false);
            setError(false);
            return;
        }

        const order = shuffledSlotIndices(debouncedPoolSize);
        rotationOrderRef.current = order;
        rotationPosRef.current = 0;
        const firstSlot = order[0] ?? 0;
        slotRef.current = firstSlot;
        fetchWallpaperAtSlot(firstSlot);
        checkProvider();

        const advanceRotation = () => {
            let ord = rotationOrderRef.current;
            let pos = rotationPosRef.current + 1;
            if (pos >= ord.length) {
                ord = shuffledSlotIndices(debouncedPoolSize);
                rotationOrderRef.current = ord;
                pos = 0;
            }
            rotationPosRef.current = pos;
            const slot = ord[pos] ?? 0;
            slotRef.current = slot;
            fetchWallpaperAtSlot(slot);
        };

        if (autoRotate) {
            intervalRef.current = setInterval(advanceRotation, interval * 1000);
        } else {
            intervalRef.current = null;
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [show, provider, interval, debouncedPoolSize, autoRotate, fetchWallpaperAtSlot, checkProvider]);

    useEffect(() => {
        if (provider === "none") {
            setStatus({ reachable: null, checking: false, lastFetch: null, errorMessage: null });
            return;
        }
        checkProvider();
    }, [provider, checkProvider]);

    const refresh = useCallback(() => fetchWallpaperAtSlot(slotRef.current), [fetchWallpaperAtSlot]);

    return { ...state, refresh, loading, error, status };
}
