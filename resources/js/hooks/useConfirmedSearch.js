import { useCallback, useEffect, useState } from 'react'

function normalizeValue(value) {
    return value == null || String(value).toLowerCase() === 'null'
        ? ''
        : String(value)
}

export default function useConfirmedSearch(initialValue = '') {
    const [draftValue, setDraftValue] = useState(() => normalizeValue(initialValue))
    const [value, setValue] = useState(() => normalizeValue(initialValue))

    useEffect(() => {
        const nextValue = normalizeValue(initialValue)
        setDraftValue(nextValue)
        setValue(nextValue)
    }, [initialValue])

    const apply = useCallback((nextValue) => {
        const resolvedValue = normalizeValue(nextValue ?? draftValue)
        setDraftValue(resolvedValue)
        setValue(resolvedValue)

        return resolvedValue
    }, [draftValue])

    const clear = useCallback(() => {
        setDraftValue('')
        setValue('')
    }, [])

    const sync = useCallback((nextValue) => {
        const resolvedValue = normalizeValue(nextValue)
        setDraftValue(resolvedValue)
        setValue(resolvedValue)

        return resolvedValue
    }, [])

    return {
        draftValue,
        value,
        setDraftValue,
        apply,
        clear,
        sync,
        hasPendingChanges: draftValue !== value,
    }
}
