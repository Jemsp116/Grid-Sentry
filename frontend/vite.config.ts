import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Serves on port 3000 (per the architecture spec) and binds 0.0.0.0 so it's
// reachable from outside the Docker container.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
