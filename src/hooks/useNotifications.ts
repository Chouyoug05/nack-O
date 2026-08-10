import { useEffect, useState } from 'react';
import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { messaging } from '@/lib/firebase';
import { useToast } from './use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types/profile';

export const useNotifications = (userId?: string) => {
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const { toast } = useToast();
    const { saveProfile, profile } = useAuth();

    useEffect(() => {
        if (!userId || !messaging) return;
        let unsubMessage: (() => void) | undefined;
        let cancelled = false;

        const setup = async () => {
            try {
                const supported = await isSupported().catch(() => false);
                if (!supported || cancelled) return;

                if (typeof Notification === 'undefined') return;

                // Ne pas relancer la demande si l'utilisateur a déjà refusé / bloqué
                if (Notification.permission === 'denied') {
                    return;
                }

                let permission = Notification.permission;
                if (permission === 'default') {
                    permission = await Notification.requestPermission();
                }
                if (permission !== 'granted' || cancelled) return;

                const token = await getToken(messaging, {
                    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
                });

                if (token && token !== profile?.fcmToken) {
                    setFcmToken(token);
                    if (profile) {
                        try {
                            await saveProfile({
                                ...profile,
                                fcmToken: token,
                            } as UserProfile);
                        } catch (err) {
                            console.error('Error saving FCM token:', err);
                        }
                    }
                }

                unsubMessage = onMessage(messaging, (payload) => {
                    toast({
                        title: payload.notification?.title || 'Nouveau message',
                        description: payload.notification?.body || 'Vous avez une nouvelle commande',
                    });
                });
            } catch (error) {
                // "Feature is disabled" / permission bloquée : non bloquant
                const msg = error instanceof Error ? error.message : String(error);
                if (!/permission|denied|blocked|disabled|messaging/i.test(msg)) {
                    console.error('Error getting notification permission:', error);
                }
            }
        };

        void setup();

        return () => {
            cancelled = true;
            if (unsubMessage) unsubMessage();
        };
    }, [userId, toast, profile, saveProfile]);

    return { fcmToken };
};
