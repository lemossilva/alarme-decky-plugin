import { useScreensaverClock } from "../../hooks/useScreensaverClock";
import { useSettings } from "../../hooks/useSettings";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface DateWidgetProps {
    fontSize: number;
}

function useDateHeadingParts(): { dateStr: string; visible: boolean } {
    const { settings } = useSettings();
    const clock = useScreensaverClock();

    const visible =
        (settings.overlay_screensaver_show_date ?? true) ||
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
export function ScreensaverCalendarGrid({ fontSize }: { fontSize: number }) {
    const { settings } = useSettings();
    const clock = useScreensaverClock();

    if (!(settings.screensaver_show_calendar_grid ?? false)) {
        return null;
    }

    const firstDay = new Date(clock.year, clock.month, 1).getDay();
    const daysInMonth = new Date(clock.year, clock.month + 1, 0).getDate();
    const cells: JSX.Element[] = [];
    for (let i = 0; i < firstDay; i++) {
        cells.push(<div key={"e" + i} style={{ width: fontSize * 1.1, height: fontSize * 1.1 }} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === clock.day;
        cells.push(
            <div
                key={d}
                style={{
                    width: fontSize * 1.1,
                    height: fontSize * 1.1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: fontSize * 0.55,
                    fontWeight: isToday ? 700 : 400,
                    backgroundColor: isToday ? "rgba(255,255,255,0.12)" : "transparent",
                    borderRadius: 3,
                }}
            >
                {d}
            </div>
        );
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div
                    key={d}
                    style={{
                        width: fontSize * 1.1,
                        height: fontSize * 0.8,
                        textAlign: "center",
                        fontSize: fontSize * 0.45,
                        opacity: 0.4,
                    }}
                >
                    {d}
                </div>
            ))}
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
