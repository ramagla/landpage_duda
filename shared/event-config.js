export const EVENT = Object.freeze({
    title: '16 anos da Duda',
    description: 'Aniversário de 16 anos da Duda no Quintal do Ibiza.',
    venue: 'Quintal do Ibiza',
    venueInstagramUrl: 'https://www.instagram.com/quintaldoibizaoficial/',
    dudaInstagramUrl: 'https://www.instagram.com/mariizsq_/',
    address: 'Rua Corumbataí, 100 - Vila Virgínia, Itaquaquecetuba - SP',
    startsAt: '2026-11-14T17:00:00-03:00',
    dateDisplay: '14 de novembro de 2026',
    dateShortDisplay: '14/11/2026',
    dateCompactDisplay: '14 · 11 · 2026',
    timeDisplay: '17h',
    utcStart: '20261114T200000Z',
    utcEnd: '20261115T020000Z',
    timeZone: 'America/Sao_Paulo',
    calendarUid: 'duda-16-20261114@dudanoibiza.com.br',
})

export const MAP_URL =
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EVENT.address)}`

export const WAZE_URL =
    `https://waze.com/ul?q=${encodeURIComponent(EVENT.address)}&navigate=yes`

export const GOOGLE_CALENDAR_URL = (
    'https://calendar.google.com/calendar/render'
    + '?action=TEMPLATE'
    + `&text=${encodeURIComponent(EVENT.title)}`
    + `&dates=${EVENT.utcStart}/${EVENT.utcEnd}`
    + `&details=${encodeURIComponent(EVENT.description)}`
    + `&location=${encodeURIComponent(EVENT.address)}`
    + `&ctz=${encodeURIComponent(EVENT.timeZone)}`
)
