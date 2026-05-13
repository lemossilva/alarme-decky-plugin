import { useEffect, useRef } from "react";
import type { WallpaperProvider } from "../types";

const PERIOD_SEC = 90;
const A = 18;
const B = 18;
const FREQ_A = 3;
const FREQ_B = 2;
const PHASE = Math.PI / 4;

function shouldShiftWallpaper(
    provider: WallpaperProvider,
    shiftLocalEnabled: boolean,
): boolean {
    if (provider === "bing_daily" || provider === "nasa_apod") return true;
    if (provider === "local_folder" && shiftLocalEnabled) return true;
    return false;
}

function driftZoomScale(): number {
    if (typeof window === "undefined") return 1.06;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const minDim = Math.max(320, Math.min(w, h));
    const extent = Math.hypot(A, B) + 4;
    return 1 + (2 * extent) / minDim;
}

export function useWallpaperShift(
    active: boolean,
    provider: WallpaperProvider,
    shiftLocalEnabled: boolean,
    pixelShiftEnabled: boolean,
) {
    const displayImgRef = useRef<HTMLImageElement | null>(null);
    const incomingImgRef = useRef<HTMLImageElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const mountedRef = useRef(true);

    const needs =
        pixelShiftEnabled &&
        active &&
        provider !== "none" &&
        shouldShiftWallpaper(provider, shiftLocalEnabled);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const clear = () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            const reset = "translate(0px, 0px) scale(1)";
            if (displayImgRef.current) {
                displayImgRef.current.style.transform = reset;
                displayImgRef.current.style.transformOrigin = "center center";
            }
            if (incomingImgRef.current) {
                incomingImgRef.current.style.transform = reset;
                incomingImgRef.current.style.transformOrigin = "center center";
            }
        };

        if (!needs) {
            clear();
            return;
        }

        const tick = () => {
            if (!mountedRef.current) return;
            const t = (performance.now() / 1000) * ((2 * Math.PI) / PERIOD_SEC);
            const x = A * Math.sin(FREQ_A * t + PHASE);
            const y = B * Math.sin(FREQ_B * t);
            const z = driftZoomScale();
            const tf = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${z.toFixed(5)})`;
            if (displayImgRef.current) {
                displayImgRef.current.style.transform = tf;
                displayImgRef.current.style.transformOrigin = "center center";
            }
            if (incomingImgRef.current) {
                incomingImgRef.current.style.transform = tf;
                incomingImgRef.current.style.transformOrigin = "center center";
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return clear;
    }, [needs]);

    return { displayImgRef, incomingImgRef, shiftActive: needs };
}
