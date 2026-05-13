import { useState, useEffect } from 'react';

export interface Reminder {
    id: string; // unique id e.g. `${channelId}-${programTitle}`
    channelId: string;
    channelTitle: string;
    programTitle: string;
    startTime: number;
    endTime: number;
}

const STORAGE_KEY = 'unitv_reminders';

export function useReminders() {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
    const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

    // Load from local storage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                // Filter out reminders that have already ended
                const parsed = JSON.parse(stored) as Reminder[];
                const now = Date.now();
                const validReminders = parsed.filter(r => now < r.endTime);
                setReminders(validReminders);
                
                // Update local storage if we cleaned up expired ones
                if (validReminders.length !== parsed.length) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(validReminders));
                }
            } catch (e) {
                console.error("Failed to parse reminders", e);
            }
        }
    }, []);

    // Check for active reminders every 5 seconds, pulling fresh from localStorage
    useEffect(() => {
        const interval = setInterval(() => {
            const stored = localStorage.getItem(STORAGE_KEY);
            let currentReminders: Reminder[] = [];
            
            if (stored) {
                try {
                    currentReminders = JSON.parse(stored) as Reminder[];
                } catch (e) {}
            }

            if (currentReminders.length === 0) {
                setActiveReminder(null);
                setReminders([]);
                return;
            }

            const now = Date.now();
            let hasChanges = false;
            let currentActive: Reminder | null = null;
            const validReminders: Reminder[] = [];

            for (const r of currentReminders) {
                // If it has ended, we discard it
                if (now >= r.endTime) {
                    hasChanges = true;
                    continue;
                }
                validReminders.push(r);

                // If it's playing right now
                if (now >= r.startTime && now < r.endTime) {
                    // we pick the first one that is active
                    if (!currentActive) currentActive = r;
                }
            }

            if (hasChanges) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(validReminders));
            }
            
            // Sync local state with storage
            setReminders(validReminders);

            // Only trigger state update if active reminder actually changed
            setActiveReminder(prev => (prev?.id === currentActive?.id ? prev : currentActive));
        }, 3000); // Check every 3 seconds for better responsiveness

        return () => clearInterval(interval);
    }, []);

    const addReminder = (reminder: Reminder) => {
        const stored = localStorage.getItem(STORAGE_KEY);
        let currentReminders: Reminder[] = [];
        if (stored) {
            try { currentReminders = JSON.parse(stored) as Reminder[]; } catch (e) {}
        }
        const next = [...currentReminders.filter(r => r.id !== reminder.id), reminder];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setReminders(next);
        
        // Try to request notification permission
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    };

    const removeReminder = (id: string) => {
        const stored = localStorage.getItem(STORAGE_KEY);
        let currentReminders: Reminder[] = [];
        if (stored) {
            try { currentReminders = JSON.parse(stored) as Reminder[]; } catch (e) {}
        }
        const next = currentReminders.filter(r => r.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setReminders(next);
    };

    const dismissActiveReminder = () => {
        if (activeReminder) {
            removeReminder(activeReminder.id);
            setActiveReminder(null);
        }
    };

    // Trigger native notification when active reminder changes
    useEffect(() => {
        if (activeReminder && !notifiedIds.has(activeReminder.id)) {
            setNotifiedIds(prev => new Set(prev).add(activeReminder.id));
            
            // Try to send native push notification
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification("O teu programa começou!", {
                        body: `${activeReminder.programTitle} no canal ${activeReminder.channelTitle} já está a dar.`,
                        icon: "/favicon.ico"
                    });
                } catch (e) {}
            }
        }
    }, [activeReminder, notifiedIds]);

    const isReminded = (id: string) => {
        return reminders.some(r => r.id === id);
    };

    return {
        reminders,
        activeReminder,
        addReminder,
        removeReminder,
        dismissActiveReminder,
        isReminded
    };
}
