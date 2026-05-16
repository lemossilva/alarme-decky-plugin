import { callable } from "@decky/api";

declare const SteamClient: {
    System?: {
        OpenInSteamBrowser?: (url: string) => void;
        OpenUrlInOverlay?: (url: string) => void;
        OpenInDefaultBrowser?: (url: string) => void;
    };
    Browser?: {
        OpenURL?: (url: string) => void;
    };
};

const openNewsUrlCall = callable<[url: string], { success: boolean; url?: string; error?: string }>(
    "open_news_url",
);

function getSteamClient(): typeof SteamClient | undefined {
    if (typeof SteamClient !== "undefined") return SteamClient;
    return (globalThis as unknown as { SteamClient?: typeof SteamClient }).SteamClient;
}

function openViaSteamClient(target: string): boolean {
    try {
        const sc = getSteamClient();
        const sys = sc?.System;
        if (sys?.OpenInSteamBrowser) {
            sys.OpenInSteamBrowser(target);
            return true;
        }
        if (sys?.OpenUrlInOverlay) {
            sys.OpenUrlInOverlay(target);
            return true;
        }
        if (sc?.Browser?.OpenURL) {
            sc.Browser.OpenURL(target);
            return true;
        }
        if (sys?.OpenInDefaultBrowser) {
            sys.OpenInDefaultBrowser(target);
            return true;
        }
    } catch {
        // window.open last resort below.
    }
    return false;
}

export async function openNewsUrl(url: string): Promise<boolean> {
    const trimmed = url.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return false;
    }

    let target = trimmed;
    try {
        const result = await openNewsUrlCall(trimmed);
        if (result?.success && result.url) {
            target = result.url;
        }
    } catch {
        // Backend may still have launched steam/xdg-open; always try Steam UI APIs next.
    }

    if (openViaSteamClient(target)) {
        return true;
    }

    try {
        window.open(target, "_blank");
        return true;
    } catch {
        return false;
    }
}
