import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Avoid exposing entire process.env to client; use import.meta.env.VITE_*
});
