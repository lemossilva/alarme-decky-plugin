import { useState, useEffect, useRef } from "react";



declare const SteamClient: any;



interface DownloadOverview {

    paused: boolean;

    throttling_suspended: boolean;

    update_appid: number;

    update_bytes_downloaded: number;

    update_bytes_to_download: number;

    update_network_bytes_per_second: number;

    update_disc_bytes_per_second: number;

    update_seconds_remaining: number;

    update_state: "None" | "Starting" | "Updating" | "Stopping";

    update_is_install: boolean;

    update_is_shader: boolean;

    update_is_workshop: boolean;

    update_is_prefetch_estimate: boolean;

}



interface DownloadItem {

    appid: number;

    active: boolean;

    paused: boolean;

    completed: boolean;

    completed_time: number;

    queue_index: number;

    downloaded_bytes: number;

    total_bytes: number;

    deferred_time: number;

    launch_on_completion: boolean;

    update_type_info?: Array<{

        has_update?: boolean;

        completed_update?: boolean;

        progress?: Array<{ bytes_total?: number; bytes_in_progress?: number }>;

    }>;

}



export interface SteamDownloadState {

    overview: DownloadOverview | null;

    items: DownloadItem[];

    isDownloading: boolean;

    activeItem: DownloadItem | null;

    queuedItems: DownloadItem[];

    progressPct: number;

    speedBytesPerSec: number;

    etaSeconds: number;

    totalBytes: number;

    remainingBytes: number;

}



const EMPTY_STATE: SteamDownloadState = {

    overview: null,

    items: [],

    isDownloading: false,

    activeItem: null,

    queuedItems: [],

    progressPct: 0,

    speedBytesPerSec: 0,

    etaSeconds: 0,

    totalBytes: 0,

    remainingBytes: 0,

};



function parseRegisterForDownloadItemsArgs(args: any[]): DownloadItem[] {

    const arr: any[] = Array.isArray(args[1]) ? args[1] : Array.isArray(args[0]) ? args[0] : [];

    if (arr.length > 0 && arr[0]?.item_data !== undefined) {

        const localEntry = arr.find((e: any) => String(e?.remote_client_id) === "0");

        return (localEntry?.item_data as DownloadItem[]) ?? [];

    }

    return arr as DownloadItem[];

}



function itemNestedByteTotals(item: DownloadItem | null): { downloaded: number; total: number } {

    if (!item?.update_type_info?.length) {

        return { downloaded: item?.downloaded_bytes ?? 0, total: item?.total_bytes ?? 0 };

    }

    let total = 0;

    let downloaded = 0;

    for (const info of item.update_type_info) {

        if (info?.has_update && !info?.completed_update) {

            for (const prog of info.progress ?? []) {

                total += prog.bytes_total ?? 0;

                downloaded += prog.bytes_in_progress ?? 0;

            }

        }

    }

    if (total > 0) return { downloaded, total };

    return { downloaded: item.downloaded_bytes ?? 0, total: item.total_bytes ?? 0 };

}



function deriveState(overview: DownloadOverview | null, items: DownloadItem[]): SteamDownloadState {

    const activeItem = items.find((i) => i.active && !i.completed) ?? null;

    const queuedItems = items

        .filter((i) => !i.active && !i.completed && i.queue_index >= 0)

        .sort((a, b) => a.queue_index - b.queue_index);



    let totalBytes = overview?.update_bytes_to_download ?? 0;

    let downloadedBytes = overview?.update_bytes_downloaded ?? 0;

    if ((totalBytes <= 0 || !Number.isFinite(totalBytes)) && activeItem) {

        const nested = itemNestedByteTotals(activeItem);

        if (nested.total > 0) {

            totalBytes = nested.total;

            downloadedBytes = nested.downloaded;

        }

    }



    const remainingBytes = Math.max(0, totalBytes - downloadedBytes);

    const progressPct =

        totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0;



    const state = overview?.update_state ?? "None";

    const hasByteProgress = totalBytes > 0 && downloadedBytes < totalBytes;

    const itemsSuggestActive = items.some(

        (i) => i.active === true && i.completed !== true && i.paused !== true,

    );

    const overviewActive =

        overview != null &&

        !overview.paused &&

        state !== "Stopping" &&

        (state === "Updating" || state === "Starting" || hasByteProgress);



    const isActive = overviewActive || itemsSuggestActive;



    return {

        overview,

        items,

        isDownloading: isActive,

        activeItem,

        queuedItems,

        progressPct,

        speedBytesPerSec: overview?.update_network_bytes_per_second ?? 0,

        etaSeconds: overview?.update_seconds_remaining ?? 0,

        totalBytes,

        remainingBytes,

    };

}



function unregister(reg: any): void {

    if (!reg) return;

    if (typeof reg.unregister === "function") {

        reg.unregister();

        return;

    }

    if (typeof reg === "function") reg();

}



export function useSteamDownloads(enabled: boolean): SteamDownloadState {

    const [state, setState] = useState<SteamDownloadState>(EMPTY_STATE);

    const mountedRef = useRef(true);

    const overviewRef = useRef<DownloadOverview | null>(null);

    const itemsRef = useRef<DownloadItem[]>([]);



    useEffect(() => {

        mountedRef.current = true;

        return () => {

            mountedRef.current = false;

        };

    }, []);



    useEffect(() => {

        if (!enabled) {

            setState(EMPTY_STATE);

            return;

        }



        let unregOverview: any;

        let unregItems: any;



        try {

            if (SteamClient?.Downloads?.RegisterForDownloadOverview) {

                unregOverview = SteamClient.Downloads.RegisterForDownloadOverview(

                    (ov: DownloadOverview) => {

                        overviewRef.current = ov;

                        if (mountedRef.current) {

                            setState(deriveState(ov, itemsRef.current));

                        }

                    },

                );

            }



            if (SteamClient?.Downloads?.RegisterForDownloadItems) {

                unregItems = SteamClient.Downloads.RegisterForDownloadItems((...args: any[]) => {

                    const items = parseRegisterForDownloadItemsArgs(args);

                    itemsRef.current = items;

                    if (mountedRef.current) {

                        setState(deriveState(overviewRef.current, items));

                    }

                });

            }

        } catch (e) {

            console.error("AlarMe: useSteamDownloads subscription failed", e);

        }



        return () => {

            unregister(unregOverview);

            unregister(unregItems);

        };

    }, [enabled]);



    useEffect(() => {

        if (!enabled || !state.isDownloading) return undefined;

        const intervalMs = 400;

        const id = window.setInterval(() => {

            if (!mountedRef.current) return;

            setState(deriveState(overviewRef.current, itemsRef.current));

        }, intervalMs);

        return () => window.clearInterval(id);

    }, [enabled, state.isDownloading]);



    return state;

}

