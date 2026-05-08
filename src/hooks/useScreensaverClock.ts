import { useState, useEffect, useCallback } from "react";

export interface ScreenSaverClockData {
    date: Date;
    hours: number;
    minutes: number;
    seconds: number;
    hourStr: string;
    minuteStr: string;
    secondStr: string;
    month: number;
    day: number;
    year: number;
    weekday: number;
}

export function useScreensaverClock(): ScreenSaverClockData {
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        setDate(new Date());
        const id = setInterval(() => setDate(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();

    return {
        date,
        hours: h,
        minutes: m,
        seconds: s,
        hourStr: h.toString().padStart(2, "0"),
        minuteStr: m.toString().padStart(2, "0"),
        secondStr: s.toString().padStart(2, "0"),
        month: date.getMonth(),
        day: date.getDate(),
        year: date.getFullYear(),
        weekday: date.getDay(),
    };
}

export function useScreensaverClockBind(cb: () => void) {
    const callback = useCallback(cb, [cb]);
    useEffect(() => {
        callback();
        const id = setInterval(callback, 1000);
        return () => clearInterval(id);
    }, [callback]);
}
