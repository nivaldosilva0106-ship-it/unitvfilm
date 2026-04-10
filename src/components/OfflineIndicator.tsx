import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OfflineIndicator() {
    const isOnline = useOnlineStatus();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (!isOnline) {
            setShow(true);
        } else {
            // Hide after a brief moment when coming back online
            if (show) {
                const t = setTimeout(() => setShow(false), 3000);
                return () => clearTimeout(t);
            }
        }
    }, [isOnline]);

    if (!show) return null;

    return (
        <div 
            className={`fixed top-0 left-0 right-0 z-[10000] flex items-center justify-center gap-2 py-2 px-4 shadow-md transition-colors duration-500 ${
                isOnline ? 'bg-emerald-600' : 'bg-red-600'
            }`}
        >
            {isOnline ? (
                <Wifi className="h-4 w-4 text-white" />
            ) : (
                <WifiOff className="h-4 w-4 text-red-100" />
            )}
            <span className="text-sm font-medium text-white">
                {isOnline ? 'Conexão Restaurada' : 'Sem conexão à Internet'}
            </span>
        </div>
    );
}
