import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({build:{rolldownOptions:{input:{lab:fileURLToPath(new URL('./index.html',import.meta.url)),performance:fileURLToPath(new URL('./performance.html',import.meta.url))}}}});
