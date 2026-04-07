import { useEffect, useState } from 'react'
import { getOfflineWorkspaceSummary, subscribeOfflineWorkspace } from './workspace'

export default function useOfflineStatus(tenantId) {
    const [summary, setSummary] = useState(() => getOfflineWorkspaceSummary(tenantId))

    useEffect(() => {
        setSummary(getOfflineWorkspaceSummary(tenantId))

        if (!tenantId) {
            return undefined
        }

        return subscribeOfflineWorkspace(tenantId, ({ summary: nextSummary }) => {
            setSummary(nextSummary)
        })
    }, [tenantId])

    return summary
}
