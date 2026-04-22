import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TVSidebar } from "@/components/TVSidebar";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { Bell } from "lucide-react";

const Notifications = () => {
    const { user } = useAuth();

    useEffect(() => {
        document.title = "Notificações | UniTVFilm";
    }, []);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <TVSidebar />

            <main className="flex-1 lg:pl-14 pt-16 sm:pt-20 px-4 sm:px-6 lg:px-8 pb-10">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">Minhas Notificações</h1>
                            <p className="text-gray-400 text-sm mt-1">Fique por dentro das novidades e alertas da sua conta.</p>
                        </div>
                    </div>

                    <div className="bg-zinc-900/30 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
                        <NotificationDropdown onClose={() => {}} />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Notifications;
