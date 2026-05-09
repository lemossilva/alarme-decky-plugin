import { useEffect, useRef } from "react";
import { useUIComposition, UIComposition } from "../utils/uiComposition";
import { useScreensaver } from "../hooks/useScreensaver";
import { useCatchAllGamepad } from "../hooks/useCatchAllGamepad";
import { ScreensaverContent } from "./ScreensaverContent";
import { WallpaperLayer } from "./screensaver/WallpaperLayer";
import { useSettings } from "../hooks/useSettings";
import { usePixelShift } from "../hooks/usePixelShift";
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
    } = useScreensaver();
    const { subscribe, release } = useCatchAllGamepad();

    const wakeUpRef = useRef(wakeUp);
    wakeUpRef.current = wakeUp;

    const overlayRef = useRef<HTMLDivElement>(null);

    const level = overlayVisible ? UIComposition.Overlay : UIComposition.Notification;
    useUIComposition(level);

    // Gamepad capture for both timer-based and standalone screensavers.
    // After a Steam Deck reboot the SteamUI NavigationManager can initialize
    // late or get swapped out, so the binding is refreshed on a short cadence
    // (each subscribe call attaches against the current manager).
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

    // Native touch/pointer listeners on the overlay div.
    // React's synthetic events don't fire in Decky's CEF overlay mode,
    // so we use native addEventListener with capture phase instead.
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
    const { x: shiftX, y: shiftY } = usePixelShift(shiftVisible);

    return (
        <div
            ref={overlayRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 2147483646,
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
            {isNonCompact && <ScreensaverContent />}
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
                    transform: `translate(${shiftX}px, ${shiftY}px)`,
                    transition: "transform 2s linear",
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