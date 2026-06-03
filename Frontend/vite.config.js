import path from "path"
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Content Security Policy — tightened for production hardening (issue #1169)
// Supabase, Gemini API, and self-hosted assets are explicitly whitelisted.
// Matches the meta‑tag CSP in index.html to avoid conflicts.
// For dev, 'unsafe-inline' and localhost origins are needed for HMR.
// ---------------------------------------------------------------------------
const isDev = process.env.NODE_ENV !== "production"
const DEV_CONNECT_SRC = " http://localhost:8000 http://localhost:3000 http://localhost:7860 ws://localhost:7860 ws://localhost:8000"
const DEV_SCRIPT_SRC = " 'unsafe-eval'"  // Vite HMR requires eval in dev

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? DEV_SCRIPT_SRC : ""} https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
  `connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://generativelanguage.googleapis.com https://helpdeskaiv1.vercel.app https://ritesh19180-ai-helpdesk-api.hf.space${isDev ? DEV_CONNECT_SRC : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ")

// Security headers common to both dev server and production preview
const SHARED_SECURITY_HEADERS = {
  "Content-Security-Policy":       CSP,
  "X-Content-Type-Options":        "nosniff",
  "X-Frame-Options":               "DENY",
  "X-XSS-Protection":              "1; mode=block",
  "Referrer-Policy":               "strict-origin-when-cross-origin",
  "Permissions-Policy":            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
}

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
    sourcemap: 'hidden',

    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', '@supabase/supabase-js'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 500,
  },

  server: {
    headers: {
      ...SHARED_SECURITY_HEADERS,
      "Cross-Origin-Opener-Policy":    "same-origin",
      "Cross-Origin-Resource-Policy":  "same-origin",
    },
  },

  preview: {
    headers: {
      ...SHARED_SECURITY_HEADERS,
      "Strict-Transport-Security":     "max-age=63072000; includeSubDomains; preload",
      "Cross-Origin-Opener-Policy":    "same-origin",
      "Cross-Origin-Embedder-Policy":  "require-corp",
      "Cross-Origin-Resource-Policy":  "same-origin",
    },
  },
})
