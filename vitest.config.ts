import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      {
        // Kein SPA-Fallback: Fehlende Dateien (z. B. Klangdateien) sollen 404 liefern,
        // statt index.html auszuliefern und damit die App zu kompilieren.
        appType: 'custom',
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
