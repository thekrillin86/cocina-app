import { defineConfig } from 'vitest/config'

// Config propia (sin los plugins de Vite) para que los tests de las
// librerías puras corran en Node, sin service worker ni JSX.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
