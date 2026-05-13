import { useEffect, useRef, useState } from "react";

const REF_SHORT_EDGE = 800;
const SCALE_MIN = 0.82;
const SCALE_MAX = 1.22;

function computeScale(): number {
    if (typeof window === "undefined") return 1;
    const short = Math.min(window.innerWidth, window.innerHeight);
    const raw = short / REF_SHORT_EDGE;
    return Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw));
}

export function useScreensaverViewportScale(active: boolean): number {
    const [scale, setScale] = useState(1);
    const mountedRef = useRef(true);
    const debounceRef = useRef<number | null>(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!active) {
            setScale(1);
            return;
        }

        const apply = () => {
            if (!mountedRef.current) return;
            setScale(computeScale());
        };

        apply();

        const onResize = () => {
            if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
            debounceRef.current = window.setTimeout(() => {
                debounceRef.current = null;
                apply();
            }, 120);
        };

        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
        };
    }, [active]);

    return active ? scale : 1;
}
