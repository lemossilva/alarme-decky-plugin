import {
    ButtonItem,
    Focusable,
    PanelSection,
    PanelSectionRow,
    ProgressBarWithInfo,
    SliderField,
    TextField,
    ToggleField,
} from "@decky/ui";
import { addEventListener, callable, removeEventListener, toaster } from "@decky/api";
import { useEffect, useState, useCallback, useMemo } from "react";
import { FaCheck, FaTimes, FaExternalLinkAlt, FaSync, FaTrash } from "react-icons/fa";
import type { NewsCustomFeed } from "../types";
import { useSettings } from "../hooks/useSettings";
import { applyNewsFromRaw, fetchNewsShared, useNews } from "../hooks/useNews";
import { openNewsUrl } from "../utils/openNewsUrl";
import { formatNewsPublished, groupNewsBySource } from "../utils/newsDisplay";
import { orderNewsFromScreensaver } from "../utils/newsScreensaverOrder";

interface NewsPreset {
    id: string;
    label: string;
    url: string;
    custom?: boolean;
}

interface ValidateNewsFeedResult {
    ok: boolean;
    error?: string;
    feed_id?: string;
    entry_count?: number;
    sample_title?: string;
    suggested_label?: string;
}

const MAX_CUSTOM_FEEDS = 10;

const validateNewsFeedCall = callable<[url: string, label: string], ValidateNewsFeedResult>(
    "validate_news_feed",
);

interface NewsFeedCheckResult {
    id: string;
    ok: boolean;
    message: string;
}

const getNewsPresetsCall = callable<[], NewsPreset[]>("get_news_presets");
const prefetchNewsCall = callable<
    [],
    { success: boolean; payload?: unknown; error?: string }
>("prefetch_news");
const checkNewsFeedsCall = callable<[], { reachable: boolean; feeds: NewsFeedCheckResult[] }>("check_news_feeds");
const getNewsStoragePathsCall = callable<[], { news_cache_dir: string; news_cache: string }>(
    "get_news_storage_paths"
);

function validateFeedErrorMessage(code: string | undefined): string {
    switch (code) {
        case "invalid_url":
            return "Enter a valid http or https RSS/Atom URL.";
        case "no_entries":
        case "no_recent_entries":
            return "Feed responded but has no recent headlines.";
        case "parse_failed":
            return "Could not parse this feed as RSS or Atom.";
        default:
            return code || "Could not reach or parse this feed.";
    }
}

function formatFetchedAtLabel(fetchedAt: string | null): string {
    if (!fetchedAt) return "Never";
    try {
        const date = new Date(fetchedAt);
        return date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return fetchedAt;
    }
}

const ScrollableContent = ({ children }: { children: React.ReactNode }) => (
    <div
        style={{
            padding: "16px 24px",
            maxHeight: "calc(100vh - 60px)",
            overflowY: "auto",
        }}
    >
        {children}
    </div>
);

