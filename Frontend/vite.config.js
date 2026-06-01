import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Content Security Policy — tightened for production hardening (issue #637)
// Supabase, Gemini API, and self-hosted assets are explicitly whitelisted.
// ---------------------------------------------------------------------------
const CSP = [
  "default-src 'self'",
  // Scripts: allow self + Vite HMR websocket in dev
  "script-src 'self' 'unsafe-inline'",
  // Styles: allow self + inline styles required by Tailwind/shadcn
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Fonts
  "font-src 'self' https://fonts.gstatic.com data:",
  // Images: allow self, data URIs, and Supabase storage
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
  // Fetch/XHR: allow Supabase REST/Auth, Gemini API, and local backend
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://generativelanguage.googleapis.com http://localhost:8000 http://localhost:3000",
  // Workers
  "worker-src 'self' blob:",
  // Framing: prevent clickjacking
  "frame-ancestors 'none'",
  // No plugins
  "object-src 'none'",
  // Upgrade insecure requests in production
  "upgrade-insecure-requests",
].join("; ")

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'offline.html'],
      manifest: {
        name: 'HELPDESK.AI - AI-Powered Support Platform',
        short_name: 'HELPDESK.AI',
        description: 'AI-powered helpdesk and ticket management platform with intelligent routing and automated resolution.',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['productivity', 'business', 'utilities'],
        icons: [
          {
            src: '/favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Create Ticket',
            short_name: 'New Ticket',
            description: 'Submit a new support ticket',
            url: '/create-ticket',
            icons: [{ src: '/favicon.png', sizes: '96x96' }]
          },
          {
            name: 'My Tickets',
            short_name: 'Tickets',
            description: 'View your support tickets',
            url: '/my-tickets',
            icons: [{ src: '/favicon.png', sizes: '96x96' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api/, /^\/admin/, /^\/master-admin/]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ["next-themes"],
  },
  build: {
    sourcemap: true,
    // Split vendor chunks for better caching (pairs with lazy routing in issue #638)
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', '@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    // Inject security headers in dev server responses
    headers: {
      "Content-Security-Policy": CSP,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
  preview: {
    // Same headers for `vite preview` (production-like local testing)
    headers: {
      "Content-Security-Policy": CSP,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    },
  },
})
