import { router } from '@inertiajs/react'
import { useEffect } from 'react'
import { resolveVisitPathname } from '@/lib/inertiaHistory'

export default function useResetPageHistoryOnLeave(onLeave) {
    useEffect(() => {
        if (typeof window === 'undefined' || typeof onLeave !== 'function') {
            return undefined
        }

        return router.on('before', (event) => {
            const nextPathname = resolveVisitPathname(event?.detail?.visit?.url)

            if (!nextPathname || nextPathname === window.location.pathname) {
                return
            }

            onLeave()
        })
    }, [onLeave])
}
