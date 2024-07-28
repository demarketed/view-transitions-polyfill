import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import path from 'node:path';
import fromConfigTemplate from './vite.config.common';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(
  fromConfigTemplate(resolve(__dirname, 'src/always-polyfill.ts'), 'test/dist')
);
