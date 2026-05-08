import { useSystemStats } from "../../hooks/useSystemStats";

interface SystemStatsWidgetProps {
    fontSize: number;
    show: boolean;
}

function statLine(label: string, value: string | null, fs: number) {
    if (value === null) return null;
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: fs * 0.55, opacity: 0.75 }}>
            <span>{label}</span>
            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{value}</span>
        </div>
    );
}

function formatTemp(c: number | null): string | null {
    if (c === null) return null;
    return `${c.toFixed(0)}°C`;
}

function formatPct(n: number | null): string | null {
    if (n === null) return null;
    return `${n.toFixed(0)}%`;
}

function formatRam(used: number | null, total: number | null): string | null {
    if (used === null || total === null) return null;
    return `${used.toFixed(1)} / ${total.toFixed(1)} GB`;
}

function formatFan(rpm: number | null): string | null {
    if (rpm === null) return null;
    return `${rpm} RPM`;
}

export function SystemStatsWidget({ fontSize, show }: SystemStatsWidgetProps) {
    const stats = useSystemStats(show);
    if (!show) return null;

    const lines = [
        statLine("CPU", formatTemp(stats.cpu_temp), fontSize),
        statLine("CPU Usage", formatPct(stats.cpu_usage), fontSize),
        statLine("RAM", formatRam(stats.ram_used_gb, stats.ram_total_gb), fontSize),
        statLine("GPU", formatTemp(stats.gpu_temp), fontSize),
        statLine("Fan", formatFan(stats.fan_rpm), fontSize),
    ].filter(Boolean);

    if (lines.length === 0) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 120 }}>
            {lines}
        </div>
    );
}
