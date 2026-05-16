import type { NewsItem } from "../hooks/useNews";
import { groupNewsBySource, sortNewsByRecency } from "./newsDisplay";

let rotationIds: string[] = [];
let rotationPos = 0;

function shuffleIndices(indices: number[]): number[] {
    const out = [...indices];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** Global newest first, then round-robin one headline per provider per round (shuffled provider order). */
function buildRotationIds(items: NewsItem[]): string[] {
    if (items.length === 0) return [];
    if (items.length === 1) return [items[0].id];

    const sorted = sortNewsByRecency(items);
    const groups = groupNewsBySource(sorted);
    const queues: NewsItem[][] = groups.map((g) => [...g.items]);

    const result: string[] = [];
    const globalNewest = sorted[0];
    result.push(globalNewest.id);

    for (const queue of queues) {
        if (queue.length > 0 && queue[0].id === globalNewest.id) {
            queue.shift();
            break;
        }
    }

    while (queues.some((q) => q.length > 0)) {
        const active = queues
            .map((q, i) => (q.length > 0 ? i : -1))
            .filter((i) => i >= 0);
        for (const i of shuffleIndices(active)) {
            const next = queues[i].shift();
            if (next) result.push(next.id);
        }
    }

    return result;
}

function idSetKey(ids: string[]): string {
    return [...ids].sort().join("\n");
}

let lastItemIdSetKey = "";

export function syncScreensaverRotation(items: NewsItem[]): NewsItem[] {
    const sorted = sortNewsByRecency(items);
    const nextKey = idSetKey(sorted.map((i) => i.id));

    if (nextKey !== lastItemIdSetKey) {
        const currentId = rotationIds[rotationPos];
        rotationIds = buildRotationIds(sorted);
        lastItemIdSetKey = nextKey;
        if (currentId) {
            const idx = rotationIds.indexOf(currentId);
            rotationPos = idx >= 0 ? idx : 0;
        } else {
            rotationPos = 0;
        }
    }

    if (rotationPos >= rotationIds.length) {
        rotationPos = 0;
    }

    const byId = new Map(sorted.map((i) => [i.id, i]));
    return rotationIds.map((id) => byId.get(id)).filter((i): i is NewsItem => i != null);
}

export function advanceScreensaverRotation(): void {
    if (rotationIds.length === 0) return;
    rotationPos = (rotationPos + 1) % rotationIds.length;
}

export function getScreensaverRotationIndex(): number {
    return rotationPos;
}

export function getScreensaverCurrentItemId(): string | null {
    return rotationIds[rotationPos] ?? null;
}

/** Flat list in screensaver rotation order, starting at the headline currently on screen. */
export function orderNewsFromScreensaver(items: NewsItem[]): NewsItem[] {
    const rotationItems = syncScreensaverRotation(items);
    if (rotationItems.length === 0) return [];
    if (rotationPos <= 0) return rotationItems;
    return [...rotationItems.slice(rotationPos), ...rotationItems.slice(0, rotationPos)];
}

export function orderNewsForModal(items: NewsItem[]): NewsItem[] {
    return orderNewsFromScreensaver(items);
}
