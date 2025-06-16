import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env.[mode] or .env
  // 'VITE_' prefix means only variables starting with VITE_ will be loaded by Vite.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Consolidate all VITE_ prefixed environment variables into a single object
  const appEnvVars = Object.keys(env)
    .filter(key => key.startsWith('VITE_'))
    .reduce((acc, key) => {
      acc[key] = env[key];
      return acc;
    }, {});

  // Create a separate object for Firebase config to be injected (still using VITE_ prefix for env access)
  const firebaseConfig = {
    apiKey: appEnvVars.VITE_FIREBASE_API_KEY,
    authDomain: appEnvVars.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: appEnvVars.VITE_FIREBASE_PROJECT_ID,
    storageBucket: appEnvVars.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: appEnvVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: appEnvVars.VITE_FIREBASE_APP_ID,
    measurementId: appEnvVars.VITE_FIREBASE_MEASUREMENT_ID,
  };

  return {
    plugins: [react()],
    define: {
      // Inject all VITE_ prefixed environment variables as a global object
      '__APP_ENV__': JSON.stringify(appEnvVars),
      // Inject the Firebase config object as a global JSON string.
      '__FIREBASE_CONFIG__': JSON.stringify(firebaseConfig),
      // It's good practice to also define NODE_ENV for consistent behavior
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      // Setting a modern target ensures that the bundled code supports 'import.meta'
      // if it were used, but with the new define approach, it won't be in the final code.
      target: 'es2020',
    },
  };
});
