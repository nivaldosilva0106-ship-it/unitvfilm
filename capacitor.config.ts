import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.unitvfilm.app',
    appName: 'UniTVFilm',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
        allowNavigation: ["*"]
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 0,
            launchAutoHide: true
        },
        CapacitorHttp: {
            enabled: true
        }
    }
};

export default config;
