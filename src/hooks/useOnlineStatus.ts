import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to detect online/offline status using Capacitor for native or window events for web
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        // Initialize status
        const initNetwork = async () => {
            if (Capacitor.isNativePlatform()) {
                const status = await Network.getStatus();
                setIsOnline(status.connected);
            }
        };
        initNetwork();

        // Listen for changes
        let listener: any = null;
        
        const setupListeners = async () => {
            if (Capacitor.isNativePlatform()) {
                listener = await Network.addListener('networkStatusChange', status => {
                    setIsOnline(status.connected);
                });
            } else {
                const handleOnline = () => setIsOnline(true);
                const handleOffline = () => setIsOnline(false);

                window.addEventListener('online', handleOnline);
                window.addEventListener('offline', handleOffline);

                return () => {
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                };
            }
        };

        setupListeners();

        return () => {
            if (listener) listener.remove();
        };
    }, []);

    return isOnline;
}
