import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, Wifi, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OfflineIndicator() {
    const isOnline = useOnlineStatus();
    const [show, setShow] = useState(false);
    const [statusText, setStatusText] = useState('');

    useEffect(() => {
        if (!isOnline) {
            setShow(true);
            setStatusText('Sem conexão à Internet');
        } else {
            if (show) {
                setStatusText('Conexão Restaurada');
                const t = setTimeout(() => setShow(false), 4000);
                return () => clearTimeout(t);
            }
        }
    }, [isOnline, show]);

    if (!show) return null;

    return (
        <div className="fixed top-2 sm:top-6 left-1/2 -translate-x-1/2 z-[10000] w-[90%] max-w-md animate-in slide-in-from-top duration-500">
            <div className={`
                flex items-center gap-3 py-3 px-5 rounded-2xl shadow-2xl backdrop-blur-md border 
                transition-all duration-500
                ${isOnline 
                    ? 'bg-emerald-500/90 border-emerald-400/30 text-white' 
                    : 'bg-red-500/90 border-red-400/30 text-white'
                }
            `}>
                <div className="flex-shrink-0">
                    {isOnline ? (
                        <CheckCircle2 className="h-5 w-5 animate-bounce-short" />
                    ) : (
                        <AlertTriangle className="h-5 w-5 animate-pulse" />
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-tight">
                        {statusText}
                    </span>
                    {!isOnline && (
                        <span className="text-[10px] opacity-80 uppercase tracking-widest font-medium">
                            Verifique sua rede
                        </span>
                    )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full animate-pulse ${isOnline ? 'bg-emerald-200' : 'bg-red-200'}`} />
                    {isOnline ? <Wifi className="h-4 w-4 opacity-70" /> : <WifiOff className="h-4 w-4 opacity-70" />}
                </div>
            </div>
        </div>
    );
}
