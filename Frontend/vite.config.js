import path from "path"
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Content Security Policy — tightened for production hardening (issue #1169)
// Supabase, Gemini API, and self-hosted assets are explicitly whitelisted.
// ---------------------------------------------------------------------------
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://generativelanguage.googleapis.com http://localhost:8000 http://localhost:3000 http://localhost:7860 ws://localhost:7860",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ")

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  optimizeDeps: {
    include: ["next-themes"],
  },

  build: {
    // Hidden sourcemaps: errors still trackable in Sentry/logging
    // but source code not exposed to end users in browser devtools
    sourcemap: 'hidden',

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
    // Security headers on Vite dev server
    headers: {
      "Content-Security-Policy":   CSP,
      "X-Content-Type-Options":    "nosniff",
      "X-Frame-Options":           "DENY",
      "X-XSS-Protection":          "1; mode=block",
      "Referrer-Policy":           "strict-origin-when-cross-origin",
      "Permissions-Policy":        "camera=(), microphone=(), geolocation=(), payment=()",
    },
  },

  preview: {
    // Same headers for `vite preview` (production-like local testing)
    // HSTS included since preview simulates production
    headers: {
      "Content-Security-Policy":       CSP,
      "X-Content-Type-Options":        "nosniff",
      "X-Frame-Options":               "DENY",
      "X-XSS-Protection":              "1; mode=block",
      "Referrer-Policy":               "strict-origin-when-cross-origin",
      "Permissions-Policy":            "camera=(), microphone=(), geolocation=(), payment=()",
      "Strict-Transport-Security":     "max-age=63072000; includeSubDomains; preload",
      "Cross-Origin-Opener-Policy":    "same-origin",
      "Cross-Origin-Resource-Policy":  "same-origin",
    },
  },
})
