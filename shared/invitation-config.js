export const DEFAULT_INVITATION_SETTINGS = Object.freeze({
    celebrantName: 'Duda',
    age: '16',
    title: '16 anos da Duda',
    description: 'Aniversário de 16 anos da Duda no Quintal do Ibiza.',
    tagline: 'Uma tarde para celebrar, dançar e guardar para sempre.',
    openingTagline: 'Uma tarde para brilhar, dançar e guardar na memória.',
    eventDate: '2026-11-14',
    startTime: '17:00',
    endTime: '23:00',
    venue: 'Quintal do Ibiza',
    address: 'Rua Corumbataí, 100 - Vila Virgínia, Itaquaquecetuba - SP',
    venueInstagramUrl: 'https://www.instagram.com/quintaldoibizaoficial/',
    venueInstagramHandle: '@quintaldoibizaoficial',
    dudaInstagramUrl: 'https://www.instagram.com/mariizsq_/',
    dudaInstagramHandle: '@mariizsq_',
    dressCode: 'Não vir de vermelho.',
    rsvpDeadline: '2026-10-14',
    pixKey: '56765986898',
    pixName: 'Maria Eduarda Almeida Araujo',
    pixCopyPaste: '00020101021226330014br.gov.bcb.pix0111567659868985204000053039865802BR5921MARIA EDUARDA ALMEIDA6015ITAQUAQUECETUBA62100506DUDA166304E334',
    youtubeVideoId: '_zR6ROjoOX0',
    giftIntro: 'Algumas ideias para escolher um carinho que combine com a Duda.',
})

export const DEFAULT_INVITATION_PHOTOS = Object.freeze([
    {
        id: 'duda-16-cake',
        src: '/media/duda-16-cake-v2.jpg',
        alt: 'Duda celebrando seus 16 anos com o bolo',
        objectPosition: 'center 42%',
        isPrimary: true,
    },
    {
        id: 'duda-16-portrait',
        src: '/media/duda-16-portrait.jpg',
        alt: 'Retrato da Duda para seus 16 anos',
        objectPosition: 'center 32%',
        isPrimary: false,
    },
    {
        id: 'duda-16-dress',
        src: '/media/duda-16-dress.jpg',
        alt: 'Duda usando vestido preto',
        objectPosition: 'center 36%',
        isPrimary: false,
    },
    {
        id: 'duda-16-seated',
        src: '/media/duda-16-seated.jpg',
        alt: 'Duda com balões de 16 anos',
        objectPosition: 'center 58%',
        isPrimary: false,
    },
    {
        id: 'duda-16-balloons',
        src: '/media/duda-16-balloons.jpg',
        alt: 'Duda entre os balões de 16 anos',
        objectPosition: 'center 38%',
        isPrimary: false,
    },
])

const SETTINGS_KEYS =
    Object.keys(DEFAULT_INVITATION_SETTINGS)

function cleanSettingValue(value, fallback) {
    if (value === null || value === undefined) {
        return fallback
    }

    const normalized =
        String(value).trim()

    return normalized || fallback
}

export function normalizeInvitationSettings(value = {}) {
    return Object.fromEntries(
        SETTINGS_KEYS.map((key) => [
            key,
            cleanSettingValue(
                value?.[key],
                DEFAULT_INVITATION_SETTINGS[key],
            ),
        ])
    )
}

function parseDateParts(dateValue) {
    const match =
        String(dateValue || '')
            .match(/^(\d{4})-(\d{2})-(\d{2})$/)

    if (!match) {
        return {
            year: 2026,
            month: 11,
            day: 14,
        }
    }

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
    }
}

function formatDateLong(dateValue) {
    const {
        year,
        month,
        day,
    } = parseDateParts(dateValue)

    return new Intl.DateTimeFormat(
        'pt-BR',
        {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        },
    ).format(
        new Date(Date.UTC(year, month - 1, day, 12)),
    )
}

function compactDate(dateValue, separator = ' · ') {
    const {
        year,
        month,
        day,
    } = parseDateParts(dateValue)

    return [
        String(day).padStart(2, '0'),
        String(month).padStart(2, '0'),
        String(year),
    ].join(separator)
}

