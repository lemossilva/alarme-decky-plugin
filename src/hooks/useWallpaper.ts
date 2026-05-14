import { useState, useEffect, useCallback, useRef } from "react";
import { callable } from "@decky/api";
import { useSettings } from "./useSettings";
import type { WallpaperProvider, WallpaperState, WallpaperAttribution } from "../types";

/** Must match main.py _WALLPAPER_POOL_MAX */
export const WALLPAPER_POOL_MAX = 20;

const WALLPAPER_POOL_DEBOUNCE_MS = 500;
const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;

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
    {
        success: boolean;
        url: string | null;
        provider_status?: string;
        last_fetch?: string;
        attribution?: WallpaperAttribution | null;
    }
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

    const [state, setState] = useState<WallpaperState>({ url: null, provider: "none", attribution: null });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [status, setStatus] = useState<WallpaperStatus>({ reachable: null, checking: false, lastFetch: null, errorMessage: null });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const slotRef = useRef(0);
    const rotationOrderRef = useRef<number[]>([0]);
    const rotationPosRef = useRef(0);
    const mountedRef = useRef(true);
    const dailyRefreshAttemptedRef = useRef<string | null>(null);

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
                setState({ url: null, provider: "none", attribution: null });
                return;
            }
            if (!mountedRef.current) return;
            setLoading(true);
            setError(false);
            try {
                const result = await fetchWallpaperCall(provider, slot);
                if (!mountedRef.current) return;
                if (result.success && result.url) {
                    const attr = result.attribution;
                    const attribution =
                        attr && (attr.title || attr.credit)
                            ? { title: attr.title ?? null, credit: attr.credit ?? null }
                            : null;
                    setState({ url: result.url, provider, attribution });
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
        const isDailySingle = provider === "bing_daily" || provider === "nasa_apod";
        const shouldRefreshDaily = (() => {
            if (isDailySingle) return true;
            const updated = settings.screensaver_wallpaper_cache_updated_at;
            if (!updated) return true;
            const ts = Date.parse(updated);
            if (!Number.isFinite(ts)) return true;
            return (Date.now() - ts) >= DAILY_REFRESH_MS;
        })();
        const dailyKey = `${provider}:${debouncedPoolSize}:${settings.screensaver_wallpaper_cache_updated_at ?? "none"}:${(settings.screensaver_nasa_api_key || "").trim()}`;
        if (dailyRefreshAttemptedRef.current === dailyKey) return;

        const run = async () => {
            if (provider === "local_folder") {
                await prefetchWallpapersCall(provider, debouncedPoolSize);
                return;
            }

            if (!shouldRefreshDaily) return;
            const reachability = await checkProviderCall(provider);
            if (!reachability.reachable) return;
            await prefetchWallpapersCall(provider, debouncedPoolSize);
        };

        dailyRefreshAttemptedRef.current = dailyKey;
        run().catch(e => {
            if (!cancelled) console.error("[AlarMe] prefetch_wallpapers:", e);
        });
        return () => {
            cancelled = true;
        };
    }, [screensaverMode, provider, debouncedPoolSize, settings.screensaver_wallpaper_cache_updated_at, settings.screensaver_nasa_api_key]);

    // Eagerly fetch the first wallpaper when screensaver is set to wallpaper mode
    // but the screensaver is not yet visible. This guarantees the image is in state
    // before the overlay fades in, eliminating the "Loading wallpaper…" flash.
    const eagerFetchedRef = useRef(false);
    useEffect(() => {
        if (show || provider === "none" || screensaverMode !== "wallpaper") {
            eagerFetchedRef.current = false;
            return;
        }
        if (eagerFetchedRef.current) return;
        eagerFetchedRef.current = true;
        const firstSlot = 0;
        slotRef.current = firstSlot;
        fetchWallpaperAtSlot(firstSlot);
    }, [show, provider, screensaverMode, fetchWallpaperAtSlot]);

    useEffect(() => {
        if (!show || provider === "none") {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            // Keep the cached image so there is no flash when the screensaver fades in.
            // Only clear when the provider itself is none.
            if (provider === "none") {
                setState({ url: null, provider: "none", attribution: null });
            }
            setLoading(false);
            setError(false);
            return;
        }

        // If an eager fetch already populated state, skip the initial fetch.
        const hasEagerImage = state.url != null && state.provider === provider;

        const order = shuffledSlotIndices(debouncedPoolSize);
        rotationOrderRef.current = order;
        rotationPosRef.current = 0;
        const firstSlot = order[0] ?? 0;
        slotRef.current = firstSlot;
        if (!hasEagerImage) {
            fetchWallpaperAtSlot(firstSlot);
        }
        checkProvider();

        const advanceRotation = () => {
            let ord = rotationOrderRef.current;
            let pos = rotationPosRef.current + 1;
            const lastSlot = slotRef.current;
            if (pos >= ord.length) {
                ord = shuffledSlotIndices(debouncedPoolSize);
                if (debouncedPoolSize > 1 && ord.length > 0 && ord[0] === lastSlot) {
                    const swapIdx = ord.findIndex((s) => s !== lastSlot);
                    if (swapIdx > 0) {
                        const t = ord[0]!;
                        ord[0] = ord[swapIdx]!;
                        ord[swapIdx] = t;
                    }
                }
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
