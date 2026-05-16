import { useEffect, useMemo, useState, useRef } from "react";
import type { CSSProperties } from "react";
import { FaNewspaper, FaExclamationTriangle } from "react-icons/fa";
import { useSettings } from "../../hooks/useSettings";
import { useNews, NewsItem } from "../../hooks/useNews";
import { formatNewsPublished } from "../../utils/newsDisplay";
import {
    advanceScreensaverRotation,
    getScreensaverRotationIndex,
    syncScreensaverRotation,
} from "../../utils/newsScreensaverOrder";

const ROTATION_SECONDS = 12;

interface NewsWidgetProps {
    fontSize: number;
    show: boolean;
}

function truncateSource(label: string, maxLen: number): string {
    const t = label.trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen - 1)}…`;
}

export function NewsWidget({ fontSize, show }: NewsWidgetProps) {
    const { settings } = useSettings();
    const news = useNews(show);
    const [rotationTick, setRotationTick] = useState(0);
    const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const enabled = settings.screensaver_news_enabled ?? false;
    const use24h = settings.time_format_24h ?? true;

    const rotationItems = useMemo(() => {
        if (!enabled || news.items.length === 0) return [];
        return syncScreensaverRotation(news.items);
    }, [enabled, news.items, rotationTick]);

    const rotationIndex = getScreensaverRotationIndex();
    const item: NewsItem | null =
        rotationItems.length > 0
            ? rotationItems[rotationIndex] || rotationItems[0]
            : null;

    useEffect(() => {
        if (!show || !enabled || rotationItems.length <= 1) {
            if (rotationRef.current) {
                clearInterval(rotationRef.current);
                rotationRef.current = null;
            }
            return;
        }

        rotationRef.current = setInterval(() => {
            advanceScreensaverRotation();
            setRotationTick((t) => t + 1);
        }, ROTATION_SECONDS * 1000);

        return () => {
            if (rotationRef.current) {
                clearInterval(rotationRef.current);
                rotationRef.current = null;
            }
        };
    }, [show, enabled, rotationItems.length]);

    if (!show) return null;

    const lineFs = fontSize * 0.5;
    const titleFs = fontSize * 0.58;
    const hintFs = fontSize * 0.42;

    const shellStyle: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: fontSize * 0.1,
        minWidth: 108,
        maxWidth: 168,
        textAlign: "left",
        color: "inherit",
        pointerEvents: "none",
    };

    const metaRowStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: fontSize * 0.16,
        fontSize: lineFs,
        opacity: 0.75,
        minWidth: 0,
    };

    const titleStyle: CSSProperties = {
        fontSize: titleFs,
        fontWeight: 500,
        lineHeight: 1.26,
        display: "-webkit-box",
        WebkitLineClamp: 4,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        textOverflow: "ellipsis",
        wordBreak: "break-word",
    };

    const footerStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: hintFs,
        opacity: 0.55,
        marginTop: fontSize * 0.02,
    };

    const renderCompactMessage = (text: string, dim = true) => (
        <div style={{ ...shellStyle, opacity: dim ? 0.65 : 1 }}>
            <div style={metaRowStyle}>
                <FaNewspaper size={lineFs * 1.1} />
                <span>News</span>
            </div>
            <div style={{ fontSize: titleFs, lineHeight: 1.3 }}>{text}</div>
        </div>
    );

    if (!enabled) {
        return renderCompactMessage("Enable in Settings → News");
    }

    if (news.loading && news.items.length === 0 && !news.error) {
        return renderCompactMessage("Loading…");
    }

    if (!item) {
        const msg = news.error
            ? "Unavailable"
            : news.offline || news.stale
              ? "No cache — refetch"
              : "No headlines";
        return renderCompactMessage(msg);
    }

    const isStale = news.stale || news.offline;
    const countLabel =
        rotationItems.length > 1 ? `${rotationIndex + 1}/${rotationItems.length}` : null;
    const publishedLabel = formatNewsPublished(item.published_ts, use24h, true);

    return (
        <div style={shellStyle} title={item.title}>
            <div style={metaRowStyle}>
                <FaNewspaper size={lineFs * 1.05} style={{ flexShrink: 0 }} />
                <span
                    style={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                        flex: 1,
                    }}
                >
                    {truncateSource(item.source_label, 14)}
                </span>
                {publishedLabel && (
                    <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                        {publishedLabel}
                    </span>
                )}
            </div>
            <div style={titleStyle}>{item.title}</div>
            <div style={footerStyle}>
                <span>
                    {isStale && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            {news.offline && <FaExclamationTriangle size={hintFs * 0.9} />}
                            {news.offline ? "offline" : "stale"}
                        </span>
                    )}
                </span>
                {countLabel && <span>{countLabel}</span>}
            </div>
        </div>
    );
}
