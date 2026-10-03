import type { ExpoConfig } from 'expo/config';

// Read at config time only (not EXPO_PUBLIC_), so it never reaches the JS bundle.
const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

if (!androidMapsKey) {
  console.warn(
    'GOOGLE_MAPS_ANDROID_API_KEY is not set: the Android map will be blank until it is added to .env.',
  );
}

// Config time only (not EXPO_PUBLIC_). It ends up in `extra` on purpose: it is sent in the
// Nominatim User-Agent so OSM can contact us (public by nature).
const nominatimContactEmail = process.env.NOMINATIM_CONTACT_EMAIL?.trim();

if (!nominatimContactEmail) {
  console.warn(
    'NOMINATIM_CONTACT_EMAIL is not set: Nominatim requests will be sent without a contact in the User-Agent.',
  );
}

const config: ExpoConfig = {
  name: 'onMyWay',
  slug: 'onMyWay',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'onmyway',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.quanh.onmyway',
    icon: './assets/expo.icon',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Keep AsyncStorage (trip drafts) out of Android Auto Backup / device transfer.
    // The session is in SecureStore and all real data lives in Supabase.
    allowBackup: false,
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    package: 'com.quanh.onmyway',
    // Single mechanism for the Google Maps key (Expo's built-in android.config.googleMaps).
    // Omitted when missing; it is stripped from the published manifest.
    ...(androidMapsKey ? { config: { googleMaps: { apiKey: androidMapsKey } } } : {}),
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    ['expo-secure-store', { faceIDPermission: false }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'onMyWay uses your location to center the map and help you pick the places you add as stops on your trip.',
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'onMyWay needs access to your photos so you can add pictures to your trip stops and your profile avatar.',
        cameraPermission:
          'onMyWay uses the camera so you can take photos for your trip stops and your profile avatar.',
        microphonePermission: false,
      },
    ],
  ],
  extra: {
    ...(nominatimContactEmail ? { nominatimContactEmail } : {}),
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
