import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env.[mode] or .env
  // 'VITE_' prefix means only variables starting with VITE_ will be loaded by Vite.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Create a separate object for Firebase config to be injected
  // This ensures the entire config object is stringified once and injected
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  return {
    plugins: [react()],
    define: {
      // Direct string replacement for non-Firebase API keys using import.meta.env
      // These should be correctly replaced with their string values during build
      'import.meta.env.VITE_TICKETMASTER_API_KEY': JSON.stringify(env.VITE_TICKETMASTER_API_KEY),
      'import.meta.env.VITE_OPENCAGE_API_KEY': JSON.stringify(env.VITE_OPENCAGE_API_KEY),
      'import.meta.env.VITE_YOUTUBE_API_KEY': JSON.stringify(env.VITE_YOUTUBE_API_KEY),

      // It's good practice to also define NODE_ENV for consistent behavior
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),

      // Directly inject the Firebase config object as a global JSON string.
      // This will replace __FIREBASE_CONFIG__ in the application code with
      // a fully formed JSON object, bypassing any potential issues with
      // import.meta.env for nested objects within firebaseConfig.
      '__FIREBASE_CONFIG__': JSON.stringify(firebaseConfig),
    },
    build: {
      // Setting a modern target ensures that the bundled code supports 'import.meta'.
      // 'es2020' or 'esnext' is appropriate for modern browsers and build environments.
      target: 'es2020',
    },
  };
});
