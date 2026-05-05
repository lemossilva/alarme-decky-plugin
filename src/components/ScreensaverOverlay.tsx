import { useEffect, useCallback, useRef } from "react";
import { useUIComposition, UIComposition } from "../utils/uiComposition";
import { useScreensaver } from "../hooks/useScreensaver";
import { useCatchAllGamepad } from "../hooks/useCatchAllGamepad";

export const ScreensaverOverlay = () => {
    const { overlayVisible, effectiveMode, dimOpacity, wakeUp, shouldListen } = useScreensaver();
    const { subscribe, release } = useCatchAllGamepad();
    const wakeUpRef = useRef(wakeUp);
    wakeUpRef.current = wakeUp;

    const level = overlayVisible ? UIComposition.Overlay : UIComposition.Notification;
    useUIComposition(level);

    const handleGamepadEvent = useCallback(() => {
        wakeUpRef.current();
    }, []);

    useEffect(() => {
        if (shouldListen) {
            subscribe(handleGamepadEvent);
        } else {
            release();
        }
        return () => {
            release();
        };
    }, [shouldListen, subscribe, release, handleGamepadEvent]);

    return (
        <div
            onPointerDown={overlayVisible ? wakeUp : undefined}
            onTouchStart={overlayVisible ? wakeUp : undefined}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 2147483646,
                background: "#000",
                opacity: overlayVisible ? (effectiveMode === "black" ? 1 : dimOpacity) : 0,
                transition: "opacity 0.5s ease",
                pointerEvents: overlayVisible ? "auto" : "none",
            }}
        />
    );
};
