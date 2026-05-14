const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps";
const STEAM_AKAMAI = "https://steamcdn-a.akamaihd.net/steam/apps";

export interface SuggestMeCoverGame {
    appid: number;
    is_non_steam?: boolean;
    matched_appid?: number | null;
    img_icon_url?: string;
}

function effectiveAppId(game: SuggestMeCoverGame): number {
    if (game.matched_appid) return game.matched_appid;
    return game.appid;
}

/** Same landscape fallback chain as SuggestMe `GameImage` (header → hero_capsule → capsule). */
export function getSuggestMeLandscapeCoverUrls(game: SuggestMeCoverGame): string[] {
    const appid = effectiveAppId(game);
    if (!appid) return [];
    return [
        `${STEAM_AKAMAI}/${appid}/header.jpg`,
        `${STEAM_CDN}/${appid}/header.jpg`,
        `${STEAM_CDN}/${appid}/hero_capsule.jpg`,
        `${STEAM_CDN}/${appid}/capsule_467x181.jpg`,
    ];
}

/** Steam store header (460×215) only — for layouts that need a short landscape strip. */
export function getSuggestMeSteamHeaderUrls(game: SuggestMeCoverGame): string[] {
    const appid = effectiveAppId(game);
    if (!appid) return [];
    return [
        `${STEAM_AKAMAI}/${appid}/header.jpg`,
        `${STEAM_CDN}/${appid}/header.jpg`,
    ];
}

/** Portrait library art (SuggestMe `GameImage` portrait), then header fallback. */
export function getSuggestMePortraitLibraryUrls(game: SuggestMeCoverGame): string[] {
    const appid = effectiveAppId(game);
    if (!appid) return [];
    return [
        `${STEAM_CDN}/${appid}/library_600x900.jpg`,
        `${STEAM_CDN}/${appid}/library_600x900_2x.jpg`,
        `${STEAM_AKAMAI}/${appid}/header.jpg`,
    ];
}
