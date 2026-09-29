import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Preact no lugar do React: mesma API (via preact/compat), ~60 KB a menos no navegador.
export default defineConfig({
  plugins: [preact()],
  build: { assetsDir: '_app', assetsInlineLimit: 0 },
});
