export const RSVP_DEADLINE_DISPLAY = '14/10/2026'
export const RSVP_CUTOFF_DATE = '2026-10-15'
export const RSVP_TIME_ZONE = 'America/Sao_Paulo'

export const RSVP_CLOSED_MESSAGE =
    'O prazo para confirmação terminou em 14/10/2026. Para qualquer alteração, fale com o Rafael.'

export function dateKeyInSaoPaulo(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: RSVP_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)

    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value])
    )

    return `${values.year}-${values.month}-${values.day}`
}

export function isRsvpClosedAt(date = new Date()) {
    return dateKeyInSaoPaulo(date) >= RSVP_CUTOFF_DATE
}
