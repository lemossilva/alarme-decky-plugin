import type { NewsItem } from "../hooks/useNews";
import { formatTime } from "./time";

export interface NewsSourceGroup {
    source_id: string;
    source_label: string;
    items: NewsItem[];
}

export function sortNewsByRecency(items: NewsItem[]): NewsItem[] {
    return [...items].sort((a, b) => {
        const diff = (b.published_ts || 0) - (a.published_ts || 0);
        if (diff !== 0) return diff;
        return a.title.localeCompare(b.title);
    });
}

export function groupNewsBySource(
    items: NewsItem[],
    preserveGroupOrder = false,
): NewsSourceGroup[] {
    const map = new Map<string, NewsItem[]>();
    const labels = new Map<string, string>();
    const firstSeen = new Map<string, number>();

    items.forEach((item, index) => {
        const key = item.source_id || item.source_label || "unknown";
        if (!map.has(key)) {
            map.set(key, []);
            labels.set(key, item.source_label || key);
            firstSeen.set(key, index);
        }
        map.get(key)!.push(item);
    });

    const groups: NewsSourceGroup[] = [];
    for (const [source_id, groupItems] of map.entries()) {
        groups.push({
            source_id,
            source_label: labels.get(source_id) || source_id,
            items: preserveGroupOrder ? groupItems : sortNewsByRecency(groupItems),
        });
    }

    if (preserveGroupOrder) {
        groups.sort(
            (a, b) => (firstSeen.get(a.source_id) ?? 0) - (firstSeen.get(b.source_id) ?? 0),
        );
    } else {
        groups.sort((a, b) => {
            const aMax = a.items[0]?.published_ts || 0;
            const bMax = b.items[0]?.published_ts || 0;
            if (bMax !== aMax) return bMax - aMax;
            return a.source_label.localeCompare(b.source_label);
        });
    }

    return groups;
}

export function formatNewsPublished(
    ts: number,
    use24h = true,
    compact = false,
): string {
    if (!ts || !Number.isFinite(ts)) return "";

    const d = new Date(ts * 1000);
    if (Number.isNaN(d.getTime())) return "";

    const now = new Date();
    const timeStr = formatTime(d.getHours(), d.getMinutes(), use24h);

    if (compact) {
        if (d.toDateString() === now.toDateString()) {
            return timeStr;
        }
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) {
            return `Yday ${timeStr}`;
        }
        return d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
    }

    if (d.toDateString() === now.toDateString()) {
        return `Today, ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${timeStr}`;
    }

    const opts: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: !use24h,
    };
    if (d.getFullYear() !== now.getFullYear()) {
        opts.year = "numeric";
    }

    return d.toLocaleString(undefined, opts);
}
