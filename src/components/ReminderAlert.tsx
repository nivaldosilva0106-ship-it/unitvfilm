import { useReminders } from "@/hooks/useReminders";
import { Bell, PlayCircle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export function ReminderAlert() {
    const { activeReminder, dismissActiveReminder } = useReminders();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (activeReminder) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [activeReminder]);

    if (!activeReminder || !isVisible) return null;

    return (
        <div className="fixed top-20 left-0 right-0 z-[100] px-4 animate-in slide-in-from-top-10 fade-in duration-500 flex justify-center pointer-events-none">
            <div className="bg-zinc-900 border border-primary/30 shadow-2xl shadow-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-2xl w-full pointer-events-auto">
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-primary animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">
                            O teu programa começou!
                        </h4>
                        <p className="text-xs sm:text-sm text-zinc-300 mt-0.5">
                            <span className="text-white font-bold">{activeReminder.programTitle}</span> no canal <span className="text-white font-bold">{activeReminder.channelTitle}</span> já está a dar.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Link 
                        to={`/canais24h?channelId=${activeReminder.channelId}`}
                        onClick={dismissActiveReminder}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                    >
                        <PlayCircle className="w-4 h-4" />
                        Assistir
                    </Link>
                    <button 
                        onClick={dismissActiveReminder}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-colors shrink-0"
                        title="Fechar alerta"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
