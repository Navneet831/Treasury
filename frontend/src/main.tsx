import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// ── Sentry (error monitoring) ──────────────────────────────────────────────────
// Set VITE_SENTRY_DSN in .env to enable. Without a DSN, everything is a no-op
// and the Sentry SDK is NOT bundled (dynamic import).
if (import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
      ],
      tracesSampleRate: 0.2,        // 20% of transactions for perf insights
      replaysSessionSampleRate: 0.1, // 10% of sessions with full replay
      replaysOnErrorSampleRate: 1.0, // 100% of error sessions
    })
  })
}

// ── Web Vitals (performance metrics) ───────────────────────────────────────────
// Reports Core Web Vitals to the browser console + Performance API timeline.
// Picked up by RUM tools and visible in Chrome DevTools.
function reportWebVitals(metric: any) {
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value}ms (rating: ${metric.rating})`)
  }
}

import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
  onCLS(reportWebVitals)
  onFCP(reportWebVitals)
  onINP(reportWebVitals)
  onLCP(reportWebVitals)
  onTTFB(reportWebVitals)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
