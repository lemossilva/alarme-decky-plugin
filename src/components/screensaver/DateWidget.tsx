import { useLayoutEffect, useRef, useState } from "react";
import { useScreensaverClock } from "../../hooks/useScreensaverClock";
import { useSettings } from "../../hooks/useSettings";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type ScreensaverWidgetDensity = "normal" | "tight";

const MAX_CALENDAR_GROWTH = 2.4;

function calendarScale(density: ScreensaverWidgetDensity): number {
    return density === "tight" ? 0.89 : 1;
}

/** Pixel height of `ScreensaverCalendarGrid` for a given month (weekday row + day cell rows). */
export function screensaverCalendarGridContentHeightPx(
    fontSize: number,
    year: number,
    monthZeroBased: number,
    density: ScreensaverWidgetDensity = "normal",
): number {
    const scale = calendarScale(density);
    const firstDay = new Date(year, monthZeroBased, 1).getDay();
    const daysInMonth = new Date(year, monthZeroBased + 1, 0).getDate();
    const dayRows = Math.ceil((firstDay + daysInMonth) / 7);
    const weekdayRowH = fontSize * 0.8 * scale;
    const cellH = fontSize * 1.1 * scale;
    const gap = 1;
    return weekdayRowH + gap + dayRows * cellH + Math.max(0, dayRows - 1) * gap;
}

function useDateHeadingParts(): { dateStr: string; visible: boolean } {
    const { settings } = useSettings();
    const clock = useScreensaverClock();

    const visible =
        (settings.screensaver_center_show_date ?? true) ||
        (settings.screensaver_show_day_of_week ?? true);

    const showDayOfWeek = settings.screensaver_show_day_of_week ?? true;
    const showYear = settings.screensaver_show_year ?? false;

    const monthName = MONTHS[clock.month];
    const dateParts: string[] = [];
    if (showDayOfWeek) dateParts.push(WEEKDAYS[clock.weekday]);
    dateParts.push(`${monthName} ${clock.day}`);
    if (showYear) dateParts.push(clock.year.toString());
    const dateStr = dateParts.join(", ");

    return { dateStr, visible };
}

/** Single-line date (above the large-widgets row, or alone when there are no big widgets). */
export function ScreensaverDateHeading({ fontSize }: { fontSize: number }) {
    const { dateStr, visible } = useDateHeadingParts();
    if (!visible) return null;
    return <span style={{ fontSize, opacity: 0.85, lineHeight: 1.2 }}>{dateStr}</span>;
}

/** Mini monthly calendar grid for the large / fullscreen widget row; spreads over its card. */
export function ScreensaverCalendarGrid({
    fontSize,
    density = "normal",
}: {
    fontSize: number;
    density?: ScreensaverWidgetDensity;
}) {
    const clock = useScreensaverClock();
    const gridRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const el = gridRef.current;
        if (!el) return;
        const update = () => {
            const width = el.clientWidth;
            const height = el.clientHeight;
            if (width <= 0 || height <= 0) return;
            setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const firstDay = new Date(clock.year, clock.month, 1).getDay();
    const daysInMonth = new Date(clock.year, clock.month + 1, 0).getDate();
    const numDayRows = Math.ceil((firstDay + daysInMonth) / 7);
    const scale = calendarScale(density);
    const weekdayRowH = fontSize * 0.8 * scale;
    const cellMinH = fontSize * 1.1 * scale;
    const cellW = fontSize * 1.1 * scale;
    const gridMinWidthPx = 7 * cellW + 6;
    const gridMinH = screensaverCalendarGridContentHeightPx(fontSize, clock.year, clock.month, density);

    // Grow digits with the space the card gives the rows, capped by column width.
    const rowH = box.height > 0 ? Math.max(cellMinH, (box.height - weekdayRowH * 1.5 - numDayRows) / numDayRows) : cellMinH;
    const colW = box.width > 0 ? Math.max(cellW, (box.width - 6) / 7) : cellW;
    const growth = Math.max(1, Math.min(rowH / cellMinH, colW / cellW, MAX_CALENDAR_GROWTH));
    const dayFontSize = fontSize * 0.55 * growth;
    const weekdayFontSize = fontSize * 0.45 * Math.min(growth, 1.5);
    const todayMark = Math.min(rowH, colW) * 0.92;

    const cells: JSX.Element[] = [];
    for (let i = 0; i < firstDay; i++) {
        cells.push(<div key={"e" + i} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === clock.day;
        cells.push(
            <div key={d} style={{ position: "relative", minWidth: 0, minHeight: 0 }}>
                <span
                    style={{
                        position: "absolute",
                        inset: 0,
                        margin: "auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: todayMark,
                        height: todayMark,
                        fontSize: dayFontSize,
                        fontWeight: isToday ? 700 : 400,
                        backgroundColor: isToday ? "rgba(255,255,255,0.12)" : "transparent",
                        borderRadius: Math.max(3, todayMark * 0.18),
                    }}
                >
                    {d}
                </span>
            </div>
        );
    }

    const weekdayCells = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
        <div
            key={d}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: weekdayFontSize,
                opacity: 0.4,
            }}
        >
            {d}
        </div>
    ));

    return (
        <div
            ref={gridRef}
            style={{
                flex: "1 1 auto",
                alignSelf: "stretch",
                width: "100%",
                minWidth: gridMinWidthPx,
                minHeight: gridMinH,
                boxSizing: "border-box",
                display: "grid",
                gridTemplateColumns: `repeat(7, minmax(${cellW}px, 1fr))`,
                gridTemplateRows: `${weekdayRowH * Math.min(growth, 1.5)}px repeat(${numDayRows}, minmax(${cellMinH}px, 1fr))`,
                gap: 1,
            }}
        >
            {weekdayCells}
            {cells}
        </div>
    );
}
