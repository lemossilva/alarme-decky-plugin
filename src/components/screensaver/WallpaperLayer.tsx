import { useSettings } from "../../hooks/useSettings";
import { useWallpaper } from "../../hooks/useWallpaper";

const BLUR_VALUES: Record<string, string> = {
    none: "0px",
    light: "3px",
    heavy: "10px"
};

const PROVIDER_LABELS: Record<string, string> = {
    picsum: "Lorem Picsum",
    bing_daily: "Bing Daily",
    local_folder: "Local Folder",
    none: "None",
};

interface WallpaperLayerProps {
    show: boolean;
}

export function WallpaperLayer({ show }: WallpaperLayerProps) {
    const { settings } = useSettings();
    const wallpaper = useWallpaper(show);
    const fit = settings.screensaver_wallpaper_fit || "cover";
    const blur = settings.screensaver_wallpaper_blur || "none";
    const dim = settings.screensaver_wallpaper_dim ?? 0.4;
    const provider = settings.screensaver_wallpaper_provider || "none";

    if (!show) return null;

    const providerLabel = PROVIDER_LABELS[provider] || provider;

    if (wallpaper.loading || wallpaper.error || !wallpaper.url) {
        let statusText: string;
        let statusColor = "#666";
        if (wallpaper.loading) {
            statusText = `Loading wallpaper from ${providerLabel}...`;
        } else if (wallpaper.error) {
            const errMsg = wallpaper.status?.errorMessage;
            statusText = errMsg
                ? `${providerLabel}: ${errMsg}`
                : `Failed to load wallpaper from ${providerLabel}`;
            statusColor = "#a55";
        } else {
            statusText = "No wallpaper available";
            statusColor = "#555";
        }

        return (
            <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}>
                <div style={{
                    color: statusColor,
                    fontSize: 14,
                    fontFamily: "system-ui, sans-serif",
                    textAlign: "center",
                    padding: 20,
                }}>
                    {statusText}
                </div>
            </div>
        );
    }

    const src = wallpaper.url;

    return (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden" }}>
            <img
                src={src}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: fit,
                    filter: `blur(${BLUR_VALUES[blur] || "0px"})`,
                }}
            />
            <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: `rgba(0,0,0,${dim})`,
            }} />
        </div>
    );
}