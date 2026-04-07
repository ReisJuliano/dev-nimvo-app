import './bootstrap';
import '../css/app.css'
import '@/Components/components.css'
import '@/Components/ui-shell.css'
import GlobalErrorPopup from '@/Components/GlobalErrorPopup'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { registerOfflineServiceWorker } from '@/lib/offline/serviceWorker'

registerOfflineServiceWorker()

createInertiaApp({
  resolve: name => resolvePageComponent(
    `./Pages/${name}.jsx`,
    import.meta.glob('./Pages/**/*.jsx')
  ),
  setup({ el, App, props }) {
    createRoot(el).render(
      <>
        <App {...props} />
        <GlobalErrorPopup />
      </>
    )
  },
})
