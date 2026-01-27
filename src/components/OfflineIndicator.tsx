import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
    const isOnline = useOnlineStatus();

    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>Você está offline. Navegue pelo conteúdo já carregado.</span>
        </div>
    );
}
