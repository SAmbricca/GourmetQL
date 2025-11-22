import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gourmetql.parrillita',
  appName: 'GourmetQL',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'https://fclqqmakxgmluwulilea.supabase.co'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: false,
      backgroundColor: '#8d008dff',
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
