import { useLayoutEffect, useRef, useState } from "react";
import { FaStopwatch, FaBell, FaVolumeMute, FaBatteryFull, FaCloudSun } from "react-icons/fa";
import type { UserSettings } from "../types";
import { formatTime } from "../utils/time";
import { resolveScreensaverAccentColor } from "../utils/screensaverAccent";

const REF_W = 1280;
const REF_H = 800;

function previewAccentColor(settings: UserSettings): string {
    const c = resolveScreensaverAccentColor(settings);
    if (c.startsWith("var(")) return "#d8e4f0";
    return c;
}

export function OverlayPositionPreview({ settings }: { settings: UserSettings }) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.24);

    useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el) return;
        const update = () => {
            const w = el.clientWidth;
            if (w <= 0) return;
            setScale(Math.max(0.16, Math.min(0.42, w / REF_W)));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const x = settings.overlay_custom_x ?? 12;
    const y = settings.overlay_custom_y ?? 12;
    const textSize = settings.overlay_text_size ?? 11;
    const opacity = settings.overlay_opacity ?? 0.85;
    const compact = settings.overlay_compact_mode ?? false;
    const use24h = settings.time_format_24h ?? true;

    const rawLayout = (settings.overlay_screensaver_layout as string | undefined) || "compact";
    const layoutIsCompact = (rawLayout === "floating" ? "large" : rawLayout) === "compact";

    const showClock = settings.overlay_compact_screensaver_show_clock ?? true;
    const showDate = settings.overlay_compact_screensaver_show_date ?? true;
    const showBattery = settings.overlay_compact_screensaver_show_battery ?? true;
    const showWeather = settings.screensaver_show_weather ?? false;

    const fs = Math.max(7, Math.round(textSize * scale));
    const iconMain = Math.max(8, Math.round((textSize - 1) * scale));
    const gapMain = Math.max(6, Math.round(12 * scale));
    const dotFs = Math.max(8, Math.round(10 * scale));

    const now = new Date();
    const clockStr = formatTime(now.getHours(), now.getMinutes(), use24h);
    const dateStr = now.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    const showSecondRow =
        layoutIsCompact &&
        (showWeather || showClock || showDate || showBattery);
    const accent = previewAccentColor(settings);

    return (
        <div style={{ width: "100%" }}>
            <div
                style={{
                    fontSize: 11,
                    color: "#9a9a9a",
                    lineHeight: 1.45,
                    marginBottom: 10,
                }}
            >
                Reference frame is <strong>1280×800</strong> (Steam Deck class).{" "}
                <strong>X</strong> and <strong>Y</strong> are pixel offsets from the display origin, matching the live overlay.
            </div>

            <div
                style={{
                    borderRadius: 14,
                    padding: 5,
                    background: "linear-gradient(145deg, #2a2a32 0%, #16161a 55%, #222228 100%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
                }}
            >
                <div
                    style={{
                        fontSize: 9,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.35)",
                        padding: "2px 6px 6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <span>Position preview</span>
                    <span style={{ fontFamily: "monospace", letterSpacing: 0 }}>
                        X {x}px · Y {y}px
                    </span>
                </div>

                <div
                    ref={hostRef}
                    style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "16 / 10",
                        maxHeight: 200,
                        borderRadius: 8,
                        overflow: "hidden",
                        background:
                            "linear-gradient(168deg, #1b2838 0%, #101822 38%, #0d151c 72%, #15202b 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background:
                                "radial-gradient(ellipse 95% 70% at 50% 18%, rgba(55,95,125,0.22), transparent 55%), radial-gradient(ellipse 60% 45% at 72% 88%, rgba(20,40,55,0.35), transparent)",
                            pointerEvents: "none",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            left: 8,
                            bottom: 7,
                            fontSize: 8,
                            color: "rgba(255,255,255,0.22)",
                            fontFamily: "system-ui, sans-serif",
                            pointerEvents: "none",
                        }}
                    >
                        Steam / game (approx.)
                    </div>

                    <div
                        style={{
                            position: "absolute",
                            left: `${(x / REF_W) * 100}%`,
                            top: `${(y / REF_H) * 100}%`,
                            display: "flex",
                            flexDirection: showSecondRow ? "column" : "row",
                            alignItems: "flex-start",
                            gap: showSecondRow ? 2 : 0,
                            opacity,
                            color: "#8b8b8b",
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            userSelect: "none",
                            pointerEvents: "none",
                            maxWidth: "calc(100% - 4px)",
                            textShadow: "0 1px 2px rgba(0,0,0,0.75)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: gapMain,
                                whiteSpace: "nowrap",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: Math.max(4, Math.round(6 * scale)) }}>
                                <FaStopwatch size={iconMain} style={{ opacity: 0.85 }} />
                                {!compact && (
                                    <span style={{ fontSize: fs, opacity: 0.9, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis" }}>
                                        Focus
                                    </span>
                                )}
                                <div style={{ display: "flex", alignItems: "center", gap: 2, opacity: 0.82 }}>
                                    <FaVolumeMute size={Math.max(7, iconMain - 2)} />
                                </div>
                            </div>
                            <span style={{ opacity: 0.4, fontSize: dotFs, lineHeight: 0 }}>·</span>
                            <div style={{ display: "flex", alignItems: "center", gap: Math.max(3, Math.round(4 * scale)) }}>
                                <FaBell size={iconMain} style={{ opacity: 0.85 }} />
                                {!compact && (
                                    <span style={{ fontSize: fs, opacity: 0.9, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis" }}>
                                        Stand up
                                    </span>
                                )}
                                <span style={{ fontSize: fs, fontFamily: "monospace", fontWeight: 600 }}>2:30</span>
                            </div>
                        </div>

                        {showSecondRow && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: Math.max(6, Math.round(10 * scale)),
                                    fontSize: fs,
                                    fontWeight: 600,
                                    color: accent,
                                    opacity: 1,
                                }}
                            >
                                {showWeather && (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                                        <FaCloudSun size={iconMain} style={{ opacity: 0.9 }} />
                                        <span style={{ fontFamily: "monospace" }}>22°C</span>
                                    </span>
                                )}
                                {showWeather && (showClock || showDate || showBattery) && (
                                    <span style={{ opacity: 0.35 }}>·</span>
                                )}
                                {showClock && (
                                    <span style={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>{clockStr}</span>
                                )}
                                {showClock && showDate && <span style={{ opacity: 0.35 }}>·</span>}
                                {showDate && <span style={{ whiteSpace: "nowrap" }}>{dateStr}</span>}
                                {(showClock || showDate) && showBattery && <span style={{ opacity: 0.35 }}>·</span>}
                                {showBattery && (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                                        <FaBatteryFull size={Math.max(7, iconMain - 1)} />
                                        72%
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div
                style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: "#888",
                    lineHeight: 1.5,
                    padding: "2px 0 0 0",
                }}
            >
                <strong>Top row:</strong> alert bar (icons and times match your Compact mode and text size settings).
                {layoutIsCompact ? (
                    <>
                        {" "}
                        <strong>Accent row:</strong> optional second line during the <strong>screensaver</strong> only
                        (compact layout). It follows the same anchor as the bar and uses your Screensaver accent color.
                        In the live UI, the screensaver tints the <strong>entire</strong> overlay with that accent, not only the second row.
                    </>
                ) : (
                    <>
                        {" "}
                        Large and centered screensavers hide this row on the game overlay; Fullscreen spread mode does too.
                    </>
                )}
            </div>
        </div>
    );
}
