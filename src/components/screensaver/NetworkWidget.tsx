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

export function NetworkWidget({ fontSize, show }: NetworkWidgetProps) {
    const info = useWifiInfo(show);
    if (!show) return null;

    const hasData = info.ssid || info.signal !== null;

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            fontSize: fontSize * 0.55,
            opacity: 0.75,
        }}>
            {info.ssid && (
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                    {info.ssid}
                </div>
            )}
            {info.signal !== null && (
                <div style={{ fontFamily: "monospace", letterSpacing: 1 }}>
                    {signalIcon(info.signal)}
                </div>
            )}
            {!hasData && (
                <span style={{ opacity: 0.4 }}>No Wi-Fi</span>
            )}
        </div>
    );
}
