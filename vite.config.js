import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Explicitly set a modern target to ensure 'import.meta.env' is supported
    // and environment variables are correctly exposed to the client-side.
    target: 'es2020',
  },
});
