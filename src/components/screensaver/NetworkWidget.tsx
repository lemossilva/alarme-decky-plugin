import { Fragment, type ReactNode } from "react";
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

function networkRow(
    left: ReactNode,
    right: ReactNode | null,
    lineFs: number,
    rightOpts?: { wrap?: boolean },
): ReactNode {
    if (right === null) {
        return (
            <div style={{ fontSize: lineFs, opacity: 0.78, minWidth: 0 }}>
                {left}
            </div>
        );
    }
    const wrap = rightOpts?.wrap ?? false;
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
                fontSize: lineFs,
                opacity: 0.78,
                minWidth: 0,
            }}
        >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
            <span
                style={{
                    fontFamily: "monospace",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                    textAlign: "right",
                    maxWidth: wrap ? "58%" : undefined,
                    whiteSpace: wrap ? "normal" : "nowrap",
                    wordBreak: wrap ? "break-all" : "normal",
                }}
            >
                {right}
            </span>
        </div>
    );
}

export function NetworkWidget({ fontSize, show }: NetworkWidgetProps) {
    const info = useWifiInfo(show);
    if (!show) return null;

    const fs = fontSize * 0.52;
    const fsSmall = fontSize * 0.45;
    const kind = info.connection_type || "none";
    const isWifi = kind === "wifi";
    const isEth = kind === "ethernet";
    const hasSpeed = info.link_speed_mbps != null && Number.isFinite(info.link_speed_mbps as number);
    const hasV4 = info.ipv4 && info.ipv4.length > 0;
    const v6list = info.ipv6 && info.ipv6.length > 0 ? info.ipv6 : [];
    const showLinkRow = isWifi || isEth;
    const ssidStr = (info.ssid ?? "").trim();
    const hasSignal = info.signal !== null;

    const rows: ReactNode[] = [];

    if (showLinkRow) {
        const left = isWifi ? "Wi-Fi" : "Wired";
        const right = `Link: ${hasSpeed ? formatLinkSpeedMbps(info.link_speed_mbps as number) : "—"}`;
        rows.push(networkRow(left, right, fs));
    }

    if (ssidStr.length > 0) {
        rows.push(networkRow(ssidStr, hasV4 ? info.ipv4! : null, fsSmall));
    } else if (hasV4) {
        rows.push(networkRow("", info.ipv4!, fsSmall));
    }

    if (isWifi && hasSignal) {
        rows.push(
            networkRow(
                <span style={{ fontFamily: "monospace", letterSpacing: 1 }}>{signalIcon(info.signal)}</span>,
                null,
                fs,
            ),
        );
    }

    for (const ip of v6list) {
        rows.push(networkRow("", ip, fsSmall, { wrap: true }));
    }

    if (kind === "none" && !hasV4 && v6list.length === 0 && rows.length === 0) {
        rows.push(
            <div key="none" style={{ fontSize: fs, opacity: 0.4 }}>
                No network
            </div>,
        );
    }

    if (rows.length === 0) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
            {rows.map((row, i) => (
                <Fragment key={i}>{row}</Fragment>
            ))}
        </div>
    );
}
