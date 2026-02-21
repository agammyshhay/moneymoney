/* eslint-env node */

import react from '@vitejs/plugin-react';
import { join } from 'node:path';
import { renderer } from 'unplugin-auto-expose';
import { chrome } from '../../.electron-vendors.cache.json';

const PACKAGE_ROOT = __dirname;
const PROJECT_ROOT = join(PACKAGE_ROOT, '../..');

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PROJECT_ROOT,
  resolve: {
    alias: {
      '/@/': join(PACKAGE_ROOT, 'src') + '/',
      events: 'events',
    },
  },
  base: '',
  server: {
    fs: {
      strict: true,
    },
  },
  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    rollupOptions: {
      input: join(PACKAGE_ROOT, 'index.html'),
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  test: {
    environment: 'happy-dom',
  },
  plugins: [
    react(),
    renderer.vite({
      preloadEntry: join(PACKAGE_ROOT, '../preload/src/index.ts'),
    }),
    {
      name: 'html-transform',
      enforce: 'post',
      generateBundle(options, bundle) {
        const htmlChunk = bundle['index.html'];
        if (htmlChunk && htmlChunk.type === 'asset' && typeof htmlChunk.source === 'string') {
          htmlChunk.source = htmlChunk.source
            .replace('href="./bootstrap.rtl.min.css"', 'href="bootstrap.rtl.min.css"')
            .replace('href="./bootstrap-icons.min.css"', 'href="bootstrap-icons.min.css"')
            .replace('href="./fonts/outfit.css"', 'href="fonts/outfit.css"')
            .replace(/src="\.\//g, 'src="')
            .replace(/href="\.\//g, 'href="');
        }
      }
    }
  ],
};

export default config;
