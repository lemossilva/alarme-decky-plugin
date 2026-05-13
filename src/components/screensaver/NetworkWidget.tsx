import { useWifiInfo } from "../../hooks/useWifiInfo";

interface NetworkWidgetProps {
    fontSize: number;
    show: boolean;
}

function signalIcon(level: number | null): string {
    if (level === null) return "";
    if (level >= 75) return "●●●●";
    if (level >= 50) return "●●●○";
    if (level >= 25) return "●●○○";
    return "●○○○";
}

function formatLinkSpeedMbps(mbps: number): string {
    if (!Number.isFinite(mbps) || mbps <= 0) return "—";
    if (mbps >= 1000) {
        const g = mbps / 1000;
        const rounded = Math.abs(g - Math.round(g)) < 0.06 ? Math.round(g) : Math.round(g * 10) / 10;
        return `${rounded} Gb/s`;
    }
    return `${Math.round(mbps)} Mb/s`;
}

export function NetworkWidget({ fontSize, show }: NetworkWidgetProps) {
    const info = useWifiInfo(show);
    if (!show) return null;

    const fs = fontSize * 0.52;
    const fsSmall = fontSize * 0.45;
    const kind = info.connection_type || "none";
    const isWifi = kind === "wifi";
    const isEth = kind === "ethernet";
    const hasLabel = (info.ssid && info.ssid.length > 0) || isEth;
    const hasSignal = info.signal !== null;
    const hasSpeed = info.link_speed_mbps != null && Number.isFinite(info.link_speed_mbps as number);
    const hasV4 = info.ipv4 && info.ipv4.length > 0;
    const v6list = info.ipv6 && info.ipv6.length > 0 ? info.ipv6 : [];
    const showLinkRow = isWifi || isEth;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                fontSize: fs,
                opacity: 0.78,
                maxWidth: 220,
                textAlign: "left",
            }}
        >
            {isWifi ? (
                <div style={{ fontWeight: 600, opacity: 0.9 }}>Wi-Fi</div>
            ) : isEth ? (
                <div style={{ fontWeight: 600, opacity: 0.9 }}>Wired</div>
            ) : null}
            {hasLabel && info.ssid ? (
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {info.ssid}
                </div>
            ) : null}
            {isWifi && hasSignal && (
                <div style={{ fontFamily: "monospace", letterSpacing: 1 }}>
                    {signalIcon(info.signal)}
                </div>
            )}
            {showLinkRow && (
                <div style={{ fontSize: fsSmall, opacity: 0.88, fontVariantNumeric: "tabular-nums" }}>
                    Link: {hasSpeed ? formatLinkSpeedMbps(info.link_speed_mbps as number) : "—"}
                </div>
            )}
            {hasV4 ? (
                <div style={{ fontSize: fsSmall, wordBreak: "break-all", opacity: 0.88 }}>
                    {info.ipv4}
                </div>
            ) : null}
            {v6list.map((ip) => (
                <div key={ip} style={{ fontSize: fsSmall, wordBreak: "break-all", opacity: 0.75 }}>
                    {ip}
                </div>
            ))}
            {kind === "none" && !hasV4 && v6list.length === 0 && (
                <span style={{ opacity: 0.4 }}>No network</span>
            )}
        </div>
    );
}