function formatTimeDisplay(timeValue) {
    const normalized =
        String(timeValue || '17:00')

    const [hour, minute] =
        normalized.split(':')

    return minute === '00'
        ? `${Number(hour)}h`
        : `${Number(hour)}h${minute}`
}

function toUtcCalendarValue(dateValue, timeValue) {
    const {
        year,
        month,
        day,
    } = parseDateParts(dateValue)

    const [
        hour = '0',
        minute = '0',
    ] = String(timeValue || '00:00')
        .split(':')

    /*
     * A festa acontece em São Paulo (UTC-3).
     * Somamos três horas para gerar a marca UTC usada por calendários.
     */
    return new Date(Date.UTC(
        year,
        month - 1,
        day,
        Number(hour) + 3,
        Number(minute),
    ))
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')
}

export function buildInvitationConfig({
    settings,
    photos,
} = {}) {
    const normalizedSettings =
        normalizeInvitationSettings(settings)

    const normalizedPhotos =
        Array.isArray(photos)
        && photos.some((photo) => photo?.src)
            ? photos
                .filter((photo) => photo?.src)
                .map((photo, index) => ({
                    id:
                        photo.id
                        || `photo-${index + 1}`,
                    src: String(photo.src),
                    alt:
                        String(
                            photo.alt
                            || `Foto de ${normalizedSettings.celebrantName}`,
                        ),
                    objectPosition:
                        String(
                            photo.objectPosition
                            || 'center',
                        ),
                    isPrimary:
                        Boolean(photo.isPrimary),
                }))
            : DEFAULT_INVITATION_PHOTOS

    const dateShortDisplay =
        compactDate(
            normalizedSettings.eventDate,
            '/',
        )

    const dateCompactDisplay =
        compactDate(
            normalizedSettings.eventDate,
        )

    const startsAt =
        `${normalizedSettings.eventDate}`
        + `T${normalizedSettings.startTime}:00-03:00`

    const mapUrl =
        `https://www.google.com/maps/search/?api=1&query=${
            encodeURIComponent(
                normalizedSettings.address,
            )
        }`

    const wazeUrl =
        `https://waze.com/ul?q=${
            encodeURIComponent(
                normalizedSettings.address,
            )
        }&navigate=yes`

    const utcStart =
        toUtcCalendarValue(
            normalizedSettings.eventDate,
            normalizedSettings.startTime,
        )

    const utcEnd =
        toUtcCalendarValue(
            normalizedSettings.eventDate,
            normalizedSettings.endTime,
        )

    const googleCalendarUrl = (
        'https://calendar.google.com/calendar/render'
        + '?action=TEMPLATE'
        + `&text=${encodeURIComponent(normalizedSettings.title)}`
        + `&dates=${utcStart}/${utcEnd}`
        + `&details=${encodeURIComponent(normalizedSettings.description)}`
        + `&location=${encodeURIComponent(normalizedSettings.address)}`
        + '&ctz=America%2FSao_Paulo'
    )

    return {
        settings: normalizedSettings,
        photos: normalizedPhotos,
        event: {
            ...normalizedSettings,
            startsAt,
            dateDisplay:
                formatDateLong(
                    normalizedSettings.eventDate,
                ),
            dateShortDisplay,
            dateCompactDisplay,
            timeDisplay:
                formatTimeDisplay(
                    normalizedSettings.startTime,
                ),
            utcStart,
            utcEnd,
            timeZone: 'America/Sao_Paulo',
            calendarUid:
                `duda-${normalizedSettings.eventDate}`
                + '@dudanoibiza.com.br',
            mapUrl,
            wazeUrl,
            googleCalendarUrl,
        },
        rsvp: {
            deadline:
                normalizedSettings.rsvpDeadline,
            deadlineDisplay:
                compactDate(
                    normalizedSettings.rsvpDeadline,
                    '/',
                ),
        },
    }
}

export const DEFAULT_INVITATION_CONFIG =
    Object.freeze(
        buildInvitationConfig(),
    )
