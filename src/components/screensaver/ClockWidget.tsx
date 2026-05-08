import { useScreensaverClock } from "../../hooks/useScreensaverClock";
import { useSettings } from "../../hooks/useSettings";
import type { ClockStyle } from "../../types";

interface ClockWidgetProps {
    clockSize: number;
}

function format12h(hours: number): { h: number; ampm: string } {
    if (hours === 0) return { h: 12, ampm: "AM" };
    if (hours < 12) return { h: hours, ampm: "AM" };
    if (hours === 12) return { h: 12, ampm: "PM" };
    return { h: hours - 12, ampm: "PM" };
}

function DigitalClock({ size }: { size: number }) {
    const { settings } = useSettings();
    const clock = useScreensaverClock();
    const use24h = settings.time_format_24h;

    const hh = use24h ? clock.hourStr : format12h(clock.hours).h.toString().padStart(2, "0");
    const suffix = use24h ? "" : ` ${format12h(clock.hours).ampm}`;

    return (
        <span style={{ fontFamily: "monospace", fontSize: size, fontWeight: 600, lineHeight: 1.2 }}>
            {hh}:{clock.minuteStr}{suffix}
        </span>
    );
}

function DigitalSecondsClock({ size }: { size: number }) {
    const { settings } = useSettings();
    const clock = useScreensaverClock();
    const use24h = settings.time_format_24h;

    const hh = use24h ? clock.hourStr : format12h(clock.hours).h.toString().padStart(2, "0");
    const suffix = use24h ? "" : ` ${format12h(clock.hours).ampm}`;

    return (
        <span style={{ fontFamily: "monospace", fontSize: size, fontWeight: 600, lineHeight: 1.2 }}>
            {hh}:{clock.minuteStr}
            <span style={{ opacity: 0.35, fontSize: size * 0.65 }}>:{clock.secondStr}</span>
            {suffix}
        </span>
    );
}

function DigitalLargeClock({ size }: { size: number }) {
    const { settings } = useSettings();
    const clock = useScreensaverClock();
    const blink = clock.seconds % 2 === 0;
    const use24h = settings.time_format_24h;

    const hh = use24h ? clock.hourStr : format12h(clock.hours).h.toString().padStart(2, "0");
    const suffix = use24h ? "" : ` ${format12h(clock.hours).ampm}`;

    return (
        <span style={{ fontFamily: "monospace", fontSize: size, fontWeight: 700, lineHeight: 1.1, letterSpacing: size * 0.06 }}>
            {hh}
            <span style={{ opacity: blink ? 0.85 : 0.2, transition: "opacity 0.4s ease" }}>:</span>
            {clock.minuteStr}
            {suffix}
        </span>
    );
}

function AnalogClock({ size }: { size: number }) {
    const clock = useScreensaverClock();
    const r = size / 2;
    const cx = r;
    const cy = r;

    const hourDeg = (clock.hours % 12) * 30 + clock.minutes * 0.5;
    const minDeg = clock.minutes * 6 + clock.seconds * 0.1;
    const secDeg = clock.seconds * 6;

    const hourRad = (hourDeg - 90) * (Math.PI / 180);
    const minRad = (minDeg - 90) * (Math.PI / 180);
    const secRad = (secDeg - 90) * (Math.PI / 180);

    const hourLen = r * 0.45;
    const minLen = r * 0.7;
    const secLen = r * 0.8;

    const hx = cx + hourLen * Math.cos(hourRad);
    const hy = cy + hourLen * Math.sin(hourRad);
    const mx = cx + minLen * Math.cos(minRad);
    const my = cy + minLen * Math.sin(minRad);
    const sx = cx + secLen * Math.cos(secRad);
    const sy = cy + secLen * Math.sin(secRad);

    const ticks: JSX.Element[] = [];
    for (let i = 0; i < 12; i++) {
        const deg = i * 30 - 90;
        const rad = deg * (Math.PI / 180);
        const isHour = i % 3 === 0;
        const inner = r * (isHour ? 0.78 : 0.85);
        const outer = r * 0.92;
        ticks.push(
            <line
                key={i}
                x1={cx + inner * Math.cos(rad)}
                y1={cy + inner * Math.sin(rad)}
                x2={cx + outer * Math.cos(rad)}
                y2={cy + outer * Math.sin(rad)}
                stroke="currentColor"
                strokeWidth={isHour ? 2 : 1}
                opacity={0.5}
                strokeLinecap="round"
            />
        );
    }

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
            {ticks}
            <circle cx={cx} cy={cy} r={r * 0.04} fill="currentColor" opacity={0.6} />
            <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="currentColor" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
            <line x1={cx} y1={cy} x2={mx} y2={my} stroke="currentColor" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
            <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="currentColor" strokeWidth={1} strokeLinecap="round" opacity={0.45} style={{ transition: "all 0.3s linear" }} />
            <circle cx={cx} cy={cy} r={r * 0.06} fill="currentColor" opacity={0.7} />
        </svg>
    );
}

export function ClockWidget({ clockSize }: ClockWidgetProps) {
    const { settings } = useSettings();
    const style = (settings.screensaver_clock_style || "digital") as ClockStyle;

    switch (style) {
        case "digital_seconds":
            return <DigitalSecondsClock size={clockSize} />;
        case "digital_large":
            return <DigitalLargeClock size={clockSize} />;
        case "analog":
            return <AnalogClock size={clockSize} />;
        default:
            return <DigitalClock size={clockSize} />;
    }
}
