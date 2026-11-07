import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// Deployment settings remain an explicit release decision. Local default is '/'.
export default defineConfig({
  output: 'static',
  base: process.env.SITE_BASE || '/',
  // The optional development toolbar reads localStorage without a fallback.
  // Keep storage-denied behavior usable and error-free during local acceptance.
  devToolbar: { enabled: false },
  integrations: [react(), mdx(), {
    name: 'isolated-command-cache',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        // `astro check` runs sync in production mode. Never let it replace
        // optimized React dependencies used by a running development server.
        updateConfig({ vite: { cacheDir: `node_modules/.vite-${command}` } });
      },
    },
  }],
});
