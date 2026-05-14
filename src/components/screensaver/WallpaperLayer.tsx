import { useEffect, useRef, useState } from "react";
import { useSettings } from "../../hooks/useSettings";
import { useWallpaper } from "../../hooks/useWallpaper";
import { useWallpaperShift } from "../../hooks/useWallpaperShift";

const BLUR_VALUES: Record<string, string> = {
    none: "0px",
    light: "3px",
    heavy: "10px"
};

const TRANSITION_MS = 1900;

const ACCENT_CANDIDATES = [
    "#141414",
    "#2a2a2a",
    "#4a4a4a",
    "#8b8b8b",
    "#e0e0e0",
    "#e6a817",
    "#4499cc",
    "#cc5544",
    "#66bb88",
    "#cc7733",
];

interface WallpaperLayerProps {
    show: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace("#", "");
    const n = Number.parseInt(h, 16);
    return {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255,
    };
}

function channelLuminance(v: number): number {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
    return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
    const l1 = relativeLuminance(a.r, a.g, a.b);
    const l2 = relativeLuminance(b.r, b.g, b.b);
    const max = Math.max(l1, l2);
    const min = Math.min(l1, l2);
    return (max + 0.05) / (min + 0.05);
}

function pickContrastAccent(avg: { r: number; g: number; b: number }, dim: number): string {
    const dimFactor = Math.max(0, Math.min(1, 1 - dim));
    const bg = {
        r: Math.round(avg.r * dimFactor),
        g: Math.round(avg.g * dimFactor),
        b: Math.round(avg.b * dimFactor),
    };
    let best = "#e0e0e0";
    let bestRatio = 0;
    for (const c of ACCENT_CANDIDATES) {
        const ratio = contrastRatio(hexToRgb(c), bg);
        if (ratio > bestRatio) {
            bestRatio = ratio;
            best = c;
        }
    }
    return best;
}

