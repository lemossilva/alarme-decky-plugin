import { useMemo, useState, useCallback } from "react";
import { ConfirmModal, showModal, Focusable } from "@decky/ui";
import { callable, toaster } from "@decky/api";
import { FaNewspaper, FaExternalLinkAlt } from "react-icons/fa";
import { useUIComposition, UIComposition } from "../utils/uiComposition";
import { openNewsUrl } from "../utils/openNewsUrl";
import { applyNewsFromRaw, fetchNewsShared, useNews, type NewsItem } from "../hooks/useNews";
import { useSettings } from "../hooks/useSettings";
import { formatNewsPublished, groupNewsBySource } from "../utils/newsDisplay";
import {
    getScreensaverCurrentItemId,
    orderNewsForModal,
} from "../utils/newsScreensaverOrder";

const prefetchNewsCall = callable<
    [],
    { success: boolean; payload?: unknown; error?: string }
>("prefetch_news");

interface NewsListModalProps {
    closeModal?: () => void;
}

export function showNewsListModal(): void {
    showModal(<NewsListModalContent />);
}

function NewsListModalContent({ closeModal }: NewsListModalProps) {
    useUIComposition(UIComposition.Opaque);
    const { settings } = useSettings();
    const news = useNews(true);
    const use24h = settings.time_format_24h ?? true;
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [refetching, setRefetching] = useState(false);

    const ordered = useMemo(() => orderNewsForModal(news.items), [news.items]);
    const screensaverItemId = ordered[0]?.id ?? getScreensaverCurrentItemId();
    const groups = useMemo(() => groupNewsBySource(ordered, true), [ordered]);

    const handleClose = () => {
        closeModal?.();
    };

    const handleOpen = useCallback(async (item: NewsItem) => {
        if (openingId || refetching) return;
        setOpeningId(item.id);
        try {
            closeModal?.();
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const ok = await openNewsUrl(item.url);
            if (!ok) {
                toaster.toast({
                    title: "AlarMe",
                    body: "Could not open this link.",
                });
            }
        } finally {
            setOpeningId(null);
        }
    }, [openingId, refetching, closeModal]);

    const handleRefetch = useCallback(async () => {
        if (refetching || openingId) return;
        setRefetching(true);
        try {
            const result = await prefetchNewsCall();
            const payload = result?.payload;
            if (payload && typeof payload === "object") {
                applyNewsFromRaw(payload as Record<string, unknown>);
            } else {
                await fetchNewsShared();
            }
        } catch (e) {
            console.error("[AlarMe] prefetch_news:", e);
            await fetchNewsShared();
        } finally {
            setRefetching(false);
        }
    }, [refetching, openingId]);

    const staleNote =
        news.offline || news.stale
            ? news.offline
                ? "Showing cached headlines (offline)."
                : "Cache may be outdated."
            : null;

    const totalCount = ordered.length;
    const description =
        totalCount > 0
            ? `Select a headline and press A to open it in the Steam browser. Grouped by source; times are when each outlet published the story.${staleNote ? ` ${staleNote}` : ""}`
            : news.loading
              ? "Loading headlines…"
              : "No headlines yet. Tap Refetch below or configure feeds under Settings → News.";

    return (
        <ConfirmModal
            strTitle="Headlines"
            strDescription={description}
            strOKButtonText={refetching ? "Fetching…" : "Refetch"}
            strCancelButtonText="Close"
            onOK={() => void handleRefetch()}
            onCancel={handleClose}
        >
            <div
                style={{
                    height: "42vh",
                    maxHeight: 420,
                    overflowY: "auto",
                    marginTop: 10,
                    padding: "4px 8px 4px 0",
                }}
            >
                <Focusable
                    flow-children="column"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
                    {totalCount === 0 ? (
                        <div
                            style={{
                                fontSize: 13,
                                color: "#888",
                                textAlign: "center",
                                padding: "24px 12px",
                                lineHeight: 1.45,
                            }}
                        >
                            {news.loading
                                ? "Fetching headlines…"
                                : "Nothing to show. Add the News widget on the screensaver and configure feeds in Settings → News."}
                        </div>
                    ) : (
                        groups.map((group) => (
                            <div
                                key={group.source_id}
                                style={{ display: "flex", flexDirection: "column", gap: 8 }}
                            >
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#9ec8e8",
                                        textTransform: "uppercase",
                                        letterSpacing: 0.5,
                                        padding: "4px 2px 0",
                                    }}
                                >
                                    {group.source_label} ({group.items.length})
                                </div>
                                {group.items.map((item) => (
                                    <NewsHeadlineRow
                                        key={`${group.source_id}-${item.id}`}
                                        item={item}
                                        isOnScreensaver={item.id === screensaverItemId}
                                        busy={openingId === item.id}
                                        disabled={refetching}
                                        use24h={use24h}
                                        onOpen={() => void handleOpen(item)}
                                    />
                                ))}
                            </div>
                        ))
                    )}
                </Focusable>
            </div>
        </ConfirmModal>
    );
}

function NewsHeadlineRow({
    item,
    isOnScreensaver,
    busy,
    disabled,
    use24h,
    onOpen,
}: {
    item: NewsItem;
    isOnScreensaver: boolean;
    busy: boolean;
    disabled: boolean;
    use24h: boolean;
    onOpen: () => void;
}) {
    const [focused, setFocused] = useState(false);
    const publishedLabel = formatNewsPublished(item.published_ts, use24h);

    return (
        <Focusable
            onActivate={disabled ? undefined : onOpen}
            onClick={disabled ? undefined : onOpen}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                backgroundColor: focused ? "#4488aa44" : isOnScreensaver ? "#4488aa22" : "#ffffff11",
                border: focused
                    ? "2px solid #ffffff"
                    : isOnScreensaver
                      ? "1px solid #4488aa55"
                      : "1px solid transparent",
                padding: "12px 14px",
                borderRadius: 10,
                opacity: disabled ? 0.55 : 1,
                cursor: disabled ? "default" : "pointer",
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                }}
            >
                <div
                    style={{
                        fontSize: 16,
                        color: "#7eb8da",
                        display: "flex",
                        alignItems: "center",
                        paddingTop: 2,
                        flexShrink: 0,
                    }}
                >
                    <FaNewspaper />
                </div>
                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                        }}
                    >
                        {publishedLabel && (
                            <span style={{ fontSize: 11, color: "#aaa" }}>{publishedLabel}</span>
                        )}
                        {isOnScreensaver && (
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: "#c8e4ff",
                                    textTransform: "uppercase",
                                    letterSpacing: 0.4,
                                }}
                            >
                                On screensaver
                            </span>
                        )}
                    </div>
                    <div
                        style={{
                            fontWeight: 600,
                            fontSize: 14,
                            lineHeight: 1.35,
                            color: "#e8e8e8",
                        }}
                    >
                        {item.title}
                    </div>
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: busy ? "#888" : "#d4ecff",
                }}
            >
                <FaExternalLinkAlt size={11} />
                {busy ? "Opening…" : "Open"}
            </div>
        </Focusable>
    );
}
