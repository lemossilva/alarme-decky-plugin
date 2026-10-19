import { useCallback, useEffect, useRef, useState } from "react";
import { callable } from "@decky/api";
import { useSettings } from "./useSettings";

const fetchWeatherCall = callable<[], Record<string, unknown>>("fetch_weather");

export interface ForecastDay {
    date: string | null;
    high: number | null;
    low: number | null;
    code: number | null;
    precip_chance: number | null;
    precip_sum_mm: number | null;
    wind_speed_max_kmh: number | null;
    uv_index_max: number | null;
    humidity_mean: number | null;
}

export interface WeatherData {
    success: boolean;
    temperature: number | null;
    temperatureUnit: "C" | "F";
    weathercode: number | null;
    isDay: number | null;
    tempMax: number | null;
    tempMin: number | null;
    aqiUs: number | null;
    humidity: number | null;
    forecast: ForecastDay[];
    fetchedAt: string | null;
    error: string | null;
    loading: boolean;
}

const INITIAL_WEATHER: WeatherData = {
    success: false,
    temperature: null,
    temperatureUnit: "C",
    weathercode: null,
    isDay: null,
    tempMax: null,
    tempMin: null,
    aqiUs: null,
    humidity: null,
    forecast: [],
    fetchedAt: null,
    error: null,
    loading: false,
};

let sharedData: WeatherData = { ...INITIAL_WEATHER };
let sharedIntervalMs = 30 * 60 * 1000;
let sharedIntervalId: ReturnType<typeof setInterval> | null = null;
let prefetchEnabled = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
    listeners.forEach((fn) => fn());
}

function readNum(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function parseForecast(rawForecast: unknown): ForecastDay[] {
    if (!Array.isArray(rawForecast)) return [];
    return rawForecast.map((day: Record<string, unknown>) => ({
        date: typeof day.date === "string" ? day.date : null,
        high: readNum(day.high),
        low: readNum(day.low),
        code: readNum(day.code) as number | null,
        precip_chance: readNum(day.precip_chance) as number | null,
        precip_sum_mm: readNum(day.precip_sum_mm),
        wind_speed_max_kmh: readNum(day.wind_speed_max_kmh),
        uv_index_max: readNum(day.uv_index_max),
        humidity_mean: readNum(day.humidity_mean),
    }));
}

function parseResponse(raw: Record<string, unknown>): Omit<WeatherData, "loading"> {
    const unit = raw.temperature_unit === "F" ? "F" : "C";
    const err =
        typeof raw.error === "string"
            ? raw.error
            : raw.error != null
              ? String(raw.error)
              : null;
    const ok = raw.success === true && !err;
    return {
        success: ok,
        temperature: readNum(raw.temperature),
        temperatureUnit: unit,
        weathercode: readNum(raw.weathercode) as number | null,
        isDay: readNum(raw.is_day) as number | null,
        tempMax: readNum(raw.temp_max),
        tempMin: readNum(raw.temp_min),
        aqiUs: readNum(raw.aqi_us) as number | null,
        humidity: readNum(raw.humidity),
        forecast: parseForecast(raw.forecast),
        fetchedAt: typeof raw.fetched_at === "string" ? raw.fetched_at : null,
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
        void fetchWeatherShared();
    }, sharedIntervalMs);
}

export async function fetchWeatherShared(): Promise<void> {
    if (inFlight) return inFlight;

    if (!sharedData.fetchedAt) {
        sharedData = { ...sharedData, loading: true, error: null };
        notifyListeners();
    }

    inFlight = (async () => {
        try {
            const raw = await fetchWeatherCall();
            const parsed = parseResponse(raw || {});
            sharedData = { ...parsed, loading: false };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            sharedData = {
                ...sharedData,
                success: false,
                loading: false,
                error: msg,
            };
        } finally {
            inFlight = null;
            notifyListeners();
        }
    })();

    return inFlight;
}

export function setWeatherPrefetch(enabled: boolean, intervalMs: number) {
    prefetchEnabled = enabled;
    sharedIntervalMs = intervalMs;
    if (!enabled) {
        stopSharedInterval();
        return;
    }
    void fetchWeatherShared();
    startSharedInterval();
}

export function useWeatherPrefetch(enabled: boolean) {
    const { settings } = useSettings();
    const refreshMin = Math.max(5, Math.min(Number(settings.screensaver_weather_refresh_minutes) || 30, 180));
    const intervalMs = refreshMin * 60 * 1000;

    useEffect(() => {
        setWeatherPrefetch(enabled, intervalMs);
        return () => setWeatherPrefetch(false, intervalMs);
    }, [enabled, intervalMs]);
}

export function useWeather(show: boolean) {
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

    const refetch = useCallback(() => fetchWeatherShared(), []);

    useEffect(() => {
        if (!show) return undefined;
        if (!sharedData.fetchedAt && !sharedData.loading && !inFlight) {
            void fetchWeatherShared();
        }
        return undefined;
    }, [show]);

    return { ...sharedData, refetch };
}
