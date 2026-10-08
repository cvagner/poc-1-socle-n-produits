import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Mode développement : cache hors des sources montées en lecture seule
  // (VITE_CACHE_DIR, cf. socle/compose-dev.yaml) ; valeur par défaut sinon.
  cacheDir: process.env.VITE_CACHE_DIR,
});