export function SettingsNewsPage() {
    const { settings, updateSetting } = useSettings();
    const news = useNews(true);

    const [presets, setPresets] = useState<NewsPreset[]>([]);
    const [cacheDir, setCacheDir] = useState<string | null>(null);
    const [cachePath, setCachePath] = useState<string | null>(null);
    const [feedHealth, setFeedHealth] = useState<NewsFeedCheckResult[]>([]);
    const [checkingHealth, setCheckingHealth] = useState(false);
    const [prefetchBusy, setPrefetchBusy] = useState(false);
    const [prefetchProgress, setPrefetchProgress] = useState<{ step: number; total: number } | null>(null);
    const [refetchStatus, setRefetchStatus] = useState<string | null>(null);
    const [customFeedUrl, setCustomFeedUrl] = useState("");
    const [customFeedLabel, setCustomFeedLabel] = useState("");
    const [validatingFeed, setValidatingFeed] = useState(false);
    const [validateFeedStatus, setValidateFeedStatus] = useState<string | null>(null);

    const customFeeds: NewsCustomFeed[] = settings.screensaver_news_custom_feeds ?? [];
    const curatedPresets = useMemo(() => presets.filter((p) => !p.custom), [presets]);
    const customPresets = useMemo(() => presets.filter((p) => p.custom), [presets]);

    const enabled = settings.screensaver_news_enabled ?? false;
    const use24h = settings.time_format_24h ?? true;
    const newsGroups = useMemo(() => {
        const ordered = orderNewsFromScreensaver(news.items);
        return groupNewsBySource(ordered, true);
    }, [news.items]);
    const refreshMinutes = settings.screensaver_news_refresh_minutes ?? 30;
    const storedPresetIds: string[] = settings.screensaver_news_enabled_preset_ids ?? [];
    const effectivePresetIds =
        storedPresetIds.length > 0 ? storedPresetIds : presets.map((p) => p.id);

    const reloadPresets = useCallback(() => {
        getNewsPresetsCall().then(setPresets).catch(() => setPresets([]));
    }, []);

    useEffect(() => {
        reloadPresets();
        getNewsStoragePathsCall()
            .then((p) => {
                setCacheDir(p.news_cache_dir ?? null);
                setCachePath(p.news_cache ?? null);
            })
            .catch(() => {
                setCacheDir(null);
                setCachePath(null);
            });
    }, [reloadPresets]);

    useEffect(() => {
        reloadPresets();
    }, [customFeeds, reloadPresets]);

    useEffect(() => {
        if (!enabled) return;
        if (!news.fetchedAt && !news.loading && news.items.length === 0) {
            void fetchNewsShared();
        }
    }, [enabled, news.fetchedAt, news.loading, news.items.length]);

    useEffect(() => {
        const onProgress = (payload: { step: number; total: number; feed_id: string }) => {
            setPrefetchProgress({ step: payload.step, total: Math.max(1, payload.total) });
        };
        const onComplete = (payload?: { success?: boolean; item_count?: number; error?: string }) => {
            setPrefetchBusy(false);
            setPrefetchProgress(null);
            if (payload?.success === false) {
                const err = payload.error;
                setRefetchStatus(
                    err === "no_feeds_enabled"
                        ? "No feeds selected — enable at least one source below."
                        : "Fetch finished with no headlines. Check feed health."
                );
            } else {
                setRefetchStatus(null);
            }
            void fetchNewsShared();
        };
        addEventListener("alarme_news_prefetch_progress", onProgress);
        addEventListener("alarme_news_prefetch_complete", onComplete);
        return () => {
            removeEventListener("alarme_news_prefetch_progress", onProgress);
            removeEventListener("alarme_news_prefetch_complete", onComplete);
        };
    }, []);

    const handleAddCustomFeed = useCallback(async () => {
        if (validatingFeed) return;
        const url = customFeedUrl.trim();
        if (!url) {
            setValidateFeedStatus("Enter a feed URL first.");
            return;
        }
        if (customFeeds.length >= MAX_CUSTOM_FEEDS) {
            setValidateFeedStatus(`At most ${MAX_CUSTOM_FEEDS} custom feeds.`);
            return;
        }
        const duplicate = presets.some((p) => p.url.trim() === url);
        if (duplicate) {
            setValidateFeedStatus("This URL is already in your feed list.");
            return;
        }

        setValidatingFeed(true);
        setValidateFeedStatus(null);
        try {
            const result = await validateNewsFeedCall(url, customFeedLabel.trim());
            if (!result?.ok || !result.feed_id) {
                setValidateFeedStatus(validateFeedErrorMessage(result?.error));
                return;
            }

            const entry: NewsCustomFeed = {
                id: result.feed_id,
                label: (customFeedLabel.trim() || result.suggested_label || "Custom feed").slice(0, 80),
                url,
            };
            const nextCustom = [...customFeeds, entry];
            updateSetting("screensaver_news_custom_feeds", nextCustom);

            const enabled = new Set(effectivePresetIds);
            enabled.add(entry.id);
            updateSetting("screensaver_news_enabled_preset_ids", Array.from(enabled));

            setCustomFeedUrl("");
            setCustomFeedLabel("");
            const count = result.entry_count ?? 0;
            const sample = result.sample_title ? ` — “${result.sample_title}”` : "";
            setValidateFeedStatus(
                `Added. Found ${count} recent headline${count === 1 ? "" : "s"}${sample}.`,
            );
            toaster.toast({
                title: "AlarMe",
                body: `${entry.label} added to news sources.`,
            });
            reloadPresets();
        } catch (e) {
            console.error("[AlarMe] validate_news_feed:", e);
            setValidateFeedStatus("Validation failed — check the URL and network.");
        } finally {
            setValidatingFeed(false);
        }
    }, [
        validatingFeed,
        customFeedUrl,
        customFeedLabel,
        customFeeds,
        presets,
        effectivePresetIds,
        updateSetting,
        reloadPresets,
    ]);

    const handleRemoveCustomFeed = useCallback(
        (feedId: string) => {
            const nextCustom = customFeeds.filter((f) => f.id !== feedId);
            updateSetting("screensaver_news_custom_feeds", nextCustom);
            const nextEnabled = effectivePresetIds.filter((id) => id !== feedId);
            updateSetting("screensaver_news_enabled_preset_ids", nextEnabled);
            reloadPresets();
        },
        [customFeeds, effectivePresetIds, updateSetting, reloadPresets],
    );

    const handleTogglePreset = useCallback(
        (presetId: string, checked: boolean) => {
            const current = new Set(effectivePresetIds);
            if (checked) {
                current.add(presetId);
            } else {
                current.delete(presetId);
            }
            updateSetting("screensaver_news_enabled_preset_ids", Array.from(current));
        },
        [effectivePresetIds, updateSetting]
    );

    const handleRefetch = useCallback(async () => {
        if (prefetchBusy) return;
        const feedCount = effectivePresetIds.length || presets.length || 1;
        setPrefetchBusy(true);
        setRefetchStatus(null);
        setPrefetchProgress({ step: 0, total: feedCount });
        try {
            const result = await prefetchNewsCall();
            const payload = result?.payload;
            if (payload && typeof payload === "object") {
                applyNewsFromRaw(payload as Record<string, unknown>);
            } else {
                await fetchNewsShared();
            }
            if (result?.success === false) {
                const feedMap =
                    payload && typeof payload === "object"
                        ? (payload as { feeds?: Record<string, { ok?: boolean; error?: string }> }).feeds
                        : undefined;
                const failed = feedMap
                    ? Object.entries(feedMap).filter(([, s]) => !s?.ok).length
                    : 0;
                const okCount = feedMap
                    ? Object.entries(feedMap).filter(([, s]) => s?.ok).length
                    : 0;
                setRefetchStatus(
                    result.error === "no_feeds_enabled"
                        ? "No feeds selected — enable at least one source below."
                        : failed > 0
                          ? `No headlines (${okCount} feeds ok, ${failed} failed). See feed status below.`
                          : "Fetch finished with no recent headlines. Try Check Feed Health."
                );
            }
        } catch (e) {
            console.error("[AlarMe] prefetch_news:", e);
            setRefetchStatus("Refetch failed — see plugin log for details.");
            await fetchNewsShared();
        } finally {
            setPrefetchBusy(false);
            setPrefetchProgress(null);
        }
    }, [prefetchBusy, effectivePresetIds.length, presets.length]);

    const handleCheckHealth = useCallback(async () => {
        if (checkingHealth) return;
        setCheckingHealth(true);
        try {
            const result = await checkNewsFeedsCall();
            setFeedHealth(result.feeds);
        } catch {
            setFeedHealth([]);
        } finally {
            setCheckingHealth(false);
        }
    }, [checkingHealth]);

    const handleOpenUrl = useCallback(async (url: string) => {
        try {
            const ok = await openNewsUrl(url);
            if (!ok) {
                toaster.toast({
                    title: "AlarMe",
                    body: "Could not open this link.",
                });
            }
        } catch (e) {
            console.error("[AlarMe] open URL:", e);
            toaster.toast({
                title: "AlarMe",
                body: "Could not open this link.",
            });
        }
    }, []);

    const enabledSet = new Set(effectivePresetIds);
    const lastFetchLabel = formatFetchedAtLabel(news.fetchedAt);

    return (
        <ScrollableContent>
            <Focusable style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <PanelSection title="News Widget">
                    <PanelSectionRow>
                        <ToggleField
                            label="Enable News Widget"
                            description="Show headlines on the screensaver and enable the News button in the plugin header to browse and open articles"
                            checked={enabled}
                            onChange={(val) => {
                                updateSetting("screensaver_news_enabled", val);
                                if (val && storedPresetIds.length === 0 && presets.length > 0) {
                                    updateSetting(
                                        "screensaver_news_enabled_preset_ids",
                                        presets.map((p) => p.id)
                                    );
                                }
                            }}
                        />
                    </PanelSectionRow>

                    <PanelSectionRow>
                        <SliderField
                            label="Refresh Interval"
                            description={`Fetch new headlines every ${refreshMinutes} minutes`}
                            value={refreshMinutes}
                            min={5}
                            max={180}
                            step={5}
                            onChange={(val) => updateSetting("screensaver_news_refresh_minutes", val)}
                            notchCount={8}
                            notchLabels={[
                                { notchIndex: 0, label: "5m" },
                                { notchIndex: 7, label: "3h" },
                            ]}
                        />
                    </PanelSectionRow>
                </PanelSection>

                <PanelSection title="Curated sources">
                    <PanelSectionRow>
                        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
                            Built-in feeds. Toggle which ones appear on the screensaver and in headlines.
                        </div>
                    </PanelSectionRow>
                    {curatedPresets.map((preset) => (
                        <PanelSectionRow key={preset.id}>
                            <ToggleField
                                label={preset.label}
                                checked={enabledSet.has(preset.id)}
                                onChange={(val) => handleTogglePreset(preset.id, val)}
                            />
                        </PanelSectionRow>
                    ))}
                </PanelSection>

                <PanelSection title="Custom RSS feeds">
                    <PanelSectionRow>
                        <div style={{ fontSize: 11, color: "#888", marginBottom: 8, lineHeight: 1.45 }}>
                            Add any RSS or Atom URL. The feed is fetched and parsed before it is saved
                            ({customFeeds.length}/{MAX_CUSTOM_FEEDS}).
                        </div>
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <TextField
                            label="Feed URL"
                            description="https://…"
                            value={customFeedUrl}
                            onChange={(e) => setCustomFeedUrl(e.target.value)}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <TextField
                            label="Display name"
                            description="Optional — auto-filled from the feed when empty"
                            value={customFeedLabel}
                            onChange={(e) => setCustomFeedLabel(e.target.value)}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <ButtonItem
                            layout="below"
                            disabled={validatingFeed || customFeeds.length >= MAX_CUSTOM_FEEDS}
                            onClick={() => void handleAddCustomFeed()}
                        >
                            {validatingFeed ? "Testing feed…" : "Test connection & add"}
                        </ButtonItem>
                    </PanelSectionRow>
                    {validateFeedStatus && (
                        <PanelSectionRow>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: validateFeedStatus.startsWith("Added")
                                        ? "#8ab88a"
                                        : "#d4a574",
                                    lineHeight: 1.45,
                                }}
                            >
                                {validateFeedStatus}
                            </div>
                        </PanelSectionRow>
                    )}
                    {customPresets.length === 0 ? (
                        <PanelSectionRow>
                            <div style={{ fontSize: 11, color: "#666", padding: "4px 0" }}>
                                No custom feeds yet.
                            </div>
                        </PanelSectionRow>
                    ) : (
                        customPresets.map((preset) => (
                            <PanelSectionRow key={preset.id}>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                        width: "100%",
                                    }}
                                >
                                    <ToggleField
                                        label={preset.label}
                                        description={preset.url}
                                        checked={enabledSet.has(preset.id)}
                                        onChange={(val) => handleTogglePreset(preset.id, val)}
                                    />
                                    <ButtonItem
                                        layout="below"
                                        onClick={() => handleRemoveCustomFeed(preset.id)}
                                    >
                                        <FaTrash style={{ marginRight: 6 }} />
                                        Remove feed
                                    </ButtonItem>
                                </div>
                            </PanelSectionRow>
                        ))
                    )}
                </PanelSection>

                <PanelSection title="Diagnostics">
                    <PanelSectionRow>
                        <div style={{ fontSize: 11, color: "#aaa", padding: "4px 0", lineHeight: 1.45 }}>
                            <div>Last fetch: {lastFetchLabel}</div>
                            {news.stale && <div style={{ color: "#d4a574" }}>Cache is stale</div>}
                            {news.offline && <div style={{ color: "#d47474" }}>Offline mode</div>}
                            <div style={{ marginTop: 6 }}>
                                Cache directory:{" "}
                                <code style={{ fontSize: 10 }}>{cacheDir ?? "…"}</code>
                            </div>
                            <div style={{ marginTop: 4 }}>
                                Cache file: <code style={{ fontSize: 10 }}>{cachePath ?? "…"}</code>
                            </div>
                            {refetchStatus && (
                                <div style={{ marginTop: 6, color: "#d4a574" }}>{refetchStatus}</div>
                            )}
                        </div>
                    </PanelSectionRow>

                    <PanelSectionRow>
                        <ButtonItem
                            layout="below"
                            onClick={handleRefetch}
                            disabled={prefetchBusy}
                        >
                            <FaSync style={{ marginRight: 6 }} />
                            {prefetchBusy ? "Fetching…" : "Refetch Now"}
                        </ButtonItem>
                    </PanelSectionRow>

                    {(prefetchBusy || prefetchProgress !== null) && (
                        <PanelSectionRow>
                            <ProgressBarWithInfo
                                nProgress={
                                    prefetchProgress
                                        ? (prefetchProgress.step / prefetchProgress.total) * 100
                                        : 0
                                }
                                sOperationText={
                                    prefetchProgress
                                        ? `Fetching ${prefetchProgress.step}/${prefetchProgress.total}`
                                        : "Starting…"
                                }
                            />
                        </PanelSectionRow>
                    )}

                    {Object.keys(news.feeds).length > 0 && (
                        <PanelSectionRow>
                            <div
                                style={{
                                    fontSize: 11,
                                    padding: "4px 0",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                {Object.entries(news.feeds).map(([id, status]) => {
                                    const preset = presets.find((p) => p.id === id);
                                    return (
                                        <div
                                            key={id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            {status.ok ? (
                                                <FaCheck style={{ color: "#6a6" }} />
                                            ) : (
                                                <FaTimes style={{ color: "#a66" }} />
                                            )}
                                            <span>
                                                {preset?.label || id}
                                                {status.ok
                                                    ? ` (${status.count})`
                                                    : status.error
                                                      ? ` — ${status.error}`
                                                      : ""}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </PanelSectionRow>
                    )}

                    <PanelSectionRow>
                        <ButtonItem layout="below" onClick={handleCheckHealth} disabled={checkingHealth}>
                            {checkingHealth ? "Checking…" : "Check Feed Health"}
                        </ButtonItem>
                    </PanelSectionRow>

                    {feedHealth.length > 0 && (
                        <PanelSectionRow>
                            <div
                                style={{
                                    fontSize: 11,
                                    padding: "8px 0",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                {feedHealth.map((f) => {
                                    const preset = presets.find((p) => p.id === f.id);
                                    return (
                                        <div
                                            key={f.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            {f.ok ? (
                                                <FaCheck style={{ color: "#6a6" }} />
                                            ) : (
                                                <FaTimes style={{ color: "#a66" }} />
                                            )}
                                            <span>{preset?.label || f.id}</span>
                                            {!f.ok && (
                                                <span style={{ color: "#888", fontSize: 10 }}>
                                                    ({f.message})
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </PanelSectionRow>
                    )}
                </PanelSection>

                <PanelSection title="Recent Headlines">
                    {news.items.length === 0 ? (
                        <PanelSectionRow>
                            <div style={{ fontSize: 12, color: "#666", padding: "8px 0" }}>
                                {news.loading ? "Loading…" : "No headlines available. Enable feeds and refetch."}
                            </div>
                        </PanelSectionRow>
                    ) : (
                        newsGroups.map((group) => (
                            <PanelSection
                                key={group.source_id}
                                title={`${group.source_label} (${group.items.length})`}
                            >
                                {group.items.map((item) => (
                                    <PanelSectionRow key={`${group.source_id}-${item.id}`}>
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 4,
                                                width: "100%",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    lineHeight: 1.35,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                }}
                                            >
                                                {item.title}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "#888",
                                                    marginBottom: 4,
                                                }}
                                            >
                                                {formatNewsPublished(item.published_ts, use24h)}
                                            </div>
                                            <ButtonItem
                                                layout="below"
                                                onClick={() => void handleOpenUrl(item.url)}
                                            >
                                                <FaExternalLinkAlt style={{ marginRight: 6 }} />
                                                Open article
                                            </ButtonItem>
                                        </div>
                                    </PanelSectionRow>
                                ))}
                            </PanelSection>
                        ))
                    )}
                </PanelSection>
            </Focusable>
        </ScrollableContent>
    );
}
