import { useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { FaStar, FaSteam, FaGamepad } from "react-icons/fa";
import { useSettings } from "../../hooks/useSettings";
import { useSuggestMeStatus, useSuggestMePresets, useSuggestMeCard } from "../../hooks/useSuggestMe";
import type { SuggestMeCard, SuggestMeGame, ScreensaverLayout } from "../../types";
import { getSuggestMePortraitLibraryUrls, getSuggestMeSteamHeaderUrls } from "../../utils/suggestmeGameCover";
import { stripSteamReviewPercentFromDescription } from "../../utils/suggestmeSteamReviewText";

interface SuggestMeWidgetProps {
    fontSize: number;
    show: boolean;
    screensaverLayout: ScreensaverLayout;
    /** Tighter layout when the widget sits in the centered panel’s small info row. */
    infoRowCompact?: boolean;
}

const MODE_LABELS: Record<string, string> = {
    intelligent: "Smart",
    luck: "Random",
    guided: "Guided",
    fresh_air: "Fresh Air",
};

const GENRE_PILL = {
    background: "rgba(68, 153, 204, 0.92)",
    color: "#fff",
    padding: "0 5px",
    borderRadius: 3,
    fontSize: "inherit",
    fontWeight: 500,
} as const;

/** Steam store header frame (460×215). */
const STEAM_HEADER_ASPECT_RATIO = "460 / 215" as const;
const STEAM_HEADER_ASPECT_NUM = 460 / 215;

function LandscapeHeaderImageBox({
    game,
    fullWidth,
    minStripHeightPx,
    w,
    h,
}: {
    game: SuggestMeGame;
    fullWidth?: boolean;
    minStripHeightPx?: number;
    w?: number;
    h?: number;
}) {
    const urls = getSuggestMeSteamHeaderUrls(game);
    const [idx, setIdx] = useState(0);
    const [failed, setFailed] = useState(false);

    const onError = useCallback(() => {
        if (idx < urls.length - 1) {
            setIdx((i) => i + 1);
        } else {
            setFailed(true);
        }
    }, [idx, urls.length]);

    if (failed || urls.length === 0) {
        const isNs = game.is_non_steam;
        const Icon = isNs ? FaGamepad : FaSteam;
        const bg = isNs ? "rgba(170, 136, 102, 0.18)" : "rgba(68, 136, 170, 0.18)";
        const color = isNs ? "#c9a882" : "#7ab8d4";
        const boxStyle: CSSProperties = fullWidth
            ? {
                width: "100%",
                aspectRatio: STEAM_HEADER_ASPECT_RATIO,
                flexShrink: 0,
                backgroundColor: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...(minStripHeightPx != null ? { minHeight: minStripHeightPx } : {}),
            }
            : {
                width: w!,
                height: h!,
                flexShrink: 0,
                backgroundColor: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            };
        const iconH = fullWidth ? 28 : Math.min(22, Math.round(h! * 0.5));
        return (
            <div style={boxStyle}>
                <Icon size={iconH} style={{ color }} />
            </div>
        );
    }

    const boxStyle: CSSProperties = fullWidth
        ? {
            width: "100%",
            aspectRatio: STEAM_HEADER_ASPECT_RATIO,
            flexShrink: 0,
            overflow: "hidden",
            background: "rgba(0,0,0,0.35)",
            ...(minStripHeightPx != null ? { minHeight: minStripHeightPx } : {}),
        }
        : {
            width: w!,
            height: h!,
            flexShrink: 0,
            overflow: "hidden",
            background: "rgba(0,0,0,0.35)",
        };

    return (
        <div style={boxStyle}>
            <img
                src={urls[idx]}
                alt=""
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                    objectPosition: "center center",
                }}
                onError={onError}
            />
        </div>
    );
}