export function WallpaperLayer({ show }: WallpaperLayerProps) {
    const { settings } = useSettings();
    const wallpaper = useWallpaper(show);
    const fit = settings.screensaver_wallpaper_fit || "cover";
    const blur = settings.screensaver_wallpaper_blur || "none";
    const dim = settings.screensaver_wallpaper_dim ?? 0.4;
    const provider = settings.screensaver_wallpaper_provider || "none";
    const shiftLocal = settings.screensaver_wallpaper_shift_local ?? false;
    const pixelShiftOn = settings.pixel_shift_enabled ?? true;
    const showAttribution = settings.screensaver_wallpaper_show_attribution ?? true;
    const { displayImgRef, incomingImgRef, shiftActive } = useWallpaperShift(
        show,
        provider,
        shiftLocal,
        pixelShiftOn,
    );

    const [displaySrc, setDisplaySrc] = useState<string | null>(null);
    const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
    const [incomingOpacity, setIncomingOpacity] = useState(0);

    const displaySrcRef = useRef<string | null>(null);
    const incomingSrcRef = useRef<string | null>(null);
    const swapTimerRef = useRef<number | null>(null);
    const raf1Ref = useRef<number | null>(null);
    const raf2Ref = useRef<number | null>(null);

    useEffect(() => {
        displaySrcRef.current = displaySrc;
    }, [displaySrc]);

    useEffect(() => {
        incomingSrcRef.current = incomingSrc;
    }, [incomingSrc]);

    const updateContrastFromSrc = (src: string) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = 32;
                canvas.height = 32;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                let r = 0;
                let g = 0;
                let b = 0;
                let count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    if (alpha < 8) continue;
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }
                if (count === 0) return;
                const avg = {
                    r: Math.round(r / count),
                    g: Math.round(g / count),
                    b: Math.round(b / count),
                };
                const contrast = pickContrastAccent(avg, dim);
                document.documentElement.style.setProperty("--alarme-wallpaper-contrast-color", contrast);
            } catch {
                // Ignore sampling failures; keep previous value.
            }
        };
        img.src = src;
    };

    useEffect(() => {
        if (!show) {
            setDisplaySrc(null);
            setIncomingSrc(null);
            setIncomingOpacity(0);
            if (swapTimerRef.current) {
                window.clearTimeout(swapTimerRef.current);
                swapTimerRef.current = null;
            }
            if (raf1Ref.current) {
                window.cancelAnimationFrame(raf1Ref.current);
                raf1Ref.current = null;
            }
            if (raf2Ref.current) {
                window.cancelAnimationFrame(raf2Ref.current);
                raf2Ref.current = null;
            }
        }
    }, [show]);

    useEffect(() => {
        if (!wallpaper.url) return;
        if (!displaySrcRef.current) {
            setDisplaySrc(wallpaper.url);
            updateContrastFromSrc(wallpaper.url);
            return;
        }
        if (wallpaper.url === displaySrcRef.current || wallpaper.url === incomingSrcRef.current) return;

        let cancelled = false;
        let started = false;
        const next = wallpaper.url;
        const img = new Image();

        const startTransition = () => {
            if (cancelled || started) return;
            started = true;
            setIncomingSrc(next);
            setIncomingOpacity(0);
            // Double RAF ensures the browser commits opacity=0 before animating to 1.
            raf1Ref.current = window.requestAnimationFrame(() => {
                raf2Ref.current = window.requestAnimationFrame(() => {
                    setIncomingOpacity(1);
                });
            });
            swapTimerRef.current = window.setTimeout(() => {
                if (cancelled) return;
                setDisplaySrc(next);
                setIncomingSrc(null);
                setIncomingOpacity(0);
                updateContrastFromSrc(next);
            }, TRANSITION_MS + 220);
        };

        img.onload = startTransition;
        img.onerror = startTransition;
        img.src = next;
        if (img.complete) {
            startTransition();
        }

        return () => {
            cancelled = true;
            if (swapTimerRef.current) {
                window.clearTimeout(swapTimerRef.current);
                swapTimerRef.current = null;
            }
            if (raf1Ref.current) {
                window.cancelAnimationFrame(raf1Ref.current);
                raf1Ref.current = null;
            }
            if (raf2Ref.current) {
                window.cancelAnimationFrame(raf2Ref.current);
                raf2Ref.current = null;
            }
        };
    }, [wallpaper.url, dim]);

    if (!show) return null;

    const attributionText = (() => {
        const a = wallpaper.attribution;
        if (!a) return null;
        const parts = [a.title, a.credit].filter((s): s is string => !!s && s.trim().length > 0);
        return parts.length > 0 ? parts.join(" · ") : null;
    })();

    const src = displaySrc || wallpaper.url;

    if (!src) {
        return (
            <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "#000",
            }} />
        );
    }

    return (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden" }}>
            <img
                ref={displayImgRef}
                src={src}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: fit,
                    filter: `blur(${BLUR_VALUES[blur] || "0px"})`,
                    opacity: 1,
                    transformOrigin: "center center",
                    willChange: shiftActive ? "transform" : undefined,
                }}
            />
            {incomingSrc && incomingSrc !== src && (
                <img
                    ref={incomingImgRef}
                    src={incomingSrc}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: fit,
                        filter: `blur(${BLUR_VALUES[blur] || "0px"})`,
                        opacity: incomingOpacity,
                        transition: `opacity ${TRANSITION_MS}ms ease-in-out`,
                        transformOrigin: "center center",
                        willChange: shiftActive ? "opacity, transform" : "opacity",
                    }}
                />
            )}
            {showAttribution && attributionText && (
                <div style={{
                    position: "absolute",
                    bottom: 12,
                    left: 16,
                    maxWidth: "min(52vw, 420px)",
                    fontSize: 10,
                    fontFamily: "system-ui, sans-serif",
                    color: "rgba(255,255,255,0.55)",
                    letterSpacing: 0.4,
                    userSelect: "none",
                    pointerEvents: "none",
                    lineHeight: 1.35,
                    textAlign: "left",
                    backgroundColor: "rgba(0,0,0,0.35)",
                    padding: "4px 10px",
                    borderRadius: 999,
                    transform: "translate(var(--alarme-bl-nudge-x, 0px), var(--alarme-bl-nudge-y, 0px))",
                    opacity: "var(--alarme-shift-opacity, 1)",
                }}>
                    {attributionText}
                </div>
            )}
            <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: `rgba(0,0,0,${dim})`,
            }} />
        </div>
    );
}
