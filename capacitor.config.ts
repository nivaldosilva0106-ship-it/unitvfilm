import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.unitvfilm.app',
    appName: 'UniTVFilm',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: "#0a0a0a",
            androidSplashResourceName: "splash",
            androidScaleType: "CENTER_CROP",
            showSpinner: true,
            androidSpinnerStyle: "large",
            spinnerColor: "#10b981"
        }
    }
};

export default config;
