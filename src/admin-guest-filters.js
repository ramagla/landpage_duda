function asKnownAge(value) {
    if (
        value === ''
        || value === null
        || value === undefined
    ) {
        return null
    }

    const age = Number(value)

    return Number.isFinite(age)
        ? age
        : null
}

export function getGuestInvitationAges(guest) {
    return [
        guest?.age,
        ...(guest?.companions || [])
            .map((item) => item.age),
        ...(guest?.presetCompanions || [])
            .map((item) => item.age),
    ]
        .map(asKnownAge)
        .filter((age) => age !== null)
}

export function guestMatchesAgeFilter(
    guest,
    filter,
) {
    if (
        !filter
        || filter === 'todos'
    ) {
        return true
    }

    const ages =
        getGuestInvitationAges(guest)

    if (filter === 'ate6') {
        return ages.some(
            (age) => age <= 6,
        )
    }

    if (filter === 'acima6') {
        return ages.some(
            (age) => age > 6,
        )
    }

    if (filter === 'sem_idade') {
        return ages.length === 0
    }

    return true
}
