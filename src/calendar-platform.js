export function detectCalendarPlatform({
    userAgent = '',
    platform = '',
    maxTouchPoints = 0,
} = {}) {
    const isIOS = (
        /iPhone|iPad|iPod/i.test(userAgent)
        || (
            platform === 'MacIntel'
            && maxTouchPoints > 1
        )
    )

    if (isIOS) {
        return 'ios'
    }

    if (/Android/i.test(userAgent)) {
        return 'android'
    }

    return 'desktop'
}

export function getCalendarPlatform() {
    if (
        typeof window === 'undefined'
        || typeof navigator === 'undefined'
    ) {
        return 'desktop'
    }

    return detectCalendarPlatform({
        userAgent:
            navigator.userAgent || '',
        platform:
            navigator.platform || '',
        maxTouchPoints:
            navigator.maxTouchPoints || 0,
    })
}
