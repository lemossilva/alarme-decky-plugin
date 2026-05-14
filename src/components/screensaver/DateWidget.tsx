import type { CSSProperties } from "react";
import { useScreensaverClock } from "../../hooks/useScreensaverClock";
import { useSettings } from "../../hooks/useSettings";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Pixel height of `ScreensaverCalendarGrid` for a given month (weekday row + day cell rows). */
export function screensaverCalendarGridContentHeightPx(
    fontSize: number,
    year: number,
    monthZeroBased: number,
): number {
    const firstDay = new Date(year, monthZeroBased, 1).getDay();
    const daysInMonth = new Date(year, monthZeroBased + 1, 0).getDate();
    const dayRows = Math.ceil((firstDay + daysInMonth) / 7);
    const weekdayRowH = fontSize * 0.8;
    const cellH = fontSize * 1.1;
    const gap = 1;
    return weekdayRowH + gap + dayRows * cellH + Math.max(0, dayRows - 1) * gap;
}

interface DateWidgetProps {
    fontSize: number;
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

/** Single-line date (used above the large-widgets row or standalone). */
export function ScreensaverDateHeading({ fontSize }: { fontSize: number }) {
    const { dateStr, visible } = useDateHeadingParts();
    if (!visible) return null;
    return <span style={{ fontSize, opacity: 0.85, lineHeight: 1.2 }}>{dateStr}</span>;
}

/** Mini monthly calendar grid only (large / fullscreen row). */
export function ScreensaverCalendarGrid({
    fontSize,
    stretchToContainer = false,
}: {
    fontSize: number;
    stretchToContainer?: boolean;
}) {
    const { settings } = useSettings();
    const clock = useScreensaverClock();

    if (!(settings.screensaver_show_calendar_grid ?? false)) {
        return null;
    }

    const firstDay = new Date(clock.year, clock.month, 1).getDay();
    const daysInMonth = new Date(clock.year, clock.month + 1, 0).getDate();
    const numDayRows = Math.ceil((firstDay + daysInMonth) / 7);
    const weekdayRowH = fontSize * 0.8;
    const cellMinH = fontSize * 1.1;
    const cellW = fontSize * 1.1;
    const gridMinWidthPx = 7 * cellW + 6;

    const cells: JSX.Element[] = [];
    for (let i = 0; i < firstDay; i++) {
        const emptyStyle: CSSProperties = stretchToContainer
            ? { minHeight: cellMinH, width: cellW, minWidth: cellW, boxSizing: "border-box" }
            : { width: cellW, height: cellMinH };
        cells.push(<div key={"e" + i} style={emptyStyle} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === clock.day;
        const dayStyle: CSSProperties = stretchToContainer
            ? {
                  minHeight: cellMinH,
                  width: cellW,
                  minWidth: cellW,
                  height: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: fontSize * 0.55,
                  fontWeight: isToday ? 700 : 400,
                  backgroundColor: isToday ? "rgba(255,255,255,0.12)" : "transparent",
                  borderRadius: 3,
              }
            : {
                  width: cellW,
                  height: cellMinH,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: fontSize * 0.55,
                  fontWeight: isToday ? 700 : 400,
                  backgroundColor: isToday ? "rgba(255,255,255,0.12)" : "transparent",
                  borderRadius: 3,
              };
        cells.push(
            <div key={d} style={dayStyle}>
                {d}
            </div>
        );
    }

    const weekdayCells = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => {
        const wkStyle: CSSProperties = stretchToContainer
            ? {
                  minHeight: weekdayRowH,
                  width: cellW,
                  minWidth: cellW,
                  boxSizing: "border-box",
                  textAlign: "center",
                  fontSize: fontSize * 0.45,
                  opacity: 0.4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
              }
            : {
                  width: fontSize * 1.1,
                  height: fontSize * 0.8,
                  textAlign: "center",
                  fontSize: fontSize * 0.45,
                  opacity: 0.4,
              };
        return (
            <div key={d} style={wkStyle}>
                {d}
            </div>
        );
    });

    if (stretchToContainer) {
        const gridMinH = screensaverCalendarGridContentHeightPx(fontSize, clock.year, clock.month);
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: "1 1 auto",
                    height: "100%",
                    width: "fit-content",
                    maxWidth: "100%",
                    minWidth: gridMinWidthPx,
                    minHeight: gridMinH,
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        width: "fit-content",
                        minWidth: gridMinWidthPx,
                        display: "grid",
                        gridTemplateColumns: `repeat(7, ${cellW}px)`,
                        gridTemplateRows: `${weekdayRowH}px repeat(${numDayRows}, minmax(${cellMinH}px, 1fr))`,
                        gap: 1,
                    }}
                >
                    {weekdayCells}
                    {cells}
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${cellW}px)`, gap: 1, width: "fit-content" }}>
            {weekdayCells}
            {cells}
        </div>
    );
}

export function DateWidget({ fontSize }: DateWidgetProps) {
    const { settings } = useSettings();
    const { visible } = useDateHeadingParts();

    if (!visible) {
        return null;
    }

    const showCalendar = settings.screensaver_show_calendar_grid ?? false;

    if (showCalendar) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <ScreensaverDateHeading fontSize={fontSize} />
                <ScreensaverCalendarGrid fontSize={fontSize} />
            </div>
        );
    }

    return <ScreensaverDateHeading fontSize={fontSize} />;
}
