import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, ShieldAlert, Film } from 'lucide-react';
import { Button } from './ui/button';

export function OfflineIndicator() {
    const isOnline = useOnlineStatus();

    if (isOnline) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
            {/* Logo Icon */}
            <div className="mb-6 rounded-xl bg-emerald-600 p-4 shadow-lg shadow-emerald-600/20">
              <Film className="h-10 w-10 text-white" />
            </div>

            {/* Brand Name */}
            <h1 className="mb-8 text-3xl font-bold tracking-tight">
              <span className="text-white">Uni</span>
              <span className="text-emerald-500">Tv</span>
              <span className="text-white">Film</span>
            </h1>

            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 mb-6">
                <WifiOff className="h-12 w-12 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">Sem Conexão</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-8">
                O UniTvFilm requer uma conexão com a internet para carregar os conteúdos. Por favor, verifique seu Wi-Fi ou dados móveis e tente novamente.
            </p>
            
            <Button 
                onClick={() => window.location.reload()} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 rounded-xl font-medium text-lg w-full max-w-xs transition-all shadow-lg shadow-emerald-600/20"
            >
                Tentar Novamente
            </Button>
        </div>
    );
}
