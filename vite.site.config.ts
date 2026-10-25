import { defineConfig } from 'vite'

// Docs site. `BASE` sets the public path for deploys, e.g. BASE=/probable/.
export default defineConfig({
  root: 'site',
  base: process.env.BASE ?? '/',
  publicDir: false,
  server: { port: 5199, host: '127.0.0.1' },
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
    // compare.html / spark.html are fidelity-test harnesses, dev only.
    rollupOptions: { input: 'site/index.html' },
  },
})
