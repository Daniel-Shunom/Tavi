import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'reload-character-runtime',
      hotUpdate({ file }) {
        const path = file.replace(/\\/g, '/');
        // A live Rive instance retains its asset bytes and rig closure. React
        // refresh preserves the Avatar effect when characterId has not changed.
        // Reload both Studio and overlay so neither keeps a previous foundation.
        if (
          this.environment.name === 'client' &&
          /\/src\/renderer\/(characters|motion|rive)\//.test(path)
        ) {
          this.environment.hot.send({ type: 'full-reload' });
          return [];
        }
        return undefined;
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    // Tool worktrees, generated builds and the desktop shell hold hundreds of thousands of
    // files that are not part of the web app. Watching them stalls the dev server for minutes.
    watch: {
      ignored: [
        '**/.claude/**',
        '**/.codex/**',
        '**/.tmp/**',
        '**/.data/**',
        '**/build/**',
        '**/desktop/**',
      ],
    },
    proxy: { '/api': 'http://127.0.0.1:4318', '/ws': { target: 'ws://127.0.0.1:4318', ws: true } },
  },
});
