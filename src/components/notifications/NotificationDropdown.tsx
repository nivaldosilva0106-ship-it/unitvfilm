import { useEffect, useState, useRef } from "react";
import {
    NotificationItem,
    GlobalNotification,
    markNotificationRead,
    markAllPrivateNotificationsRead,
    clearAllNotifications
} from "@/lib/firebase";
import { NotificationItem as ItemComponent } from "./NotificationItem";
import { getDatabase, ref, onValue, off, get } from "firebase/database";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, BellOff, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export const NotificationDropdown = ({ onClose }: { onClose: () => void }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<(NotificationItem | GlobalNotification)[]>([]);
    const [readGlobals, setReadGlobals] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const db = getDatabase();

        // Listen for Private
        const privateRef = ref(db, `notifications/${user.uid}`);
        const globalRef = ref(db, `globalNotifications`);
        const readGlobalsRef = ref(db, `profiles/${user.uid}/readGlobalNotifications`);

        const handleData = async () => {
            // We can listen to all 3, but managing 3 listeners and merging state is messy.
            // We'll use onValue for private and readGlobals.
            // For globals, we might also use onValue.
        };

        const unsubPrivate = onValue(privateRef, (snap) => {
            const privateData = snap.val() || {};
            const pList = Object.values(privateData) as NotificationItem[];

            // Fetch Globals (snapshot) - optimizing to not listen to ALL globals if list is huge, 
            // but for now we listen to last 50?
            // Simplification: Listen to all globals.
            get(globalRef).then(gSnap => {
                const globalData = gSnap.val() || {};
                const gList = Object.values(globalData) as GlobalNotification[];

                // Fetch Read Status
                get(readGlobalsRef).then(rSnap => {
                    const rData = rSnap.val() || {};
                    setReadGlobals(rData);

                    // Merge
                    const merged = [...pList, ...gList];
                    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setNotifications(merged);
                    setLoading(false);
                });
            });
        });

        // Better: Listen to READ status in realtime too? 
        // We'll stick to a simpler approach: Fetch ONCE on mount, then listen for private updates.
        // If critical to listen to global updates, we can add listener.
        // Let's add listener for globals too.

        const unsubGlobals = onValue(globalRef, (snap) => {
            // ... Logic duplicated. 
            // Ideally we store lists in state variables and merge in useEffect [pList, gList].
        });

        return () => {
            off(privateRef);
            off(globalRef); // If we used it
            // off(readGlobalsRef);
            unsubPrivate();
            unsubGlobals();
        };

    }, [user]);

    // Refined Implementation using multiple states
    const [pList, setPList] = useState<NotificationItem[]>([]);
    const [gList, setGList] = useState<GlobalNotification[]>([]);
    // readGlobals already state.

    useEffect(() => {
        if (!user) return;
        const db = getDatabase();

        const unsubP = onValue(ref(db, `notifications/${user.uid}`), (s) =>
            setPList(Object.values(s.val() || {}) as NotificationItem[])
        );
        const unsubG = onValue(ref(db, `globalNotifications`), (s) =>
            setGList(Object.values(s.val() || {}) as GlobalNotification[])
        );
        const unsubR = onValue(ref(db, `profiles/${user.uid}/readGlobalNotifications`), (s) =>
            setReadGlobals(s.val() || {})
        );

        return () => { unsubP(); unsubG(); unsubR(); };
    }, [user]);

    const mergedNotifications = [...pList, ...gList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const isItemRead = (item: NotificationItem | GlobalNotification) => {
        if ('userId' in item) return (item as NotificationItem).isRead || false;
        return readGlobals[item.id] || false;
    };

    const handleMarkAllRead = async () => {
        if (!user) return;
        // Mark private
        await markAllPrivateNotificationsRead(user.uid);
        // Mark globals (save IDs to readGlobalNotifications)
        // Only unread globals
        const unreadGlobals = gList.filter(g => !readGlobals[g.id]);
        const updates: any = {};
        unreadGlobals.forEach(g => {
            updates[`profiles/${user.uid}/readGlobalNotifications/${g.id}`] = true;
        });
        if (Object.keys(updates).length > 0) {
            const db = getDatabase();
            // We need 'update' on root? No, updates keys are path relative?
            // update(ref(db), updates); // Root update
            // Wait, we can loop set.
            unreadGlobals.forEach(g => {
                markNotificationRead(user.uid, g.id, true);
            });
        }
    };

    return (
        <div className="absolute top-12 right-0 w-80 md:w-96 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900/50 backdrop-blur-md">
                <h3 className="font-bold text-white">Notificações</h3>
                {mergedNotifications.length > 0 && (
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllRead}
                            className="text-xs h-7 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                        >
                            <Check className="w-3 h-3 mr-1" /> Marcar lidas
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                                if (!user) return;
                                await clearAllNotifications(user.uid);
                            }}
                            className="text-xs h-7 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                            <Trash2 className="w-3 h-3 mr-1" /> Limpar
                        </Button>
                    </div>
                )}
            </div>

            <ScrollArea className="h-[400px]">
                {mergedNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-gray-500 gap-3">
                        <BellOff className="w-10 h-10 opacity-20" />
                        <p className="text-sm">Nenhuma notificação</p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {mergedNotifications.map(item => (
                            <ItemComponent
                                key={item.id}
                                notification={item}
                                isRead={isItemRead(item)}
                                onClick={() => {
                                    if (!user) return;
                                    if (!isItemRead(item)) {
                                        markNotificationRead(user.uid, item.id, !('userId' in item));
                                    }
                                    onClose();
                                }}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
