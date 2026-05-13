import { callable } from "@decky/api";
import { ButtonItem, Focusable, TextField } from "@decky/ui";
import { useEffect, useRef, useState } from "react";
import { FaMapMarkerAlt } from "react-icons/fa";
import { useSettings } from "../../hooks/useSettings";
import type { WeatherGeocodeResult } from "../../types";

const searchWeatherLocationsCall = callable<
    [query: string, limit: number],
    { success: boolean; results?: WeatherGeocodeResult[]; error?: string | null }
>("search_weather_locations");

const setWeatherLocationCall = callable<
    [lat: number, lon: number, display_name: string],
    { success: boolean; error?: string | null }
>("set_weather_location");

const setWeatherLocationFromIpCall = callable<
    [],
    { success: boolean; error?: string | null }
>("set_weather_location_from_ip");

const DEBOUNCE_MS = 350;

export function WeatherLocationPicker() {
    const { settings } = useSettings();
    const savedLabel = settings.screensaver_weather_city_name || "";

    const [inputValue, setInputValue] = useState(savedLabel);
    const [debounced, setDebounced] = useState("");
    const [results, setResults] = useState<WeatherGeocodeResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [ipBusy, setIpBusy] = useState(false);
    const [listOpen, setListOpen] = useState(false);

    const reqIdRef = useRef(0);
    const pickLockRef = useRef(false);
    const skipGeocodeForRef = useRef<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        setInputValue(savedLabel);
        const trimmed = savedLabel.trim();
        if (
            skipGeocodeForRef.current !== null &&
            trimmed.length > 0 &&
            skipGeocodeForRef.current !== trimmed
        ) {
            skipGeocodeForRef.current = null;
        }
    }, [savedLabel]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(inputValue.trim()), DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [inputValue]);

    useEffect(() => {
        if (debounced.length < 2) {
            setResults([]);
            setSearchError(null);
            setLoading(false);
            setListOpen(false);
            return;
        }

        if (skipGeocodeForRef.current !== null && debounced === skipGeocodeForRef.current) {
            setResults([]);
            setSearchError(null);
            setLoading(false);
            setListOpen(false);
            return;
        }

        const lat = settings.screensaver_weather_lat;
        const lon = settings.screensaver_weather_lon;
        const label = (settings.screensaver_weather_city_name || "").trim();
        if (
            lat != null &&
            lon != null &&
            label.length >= 2 &&
            debounced === label
        ) {
            setResults([]);
            setSearchError(null);
            setLoading(false);
            setListOpen(false);
            return;
        }

        const id = ++reqIdRef.current;
        setLoading(true);
        setSearchError(null);
        setListOpen(true);

        searchWeatherLocationsCall(debounced, 8)
            .then((res) => {
                if (!mountedRef.current || reqIdRef.current !== id) return;
                if (!res.success) {
                    setResults([]);
                    setSearchError(res.error || "Search failed");
                    return;
                }
                setResults(res.results || []);
                if ((res.results || []).length === 0) {
                    setSearchError("No matches");
                }
            })
            .catch((e) => {
                if (!mountedRef.current || reqIdRef.current !== id) return;
                setResults([]);
                setSearchError(e instanceof Error ? e.message : String(e));
            })
            .finally(() => {
                if (!mountedRef.current || reqIdRef.current !== id) return;
                setLoading(false);
            });
    }, [debounced, settings.screensaver_weather_lat, settings.screensaver_weather_lon, settings.screensaver_weather_city_name]);

    const pickRow = async (row: WeatherGeocodeResult) => {
        if (pickLockRef.current || saving) return;
        pickLockRef.current = true;
        setSaving(true);
        setSearchError(null);
        const committed = row.display_name.trim();
        skipGeocodeForRef.current = committed;
        try {
            const res = await setWeatherLocationCall(row.latitude, row.longitude, row.display_name);
            if (!res.success) {
                skipGeocodeForRef.current = null;
                setSearchError(res.error || "Could not save location");
                return;
            }
            setListOpen(false);
            setInputValue(row.display_name);
            setResults([]);
        } catch (e) {
            skipGeocodeForRef.current = null;
            setSearchError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
            pickLockRef.current = false;
        }
    };

    const useIp = async () => {
        setIpBusy(true);
        setSearchError(null);
        try {
            const res = await setWeatherLocationFromIpCall();
            if (!res.success) {
                setSearchError(
                    res.error === "ipapi_failed" || res.error === "ip_geo_failed"
                        ? "Location lookup failed (network)."
                        : res.error || "Failed",
                );
                return;
            }
            setListOpen(false);
            setResults([]);
        } catch (e) {
            setSearchError(e instanceof Error ? e.message : String(e));
        } finally {
            setIpBusy(false);
        }
    };

    const showList = listOpen && debounced.length >= 2 && (loading || results.length > 0 || !!searchError);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <TextField
                label="Search city (type to see suggestions)"
                value={inputValue}
                disabled={saving}
                onChange={(e) => {
                    skipGeocodeForRef.current = null;
                    setInputValue(e.target.value);
                    if (e.target.value.trim().length >= 2) setListOpen(true);
                }}
            />

            {showList && (
                <div
                    style={{
                        maxHeight: 220,
                        overflowY: "auto",
                        borderRadius: 8,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                    }}
                >
                    {loading && (
                        <div style={{ padding: "10px 12px", fontSize: 12, color: "#888" }}>Searching…</div>
                    )}
                    {!loading && searchError && results.length === 0 && (
                        <div style={{ padding: "10px 12px", fontSize: 12, color: "#c77" }}>{searchError}</div>
                    )}
                    {!loading &&
                        results.map((row, idx) => (
                            <Focusable
                                key={`${row.latitude},${row.longitude},${idx}`}
                                onActivate={() => pickRow(row)}
                                onClick={() => pickRow(row)}
                                style={{
                                    padding: "10px 12px",
                                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8" }}>{row.name}</div>
                                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                    {[row.admin1, row.country || row.country_code].filter(Boolean).join(", ")}
                                </div>
                            </Focusable>
                        ))}
                </div>
            )}

            <ButtonItem layout="below" disabled={ipBusy || saving} onClick={useIp}>
                <FaMapMarkerAlt size={12} style={{ marginRight: 8 }} />
                {ipBusy ? "Locating…" : "Use approximate location (IP)"}
            </ButtonItem>
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.45 }}>
                IP lookup tries ipapi.co, then geojs.io. The resolved place name is saved so you can confirm it.
            </div>
        </div>
    );
}
