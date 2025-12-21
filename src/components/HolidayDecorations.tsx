import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/lib/firebase';

export const HolidayDecorations = () => {
    const [enabled, setEnabled] = useState(false);
    const [type, setType] = useState<'christmas' | 'newyear' | 'both'>('christmas');

    useEffect(() => {
        // Load settings from Firebase
        const loadSettings = async () => {
            try {
                const settings = await getSiteSettings();
                console.log('Holiday decorations settings loaded:', settings);
                setEnabled(settings.holidayDecorationsEnabled || false);
                setType(settings.holidayDecorationsType || 'christmas');
            } catch (error) {
                console.error('Error loading holiday decoration settings:', error);
            }
        };

        loadSettings();

        // Poll for settings changes every 5 seconds
        const interval = setInterval(loadSettings, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        console.log('Holiday decorations state:', { enabled, type });
    }, [enabled, type]);

    if (!enabled) {
        console.log('Holiday decorations are disabled');
        return null;
    }

    const showChristmas = type === 'christmas' || type === 'both';
    const showNewYear = type === 'newyear' || type === 'both';

    return (
        <div className="holiday-decorations">
            {/* Corner Decorations for Christmas */}
            {showChristmas && (
                <>
                    <div className="corner-decoration corner-top-left">
                        <span className="decoration-element">🎄</span>
                    </div>
                    <div className="corner-decoration corner-top-right">
                        <span className="decoration-element">🎅</span>
                    </div>
                </>
            )}

            {/* New Year Decorations */}
            {showNewYear && (
                <>
                    <div className="corner-decoration corner-bottom-left">
                        <span className="decoration-element">🎆</span>
                    </div>

                    {/* Animated 2026 in bottom right */}
                    <div className="new-year-2026">
                        <div className="year-container">
                            <span className="year-text">2026</span>
                            <div className="firework firework-1">✨</div>
                            <div className="firework firework-2">⭐</div>
                            <div className="firework firework-3">💫</div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
