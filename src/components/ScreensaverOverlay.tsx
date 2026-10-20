import { useEffect, useRef } from "react";
import { Navigation } from "@decky/ui";
import { useScreensaver } from "../hooks/useScreensaver";
import { useCatchAllGamepad } from "../hooks/useCatchAllGamepad";
import { ScreensaverContent } from "./ScreensaverContent";
import { WallpaperLayer } from "./screensaver/WallpaperLayer";
import { useSettings } from "../hooks/useSettings";
import { usePixelShift } from "../hooks/usePixelShift";
import { useWeatherPrefetch } from "../hooks/useWeather";
import { useNewsPrefetch } from "../hooks/useNews";
import type { ScreensaverBigWidgetId, ScreensaverSmallWidgetId } from "../types";
import { Z_INDEX, setModalLayering } from "../utils/zIndex";
import { FaBell, FaMoon, FaDesktop } from "react-icons/fa";

export const ScreensaverOverlay = () => {
    const { settings } = useSettings();
    const {
        overlayVisible,
        effectiveMode,
        dimOpacity,
        wakeUp,
        shouldListen,
        isStandaloneIdle,
        isPreview,
        screensaverArmed,
        standaloneEnabled,
    } = useScreensaver();

    const bigWidgets: ScreensaverBigWidgetId[] = settings.screensaver_big_widgets ?? [];
    const smallWidgets: ScreensaverSmallWidgetId[] = settings.screensaver_small_widgets ?? [];
    const weatherRelevant =
        (settings.screensaver_show_weather ?? false) ||
        smallWidgets.includes("weather") ||
        bigWidgets.includes("forecast");
    const prefetchWeather =
        weatherRelevant && (screensaverArmed || standaloneEnabled || isPreview);
    useWeatherPrefetch(prefetchWeather);

    const newsRelevant =
        smallWidgets.includes("news") && (settings.screensaver_news_enabled ?? false);
    const prefetchNews =
        newsRelevant && (screensaverArmed || standaloneEnabled || isPreview);
    useNewsPrefetch(prefetchNews);

    const { subscribe, release } = useCatchAllGamepad();

    const wakeUpRef = useRef(wakeUp);
    wakeUpRef.current = wakeUp;

    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!shouldListen) {
            release();
            return;
        }

        const handler = () => {
            wakeUpRef.current();
        };

        subscribe(handler);
        const rebindTimer = window.setInterval(() => {
            subscribe(handler);
        }, 2000);

        return () => {
            window.clearInterval(rebindTimer);
            release();
        };
    }, [shouldListen, subscribe, release]);

    useEffect(() => {
        setModalLayering(overlayVisible);
        return () => setModalLayering(false);
    }, [overlayVisible]);

    const prevVisibleRef = useRef(false);
    useEffect(() => {
        if (overlayVisible && !prevVisibleRef.current) {
            Navigation.CloseSideMenus?.();
        }
        prevVisibleRef.current = overlayVisible;
    }, [overlayVisible]);

    useEffect(() => {
        const el = overlayRef.current;
        if (!el || !overlayVisible) return;

        const dismiss = (e: Event) => {
            wakeUpRef.current();
            e.preventDefault();
            e.stopPropagation();
        };

        el.addEventListener("pointerdown", dismiss, { capture: true });
        el.addEventListener("touchstart", dismiss, { capture: true, passive: false });
        el.addEventListener("mousedown", dismiss, { capture: true });

        return () => {
            el.removeEventListener("pointerdown", dismiss, { capture: true });
            el.removeEventListener("touchstart", dismiss, { capture: true });
            el.removeEventListener("mousedown", dismiss, { capture: true });
        };
    }, [overlayVisible]);

    const isBlack = effectiveMode === "black";
    const isWallpaper = effectiveMode === "wallpaper";
    const rawLayout = (settings.overlay_screensaver_layout as unknown as string | undefined) || "compact";
    const layout = rawLayout === "floating" ? "large" : rawLayout;
    const isNonCompact = layout !== "compact";
    const shiftVisible = overlayVisible && isNonCompact;
    usePixelShift(shiftVisible, overlayRef);

    return (
        <div
            ref={overlayRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: Z_INDEX.SCREENSAVER_OVERLAY,
                background: "#000",
                opacity: overlayVisible
                    ? (isBlack ? 1 : (isWallpaper ? 1 : dimOpacity))
                    : 0,
                transition: "opacity 0.5s ease",
                pointerEvents: overlayVisible ? "auto" : "none",
                touchAction: overlayVisible ? "none" : "auto",
            }}
        >
            {isWallpaper && <WallpaperLayer show={overlayVisible} />}
            {isNonCompact ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                    }}
                >
                    <ScreensaverContent />
                </div>
            ) : null}
            {overlayVisible && (
                <div style={{
                    position: "absolute",
                    bottom: 12,
                    right: 16,
                    fontSize: 10,
                    fontFamily: "system-ui, sans-serif",
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: 1,
                    userSelect: "none",
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(0,0,0,0.35)",
                    padding: "4px 8px",
                    borderRadius: 999,
                    transform: "translate(var(--alarme-br-nudge-x, 0px), var(--alarme-br-nudge-y, 0px))",
                    opacity: "var(--alarme-shift-opacity, 1)",
                }}>
                    {isPreview ? (
                        <>
                            <FaMoon size={10} />
                            <span>PREVIEW</span>
                        </>
                    ) : isStandaloneIdle ? (
                        <>
                            <FaDesktop size={10} />
                            <span>STANDALONE</span>
                        </>
                    ) : (
                        <FaBell size={10} />
                    )}
                </div>
            )}
        </div>
    );
};
