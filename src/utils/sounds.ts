// Get the plugin directory path for loading assets
const directoryPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);
import { callable } from "@decky/api";

// Special filename for soundless mode
export const SOUNDLESS = 'soundless';

/**
 * Convert base64 string to object URL for audio playback
 */
export function base64ToObjectURL(base64: string, mimeType: string): string {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
}

/**
 * Check if a sound filename is the soundless option
 */
export function isSoundless(soundFile: string): boolean {
    return soundFile === SOUNDLESS;
}

const getSoundDataCall = callable<[filename: string], { success: boolean; data: string | null; mime_type: string | null; error?: string }>('get_sound_data');

/**
 * Play the alarm sound
 * @param soundFile - filename of sound to play (or 'soundless' for no sound)
 * @param volume - optional volume override (0-100)
 */
export async function playAlarmSound(soundFile: string = 'alarm.mp3', volume?: number): Promise<HTMLAudioElement | null> {
    // Handle soundless mode - just return null, no sound
    if (isSoundless(soundFile)) {
        console.log('Soundless mode - no audio played');
        return null;
    }

    let audio: HTMLAudioElement;

    // Custom sounds: fetch base64 from backend
    if (soundFile.startsWith('custom:')) {
        try {
            const result = await getSoundDataCall(soundFile);
            if (!result.success || !result.data || !result.mime_type) {
                console.error('[Alarme] Failed to load custom sound:', result.error);
                return null;
            }

            const blobUrl = base64ToObjectURL(result.data, result.mime_type);

            audio = new Audio(blobUrl);
            // Store blob URL for cleanup in stopSound (onended won't fire if looped)
            (audio as any)._blobUrl = blobUrl;
            audio.onended = () => {
                URL.revokeObjectURL(blobUrl);
                (audio as any)._blobUrl = null;
            };
        } catch (e) {
            console.error('[Alarme] Failed to prepare custom sound:', e);
            return null;
        }
    } else {
        // Built-in sounds
        audio = new Audio(directoryPath + soundFile);
    }

    if (volume !== undefined) {
        audio.volume = Math.max(0, Math.min(1, volume / 100));
    }

    try {
        await audio.play();
        return audio;
    } catch (e) {
        console.error('Failed to play alarm sound:', e);
        return null;
    }
}

/**
 * Play a gentle notification sound
 */
export function playNotificationSound(): HTMLAudioElement | null {
    try {
        const audio = new Audio(directoryPath + 'notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.error('Failed to play notification sound:', e));
        return audio;
    } catch (e) {
        console.error('Failed to create audio element:', e);
        return null;
    }
}

/**
 * Stop playing a sound
 */
export function stopSound(audio: HTMLAudioElement | null): void {
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        // Revoke blob URL if present (for custom sounds)
        const blobUrl = (audio as any)._blobUrl;
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            (audio as any)._blobUrl = null;
        }
    }
}
