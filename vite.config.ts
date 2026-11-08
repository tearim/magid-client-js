import { defineConfig } from 'vitest/config'

// `vite build` builds the full app (dist/). `vite build --mode embed` builds the embeddable Magid as one ES module
// (dist-embed/magid-embed.js; its CSS is inlined and injected by mountMagid).
export default defineConfig(({ mode }) => ({
  ...(mode === 'embed' && {
    build: {
      outDir: 'dist-embed',
      emptyOutDir: true,
      lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'magid-embed.js' },
    },
  }),
  test: {
    environment: 'jsdom',
  },
}))
