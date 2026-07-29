const STORAGE_KEY =
    'duda-admin-offline-checkins'

export function readOfflineCheckins() {
    if (typeof window === 'undefined') {
        return []
    }

    try {
        const stored =
            JSON.parse(
                window.localStorage
                    .getItem(STORAGE_KEY)
                || '[]',
            )

        return Array.isArray(stored)
            ? stored
            : []
    } catch {
        return []
    }
}

export function storeOfflineCheckins(items) {
    if (typeof window === 'undefined') {
        return
    }

    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items || []),
    )
}

export function queueOfflineCheckin(
    items,
    payload,
) {
    const key =
        `${payload.guestId}:${payload.attendeeKey}`

    return [
        ...(items || [])
            .filter(
                (item) => (
                    item.key !== key
                ),
            ),
        {
            ...payload,
            key,
            queuedAt:
                new Date().toISOString(),
        },
    ]
}
