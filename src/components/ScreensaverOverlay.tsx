import { useEffect, useRef } from "react";
import { useUIComposition, UIComposition } from "../utils/uiComposition";
import { useScreensaver } from "../hooks/useScreensaver";
import { useCatchAllGamepad } from "../hooks/useCatchAllGamepad";
import { ScreensaverContent } from "./ScreensaverContent";
import { WallpaperLayer } from "./screensaver/WallpaperLayer";
import { useSettings } from "../hooks/useSettings";

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

    // Gamepad capture: works for both timer-based and standalone modes.
    // SetCatchAllGamepadInput intercepts controller input at the system level.
    useEffect(() => {
        const handler = () => {
            wakeUpRef.current();
        };
        if (shouldListen) {
            subscribe(handler);
        } else {
            release();
        }
        return () => {
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
    const layout = settings.overlay_screensaver_layout || "compact";
    const isNonCompact = layout !== "compact";

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
            {overlayVisible && (isPreview || isStandaloneIdle) && (
                <div style={{
                    position: "absolute",
                    bottom: 12,
                    right: 16,
                    fontSize: 10,
                    fontFamily: "system-ui, sans-serif",
                    color: "rgba(255,255,255,0.25)",
                    letterSpacing: 1,
                    userSelect: "none",
                    pointerEvents: "none",
                }}>
                    {isPreview ? "PREVIEW" : "STANDALONE"}
                </div>
            )}
        </div>
    );
};