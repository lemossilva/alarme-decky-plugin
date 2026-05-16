import { useCallback, useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import { useSettings } from "./useSettings";

const fetchNewsCall = callable<[], Record<string, unknown>>("fetch_news");

export interface NewsItem {
    id: string;
    title: string;
    url: string;
    source_id: string;
    source_label: string;
    published_ts: number;
}

export interface NewsFeedStatus {
    ok: boolean;
    error: string | null;
    count: number;
}

export interface NewsData {
    items: NewsItem[];
    feeds: Record<string, NewsFeedStatus>;
    fetchedAt: string | null;
    stale: boolean;
    offline: boolean;
    fromCache: boolean;
    loading: boolean;
    error: string | null;
}

const INITIAL_NEWS: NewsData = {
    items: [],
    feeds: {},
    fetchedAt: null,
    stale: false,
    offline: false,
    fromCache: false,
    loading: false,
    error: null,
};

let sharedData: NewsData = { ...INITIAL_NEWS };
let sharedIntervalMs = 30 * 60 * 1000;
let sharedIntervalId: ReturnType<typeof setInterval> | null = null;
let prefetchEnabled = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
    listeners.forEach((fn) => fn());
}

function readPublishedTs(v: unknown): number {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

function parseItem(raw: Record<string, unknown>): NewsItem | null {
    const id = typeof raw.id === "string" ? raw.id : "";
    const title = typeof raw.title === "string" ? raw.title : "";
    const url = typeof raw.url === "string" ? raw.url : "";
    const source_id = typeof raw.source_id === "string" ? raw.source_id : "";
    const source_label = typeof raw.source_label === "string" ? raw.source_label : "";
    const published_ts = readPublishedTs(raw.published_ts);

    if (!id || !title || !url) return null;

    return { id, title, url, source_id, source_label, published_ts };
}

function parseFeeds(raw: unknown): Record<string, NewsFeedStatus> {
    if (!raw || typeof raw !== "object") return {};
    const result: Record<string, NewsFeedStatus> = {};
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
        if (val && typeof val === "object") {
            const v = val as Record<string, unknown>;
            result[key] = {
                ok: v.ok === true,
                error: typeof v.error === "string" ? v.error : null,
                count: typeof v.count === "number" ? v.count : 0,
            };
        }
    }
    return result;
}

function parseResponse(raw: Record<string, unknown>): Omit<NewsData, "loading"> {
    const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
    const items = itemsRaw
        .map((i) => (typeof i === "object" && i ? parseItem(i as Record<string, unknown>) : null))
        .filter((i): i is NewsItem => i !== null);

    const feeds = parseFeeds(raw.feeds);
    const fetchedAt = typeof raw.fetched_at === "string" ? raw.fetched_at : null;
    const stale = raw.stale === true;
    const offline = raw.offline === true;
    const fromCache = raw.from_cache === true;

    const err =
        typeof raw.error === "string"
            ? raw.error
            : raw.error != null
              ? String(raw.error)
              : null;

    return {
        items,
        feeds,
        fetchedAt,
        stale,
        offline,
        fromCache,
        error: err,
    };
}

function stopSharedInterval() {
    if (sharedIntervalId) {
        clearInterval(sharedIntervalId);
        sharedIntervalId = null;
    }
}

function startSharedInterval() {
    stopSharedInterval();
    if (!prefetchEnabled) return;
    sharedIntervalId = setInterval(() => {
        void fetchNewsShared();
    }, sharedIntervalMs);
}

export function applyNewsFromRaw(raw: Record<string, unknown> | null | undefined) {
    const parsed = parseResponse(raw || {});
    sharedData = { ...parsed, loading: false };
    notifyListeners();
}

export async function fetchNewsShared(): Promise<void> {
    if (inFlight) return inFlight;

    if (!sharedData.fetchedAt) {
        sharedData = { ...sharedData, loading: true, error: null };
        notifyListeners();
    }

    inFlight = (async () => {
        try {
            const raw = await fetchNewsCall();
            applyNewsFromRaw(raw || {});
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            sharedData = {
                ...sharedData,
                loading: false,
                error: msg,
            };
            notifyListeners();
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

export function setNewsPrefetch(enabled: boolean, intervalMs: number) {
    prefetchEnabled = enabled;
    sharedIntervalMs = intervalMs;
    if (!enabled) {
        stopSharedInterval();
        return;
    }
    void fetchNewsShared();
    startSharedInterval();
}

export function useNewsPrefetch(enabled: boolean) {
    const { settings } = useSettings();
    const refreshMin = Math.max(5, Math.min(Number(settings.screensaver_news_refresh_minutes) || 30, 180));
    const intervalMs = refreshMin * 60 * 1000;

    useEffect(() => {
        setNewsPrefetch(enabled, intervalMs);
        return () => setNewsPrefetch(false, intervalMs);
    }, [enabled, intervalMs]);
}

export function useNews(show: boolean) {
    const [, bump] = useState(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        const listener = () => {
            if (mountedRef.current) bump((n) => n + 1);
        };
        listeners.add(listener);
        return () => {
            mountedRef.current = false;
            listeners.delete(listener);
        };
    }, []);

    const refetch = useCallback(() => fetchNewsShared(), []);

    useEffect(() => {
        if (!show) return undefined;
        if (!sharedData.fetchedAt && !sharedData.loading && !inFlight) {
            void fetchNewsShared();
        }
        return undefined;
    }, [show]);

    return { ...sharedData, refetch };
}
