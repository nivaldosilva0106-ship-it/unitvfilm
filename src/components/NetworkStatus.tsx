import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSlowConnection, setIsSlowConnection] = useState(false);

    useEffect(() => {
        // Handlers for online/offline
        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Conexão restabelecida!", {
                icon: <Wifi className="w-4 h-4" />,
                duration: 3000
            });
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.error("Você está offline. Verifique sua conexão.", {
                icon: <WifiOff className="w-4 h-4" />,
                duration: Infinity, // Persistent until online
                id: 'offline-toast' // Prevent duplicates
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Network Information API (Chrome/Edge/Opera only)
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

        const updateConnectionStatus = () => {
            if (connection) {
                const type = connection.effectiveType; // 'slow-2g', '2g', '3g', '4g'
                // Consider 2g and slow-2g as "slow"
                const isSlow = type === 'slow-2g' || type === '2g';
                setIsSlowConnection(isSlow);

                if (isSlow && isOnline) {
                    toast.warning("Sua conexão parece instável.", {
                        description: "A reprodução de vídeos pode ser afetada.",
                        icon: <AlertTriangle className="w-4 h-4" />,
                        duration: 6000,
                        id: 'slow-connection-toast'
                    });
                }
            }
        };

        if (connection) {
            updateConnectionStatus();
            connection.addEventListener('change', updateConnectionStatus);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (connection) {
                connection.removeEventListener('change', updateConnectionStatus);
            }
        };
    }, [isOnline]);

    if (!isOnline) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#E50914] text-white px-4 py-2 text-center shadow-lg animate-in slide-in-from-bottom flex justify-center items-center gap-2">
                <WifiOff className="w-4 h-4" />
                <span className="text-sm font-medium">Sem conexão com a internet. Alguns recursos podem não funcionar.</span>
            </div>
        );
    }

    if (isSlowConnection) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-yellow-500/90 text-black px-4 py-1.5 text-center backdrop-blur-sm animate-in slide-in-from-bottom flex justify-center items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-semibold">Conexão lenta detectada.</span>
            </div>
        );
    }

    return null;
};
