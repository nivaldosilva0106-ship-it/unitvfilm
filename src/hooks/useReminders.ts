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

    // Check for active reminders every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (reminders.length === 0) {
                setActiveReminder(null);
                return;
            }

            const now = Date.now();
            let hasChanges = false;
            let currentActive: Reminder | null = null;
            const validReminders: Reminder[] = [];

            for (const r of reminders) {
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
                setReminders(validReminders);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(validReminders));
            }

            // Only trigger state update if active reminder actually changed
            setActiveReminder(prev => (prev?.id === currentActive?.id ? prev : currentActive));
        }, 5000);

        return () => clearInterval(interval);
    }, [reminders]);

    const addReminder = (reminder: Reminder) => {
        setReminders(prev => {
            // Remove existing with same id if any, then add new
            const next = [...prev.filter(r => r.id !== reminder.id), reminder];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const removeReminder = (id: string) => {
        setReminders(prev => {
            const next = prev.filter(r => r.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const dismissActiveReminder = () => {
        if (activeReminder) {
            removeReminder(activeReminder.id);
            setActiveReminder(null);
        }
    };

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
