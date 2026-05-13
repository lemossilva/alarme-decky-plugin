import { useEffect, useRef, type RefObject } from "react";
import { useSettings } from "./useSettings";

const SHIFT_X = "--alarme-shift-x";
const SHIFT_Y = "--alarme-shift-y";
const DRIFT_X = "--alarme-drift-x";
const DRIFT_Y = "--alarme-drift-y";
const SHIFT_OPACITY = "--alarme-shift-opacity";

function zeroMotion(el: HTMLElement) {
    el.style.setProperty(SHIFT_X, "0px");
    el.style.setProperty(SHIFT_Y, "0px");
    el.style.setProperty(DRIFT_X, "0px");
    el.style.setProperty(DRIFT_Y, "0px");
    el.style.setProperty(SHIFT_OPACITY, "1");
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function randIntInclusive(lo: number, hi: number): number {
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function pickTarget(range: number, ox: number, oy: number): { x: number; y: number } {
    const r = Math.max(1, Math.min(10, range));
    for (let i = 0; i < 20; i++) {
        const x = randIntInclusive(-r, r);
        const y = randIntInclusive(-r, r);
        if (x !== ox || y !== oy) return { x, y };
    }
    const nx = ox < r ? ox + 1 : ox - 1;
    const ny = oy < r ? oy + 1 : oy - 1;
    return { x: nx, y: ny };
}

function applyShift(el: HTMLElement, x: number, y: number, driftRange: number, opacity: number) {
    el.style.setProperty(SHIFT_X, `${x}px`);
    el.style.setProperty(SHIFT_Y, `${y}px`);
    const dx = (x / 10) * driftRange;
    const dy = (y / 10) * driftRange;
    el.style.setProperty(DRIFT_X, `${dx.toFixed(2)}px`);
    el.style.setProperty(DRIFT_Y, `${dy.toFixed(2)}px`);
    el.style.setProperty(SHIFT_OPACITY, opacity.toFixed(3));
}

/**
 * Stepped OLED-style shift with crossfade: holds at each pixel offset for `pixel_shift_interval_seconds`,
 * then fades out, moves to a new offset, and fades back in. Updates CSS custom properties on `rootRef` only.
 */
export function usePixelShift(visible: boolean, rootRef: RefObject<HTMLElement | null>) {
    const { settings } = useSettings();
    const enabled = settings.pixel_shift_enabled ?? true;
    const range = settings.pixel_shift_range ?? 3;
    const intervalSec = settings.pixel_shift_interval_seconds ?? 60;
    const driftRange = settings.screensaver_floating_drift_range || 40;

    const rafRef = useRef<number | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const stop = () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            const el = rootRef.current;
            if (el) zeroMotion(el);
        };

        if (!visible || !enabled) {
            stop();
            return;
        }

        const clampedRange = Math.max(1, Math.min(10, range));
        const holdMs = Math.max(800, intervalSec * 1000);
        const fadeMs = Math.min(12000, Math.max(4000, Math.round(intervalSec * 400)));

        type Phase =
            | { kind: "hold"; x: number; y: number; until: number }
            | { kind: "fade_out"; x: number; y: number; nextX: number; nextY: number; started: number }
            | { kind: "fade_in"; x: number; y: number; started: number };

        const first = pickTarget(clampedRange, 0, 0);
        let phase: Phase = {
            kind: "fade_in",
            x: first.x,
            y: first.y,
            started: performance.now(),
        };

        const loop = () => {
            if (!mountedRef.current) return;
            const el = rootRef.current;
            if (!el) {
                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            const now = performance.now();

            if (phase.kind === "hold") {
                applyShift(el, phase.x, phase.y, driftRange, 1);
                if (now >= phase.until) {
                    const next = pickTarget(clampedRange, phase.x, phase.y);
                    phase = {
                        kind: "fade_out",
                        x: phase.x,
                        y: phase.y,
                        nextX: next.x,
                        nextY: next.y,
                        started: now,
                    };
                }
            } else if (phase.kind === "fade_out") {
                const rawT = (now - phase.started) / fadeMs;
                const t = rawT >= 1 ? 1 : rawT;
                const opacity = 1 - easeInOutCubic(t);
                applyShift(el, phase.x, phase.y, driftRange, opacity);
                if (t >= 1) {
                    phase = {
                        kind: "fade_in",
                        x: phase.nextX,
                        y: phase.nextY,
                        started: now,
                    };
                }
            } else if (phase.kind === "fade_in") {
                const rawT = (now - phase.started) / fadeMs;
                const t = rawT >= 1 ? 1 : rawT;
                const opacity = easeInOutCubic(t);
                applyShift(el, phase.x, phase.y, driftRange, opacity);
                if (t >= 1) {
                    phase = {
                        kind: "hold",
                        x: phase.x,
                        y: phase.y,
                        until: now + holdMs,
                    };
                }
            }

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return stop;
    }, [visible, enabled, range, intervalSec, driftRange, rootRef]);
}
