import { defineConfig } from 'vite'

export default defineConfig({
    root: 'src',
    // relative paths so the build works from a github-pages sub folder
    base: './',
    cacheDir: '../node_modules/.vite',
    // the neural voices think in workers, which load their models in pieces
    worker: {
        format: 'es'
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true
    },
    test: {
        include: ['../tests/**/*.test.js']
    }
})
