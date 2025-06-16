import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env.[mode] or .env
  // 'VITE_' prefix means only variables starting with VITE_ will be loaded by Vite.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react()],
    // Explicitly define environment variables to be accessible in the client-side code.
    // This is crucial for resolving the "import.meta is not available" warning by
    // replacing `import.meta.env.YOUR_VAR` with its actual string value during build.
    define: {
      'import.meta.env.VITE_TICKETMASTER_API_KEY': JSON.stringify(env.VITE_TICKETMASTER_API_KEY),
      'import.meta.env.VITE_OPENCAGE_API_KEY': JSON.stringify(env.VITE_OPENCAGE_API_KEY),
      'import.meta.env.VITE_YOUTUBE_API_KEY': JSON.stringify(env.VITE_YOUTUBE_API_KEY),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID),
      'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(env.VITE_FIREBASE_MEASUREMENT_ID),
      // It's good practice to also define NODE_ENV for consistent behavior
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      // Setting a modern target ensures that the bundled code supports 'import.meta'.
      // 'es2020' or 'esnext' is appropriate for modern browsers and build environments.
      target: 'es2020',
    },
  };
});