function PortraitImageBox({ game, w, h }: { game: SuggestMeGame; w: number; h: number }) {
    const urls = getSuggestMePortraitLibraryUrls(game);
    const [idx, setIdx] = useState(0);
    const [failed, setFailed] = useState(false);

    const onError = useCallback(() => {
        if (idx < urls.length - 1) {
            setIdx((i) => i + 1);
        } else {
            setFailed(true);
        }
    }, [idx, urls.length]);

    if (failed || urls.length === 0) {
        const isNs = game.is_non_steam;
        const Icon = isNs ? FaGamepad : FaSteam;
        const bg = isNs ? "rgba(170, 136, 102, 0.18)" : "rgba(68, 136, 170, 0.18)";
        const color = isNs ? "#c9a882" : "#7ab8d4";
        return (
            <div
                style={{
                    width: w,
                    height: h,
                    flexShrink: 0,
                    backgroundColor: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Icon size={Math.min(22, Math.round(h * 0.45))} style={{ color }} />
            </div>
        );
    }

    return (
        <div
            style={{
                width: w,
                height: h,
                flexShrink: 0,
                overflow: "hidden",
                background: "rgba(0,0,0,0.35)",
            }}
        >
            <img
                src={urls[idx]}
                alt=""
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                    objectPosition: "center center",
                }}
                onError={onError}
            />
        </div>
    );
}

const clamp1: CSSProperties = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

