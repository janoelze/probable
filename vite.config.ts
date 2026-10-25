import { defineConfig } from 'vite'

// Library build: ESM bundles for the core and the React wrapper. d3 is bundled
// (tree-shaken) so the package works from a plain <script type="module">.
export default defineConfig({
  build: {
    lib: {
      entry: { probable: 'src/index.ts', react: 'src/react.ts' },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      // Code shared by both entries (charts + d3) lands in one stable file.
      output: { chunkFileNames: 'probable-core.js' },
    },
    sourcemap: true,
  },
})
