import './bootstrap';
import '../css/app.css'
import '@/Components/components.css'
import '@/Components/ui-shell.css'
import GlobalErrorPopup from '@/Components/GlobalErrorPopup'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { registerOfflineServiceWorker } from '@/lib/offline/serviceWorker'

const CHUNK_RECOVERY_FLAG = 'nimvo:chunk-recovery'

function extractErrorMessage(input) {
  if (!input) {
    return ''
  }

  if (typeof input === 'string') {
    return input
  }

  if (typeof input?.message === 'string') {
    return input.message
  }

  if (typeof input?.reason?.message === 'string') {
    return input.reason.message
  }

  return String(input)
}

function isRecoverableChunkError(input) {
  const message = extractErrorMessage(input)

  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message)
}

async function clearOfflineRuntimeState() {
  if (typeof window === 'undefined') {
    return
  }

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    } catch {
      // Ignore cleanup failures and keep the recovery flow going.
    }
  }

  if ('caches' in window) {
    try {
      const cacheKeys = await window.caches.keys()
      await Promise.all(
        cacheKeys
          .filter((key) => key.startsWith('nimvo-offline-'))
          .map((key) => window.caches.delete(key)),
      )
    } catch {
      // Ignore cleanup failures and keep the recovery flow going.
    }
  }
}

async function recoverFromChunkError(error) {
  if (typeof window === 'undefined') {
    return
  }

  if (window.sessionStorage.getItem(CHUNK_RECOVERY_FLAG) === '1') {
    return
  }

  window.sessionStorage.setItem(CHUNK_RECOVERY_FLAG, '1')
  await clearOfflineRuntimeState()
  window.location.reload()
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault?.()
  void recoverFromChunkError(event?.payload || event)
})

window.addEventListener('error', (event) => {
  if (!isRecoverableChunkError(event?.error || event?.message)) {
    return
  }

  event.preventDefault?.()
  void recoverFromChunkError(event?.error || event?.message)
})

window.addEventListener('unhandledrejection', (event) => {
  if (!isRecoverableChunkError(event?.reason)) {
    return
  }

  event.preventDefault?.()
  void recoverFromChunkError(event.reason)
})

registerOfflineServiceWorker()

createInertiaApp({
  resolve: name => resolvePageComponent(
    `./Pages/${name}.jsx`,
    import.meta.glob('./Pages/**/*.jsx')
  ),
  setup({ el, App, props }) {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_FLAG)
    createRoot(el).render(
      <>
        <App {...props} />
        <GlobalErrorPopup />
      </>
    )
  },
})