/** Large (Centered): horizontal strip — saves width in the narrow floating panel. */
function SuggestMeCenteredRowCard({ card, fontSize, compact }: { card: SuggestMeCard; fontSize: number; compact?: boolean }) {
    const g = card.game!;
    const cardWidth = compact
        ? Math.max(112, Math.min(158, Math.round(fontSize * 3.5)))
        : Math.max(148, Math.min(198, Math.round(fontSize * 4.75)));
    const thumbW = Math.round(
        compact
            ? Math.min(38, Math.max(30, fontSize * 0.64))
            : Math.min(40, Math.max(32, fontSize * 0.72)),
    );
    const thumbH = Math.round(
        compact
            ? Math.min(56, Math.max(46, fontSize * 0.98))
            : Math.min(50, Math.max(40, fontSize * 0.9)),
    );
    const pad = Math.max(3, Math.round(fontSize * (compact ? 0.14 : 0.16)));
    const titleFs = Math.max(9, fontSize * (compact ? 0.36 : 0.42));
    const smallFs = Math.max(7, fontSize * (compact ? 0.27 : 0.3));

    const genres = (g.genres ?? []).filter(Boolean).slice(0, compact ? 1 : 2);
    const modeLabel = card.mode_used ? (MODE_LABELS[card.mode_used] ?? card.mode_used) : "";

    const steamDesc = stripSteamReviewPercentFromDescription((g.steam_review_description ?? "").trim());
    const metacritic = g.metacritic_score ?? 0;

    const storeBadge =
        g.source && g.source !== "steam"
            ? (g.source === "epic" ? "Epic" : g.source === "gog" ? "GOG" : g.source === "amazon" ? "Amazon" : g.source)
            : null;

    const titleClamp3: CSSProperties = {
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        wordBreak: "break-word",
        lineHeight: 1.15,
    };

    const steamDescClamp: CSSProperties = {
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        wordBreak: "break-word",
        lineHeight: 1.2,
    };

    return (
        <div
            style={{
                width: cardWidth,
                maxWidth: compact ? "min(72vw, 158px)" : "min(70vw, 198px)",
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                background: "rgba(12,12,16,0.55)",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                boxSizing: "border-box",
                textAlign: "left",
            }}
        >
            <PortraitImageBox game={g} w={thumbW} h={thumbH} />
            <div
                style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    padding: `${pad}px ${pad + 1}px ${pad}px ${pad}px`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: Math.max(2, Math.round(fontSize * 0.06)),
                }}
            >
                <div style={{ minWidth: 0 }}>
                    <span
                        style={{
                            fontSize: titleFs,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.96)",
                            minWidth: 0,
                            ...titleClamp3,
                        }}
                    >
                        {g.name}
                    </span>
                    {(g.is_non_steam || (storeBadge && !g.is_non_steam)) && (
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 2 }}>
                            {g.is_non_steam && (
                                <span style={{ fontSize: smallFs, color: "#88aacc" }}>(NS)</span>
                            )}
                            {storeBadge && !g.is_non_steam && (
                                <span
                                    style={{
                                        fontSize: smallFs,
                                        color: "#88aacc",
                                        border: "1px solid rgba(102,136,170,0.4)",
                                        padding: "0 4px",
                                        borderRadius: 2,
                                    }}
                                >
                                    {storeBadge}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {(steamDesc || metacritic > 0) && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 4,
                            fontSize: smallFs,
                            color: "rgba(255,255,255,0.65)",
                            minWidth: 0,
                        }}
                    >
                        {steamDesc && (
                            <>
                                <FaStar
                                    style={{ color: "#ffcc00", flexShrink: 0, marginTop: 1 }}
                                    size={Math.max(8, fontSize * (compact ? 0.26 : 0.3))}
                                />
                                <span style={{ flex: "1 1 0", minWidth: 0, ...steamDescClamp }}>{steamDesc}</span>
                            </>
                        )}
                        {metacritic > 0 && (
                            <span
                                style={{
                                    flexShrink: 0,
                                    fontSize: smallFs,
                                    color: "#cfe6a9",
                                    border: "1px solid rgba(160,200,110,0.45)",
                                    padding: "0 4px",
                                    borderRadius: 2,
                                    marginTop: steamDesc ? 1 : 0,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                MC {metacritic}
                            </span>
                        )}
                    </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, minWidth: 0 }}>
                    {genres.map((genre) => (
                        <span key={`g-${genre}`} style={{ ...GENRE_PILL, fontSize: smallFs }}>
                            {genre}
                        </span>
                    ))}
                    {modeLabel && (
                        <span style={{ fontSize: smallFs, color: "rgba(255,255,255,0.38)", marginLeft: "auto", ...clamp1 }}>
                            {modeLabel}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function formatPlaytimeHours(mins: number | undefined): string | null {
    if (!mins || mins <= 0) return null;
    const hours = mins / 60;
    if (hours < 1) return `${Math.round(mins)}m`;
    if (hours < 10) return `${hours.toFixed(1)}h`;
    return `${Math.round(hours)}h`;
}

/** Fullscreen: full-width Steam header strip + compact detail. */
function SuggestMeFullscreenHeaderCard({ card, fontSize }: { card: SuggestMeCard; fontSize: number }) {
    const g = card.game!;
    const stripMinH = Math.max(50, Math.round(44 + fontSize * 0.18));
    const pad = Math.max(5, Math.round(fontSize * 0.14));
    const titleFs = Math.max(9.5, fontSize * 0.35);
    const bodyFs = Math.max(8, fontSize * 0.29);
    const smallFs = Math.max(7, fontSize * 0.26);

    const genres = (g.genres ?? []).filter(Boolean).slice(0, 2);
    const extraTags = ((g.community_tags ?? g.tags) ?? [])
        .filter((t) => t && !genres.includes(t))
        .slice(0, 1);
    const modeLabel = card.mode_used ? (MODE_LABELS[card.mode_used] ?? card.mode_used) : "";

    const steamDesc = stripSteamReviewPercentFromDescription((g.steam_review_description ?? "").trim());
    const metacritic = g.metacritic_score ?? 0;
    const playtime = formatPlaytimeHours(g.playtime_forever);

    const storeBadge =
        g.source && g.source !== "steam"
            ? (g.source === "epic" ? "Epic" : g.source === "gog" ? "GOG" : g.source === "amazon" ? "Amazon" : g.source)
            : null;

    const titleClamp2: CSSProperties = {
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        wordBreak: "break-word",
        lineHeight: 1.18,
    };

    return (
        <div
            style={{
                width: "100%",
                maxWidth: "min(100%, 204px)",
                alignSelf: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                background: "rgba(12,12,16,0.55)",
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                boxSizing: "border-box",
                textAlign: "left",
            }}
        >
            <LandscapeHeaderImageBox game={g} fullWidth minStripHeightPx={stripMinH} />
            <div
                style={{
                    padding: `${pad}px ${pad + 1}px ${pad + 2}px`,
                    display: "flex",
                    flexDirection: "column",
                    gap: Math.max(3, Math.round(fontSize * 0.08)),
                    minWidth: 0,
                }}
            >
                <div style={{ minWidth: 0 }}>
                    <span
                        style={{
                            fontSize: titleFs,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.96)",
                            minWidth: 0,
                            ...titleClamp2,
                        }}
                    >
                        {g.name}
                    </span>
                    {(g.is_non_steam || (storeBadge && !g.is_non_steam)) && (
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 3 }}>
                            {g.is_non_steam && (
                                <span style={{ fontSize: smallFs, color: "#88aacc" }}>(NS)</span>
                            )}
                            {storeBadge && !g.is_non_steam && (
                                <span
                                    style={{
                                        fontSize: smallFs,
                                        color: "#88aacc",
                                        border: "1px solid rgba(102,136,170,0.4)",
                                        padding: "0 3px",
                                        borderRadius: 2,
                                    }}
                                >
                                    {storeBadge}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {(steamDesc || metacritic > 0) && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 4,
                            fontSize: bodyFs,
                            color: "rgba(255,255,255,0.7)",
                            minWidth: 0,
                        }}
                    >
                        {steamDesc && (
                            <>
                                <FaStar
                                    style={{ color: "#ffcc00", flexShrink: 0, marginTop: 1 }}
                                    size={Math.max(7, fontSize * 0.25)}
                                />
                                <span
                                    style={{
                                        flex: "1 1 0",
                                        minWidth: 0,
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                        wordBreak: "break-word",
                                        lineHeight: 1.22,
                                    }}
                                >
                                    {steamDesc}
                                </span>
                            </>
                        )}
                        {metacritic > 0 && (
                            <span
                                style={{
                                    flexShrink: 0,
                                    fontSize: smallFs,
                                    color: "#cfe6a9",
                                    border: "1px solid rgba(160,200,110,0.4)",
                                    padding: "0 3px",
                                    borderRadius: 2,
                                    marginTop: steamDesc ? 1 : 0,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                MC {metacritic}
                            </span>
                        )}
                    </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center", minWidth: 0 }}>
                    {genres.map((genre) => (
                        <span key={`g-${genre}`} style={{ ...GENRE_PILL, fontSize: smallFs }}>
                            {genre}
                        </span>
                    ))}
                    {extraTags.map((tag) => (
                        <span
                            key={`t-${tag}`}
                            style={{
                                fontSize: smallFs,
                                color: "rgba(255,255,255,0.58)",
                                background: "rgba(255,255,255,0.06)",
                                padding: "0 4px",
                                borderRadius: 3,
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                    {modeLabel && (
                        <span style={{ fontSize: smallFs, color: "rgba(255,255,255,0.36)", marginLeft: "auto", ...clamp1 }}>
                            {modeLabel}
                        </span>
                    )}
                </div>

                {playtime && (
                    <div style={{ fontSize: smallFs, color: "rgba(255,255,255,0.4)", ...clamp1 }}>
                        {playtime} played
                    </div>
                )}
            </div>
        </div>
    );
}

export function SuggestMeWidget({
    fontSize,
    show,
    screensaverLayout,
    infoRowCompact,
}: SuggestMeWidgetProps) {
    const { settings } = useSettings();
    const status = useSuggestMeStatus();
    const enabled = show && (settings.screensaver_show_suggestme ?? false);
    const compatible = status?.available && status?.compatible;

    const presets = useSuggestMePresets(enabled && !!compatible);

    const mode = settings.screensaver_suggestme_mode || "intelligent";
    const presetSlot = settings.screensaver_suggestme_preset_slot ?? -1;
    const strategy = settings.screensaver_suggestme_pick_strategy ?? "daily";

    const { card, loading } = useSuggestMeCard(
        enabled && !!compatible,
        mode,
        presetSlot,
        strategy,
        presets
    );

    if (!enabled || !compatible) return null;

    const isCentered = screensaverLayout === "large";
    const centeredThumbH = infoRowCompact
        ? Math.round(Math.min(56, Math.max(46, fontSize * 0.98)))
        : Math.round(Math.min(50, Math.max(40, fontSize * 0.9)));
    const fsCardW = Math.round(Math.min(200, Math.max(140, fontSize * 2.85)));
    const fsBarH = Math.round(fsCardW / STEAM_HEADER_ASPECT_NUM);
    const thumbH = isCentered ? centeredThumbH : fsBarH;
    const minH = Math.max(36, isCentered ? thumbH + 4 : fsBarH + 62);

    if (loading && !card) {
        return (
            <div
                style={{
                    fontSize: fontSize * 0.42,
                    opacity: 0.45,
                    minHeight: minH,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 8px",
                    maxWidth: isCentered ? (infoRowCompact ? 168 : 200) : 204,
                }}
            >
                Finding…
            </div>
        );
    }

    if (!card || !card.game) {
        if (card?.error) {
            return (
                <div
                    style={{
                        fontSize: fontSize * 0.38,
                        opacity: 0.45,
                        minHeight: minH,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 8px",
                        textAlign: "center",
                        maxWidth: isCentered ? (infoRowCompact ? 168 : 200) : 204,
                    }}
                >
                    {card.error}
                </div>
            );
        }
        return null;
    }

    if (isCentered) {
        return <SuggestMeCenteredRowCard card={card} fontSize={fontSize} compact={infoRowCompact} />;
    }

    return <SuggestMeFullscreenHeaderCard card={card} fontSize={fontSize} />;
}
