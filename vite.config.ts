import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ruhe/',
  plugins: [
    svelte(),
    VitePWA({
      // Neue Versionen warten, bis die Person den Hinweis antippt: Eine laufende Sitzung
      // wird nie durch ein Neuladen unterbrochen. Registriert wird in src/lib/pwa/update.svelte.ts.
      registerType: 'prompt',
      injectRegister: false,
      // Die Icons liegen schon über globPatterns im Precache; sonst stünden sie doppelt darin.
      includeManifestIcons: false,
      manifest: {
        name: 'Ruhe',
        short_name: 'Ruhe',
        lang: 'de',
        start_url: '/ruhe/',
        scope: '/ruhe/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0B1026',
        background_color: '#0B1026',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-Hülle, Schriften, Icons, die gemalten Motive (WebP) und die Klangdateien samt Atemgeräusch
        // (Ogg): alles offline ab dem ersten Besuch. Die Musik (Opus) steht bewusst nicht darin.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,ogg}'],
        cleanupOutdatedCaches: true,
        // Die Meditationen (MP3) sind zu groß für den Precache und stehen bewusst nicht in
        // globPatterns. Gespeichert werden sie von src/lib/offline/meditations.ts im Cache
        // `ruhe-meditations`; von dort liefert der Service Worker mit Range-Unterstützung aus
        // (Spulen offline). Teilantworten (206) landen nie im Cache, nur vollständige 200er.
        runtimeCaching: [
          {
            // Mit optionaler Abfrage: Die App ruft die Dateien als `<id>.mp3?v=<Version>` ab (audioUrl in
            // src/lib/content/catalog.ts); Workbox prüft den Ausdruck gegen die ganze Adresse samt Abfrage.
            urlPattern: /\/audio\/meditations\/.+\.mp3(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ruhe-meditations',
              rangeRequests: true,
              // Nur echtes Audio: Sonst legte der Service Worker auch die Startseite ab, die ein Server
              // statt einer fehlenden Datei mit 200 ausliefert, und die Datei gälte als gespeichert.
              cacheableResponse: { statuses: [200], headers: { 'Content-Type': 'audio/mpeg' } },
            },
          },
          {
            // Die Musik (Opus, zusammen gut 20 MB) wie die Meditationen: gespeichert von
            // src/lib/offline/meditations.ts im Cache `ruhe-musik`, ausgeliefert mit Range-Unterstützung,
            // damit Schleife und Überblendung auch offline gehen. Adresse `<id>.opus?v=<Version>` (musicUrl).
            urlPattern: /\/audio\/music\/.+\.opus(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ruhe-musik',
              rangeRequests: true,
              cacheableResponse: { statuses: [200], headers: { 'Content-Type': 'audio/ogg' } },
            },
          },
        ],
      },
    }),
  ],
})
