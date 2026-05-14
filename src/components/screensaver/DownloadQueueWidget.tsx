import type { SteamDownloadState } from "../../hooks/useSteamDownloads";
import { resolveScreensaverAccentColor } from "../../utils/screensaverAccent";
import { useSettings } from "../../hooks/useSettings";

interface DownloadQueueWidgetProps {
    fontSize: number;
    show: boolean;
    downloadState: SteamDownloadState;
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
    if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "—";
    if (bytesPerSec < 1024 * 1024)
        return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 72) return ">3d";
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return "<1m";
}

function ProgressBar({
    pct,
    accentColor,
    height,
}: {
    pct: number;
    accentColor: string;
    height: number;
}) {
    const clampedPct = Math.max(0, Math.min(100, pct));
    return (
        <div
            style={{
                width: "100%",
                height,
                borderRadius: height / 2,
                backgroundColor: "rgba(255,255,255,0.1)",
                overflow: "hidden",
                position: "relative",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${clampedPct}%`,
                    borderRadius: height / 2,
                    backgroundColor: accentColor,
                    opacity: 0.85,
                    transition: "width 0.6s ease",
                }}
            />
        </div>
    );
}

export function DownloadQueueWidget({
    fontSize,
    show,
    downloadState,
}: DownloadQueueWidgetProps) {
    const { settings } = useSettings();
    if (!show) return null;

    const accentColor = resolveScreensaverAccentColor(settings);
    const fs = fontSize * 0.5;
    const fsSmall = fontSize * 0.42;
    const barHeight = Math.max(4, fontSize * 0.16);

    const {
        isDownloading,
        progressPct,
        speedBytesPerSec,
        etaSeconds,
        totalBytes,
        remainingBytes,
        overview,
        queuedItems,
    } = downloadState;

    const paused = overview?.paused ?? false;
    const isPrefetch = overview?.update_is_prefetch_estimate ?? false;

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                fontSize: fs,
                opacity: 0.85,
                minWidth: 110,
                maxWidth: 220,
                textAlign: "center",
                alignItems: "center",
                width: "100%",
            }}
        >
            <div style={{ fontWeight: 600, opacity: 0.9 }}>Downloads</div>

            {isDownloading ? (
                <>
                    <div style={{ width: "100%", maxWidth: 200 }}>
                        <ProgressBar
                            pct={progressPct}
                            accentColor={accentColor}
                            height={barHeight}
                        />
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 12,
                            fontSize: fsSmall,
                            opacity: 0.8,
                            fontVariantNumeric: "tabular-nums",
                            width: "100%",
                        }}
                    >
                        <span>{progressPct.toFixed(1)}%</span>
                        <span>{formatEta(etaSeconds)}</span>
                    </div>
                    <div
                        style={{
                            fontSize: fsSmall,
                            opacity: 0.7,
                            fontVariantNumeric: "tabular-nums",
                            width: "100%",
                        }}
                    >
                        {formatSpeed(speedBytesPerSec)}
                    </div>
                    <div
                        style={{
                            fontSize: fsSmall,
                            opacity: 0.65,
                            fontVariantNumeric: "tabular-nums",
                            width: "100%",
                        }}
                    >
                        {formatBytes(totalBytes - remainingBytes)} / {formatBytes(totalBytes)}
                        {isPrefetch ? " (est.)" : ""}
                    </div>
                    {queuedItems.length > 0 && (
                        <div style={{ fontSize: fsSmall, opacity: 0.55, marginTop: 1 }}>
                            +{queuedItems.length} queued
                        </div>
                    )}
                </>
            ) : paused ? (
                <>
                    <div style={{ width: "100%", maxWidth: 200 }}>
                        <ProgressBar
                            pct={progressPct}
                            accentColor={accentColor}
                            height={barHeight}
                        />
                    </div>
                    <div
                        style={{
                            fontSize: fsSmall,
                            opacity: 0.6,
                            fontStyle: "italic",
                            width: "100%",
                        }}
                    >
                        Paused {progressPct > 0 ? `(${progressPct.toFixed(0)}%)` : ""}
                    </div>
                </>
            ) : (
                <div style={{ fontSize: fsSmall, opacity: 0.4 }}>
                    No active downloads
                </div>
            )}
        </div>
    );
}
