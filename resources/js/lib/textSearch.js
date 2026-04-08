function normalizeSearchTerm(term) {
    return String(term ?? '').trim().toLowerCase()
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasTextSearchTerm(term) {
    return normalizeSearchTerm(term) !== ''
}

export function hasTextSearchWildcard(term) {
    return normalizeSearchTerm(term).includes('%')
}

export function isTextSearchMatchAll(term) {
    const normalizedTerm = normalizeSearchTerm(term)

    return normalizedTerm !== '' && /^%+$/.test(normalizedTerm)
}

export function normalizeTextSearch(term) {
    return normalizeSearchTerm(term)
}

export function createTextSearchMatcher(term) {
    const normalizedTerm = normalizeSearchTerm(term)

    if (!normalizedTerm || isTextSearchMatchAll(normalizedTerm)) {
        return () => true
    }

    if (!normalizedTerm.includes('%')) {
        return (value) => normalizeSearchTerm(value).startsWith(normalizedTerm)
    }

    let source = normalizedTerm
        .split('%')
        .map((fragment) => escapeRegExp(fragment))
        .join('.*')

    if (!normalizedTerm.startsWith('%')) {
        source = `^${source}`
    }

    if (!normalizedTerm.endsWith('%')) {
        source = `${source}.*`
    }

    const expression = new RegExp(source)

    return (value) => expression.test(normalizeSearchTerm(value))
}

export function matchesTextSearch(value, term) {
    return createTextSearchMatcher(term)(value)
}

export function matchesTextSearchAny(values, term) {
    const matcher = createTextSearchMatcher(term)

    return (values || []).some((value) => value != null && matcher(value))
}
