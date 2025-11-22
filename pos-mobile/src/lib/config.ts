/**
 * Application configuration
 * Environment variables are available via process.env.EXPO_PUBLIC_*
 */

// Helper to get local IP address for development
const getLocalIP = (): string => {
  // This will be set via environment variable or manually
  // For physical devices, you need to use your computer's IP address
  // e.g., http://192.168.1.xxx:4000
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
};

export const config = {
  apiUrl: getLocalIP(),
} as const;

// Log API URL in development
if (__DEV__) {
  console.log('[Config] API URL:', config.apiUrl);
  console.log('[Config] Make sure this is accessible from your device!');
  if (config.apiUrl.includes('localhost')) {
    console.warn('[Config] ⚠️  localhost will NOT work on physical devices!');
    console.warn('[Config] Use your computer\'s IP address instead (e.g., http://192.168.1.xxx:4000)');
  }
}

