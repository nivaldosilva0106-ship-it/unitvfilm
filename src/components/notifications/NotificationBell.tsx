import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDatabase, ref, onValue } from "firebase/database";
import { NotificationItem, GlobalNotification } from "@/lib/firebase";
import { NotificationDropdown } from "./NotificationDropdown";

export const NotificationBell = () => {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch Unread Count
    useEffect(() => {
        if (!user) return;
        const db = getDatabase();

        const pRef = ref(db, `notifications/${user.uid}`);
        const gRef = ref(db, `globalNotifications`);
        const rRef = ref(db, `profiles/${user.uid}/readGlobalNotifications`);

        const handles = {
            p: [] as NotificationItem[],
            g: [] as GlobalNotification[],
            r: {} as Record<string, boolean>
        };

        const calculate = () => {
            const pUnread = handles.p.filter(i => !i.isRead).length;
            const gUnread = handles.g.filter(i => !handles.r[i.id]).length;
            setUnreadCount(pUnread + gUnread);
        };

        const u1 = onValue(pRef, s => { handles.p = Object.values(s.val() || {}); calculate(); });
        const u2 = onValue(gRef, s => { handles.g = Object.values(s.val() || {}); calculate(); });
        const u3 = onValue(rRef, s => { handles.r = s.val() || {}; calculate(); });

        return () => { u1(); u2(); u3(); };
    }, [user]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors group notification-bell-trigger"
            >
                <Bell className={`w-5 h-5 transition-colors ${isOpen ? 'text-green-500 fill-green-500/20' : 'text-gray-300 group-hover:text-white'}`} />

                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-black">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && <NotificationDropdown onClose={() => setIsOpen(false)} />}
        </div>
    );
};
