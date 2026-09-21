import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // En GitHub Pages la app vive en /boda-robinson-angela/ (lo define el workflow con BASE_PATH)
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // Puerto fijo para desarrollo local (también está en las Redirect URLs de Supabase)
  server: { port: 5188, strictPort: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 60_000,
  },
})
