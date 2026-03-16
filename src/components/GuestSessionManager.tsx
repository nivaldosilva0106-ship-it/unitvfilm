import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GUEST_TIME_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

export const GuestSessionManager = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        if (user && user.isAnonymous) {
            // Check session start time
            const storedStart = sessionStorage.getItem('guest_session_start');
            let startTime = storedStart ? parseInt(storedStart) : null;

            if (!startTime) {
                startTime = Date.now();
                sessionStorage.setItem('guest_session_start', startTime.toString());
            }

            // Update timer
            const interval = setInterval(() => {
                const elapsed = Date.now() - startTime!;
                const remaining = GUEST_TIME_LIMIT_MS - elapsed;

                if (remaining <= 0) {
                    handleSessionExpired();
                } else {
                    setTimeLeft(remaining);
                }
            }, 1000);

            return () => clearInterval(interval);
        } else {
            setTimeLeft(null);
        }
    }, [user]);

    const handleSessionExpired = async () => {
        sessionStorage.removeItem('guest_session_start');
        await logout();
        toast.error("Tempo de sessão expirado. Crie uma conta para continuar assistindo.");
        navigate('/signup');
    };

    if (!user?.isAnonymous || timeLeft === null) return null;

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    return (
        <div className="fixed bottom-4 left-4 z-50 bg-black/80 border border-yellow-500/50 rounded-lg p-3 shadow-lg backdrop-blur-sm flex items-center gap-3 animate-in slide-in-from-bottom-5">
            <div className="bg-yellow-500/10 p-2 rounded-full">
                <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
                <p className="text-sm font-medium text-white">Modo Convidado</p>
                <p className="text-xs text-yellow-400 font-mono">
                    {minutes}:{seconds.toString().padStart(2, '0')} restantes
                </p>
            </div>
            <div className="h-8 w-[1px] bg-white/10 mx-1" />
            <button
                onClick={() => navigate('/signup')}
                className="text-xs bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded transition-colors"
            >
                Criar Conta
            </button>
        </div>
    );
};
