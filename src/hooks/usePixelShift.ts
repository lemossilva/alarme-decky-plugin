import { useEffect, useState, useRef } from "react";
import { useSettings } from "./useSettings";

/**
 * Returns a CSS transform translate(x,y) that slowly orbits in a circle
 * to prevent OLED burn-in from static overlay elements.
 * Only runs when `visible` is true.
 */
export function usePixelShift(visible: boolean): { x: number; y: number } {
    const { settings } = useSettings();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const angleRef = useRef(0);

    const enabled = settings.pixel_shift_enabled ?? true;
    const range = settings.pixel_shift_range ?? 3;
    const intervalSec = settings.pixel_shift_interval_seconds ?? 60;

    useEffect(() => {
        if (!enabled || !visible) {
            setPosition({ x: 0, y: 0 });
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        const step = (Math.PI * 2) / 8;
        angleRef.current = 0;

        intervalRef.current = setInterval(() => {
            const clampedRange = Math.max(1, Math.min(10, range));
            angleRef.current += step;
            if (angleRef.current >= Math.PI * 2) {
                angleRef.current = 0;
            }
            const x = Math.round(clampedRange * Math.cos(angleRef.current));
            const y = Math.round(clampedRange * Math.sin(angleRef.current));
            setPosition({ x, y });
        }, intervalSec * 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, visible, range, intervalSec]);

    return position;
}
