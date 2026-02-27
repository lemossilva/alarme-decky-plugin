import { useState, useEffect } from 'react';
import { callable, addEventListener, removeEventListener } from '@decky/api';
import { MissedItem } from '../types';

const getMissedItems = callable<[], MissedItem[]>('get_missed_items');

export function useMissedAlerts() {
    const [missedItems, setMissedItems] = useState<MissedItem[]>([]);

    // Persistent dismissal logic - track when user last viewed the report
    const [lastDismissed, setLastDismissed] = useState<number>(() => {
        return parseInt(localStorage.getItem('alarme_missed_dismissed_at') || '0');
    });

    useEffect(() => {
        const fetchMissed = async () => {
            try {
                const items = await getMissedItems();
                if (items) {
                    setMissedItems(items);
                }
            } catch (e) {
                console.error("Failed to fetch missed items", e);
            }
        };

        fetchMissed();

        const handleMissedUpdate = (items: MissedItem[]) => {
            setMissedItems(items || []);
        };

        addEventListener('alarme_missed_items_updated', handleMissedUpdate);
        return () => { removeEventListener('alarme_missed_items_updated', handleMissedUpdate); };
    }, []);

    const latestMissedTime = missedItems.length > 0
        ? Math.max(...missedItems.map(i => i.missed_at))
        : 0;

    // hasNewMissedAlerts = true when there are NEW missed alerts (not yet seen)
    const hasNewMissedAlerts = missedItems.length > 0 && latestMissedTime > lastDismissed;
    const hasMissedAlerts = missedItems.length > 0;

    const markAsSeen = () => {
        const now = Date.now() / 1000;
        setLastDismissed(now);
        localStorage.setItem('alarme_missed_dismissed_at', now.toString());
    };

    return {
        missedItems,
        hasMissedAlerts,
        hasNewMissedAlerts,
        markAsSeen
    };
}
