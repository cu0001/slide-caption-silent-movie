import {defineConfig} from 'vite';
export default defineConfig({
 cacheDir:'node_modules/.vite-tests',
 // Tests import PDF tools dynamically. Pre-bundle them before navigation to avoid mid-test reloads.
 optimizeDeps:{include:['pdfjs-dist','pdf-lib','mediabunny']},
});
