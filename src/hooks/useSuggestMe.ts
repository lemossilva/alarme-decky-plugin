import { useState, useEffect, useCallback, useRef } from "react";
import { callable } from "@decky/api";
import type { SuggestMeStatus, SuggestMeCard, SuggestMeFilterPreset } from "../types";

declare var DeckyBackend: {
    call: <Return = any>(route: string, ...args: any[]) => Promise<Return>;
};

const getStatus = callable<[], SuggestMeStatus>("get_suggestme_status");
const getDailyCard = callable<[], SuggestMeCard>("get_suggestme_daily_card");
const saveDailyCard = callable<[payload: SuggestMeCard], boolean>("save_suggestme_daily_card");

const ALLOWED_MODES = ["intelligent", "luck", "guided", "fresh_air"] as const;

async function callSuggestMe<R = any>(method: string, ...args: any[]): Promise<R> {
    return DeckyBackend.call<R>("loader/call_plugin_method", "SuggestMe", method, ...args);
}

async function fetchPresets(): Promise<(SuggestMeFilterPreset | null)[]> {
    try {
        const result = await callSuggestMe<{ presets: (SuggestMeFilterPreset | null)[] }>("get_filter_presets");
        return result?.presets ?? [];
    } catch {
        return [];
    }
}

async function fetchSuggestion(mode: string, filters: Record<string, unknown>): Promise<SuggestMeCard> {
    try {
        const result = await callSuggestMe<SuggestMeCard>("get_suggestion", mode, filters);
        return result ?? { game: null, error: "Empty response" };
    } catch (e: any) {
        return { game: null, error: e?.message ?? "Failed to reach SuggestMe" };
    }
}

export function useSuggestMeStatus() {
    const [status, setStatus] = useState<SuggestMeStatus | null>(null);

    useEffect(() => {
        let cancelled = false;
        getStatus().then((s) => {
            if (!cancelled) setStatus(s);
        }).catch(() => {
            if (!cancelled) setStatus({ available: false, version: null, compatible: false });
        });
        return () => { cancelled = true; };
    }, []);

    return status;
}

export function useSuggestMePresets(enabled: boolean) {
    const [presets, setPresets] = useState<(SuggestMeFilterPreset | null)[]>([]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        fetchPresets().then((p) => {
            if (!cancelled) setPresets(p);
        });
        return () => { cancelled = true; };
    }, [enabled]);

    return presets;
}

export function useSuggestMeCard(
    show: boolean,
    mode: string,
    presetSlot: number,
    strategy: "daily" | "shuffle",
    presets: (SuggestMeFilterPreset | null)[]
) {
    const [card, setCard] = useState<SuggestMeCard | null>(null);
    const [loading, setLoading] = useState(false);
    const fetchedRef = useRef(false);
    const dailyCardRef = useRef<SuggestMeCard | null>(null);
    const mountedRef = useRef(true);
    const fetchInFlightRef = useRef(false);
    const presetsRef = useRef(presets);
    presetsRef.current = presets;

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const doFetch = useCallback(async () => {
        if (!show || fetchInFlightRef.current) return;

        const validMode = ALLOWED_MODES.includes(mode as any) ? mode : "intelligent";
        const curPresets = presetsRef.current;
        const preset = (presetSlot >= 0 && presetSlot < curPresets.length) ? curPresets[presetSlot] : null;
        const filters = preset?.filters ?? {};

        fetchInFlightRef.current = true;
        setLoading(true);
        try {
            const result = await fetchSuggestion(validMode, filters);
            if (!mountedRef.current) return;
            setCard(result);
            if (strategy === "daily" && result.game) {
                dailyCardRef.current = result;
                await saveDailyCard(result);
            }
        } finally {
            fetchInFlightRef.current = false;
            if (mountedRef.current) setLoading(false);
        }
    }, [show, mode, presetSlot, strategy]);

    useEffect(() => {
        if (!show) {
            if (strategy !== "daily") {
                setCard(null);
                fetchedRef.current = false;
            }
            return;
        }

        if (strategy === "daily") {
            if (dailyCardRef.current?.game) {
                setCard(dailyCardRef.current);
                fetchedRef.current = true;
                return;
            }

            getDailyCard().then((cached) => {
                if (!mountedRef.current) return;
                if (cached?.game) {
                    dailyCardRef.current = cached;
                    setCard(cached);
                    fetchedRef.current = true;
                } else if (!fetchedRef.current && !fetchInFlightRef.current) {
                    fetchedRef.current = true;
                    doFetch();
                }
            }).catch(() => {
                if (!fetchedRef.current && !fetchInFlightRef.current && mountedRef.current) {
                    fetchedRef.current = true;
                    doFetch();
                }
            });
        } else {
            if (!fetchedRef.current) {
                fetchedRef.current = true;
                doFetch();
            }
        }
    }, [show, strategy, doFetch]);

    return { card, loading, refetch: doFetch };
}

export { fetchPresets, ALLOWED_MODES };
