import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import path from 'node:path';
import fromConfigTemplate from './vite.config.common';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build a version of the polyfill that preserves
//  the exports for the polyfill switch in the demos.

export default defineConfig(
  fromConfigTemplate(
    resolve(__dirname, 'src/polyfill-functions.ts'),
    'demos/dist'
  )
);
