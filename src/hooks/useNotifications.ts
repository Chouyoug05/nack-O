import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
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

        const requestPermission = async () => {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    // Get the FCM token
                    const token = await getToken(messaging, {
                        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
                    });

                    if (token && token !== profile?.fcmToken) {
                        setFcmToken(token);
                        console.log('FCM Token generated:', token);
                        // Save token to user profile
                        try {
                            // We only update if the token changed and we have a profile
                            if (profile) {
                                await saveProfile({
                                    ...profile,
                                    fcmToken: token
                                } as UserProfile);
                            }
                        } catch (err) {
                            console.error('Error saving FCM token:', err);
                        }
                    }
                } else {
                    console.warn('Notification permission denied');
                }
            } catch (error) {
                console.error('Error getting notification permission:', error);
            }
        };

        requestPermission();

        // Handle foreground messages
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground message received:', payload);
            toast({
                title: payload.notification?.title || "Nouveau message",
                description: payload.notification?.body || "Vous avez une nouvelle commande",
            });
        });

        return () => unsubscribe();
    }, [userId, toast, profile, saveProfile]);

    return { fcmToken };
};
