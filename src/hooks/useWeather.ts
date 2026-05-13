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
    forecast: ForecastDay[];
    fetchedAt: string | null;
    error: string | null;
    loading: boolean;
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
        forecast: parseForecast(raw.forecast),
        fetchedAt: typeof raw.fetched_at === "string" ? raw.fetched_at : null,
        error: err,
    };
}

export function useWeather(show: boolean) {
    const { settings } = useSettings();
    const refreshMin = Math.max(5, Math.min(Number(settings.screensaver_weather_refresh_minutes) || 30, 180));
    const intervalMs = refreshMin * 60 * 1000;

    const [data, setData] = useState<WeatherData>({
        success: false,
        temperature: null,
        temperatureUnit: "C",
        weathercode: null,
        isDay: null,
        tempMax: null,
        tempMin: null,
        aqiUs: null,
        forecast: [],
        fetchedAt: null,
        error: null,
        loading: false,
    });

    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const load = useCallback(async () => {
        if (!show) return;
        setData((d) => ({ ...d, loading: true, error: null }));
        try {
            const raw = await fetchWeatherCall();
            if (!mountedRef.current) return;
            const parsed = parseResponse(raw || {});
            setData({ ...parsed, loading: false });
        } catch (e) {
            if (!mountedRef.current) return;
            const msg = e instanceof Error ? e.message : String(e);
            setData((prev) => ({
                ...prev,
                success: false,
                loading: false,
                error: msg,
            }));
        }
    }, [show]);

    useEffect(() => {
        if (!show) {
            setData((d) => ({
                ...d,
                loading: false,
                success: false,
                temperature: null,
                weathercode: null,
                isDay: null,
                tempMax: null,
                tempMin: null,
                aqiUs: null,
                forecast: [],
                fetchedAt: null,
                error: null,
            }));
            return;
        }
        load();
        const id = window.setInterval(load, intervalMs);
        return () => clearInterval(id);
    }, [show, load, intervalMs]);

    return { ...data, refetch: load };
}
