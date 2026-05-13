import { useCallback, useEffect, useState, useRef } from 'react';
import { addEventListener, removeEventListener, callable } from '@decky/api';
import type { ScreensaverProfiles, UserSettings } from '../types';

const getProfilesCall = callable<[], ScreensaverProfiles>('get_screensaver_profiles');
const saveProfileCall = callable<[slot: string, name: string], boolean>('save_screensaver_profile');
const loadProfileCall = callable<[slot: string], UserSettings>('load_screensaver_profile');
const deleteProfileCall = callable<[slot: string], boolean>('delete_screensaver_profile');

const DEFAULT_PROFILES: ScreensaverProfiles = {
    slot_1: null,
    slot_2: null,
    slot_3: null,
};

export function useScreensaverProfiles() {
    const [profiles, setProfiles] = useState<ScreensaverProfiles>(DEFAULT_PROFILES);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

    const loadProfiles = useCallback(async () => {
        try {
            const data = await getProfilesCall();
            if (mountedRef.current) {
                setProfiles(data || DEFAULT_PROFILES);
            }
        } catch (e) {
            console.error('Failed to load screensaver profiles:', e);
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        loadProfiles();

        const handleProfilesUpdate = (updatedProfiles: ScreensaverProfiles) => {
            if (mountedRef.current) {
                setProfiles(updatedProfiles || DEFAULT_PROFILES);
            }
        };

        addEventListener('alarme_profiles_updated', handleProfilesUpdate);

        return () => {
            mountedRef.current = false;
            removeEventListener('alarme_profiles_updated', handleProfilesUpdate);
        };
    }, [loadProfiles]);

    const saveProfile = useCallback(async (slot: string, name: string): Promise<boolean> => {
        try {
            const success = await saveProfileCall(slot, name);
            return success;
        } catch (e) {
            console.error('Failed to save profile:', e);
            return false;
        }
    }, []);

    const loadProfile = useCallback(async (slot: string): Promise<boolean> => {
        try {
            await loadProfileCall(slot);
            return true;
        } catch (e) {
            console.error('Failed to load profile:', e);
            return false;
        }
    }, []);

    const deleteProfile = useCallback(async (slot: string): Promise<boolean> => {
        try {
            const success = await deleteProfileCall(slot);
            return success;
        } catch (e) {
            console.error('Failed to delete profile:', e);
            return false;
        }
    }, []);

    return {
        profiles,
        loading,
        saveProfile,
        loadProfile,
        deleteProfile,
        refetch: loadProfiles,
    };
}
